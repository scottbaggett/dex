import chalk from "chalk";
import {
    writeFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
} from "fs";
import { join, dirname } from "path";
import ora from "ora";
import * as readline from "readline";
import * as yaml from "js-yaml";

interface DexConfig {
    defaults?: {
        format?: string;
        depth?: string;
        clipboard?: boolean;
    };
    filters?: {
        ignorePaths?: string[];
        includeTypes?: string[];
    };
    tasks?: {
        defaultSource?: string;
    };
}

const DEFAULT_CONFIG: DexConfig = {
    defaults: {
        format: "markdown",
        depth: "focused",
    },
    filters: {
        ignorePaths: ["node_modules", "dist", "build", ".git", ".dex"],
    },
};

export async function initCommand(): Promise<void> {
    console.log(chalk.cyan.bold("\n🚀 Dex Configuration Setup\n"));

    const dexDir = join(process.cwd(), ".dex");
    const configPath = join(dexDir, "config.yml");
    const promptsDir = join(dexDir, "prompts");

    // Check if .dex directory already exists
    if (existsSync(dexDir)) {
        console.log(
            chalk.yellow(
                "⚠️  A .dex directory already exists in this project.",
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

    const spinner = ora("Creating .dex directory structure...").start();

    try {
        // Create .dex directory
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
# For more information, see: https://github.com/scottbaggett/dex

${configContent}
# Custom prompt templates can be added in the prompts/ directory
# Example:
# prompts:
#   my-review:
#     name: My Custom Review
#     extends: base-review
#     instructions: |
#       Custom review instructions here
`;

        writeFileSync(configPath, configWithComments);
        spinner.succeed(chalk.green("Created .dex/config.yml"));

        // Create prompts directory
        if (!existsSync(promptsDir)) {
            mkdirSync(promptsDir, { recursive: true });
        }
        spinner.succeed(chalk.green("Created .dex/prompts/ directory"));

        // Copy built-in prompts as examples
        const builtinPromptsDir = join(
            dirname(dirname(__dirname)),
            "dist",
            "prompts",
        );
        let promptFiles: string[] = [];

        if (existsSync(builtinPromptsDir)) {
            promptFiles = readdirSync(builtinPromptsDir).filter((f) =>
                f.endsWith(".yml"),
            );

            for (const file of promptFiles) {
                const sourcePath = join(builtinPromptsDir, file);
                const destPath = join(promptsDir, file);

                // Read the prompt and add a header comment
                let content = readFileSync(sourcePath, "utf-8");
                content = `# This is a copy of the built-in ${file.replace(".yml", "")} prompt template.\n# Feel free to modify it to suit your needs!\n# To use: dex --prompt-template ${file.replace(".yml", "")}\n\n${content}`;

                writeFileSync(destPath, content);
            }

            spinner.succeed(
                chalk.green(
                    `Copied ${promptFiles.length} example prompt templates to .dex/prompts/`,
                ),
            );
        } else {
            spinner.warn(
                chalk.yellow(
                    'Built-in prompts not found. Run "npm run build" first if developing locally.',
                ),
            );
        }

        // Create .dexignore file
        const dexignorePath = join(dexDir, ".dexignore");
        const dexignoreContent = `# Files and patterns to ignore when extracting context
# Uses gitignore syntax

# Dependencies
node_modules/
vendor/
.pnpm-store/

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.cache/

# IDE and system files
.idea/
.vscode/
*.swp
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Environment files with secrets
.env.local
.env.*.local

# Large binary files
*.zip
*.tar.gz
*.dmg
*.iso
*.exe
*.dll
*.so
*.dylib
`;

        writeFileSync(dexignorePath, dexignoreContent);
        spinner.succeed(chalk.green("Created .dex/.dexignore"));

        // Display summary
        console.log("\n" + chalk.white("Directory structure:"));
        console.log(chalk.white("─".repeat(40)));
        console.log(chalk.white(".dex/"));
        console.log(
            chalk.white("├── config.yml        ") +
                chalk.white("# Main configuration"),
        );
        console.log(
            chalk.white("├── .dexignore        ") +
                chalk.white("# Ignore patterns"),
        );
        console.log(
            chalk.white("└── prompts/          ") +
                chalk.white("# Custom prompt templates"),
        );

        if (promptFiles?.length) {
            for (let i = 0; i < promptFiles.length; i++) {
                const isLast = i === promptFiles.length - 1;
                console.log(
                    chalk.white(
                        `    ${isLast ? "└" : "├"}── ${promptFiles[i]}`,
                    ),
                );
            }
        }

        console.log(chalk.white("─".repeat(40)));

        console.log(chalk.cyan("\n✨ Dex has been initialized!"));
        console.log(chalk.white("\nNext steps:"));
        console.log(chalk.white("  1. Review and customize .dex/config.yml"));
        console.log(
            chalk.white("  2. Explore prompt templates in .dex/prompts/"),
        );
        console.log(chalk.white('  3. Run "dex" to extract your code changes'));
        console.log(
            chalk.white(
                "\nTip: Add .dex/ to your .gitignore if you want to keep it local",
            ),
        );
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
