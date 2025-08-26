import { Command } from "commander";
import chalk from "chalk";
import { Distiller } from "../../core/distiller/index.js";
import type { DistillerOptions, OutputFormat } from "../../types.js";
import { promises as fs, statSync } from "fs";
import { resolve, basename } from "path";
import * as path from "path";
import clipboardy from "clipboardy";
import { DistillerProgress } from "../../core/distiller/progress.js";
import { OutputManager } from "../../utils/output-manager.js";
import { FileSelector } from "../../utils/file-selector.js";
import { formatFileSize } from "../../utils/format.js";
import {
    countTokens,
    formatTokenCount,
    formatEstimatedTokens,
    calculateTokenSavings,
} from "../../utils/tokens.js";

/**
 *  Dex Distill
 */
export function createDistillCommand(): Command {
    const command = new Command("distill");

    command
        .description(
            "Distill entire codebases into token-efficient formats (defaults to saving in .dex/)",
        )
        .argument(
            "[path]",
            "Path to directory or file to distill (defaults to current directory)",
        )

        .option(
            "-f, --format <type>",
            "Output format (txt, markdown, json)",
            "txt",
        )

        .option("-o, --output <file>", "Write output to specific file")
        .option("-c, --clipboard", "Copy output to clipboard")
        .option("--stdout", "Print output to stdout")
        .option("-s, --select", "Interactively select files to distill")
        .option("--comments <value>", "Include comments (0 or 1)", "0")
        .option("--docstrings <value>", "Include docstrings (0 or 1)", "1")
        .option("--private <value>", "Include private members (0 or 1)", "0")
        .option(
            "--exclude <patterns...>",
            "Exclude file patterns",
            collectPatterns,
            [],
        )
        .option(
            "--include <patterns...>",
            "Include file patterns",
            collectPatterns,
            [],
        )
        .option("--no-parallel", "Disable parallel processing")
        .option(
            "--dry-run",
            "Show what files would be processed without running distillation",
        )
        // AI prompt features removed
        .option("--since <ref>", "Only process files changed since git ref")
        .option("--staged", "Only process staged files")
        .action((...args: any[]) => {
            // Handle optional path argument - if no path provided, args[0] will be the command object
            const targetPath = typeof args[0] === "string" ? args[0] : ".";
            const cmdObject = args[args.length - 1]; // Commander puts the command object last
            const localOptions = cmdObject.opts();
            const parentOptions = cmdObject.parent?.opts() || {};

            // Merge parent and local options
            const options = { ...parentOptions, ...localOptions };

            return distillCommand(targetPath, options);
        });

    return command;
}

async function distillCommand(targetPath: string, options: any): Promise<void> {
    // Determine if we should show progress
    const isStdout = options.stdout || (!options.clipboard && !options.output);

    // Use progress reporter only if not outputting to stdout
    const progress = new DistillerProgress();
    if (isStdout) {
        // Disable progress for stdout output
        progress.isSpinning = true; // Prevent it from starting
    }

    try {
        // Resolve path
        const resolvedPath = resolve(targetPath);

        // Check if path exists
        try {
            await fs.access(resolvedPath);
        } catch {
            console.error(chalk.red(`Path not found: ${targetPath}`));
            process.exit(1);
        }

        // Build distiller options
        const cliExcludes = options.exclude || [];

        const distillerOptions: DistillerOptions = {
            path: resolvedPath,
            exclude: cliExcludes,
            include: options.include || [],
            excludePatterns: cliExcludes,
            includeComments: options.comments === "1",
            includeDocstrings: options.docstrings !== "0",
            format: options.format || "txt",
            output: options.output,
            since: options.since,
            staged: options.staged,
            parallel: options.parallel !== false,
            includePrivate: options.private === "1",
            includePatterns: options.include || [],
            // AI prompt features removed
            dryRun: options.dryRun,
        };

        // Handle file selection if requested
        let filesToProcess: string[] | undefined;
        if (options.select) {
            // Check if interactive mode is possible
            if (!process.stdin.isTTY || !process.stdin.setRawMode) {
                console.error(
                    chalk.red("Interactive mode requires a TTY terminal"),
                );
                const fileSelector = new FileSelector();
                fileSelector.showTTYError();
                process.exit(1);
            }

            try {
                // Collect files first
                const fileSelector = new FileSelector();
                const { files: allFiles, errors } =
                    await fileSelector.collectFiles([resolvedPath], {
                        excludePatterns: cliExcludes,
                        maxFiles: 10000, // Higher limit for distill
                        maxDepth: 20,
                        respectGitignore: true,
                    });

                if (errors.length > 0) {
                    console.warn(chalk.yellow("Some paths had issues:"));
                    for (const error of errors) {
                        console.warn(chalk.yellow(`  ${error}`));
                    }
                }

                if (allFiles.length === 0) {
                    console.error(chalk.red("No valid files found"));
                    process.exit(1);
                }

                // Convert to GitChange objects for selection
                const fileChanges = fileSelector.filesToGitChanges(allFiles);
                const result = await fileSelector.selectFiles(fileChanges);

                // Convert back to file paths
                filesToProcess = result.files.map((change) =>
                    resolve(change.file),
                );

                // Override clipboard option if user pressed 'c'
                if (result.copyToClipboard) {
                    options.clipboard = true;
                }
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message === "File selection cancelled"
                ) {
                    console.log(chalk.yellow("\nFile selection cancelled."));
                    process.exit(0);
                }
                throw error;
            }
        }

        // Handle dry-run mode
        if (options.dryRun) {
            const distiller = new Distiller(distillerOptions);
            const filesToAnalyze =
                filesToProcess ||
                (await distiller.getFilesToProcess(resolvedPath));

            console.log(
                chalk.cyan(`\nDry run - Files that would be processed:\n`),
            );

            // Check if resolvedPath is a file or directory
            const targetIsFile = (await fs.stat(resolvedPath)).isFile();
            const baseDir = targetIsFile
                ? path.dirname(resolvedPath)
                : resolvedPath;

            for (const filePath of filesToAnalyze) {
                const fullPath = path.isAbsolute(filePath)
                    ? filePath
                    : path.join(baseDir, filePath);
                const stats = await fs.stat(fullPath);
                const relativePath = targetIsFile
                    ? path.basename(fullPath)
                    : path.relative(resolvedPath, fullPath);
                const fileSize = formatFileSize(stats.size);
                console.log(
                    chalk.green(`  ✓ ${relativePath}`) +
                        chalk.gray(` (${fileSize})`),
                );
            }

            const totalSize = filesToAnalyze.reduce((total, file) => {
                try {
                    const fullPath = path.isAbsolute(file)
                        ? file
                        : path.join(baseDir, file);
                    return total + statSync(fullPath).size;
                } catch {
                    return total;
                }
            }, 0);

            console.log(chalk.cyan(`\nSummary:`));
            console.log(`  Files: ${filesToAnalyze.length}`);
            console.log(`  Total size: ${formatFileSize(totalSize)}`);

            // Calculate original tokens from actual file content
            let totalOriginalTokens = 0;
            for (const file of filesToAnalyze) {
                try {
                    const fullPath = path.isAbsolute(file)
                        ? file
                        : path.join(baseDir, file);
                    const content = await fs.readFile(
                        fullPath,
                        "utf-8",
                    );
                    totalOriginalTokens += countTokens(content);
                } catch {
                    // Skip files that can't be read
                }
            }

            // For distilled tokens, we need to actually run distillation on a sample
            // or use a more accurate estimate based on file type
            // TypeScript/JavaScript files typically compress to ~8-10% of original
            // depending on comments, docstrings, and code complexity
            const estimatedDistilledTokens = Math.ceil(
                totalOriginalTokens * 0.09,
            );

            const savings = calculateTokenSavings(
                totalOriginalTokens,
                estimatedDistilledTokens,
            );

            console.log(
                `  Original tokens: ${formatTokenCount(totalOriginalTokens)}`,
            );
            console.log(
                `  Estimated tokens: ${formatEstimatedTokens(estimatedDistilledTokens)}`,
            );
            console.log(`  Estimated savings: ~${savings.formatted}`);

            console.log(
                chalk.dim(`\nRun without --dry-run to process these files.`),
            );
            return;
        }

        // Create distiller instance
        const distiller = new Distiller(distillerOptions);

        // Run distillation with progress (unless outputting to stdout)
        // If we have selected files, we need to modify the distiller to use them
        if (process.env.DEBUG) {
            console.log("Starting distillation with options:", {
                format: distillerOptions.format,
                filesToProcess: filesToProcess
                    ? filesToProcess.length
                    : "all files",
            });
        }

        const result = filesToProcess
            ? await distiller.distillSelectedFiles(
                  filesToProcess,
                  resolvedPath,
                  isStdout ? undefined : progress,
              )
            : await distiller.distill(
                  resolvedPath,
                  isStdout ? undefined : progress,
              );

        // Check if result is valid
        if (!result) {
            throw new Error("Distillation failed to produce a result");
        }

        // Format result
        const formatted = distiller.formatResult(result, resolvedPath);

        // No AI prompt injection
        const output = formatted;

        // Calculate actual tokens from the formatted output
        const actualDistilledTokens = countTokens(output);

        // Handle output based on explicit options first, then fall back to config
        if (options.clipboard) {
            await clipboardy.write(output);

            // Complete progress
            const originalTokens = result.metadata.originalTokens || 0;
            const fileCount = result.structure?.fileCount || 0;

            progress.complete({
                originalTokens,
                distilledTokens: actualDistilledTokens,
                fileCount,
            });

            console.log(chalk.cyan("📋 Distilled output copied to clipboard"));
        } else if (options.output) {
            await fs.writeFile(options.output, output, "utf-8");

            // Complete progress
            const originalTokens = result.metadata.originalTokens || 0;
            const fileCount = result.structure?.fileCount || 0;

            progress.complete({
                originalTokens,
                distilledTokens: actualDistilledTokens,
                fileCount,
            });

            console.log(
                chalk.cyan("💾 Distilled output written to: ") +
                    chalk.green(options.output),
            );
        } else if (isStdout) {
            // Print to stdout if explicitly requested
            console.log(output);
        } else {
            // Default: save using OutputManager
            const outputManager = new OutputManager();
            const folderName = basename(resolvedPath);

            // Use the format option directly - OutputManager handles the extension conversion
            const fileFormat = options.format || "txt"; // Default to .txt

            await outputManager.saveOutput(output, {
                command: "distill",
                context: folderName,
                format: fileFormat as OutputFormat,
            });

            const fullPath = await outputManager.getFilePath({
                command: "distill",
                context: folderName,
                format: fileFormat as OutputFormat,
            });

            // Complete progress with cool output
            const originalTokens = result.metadata.originalTokens || 0;
            const fileCount = result.structure?.fileCount || 0;

            progress.complete({
                originalTokens,
                distilledTokens: actualDistilledTokens,
                fileCount,
            });

            console.log(
                chalk.cyan("Distilled output saved to: ") +
                    chalk.green(fullPath),
            );
            console.log(chalk.dim(`\nFor agents: cat "${fullPath}"`));
        }
    } catch (error) {
        progress.fail(error instanceof Error ? error.message : String(error));
        if (process.env.DEBUG) {
            console.error(error);
        }
        process.exit(1);
    }
}

function collectPatterns(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}

// AI prompt features removed
