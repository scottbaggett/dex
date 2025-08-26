import chalk from "chalk";
import {
    writeFileSync,
    existsSync,
    mkdirSync,
} from "fs";
import { join } from "path";
import ora from "ora";
import * as readline from "readline";
import * as yaml from "js-yaml";
import type { DexConfig } from "../../core/config.js";

// Simplified default config for init
const DEFAULT_CONFIG: Partial<DexConfig> = {
    output: {
        defaultFormat: "md",
        defaultDestination: "save",
    },
    filters: {
        ignorePaths: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/coverage/**",
            "**/.next/**",
        ],
        respectGitignore: true,
    },
    distiller: {
        includeDocstrings: true,
        includePrivate: false,
        maxFiles: 1000,
    },
};

export async function initCommand(): Promise<void> {
    console.log(chalk.cyan.bold("\n🚀 Dex Configuration Setup\n"));

    // Check for existing config files
    const dexDir = join(process.cwd(), ".dex");
    const dexrcPath = join(process.cwd(), ".dexrc");
    const configPath = join(dexDir, "config.yml");
    
    // Check if any config already exists
    if (existsSync(dexDir) || existsSync(dexrcPath)) {
        console.log(
            chalk.yellow(
                "⚠️  Dex configuration already exists in this project.",
            ),
        );

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const overwrite = await new Promise<boolean>((resolve) => {
            rl.question(
                chalk.blue("Do you want to reinitialize it? (y/N) "),
                (answer) => {
                    rl.close();
                    resolve(answer.toLowerCase() === "y");
                },
            );
        });

        if (!overwrite) {
            console.log(chalk.white("\nConfiguration setup cancelled."));
            return;
        }
    }

    // Ask user which config style they prefer
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const useSimpleConfig = await new Promise<boolean>((resolve) => {
        console.log(chalk.white("\nChoose configuration style:"));
        console.log(chalk.white("  1) Simple (.dexrc) - Minimal config in project root"));
        console.log(chalk.white("  2) Full (.dex/config.yml) - Complete config with all options"));
        
        rl.question(
            chalk.blue("\nSelect option (1 or 2, default: 1): "),
            (answer) => {
                rl.close();
                resolve(answer !== "2");
            },
        );
    });

    const spinner = ora(useSimpleConfig ? "Creating .dexrc..." : "Creating .dex directory structure...").start();

    try {
        if (useSimpleConfig) {
            // Create simple .dexrc file
            const simpleConfig = {
                output: {
                    defaultFormat: "md",
                },
                filters: {
                    ignorePaths: [
                        "**/node_modules/**",
                        "**/dist/**",
                        "**/build/**",
                    ],
                },
            };

            const configContent = yaml.dump(simpleConfig, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                sortKeys: false,
            });

            const configWithComments = `# Dex Configuration (Simple)
# For full options, run 'dex init' and choose option 2
# Note: Binary files (images, executables, etc.) are always ignored

${configContent}`;

            writeFileSync(dexrcPath, configWithComments);
            spinner.succeed(chalk.green("Created .dexrc"));
        } else {
            // Create full .dex directory structure
            if (!existsSync(dexDir)) {
                mkdirSync(dexDir, { recursive: true });
            }

            // Create config.yml
            const configContent = yaml.dump(DEFAULT_CONFIG, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                sortKeys: false,
            });

            // Add helpful comments to the config
            const configWithComments = `# Dex Configuration
# Customize these settings to fit your project needs
# For full documentation: https://github.com/scottbaggett/dex
# Note: Binary files (images, executables, archives, etc.) are always ignored

${configContent}
# Additional options available:
# - extract: Configure extract command defaults
# - combine: Configure combine command defaults  
# - performance: Tune parallel processing and caching`;

            writeFileSync(configPath, configWithComments);
            spinner.succeed(chalk.green("Created .dex/config.yml"));
        }


        // Display summary
        console.log("\n" + chalk.white("Created files:"));
        console.log(chalk.white("─".repeat(40)));
        
        if (useSimpleConfig) {
            console.log(chalk.white(".dexrc                # Simple configuration"));
        } else {
            console.log(chalk.white(".dex/"));
            console.log(
                chalk.white("└── config.yml        ") +
                    chalk.white("# Main configuration"),
            );
        }
        
        console.log(chalk.white("─".repeat(40)));

        console.log(chalk.cyan("\n✨ Dex has been initialized!"));
        console.log(chalk.white("\nNext steps:"));
        
        if (useSimpleConfig) {
            console.log(chalk.white("  1. Review and customize .dexrc"));
            console.log(chalk.white('  2. Run "dex" to extract your code changes'));
            console.log(
                chalk.white(
                    "\nTip: Run 'dex init' again and choose option 2 for more configuration options",
                ),
            );
        } else {
            console.log(chalk.white("  1. Review and customize .dex/config.yml"));
            console.log(chalk.white('  2. Run "dex" to extract your code changes'));
            console.log(
                chalk.white(
                    "\nTip: Add .dex/ to your .gitignore if you want to keep it local",
                ),
            );
        }
    } catch (error) {
        spinner.fail(chalk.red("Failed to initialize Dex"));
        console.error(
            chalk.red(
                `Error: ${error instanceof Error ? error.message : error}`,
            ),
        );
        process.exit(1);
    }
}
