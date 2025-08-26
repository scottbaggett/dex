import chalk from "chalk";
import { GitChange } from "../schemas.js";

// ============================================
// COMMON MESSAGES
// ============================================

export const agentInstructions = (filePath?: string) => {
    let message = `For agents: `;
    if (filePath) {
        message += `cat "${filePath}"`;
    } else {
        message += `use --stdout flag`;
    }
    return chalk.dim(message);
};

export const savedToMessage = (fullPath: string) => {
    return chalk.cyan("💾 Saved to: ") + chalk.green(fullPath);
};

export const copiedToClipboard = (what: string = "Output") => {
    return chalk.cyan(`📋 ${what} copied to clipboard`);
};

export const notInGitRepo = () => {
    return chalk.red("Error: Not in a git repository");
};

export const pathNotFound = (path: string) => {
    return chalk.red(`Path not found: ${path}`);
};

export const noFilesFound = () => {
    return chalk.red("No valid files found");
};

export const fileReadError = (file: string, error?: string) => {
    return chalk.red(`Failed to read ${file}${error ? `: ${error}` : ""}`);
};

export const invalidFormat = (format: string, validFormats: string[]) => {
    return chalk.red(
        `Error: Invalid format '${format}'. Valid formats are: ${validFormats.join(", ")}`,
    );
};

// ============================================
// EXTRACT COMMAND
// ============================================

export const extractSuccessMessage = (fullPath: string, tokenStr: string) => {
    return (
        chalk.green("Saved to ") +
        chalk.white(fullPath) +
        chalk.dim(" • ") +
        chalk.white(tokenStr)
    );
};

export const extractProgress = (filesChanged: number, tokenStr: string, timeMs: number) => {
    let message = chalk.cyan("✓ Extracted ");
    message += chalk.white(`${filesChanged} ${filesChanged === 1 ? "file" : "files"} `);
    message += chalk.gray("(") + chalk.yellow(tokenStr) + chalk.gray(")");
    message += chalk.dim(` in ${timeMs}ms`);
    return message;
};

export const extractNoChanges = () => {
    return chalk.yellow("No changes found in the specified range");
};

export const extractSkippedFiles = (count: number) => {
    return (
        chalk.yellow("Skipped ") +
        chalk.white(`${count} unstaged files`) +
        chalk.dim(" (use ") +
        chalk.cyan("--all") +
        chalk.dim(" to include)")
    );
};

export const extractDirectoryHint = (path: string) => {
    return [
        chalk.red("It looks like you're trying to analyze files in a directory."),
        chalk.yellow("\nTo analyze files in a directory, use:"),
        chalk.green(`  dex distill ${path}`),
        chalk.yellow("\nTo extract git changes, use a git range like:"),
        chalk.green("  dex HEAD~1..HEAD"),
        chalk.green("  dex --staged"),
    ].join("\n");
};

export const extractConflictError = () => {
    return chalk.red("Error: Cannot use --staged and --all together");
};

// ============================================
// DISTILL COMMAND
// ============================================

export const distillSuccess = (
    fileCount: number,
    tokenStr: string,
    compressionRatio: number,
    timeMs: number,
) => {
    return (
        chalk.cyan("✨ Distilled ") +
        chalk.white(`${fileCount} files `) +
        chalk.cyan("→ ") +
        chalk.yellow(`${tokenStr} tokens `) +
        chalk.gray(`(${compressionRatio}% reduction) `) +
        chalk.gray(`in ${timeMs}ms`)
    );
};

export const distillSaved = (fullPath: string) => {
    return chalk.cyan("Distilled output saved to: ") + chalk.green(fullPath);
};

export const distillWritten = (outputPath: string) => {
    return chalk.cyan("💾 Distilled output written to: ") + chalk.green(outputPath);
};

export const distillNoFiles = () => {
    return chalk.yellow("No files to distill after applying filters");
};

export const distillSelectPrompt = (fileCount: number, estimatedTokens: number) => {
    return (
        chalk.cyan(`\nFound ${fileCount} files `) +
        chalk.gray(`(~${Math.round(estimatedTokens / 1000)}k tokens)`) +
        chalk.cyan("\nUse ↑↓ to navigate, Space to select, Enter to confirm\n")
    );
};

// ============================================
// COMBINE COMMAND
// ============================================

export const combineSuccessMessage = (
    changes: GitChange[],
    tokenStr: string,
    fullPath: string,
) => {
    return (
        chalk.cyan("✨ Combined ") +
        chalk.white(`${changes.length} files `) +
        chalk.cyan("→ ") +
        chalk.yellow(`${tokenStr} tokens\n`) +
        savedToMessage(fullPath)
    );
};

export const combineSuccess = (fileCount: number, sizeKB: number, timeMs: number) => {
    return (
        chalk.cyan("✨ Combined ") +
        chalk.white(`${fileCount} files `) +
        chalk.gray(`(${sizeKB} kB) `) +
        chalk.gray(`in ${timeMs}ms`)
    );
};

export const combineError = () => {
    return chalk.red("Failed to combine files.");
};

export const combineStagedNotFound = () => {
    return chalk.red("No staged files found");
};

export const combinePathIssues = (errors: string[]) => {
    return [
        chalk.yellow("Some paths had issues:"),
        ...errors.map((err) => chalk.dim(`  - ${err}`)),
    ].join("\n");
};

// ============================================
// TREE COMMAND
// ============================================

export const treeGenerating = () => {
    return chalk.cyan("✨ Generating Tree...");
};

export const treeSaved = (fullPath: string) => {
    return chalk.cyan("💾 API tree saved to: ") + chalk.green(fullPath);
};

export const treeWritten = (outputPath: string) => {
    return chalk.cyan("💾 API tree written to: ") + chalk.green(outputPath);
};

export const treeNoApis = () => {
    return chalk.red("No API information extracted. Try a different depth level.");
};

export const treeCopied = () => {
    return chalk.cyan("API tree copied to clipboard");
};

// ============================================
// INTERACTIVE MODE
// ============================================

export const interactiveNotTTY = () => {
    return chalk.red("Interactive mode requires a TTY terminal");
};

export const interactiveCancelled = () => {
    return chalk.yellow("Selection cancelled");
};

export const interactiveSelected = (count: number) => {
    return chalk.cyan(`Selected ${count} file${count === 1 ? "" : "s"}`);
};

// ============================================
// PROGRESS MESSAGES
// ============================================

export const scanningFiles = () => {
    return chalk.gray("Scanning files...");
};

export const analyzingChanges = () => {
    return chalk.gray("Analyzing changes...");
};

export const extractingContext = () => {
    return chalk.gray("Extracting context...");
};

export const formattingOutput = (format: string) => {
    return chalk.gray(`Formatting as ${format}...`);
};

export const calculatingTokens = () => {
    return chalk.gray("Calculating token count...");
};

// ============================================
// ERROR MESSAGES
// ============================================

export const genericError = (error: unknown) => {
    return chalk.red(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
};

export const commandFailed = (command: string, error?: string) => {
    return chalk.red(
        `${command} failed${error ? `: ${error}` : ""}`,
    );
};

// ============================================
// TOKEN FORMATTING
// ============================================

export const formatTokenCount = (tokens: number): string => {
    if (tokens >= 1000) {
        return `${Math.round(tokens / 1000)}k tokens`;
    }
    return `${tokens} tokens`;
};

export const formatTokenCountShort = (tokens: number): string => {
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}k`;
    }
    return `${tokens}`;
};