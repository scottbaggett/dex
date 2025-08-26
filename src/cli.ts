import { createCombineCommand } from "./commands/combine/index.js";
import { createTreeCommand } from "./commands/tree/index.js";
import { type ExtractOptions } from "./schemas.js";
import { Command } from "commander";
import { readFileSync } from "fs";
import { join } from "path";
import { DexHelpFormatter } from "./core/help/dex-help.js";
import { createExtractCommand } from "./commands/extract/index.js";
import { createDistillCommand } from "./commands/distill/index.js";
import { executeExtract } from "./commands/extract/index.js";
import { FileSelector } from "./utils/file-selector.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const program = new Command();

if (process.argv.includes("--help-extended")) {
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

program.addCommand(createExtractCommand());
program.addCommand(createDistillCommand());

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
            "tree",
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
            const extractOptions: ExtractOptions = {};

            // Simple argument parsing - look for range (first non-option argument)
            let i = 0;
            while (i < args.length) {
                const arg = args[i];
                if (arg && !arg.startsWith("-") && !range) {
                    // First non-option argument is the range
                    range = arg;
                } else if (arg === "--staged" || arg === "-s") {
                    extractOptions.staged = true;
                } else if (arg === "--all" || arg === "-a") {
                    extractOptions.all = true;
                } else if (arg === "--clipboard" || arg === "-c") {
                    extractOptions.clipboard = true;
                } else if (arg === "--format" || arg === "-f") {
                    const format = args[++i];
                    if (format && ["md", "json", "txt"].includes(format)) {
                        extractOptions.format =
                            format as ExtractOptions["format"];
                    } else {
                        throw new Error(`Invalid format: ${format}`);
                    }
                } else if (arg === "--path" || arg === "-p") {
                    extractOptions.path = args[++i];
                } else if (arg === "--type" || arg === "-t") {
                    extractOptions.type = args[++i]?.split(",");
                } else if (arg === "--interactive" || arg === "-i") {
                    extractOptions.interactive = true;
                } else if (arg === "--include-untracked" || arg === "-u") {
                    extractOptions.includeUntracked = true;
                } else if (arg === "--untracked-pattern") {
                    extractOptions.untrackedPattern = args[++i];
                } else if (arg === "--no-metadata") {
                    extractOptions.noMetadata = true;
                } else if (arg === "--select") {
                    extractOptions.select = true;
                } else if (arg === "--sort-by") {
                    extractOptions.sortBy = args[
                        ++i
                    ] as ExtractOptions["sortBy"];
                } else if (arg === "--sort-order") {
                    extractOptions.sortOrder = args[
                        ++i
                    ] as ExtractOptions["sortOrder"];
                } else if (arg === "--filter-by") {
                    extractOptions.filterBy = args[
                        ++i
                    ] as ExtractOptions["filterBy"];
                } else if (arg === "--full") {
                    extractOptions.full =
                        args[++i] === "true" ? "true" : "false";
                } else if (arg === "--diff-only") {
                    extractOptions.diffOnly = true;
                }
                i++;
            }

            // Import and execute extract function directly
            await executeExtract(range, extractOptions);
            return;
        }
    }

    if (process.argv.length === 2) {
        command.outputHelp();
    }
});

program.addCommand(createCombineCommand());
program.addCommand(createTreeCommand());

program
    .command("help-selection")
    .description("Show detailed file selection options")
    .action(async () => {
        console.log(FileSelector.getOptionsHelp());
        process.exit(0);
    });

program.parse();

if (process.argv.length === 2) {
    program.outputHelp();
}
