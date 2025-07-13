#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { ContextEngine } from './core/context';
import { GitExtractor } from './core/git';
import { MarkdownFormatter } from './templates/markdown';
import { JsonFormatter } from './templates/json';
import { ClaudeFormatter } from './templates/claude';
import { GptFormatter } from './templates/gpt';
import { DexOptions, OutputFormat } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { mergeWithConfig } from './core/config';

const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('dex')
  .description(packageJson.description)
  .version(packageJson.version)
  .addHelpText(
    'after',
    `
██████   ███████  ██   ██
██   ██  ██        ██ ██
██   ██  █████      ███
██   ██  ██        ██ ██
██████   ███████  ██   ██

Examples:
  $ dex                          # Extract current changes
  $ dex HEAD~3                   # Changes from last 3 commits
  $ dex -s                       # Staged changes only
  $ dex -c                       # Copy to clipboard
  $ dex --full "*.ts"           # Include full TypeScript files
  $ dex --task "Fix auth bug"   # Add task context
  $ dex -i                      # Interactive mode

For more help, run 'dex help'`
  );

// Default command (extract)
program
  .argument('[range]', 'Git commit range (e.g., HEAD~5..HEAD)', '')
  .option('-s, --staged', 'Include only staged changes')
  .option('-a, --all', 'Include both staged and unstaged changes')
  .option('--since <commit>', 'Show changes since a specific commit')
  .option('-d, --depth <level>', 'Extraction depth: minimal, focused, full, extended', 'focused')
  .option('--full <pattern>', 'Include full files matching pattern (use * for all)')
  .option('-p, --path <pattern>', 'Filter by file path pattern')
  .option('-t, --type <types>', 'Filter by file types (comma-separated)')
  .option('-f, --format <format>', 'Output format: markdown, json, claude, gpt, pr', 'markdown')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('--task <source>', 'Task context (description, file path, URL, or - for stdin)')
  .option('-i, --interactive', 'Interactive mode for task input')
  .option('-u, --include-untracked', 'Include untracked files')
  .option('--untracked-pattern <pattern>', 'Pattern for untracked files to include')
  .option('--optimize <types...>', 'Optimizations: aid, symbols')
  .option('--no-metadata', 'Exclude metadata from output')
  .action(async (range, options) => {
    await extractCommand(range, options);
  });

// Extract subcommand (explicit version of default)
program
  .command('extract [range]')
  .description('Extract and format code changes')
  .option('-s, --staged', 'Include only staged changes')
  .option('-a, --all', 'Include both staged and unstaged changes')
  .option('--since <commit>', 'Show changes since a specific commit')
  .option('-d, --depth <level>', 'Extraction depth: minimal, focused, full, extended', 'focused')
  .option('--full <pattern>', 'Include full files matching pattern (use * for all)')
  .option('-p, --path <pattern>', 'Filter by file path pattern')
  .option('-t, --type <types>', 'Filter by file types (comma-separated)')
  .option('-f, --format <format>', 'Output format: markdown, json, claude, gpt, pr', 'markdown')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('--task <source>', 'Task context (description, file path, URL, or - for stdin)')
  .option('-i, --interactive', 'Interactive mode for task input')
  .option('-u, --include-untracked', 'Include untracked files')
  .option('--untracked-pattern <pattern>', 'Pattern for untracked files to include')
  .option('--optimize <types...>', 'Optimizations: aid, symbols')
  .option('--no-metadata', 'Exclude metadata from output')
  .action(async (range, options) => {
    await extractCommand(range || '', options);
  });

// Init subcommand
program
  .command('init')
  .description('Initialize dex configuration')
  .action(async () => {
    const { initCommand } = await import('./commands/init');
    await initCommand();
  });

// Help subcommand with detailed examples
program
  .command('help [command]')
  .description('Display detailed help')
  .action((command) => {
    if (command) {
      const cmd = program.commands.find((c) => c.name() === command);
      if (cmd) {
        cmd.outputHelp();
      } else {
        console.log(chalk.red(`Unknown command: ${command}`));
      }
    } else {
      console.log(chalk.cyan.bold('DEX - Context Engineering for Code Changes\n'));

      console.log(chalk.yellow('Common Usage:'));
      console.log('  dex                    Extract current unstaged changes');
      console.log('  dex -s                 Extract staged changes');
      console.log('  dex -a                 Extract all changes (staged + unstaged)');
      console.log('  dex HEAD~3             Extract changes from last 3 commits');
      console.log('  dex -c                 Copy output to clipboard');
      console.log('  dex -f claude          Format for Claude AI');
      console.log('  dex --task "Bug fix"   Add task context');
      console.log('  dex -i                 Interactive task input\n');

      console.log(chalk.yellow('Advanced Usage:'));
      console.log('  dex --full "*.ts"      Include full TypeScript files');
      console.log('  dex -d extended        Maximum context extraction');
      console.log('  dex -u                 Include new uncommitted files');
      console.log('  dex -p "src/**"        Filter to src directory');
      console.log('  dex -t ts,tsx          Filter to TypeScript files\n');

      console.log(chalk.gray('Run "dex --help" for all options'));
    }
  });

// Main extract function
async function extractCommand(range: string, options: Record<string, any>) {
  const spinner = ora('Analyzing changes...').start();

  try {
    // Check if we're in a git repository
    const gitExtractor = new GitExtractor();
    const isGitRepo = await gitExtractor.isGitRepository();

    if (!isGitRepo) {
      spinner.fail(chalk.red('Error: Not in a git repository'));
      process.exit(1);
    }

    // Validate options
    if (options.staged && options.all) {
      spinner.fail(chalk.red('Error: Cannot use --staged and --all together'));
      process.exit(1);
    }

    // Parse task source
    let task: string | undefined;
    let taskFile: string | undefined;
    let taskUrl: string | undefined;
    let taskStdin = false;

    if (options.task) {
      if (options.task === '-') {
        taskStdin = true;
      } else if (options.task.startsWith('http://') || options.task.startsWith('https://')) {
        taskUrl = options.task;
      } else if (options.task.includes('.') && !options.task.includes(' ')) {
        // Likely a file path
        taskFile = options.task;
      } else {
        // Direct task description
        task = options.task;
      }
    }

    // Handle bootstrap mode (--full *)
    const bootstrap = options.full === '*';
    const fullFiles = bootstrap ? undefined : options.full ? [options.full] : undefined;

    // Map format aliases
    let format = options.format;
    if (format === 'pr') format = 'github-pr';

    // Map optimize flags
    const aid = options.optimize?.includes('aid');
    const symbols = options.optimize?.includes('symbols');

    // Parse options
    let dexOptions: DexOptions = {
      range,
      staged: options.staged,
      all: options.all,
      since: options.since,
      depth: options.depth,
      fullFiles,
      bootstrap,
      includeUntracked: options.includeUntracked,
      untrackedPattern: options.untrackedPattern,
      path: options.path,
      type: options.type ? options.type.split(',') : undefined,
      format: format as OutputFormat,
      clipboard: options.clipboard,
      task,
      taskFile,
      taskUrl,
      taskStdin,
      interactive: options.interactive,
      aid,
      symbols,
      noMetadata: !options.metadata,
    };

    // Merge with config file defaults
    dexOptions = mergeWithConfig(dexOptions);

    // Interactive mode for task input
    if (dexOptions.interactive && !task && !taskFile && !taskStdin) {
      spinner.stop();

      // Check if we're in a TTY (some environments may have undefined instead of false)
      if (process.stdin.isTTY === false) {
        console.error(chalk.red('Error: Interactive mode requires a TTY'));
        process.exit(1);
      }

      const headerSpinner = ora({
        text: chalk.cyan('Interactive Task Input Mode'),
        spinner: 'dots',
        color: 'cyan',
      }).start();

      await new Promise((resolve) => setTimeout(resolve, 800));
      headerSpinner.succeed(chalk.cyan('Interactive Task Input Mode'));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log(chalk.gray('\nEnter your task description (press Enter twice to finish):'));
      console.log(chalk.gray('Tip: Use multiple lines for detailed descriptions\n'));

      const lines: string[] = [];
      let consecutiveEmptyLines = 0;

      const taskInput = await new Promise<string>((resolve) => {
        function askForLine() {
          rl.question(chalk.blue('▸ '), (answer) => {
            if (answer === '') {
              consecutiveEmptyLines++;
              if (consecutiveEmptyLines >= 2 && lines.length > 0) {
                while (lines.length > 0 && lines[lines.length - 1] === '') {
                  lines.pop();
                }
                rl.close();
                resolve(lines.join('\n'));
                return;
              }
            } else {
              consecutiveEmptyLines = 0;
            }

            lines.push(answer);
            askForLine();
          });
        }

        askForLine();

        rl.on('SIGINT', () => {
          console.log(chalk.yellow('\n\nTask input cancelled.'));
          rl.close();
          process.exit(0);
        });
      });

      if (taskInput) {
        dexOptions.task = taskInput;
        console.log(chalk.green('\n✓ Task description captured\n'));
        spinner.start('Analyzing changes...');
      } else {
        console.log(chalk.yellow('\nNo task description provided.'));
        process.exit(0);
      }
    }

    // Extract context
    spinner.text = chalk.gray('Extracting context...');
    const contextEngine = new ContextEngine();
    const context = await contextEngine.extract(dexOptions);

    if (context.changes.length === 0) {
      spinner.warn(
        chalk.yellow('No changes found') + chalk.gray(' - try --staged or --since=<branch>')
      );
      process.exit(0);
    }

    // Update spinner with extraction info
    spinner.text = chalk.gray(`Processing ${chalk.yellow(context.scope.filesChanged)} files...`);

    // Format output
    spinner.text = chalk.gray(`Formatting as ${chalk.cyan(dexOptions.format || 'markdown')}...`);
    let formatter;
    switch (dexOptions.format) {
      case 'json':
        formatter = new JsonFormatter();
        break;
      case 'claude':
        formatter = new ClaudeFormatter();
        break;
      case 'gpt':
        formatter = new GptFormatter();
        break;
      case 'markdown':
      default:
        formatter = new MarkdownFormatter();
    }

    const output = formatter.format({ context, options: dexOptions });

    // Handle output
    if (dexOptions.clipboard) {
      await clipboardy.write(output);

      // Show enhanced success message with metadata
      const tokenStr = chalk.cyan(`~${context.metadata.tokens.estimated.toLocaleString()} tokens`);
      const filesStr = chalk.yellow(`${context.scope.filesChanged} files`);
      const linesStr =
        chalk.green(`+${context.scope.linesAdded}`) +
        chalk.gray('/') +
        chalk.red(`-${context.scope.linesDeleted}`);
      const depthStr = chalk.magenta(context.metadata.extraction.depth);

      // Add format if not default markdown
      let formatStr = '';
      if (dexOptions.format && dexOptions.format !== 'markdown') {
        formatStr = chalk.gray(' • ') + chalk.blue(dexOptions.format);
      }

      spinner.succeed(
        chalk.green('Context copied to clipboard') +
          chalk.gray(' • ') +
          tokenStr +
          chalk.gray(' • ') +
          filesStr +
          chalk.gray(' • ') +
          linesStr +
          chalk.gray(' • ') +
          depthStr +
          formatStr
      );
    } else {
      spinner.stop();
      console.log(output);
    }

    // Show summary for non-clipboard output
    if (!dexOptions.format?.includes('json') && !dexOptions.clipboard) {
      const width = process.stdout.columns || 50;
      console.log('\n' + chalk.dim('─'.repeat(Math.min(width, 50))));

      console.log(
        chalk.cyan.bold('Summary: ') +
          chalk.yellow(`${context.scope.filesChanged} files`) +
          chalk.gray(' • ') +
          chalk.green(`+${context.scope.linesAdded}`) +
          chalk.gray('/') +
          chalk.red(`-${context.scope.linesDeleted}`) +
          chalk.gray(' • ') +
          chalk.cyan(`~${context.metadata.tokens.estimated.toLocaleString()} tokens`) +
          chalk.gray(' • ') +
          chalk.magenta(context.metadata.extraction.depth)
      );
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

// Parse arguments
program.parse();

// Show help if no arguments and not in interactive mode
if (process.argv.length === 2) {
  program.outputHelp();
}
