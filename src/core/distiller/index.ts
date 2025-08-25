import type {
    DistillerOptions,
    CompressionResult,
    DistillationResult,
    CompressedFile,
    ExtractedAPI,
    ProjectStructure,
    DependencyMap,
} from "../../types";
import { getLanguageRegistry, ProcessingOptions } from "../languages";
import { getFormatterRegistry } from "../../commands/distill/formatters";
import { Parser } from "../parser/parser";
import { promises as fs } from "fs";
import { join, relative, dirname, basename } from "path";
import { globby } from "globby";
import { createHash } from "crypto";
import { DistillerProgress } from "./progress";

export class Distiller {
    private registry = getLanguageRegistry();
    private formatters = getFormatterRegistry();
    private options: DistillerOptions;
    private progress?: DistillerProgress;
    private defaultExcludes = [
        "node_modules/**",
        ".git/**",
        ".dex/**",
        "dist/**",
        "build/**",
        "coverage/**",
        "*.log",
        ".DS_Store",
        "thumbs.db",
        "*.lock",
        "package-lock.json",
        ".env*",
        "*.min.js",
        "*.min.css",
        "*.map",
        "**/*.spec.ts",
        "**/*.spec.js",
        "**/*.test.ts",
        "**/*.test.js",
    ];

    constructor(options: DistillerOptions = {}) {
        this.options = {
            depth: "public",
            compressFirst: true,
            includeDocstrings: true,
            includeComments: false,
            format: "distilled",
            parallel: true,
            ...options,
        } as DistillerOptions;

        // Registry is auto-initialized on import
    }

    async distill(
        targetPath: string,
        progress?: DistillerProgress,
    ): Promise<
        | CompressionResult
        | DistillationResult
        | { compression: CompressionResult; distillation: DistillationResult }
    > {
        this.progress = progress;

        // Initialize language modules
        await this.registry.initializeAll();

        // Phase 1: Compression (if enabled)
        let compressionResult: CompressionResult | undefined;
        if (
            this.options.compressFirst !== false ||
            this.options.format === "compressed" ||
            this.options.format === "both"
        ) {
            compressionResult = await this.compress(targetPath);
        }

        // Phase 2: Distillation (if format requires it)
        let distillationResult: DistillationResult | undefined;
        if (
            this.options.format === "distilled" ||
            this.options.format === "both"
        ) {
            const filesToDistill = compressionResult
                ? compressionResult.files.filter((f) =>
                      this.registry.isFileSupported(f.path),
                  )
                : await this.getFilesToProcess(targetPath);

            // Don't restart progress if already running from compression phase
            if (!compressionResult && this.progress) {
                this.progress.start(filesToDistill.length);
            }

            const stats = await fs.stat(targetPath);
            const basePath = stats.isFile() ? dirname(targetPath) : targetPath;
            distillationResult = await this.distillFiles(
                filesToDistill,
                basePath,
            );
        }

        // Return based on format option
        if (this.options.format === "compressed") {
            return compressionResult!;
        } else if (this.options.format === "distilled") {
            return distillationResult!;
        } else {
            return {
                compression: compressionResult!,
                distillation: distillationResult!,
            };
        }
    }

    async distillSelectedFiles(
        selectedFiles: string[],
        basePath: string,
        progress?: DistillerProgress,
    ): Promise<
        | CompressionResult
        | DistillationResult
        | { compression: CompressionResult; distillation: DistillationResult }
    > {
        this.progress = progress;

        // Initialize language modules
        await this.registry.initializeAll();

        // Phase 1: Compression (if enabled)
        let compressionResult: CompressionResult | undefined;
        if (
            this.options.compressFirst !== false ||
            this.options.format === "compressed" ||
            this.options.format === "both"
        ) {
            compressionResult = await this.compressSelectedFiles(
                selectedFiles,
                basePath,
            );
        }

        // Phase 2: Distillation (if format requires it)
        let distillationResult: DistillationResult | undefined;
        if (
            this.options.format === "distilled" ||
            this.options.format === "both"
        ) {
            const filesToDistill = compressionResult
                ? compressionResult.files.filter((f) =>
                      this.registry.isFileSupported(f.path),
                  )
                : selectedFiles;

            // Don't restart progress if already running from compression phase
            if (!compressionResult && this.progress) {
                this.progress.start(filesToDistill.length);
            }

            distillationResult = await this.distillFiles(
                filesToDistill,
                basePath,
            );
        }

        // Return based on format option
        if (this.options.format === "compressed") {
            return compressionResult!;
        } else if (this.options.format === "distilled") {
            return distillationResult!;
        } else {
            return {
                compression: compressionResult!,
                distillation: distillationResult!,
            };
        }
    }

    private async compress(targetPath: string): Promise<CompressionResult> {
        const files = await this.getFilesToProcess(targetPath);
        const stats = await fs.stat(targetPath);
        const basePath = stats.isFile() ? dirname(targetPath) : targetPath;
        return this.compressFiles(files, basePath);
    }

    private async compressSelectedFiles(
        selectedFiles: string[],
        basePath: string,
    ): Promise<CompressionResult> {
        return this.compressFiles(selectedFiles, basePath);
    }

    private async compressFiles(
        files: string[],
        basePath: string,
    ): Promise<CompressionResult> {
        const compressedFiles: CompressedFile[] = [];
        let totalSize = 0;
        const excludedCount = 0;

        // Start progress if available
        if (this.progress) {
            this.progress.start(files.length);
        }

        // Process files in parallel batches
        if (this.options.parallel) {
            const batchSize = 50;
            let cumulativeOriginalSize = 0;
            let cumulativeDistilledSize = 0;

            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const results = await Promise.all(
                    batch.map((file) => this.compressFile(join(basePath, file), file)),
                );
                compressedFiles.push(...results);
                totalSize += results.reduce((sum, f) => sum + f.size, 0);

                // Update cumulative sizes
                cumulativeOriginalSize += results.reduce(
                    (sum, f) => sum + f.size,
                    0,
                );
                cumulativeDistilledSize += results.reduce(
                    (sum, f) => sum + Math.ceil(f.content.length / 4) * 4,
                    0,
                );

                // Update progress
                if (this.progress) {
                    const processedCount = Math.min(
                        i + batchSize,
                        files.length,
                    );
                    this.progress.update(
                        processedCount,
                        cumulativeOriginalSize,
                        cumulativeDistilledSize,
                    );
                }
            }
        } else {
            // Sequential processing
            for (const file of files) {
                const compressed = await this.compressFile(join(basePath, file), file);
                compressedFiles.push(compressed);
                totalSize += compressed.size;
            }
        }

        return {
            files: compressedFiles,
            metadata: {
                totalFiles: compressedFiles.length,
                totalSize,
                excludedCount,
                timestamp: new Date().toISOString(),
            },
        };
    }

    private async compressFile(fullPath: string, relativePath?: string): Promise<CompressedFile> {
        const content = await fs.readFile(fullPath, "utf-8");
        const stats = await fs.stat(fullPath);
        const hash = createHash("sha256")
            .update(content)
            .digest("hex")
            .substring(0, 8);
        const language = Parser.detectLanguage(fullPath) || undefined;

        return {
            path: relativePath || fullPath,
            size: stats.size,
            hash,
            content,
            language,
        };
    }

    private async distillFiles(
        files: CompressedFile[] | string[],
        basePath: string,
    ): Promise<DistillationResult> {
        // Start progress if not already started
        if (this.progress && !this.progress.isSpinning) {
            const fileCount = files.length;
            this.progress.start(fileCount);
        }

        const apis: ExtractedAPI[] = [];
        const directoriesSet = new Set<string>();
        const structure: ProjectStructure = {
            directories: [],
            fileCount: 0,
            languages: {},
        };
        const dependencies: DependencyMap = {};

        let originalTokens = 0;
        let distilledTokens = 0;

        // Process files
        const filesToProcess =
            typeof files[0] === "string"
                ? await Promise.all(
                      (files as string[]).map((f) => this.compressFile(join(basePath, f), f)),
                  )
                : (files as CompressedFile[]);

        let processedCount = 0;
        let cumulativeOriginalSize = 0;
        let cumulativeDistilledSize = 0;

        for (const file of filesToProcess) {
            const language = file.language || Parser.detectLanguage(file.path);
            if (!language || !this.registry.isFileSupported(file.path)) {
                processedCount++;
                // Update progress even for unsupported files
                if (this.progress) {
                    this.progress.update(
                        processedCount,
                        cumulativeOriginalSize,
                        cumulativeDistilledSize,
                    );
                }
                continue;
            }

            // Update structure
            const dir = file.path
                .split("/")
                .slice(0, -1)
                .join("/");
            if (dir) directoriesSet.add(dir);
            structure.fileCount++;
            structure.languages[language] =
                (structure.languages[language] || 0) + 1;

            // Calculate tokens
            originalTokens += Math.ceil(file.content.length / 4);
            cumulativeOriginalSize += file.size;

            try {
                // Process with language registry
                const processingOptions: ProcessingOptions = {
                    includePrivate: this.options.includePrivate || this.options.depth === 'all',
                    includeComments: this.options.includeComments,
                    includeDocstrings: this.options.includeDocstrings,
                    includeImports: true,
                    depth: this.options.depth as 'public' | 'protected' | 'all' | undefined,
                    compact: this.options.compact || this.options.format === 'compressed',
                    includePatterns: undefined,  // Not used for name filtering at processor level
                    excludePatterns: this.options.excludeNames  // Filter export names
                };
                
                const result = await this.registry.processFile(file.path, file.content, processingOptions);
                
                // Convert to ExtractedAPI format
                const extracted: ExtractedAPI = {
                    file: file.path,
                    imports: result.imports.map(i => i.source),
                    exports: result.exports.map(e => ({
                        name: e.name,
                        type: this.mapExportKind(e.kind),
                        signature: e.signature,
                        visibility: e.visibility || 'public',
                        location: { startLine: e.line || 0, endLine: e.line || 0 },
                        members: e.members?.map(m => ({
                            name: m.name,
                            signature: m.signature,
                            type: (m.kind === 'constructor' || m.kind === 'getter' || m.kind === 'setter') ? 'method' : m.kind as 'property' | 'method'
                        }))
                    }))
                };

                apis.push(extracted);

                // Estimate distilled tokens
                const distilledContent = this.serializeExtractedAPI(extracted);
                const distilledBytes = distilledContent.length;
                distilledTokens += Math.ceil(distilledBytes / 4);
                cumulativeDistilledSize += distilledBytes;

                // Extract dependencies (imports/exports)
                dependencies[file.path] = {
                    imports: result.imports.map(i => i.source),
                    exports: result.exports.map(e => e.name)
                };
            } catch (error) {
                // Silently continue with other files
                if (process.env.DEBUG) {
                    console.warn(`Failed to distill ${file.path}:`, error);
                }
            }

            // Update progress
            processedCount++;
            if (this.progress) {
                this.progress.update(
                    processedCount,
                    cumulativeOriginalSize,
                    cumulativeDistilledSize,
                );
            }
        }

        return {
            apis,
            structure: {
                ...structure,
                directories: Array.from(directoriesSet),
            },
            dependencies,
            metadata: {
                originalTokens,
                distilledTokens,
                compressionRatio:
                    originalTokens > 0
                        ? 1 - distilledTokens / originalTokens
                        : 0,
            },
        };
    }

    async getFilesToProcess(targetPath: string): Promise<string[]> {
        const stats = await fs.stat(targetPath);

        if (stats.isFile()) {
            // Return just the filename for single files
            return [basename(targetPath)];
        }

        // Get all files using globby
        const patterns = this.options.includePatterns && this.options.includePatterns.length > 0 
            ? this.options.includePatterns 
            : ["**/*"];
        const ignore = [
            ...this.defaultExcludes,
            ...(this.options.excludePatterns || []),
        ];

        const files = await globby(patterns, {
            cwd: targetPath,
            ignore,
            absolute: false,
            onlyFiles: true,
            dot: true,
        });

        // Apply additional filters if needed
        if (this.options.since || this.options.staged) {
            // This would integrate with git to filter files
            // For now, return all files
        }

        // Return paths relative to the target directory
        return files.map((f: string) => f);
    }

    private serializeExtractedAPI(api: ExtractedAPI): string {
        let result = `File: ${api.file}\n\n`;

        for (const exp of api.exports) {
            if (exp.docstring) {
                result += `/**\n * ${exp.docstring.split("\n").join("\n * ")}\n */\n`;
            }
            result += `${exp.signature}\n\n`;
        }

        return result;
    }

    private extractDependencies(parsed: any): {
        imports: string[];
        exports: string[];
    } {
        // This is a simplified implementation
        // In a real implementation, we'd walk the AST to find imports/exports
        return {
            imports: [],
            exports: parsed.exports?.map((e: any) => e.name) || [],
        };
    }
    
    private mapExportKind(kind: string): "function" | "class" | "interface" | "const" | "type" | "enum" {
        // Map language-specific kinds to ExtractedAPI types
        switch (kind) {
            case 'function':
            case 'class':
            case 'interface':
            case 'type':
            case 'enum':
                return kind as any;
            case 'const':
            case 'let':
            case 'var':
            case 'namespace':
            case 'module':
                return 'const';
            default:
                return 'const';
        }
    }

    /**
     * Format the distillation result based on output format
     */
    formatResult(
        result: CompressionResult | DistillationResult | any,
        originalPath?: string,
    ): string {
        // Handle null/undefined result
        if (!result) {
            return "# Distillation Result\n\nNo content was distilled.";
        }


        if ("files" in result) {
            // Compression result - XML format
            return this.formatCompression(result as CompressionResult);
        } else if ("apis" in result) {
            // Distillation result - structured format
            return this.formatDistillation(
                result as DistillationResult,
                originalPath,
            );
        } else if ("compression" in result && "distillation" in result) {
            // Both results
            return `${this.formatCompression(result.compression)}\n\n---\n\n${this.formatDistillation(result.distillation, originalPath)}`;
        }

        return JSON.stringify(result, null, 2);
    }

    private formatCompression(result: CompressionResult): string {
        // Use formatter registry
        const formatter = this.formatters.getDefault();
        return formatter.formatCompression(result, {
            includeMetadata: true,
            compact: this.options.compact
        });
    }

    private formatDistillation(
        result: DistillationResult,
        originalPath?: string,
    ): string {
        
        // Use formatter registry
        const formatter = this.formatters.getDefault();
        return formatter.formatDistillation(result, {
            includeImports: this.options.includeImports !== false,
            includePrivate: this.options.includePrivate,
            includeDocstrings: this.options.includeDocstrings,
            includeComments: this.options.includeComments,
            includeMetadata: true,
            compact: this.options.compact
        });

        // Original format for backward compatibility
        let output = "# Distilled Context\n\n";

        // Metadata
        output += `## Summary\n`;
        output += `- Files analyzed: ${result.structure.fileCount}\n`;
        output += `- Original tokens: ${result.metadata.originalTokens.toLocaleString()}\n`;
        output += `- Distilled tokens: ${result.metadata.distilledTokens.toLocaleString()}\n`;
        output += `- Compression ratio: ${(result.metadata.compressionRatio * 100).toFixed(1)}%\n\n`;

        // Languages breakdown
        output += `## Languages\n`;
        for (const [lang, count] of Object.entries(
            result.structure.languages,
        )) {
            output += `- ${lang}: ${count} files\n`;
        }
        output += "\n";

        // APIs by file
        output += `## Extracted APIs\n\n`;
        for (const api of result.apis) {
            output += `### ${api.file}\n\n`;
            for (const exp of api.exports) {
                if (exp.docstring) {
                    output += `\`\`\`\n${exp.docstring}\n\`\`\`\n`;
                }
                output += `\`\`\`${this.getLanguageForFile(api.file)}\n${exp.signature}\n\`\`\`\n\n`;
            }
        }

        return output;
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    private getLanguageForFile(filePath: string): string {
        const language = Parser.detectLanguage(filePath);
        return language || "text";
    }
}
