import { Command } from "commander";
import chalk from "chalk";
import { validateConfig } from "../../core/config.js";

export function createConfigCommand(): Command {
    const command = new Command("config");

    command.description("Manage DEX configuration").action(() => {
        // Default action shows help
        command.outputHelp();
    });

    // Validate configuration
    command
        .command("validate")
        .description("Validate current configuration")
        .action(async () => {
            await validateConfigCommand();
        });

    return command;
}

async function validateConfigCommand(): Promise<void> {
    console.log(chalk.cyan.bold("\n🔍 Validating Configuration\n"));

    const validation = validateConfig();

    if (validation.valid) {
        console.log(chalk.green("✅ Configuration is valid"));
    } else {
        console.log(chalk.red("❌ Configuration has issues:"));
        validation.errors.forEach((error: string) => {
            console.log(chalk.red(`  • ${error}`));
        });
    }

    console.log("");
}
