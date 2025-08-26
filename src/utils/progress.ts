import chalk from "chalk";
import ora from "ora";
import { 
    distillSuccess, 
    combineSuccess, 
    extractProgress,
    formatTokenCountShort 
} from "./messages.js";

export interface ProgressOptions {
    /** Text to show before progress details */
    label?: string;
    /** Whether to show token estimates */
    showTokens?: boolean;
    /** Whether to show file size info */
    showSize?: boolean;
    /** Whether to show elapsed time */
    showTime?: boolean;
    /** Custom unit label (e.g., "files", "items") */
    unit?: string;
}

export class ProgressBar {
    private totalItems = 0;
    private processedItems = 0;
    private originalSize = 0;
    private processedSize = 0;
    private startTime = Date.now();
    private spinner: any;
    public isSpinning = false;
    private options: ProgressOptions;

    constructor(options: ProgressOptions = {}) {
        this.options = {
            label: "Processing",
            showTokens: false,
            showSize: true,
            showTime: true,
            unit: "files",
            ...options,
        };

        this.spinner = ora({
            spinner: "dots",
            color: "cyan",
            stream: process.stderr, // Use stderr to avoid mixing with stdout
        });
    }

    /**
     * Start the progress bar
     */
    start(totalItems: number): void {
        this.totalItems = totalItems;
        this.processedItems = 0;
        this.originalSize = 0;
        this.processedSize = 0;
        this.startTime = Date.now();
        this.isSpinning = true;

        // Only show progress if we're in an interactive terminal
        if (process.stderr.isTTY) {
            this.updateProgress();
        }
    }

    /**
     * Update progress with new values
     */
    update(
        itemsProcessed: number,
        originalBytes?: number,
        processedBytes?: number,
    ): void {
        this.processedItems = itemsProcessed;
        if (originalBytes !== undefined) {
            this.originalSize = originalBytes;
        }
        if (processedBytes !== undefined) {
            this.processedSize = processedBytes;
        }

        // Only update if in TTY
        if (process.stderr.isTTY) {
            this.updateProgress();
        }
    }

    /**
     * Increment progress by one item
     */
    increment(originalBytes?: number, processedBytes?: number): void {
        this.update(this.processedItems + 1, originalBytes, processedBytes);
    }

    private updateProgress(): void {
        const percentage =
            this.totalItems > 0
                ? Math.round((this.processedItems / this.totalItems) * 100)
                : 0;

        const progressBar = this.createProgressBar(percentage);
        const parts: string[] = [];

        // Main label and progress
        parts.push(chalk.cyan(this.options.label + " "));
        parts.push(chalk.white(`${this.processedItems}/${this.totalItems} ${this.options.unit} `));
        parts.push(progressBar);
        parts.push(" " + chalk.gray(`${percentage}%`));

        // Size info
        if (this.options.showSize && this.originalSize > 0) {
            const originalKB = Math.round(this.originalSize / 1024);
            const processedKB = Math.round(this.processedSize / 1024);
            
            if (this.processedSize > 0 && this.processedSize !== this.originalSize) {
                parts.push(chalk.gray(` (${originalKB} kB → ${processedKB} kB)`));
            } else {
                parts.push(chalk.gray(` (${originalKB} kB)`));
            }
        }

        // Token estimates
        if (this.options.showTokens && this.originalSize > 0) {
            const estimatedOriginalTokens = Math.round(this.originalSize / 4);
            const estimatedProcessedTokens = Math.round(this.processedSize / 4);
            const tokensSaved = estimatedOriginalTokens - estimatedProcessedTokens;
            
            if (tokensSaved > 0) {
                parts.push(chalk.gray(` ~${Math.round(tokensSaved / 1000)}k tokens saved`));
            }
        }

        // Elapsed time
        if (this.options.showTime) {
            const elapsedMs = Date.now() - this.startTime;
            if (elapsedMs > 1000) {
                parts.push(chalk.gray(` ${Math.round(elapsedMs / 1000)}s`));
            }
        }

        this.spinner.text = parts.join("");

        if (!this.spinner.isSpinning) {
            this.spinner.start();
        }
    }

    private createProgressBar(percentage: number): string {
        const width = 12;
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;

        return (
            chalk.cyan("[") +
            "█".repeat(filled) +
            "░".repeat(empty) +
            chalk.cyan("]")
        );
    }

    /**
     * Complete the progress bar with success
     */
    complete(message?: string): void {
        // Stop the spinner if running
        if (this.spinner.isSpinning) {
            this.spinner.stop();
        }
        this.isSpinning = false;

        if (message) {
            console.log(message);
        }
    }

    /**
     * Complete for distill command with specific format
     */
    completeDistill(result: {
        originalTokens: number;
        distilledTokens: number;
        fileCount: number;
    }): void {
        this.complete();

        const elapsedMs = Date.now() - this.startTime;
        const compressionRatio =
            result.originalTokens > 0
                ? Math.round(
                      (1 - result.distilledTokens / result.originalTokens) *
                          100,
                  )
                : 0;

        const tokenStr = formatTokenCountShort(result.distilledTokens);
        
        console.log(
            distillSuccess(result.fileCount, tokenStr, compressionRatio, elapsedMs)
        );
    }

    /**
     * Complete for extract command with specific format
     */
    completeExtract(filesChanged: number, tokenCount: number): void {
        this.complete();

        const elapsedMs = Date.now() - this.startTime;
        const tokenStr = formatTokenCountShort(tokenCount) + " tokens";

        console.log(extractProgress(filesChanged, tokenStr, elapsedMs));
    }

    /**
     * Complete for combine command
     */
    completeCombine(fileCount: number, totalSize: number): void {
        this.complete();

        const elapsedMs = Date.now() - this.startTime;
        const sizeKB = Math.round(totalSize / 1024);
        
        console.log(combineSuccess(fileCount, sizeKB, elapsedMs));
    }

    /**
     * Fail with error message
     */
    fail(error: string): void {
        if (this.spinner.isSpinning) {
            this.spinner.fail(chalk.red(error));
        } else {
            console.error(chalk.red(error));
        }
        this.isSpinning = false;
    }

    /**
     * Stop without message
     */
    stop(): void {
        if (this.spinner.isSpinning) {
            this.spinner.stop();
        }
        this.isSpinning = false;
    }

    /**
     * Set custom text without progress bar
     */
    setText(text: string): void {
        this.spinner.text = text;
        if (!this.spinner.isSpinning && process.stderr.isTTY) {
            this.spinner.start();
        }
    }
}