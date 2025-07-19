import { FileScanner, FileInfo } from '../utils/file-scanner';
import { AIFileSelection, AnalysisOptions, AIAnalysisResult, FilePriority } from '../types/ai-context';
import { FilePrioritizer } from './file-prioritizer';
import { TokenEstimator } from './token-estimator';
import { loadAIConfig } from './config';
import { getAICache } from './ai-cache';
import { createLargeRepositoryHandler, LargeRepositoryHandler } from './large-repository-handler';
import { getPerformanceMonitor } from './performance-monitor';
import path from 'path';
import fs from 'fs/promises';

/**
 * Core engine for AI-assisted context generation
 */
export class AIContextEngine {
    private fileScanner: FileScanner;
    private filePrioritizer: FilePrioritizer;
    private tokenEstimator: TokenEstimator;

    constructor() {
        this.fileScanner = new FileScanner();
        this.filePrioritizer = new FilePrioritizer();
        this.tokenEstimator = new TokenEstimator();
    }

    /**
     * Analyze the codebase and select relevant files based on the prompt
     */
    async analyze(options: AnalysisOptions): Promise<AIAnalysisResult> {
        const {
            prompt,
            codebasePath,
            maxFiles = 20,
            excludePatterns = [],
            includePatterns = [],
            aiProvider,
            aiModel
        } = options;

        // Initialize performance monitoring
        const perfMonitor = getPerformanceMonitor();
        perfMonitor.reset();

        // Load AI configuration with defaults
        const aiConfig = loadAIConfig();

        // Use provided AI provider/model or fall back to config
        const provider = aiProvider || aiConfig.provider;
        const model = aiModel || aiConfig.model;

        // Step 1: Scan the codebase
        perfMonitor.startPhase('scanning', { codebasePath, maxFiles: 1000 });
        console.log(`Scanning codebase at ${codebasePath}...`);
        const files = await this.fileScanner.scan(codebasePath, {
            excludePatterns: [...excludePatterns],
            includePatterns,
            respectGitignore: true,
            maxFiles: 1000, // Scan up to 1000 files, but we'll prioritize later
        });
        perfMonitor.endPhase('scanning');
        perfMonitor.setCounter('filesScanned', files.length);

        console.log(`Found ${files.length} files in codebase.`);

        // Step 1.5: Analyze repository size and apply large repository optimizations
        const largeRepoHandler = createLargeRepositoryHandler();
        const repoSize = await largeRepoHandler.classifyRepository(files);

        if (repoSize.classification === 'large' || repoSize.classification === 'huge') {
            console.log(`Large repository detected (${repoSize.classification}): ${repoSize.fileCount} files`);
            console.log('Recommendations:');
            repoSize.recommendations.forEach(rec => console.log(`  - ${rec}`));

            const timeEstimate = largeRepoHandler.estimateAnalysisTime(repoSize);
            console.log(`Estimated analysis time: ${timeEstimate.estimatedMinutes} minutes`);
        }

        // Step 1.6: Check cache for existing analysis
        perfMonitor.startPhase('caching');
        const cache = getAICache();
        const fileList = files.map(f => f.relativePath);
        const cachedResult = await cache.get(options, fileList);
        perfMonitor.endPhase('caching');

        if (cachedResult) {
            console.log('Using cached AI analysis result');
            perfMonitor.incrementCounter('cacheHits');
            return cachedResult;
        }
        perfMonitor.incrementCounter('cacheMisses');

        // Step 2: Prioritize files based on the prompt
        perfMonitor.startPhase('prioritization', { provider, model, fileCount: files.length });
        console.log(`Analyzing files with ${provider}/${model}...`);
        const prioritizedFiles = await this.filePrioritizer.prioritize({
            files,
            prompt,
            provider,
            model,
            maxFiles
        });
        perfMonitor.endPhase('prioritization');

        // Step 3: Read file contents and calculate token estimates in parallel
        perfMonitor.startPhase('fileReading');
        perfMonitor.startPhase('tokenEstimation');
        console.log(`Processing ${prioritizedFiles.length} prioritized files...`);

        const maxConcurrency = aiConfig.performance?.maxConcurrentRequests || 5;
        perfMonitor.incrementCounter('parallelOperations', maxConcurrency);
        const selections: AIFileSelection[] = [];
        let highPriorityCount = 0;
        let mediumPriorityCount = 0;
        let lowPriorityCount = 0;
        let totalTokens = 0;

        // Process files in parallel batches
        const processFile = async (prioritizedFile: any): Promise<AIFileSelection | null> => {
            try {
                const content = await fs.readFile(prioritizedFile.path, 'utf-8');
                const tokenEstimate = await this.tokenEstimator.estimateTokens(content, model);

                // Determine if file should be pre-selected based on priority
                let preSelected = false;
                switch (prioritizedFile.priority) {
                    case 'high':
                        preSelected = aiConfig?.interactive?.preSelectHigh !== false;
                        break;
                    case 'medium':
                        preSelected = aiConfig?.interactive?.preSelectMedium === true;
                        break;
                    case 'low':
                        preSelected = aiConfig?.interactive?.preSelectLow === true;
                        break;
                }

                return {
                    file: prioritizedFile.relativePath,
                    path: prioritizedFile.path,
                    content,
                    priority: prioritizedFile.priority,
                    reason: prioritizedFile.reason,
                    preSelected,
                    tokenEstimate
                };
            } catch (error) {
                console.warn(`Warning: Could not read file ${prioritizedFile.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return null;
            }
        };

        // Process files in parallel with concurrency limit
        const results = await this.processInParallel(prioritizedFiles, processFile, maxConcurrency);

        // Filter out null results and calculate counts
        for (const result of results) {
            if (result) {
                selections.push(result);
                totalTokens += result.tokenEstimate;

                switch (result.priority) {
                    case 'high':
                        highPriorityCount++;
                        break;
                    case 'medium':
                        mediumPriorityCount++;
                        break;
                    case 'low':
                        lowPriorityCount++;
                        break;
                }
            }
        }

        perfMonitor.endPhase('fileReading');
        perfMonitor.endPhase('tokenEstimation');
        perfMonitor.setCounter('filesProcessed', selections.length);
        perfMonitor.setCounter('totalTokens', totalTokens);

        // Step 4: Apply smart truncation for large repositories
        let finalSelections = selections;
        let truncationInfo: { removed: AIFileSelection[]; strategy: string } | null = null;

        // Get model token limit
        const modelLimit = this.tokenEstimator.getModelTokenLimit(provider, model);
        const targetTokens = Math.min(modelLimit * 0.8, 150000); // Use 80% of model limit or 150k, whichever is smaller

        if (totalTokens > targetTokens) {
            perfMonitor.startPhase('truncation');
            console.log(`Token limit exceeded (${totalTokens} > ${targetTokens}), applying smart truncation...`);

            const truncationResult = await largeRepoHandler.applySmartTruncation(
                selections,
                options,
                targetTokens
            );

            finalSelections = truncationResult.truncated;
            truncationInfo = {
                removed: truncationResult.removed,
                strategy: truncationResult.strategy
            };

            // Recalculate counts and tokens after truncation
            highPriorityCount = finalSelections.filter(s => s.priority === 'high').length;
            mediumPriorityCount = finalSelections.filter(s => s.priority === 'medium').length;
            lowPriorityCount = finalSelections.filter(s => s.priority === 'low').length;
            totalTokens = finalSelections.reduce((sum, s) => sum + s.tokenEstimate, 0);

            perfMonitor.endPhase('truncation');
            console.log(`Truncation applied (${truncationResult.strategy}): ${finalSelections.length} files selected, ${truncationResult.removed.length} files removed`);
        }

        // Step 5: Calculate cost estimate
        const estimatedCost = this.tokenEstimator.estimateCost(totalTokens, provider, model);

        // Step 6: Create the analysis result
        const result: AIAnalysisResult = {
            selections: finalSelections,
            summary: {
                totalFiles: files.length,
                selectedFiles: finalSelections.length,
                highPriorityCount,
                mediumPriorityCount,
                lowPriorityCount,
                totalTokens,
                estimatedCost
            },
            prompt,
            timestamp: new Date()
        };

        // Step 7: Cache the result for future use
        perfMonitor.startPhase('caching');
        await cache.set(options, fileList, result);
        perfMonitor.endPhase('caching');

        // Step 8: Generate and display performance report
        const perfSummary = perfMonitor.getSummary();
        console.log(`\nPerformance Summary:`);
        console.log(`  Duration: ${perfSummary.duration}`);
        console.log(`  Files/sec: ${perfSummary.filesPerSecond}`);
        console.log(`  Tokens/sec: ${perfSummary.tokensPerSecond}`);
        console.log(`  Cache hit rate: ${perfSummary.cacheHitRate}`);

        if (perfSummary.bottlenecks > 0) {
            console.log(`  Performance bottlenecks detected: ${perfSummary.bottlenecks}`);
            console.log(`  Run with --verbose for detailed performance report`);
        }

        // Log detailed performance report if there are significant bottlenecks
        if (perfSummary.bottlenecks > 2) {
            console.log('\n--- Detailed Performance Report ---');
            perfMonitor.logReport();
        }

        return result;
    }

    /**
     * Process items in parallel with concurrency limit
     */
    private async processInParallel<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        maxConcurrency: number
    ): Promise<R[]> {
        const results: R[] = [];
        const executing: Promise<void>[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Create a promise for this item
            const promise = processor(item).then(result => {
                results[i] = result;
            });

            executing.push(promise);

            // If we've reached max concurrency, wait for one to complete
            if (executing.length >= maxConcurrency) {
                await Promise.race(executing);
                // Remove completed promises
                for (let j = executing.length - 1; j >= 0; j--) {
                    if (await Promise.race([executing[j], Promise.resolve('pending')]) !== 'pending') {
                        executing.splice(j, 1);
                    }
                }
            }
        }

        // Wait for all remaining promises to complete
        await Promise.all(executing);

        return results;
    }

    /**
     * Bootstrap a new project by selecting core files
     */
    async bootstrap(codebasePath: string, options: Partial<AnalysisOptions> = {}): Promise<AIAnalysisResult> {
        // Load AI configuration with defaults
        const aiConfig = loadAIConfig();

        // Use bootstrap prompt from config
        const bootstrapPrompt = aiConfig.bootstrap.prompt;

        return this.analyze({
            prompt: bootstrapPrompt,
            codebasePath,
            maxFiles: aiConfig.bootstrap.maxFiles,
            ...options
        });
    }
}