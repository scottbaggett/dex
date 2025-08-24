import { Command, Option } from "commander";
import chalk from "chalk";
import ora from "ora";
import clipboardy from "clipboardy";
import { readFileSync, statSync } from "fs";
import { resolve, relative, join } from "path";
import { XmlFormatter } from "../templates/xml";
import { MarkdownFormatter } from "../templates/markdown";
import { JsonFormatter } from "../templates/json";
import type {
    ExtractedContext,
    GitChange,
    DexOptions,
    OutputFormat,
    Formatter,
} from "../types";
import { formatFileSize } from "../utils/file-scanner";
import { FileSelector } from "../utils/file-selector";
import { OutputManager } from "../utils/output-manager";
import { GitExtractor } from "../core/git";

export function createCombineCommand(): Command {
    const combine = new Command("combine")
        .description(
            "Combine multiple files and directories into a single, LLM-friendly document",
        )
        .argument(
            "[files...]",
            "List of file paths and directories to combine (optional if using --select or --staged)",
        )
        .addOption(
            new Option("--output-format <format>", "Output format")
                .default("xml")
                .choices(["xml", "markdown", "json"]),
        )
        .option(
            "-s, --staged",
            "Combine all staged files (shows full file content, not just diffs)",
        )
        .option("-c, --copy", "Copy output to clipboard")
        // Prompt options removed
        .option("--no-metadata", "Exclude metadata from output")
        .option("-o, --output <file>", "Write output to file instead of stdout")
        .option(
            "--include <patterns>",
            'Include file patterns (comma-separated, e.g., "*.ts,*.js")',
        )
        .option(
            "--exclude <patterns>",
            'Exclude file patterns (comma-separated, e.g., "*.test.*,*.spec.*")',
        )
        .option(
            "--max-files <number>",
            "Maximum number of files to process",
            "1000",
        )
        .option("--max-depth <number>", "Maximum directory depth to scan", "10")
        .option("--no-gitignore", "Do not respect .gitignore patterns")
        .action(async (files: string[], options: any, command: any) => {
            // Merge parent options (including --select)
            const parentOptions = command.parent?.opts() || {};
            const mergedOptions = { ...parentOptions, ...options };
            await combineCommand(files, mergedOptions);
        });

    return combine;
}

async function combineCommand(filePaths: string[], options: any) {
    const spinner = ora("Scanning files...").start();

    try {
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

            spinner.text = chalk.gray(
                `Found ${filePaths.length} staged files...`,
            );

            // Show staged files info
            const filesList = stagedChanges
                .filter((change) => change.status !== "deleted")
                .map((c) => c.file)
                .join(", ");
            console.log(chalk.dim(`Staged files: ${filesList}`));
        }

        // Handle --select mode without file arguments
        if (options.select && filePaths.length === 0) {
            filePaths.push(process.cwd());
        }

        // If no files provided and not in select or staged mode, show error
        if (filePaths.length === 0) {
            spinner.fail(chalk.red("No files or directories specified"));
            console.error(
                chalk.red(
                    "Usage: dex combine <files...>, dex combine --select, or dex combine --staged",
                ),
            );
            process.exit(1);
        }

        // Parse options
        const includePatterns = options.include
            ? options.include.split(",").map((p: string) => p.trim())
            : [];
        const excludePatterns = options.exclude
            ? options.exclude.split(",").map((p: string) => p.trim())
            : [];
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
                } catch (error) {
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

        if (allFiles.length > 50 && !options.staged) {
            spinner.warn(
                chalk.yellow(
                    `Processing ${allFiles.length} files (${formatFileSize(totalSize)}). Consider using --select to choose specific files.`,
                ),
            );
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
                    options.copy = true;
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
        spinner.text = chalk.gray(
            `${processingText} (${finalFiles.length} files)`,
        );

        const changes: GitChange[] = [];
        const fullFiles = new Map<string, string>();

        for (const filePath of finalFiles) {
            try {
                const content = readFileSync(filePath, "utf-8");
                const relativePath = relative(process.cwd(), filePath);

                // Create a GitChange-like object for each file
                const change: GitChange = {
                    file: relativePath,
                    status: options.staged ? "modified" : "added", // Use 'modified' for staged files
                    additions: content.split("\n").length,
                    deletions: 0,
                    diff: "", // No diff for combine operation
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

        // Create context object
        const totalLines = Array.from(fullFiles.values()).reduce(
            (sum, content) => sum + content.split("\n").length,
            0,
        );
        const totalChars = Array.from(fullFiles.values()).reduce(
            (sum, content) => sum + content.length,
            0,
        );

        // Determine extraction method and repository info based on mode
        let extractionMethod: string;
        let repoName: string;
        let repoBranch: string;
        let repoCommit: string;

        if (options.staged) {
            const gitExtractor = new GitExtractor();
            extractionMethod = "staged-files-combine";
            repoName = "staged-changes";
            repoBranch = await gitExtractor.getCurrentBranch();
            repoCommit = await gitExtractor.getLatestCommit();
        } else {
            extractionMethod = "combine";
            repoName = "combined-files";
            repoBranch = "local";
            repoCommit = "local";
        }

        const context: ExtractedContext = {
            changes,
            scope: {
                filesChanged: changes.length,
                functionsModified: 0, // Could be enhanced with AST analysis
                linesAdded: totalLines,
                linesDeleted: 0,
            },
            fullFiles,
            metadata: {
                generated: new Date().toISOString(),
                repository: {
                    name: repoName,
                    branch: repoBranch,
                    commit: repoCommit,
                },
                extraction: {
                    method: extractionMethod,
                },
                tokens: {
                    estimated: Math.ceil(totalChars / 4), // Rough token estimation
                },
                tool: {
                    name: "dex",
                    version: "1.0.0", // Should be read from package.json
                },
            },
        };

        // Create DexOptions for formatting
        const dexOptions: DexOptions = {
            format: options.outputFormat as OutputFormat,
            noMetadata: options.noMetadata,
            clipboard: options.clipboard,
        };

        // Format output
        const formatToUse = options.outputFormat || "xml";
        spinner.text = chalk.gray(
            `Formatting as ${chalk.cyan(formatToUse)}...`,
        );
        let formatter: Formatter;

        switch (formatToUse) {
            case "xml":
                formatter = new XmlFormatter();
                break;
            case "json":
                formatter = new JsonFormatter();
                break;
            case "markdown":
                formatter = new MarkdownFormatter();
                break;
            default:
                throw new Error(`Invalid format: ${options.outputFormat}`);
        }

        const output = formatter.format({ context, options: dexOptions });

        // Handle output
        if (options.output) {
            const { writeFileSync } = await import("fs");
            writeFileSync(options.output, output);
            const successMsg = options.staged
                ? `Combined staged files written to: ${options.output}`
                : `Combined files written to: ${options.output}`;
            spinner.succeed(chalk.green(successMsg));
        } else if (options.copy || options.clipboard) {
            try {
                await clipboardy.write(output);

                // Show enhanced success message with metadata
                const tokenStr = chalk.cyan(
                    `~${context.metadata.tokens.estimated.toLocaleString()} tokens`,
                );
                const filesStr = chalk.yellow(
                    `${context.scope.filesChanged} files`,
                );
                const linesStr = chalk.green(
                    `${context.scope.linesAdded} lines`,
                );
                const successMsg = options.staged
                    ? "Combined staged files copied to clipboard"
                    : "Combined files copied to clipboard";

                spinner.succeed(
                    chalk.green(successMsg) +
                        chalk.gray(" • ") +
                        tokenStr +
                        chalk.gray(" • ") +
                        filesStr +
                        chalk.gray(" • ") +
                        linesStr +
                        chalk.gray(" • ") +
                        chalk.blue(options.outputFormat || "xml"),
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
            if (options.staged) {
                contextString = "staged-files";
            } else {
                const contextParts = filePaths
                    .map((p) => p.replace(/[^a-zA-Z0-9]/g, "-"))
                    .join("-");
                contextString =
                    contextParts.length > 20
                        ? contextParts.substring(0, 20)
                        : contextParts;
            }

            await outputManager.saveOutput(output, {
                command: "combine",
                context: contextString,
                format: options.outputFormat || "xml",
            });

            const fullPath = await outputManager.getFilePath({
                command: "combine",
                context: contextString,
                format: options.outputFormat || "xml",
            });

            // Format token display
            const tokenCount = context.metadata.tokens.estimated;
            const tokenStr =
                tokenCount >= 1000
                    ? `${Math.round(tokenCount / 1000)}k tokens`
                    : `${tokenCount} tokens`;

            spinner.succeed(
                chalk.green("Saved to ") +
                    chalk.white(fullPath) +
                    chalk.dim(" • ") +
                    chalk.white(tokenStr),
            );

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
