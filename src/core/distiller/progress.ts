import chalk from "chalk";
import ora from "ora";

export class DistillerProgress {
    private totalFiles = 0;
    private processedFiles = 0;
    private originalSize = 0;
    private distilledSize = 0;
    private startTime = Date.now();
    private spinner: any;
    public isSpinning = false;

    constructor() {
        this.spinner = ora({
            spinner: "dots",
            color: "cyan",
            stream: process.stderr, // Use stderr to avoid mixing with stdout
        });
    }

    start(totalFiles: number): void {
        this.totalFiles = totalFiles;
        this.processedFiles = 0;
        this.originalSize = 0;
        this.distilledSize = 0;
        this.startTime = Date.now();
        this.isSpinning = true;

        // Only show progress if we're in an interactive terminal
        if (process.stderr.isTTY) {
            this.updateProgress();
        }
    }

    update(
        filesProcessed: number,
        cumulativeOriginalBytes: number,
        cumulativeDistilledBytes: number,
    ): void {
        this.processedFiles = filesProcessed;
        this.originalSize = cumulativeOriginalBytes;
        this.distilledSize = cumulativeDistilledBytes;

        // Only update if in TTY
        if (process.stderr.isTTY) {
            this.updateProgress();
        }
    }

    private updateProgress(): void {
        const percentage =
            this.totalFiles > 0
                ? Math.round((this.processedFiles / this.totalFiles) * 100)
                : 0;

        const progressBar = this.createProgressBar(percentage);
        const originalKB = Math.round(this.originalSize / 1024);
        const distilledKB = Math.round(this.distilledSize / 1024);
        const elapsedMs = Date.now() - this.startTime;

        // Calculate dynamic token estimates
        const estimatedOriginalTokens = Math.round(this.originalSize / 4);
        const estimatedDistilledTokens = Math.round(this.distilledSize / 4);
        const tokensSaved = estimatedOriginalTokens - estimatedDistilledTokens;

        const text =
            chalk.cyan("Distilling ") +
            chalk.white(`${this.processedFiles}/${this.totalFiles} files `) +
            progressBar +
            " " +
            chalk.gray(`${percentage}% `) +
            chalk.gray(`(${originalKB} kB → ${distilledKB} kB) `) +
            chalk.gray(`~${Math.round(tokensSaved / 1000)}k tokens saved`);

        this.spinner.text = text;

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

    complete(result: {
        originalTokens: number;
        distilledTokens: number;
        fileCount: number;
    }): void {
        // Stop the spinner if running
        if (this.spinner.isSpinning) {
            this.spinner.stop();
        }
        this.isSpinning = false;

        const elapsedMs = Date.now() - this.startTime;
        const originalKB = Math.round((result.originalTokens * 4) / 1024); // Convert tokens to KB
        const distilledKB = Math.round((result.distilledTokens * 4) / 1024);
        const compressionRatio =
            result.originalTokens > 0
                ? Math.round(
                      (1 - result.distilledTokens / result.originalTokens) *
                          100,
                  )
                : 0;

        // Final success message - always show this
        const tokenStr = result.distilledTokens >= 1000
            ? `${(result.distilledTokens / 1000).toFixed(1)}k`
            : `${result.distilledTokens}`;
        
        console.log(
            chalk.cyan("✨ Distilled ") +
                chalk.white(`${result.fileCount} files `) +
                chalk.cyan("→ ") +
                chalk.yellow(`${tokenStr} tokens `) +
                chalk.gray(`(${compressionRatio}% reduction) `) +
                chalk.gray(`in ${elapsedMs}ms`),
        );
    }

    fail(error: string): void {
        this.spinner.fail(chalk.red(`Distillation failed: ${error}`));
        this.isSpinning = false;
    }
}
