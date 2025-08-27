import { Command, Option } from "commander";
import chalk from "chalk";
import ora from "ora";
import clipboardy from "clipboardy";
import { ContextEngine } from "../../core/context.js";
import { GitExtractor } from "../../core/git.js";
import { MarkdownFormatter } from "./formatters/markdown.js";
import { JsonFormatter } from "./formatters/json.js";
import { TextFormatter } from "./formatters/text.js";
import type { DexOptions } from "../../types.js";
import { ExtractOptionsSchema } from "../../schemas.js";
import { OutputManager } from "../../utils/output-manager.js";
import {
    agentInstructions,
    extractSuccessMessage,
} from "../../utils/messages.js";

// Helper function to generate context string for filename
function generateContextString(dexOptions: DexOptions, method: string): string {
    if (dexOptions.range) {
        return dexOptions.range;
    }
    if (dexOptions.staged) {
        return "staged";
    }
    if (dexOptions.all) {
        return "all";
    }
    // Parse method string to extract meaningful context
    if (method.includes("session")) {
        return "session";
    }
    if (method.includes("feature branch")) {
        return "feature-branch";
    }
    return "current";
}

export async function executeExtract(
    range: string,
    rawOptions: Record<string, any>,
) {
    const spinner = ora("Analyzing changes...").start();

    try {
        // Check if we're in a git repository
        const gitExtractor = new GitExtractor();
        const isGitRepo = await gitExtractor.isGitRepository();

        if (!isGitRepo) {
            spinner.fail(chalk.red("Error: Not in a git repository"));
            process.exit(1);
        }

        // Check if the range argument looks like a path instead of a git range
        if (
            range &&
            (range.includes("./") ||
                range.includes("../") ||
                range.endsWith("/") ||
                range === "." ||
                range === ".." ||
                range.startsWith("./"))
        ) {
            spinner.fail(
                chalk.red(
                    "It looks like you're trying to analyze files in a directory.",
                ),
            );
            console.log(
                chalk.yellow("\nTo analyze files in a directory, use:"),
            );
            console.log(chalk.green(`  dex distill ${range}`));
            console.log(
                chalk.yellow("\nTo extract git changes, use a git range like:"),
            );
            console.log(chalk.green("  dex HEAD~1..HEAD"));
            console.log(chalk.green("  dex --staged"));
            process.exit(1);
        }

        // Parse and validate options using schema
        const parsedOptions = ExtractOptionsSchema.parse({
            range: range,
            ...rawOptions,
            // Handle special cases
            type: rawOptions.type ? rawOptions.type.split(",") : undefined,
            aid: rawOptions.optimize?.includes("aid"),
            symbols: rawOptions.optimize?.includes("symbols"),
            noMetadata: !rawOptions.metadata,
        });

        // Validate options
        if (parsedOptions.staged && parsedOptions.all) {
            spinner.fail(
                chalk.red("Error: Cannot use --staged and --all together"),
            );
            process.exit(1);
        }

        // Validate format
        const validFormats = ["txt", "md", "json"];
        if (
            parsedOptions.format &&
            !validFormats.includes(parsedOptions.format)
        ) {
            spinner.fail(
                chalk.red(
                    `Error: Invalid format '${parsedOptions.format}'. Valid formats are: txt, md, json`,
                ),
            );
            process.exit(1);
        }

        // Handle interactive selection if requested - do this BEFORE context extraction
        if (parsedOptions.select) {
            // Check if interactive mode is possible
            if (!process.stdin.isTTY || !process.stdin.setRawMode) {
                spinner.fail(
                    chalk.red("Interactive mode requires a TTY terminal"),
                );
                const { FileSelector } = await import(
                    "../../utils/file-selector.js"
                );
                const fileSelector = new FileSelector();
                fileSelector.showTTYError();
                process.exit(1);
            }

            spinner.text = chalk.gray("Scanning files for selection...");

            try {
                const { FileSelector } = await import(
                    "../../utils/file-selector.js"
                );
                const fileSelector = new FileSelector();

                // Collect all files in the repository (similar to combine command)
                const { files: allFiles, errors } =
                    await fileSelector.collectFiles([process.cwd()], {
                        exclude: [
                            ".git/**",
                            ".dex/**",
                            "node_modules/**",
                            "dist/**",
                            "build/**",
                            ".next/**",
                            ".nuxt/**",
                            ".cache/**",
                            ".DS_Store",
                            "*.log",
                            "coverage/**",
                            ".env.local",
                            ".env.*.local",
                            "vendor/**",
                            "__pycache__/**",
                            "*.pyc",
                            ".pytest_cache/**",
                            "target/**",
                            "Cargo.lock",
                            "package-lock.json",
                            "yarn.lock",
                            "pnpm-lock.yaml",
                        ],
                        maxFiles: 10000,
                        maxDepth: 20,
                        respectGitignore: true,
                    });

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

                spinner.stop();

                // Convert to GitChange objects for selection
                const fileChanges = fileSelector.filesToGitChanges(allFiles);
                const result = await fileSelector.selectFiles(fileChanges, {
                    sortBy: parsedOptions.sortBy,
                    sortOrder: parsedOptions.sortOrder,
                    filterBy: parsedOptions.filterBy,
                });

                // Override clipboard option if user pressed 'c'
                if (result.copyToClipboard) {
                    parsedOptions.clipboard = true;
                }

                // Update parsedOptions to include selected files for context extraction
                parsedOptions.selectedFiles = result.files.map(
                    (change: any) => change.file,
                );

                spinner.start("Extracting context from selected files...");
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

        // Extract context (either from git changes or selected files)
        spinner.text = chalk.gray("Extracting context...");
        const startTime = Date.now();
        const contextEngine = new ContextEngine(gitExtractor);
        const context = await contextEngine.extract(parsedOptions);
        const extractionTime = Date.now() - startTime;

        if (context.changes.length === 0) {
            spinner.warn(
                chalk.yellow("No changes found") +
                    chalk.gray(" - try --staged or --all"),
            );
            process.exit(0);
        }

        // Show detection feedback message with progress bar
        if (context.metadata.extraction.method) {
            // Calculate progress bar
            let progressBar = "";
            let compressionPercent = 0;
            if (context.tokenSavings && context.tokenSavings.percentSaved > 0) {
                compressionPercent = context.tokenSavings.percentSaved;
                const filled = Math.round(compressionPercent / 10);
                const empty = 10 - filled;
                progressBar =
                    chalk.green("█".repeat(filled)) +
                    chalk.dim("░".repeat(empty));
            }

            // Format the main message
            let message =
                chalk.white("Packaged ") +
                chalk.white(
                    `${context.scope.filesChanged} ${context.metadata.extraction.method}`,
                );

            if (progressBar) {
                message +=
                    " " +
                    chalk.dim("[") +
                    progressBar +
                    chalk.dim("]") +
                    " " +
                    chalk.white(`${compressionPercent}% compression`);
            }

            // Add timing
            message += chalk.dim(` in ${extractionTime}ms`);

            spinner.succeed(message);

            // Show skipped files if any
            if (
                context.additionalContext?.notIncluded &&
                typeof context.additionalContext.notIncluded === "number" &&
                context.additionalContext.notIncluded > 0
            ) {
                console.log(
                    chalk.yellow("Skipped ") +
                        chalk.white(
                            `${context.additionalContext.notIncluded} unstaged files`,
                        ) +
                        chalk.dim(" (use ") +
                        chalk.white("--all") +
                        chalk.dim(" to include)"),
                );
            }

            spinner.start(); // Restart spinner for formatting
        }

        // Update spinner with extraction info
        spinner.text = chalk.gray(
            `Processing ${chalk.yellow(context.scope.filesChanged)} files...`,
        );

        // Format output
        spinner.text = chalk.gray(
            `Formatting as ${chalk.cyan(parsedOptions.format || "xml")}...`,
        );
        let formatter;
        switch (parsedOptions.format || "txt") {
            case "json":
                formatter = new JsonFormatter();
                break;
            case "txt":
                formatter = new TextFormatter();
                break;
            case "md":
                formatter = new MarkdownFormatter();
                break;
            default:
                // This should never happen due to validation above
                throw new Error(`Invalid format: ${parsedOptions.format}`);
        }

        const output = formatter.format({ context, options: parsedOptions });

        // Generate context string for filename
        const contextString = generateContextString(
            parsedOptions,
            context.metadata.extraction.method || "default",
        );

        // Handle output
        if (parsedOptions.clipboard) {
            await clipboardy.write(output);

            // Format token display
            const tokenCount = context.metadata.tokens.estimated;
            const tokenStr =
                tokenCount >= 1000
                    ? `${Math.round(tokenCount / 1000)}k tokens`
                    : `${tokenCount} tokens`;

            spinner.succeed(
                chalk.green("Copied to clipboard") +
                    chalk.dim(" • ") +
                    chalk.white(tokenStr),
            );
        } else {
            // Save to file instead of printing to console
            const outputManager = new OutputManager();
            await outputManager.saveOutput(output, {
                command: "extract",
                context: contextString,
                format: parsedOptions.format || "txt",
            });

            const fullPath = await outputManager.getFilePath({
                command: "extract",
                context: contextString,
                format: parsedOptions.format || "txt",
            });

            // Format token display
            const tokenCount = context.metadata.tokens.estimated;
            const tokenStr =
                tokenCount >= 1000
                    ? `${Math.round(tokenCount / 1000)}k tokens`
                    : `${tokenCount} tokens`;

            spinner.succeed(extractSuccessMessage(fullPath, tokenStr));
            console.log(agentInstructions(fullPath));
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

export function createExtractCommand(): Command {
    const command = new Command("extract");

    command
        .description("Extract git-aware change analysis with smart context")
        .argument("[range]", "Git commit range (e.g., HEAD~5..HEAD)", "")
        .option("-s, --staged", "Include only staged changes")
        .option("-a, --all", "Include both staged and unstaged changes")
        .option("--full <pattern>", "Include full files matching pattern")
        .option(
            "--diff-only",
            "Force diff view for all files (disable Smart Context)",
        )
        .option("-p, --path <pattern>", "Filter by file path pattern")
        .option("-t, --type <types>", "Filter by file types (comma-separated)")
        .addOption(
            new Option("-f, --format <format>", "Output format")
                .default("txt")
                .choices(["txt", "md", "json"]),
        )
        .option("-c, --clipboard", "Copy output to clipboard")
        .option("-u, --include-untracked", "Include untracked files")
        .option(
            "--untracked-pattern <pattern>",
            "Pattern for untracked files to include",
        )
        .option("--optimize <types...>", "Optimizations: aid, symbols")
        .option("--no-metadata", "Exclude metadata from output")
        .option("--select", "Interactive file selection mode")
        .option(
            "--sort-by <option>",
            "Sort files by: name, updated, size, status (default: name)",
        )
        .option(
            "--sort-order <order>",
            "Sort direction: asc or desc (default: asc)",
        )
        .option(
            "--filter-by <option>",
            "Filter files by: all, staged, unstaged, untracked, modified, added, deleted (default: all)",
        )
        .action(async (range, options) => {
            await executeExtract(range, options);
        });

    return command;
}
