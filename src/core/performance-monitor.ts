/**
 * Performance monitoring for AI-assisted context generation
 */

export interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export interface PerformanceReport {
    totalDuration: number;
    phases: {
        scanning: number;
        prioritization: number;
        tokenEstimation: number;
        fileReading: number;
        caching: number;
        truncation?: number;
    };
    metrics: {
        filesScanned: number;
        filesProcessed: number;
        totalTokens: number;
        cacheHits: number;
        cacheMisses: number;
        parallelOperations: number;
    };
    bottlenecks: Array<{
        phase: string;
        duration: number;
        percentage: number;
        suggestions: string[];
    }>;
    recommendations: string[];
}

export interface PerformanceThresholds {
    scanningTime: number; // seconds
    prioritizationTime: number;
    tokenEstimationTime: number;
    totalTime: number;
    filesPerSecond: number;
    tokensPerSecond: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
    scanningTime: 10, // 10 seconds
    prioritizationTime: 30, // 30 seconds
    tokenEstimationTime: 5, // 5 seconds
    totalTime: 60, // 1 minute
    filesPerSecond: 10,
    tokensPerSecond: 5000,
};

/**
 * Performance monitor for tracking analysis performance
 */
export class PerformanceMonitor {
    private metrics: Map<string, PerformanceMetric> = new Map();
    private counters: Map<string, number> = new Map();
    private thresholds: PerformanceThresholds;
    private startTime: number;

    constructor(thresholds: Partial<PerformanceThresholds> = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        this.startTime = Date.now();
    }

    /**
     * Start timing a phase
     */
    startPhase(name: string, metadata?: Record<string, any>): void {
        const metric: PerformanceMetric = {
            name,
            startTime: Date.now(),
            metadata,
        };

        this.metrics.set(name, metric);
    }

    /**
     * End timing a phase
     */
    endPhase(name: string, metadata?: Record<string, any>): number {
        const metric = this.metrics.get(name);
        if (!metric) {
            console.warn(`Performance metric '${name}' not found`);
            return 0;
        }

        metric.endTime = Date.now();
        metric.duration = metric.endTime - metric.startTime;

        if (metadata) {
            metric.metadata = { ...metric.metadata, ...metadata };
        }

        return metric.duration;
    }

    /**
     * Increment a counter
     */
    incrementCounter(name: string, value: number = 1): void {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
    }

    /**
     * Set a counter value
     */
    setCounter(name: string, value: number): void {
        this.counters.set(name, value);
    }

    /**
     * Get a counter value
     */
    getCounter(name: string): number {
        return this.counters.get(name) || 0;
    }

    /**
     * Get phase duration
     */
    getPhaseDuration(name: string): number {
        const metric = this.metrics.get(name);
        return metric?.duration || 0;
    }

    /**
     * Generate performance report
     */
    generateReport(): PerformanceReport {
        const totalDuration = Date.now() - this.startTime;

        // Extract phase durations
        const phases = {
            scanning: this.getPhaseDuration("scanning"),
            prioritization: this.getPhaseDuration("prioritization"),
            tokenEstimation: this.getPhaseDuration("tokenEstimation"),
            fileReading: this.getPhaseDuration("fileReading"),
            caching: this.getPhaseDuration("caching"),
            truncation: this.getPhaseDuration("truncation"),
        };

        // Extract metrics
        const metrics = {
            filesScanned: this.getCounter("filesScanned"),
            filesProcessed: this.getCounter("filesProcessed"),
            totalTokens: this.getCounter("totalTokens"),
            cacheHits: this.getCounter("cacheHits"),
            cacheMisses: this.getCounter("cacheMisses"),
            parallelOperations: this.getCounter("parallelOperations"),
        };

        // Identify bottlenecks
        const bottlenecks = this.identifyBottlenecks(phases, totalDuration);

        // Generate recommendations
        const recommendations = this.generateRecommendations(
            phases,
            metrics,
            totalDuration,
        );

        return {
            totalDuration,
            phases,
            metrics,
            bottlenecks,
            recommendations,
        };
    }

    /**
     * Identify performance bottlenecks
     */
    private identifyBottlenecks(
        phases: PerformanceReport["phases"],
        totalDuration: number,
    ): PerformanceReport["bottlenecks"] {
        const bottlenecks: PerformanceReport["bottlenecks"] = [];

        // Check each phase against thresholds
        const phaseChecks = [
            {
                name: "scanning",
                duration: phases.scanning,
                threshold: this.thresholds.scanningTime * 1000,
            },
            {
                name: "prioritization",
                duration: phases.prioritization,
                threshold: this.thresholds.prioritizationTime * 1000,
            },
            {
                name: "tokenEstimation",
                duration: phases.tokenEstimation,
                threshold: this.thresholds.tokenEstimationTime * 1000,
            },
            {
                name: "fileReading",
                duration: phases.fileReading,
                threshold: 10000,
            }, // 10 seconds
            { name: "caching", duration: phases.caching, threshold: 2000 }, // 2 seconds
        ];

        for (const check of phaseChecks) {
            if (check.duration > check.threshold) {
                const percentage = (check.duration / totalDuration) * 100;
                const suggestions = this.getBottleneckSuggestions(
                    check.name,
                    check.duration,
                );

                bottlenecks.push({
                    phase: check.name,
                    duration: check.duration,
                    percentage,
                    suggestions,
                });
            }
        }

        // Sort by duration (worst first)
        bottlenecks.sort((a, b) => b.duration - a.duration);

        return bottlenecks;
    }

    /**
     * Get suggestions for specific bottlenecks
     */
    private getBottleneckSuggestions(
        phase: string,
        duration: number,
    ): string[] {
        const suggestions: string[] = [];

        switch (phase) {
            case "scanning":
                suggestions.push(
                    "Consider using more restrictive exclude patterns",
                );
                suggestions.push("Reduce maxFiles limit for faster scanning");
                suggestions.push(
                    "Use includePatterns to focus on specific file types",
                );
                if (duration > 20000) {
                    suggestions.push(
                        "Repository is very large - consider analyzing specific directories",
                    );
                }
                break;

            case "prioritization":
                suggestions.push(
                    "AI provider response is slow - consider switching providers",
                );
                suggestions.push(
                    "Use more specific prompts to reduce analysis complexity",
                );
                suggestions.push(
                    "Enable caching to avoid re-analyzing similar prompts",
                );
                if (duration > 60000) {
                    suggestions.push(
                        "Consider reducing the number of files sent for prioritization",
                    );
                }
                break;

            case "tokenEstimation":
                suggestions.push(
                    "Token estimation is slow - consider optimizing file reading",
                );
                suggestions.push(
                    "Enable parallel processing for token estimation",
                );
                break;

            case "fileReading":
                suggestions.push(
                    "File I/O is slow - consider using SSD storage",
                );
                suggestions.push("Enable parallel file reading");
                suggestions.push(
                    "Consider file size limits to skip very large files",
                );
                break;

            case "caching":
                suggestions.push(
                    "Cache operations are slow - consider reducing cache size",
                );
                suggestions.push("Check disk space and I/O performance");
                break;
        }

        return suggestions;
    }

    /**
     * Generate performance recommendations
     */
    private generateRecommendations(
        phases: PerformanceReport["phases"],
        metrics: PerformanceReport["metrics"],
        totalDuration: number,
    ): string[] {
        const recommendations: string[] = [];

        // Overall performance
        if (totalDuration > this.thresholds.totalTime * 1000) {
            recommendations.push(
                "Analysis took longer than expected - consider optimizations",
            );
        }

        // Files per second
        const filesPerSecond = metrics.filesProcessed / (totalDuration / 1000);
        if (filesPerSecond < this.thresholds.filesPerSecond) {
            recommendations.push(
                `File processing rate is low (${filesPerSecond.toFixed(1)}/sec) - enable parallel processing`,
            );
        }

        // Tokens per second
        const tokensPerSecond = metrics.totalTokens / (totalDuration / 1000);
        if (tokensPerSecond < this.thresholds.tokensPerSecond) {
            recommendations.push(
                `Token processing rate is low (${tokensPerSecond.toFixed(0)}/sec) - optimize token estimation`,
            );
        }

        // Cache efficiency
        const totalCacheOperations = metrics.cacheHits + metrics.cacheMisses;
        if (totalCacheOperations > 0) {
            const cacheHitRate = metrics.cacheHits / totalCacheOperations;
            if (cacheHitRate < 0.3) {
                recommendations.push(
                    `Low cache hit rate (${(cacheHitRate * 100).toFixed(1)}%) - consider adjusting cache TTL`,
                );
            } else if (cacheHitRate > 0.8) {
                recommendations.push(
                    `High cache hit rate (${(cacheHitRate * 100).toFixed(1)}%) - good cache performance`,
                );
            }
        }

        // Parallel processing
        if (metrics.parallelOperations === 0) {
            recommendations.push(
                "No parallel operations detected - enable parallel processing for better performance",
            );
        }

        // Repository size recommendations
        if (metrics.filesScanned > 1000) {
            recommendations.push(
                "Large repository detected - consider using chunked analysis",
            );
            recommendations.push("Use more specific prompts to reduce scope");
        }

        return recommendations;
    }

    /**
     * Format performance report as string
     */
    formatReport(report: PerformanceReport): string {
        const lines: string[] = [];

        lines.push("=== Performance Report ===");
        lines.push(
            `Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`,
        );
        lines.push("");

        // Phase breakdown
        lines.push("Phase Breakdown:");
        Object.entries(report.phases).forEach(([phase, duration]) => {
            if (duration > 0) {
                const percentage = (duration / report.totalDuration) * 100;
                lines.push(
                    `  ${phase}: ${(duration / 1000).toFixed(2)}s (${percentage.toFixed(1)}%)`,
                );
            }
        });
        lines.push("");

        // Metrics
        lines.push("Metrics:");
        lines.push(`  Files Scanned: ${report.metrics.filesScanned}`);
        lines.push(`  Files Processed: ${report.metrics.filesProcessed}`);
        lines.push(
            `  Total Tokens: ${report.metrics.totalTokens.toLocaleString()}`,
        );
        lines.push(`  Cache Hits: ${report.metrics.cacheHits}`);
        lines.push(`  Cache Misses: ${report.metrics.cacheMisses}`);
        lines.push(
            `  Parallel Operations: ${report.metrics.parallelOperations}`,
        );
        lines.push("");

        // Bottlenecks
        if (report.bottlenecks.length > 0) {
            lines.push("Performance Bottlenecks:");
            report.bottlenecks.forEach((bottleneck) => {
                lines.push(
                    `  ${bottleneck.phase}: ${(bottleneck.duration / 1000).toFixed(2)}s (${bottleneck.percentage.toFixed(1)}%)`,
                );
                bottleneck.suggestions.forEach((suggestion) => {
                    lines.push(`    - ${suggestion}`);
                });
            });
            lines.push("");
        }

        // Recommendations
        if (report.recommendations.length > 0) {
            lines.push("Recommendations:");
            report.recommendations.forEach((rec) => {
                lines.push(`  - ${rec}`);
            });
        }

        return lines.join("\n");
    }

    /**
     * Log performance report to console
     */
    logReport(): void {
        const report = this.generateReport();
        console.log(this.formatReport(report));
    }

    /**
     * Get performance summary for display
     */
    getSummary(): {
        duration: string;
        filesPerSecond: string;
        tokensPerSecond: string;
        cacheHitRate: string;
        bottlenecks: number;
    } {
        const report = this.generateReport();
        const filesPerSecond =
            report.metrics.filesProcessed / (report.totalDuration / 1000);
        const tokensPerSecond =
            report.metrics.totalTokens / (report.totalDuration / 1000);
        const totalCacheOps =
            report.metrics.cacheHits + report.metrics.cacheMisses;
        const cacheHitRate =
            totalCacheOps > 0 ? report.metrics.cacheHits / totalCacheOps : 0;

        return {
            duration: `${(report.totalDuration / 1000).toFixed(2)}s`,
            filesPerSecond: filesPerSecond.toFixed(1),
            tokensPerSecond: tokensPerSecond.toFixed(0),
            cacheHitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
            bottlenecks: report.bottlenecks.length,
        };
    }

    /**
     * Reset all metrics
     */
    reset(): void {
        this.metrics.clear();
        this.counters.clear();
        this.startTime = Date.now();
    }
}

/**
 * Global performance monitor instance
 */
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get the global performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
    if (!globalMonitor) {
        globalMonitor = new PerformanceMonitor();
    }
    return globalMonitor;
}

/**
 * Reset the global performance monitor
 */
export function resetPerformanceMonitor(): void {
    globalMonitor = null;
}
