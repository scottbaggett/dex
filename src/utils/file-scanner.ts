import { readdir, stat, readFile } from "fs/promises";
import { join, relative, resolve, basename } from "path";
import { existsSync } from "fs";
import { getCombineExcludes } from "./default-excludes.js";

export interface FileInfo {
    path: string;
    relativePath: string;
    size: number;
    lastModified: Date;
    isDirectory: boolean;
}

export interface ScanOptions {
    include?: string[];
    exclude?: string[];
    maxDepth?: number;
    respectGitignore?: boolean;
    maxFiles?: number;
    followSymlinks?: boolean;
}

export class FileScanner {
    private gitignorePatterns: string[] = [];
    private defaultIgnorePatterns = getCombineExcludes();

    async scan(
        rootPath: string,
        options: ScanOptions = {},
    ): Promise<FileInfo[]> {
        const {
            include = [],
            exclude = [],
            maxDepth = 10,
            respectGitignore = true,
            maxFiles = 1000,
            followSymlinks = false,
        } = options;

        const resolvedRoot = resolve(rootPath);

        // Load gitignore patterns if requested
        if (respectGitignore) {
            await this.loadGitignorePatterns(resolvedRoot);
        }

        const allFiles: FileInfo[] = [];
        const visited = new Set<string>();

        await this.scanDirectory(
            resolvedRoot,
            resolvedRoot,
            allFiles,
            visited,
            0,
            maxDepth,
            include,
            exclude,
            followSymlinks,
            maxFiles,
        );

        return allFiles;
    }

    private async scanDirectory(
        dirPath: string,
        rootPath: string,
        files: FileInfo[],
        visited: Set<string>,
        currentDepth: number,
        maxDepth: number,
        include: string[],
        exclude: string[],
        followSymlinks: boolean,
        maxFiles: number,
    ): Promise<void> {
        if (currentDepth > maxDepth || files.length >= maxFiles) {
            return;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) {
                    break;
                }

                const fullPath = join(dirPath, entry.name);
                const relativePath = relative(rootPath, fullPath);

                // Skip if already visited (handles circular symlinks)
                if (visited.has(fullPath)) {
                    continue;
                }

                // Handle symlinks
                if (entry.isSymbolicLink()) {
                    if (!followSymlinks) {
                        continue;
                    }
                    visited.add(fullPath);
                }

                // Check if path should be ignored
                if (this.shouldIgnore(relativePath)) {
                    continue;
                }

                // Check exclude patterns
                if (
                    exclude.length > 0 &&
                    this.matchesPatterns(relativePath, exclude)
                ) {
                    continue;
                }

                const stats = await stat(fullPath);

                if (entry.isDirectory()) {
                    // Recursively scan subdirectory
                    await this.scanDirectory(
                        fullPath,
                        rootPath,
                        files,
                        visited,
                        currentDepth + 1,
                        maxDepth,
                        include,
                        exclude,
                        followSymlinks,
                        maxFiles,
                    );
                } else if (entry.isFile()) {
                    // Check include patterns (if specified)
                    if (
                        include.length > 0 &&
                        !this.matchesPatterns(relativePath, include)
                    ) {
                        continue;
                    }

                    // Only include text files (skip binary files)
                    if (await this.isTextFile(fullPath)) {
                        files.push({
                            path: fullPath,
                            relativePath,
                            size: stats.size,
                            lastModified: stats.mtime,
                            isDirectory: false,
                        });
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read (permission errors, etc.)
            console.warn(
                `Warning: Could not read directory ${dirPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    private async loadGitignorePatterns(rootPath: string): Promise<void> {
        this.gitignorePatterns = [];

        // Look for .gitignore files up the directory tree
        let currentDir = rootPath;
        const root = resolve("/");

        while (currentDir !== root) {
            const gitignorePath = join(currentDir, ".gitignore");

            if (existsSync(gitignorePath)) {
                try {
                    const content = await readFile(gitignorePath, "utf-8");
                    const patterns = content
                        .split("\n")
                        .map((line) => line.trim())
                        .filter((line) => line && !line.startsWith("#"))
                        .map((line) => {
                            // Convert gitignore patterns to glob patterns
                            if (line.endsWith("/")) {
                                return line + "**";
                            }
                            return line;
                        });

                    this.gitignorePatterns.push(...patterns);
                } catch (error) {
                    console.error(error);
                }
            }

            const parentDir = resolve(currentDir, "..");
            if (parentDir === currentDir) break;
            currentDir = parentDir;
        }
    }

    private shouldIgnore(relativePath: string): boolean {
        const allIgnorePatterns = [
            ...this.defaultIgnorePatterns,
            ...this.gitignorePatterns,
        ];
        return this.matchesPatterns(relativePath, allIgnorePatterns);
    }

    private matchesPatterns(filePath: string, patterns: string[]): boolean {
        return patterns.some((pattern) => {
            // Simple glob matching
            if (pattern.includes("*")) {
                const regex = new RegExp(
                    "^" +
                        pattern
                            .replace(/\./g, "\\.")
                            .replace(/\*\*/g, ".*")
                            .replace(/\*/g, "[^/]*") +
                        "$",
                );

                // Test against full path and just filename
                return regex.test(filePath) || regex.test(basename(filePath));
            }

            // Exact match or directory match
            return (
                filePath === pattern ||
                filePath.startsWith(pattern + "/") ||
                basename(filePath) === pattern
            );
        });
    }

    private async isTextFile(filePath: string): Promise<boolean> {
        try {
            // Check file extension first
            const ext = filePath.split(".").pop()?.toLowerCase();
            const textExtensions = [
                "txt",
                "md",
                "markdown",
                "rst",
                "asciidoc",
                "js",
                "jsx",
                "ts",
                "tsx",
                "vue",
                "svelte",
                "py",
                "rb",
                "php",
                "java",
                "c",
                "cpp",
                "cc",
                "cxx",
                "h",
                "hpp",
                "cs",
                "go",
                "rs",
                "swift",
                "kt",
                "scala",
                "clj",
                "cljs",
                "html",
                "htm",
                "xml",
                "svg",
                "css",
                "scss",
                "sass",
                "less",
                "json",
                "yaml",
                "yml",
                "toml",
                "ini",
                "cfg",
                "conf",
                "sql",
                "sh",
                "bash",
                "zsh",
                "fish",
                "ps1",
                "psm1",
                "psd1",
                "dockerfile",
                "makefile",
                "cmake",
                "gradle",
                "r",
                "R",
                "m",
                "mm",
                "pl",
                "pm",
                "lua",
                "vim",
                "el",
            ];

            if (ext && textExtensions.includes(ext)) {
                return true;
            }

            // For files without extensions or unknown extensions, check content
            const buffer = await readFile(filePath);
            const sample = buffer.subarray(0, 1024); // Check first 1KB

            // Check for null bytes (common in binary files)
            for (let i = 0; i < sample.length; i++) {
                if (sample[i] === 0) {
                    return false;
                }
            }

            // Check if most characters are printable ASCII or common UTF-8
            let printableCount = 0;
            for (let i = 0; i < sample.length; i++) {
                const byte = sample[i];
                if (
                    byte !== undefined &&
                    ((byte >= 32 && byte <= 126) ||
                        byte === 9 ||
                        byte === 10 ||
                        byte === 13)
                ) {
                    printableCount++;
                }
            }

            return printableCount / sample.length > 0.7; // 70% printable characters
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    /**
     * Scan files in parallel for better performance
     */
    async scanParallel(
        rootPath: string,
        options: ScanOptions = {},
    ): Promise<FileInfo[]> {
        const {
            include = [],
            exclude = [],
            maxDepth = 10,
            respectGitignore = true,
            maxFiles = 1000,
            followSymlinks = false,
        } = options;

        const resolvedRoot = resolve(rootPath);

        // Load gitignore patterns if requested
        if (respectGitignore) {
            await this.loadGitignorePatterns(resolvedRoot);
        }

        // First, collect all potential files
        const allPaths: string[] = [];
        await this.collectPaths(
            resolvedRoot,
            resolvedRoot,
            allPaths,
            0,
            maxDepth,
            exclude,
            followSymlinks,
            maxFiles,
        );

        // Process files in parallel batches
        const maxConcurrency = 10;
        const fileInfos: FileInfo[] = [];

        const processPath = async (
            fullPath: string,
        ): Promise<FileInfo | null> => {
            try {
                const relativePath = relative(resolvedRoot, fullPath);
                const stats = await stat(fullPath);

                if (stats.isFile()) {
                    // Check include patterns (if specified)
                    if (
                        include.length > 0 &&
                        !this.matchesPatterns(relativePath, include)
                    ) {
                        return null;
                    }

                    // Only include text files (skip binary files)
                    if (await this.isTextFile(fullPath)) {
                        return {
                            path: fullPath,
                            relativePath,
                            size: stats.size,
                            lastModified: stats.mtime,
                            isDirectory: false,
                        };
                    }
                }

                return null;
            } catch (error) {
                console.error(error);
                return null;
            }
        };

        // Process paths in parallel
        const results = await this.processInParallel(
            allPaths,
            processPath,
            maxConcurrency,
        );

        // Filter out null results
        for (const result of results) {
            if (result) {
                fileInfos.push(result);
            }
        }

        return fileInfos;
    }

    /**
     * Collect all file paths without processing them
     */
    private async collectPaths(
        dirPath: string,
        rootPath: string,
        paths: string[],
        currentDepth: number,
        maxDepth: number,
        exclude: string[],
        followSymlinks: boolean,
        maxFiles: number,
    ): Promise<void> {
        if (currentDepth > maxDepth || paths.length >= maxFiles) {
            return;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (paths.length >= maxFiles) {
                    break;
                }

                const fullPath = join(dirPath, entry.name);
                const relativePath = relative(rootPath, fullPath);

                // Handle symlinks
                if (entry.isSymbolicLink() && !followSymlinks) {
                    continue;
                }

                // Check if path should be ignored
                if (this.shouldIgnore(relativePath)) {
                    continue;
                }

                // Check exclude patterns
                if (
                    exclude.length > 0 &&
                    this.matchesPatterns(relativePath, exclude)
                ) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await this.collectPaths(
                        fullPath,
                        rootPath,
                        paths,
                        currentDepth + 1,
                        maxDepth,
                        exclude,
                        followSymlinks,
                        maxFiles,
                    );
                } else if (entry.isFile()) {
                    paths.push(fullPath);
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Process items in parallel with concurrency limit
     */
    private async processInParallel<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        maxConcurrency: number,
    ): Promise<R[]> {
        const results: R[] = [];
        const executing: Promise<void>[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Create a promise for this item
            const promise = processor(item as T).then((result) => {
                results[i] = result;
            });

            executing.push(promise);

            // If we've reached max concurrency, wait for one to complete
            if (executing.length >= maxConcurrency) {
                await Promise.race(executing);
                // Remove completed promises
                const stillExecuting = [];
                for (const p of executing) {
                    try {
                        await Promise.race([p, Promise.resolve()]);
                    } catch {
                        stillExecuting.push(p);
                    }
                }
                executing.length = 0;
                executing.push(...stillExecuting);
            }
        }

        await Promise.all(executing);

        return results;
    }
}

export function formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
