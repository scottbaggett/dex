import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import clipboardy from "clipboardy";
import { readFileSync, statSync } from "fs";
import { resolve, relative, join } from "path";
import { XmlFormatter } from "./formatters/xml.js";
import { MarkdownFormatter } from "./formatters/markdown.js";
import { JsonFormatter } from "./formatters/json.js";
import type { GitChange } from "../../types.js";
import { CombineOptionsSchema } from "../../schemas.js";
import { formatFileSize } from "../../utils/file-scanner.js";
import { FileSelector } from "../../utils/file-selector.js";
import { OutputManager } from "../../utils/output-manager.js";
import { GitExtractor } from "../../core/git.js";
import {
    countTokens,
    formatEstimatedTokens,
} from "../../utils/tokens.js";
import { z } from "zod";

function collectPatterns(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}

export function createCombineCommand(): Command {
    const combine = new Command("combine")
        .description(
            "Combine multiple files and directories into a single, LLM-friendly document",
        )
        .argument(
            "[paths...]",
            "Paths to files or directories to combine (defaults to current directory)",
        )
        .option(
            "-f, --format <type>",
            "Output format (xml, markdown, json)",
            "xml",
        )
        .option("-o, --output <file>", "Write output to specific file")
        .option("-c, --clipboard", "Copy output to clipboard")
        .option("--stdout", "Print output to stdout")
        .option("-s, --select", "Interactively select files to combine")
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
        .option("--no-metadata", "Exclude metadata from output")
        .option("--staged", "Only process staged files")
        .option("--since <ref>", "Only process files changed since git ref")
        .option(
            "--dry-run",
            "Show what files would be processed without running",
        )
        .option(
            "--max-files <number>",
            "Maximum number of files to process",
            "1000",
        )
        .option("--no-gitignore", "Do not respect .gitignore patterns")
        .action(async (...args: unknown[]) => {
            // Handle optional paths argument - if no paths provided, args[0] will be the command object
            const paths = Array.isArray(args[0]) ? args[0] as string[] : ["."];
            const cmdObject = args[args.length - 1] as Command; // Commander puts the command object last
            const localOptions = cmdObject.opts();
            const parentOptions = cmdObject.parent?.opts() || {};

            // Merge parent and local options
            const mergedOptions = { ...parentOptions, ...localOptions };
            const parsedOptions = CombineOptionsSchema.parse(mergedOptions);
            await combineCommand(paths, parsedOptions);
        });

    return combine;
}

async function combineCommand(inputPaths: string[], options: z.infer<typeof CombineOptionsSchema>) {
    const spinner = ora("Scanning files...").start();

    // Handle stdout option - don't show spinner if outputting to stdout
    const isStdout = options.stdout || (!options.output && !options.clipboard);
    if (isStdout) {
        spinner.stop();
    }

    try {
        let filePaths = inputPaths;

        // Handle --staged mode
        if (options.staged) {
            spinner.text = "Getting staged files...";

            const gitExtractor = new GitExtractor();
            const isGitRepo = await gitExtractor.isGitRepository();

            if (!isGitRepo) {
                spinner.fail(
                    chalk.red(
                        "Error: Not in a git repository (--staged requires git)",
                    ),
                );
                process.exit(1);
            }

            const hasStagedChanges = await gitExtractor.hasStagedChanges();
            if (!hasStagedChanges) {
                spinner.fail(chalk.red("No staged files found"));
                console.log(
                    chalk.gray(
                        'Tip: Use "git add <files>" to stage files first',
                    ),
                );
                process.exit(1);
            }

            // Get staged files
            const stagedChanges = await gitExtractor.getCurrentChanges(true);
            const gitRoot = await gitExtractor.getRepositoryRoot();

            // Convert staged changes to absolute file paths
            filePaths = stagedChanges
                .filter((change) => change.status !== "deleted") // Skip deleted files
                .map((change) => join(gitRoot, change.file));

            if (!isStdout) {
                spinner.text = chalk.gray(
                    `Found ${filePaths.length} staged files...`,
                );
            }
        }

        // Handle --select mode without file arguments
        if (options.select && filePaths.length === 0) {
            filePaths.push(process.cwd());
        }

        // Parse options - patterns are already arrays thanks to collectPatterns
        const includePatterns = options.include || [];
        const excludePatterns = options.exclude || [];
        const maxFiles = parseInt(String(options.maxFiles || "1000"), 10);
        const maxDepth = parseInt(String(options.maxDepth || "10"), 10);
        const respectGitignore = !options.noGitignore;

        // For staged mode, skip file collection and use the staged files directly
        let allFiles: string[];
        let errors: string[] = [];

        if (options.staged) {
            // Use staged files directly, no need for file collection
            allFiles = filePaths;

            // Validate that staged files exist and are readable
            const validFiles: string[] = [];
            for (const filePath of allFiles) {
                try {
                    statSync(filePath);
                    validFiles.push(filePath);
                } catch {
                    errors.push(
                        `Staged file not accessible: ${relative(process.cwd(), filePath)}`,
                    );
                }
            }
            allFiles = validFiles;
        } else {
            // Collect all files from inputs (files and directories) - existing logic
            const fileSelector = new FileSelector();
            const result = await fileSelector.collectFiles(filePaths, {
                includePatterns,
                excludePatterns,
                maxFiles,
                maxDepth,
                respectGitignore,
            });
            allFiles = result.files;
            errors = result.errors;
        }

        if (errors.length > 0) {
            spinner.warn(chalk.yellow("Some paths had issues:"));
            for (const error of errors) {
                console.warn(chalk.yellow(`  ${error}`));
            }
        }

        if (allFiles.length === 0) {
            spinner.fail(chalk.red("No valid files found"));
            process.exit(1);
        }

        // Safety check for too many files
        if (allFiles.length >= maxFiles) {
            spinner.warn(
                chalk.yellow(
                    `Found ${allFiles.length} files, limited to ${maxFiles}`,
                ),
            );
        }

        // Show file count and size info
        const totalSize = allFiles.reduce((sum, filePath) => {
            try {
                return sum + statSync(filePath).size;
            } catch {
                return sum;
            }
        }, 0);

        if (allFiles.length > 50 && !options.staged && !options.dryRun) {
            spinner.warn(
                chalk.yellow(
                    `Processing ${allFiles.length} files (${formatFileSize(totalSize)}). Consider using --select to choose specific files.`,
                ),
            );
        }

        // Handle dry-run mode
        if (options.dryRun) {
            spinner.stop();
            console.log(
                chalk.cyan(`\nDry run - Files that would be processed:\n`),
            );

            for (const filePath of allFiles) {
                const relativePath = relative(process.cwd(), filePath);
                const size = statSync(filePath).size;
                const fileSize = formatFileSize(size);
                console.log(
                    chalk.green(`  ✓ ${relativePath}`) +
                        chalk.gray(` (${fileSize})`),
                );
            }

            console.log(chalk.cyan(`\nSummary:`));
            console.log(`  Files: ${allFiles.length}`);
            console.log(`  Total size: ${formatFileSize(totalSize)}`);

            // Read a sample of files to get accurate token count
            let sampleTokens = 0;
            let sampleSize = 0;
            const maxSampleFiles = Math.min(5, allFiles.length);

            for (let i = 0; i < maxSampleFiles; i++) {
                try {
                    const content = readFileSync(allFiles[i] || "", "utf-8");
                    sampleTokens += countTokens(content);
                    sampleSize += content.length;
                } catch {
                    // Skip files that can't be read
                }
            }

            // Extrapolate from sample or use fallback
            const estimatedTokens =
                sampleSize > 0
                    ? Math.round((sampleTokens / sampleSize) * totalSize)
                    : Math.ceil(totalSize / 4);

            console.log(
                `  Estimated tokens: ${formatEstimatedTokens(estimatedTokens)}`,
            );

            console.log(
                chalk.dim(`\nRun without --dry-run to process these files.`),
            );
            return;
        }

        // Handle interactive selection if requested (skip for staged mode)
        let finalFiles = allFiles;

        if (options.select && !options.staged) {
            // Check if interactive mode is possible
            if (!process.stdin.isTTY || !process.stdin.setRawMode) {
                spinner.fail(
                    chalk.red("Interactive mode requires a TTY terminal"),
                );
                const fileSelector = new FileSelector();
                fileSelector.showTTYError();
                process.exit(1);
            }

            spinner.stop();

            try {
                // Convert file paths to GitChange objects for the selector
                const fileSelector = new FileSelector();
                const fileChanges = fileSelector.filesToGitChanges(allFiles);
                const result = await fileSelector.selectFiles(fileChanges);

                // Convert back to file paths
                finalFiles = result.files.map((change) => resolve(change.file));

                // Override clipboard option if user pressed 'c'
                if (result.copyToClipboard) {
                    options.clipboard = true;
                }

                spinner.start("Processing selected files...");
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

        // Read file contents
        const processingText = options.staged
            ? "Reading staged files..."
            : "Reading files...";
        if (!isStdout) {
            spinner.text = chalk.gray(
                `${processingText} (${finalFiles.length} files)`,
            );
        }

        const changes: GitChange[] = [];
        const fullFiles = new Map<string, string>();

        for (const filePath of finalFiles) {
            try {
                const content = readFileSync(filePath, "utf-8");
                const relativePath = relative(process.cwd(), filePath);

                // Create a GitChange-like object for each file with content
                const change: GitChange = {
                    file: relativePath,
                    status: options.staged ? "modified" : "added", // Use 'modified' for staged files
                    additions: content.split("\n").length,
                    deletions: 0,
                    diff: content, // Store content in diff field for compatibility
                    content,
                };

                changes.push(change);
                fullFiles.set(relativePath, content);
            } catch (error) {
                errors.push(
                    `Failed to read ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
                );
            }
        }

        if (errors.length > 0) {
            spinner.warn(chalk.yellow("Some files could not be read"));
            for (const error of errors) {
                console.warn(chalk.yellow(`  ${error}`));
            }
        }

        if (changes.length === 0) {
            spinner.fail(chalk.red("No files could be read"));
            process.exit(1);
        }

        // Context calculations removed - unused variables

        // Repository info removed - unused in current implementation

        // Format output
        const formatToUse = options.format || "xml";
        if (!isStdout) {
            spinner.text = chalk.gray(
                `Formatting as ${chalk.cyan(formatToUse)}...`,
            );
        }
        let output: string;

        switch (formatToUse) {
            case "xml":
                {
                const xmlFormatter = new XmlFormatter();
                output = xmlFormatter.format(changes);
                break;
            }
            case "json":
            {
                const jsonFormatter = new JsonFormatter();
                output = jsonFormatter.format(changes);
                break;
            }
            case "md":
            {
                const markdownFormatter = new MarkdownFormatter();
                output = markdownFormatter.format(changes);
                break;
            }
            default:
                throw new Error(`Invalid format: ${options.format}`);
        }

        // Handle output
        if (options.stdout) {
            console.log(output);
        } else if (options.output) {
            const { writeFileSync } = await import("fs");
            writeFileSync(options.output, output);
            const successMsg = options.staged
                ? `Combined staged files written to: ${options.output}`
                : `Combined files written to: ${options.output}`;
            spinner.succeed(chalk.green(successMsg));
        } else if (options.clipboard) {
            try {
                await clipboardy.write(output);

                // Show enhanced success message with metadata
                const tokenCount = countTokens(output);
                const tokenStr = tokenCount >= 1000
                    ? `${(tokenCount / 1000).toFixed(1)}k`
                    : `${tokenCount}`;

                spinner.succeed(
                    chalk.cyan("✨ Combined ") +
                        chalk.white(`${changes.length} files `) +
                        chalk.cyan("→ ") +
                        chalk.yellow(`${tokenStr} tokens `) +
                        chalk.gray("(copied to clipboard)"),
                );
            } catch (error) {
                spinner.fail(chalk.red("Failed to copy to clipboard"));
                console.error(
                    chalk.red(
                        `Clipboard error: ${error instanceof Error ? error.message : "Unknown error"}`,
                    ),
                );
                console.log(chalk.yellow("Falling back to terminal output:"));
                console.log(output);
            }
        } else {
            // Save to .dex/ directory using OutputManager
            const outputManager = new OutputManager();

            // Generate context string for filename
            let contextString: string;
            if (options.select) {
                contextString = "select";
            } else if (options.staged) {
                contextString = "staged-files";
            } else if (filePaths.length === 1) {
                // For single path, preserve the path structure
                contextString = filePaths[0] || "";
            } else {
                // For multiple paths, join them with underscores
                contextString = filePaths.join("_");
            }

            await outputManager.saveOutput(output, {
                command: "combine",
                context: contextString,
                format: options.format || "xml",
            });

            const fullPath = await outputManager.getFilePath({
                command: "combine",
                context: contextString,
                format: options.format || "xml",
            });

            // Format token display
            const tokenCount = countTokens(output);
            const tokenStr = tokenCount >= 1000
                ? `${(tokenCount / 1000).toFixed(1)}k`
                : `${tokenCount}`;

            spinner.succeed(
                chalk.cyan("✨ Combined ") +
                    chalk.white(`${changes.length} files `) +
                    chalk.cyan("→ ") +
                    chalk.yellow(`${tokenStr} tokens`),
            );
            console.log(chalk.gray(`Saved to: ${fullPath}`));

            // Show agent instruction
            console.log(chalk.dim(`\nFor agents: cat "${fullPath}"`));
        }
    } catch (error) {
        spinner.fail(
            chalk.red(
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            ),
        );
        process.exit(1);
    }
}
