import { FileInfo } from '../utils/file-scanner';
import { AIFileSelection, AnalysisOptions, AIAnalysisResult } from '../types/ai-context';
import { TokenEstimator } from './token-estimator';
import { loadAIConfig } from './config';

/**
 * Configuration for large repository handling
 */
export interface LargeRepositoryConfig {
    maxFiles: number;
    maxTokens: number;
    chunkSize: number;
    priorityWeights: {
        high: number;
        medium: number;
        low: number;
    };
    truncationStrategy: 'priority' | 'balanced' | 'recent';
    enablePagination: boolean;
    maxFileSize: number; // Maximum file size in bytes to include
}

/**
 * Default configuration for large repositories
 */
const DEFAULT_LARGE_REPO_CONFIG: LargeRepositoryConfig = {
    maxFiles: 50,
    maxTokens: 150000, // Conservative limit for most models
    chunkSize: 20,
    priorityWeights: {
        high: 3,
        medium: 2,
        low: 1
    },
    truncationStrategy: 'priority',
    enablePagination: true,
    maxFileSize: 100 * 1024 // 100KB max file size
};

/**
 * Repository size classification
 */
export interface RepositorySize {
    classification: 'small' | 'medium' | 'large' | 'huge';
    fileCount: number;
    totalSize: number;
    recommendations: string[];
}

/**
 * Chunked analysis result
 */
export interface ChunkedAnalysisResult {
    chunks: AIAnalysisResult[];
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    recommendations: string[];
}

/**
 * Handler for large repository analysis
 */
export class LargeRepositoryHandler {
    private tokenEstimator: TokenEstimator;
    private config: LargeRepositoryConfig;

    constructor(config: Partial<LargeRepositoryConfig> = {}) {
        this.tokenEstimator = new TokenEstimator();
        this.config = { ...DEFAULT_LARGE_REPO_CONFIG, ...config };
    }

    /**
     * Classify repository size and provide recommendations
     */
    async classifyRepository(files: FileInfo[]): Promise<RepositorySize> {
        const fileCount = files.length;
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        let classification: RepositorySize['classification'];
        const recommendations: string[] = [];

        if (fileCount < 100) {
            classification = 'small';
            recommendations.push('Repository is small enough for full analysis');
        } else if (fileCount < 500) {
            classification = 'medium';
            recommendations.push('Consider using file type filters for focused analysis');
        } else if (fileCount < 2000) {
            classification = 'large';
            recommendations.push('Enable chunked analysis for better performance');
            recommendations.push('Use specific prompts to focus on relevant areas');
            recommendations.push('Consider excluding test files and documentation');
        } else {
            classification = 'huge';
            recommendations.push('Use highly specific prompts to narrow scope');
            recommendations.push('Enable aggressive filtering and chunking');
            recommendations.push('Consider analyzing specific directories only');
            recommendations.push('Use exclude patterns to skip non-essential files');
        }

        // Size-based recommendations
        if (totalSize > 50 * 1024 * 1024) { // 50MB
            recommendations.push('Large codebase detected - consider file size limits');
        }

        return {
            classification,
            fileCount,
            totalSize,
            recommendations
        };
    }

    /**
     * Apply smart truncation to file selections
     */
    async applySmartTruncation(
        selections: AIFileSelection[],
        options: AnalysisOptions,
        targetTokens: number
    ): Promise<{
        truncated: AIFileSelection[];
        removed: AIFileSelection[];
        strategy: string;
    }> {
        const aiConfig = loadAIConfig();
        const provider = options.aiProvider || aiConfig.provider;
        const model = options.aiModel || aiConfig.model;

        // Calculate current token usage
        let currentTokens = 0;
        for (const selection of selections) {
            currentTokens += selection.tokenEstimate;
        }

        if (currentTokens <= targetTokens) {
            return {
                truncated: selections,
                removed: [],
                strategy: 'no-truncation'
            };
        }

        let truncated: AIFileSelection[] = [];
        let removed: AIFileSelection[] = [];
        let strategy: string;

        switch (this.config.truncationStrategy) {
            case 'priority':
                ({ truncated, removed, strategy } = this.truncateByPriority(selections, targetTokens));
                break;
            case 'balanced':
                ({ truncated, removed, strategy } = this.truncateBalanced(selections, targetTokens));
                break;
            case 'recent':
                ({ truncated, removed, strategy } = this.truncateByRecency(selections, targetTokens));
                break;
            default:
                ({ truncated, removed, strategy } = this.truncateByPriority(selections, targetTokens));
        }

        return { truncated, removed, strategy };
    }

    /**
     * Truncate by priority (keep high priority files first)
     */
    private truncateByPriority(
        selections: AIFileSelection[],
        targetTokens: number
    ): { truncated: AIFileSelection[]; removed: AIFileSelection[]; strategy: string } {
        // Sort by priority (high -> medium -> low)
        const sorted = [...selections].sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        const truncated: AIFileSelection[] = [];
        const removed: AIFileSelection[] = [];
        let currentTokens = 0;

        for (const selection of sorted) {
            if (currentTokens + selection.tokenEstimate <= targetTokens) {
                truncated.push(selection);
                currentTokens += selection.tokenEstimate;
            } else {
                removed.push(selection);
            }
        }

        return {
            truncated,
            removed,
            strategy: 'priority-based'
        };
    }

    /**
     * Truncate with balanced representation from each priority
     */
    private truncateBalanced(
        selections: AIFileSelection[],
        targetTokens: number
    ): { truncated: AIFileSelection[]; removed: AIFileSelection[]; strategy: string } {
        const byPriority = {
            high: selections.filter(s => s.priority === 'high'),
            medium: selections.filter(s => s.priority === 'medium'),
            low: selections.filter(s => s.priority === 'low')
        };

        // Calculate target tokens for each priority based on weights
        const totalWeight = this.config.priorityWeights.high +
            this.config.priorityWeights.medium +
            this.config.priorityWeights.low;

        const targetTokensByPriority = {
            high: Math.floor(targetTokens * this.config.priorityWeights.high / totalWeight),
            medium: Math.floor(targetTokens * this.config.priorityWeights.medium / totalWeight),
            low: Math.floor(targetTokens * this.config.priorityWeights.low / totalWeight)
        };

        const truncated: AIFileSelection[] = [];
        const removed: AIFileSelection[] = [];

        // Select files from each priority group
        for (const [priority, files] of Object.entries(byPriority)) {
            const targetForPriority = targetTokensByPriority[priority as keyof typeof targetTokensByPriority];
            let currentTokens = 0;

            // Sort by token count (smaller files first for better coverage)
            const sortedFiles = files.sort((a, b) => a.tokenEstimate - b.tokenEstimate);

            for (const file of sortedFiles) {
                if (currentTokens + file.tokenEstimate <= targetForPriority) {
                    truncated.push(file);
                    currentTokens += file.tokenEstimate;
                } else {
                    removed.push(file);
                }
            }
        }

        return {
            truncated,
            removed,
            strategy: 'balanced-priority'
        };
    }

    /**
     * Truncate by file recency (keep recently modified files)
     */
    private truncateByRecency(
        selections: AIFileSelection[],
        targetTokens: number
    ): { truncated: AIFileSelection[]; removed: AIFileSelection[]; strategy: string } {
        // Sort by last modified date (most recent first)
        // Note: We'd need to add lastModified to AIFileSelection for this to work
        // For now, fall back to priority-based truncation
        return this.truncateByPriority(selections, targetTokens);
    }

    /**
     * Create chunks for large repository analysis
     */
    async createChunks(
        files: FileInfo[],
        options: AnalysisOptions
    ): Promise<FileInfo[][]> {
        if (!this.config.enablePagination) {
            return [files];
        }

        const repoSize = await this.classifyRepository(files);

        // For small/medium repos, don't chunk
        if (repoSize.classification === 'small' || repoSize.classification === 'medium') {
            return [files];
        }

        // Filter out very large files first
        const filteredFiles = files.filter(file => file.size <= this.config.maxFileSize);

        // Group files by directory for better chunking
        const filesByDirectory = new Map<string, FileInfo[]>();

        for (const file of filteredFiles) {
            const dir = file.relativePath.split('/')[0] || '.';
            if (!filesByDirectory.has(dir)) {
                filesByDirectory.set(dir, []);
            }
            filesByDirectory.get(dir)!.push(file);
        }

        // Create chunks trying to keep related files together
        const chunks: FileInfo[][] = [];
        let currentChunk: FileInfo[] = [];

        for (const [directory, dirFiles] of filesByDirectory) {
            // If adding this directory would exceed chunk size, start new chunk
            if (currentChunk.length + dirFiles.length > this.config.chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = [];
            }

            // If directory itself is too large, split it
            if (dirFiles.length > this.config.chunkSize) {
                // Add current chunk if not empty
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                }

                // Split large directory into multiple chunks
                for (let i = 0; i < dirFiles.length; i += this.config.chunkSize) {
                    const dirChunk = dirFiles.slice(i, i + this.config.chunkSize);
                    chunks.push(dirChunk);
                }
            } else {
                currentChunk.push(...dirFiles);
            }
        }

        // Add remaining files
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Get optimization suggestions for large repositories
     */
    getOptimizationSuggestions(repoSize: RepositorySize, options: AnalysisOptions): string[] {
        const suggestions: string[] = [];

        // Size-based suggestions
        if (repoSize.classification === 'large' || repoSize.classification === 'huge') {
            suggestions.push('Consider using more specific prompts to narrow the analysis scope');
            suggestions.push('Use exclude patterns to skip non-essential directories (tests, docs, etc.)');
            suggestions.push('Enable chunked analysis for better performance');
        }

        // Token-based suggestions
        if (repoSize.fileCount > 1000) {
            suggestions.push('Consider analyzing specific directories instead of the entire repository');
            suggestions.push('Use file type filters to focus on relevant code files');
        }

        // Performance suggestions
        if (repoSize.totalSize > 100 * 1024 * 1024) { // 100MB
            suggestions.push('Large repository detected - consider using file size limits');
            suggestions.push('Enable caching to avoid re-analyzing unchanged files');
        }

        // Prompt-specific suggestions
        if (options.prompt.length < 20) {
            suggestions.push('Use more detailed prompts for better file selection in large repositories');
        }

        return suggestions;
    }

    /**
     * Estimate analysis time for repository
     */
    estimateAnalysisTime(repoSize: RepositorySize): {
        estimatedMinutes: number;
        factors: string[];
    } {
        const factors: string[] = [];
        let baseTime = 0;

        // Base time by repository size
        switch (repoSize.classification) {
            case 'small':
                baseTime = 1;
                factors.push('Small repository (< 100 files)');
                break;
            case 'medium':
                baseTime = 3;
                factors.push('Medium repository (100-500 files)');
                break;
            case 'large':
                baseTime = 8;
                factors.push('Large repository (500-2000 files)');
                break;
            case 'huge':
                baseTime = 20;
                factors.push('Huge repository (> 2000 files)');
                break;
        }

        // Adjust for chunking
        if (this.config.enablePagination && repoSize.classification !== 'small') {
            baseTime *= 1.5;
            factors.push('Chunked analysis enabled');
        }

        // Adjust for AI provider (some are faster than others)
        factors.push('Time may vary based on AI provider response time');

        return {
            estimatedMinutes: Math.ceil(baseTime),
            factors
        };
    }
}

/**
 * Create a large repository handler with configuration from AI config
 */
export function createLargeRepositoryHandler(): LargeRepositoryHandler {
    const aiConfig = loadAIConfig();

    const config: Partial<LargeRepositoryConfig> = {
        maxFiles: aiConfig.bootstrap?.maxFiles || 50,
        enablePagination: aiConfig.performance?.enableCaching !== false, // Use caching setting as proxy
    };

    return new LargeRepositoryHandler(config);
}