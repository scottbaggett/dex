import { Command } from "commander";
import chalk from "chalk";
import { Distiller } from "../core/distiller";
import type { DistillerOptions } from "../types";
import { promises as fs } from "fs";
import { resolve, basename } from "path";
import clipboardy from "clipboardy";
import { DistillerProgress } from "../core/distiller/progress";
import { loadConfig } from "../core/config";
import { OutputManager } from "../utils/output-manager";
import { FileSelector } from "../utils/file-selector";

export function createDistillCommand(): Command {
    const command = new Command("distill");

    command
        .description(
            "Compress and distill entire codebases into token-efficient formats (defaults to saving in .dex/)",
        )
        .argument(
            "[path]",
            "Path to directory or file to distill (defaults to current directory)",
        )
        .option(
            "-d, --depth <level>",
            "Extraction depth (minimal, public, extended, full)",
            "public",
        )
        .option(
            "-f, --format <type>",
            "Output format (compressed, distilled, both)",
            "distilled",
        )
        .option("-o, --output <file>", "Write output to specific file")
        .option("--stdout", "Print output to stdout")
        .option("--test-flag", "Test flag for debugging")
        .option(
            "--exclude <patterns...>",
            "Exclude file patterns",
            collectPatterns,
            [],
        )
        .option("--no-compress", "Skip compression phase")
        .option("--no-parallel", "Disable parallel processing")
        .option("--with-comments", "Include code comments")
        .option("--no-docstrings", "Exclude docstrings")
        .option(
            "--ai-action <action>",
            "Generate AI prompt (audit, refactor, document, analyze)",
        )
        .option("--prompt-template <file>", "Path to custom prompt template")
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
    // Load config first
    const config = loadConfig();

    // Determine if we should show progress
    const defaultOutput = config.distiller?.defaultOutput || "save";
    const isStdout =
        options.stdout ||
        (!options.clipboard && !options.output && defaultOutput === "stdout");

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

        // Build distiller options with config defaults
        const configExcludes = config.distiller?.excludePatterns || [];
        const cliExcludes = options.exclude || [];

        const distillerOptions: DistillerOptions = {
            path: resolvedPath,
            depth: options.depth,
            compressFirst: options.compress !== false,
            excludePatterns: [...configExcludes, ...cliExcludes],
            includeComments: options.withComments || false,
            includeDocstrings: options.docstrings !== false,
            format: options.format,
            output: options.output,
            since: options.since,
            staged: options.staged,
            parallel: options.parallel !== false,
            aiAction: options.aiAction,
            promptTemplate: options.promptTemplate,
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
                        excludePatterns: [...configExcludes, ...cliExcludes],
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

        // Create distiller instance
        const distiller = new Distiller(distillerOptions);

        // Run distillation with progress (unless outputting to stdout)
        // If we have selected files, we need to modify the distiller to use them
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

        // Format result
        const formatted = distiller.formatResult(result, resolvedPath);

        // Add AI prompt if requested
        let output = formatted;
        if (options.aiAction) {
            output =
                generateAIPrompt(options.aiAction, formatted) + "\n\n" + output;
        }

        // Handle output based on explicit options first, then fall back to config
        if (options.clipboard) {
            await clipboardy.write(output);

            // Complete progress
            if ("apis" in result && result.metadata) {
                progress.complete({
                    originalTokens: result.metadata.originalTokens || 0,
                    distilledTokens: result.metadata.distilledTokens || 0,
                    fileCount: result.structure?.fileCount || 0,
                });
            }

            console.log(chalk.cyan("📋 Distilled output copied to clipboard"));
        } else if (options.output) {
            await fs.writeFile(options.output, output, "utf-8");

            // Complete progress
            if ("apis" in result && result.metadata) {
                progress.complete({
                    originalTokens: result.metadata.originalTokens || 0,
                    distilledTokens: result.metadata.distilledTokens || 0,
                    fileCount: result.structure?.fileCount || 0,
                });
            }

            console.log(
                chalk.cyan("💾 Distilled output written to: ") +
                    chalk.green(options.output),
            );
        } else if (isStdout) {
            // Print to stdout if explicitly requested or configured
            console.log(output);
        } else if (!options.clipboard && defaultOutput === "clipboard") {
            // Use clipboard if configured as default
            await clipboardy.write(output);

            // Complete progress
            if ("apis" in result && result.metadata) {
                progress.complete({
                    originalTokens: result.metadata.originalTokens || 0,
                    distilledTokens: result.metadata.distilledTokens || 0,
                    fileCount: result.structure?.fileCount || 0,
                });
            }

            console.log(chalk.cyan("📋 Distilled output copied to clipboard"));
        } else {
            // Default: save using OutputManager
            const outputManager = new OutputManager();
            const folderName = basename(resolvedPath);

            await outputManager.saveOutput(output, {
                command: "distill",
                context: folderName,
                format: "markdown", // distill outputs markdown format
            });

            const fullPath = outputManager.getFilePath({
                command: "distill",
                context: folderName,
                format: "markdown",
            });

            // Complete progress with cool output
            if ("apis" in result && result.metadata) {
                progress.complete({
                    originalTokens: result.metadata.originalTokens || 0,
                    distilledTokens: result.metadata.distilledTokens || 0,
                    fileCount: result.structure?.fileCount || 0,
                });
            }

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

function generateAIPrompt(action: string, _context: string): string {
    const prompts: Record<string, string> = {
        audit: `# Security Audit Request

Please perform a comprehensive security audit of the following codebase. Focus on:

1. **Authentication & Authorization**: Identify any weaknesses in access control
2. **Input Validation**: Find potential injection vulnerabilities
3. **Data Protection**: Check for exposed sensitive data or weak encryption
4. **Dependencies**: Identify outdated or vulnerable dependencies
5. **Best Practices**: Note any deviations from security best practices

Provide specific, actionable recommendations for each finding.`,

        refactor: `# Code Refactoring Analysis

Please analyze the following codebase for refactoring opportunities. Focus on:

1. **Code Duplication**: Identify repeated patterns that could be abstracted
2. **Complexity**: Find overly complex functions/classes that should be simplified
3. **Design Patterns**: Suggest appropriate patterns to improve architecture
4. **Performance**: Identify potential performance bottlenecks
5. **Maintainability**: Recommend changes to improve code readability and maintenance

Provide specific refactoring suggestions with code examples where applicable.`,

        document: `# Documentation Generation

Please generate comprehensive documentation for the following codebase:

1. **Overview**: Provide a high-level description of the project's purpose
2. **Architecture**: Explain the overall system architecture and key components
3. **API Reference**: Document all public APIs with examples
4. **Usage Guide**: Create practical examples for common use cases
5. **Configuration**: Document all configuration options

Format the documentation in Markdown with clear sections and code examples.`,

        analyze: `# Codebase Analysis

Please provide a comprehensive analysis of the following codebase:

1. **Architecture Overview**: Describe the high-level structure and design patterns
2. **Key Components**: Identify and explain the main modules/classes
3. **Dependencies**: Map out the dependency relationships
4. **Strengths**: Highlight well-designed aspects of the code
5. **Improvement Areas**: Suggest areas that could be enhanced

Provide insights that would help a new developer quickly understand the codebase.`,
    };

    return prompts[action] || prompts.analyze || "";
}
