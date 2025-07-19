import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { AIAnalysisResult, AnalysisOptions } from '../types/ai-context';

/**
 * Cache entry for AI analysis results
 */
export interface AICacheEntry {
    key: string;
    result: AIAnalysisResult;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
    metadata: {
        provider: string;
        model: string;
        promptHash: string;
        fileCount: number;
        codebaseHash: string;
    };
}

/**
 * Cache configuration options
 */
export interface AICacheConfig {
    enabled: boolean;
    maxEntries: number;
    defaultTtl: number; // Default TTL in milliseconds
    cacheDir: string;
    cleanupInterval: number; // Cleanup interval in milliseconds
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: AICacheConfig = {
    enabled: true,
    maxEntries: 100,
    defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
    cacheDir: '.dex/cache/ai',
    cleanupInterval: 60 * 60 * 1000, // 1 hour
};

/**
 * AI response cache manager
 */
export class AICache {
    private config: AICacheConfig;
    private memoryCache: Map<string, AICacheEntry> = new Map();
    private cleanupTimer?: NodeJS.Timeout;

    constructor(config: Partial<AICacheConfig> = {}) {
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config };

        if (this.config.enabled) {
            this.startCleanupTimer();
        }
    }

    /**
     * Generate a cache key for analysis options
     */
    private generateCacheKey(options: AnalysisOptions, codebaseHash: string): string {
        const keyData = {
            prompt: options.prompt,
            codebasePath: options.codebasePath,
            maxFiles: options.maxFiles,
            excludePatterns: options.excludePatterns?.sort(),
            includePatterns: options.includePatterns?.sort(),
            aiProvider: options.aiProvider,
            aiModel: options.aiModel,
            codebaseHash
        };

        const keyString = JSON.stringify(keyData);
        return crypto.createHash('sha256').update(keyString).digest('hex');
    }

    /**
     * Generate a hash for the codebase state
     */
    private async generateCodebaseHash(codebasePath: string, files: string[]): Promise<string> {
        try {
            // Sort files for consistent hashing
            const sortedFiles = [...files].sort();

            // Create a hash based on file paths and modification times
            const hashData: Array<{ path: string; mtime: number; size: number }> = [];

            for (const file of sortedFiles.slice(0, 50)) { // Limit to first 50 files for performance
                try {
                    const fullPath = path.resolve(codebasePath, file);
                    const stats = await fs.stat(fullPath);
                    hashData.push({
                        path: file,
                        mtime: stats.mtime.getTime(),
                        size: stats.size
                    });
                } catch (error) {
                    // Skip files that can't be accessed
                }
            }

            const hashString = JSON.stringify(hashData);
            return crypto.createHash('sha256').update(hashString).digest('hex');
        } catch (error) {
            // Fallback to timestamp-based hash
            return crypto.createHash('sha256').update(Date.now().toString()).digest('hex');
        }
    }

    /**
     * Get cached analysis result
     */
    async get(options: AnalysisOptions, files: string[]): Promise<AIAnalysisResult | null> {
        if (!this.config.enabled) {
            return null;
        }

        try {
            const codebaseHash = await this.generateCodebaseHash(options.codebasePath, files);
            const cacheKey = this.generateCacheKey(options, codebaseHash);

            // Check memory cache first
            let entry = this.memoryCache.get(cacheKey);

            // If not in memory, try disk cache
            if (!entry) {
                const diskEntry = await this.loadFromDisk(cacheKey);
                if (diskEntry) {
                    entry = diskEntry;
                    this.memoryCache.set(cacheKey, entry);
                }
            }

            if (!entry) {
                return null;
            }

            // Check if entry has expired
            if (Date.now() > entry.timestamp + entry.ttl) {
                await this.delete(cacheKey);
                return null;
            }

            // Validate that the codebase hasn't changed significantly
            if (entry.metadata.codebaseHash !== codebaseHash) {
                await this.delete(cacheKey);
                return null;
            }

            console.log(`Cache hit for AI analysis (key: ${cacheKey.slice(0, 8)}...)`);
            return entry.result;
        } catch (error) {
            console.warn(`Cache get error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }

    /**
     * Store analysis result in cache
     */
    async set(options: AnalysisOptions, files: string[], result: AIAnalysisResult, ttl?: number): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            const codebaseHash = await this.generateCodebaseHash(options.codebasePath, files);
            const cacheKey = this.generateCacheKey(options, codebaseHash);
            const promptHash = crypto.createHash('sha256').update(options.prompt).digest('hex');

            const entry: AICacheEntry = {
                key: cacheKey,
                result,
                timestamp: Date.now(),
                ttl: ttl || this.config.defaultTtl,
                metadata: {
                    provider: options.aiProvider || 'unknown',
                    model: options.aiModel || 'unknown',
                    promptHash,
                    fileCount: files.length,
                    codebaseHash
                }
            };

            // Store in memory cache
            this.memoryCache.set(cacheKey, entry);

            // Store on disk
            await this.saveToDisk(entry);

            // Enforce cache size limits
            await this.enforceCacheLimits();

            console.log(`Cached AI analysis result (key: ${cacheKey.slice(0, 8)}...)`);
        } catch (error) {
            console.warn(`Cache set error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete a cache entry
     */
    async delete(cacheKey: string): Promise<void> {
        try {
            // Remove from memory cache
            this.memoryCache.delete(cacheKey);

            // Remove from disk cache
            const filePath = this.getCacheFilePath(cacheKey);
            await fs.unlink(filePath).catch(() => { }); // Ignore errors if file doesn't exist
        } catch (error) {
            console.warn(`Cache delete error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        try {
            // Clear memory cache
            this.memoryCache.clear();

            // Clear disk cache
            const cacheDir = this.config.cacheDir;
            try {
                const files = await fs.readdir(cacheDir);
                await Promise.all(
                    files
                        .filter(file => file.endsWith('.json'))
                        .map(file => fs.unlink(path.join(cacheDir, file)).catch(() => { }))
                );
            } catch (error) {
                // Cache directory might not exist
            }

            console.log('AI cache cleared');
        } catch (error) {
            console.warn(`Cache clear error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{
        memoryEntries: number;
        diskEntries: number;
        totalSize: number;
        oldestEntry?: Date;
        newestEntry?: Date;
    }> {
        try {
            const memoryEntries = this.memoryCache.size;

            // Count disk entries
            let diskEntries = 0;
            let totalSize = 0;
            let oldestTimestamp = Infinity;
            let newestTimestamp = 0;

            try {
                const cacheDir = this.config.cacheDir;
                const files = await fs.readdir(cacheDir);

                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(cacheDir, file);
                        const stats = await fs.stat(filePath);
                        diskEntries++;
                        totalSize += stats.size;

                        // Try to read the entry to get timestamp
                        try {
                            const entry = await this.loadFromDisk(file.replace('.json', ''));
                            if (entry) {
                                oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
                                newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
                            }
                        } catch (error) {
                            // Skip invalid entries
                        }
                    }
                }
            } catch (error) {
                // Cache directory might not exist
            }

            return {
                memoryEntries,
                diskEntries,
                totalSize,
                oldestEntry: oldestTimestamp !== Infinity ? new Date(oldestTimestamp) : undefined,
                newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
            };
        } catch (error) {
            return {
                memoryEntries: 0,
                diskEntries: 0,
                totalSize: 0
            };
        }
    }

    /**
     * Load cache entry from disk
     */
    private async loadFromDisk(cacheKey: string): Promise<AICacheEntry | null> {
        try {
            const filePath = this.getCacheFilePath(cacheKey);
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data) as AICacheEntry;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save cache entry to disk
     */
    private async saveToDisk(entry: AICacheEntry): Promise<void> {
        try {
            // Ensure cache directory exists
            await fs.mkdir(this.config.cacheDir, { recursive: true });

            const filePath = this.getCacheFilePath(entry.key);
            await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
        } catch (error) {
            console.warn(`Failed to save cache entry to disk: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get the file path for a cache key
     */
    private getCacheFilePath(cacheKey: string): string {
        return path.join(this.config.cacheDir, `${cacheKey}.json`);
    }

    /**
     * Enforce cache size limits
     */
    private async enforceCacheLimits(): Promise<void> {
        try {
            // Check memory cache size
            if (this.memoryCache.size > this.config.maxEntries) {
                // Remove oldest entries from memory cache
                const entries = Array.from(this.memoryCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

                const entriesToRemove = entries.slice(0, entries.length - this.config.maxEntries);
                for (const [key] of entriesToRemove) {
                    this.memoryCache.delete(key);
                }
            }

            // Check disk cache size
            try {
                const cacheDir = this.config.cacheDir;
                const files = await fs.readdir(cacheDir);
                const cacheFiles = files.filter(file => file.endsWith('.json'));

                if (cacheFiles.length > this.config.maxEntries) {
                    // Load all entries to sort by timestamp
                    const entries: Array<{ file: string; timestamp: number }> = [];

                    for (const file of cacheFiles) {
                        try {
                            const entry = await this.loadFromDisk(file.replace('.json', ''));
                            if (entry) {
                                entries.push({ file, timestamp: entry.timestamp });
                            }
                        } catch (error) {
                            // Remove invalid entries
                            await fs.unlink(path.join(cacheDir, file)).catch(() => { });
                        }
                    }

                    // Sort by timestamp and remove oldest entries
                    entries.sort((a, b) => a.timestamp - b.timestamp);
                    const filesToRemove = entries.slice(0, entries.length - this.config.maxEntries);

                    for (const { file } of filesToRemove) {
                        await fs.unlink(path.join(cacheDir, file)).catch(() => { });
                    }
                }
            } catch (error) {
                // Cache directory might not exist
            }
        } catch (error) {
            console.warn(`Failed to enforce cache limits: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clean up expired cache entries
     */
    private async cleanupExpiredEntries(): Promise<void> {
        try {
            const now = Date.now();

            // Clean up memory cache
            for (const [key, entry] of this.memoryCache.entries()) {
                if (now > entry.timestamp + entry.ttl) {
                    this.memoryCache.delete(key);
                }
            }

            // Clean up disk cache
            try {
                const cacheDir = this.config.cacheDir;
                const files = await fs.readdir(cacheDir);

                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            const entry = await this.loadFromDisk(file.replace('.json', ''));
                            if (entry && now > entry.timestamp + entry.ttl) {
                                await fs.unlink(path.join(cacheDir, file)).catch(() => { });
                            }
                        } catch (error) {
                            // Remove invalid entries
                            await fs.unlink(path.join(cacheDir, file)).catch(() => { });
                        }
                    }
                }
            } catch (error) {
                // Cache directory might not exist
            }
        } catch (error) {
            console.warn(`Cache cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Start the cleanup timer
     */
    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredEntries();
        }, this.config.cleanupInterval);
    }

    /**
     * Stop the cleanup timer
     */
    private stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }

    /**
     * Dispose of the cache manager
     */
    dispose(): void {
        this.stopCleanupTimer();
        this.memoryCache.clear();
    }
}

/**
 * Global cache instance
 */
let globalCache: AICache | null = null;

/**
 * Get the global AI cache instance
 */
export function getAICache(config?: Partial<AICacheConfig>): AICache {
    if (!globalCache) {
        // Load AI configuration to get cache settings
        try {
            const { loadAIConfig } = require('./config');
            const aiConfig = loadAIConfig();

            const cacheConfig: Partial<AICacheConfig> = {
                enabled: aiConfig.performance?.enableCaching !== false,
                defaultTtl: (aiConfig.performance?.cacheTtl || 3600) * 1000, // Convert seconds to milliseconds
                ...config
            };

            globalCache = new AICache(cacheConfig);
        } catch (error) {
            // Fallback to default config if loading fails
            globalCache = new AICache(config);
        }
    }
    return globalCache;
}

/**
 * Reset the global cache instance
 */
export function resetAICache(): void {
    if (globalCache) {
        globalCache.dispose();
        globalCache = null;
    }
}