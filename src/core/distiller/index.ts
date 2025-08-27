import type {
    DistillerOptions,
    DistillationResult,
    CompressedFile,
    ExtractedAPI,
    ProjectStructure,
    DependencyMap,
} from "../../types.js";
import { getLanguageRegistry, ProcessingOptions } from "../languages/index.js";
import { getFormatterRegistry } from "../../commands/distill/formatters/index.js";
import { detectLanguage } from "../../utils/language-detection.js";
import { countTokens } from "../../utils/tokens.js";
import { promises as fs } from "fs";
import { join, dirname, basename } from "path";
import { globby } from "globby";
import { createHash } from "crypto";
import { ProgressBar } from "../../utils/progress.js";
import { getDistillExcludes } from "../../utils/default-excludes.js";

/**
 * Core distillation engine that extracts and compresses API signatures from source code.
 *
 * The Distiller processes source files to extract their public API surface, removing
 * implementation details while preserving type information and documentation.
 * It supports multiple programming languages through pluggable processors.
 */
export class Distiller {
    private registry = getLanguageRegistry();
    private formatters = getFormatterRegistry();
    private options: DistillerOptions;
    private progress?: ProgressBar;

    constructor(options: Partial<DistillerOptions> = {}) {
        this.options = {
            docstrings: true,
            comments: false,
            format: "txt",
            parallel: true,
            exclude: [],
            include: [],
            ...options,
        } as DistillerOptions;
    }

    /**
     * Distills a file or directory, extracting API signatures and type information.
     *
     * This is the main entry point for distillation. It discovers files based on
     * the target path and configured patterns, then processes them.
     *
     * @param targetPath - Path to a file or directory to distill
     * @param progress - Optional progress bar for tracking operation status
     * @returns A DistillationResult containing extracted APIs, structure, and metadata
     *
     * @example
     * ```typescript
     * const distiller = new Distiller({ format: 'json' });
     * const result = await distiller.distill('./src');
     * console.log(`Processed ${result.apis.length} files`);
     * ```
     */
    async distill(
        targetPath: string,
        progress?: ProgressBar,
    ): Promise<DistillationResult> {
        const filesToDistill = await this.getFilesToProcess(targetPath);
        const stats = await fs.stat(targetPath);
        const basePath = stats.isFile() ? dirname(targetPath) : targetPath;

        return this.distillSelectedFiles(filesToDistill, basePath, progress);
    }

    /**
     * Distills a pre-selected list of files.
     *
     * This method is used when files have already been selected (e.g., from
     * interactive mode or git staging). It skips the file discovery phase.
     *
     * @param selectedFiles - Array of relative file paths to process
     * @param basePath - Base directory path for resolving file paths
     * @param progress - Optional progress bar for tracking operation status
     * @returns A DistillationResult containing extracted APIs, structure, and metadata
     *
     * @example
     * ```typescript
     * const distiller = new Distiller({ private: true });
     * const files = ['utils/helper.ts', 'models/user.ts'];
     * const result = await distiller.distillSelectedFiles(files, './src');
     * ```
     */
    async distillSelectedFiles(
        selectedFiles: string[],
        basePath: string,
        progress?: ProgressBar,
    ): Promise<DistillationResult> {
        this.progress = progress;

        // Initialize language modules
        await this.registry.initializeAll();

        if (this.progress) {
            this.progress.start(selectedFiles.length);
        }

        // Distill the selected files
        const distillationResult = await this.distillFiles(
            selectedFiles,
            basePath,
        );

        return distillationResult;
    }

    /**
     * Reads a file and extracts its metadata.
     *
     * Despite the name "compressFile", this method doesn't actually compress.
     * It reads the file content and generates metadata like size, hash, and language.
     *
     * @param fullPath - Absolute path to the file
     * @param relativePath - Optional relative path for the result
     * @returns CompressedFile object with file content and metadata
     * @private
     */
    private async compressFile(
        fullPath: string,
        relativePath?: string,
    ): Promise<CompressedFile> {
        const content = await fs.readFile(fullPath, "utf-8");
        const stats = await fs.stat(fullPath);
        const hash = createHash("sha256")
            .update(content)
            .digest("hex")
            .substring(0, 8);
        const language = detectLanguage(fullPath) || undefined;

        return {
            path: relativePath || fullPath,
            size: stats.size,
            hash,
            content,
            language,
        };
    }

    /**
     * Core processing method that distills files into API signatures.
     *
     * This method orchestrates the actual distillation process:
     * 1. Loads file content (if needed)
     * 2. Detects language and selects appropriate processor
     * 3. Extracts API signatures using language-specific processors
     * 4. Calculates token metrics and compression ratios
     * 5. Updates progress bar throughout the process
     *
     * @param files - Array of file paths or CompressedFile objects to process
     * @param basePath - Base directory for resolving relative paths
     * @returns DistillationResult with extracted APIs, dependencies, and metrics
     * @private
     */
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

        // Process files
        const filesToProcess =
            typeof files[0] === "string"
                ? await Promise.all(
                      (files as string[]).map((f) =>
                          this.compressFile(join(basePath, f), f),
                      ),
                  )
                : (files as CompressedFile[]);

        let processedCount = 0;
        let cumulativeOriginalSize = 0;
        let cumulativeDistilledSize = 0;

        for (const file of filesToProcess) {
            const language = file.language || detectLanguage(file.path);
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
            const dir = file.path.split("/").slice(0, -1).join("/");
            if (dir) directoriesSet.add(dir);
            structure.fileCount++;
            structure.languages[language] =
                (structure.languages[language] || 0) + 1;

            // Calculate tokens
            originalTokens += countTokens(file.content);
            cumulativeOriginalSize += file.size;

            try {
                // Process with language registry
                const processingOptions: ProcessingOptions = {
                    comments: this.options.comments,
                    docstrings: this.options.docstrings,
                    public: this.options.public !== false, // Default true
                    private: this.options.private === true, // Default false
                    protected: this.options.protected !== false, // Default true
                    internal: this.options.internal !== false, // Default true
                    include: undefined, // Not used for name filtering at processor level
                    exclude: undefined, // Not used for name filtering at processor level
                };

                const result = await this.registry.processFile(
                    file.path,
                    file.content,
                    processingOptions,
                );

                // Convert to ExtractedAPI format
                const extracted: ExtractedAPI = {
                    file: file.path,
                    imports: result.imports.map((i: any) => i.source),
                    exports: result.exports.map((e: any) => ({
                        name: e.name,
                        type: this.mapExportKind(e.kind),
                        signature: e.signature,
                        visibility: e.visibility || "public",
                        location: {
                            startLine: e.line || 0,
                            endLine: e.line || 0,
                        },
                        members: e.members?.map((m: any) => ({
                            name: m.name,
                            signature: m.signature,
                            type:
                                m.kind === "constructor" ||
                                m.kind === "getter" ||
                                m.kind === "setter"
                                    ? "method"
                                    : (m.kind as "property" | "method"),
                        })),
                    })),
                };

                apis.push(extracted);

                // We'll calculate distilled tokens from the final formatted output
                // since different formatters produce different sizes
                cumulativeDistilledSize += file.content.length;

                // Extract dependencies (imports/exports)
                dependencies[file.path] = {
                    imports: result.imports.map((i: any) => i.source),
                    exports: result.exports.map((e: any) => e.name),
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

        // Calculate distilled tokens from the APIs
        let distilledTokens = 0;
        for (const api of apis) {
            // Estimate tokens from the API signatures
            for (const exp of api.exports) {
                distilledTokens += countTokens(exp.signature);
                if (exp.docstring) {
                    distilledTokens += countTokens(exp.docstring);
                }
                if (exp.members) {
                    for (const member of exp.members) {
                        distilledTokens += countTokens(member.signature);
                    }
                }
            }
        }

        const compressionRatio =
            originalTokens > 0
                ? Math.round(
                      ((originalTokens - distilledTokens) / originalTokens) *
                          100,
                  )
                : 0;

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
                compressionRatio,
            },
        };
    }

    /**
     * Discovers files to process based on include/exclude patterns.
     *
     * This method handles file discovery using glob patterns and respects
     * the default exclude patterns (binaries, images, etc.) unless overridden.
     * If the user includes test file patterns, test files won't be excluded.
     *
     * @param targetPath - Path to file or directory to scan
     * @returns Array of relative file paths to process
     *
     * @example
     * ```typescript
     * // Process all TypeScript files except tests
     * const distiller = new Distiller({ include: ['**∕*.ts'] });
     * const files = await distiller.getFilesToProcess('./src');
     *
     * // Include test files explicitly
     * const distiller2 = new Distiller({ include: ['**∕*.test.ts'] });
     * const testFiles = await distiller2.getFilesToProcess('./src');
     * ```
     */
    async getFilesToProcess(targetPath: string): Promise<string[]> {
        const stats = await fs.stat(targetPath);

        // For single files, return the relative path from parent directory
        // This ensures consistency with how directories return relative paths
        if (stats.isFile()) {
            return [basename(targetPath)];
        }

        // Get all files using globby
        const patterns =
            this.options.include && this.options.include.length > 0
                ? this.options.include
                : ["**/*"];

        // Get default excludes
        // If user explicitly includes test patterns, we should allow test files
        const includeTestFiles = this.options.include?.some(
            (p) =>
                p.includes(".test.") ||
                p.includes(".spec.") ||
                p.includes("**/test/**") ||
                p.includes("**/tests/**") ||
                p.includes("**/__tests__/**"),
        );

        const defaultExcludes = getDistillExcludes({ includeTestFiles });
        const ignore = [...defaultExcludes, ...(this.options.exclude || [])];

        const files = await globby(patterns, {
            cwd: targetPath,
            ignore,
            absolute: false,
            onlyFiles: true,
            dot: true,
        });

        if (process.env.DEBUG) {
            console.error("DEBUG: Include patterns:", patterns);
            console.error("DEBUG: Exclude patterns:", ignore);
            console.error("DEBUG: Found files:", files.length);
        }

        // Apply additional filters if needed
        if (this.options.since || this.options.staged) {
            // This would integrate with git to filter files
            // For now, return all files
        }

        // Return paths relative to the target directory
        return files.map((f: string) => f);
    }

    /**
     * Maps language-specific export kinds to standardized types.
     *
     * Different language processors may use different terminology for similar
     * constructs. This method normalizes them to a consistent set of types.
     *
     * @param kind - Language-specific kind string from a processor
     * @returns Normalized export kind
     * @private
     */
    private mapExportKind(
        kind: string,
    ): "function" | "class" | "interface" | "const" | "type" | "enum" {
        // Map language-specific kinds to ExtractedAPI types
        switch (kind) {
            case "function":
            case "class":
            case "interface":
            case "type":
            case "enum":
                return kind as any;
            case "const":
            case "let":
            case "var":
            case "namespace":
            case "module":
                return "const";
            default:
                return "const";
        }
    }

    /**
     * Formats the distillation result for output.
     *
     * Applies the configured formatter (txt, json, md, xml) to transform
     * the raw distillation result into a formatted string. The formatter
     * respects visibility options and documentation settings.
     *
     * @param result - The distillation result to format
     * @param originalPath - Optional original file path (unused but kept for compatibility)
     * @returns Formatted string representation of the distillation result
     *
     * @example
     * ```typescript
     * const distiller = new Distiller({ format: 'json', private: true });
     * const result = await distiller.distill('./src');
     * const json = distiller.formatResult(result);
     * console.log(JSON.parse(json));
     * ```
     */
    formatResult(result: DistillationResult, originalPath?: string): string {
        // Handle null/undefined result
        if (!result) {
            return "# Distillation Result\n\nNo content was distilled.";
        }

        // Use the appropriate formatter based on format option
        const format = this.options.format || "txt";
        let formatter = this.formatters.get(format);

        // Fall back to structured formatter for txt
        if (!formatter && format === "txt") {
            formatter = this.formatters.get("structured");
        }

        if (!formatter) {
            throw new Error(`Formatter '${format}' not found`);
        }

        return formatter.formatDistillation(result, {
            includeImports: true, // Always include imports for context
            includePrivate: this.options.private === true,
            includeDocstrings: this.options.docstrings !== false,
            includeComments: this.options.comments === true,
            includeMetadata: true,
        });
    }
}
