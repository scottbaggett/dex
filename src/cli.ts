#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { join } from "path";
import { DexHelpFormatter } from "./core/help/dex-help";
import { createExtractCommand } from "./commands/extract";

const packageJson = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const program = new Command();

if (process.argv.includes("--help-extended")) {
    // Remove the custom flag then fall back to Commander's default help
    process.argv = process.argv.filter((a) => a !== "--help-extended");
    program.parse(process.argv);
    program.outputHelp(); // the default
    process.exit(0);
}

program.configureHelp({
    formatHelp: (cmd, helper) => new DexHelpFormatter().formatHelp(cmd, helper),
});

program
    .name("dex")
    .description(packageJson.description)
    .version(packageJson.version);

// Add extract command
program.addCommand(createExtractCommand());

// Backward compatibility: allow unknown options and handle them as extract command
program.allowUnknownOption().action(async (options, command) => {
    // Check if this is the main program being called (not a subcommand)
    if (
        command.args.length > 0 ||
        Object.keys(options).length > 0 ||
        command.rawArgs.length > 2
    ) {
        // List of known subcommands
        const subcommands = [
            "extract",
            "distill",
            "combine",
            "config",
            "tree",
            "init",
            "help-selection",
        ];

        // Check if any subcommand is present in argv
        const hasSubcommand = subcommands.some((cmd) =>
            process.argv.includes(cmd),
        );

        // If no subcommand but we have arguments, treat as extract
        if (!hasSubcommand) {
            // Manually parse arguments for extract command
            const args = process.argv.slice(2);
            let range = "";
            const extractOptions: any = {};

            // Simple argument parsing - look for range (first non-option argument)
            let i = 0;
            while (i < args.length) {
                const arg = args[i];
                if (!arg.startsWith("-") && !range) {
                    // First non-option argument is the range
                    range = arg;
                } else if (arg === "--staged" || arg === "-s") {
                    extractOptions.staged = true;
                } else if (arg === "--all" || arg === "-a") {
                    extractOptions.all = true;
                } else if (arg === "--clipboard" || arg === "-c") {
                    extractOptions.clipboard = true;
                } else if (arg === "--format" || arg === "-f") {
                    extractOptions.format = args[++i];
                } else if (arg === "--path" || arg === "-p") {
                    extractOptions.path = args[++i];
                } else if (arg === "--type" || arg === "-t") {
                    extractOptions.type = args[++i];
                } else if (arg === "--task") {
                    extractOptions.task = args[++i];
                } else if (arg === "--interactive" || arg === "-i") {
                    extractOptions.interactive = true;
                } else if (arg === "--include-untracked" || arg === "-u") {
                    extractOptions.includeUntracked = true;
                } else if (arg === "--untracked-pattern") {
                    extractOptions.untrackedPattern = args[++i];
                } else if (arg === "--optimize") {
                    extractOptions.optimize = [];
                    while (
                        i + 1 < args.length &&
                        !args[i + 1].startsWith("-")
                    ) {
                        extractOptions.optimize.push(args[++i]);
                    }
                } else if (arg === "--no-metadata") {
                    extractOptions.metadata = false;
                } else if (arg === "--select") {
                    extractOptions.select = true;
                } else if (arg === "--sort-by") {
                    extractOptions.sortBy = args[++i];
                } else if (arg === "--sort-order") {
                    extractOptions.sortOrder = args[++i];
                } else if (arg === "--filter-by") {
                    extractOptions.filterBy = args[++i];
                } else if (arg === "--full") {
                    extractOptions.full = args[++i];
                } else if (arg === "--diff-only") {
                    extractOptions.diffOnly = true;
                }
                i++;
            }

            // Import and execute extract function directly
            const { executeExtract } = await import("./commands/extract");
            await executeExtract(range, extractOptions);
            return;
        }
    }

    // If no arguments, show help
    if (process.argv.length === 2) {
        command.outputHelp();
    }
});

// Init subcommand
program
    .command("init")
    .description("Initialize dex configuration")
    .action(async () => {
        const { initCommand } = await import("./commands/init");
        await initCommand();
    });

// Import snapshot command at the top level
import { createDistillCommand } from "./commands/distill";
import { createCombineCommand } from "./commands/combine";

import { createConfigCommand } from "./commands/config";
import { createTreeCommand } from "./commands/tree";

// Add distill command
program.addCommand(createDistillCommand());

// Add combine command
program.addCommand(createCombineCommand());

// Add config command
program.addCommand(createConfigCommand());

// Add tree command
program.addCommand(createTreeCommand());

// Prompt features removed

// Help command for file selection
program
    .command("help-selection")
    .description("Show detailed file selection options")
    .action(async () => {
        const { FileSelector } = await import("./utils/file-selector");
        console.log(FileSelector.getOptionsHelp());
        process.exit(0);
    });

// Parse arguments
program.parse();

// Show help if no arguments and not in interactive mode
if (process.argv.length === 2) {
    program.outputHelp();
}
