import { Command, Option } from "commander";
import chalk from "chalk";
import ora from "ora";
import clipboardy from "clipboardy";
import { readFileSync, statSync } from "fs";
import { resolve, relative, join, basename } from "path";
import { TextFormatter } from "./formatters/text.js";
import { MarkdownFormatter } from "./formatters/markdown.js";
import { JsonFormatter } from "./formatters/json.js";
import type { GitChange } from "../../types.js";
import { CombineOptionsSchema } from "../../schemas.js";
import { formatFileSize } from "../../utils/file-scanner.js";
import { FileSelector } from "../../utils/file-selector.js";
import { OutputManager } from "../../utils/output-manager.js";
import { GitExtractor } from "../../core/git.js";
import { countTokens, formatEstimatedTokens } from "../../utils/tokens.js";
import { z } from "zod";
import { ProgressBar } from "../../utils/progress.js";
import { runSafetyPipeline } from "../../core/safety/pipeline.js";
import {
    agentInstructions,
    combineSuccessMessage,
    combineSuccess,
    combineStagedNotFound,
    combinePathIssues,
    noFilesFound,
    savedToMessage,
    copiedToClipboard,
    scanningFiles,
    genericError,
    formatTokenCount,
    interactiveCancelled,
} from "../../utils/messages.js";
import {
    CommandExitError,
    isCommandExitError,
} from "../../utils/command-exit.js";

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
        .option("-f, --format <type>", "Output format (text, md, json)", "txt")
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
        .option(
            "--include-sensitive",
            "Include sensitive content without redaction safeguards",
        )
        .addOption(
            new Option(
                "--target <target>",
                "Target model destination",
            ).choices(["claude", "gpt", "local", "custom"]),
        )
        .option(
            "--yes",
            "Skip confirmation prompts for non-interactive unsafe operations",
        )
        .action(async (...args: unknown[]) => {
            // Handle optional paths argument - if no paths provided, args[0] will be the command object
            const paths = Array.isArray(args[0])
                ? (args[0] as string[])
                : ["."];
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

async function combineCommand(
    inputPaths: string[],
    options: z.infer<typeof CombineOptionsSchema>,
) {
    const spinner = ora(scanningFiles()).start();

    // Handle stdout option - don't show spinner if outputting to stdout
    const isStdout = options.stdout;
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
                throw new CommandExitError(1);
            }

            const hasStagedChanges = await gitExtractor.hasStagedChanges();
            if (!hasStagedChanges) {
                spinner.fail(combineStagedNotFound());
                console.log(
                    chalk.gray(
                        'Tip: Use "git add <files>" to stage files first',
                    ),
                );
                throw new CommandExitError(1);
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
        const include = options.include || [];
        const exclude = options.exclude || [];
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
                include,
                exclude,
                maxFiles,
                maxDepth,
                respectGitignore,
            });
            allFiles = result.files;
            errors = result.errors;
        }

        if (errors.length > 0) {
            spinner.warn(combinePathIssues(errors));
        }

        if (allFiles.length === 0) {
            spinner.fail(noFilesFound());
            throw new CommandExitError(1);
        }

        // Handle dry-run mode
        if (options.dryRun) {
            spinner.warn(
                chalk.yellow(
                    `Would process ${allFiles.length} files (dry-run mode)`,
                ),
            );
            let estimatedTokens = 0;
            for (const file of allFiles) {
                const size = formatFileSize(statSync(file).size);
                console.log(
                    chalk.gray(
                        `  • ${relative(process.cwd(), file)} (${size})`,
                    ),
                );
                try {
                    const content = readFileSync(file, "utf-8");
                    estimatedTokens += countTokens(content);
                } catch {
                    // Fall back to a rough size-based estimate if the file can't be read.
                    estimatedTokens += Math.ceil(statSync(file).size / 4);
                }
            }
            spinner.warn(
                chalk.yellow(
                    `Total: ${allFiles.length} files, ${formatEstimatedTokens(
                        estimatedTokens,
                    )}`,
                ),
            );
            return;
        }

        // Handle --select mode
        if (options.select) {
            spinner.stop();

            // Check if interactive mode is possible
            if (!process.stdin.isTTY || !process.stdin.setRawMode) {
                console.error(
                    chalk.red("Interactive mode requires a TTY terminal"),
                );
                console.log(
                    chalk.gray(
                        "Try running without --select or use a different terminal",
                    ),
                );
                throw new CommandExitError(1);
            }

            // Launch interactive file selection
            console.log(
                chalk.cyan(`\nFound ${allFiles.length} files`),
            );
            console.log(
                chalk.cyan(
                    "Use ↑↓ to navigate, Space to select, Enter to confirm\n",
                ),
            );

            const { launchInteractiveMode } = await import(
                "../../interactive/index.js"
            );
            try {
                const result = await launchInteractiveMode({
                    changes: allFiles.map((file) => ({
                        file: relative(process.cwd(), file),
                        status: "modified" as const,
                        additions: 0,
                        deletions: 0,
                        diff: "",
                    })),
                });

                if (!result || result.files.length === 0) {
                    console.log(interactiveCancelled());
                    throw new CommandExitError(0);
                }

                allFiles = result.files.map((f) =>
                    resolve(process.cwd(), f.file),
                );

                // If user pressed 'c' to copy to clipboard
                if (result.copyToClipboard) {
                    options.clipboard = true;
                    options.output = undefined;
                }
            } catch (error) {
                spinner.fail(
                    chalk.red(
                        `Interactive mode failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    ),
                );
                throw new CommandExitError(1);
            }

            spinner.start("Processing selected files...");
        }

        // Stop spinner before progress bar
        spinner.stop();

        // Create progress bar for file processing
        const progress = new ProgressBar({
            label: "Combining",
            showSize: true,
            unit: "files",
        });

        if (!isStdout) {
            progress.start(allFiles.length);
        }

        const startTime = Date.now();

        // Process files
        const changes: GitChange[] = [];
        const failedFiles: string[] = [];
        let totalSize = 0;

        for (let i = 0; i < allFiles.length; i++) {
            const file = allFiles[i];
            if (!file) continue;

            try {
                const relativePath = relative(process.cwd(), file);
                const stats = statSync(file);
                const content = readFileSync(file, "utf-8");

                changes.push({
                    file: relativePath,
                    status: "modified" as const,
                    content,
                    additions: content.split("\n").length,
                    deletions: 0,
                    diff: "",
                });

                totalSize += stats.size;

                if (!isStdout) {
                    progress.update(i + 1, totalSize, totalSize);
                }
            } catch {
                const relativePath = relative(process.cwd(), file);
                if (relativePath) {
                    failedFiles.push(relativePath);
                }
            }
        }

        if (!isStdout) {
            progress.complete();
        }

        if (failedFiles.length > 0) {
            console.warn(chalk.yellow("Some files could not be read"));
            for (const file of failedFiles) {
                console.warn(chalk.yellow(`  • ${file}`));
            }
        }

        if (changes.length === 0) {
            console.error(chalk.red("No files could be read"));
            throw new CommandExitError(1);
        }

        // Format output based on specified format
        const formatter = getFormatter(options.format);
        const rawOutput = formatter.format(changes);
        const safetyResult = runSafetyPipeline({
            command: "combine",
            payload: rawOutput,
            files: changes.map((change: GitChange) => ({
                path: change.file,
                content: change.content || "",
            })),
            includeSensitive: options.includeSensitive,
            yes: options.yes,
            target: options.target,
        });
        const output = safetyResult.output;

        // Handle output based on options
        const totalTokens = countTokens(output);
        const tokenStr = formatTokenCount(totalTokens);

        if (options.clipboard) {
            try {
                await clipboardy.write(output);
                const sizeKB = Math.round(totalSize / 1024);
                console.log(
                    combineSuccess(
                        changes.length,
                        sizeKB,
                        Date.now() - startTime,
                    ),
                );
                console.log(copiedToClipboard("Combined output"));
                console.log(
                    chalk.dim("Size: ") +
                        chalk.white(
                            formatFileSize(Buffer.byteLength(output, "utf-8")),
                        ),
                );
                console.log(chalk.dim("Tokens: ") + chalk.white(tokenStr));
            } catch {
                console.error(chalk.red("Failed to copy to clipboard"));
            }
        } else if (options.output) {
            // Write to specified file
            const { writeFileSync } = await import("fs");
            const outputPath = resolve(options.output);
            writeFileSync(outputPath, output, "utf-8");

            const sizeKB = Math.round(totalSize / 1024);
            console.log(
                combineSuccess(changes.length, sizeKB, Date.now() - startTime),
            );
            console.log(savedToMessage(outputPath));
            console.log("\n" + agentInstructions(outputPath));
        } else if (isStdout) {
            // Print to stdout
            console.log(output);
        } else {
            // Save to default location
            const outputManager = new OutputManager();

            // Determine context based on input paths
            let context: string;
            if (options.staged) {
                context = "staged";
            } else if (inputPaths.length === 1 && inputPaths[0]) {
                // Use basename of the path for single path input
                const inputPath =
                    inputPaths[0] === "."
                        ? process.cwd()
                        : resolve(inputPaths[0]);
                context = basename(inputPath);
            } else {
                // Multiple paths - use "combined" or first path's basename
                context = "combined";
            }

            await outputManager.saveOutput(output, {
                command: "combine",
                context,
                format: options.format as "txt" | "md" | "json",
            });

            const fullPath = await outputManager.getFilePath({
                command: "combine",
                context,
                format: options.format as "txt" | "md" | "json",
            });

            console.log(combineSuccessMessage(changes, tokenStr, fullPath));
            console.log(agentInstructions(fullPath));
        }
    } catch (error) {
        if (isCommandExitError(error)) {
            throw error;
        }
        spinner.fail(genericError(error));
        throw new CommandExitError(1);
    }
}

function getFormatter(
    format = "txt",
): TextFormatter | MarkdownFormatter | JsonFormatter {
    switch (format) {
        case "md":
            return new MarkdownFormatter();
        case "json":
            return new JsonFormatter();
        default:
            return new TextFormatter();
    }
}
