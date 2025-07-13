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

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('dex')
  .description(packageJson.description)
  .version(packageJson.version)
  .argument('[range]', 'Git commit range (e.g., HEAD~5..HEAD)', '')
  .option('-s, --staged', 'Include only staged changes')
  .option('--since <commit>', 'Show changes since a specific commit')
  .option('-d, --depth <level>', 'Extraction depth: minimal, focused, full, extended', 'focused')
  .option('--full-files <pattern>', 'Include full files matching pattern')
  .option('--bootstrap', 'Bootstrap mode for new AI sessions')
  .option('-p, --path <pattern>', 'Filter by file path pattern')
  .option('-t, --type <types>', 'Filter by file types (comma-separated)')
  .option('--extract <mode>', 'Extraction mode: changes, functions, symbols')
  .option('--symbols', 'Include symbol references')
  .option('-f, --format <format>', 'Output format: markdown, json, claude, gpt', 'markdown')
  .option('--json', 'Output as JSON (alias for --format json)')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('--github-pr', 'Format for GitHub PR description')
  .option('--task <description>', 'Task description for context')
  .option('--task-file <path>', 'Read task from file (markdown, text, or JSON)')
  .option('--task-url <url>', 'Fetch task from URL (not yet implemented)')
  .option('--issue <url>', 'GitHub issue URL or number (deprecated, use --task-url)')
  .option('-i, --interactive', 'Interactive mode for task input')
  .option('--compress <type>', 'Compression type: aid')
  .option('--map <type>', 'Mapping type: symbols')
  .option('--aid', 'Enable AI Distiller integration')
  .option('--no-metadata', 'Exclude metadata from output')
  .action(async (range, options) => {
    const spinner = ora('Analyzing changes...').start();

    try {
      // Check if we're in a git repository
      const gitExtractor = new GitExtractor();
      const isGitRepo = await gitExtractor.isGitRepository();
      
      if (!isGitRepo) {
        spinner.fail(chalk.red('Error: Not in a git repository'));
        process.exit(1);
      }

      // Parse options
      const dexOptions: DexOptions = {
        range,
        staged: options.staged,
        since: options.since,
        depth: options.depth,
        fullFiles: options.fullFiles ? [options.fullFiles] : undefined,
        bootstrap: options.bootstrap,
        path: options.path,
        type: options.type ? options.type.split(',') : undefined,
        extract: options.extract,
        symbols: options.symbols,
        format: options.json ? 'json' : (options.format as OutputFormat),
        json: options.json,
        clipboard: options.clipboard,
        githubPr: options.githubPr,
        task: options.task === '-' ? undefined : options.task,
        taskFile: options.taskFile,
        taskUrl: options.taskUrl,
        taskStdin: options.task === '-',
        issue: options.issue,
        interactive: options.interactive,
        compress: options.compress,
        map: options.map,
        aid: options.aid,
        noMetadata: !options.metadata,
      };

      // Interactive mode for task input
      if (dexOptions.interactive && !dexOptions.task && !dexOptions.taskFile && !dexOptions.taskStdin) {
        spinner.stop();
        
        // Check if we're in a TTY (some environments may have undefined instead of false)
        if (process.stdin.isTTY === false) {
          console.error(chalk.red('Error: Interactive mode requires a TTY'));
          process.exit(1);
        }

        // Create a nice header with ora spinner
        const headerSpinner = ora({
          text: chalk.cyan('Interactive Task Input Mode'),
          spinner: 'dots',
          color: 'cyan'
        }).start();
        
        // Show header for a moment then stop
        await new Promise(resolve => setTimeout(resolve, 800));
        headerSpinner.succeed(chalk.cyan('Interactive Task Input Mode'));
        
        // Use a simpler question-based approach
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
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
                  // Remove trailing empty lines
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
        spinner.warn(chalk.yellow('No changes found') + chalk.gray(' - try --staged or --since=<branch>'));
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
        const linesStr = chalk.green(`+${context.scope.linesAdded}`) + chalk.gray('/') + chalk.red(`-${context.scope.linesDeleted}`);
        const depthStr = chalk.magenta(context.metadata.extraction.depth);
        
        // Add format if not default markdown
        let formatStr = '';
        if (dexOptions.format && dexOptions.format !== 'markdown') {
          formatStr = chalk.gray(' • ') + chalk.blue(dexOptions.format);
        }
        
        spinner.succeed(
          chalk.green('Context copied to clipboard') + chalk.gray(' • ') +
          tokenStr + chalk.gray(' • ') +
          filesStr + chalk.gray(' • ') +
          linesStr + chalk.gray(' • ') +
          depthStr + formatStr
        );
      } else {
        spinner.stop();
        console.log(output);
      }

      // Show summary for non-clipboard output
      if (!dexOptions.json && !dexOptions.clipboard) {
        const width = process.stdout.columns || 50;
        console.log('\n' + chalk.dim('─'.repeat(Math.min(width, 50))));
        
        // Create a compact summary line
        console.log(
          chalk.cyan.bold('Summary: ') +
          chalk.yellow(`${context.scope.filesChanged} files`) + chalk.gray(' • ') +
          chalk.green(`+${context.scope.linesAdded}`) + chalk.gray('/') + chalk.red(`-${context.scope.linesDeleted}`) + chalk.gray(' • ') +
          chalk.cyan(`~${context.metadata.tokens.estimated.toLocaleString()} tokens`) + chalk.gray(' • ') +
          chalk.magenta(context.metadata.extraction.depth)
        );
      }

    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

// Show help if no arguments and not in interactive mode
if (process.argv.length === 2) {
  program.outputHelp();
} else if (process.argv.includes('-i') || process.argv.includes('--interactive')) {
  // Don't show help if interactive mode is requested
  // The action handler will take care of it
}