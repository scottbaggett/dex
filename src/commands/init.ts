import chalk from 'chalk';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import * as readline from 'readline';

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
    format: 'markdown',
    depth: 'focused',
  },
  filters: {
    ignorePaths: ['node_modules', 'dist', 'build', '.git'],
  },
};

export async function initCommand(): Promise<void> {
  console.log(chalk.cyan.bold('\n🚀 Dex Configuration Setup\n'));
  
  // Check if config already exists
  const configPath = join(process.cwd(), '.dexrc');
  if (existsSync(configPath)) {
    console.log(chalk.yellow('⚠️  A .dexrc file already exists in this directory.'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const overwrite = await new Promise<boolean>((resolve) => {
      rl.question(chalk.blue('Do you want to overwrite it? (y/N) '), (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
    
    if (!overwrite) {
      console.log(chalk.gray('\nConfiguration setup cancelled.'));
      return;
    }
  }
  
  const spinner = ora('Creating configuration file...').start();
  
  try {
    // Create config file
    const configContent = JSON.stringify(DEFAULT_CONFIG, null, 2);
    writeFileSync(configPath, configContent);
    
    spinner.succeed(chalk.green('Created .dexrc configuration file'));
    
    console.log('\n' + chalk.gray('Default configuration:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(configContent);
    console.log(chalk.gray('─'.repeat(40)));
    
    console.log(chalk.cyan('\n✨ You can now customize your dex settings!'));
    console.log(chalk.gray('\nExample customizations:'));
    console.log(chalk.gray('  • Set default format: "format": "claude"'));
    console.log(chalk.gray('  • Set default depth: "depth": "extended"'));
    console.log(chalk.gray('  • Always copy to clipboard: "clipboard": true'));
    console.log(chalk.gray('  • Ignore specific paths: "ignorePaths": ["tests", "*.test.ts"]'));
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to create configuration file'));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}