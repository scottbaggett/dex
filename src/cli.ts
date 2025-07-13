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

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('dex')
  .description(packageJson.description)
  .version(packageJson.version)
  .argument('[range]', 'Git commit range (e.g., HEAD~5..HEAD)')
  .option('-s, --staged', 'Include only staged changes')
  .option('--since <commit>', 'Show changes since a specific commit')
  .option('-c, --context <level>', 'Context level: minimal, focused, full, extended', 'focused')
  .option('--full-files <pattern>', 'Include full files matching pattern')
  .option('--bootstrap', 'Bootstrap mode for new AI sessions')
  .option('-p, --path <pattern>', 'Filter by file path pattern')
  .option('-t, --type <types>', 'Filter by file types (comma-separated)')
  .option('--extract <mode>', 'Extraction mode: changes, functions, symbols')
  .option('--symbols', 'Include symbol references')
  .option('-f, --format <format>', 'Output format: markdown, json, claude, gpt', 'markdown')
  .option('--json', 'Output as JSON (alias for --format json)')
  .option('--clipboard', 'Copy output to clipboard')
  .option('--github-pr', 'Format for GitHub PR description')
  .option('--task <description>', 'Task description for context')
  .option('--issue <url>', 'GitHub issue URL or number')
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
        context: options.context,
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
        task: options.task,
        issue: options.issue,
        interactive: options.interactive,
        compress: options.compress,
        map: options.map,
        aid: options.aid,
        noMetadata: !options.metadata,
      };

      // Interactive mode for task input
      if (dexOptions.interactive && !dexOptions.task) {
        // TODO: Implement interactive prompt
        spinner.info(chalk.yellow('Interactive mode not yet implemented'));
      }

      // Extract context
      spinner.text = 'Extracting context...';
      const contextEngine = new ContextEngine();
      const context = await contextEngine.extract(dexOptions);

      if (context.changes.length === 0) {
        spinner.warn(chalk.yellow('No changes found'));
        process.exit(0);
      }

      // Format output
      spinner.text = 'Formatting output...';
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
        spinner.succeed(chalk.green('Context copied to clipboard'));
      } else {
        spinner.stop();
        console.log(output);
      }

      // Show summary
      if (!dexOptions.json && !dexOptions.clipboard) {
        console.log('\n' + chalk.dim('─'.repeat(50)));
        console.log(chalk.cyan('Summary:'));
        console.log(chalk.dim(`  Files changed: ${context.scope.filesChanged}`));
        console.log(chalk.dim(`  Lines: +${context.scope.linesAdded} -${context.scope.linesDeleted}`));
        if (dexOptions.clipboard) {
          console.log(chalk.green('\n✓ Context copied to clipboard'));
        }
      }

    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

// Show help if no arguments
if (process.argv.length === 2) {
  program.outputHelp();
}