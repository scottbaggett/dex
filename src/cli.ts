#!/usr/bin/env node
import { Command, Option } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { ContextEngine } from './core/context';
import { GitExtractor } from './core/git';
import { MarkdownFormatter } from './templates/markdown';
import { JsonFormatter } from './templates/json';
import { ClaudeFormatter } from './templates/claude';
import { GptFormatter } from './templates/gpt';
import { GeminiFormatter } from './templates/gemini';
import { GrokFormatter } from './templates/grok';
import { LlamaFormatter } from './templates/llama';
import { MistralFormatter } from './templates/mistral';
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
  .addOption(
    new Option('-f, --format <format>', 'Output format')
      .default('markdown')
      .choices(['markdown', 'json', 'claude', 'gpt', 'gemini', 'grok', 'llama', 'mistral', 'pr'])
  )
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('--task <source>', 'Task context (description, file path, URL, or - for stdin)')
  .option('-i, --interactive', 'Interactive mode for task input')
  .option('--select', 'Interactive file selection mode')
  .option('-u, --include-untracked', 'Include untracked files')
  .option('--untracked-pattern <pattern>', 'Pattern for untracked files to include')
  .option('--optimize <types...>', 'Optimizations: aid, symbols')
  .option('--no-metadata', 'Exclude metadata from output')
  .option('--prompt <text>', 'Custom AI analysis prompt')
  .option('--prompt-template <name>', 'Use prompt template: security, performance, refactor, feature, bugfix, migration, api, testing')
  .option('--no-prompt', 'Disable AI prompt generation')
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
  .addOption(
    new Option('-f, --format <format>', 'Output format')
      .default('markdown')
      .choices(['markdown', 'json', 'claude', 'gpt', 'gemini', 'grok', 'llama', 'mistral', 'pr'])
  )
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('--task <source>', 'Task context (description, file path, URL, or - for stdin)')
  .option('-i, --interactive', 'Interactive mode for task input')
  .option('--select', 'Interactive file selection mode')
  .option('-u, --include-untracked', 'Include untracked files')
  .option('--untracked-pattern <pattern>', 'Pattern for untracked files to include')
  .option('--optimize <types...>', 'Optimizations: aid, symbols')
  .option('--no-metadata', 'Exclude metadata from output')
  .option('--prompt <text>', 'Custom AI analysis prompt')
  .option('--prompt-template <name>', 'Use prompt template: security, performance, refactor, feature, bugfix, migration, api, testing')
  .option('--no-prompt', 'Disable AI prompt generation')
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

// Import snapshot command at the top level
import { createSnapshotCommand } from './commands/snapshot';

// Add snapshot command
program.addCommand(createSnapshotCommand());

// Prompts command with subcommands
const promptsCmd = program
  .command('prompts')
  .description('Manage prompt templates')
  .action(() => {
    // Default action shows help
    promptsCmd.outputHelp();
  });

// List prompts subcommand
promptsCmd
  .command('list')
  .alias('ls')
  .description('List all available prompt templates')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    const { PromptLoader } = await import('./core/prompt-loader');
    const loader = PromptLoader.getInstance();
    let prompts = loader.getAllPrompts();
    
    // Filter by tags if specified
    if (options.tags) {
      const filterTags = options.tags.split(',').map((t: string) => t.trim());
      prompts = prompts.filter(p => 
        p.tags && p.tags.some(tag => filterTags.includes(tag))
      );
    }
    
    if (prompts.length === 0) {
      console.log(chalk.yellow('\nNo prompt templates found matching criteria.\n'));
      return;
    }
    
    console.log(chalk.cyan.bold('\nAvailable Prompt Templates:\n'));
    
    for (const prompt of prompts) {
      console.log(chalk.green.bold(`${prompt.id}`) + chalk.gray(' - ') + chalk.white(prompt.name));
      console.log(chalk.gray(`  ${prompt.description}`));
      
      if (options.verbose || (prompt.tags && prompt.tags.length > 0)) {
        if (prompt.tags && prompt.tags.length > 0) {
          console.log(chalk.gray('  Tags: ') + chalk.blue(prompt.tags.join(', ')));
        }
        if (prompt.extends) {
          console.log(chalk.gray('  Extends: ') + chalk.cyan(prompt.extends));
        }
        if (prompt.llm && options.verbose) {
          console.log(chalk.gray('  Recommended for: ') + chalk.blue(prompt.llm.join(', ')));
        }
      }
      console.log();
    }
    
    console.log(chalk.gray('Use: dex --prompt-template <id>\n'));
  });

// Show prompt template details
promptsCmd
  .command('show <id>')
  .description('Show detailed prompt template information and preview')
  .option('-e, --example', 'Show with example context')
  .action(async (id, options) => {
    const { PromptLoader } = await import('./core/prompt-loader');
    const { PromptGenerator } = await import('./core/prompts');
    const loader = PromptLoader.getInstance();
    const template = loader.getPrompt(id);
    
    if (!template) {
      console.error(chalk.red(`\nPrompt template '${id}' not found.\n`));
      console.log(chalk.gray('Run "dex prompts list" to see available templates.\n'));
      process.exit(1);
    }
    
    console.log(chalk.cyan.bold(`\nPrompt Template: ${template.name}\n`));
    console.log(chalk.blue('ID:') + ' ' + chalk.green.bold(template.id));
    console.log(chalk.blue('Description:') + ' ' + template.description);
    
    if (template.tags && template.tags.length > 0) {
      console.log(chalk.blue('Tags:') + ' ' + chalk.gray(template.tags.join(', ')));
    }
    
    if (template.extends) {
      console.log(chalk.blue('Extends:') + ' ' + chalk.cyan(template.extends));
    }
    
    if (template.llm && template.llm.length > 0) {
      console.log(chalk.blue('Recommended for:') + ' ' + chalk.gray(template.llm.join(', ')));
    }
    
    console.log(chalk.blue.bold('\nPrompt Instructions:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(template.instructions);
    console.log(chalk.gray('─'.repeat(60)));
    
    if (template.examples && template.examples.length > 0) {
      console.log(chalk.yellow('\nExamples:'));
      for (const example of template.examples) {
        console.log(chalk.gray('\nInput:'), example.input);
        console.log(chalk.gray('Output:'), example.output);
        if (example.explanation) {
          console.log(chalk.gray('Explanation:'), example.explanation);
        }
      }
    }
    
    if (options.example) {
      console.log(chalk.yellow('\nExample with sample context:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      // Create mock context
      const mockContext = {
        changes: [
          { file: 'auth.js', status: 'modified', additions: 20, deletions: 5, diff: '' }
        ],
        scope: { filesChanged: 1, linesAdded: 20, linesDeleted: 5, functionsModified: 2 },
        metadata: {
          repository: { name: 'example-app', branch: 'main', commit: 'abc123' },
          extraction: { depth: 'focused' },
          tokens: { estimated: 500 },
          tool: { name: 'dex', version: '0.1.0' },
          generated: new Date().toISOString()
        }
      };
      
      const prompt = PromptGenerator.generate(mockContext as any, { 
        promptTemplate: id,
        format: 'markdown'
      } as any);
      
      console.log(prompt);
      console.log(chalk.gray('─'.repeat(60)));
    }
    
    console.log(chalk.gray('\nUse this template: dex --prompt-template ' + id + '\n'));
  });

// Initialize new prompt template
promptsCmd
  .command('init <name>')
  .description('Create a new prompt template')
  .option('-e, --extends <base>', 'Extend from existing prompt template')
  .option('-o, --output <path>', 'Output path (default: show in console)')
  .action(async (name, options) => {
    const { PromptLoader } = await import('./core/prompt-loader');
    const loader = PromptLoader.getInstance();
    
    // Validate base prompt if extending
    if (options.extends) {
      const basePrompt = loader.getPrompt(options.extends);
      if (!basePrompt) {
        console.error(chalk.red(`\nBase prompt template '${options.extends}' not found.\n`));
        process.exit(1);
      }
    }
    
    // Convert name to id format (lowercase, hyphenated)
    const id = name.toLowerCase().replace(/\s+/g, '-');
    
    const template = {
      name: name,
      description: `Custom ${name} prompt template`,
      tags: ["custom"],
      ...(options.extends && { extends: options.extends }),
      instructions: `# ${name} Review\n\nProvide detailed analysis focusing on:\n\n1. **First Focus Area**\n   - Specific check 1\n   - Specific check 2\n\n2. **Second Focus Area**\n   - Specific check 1\n   - Specific check 2\n\nFormat your response as:\n- **Finding**: Description\n- **Severity**: High/Medium/Low\n- **Suggestion**: How to address`,
      examples: [
        {
          input: "Example issue in code",
          output: "**Finding**: Description of issue\\n**Severity**: Medium\\n**Suggestion**: How to fix"
        }
      ]
    };
    
    const output = JSON.stringify(template, null, 2);
    
    if (options.output) {
      const { writeFileSync } = await import('fs');
      const outputPath = options.output.endsWith('.json') 
        ? options.output 
        : `${options.output}/${id}.json`;
        
      try {
        writeFileSync(outputPath, output);
        console.log(chalk.green(`\n✓ Created prompt template at: ${outputPath}\n`));
      } catch (error) {
        console.error(chalk.red(`\nFailed to write file: ${error}\n`));
        process.exit(1);
      }
    } else {
      console.log(chalk.cyan.bold(`\nPrompt Template for '${name}':\n`));
      console.log(chalk.gray('Save this as a .yml file in your prompts/ directory:\n'));
      console.log(chalk.yellow(`# ${id}.yml`));
      const yamlOutput = `name: ${name}
description: ${template.description}
tags:
  - custom
${options.extends ? `extends: ${options.extends}
` : ''}instructions: |
  ${template.instructions.replace(/\n/g, '\n  ')}
examples:
  - input: "Example issue in code"
    output: |
      **Finding**: Description of issue
      **Severity**: Medium
      **Suggestion**: How to fix`;
      console.log(yamlOutput);
      console.log(chalk.gray('\nOr add to your .dexrc for inline configuration.\n'));
    }
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
      console.log('  dex -f claude          Format for Claude AI (XML-structured)');
      console.log('  dex --task "Bug fix"   Add task context');
      console.log('  dex -i                 Interactive task input\n');

      console.log(chalk.yellow('Advanced Usage:'));
      console.log('  dex --full "*.ts"      Include full TypeScript files');
      console.log('  dex -d extended        Maximum context extraction');
      console.log('  dex -u                 Include new uncommitted files');
      console.log('  dex -p "src/**"        Filter to src directory');
      console.log('  dex -t ts,tsx          Filter to TypeScript files');
      console.log('  dex --select           Interactive file selection\n');

      console.log(chalk.yellow('AI Prompt Options:'));
      console.log('  dex --prompt-template security  Security-focused review');
      console.log('  dex --prompt-template perf      Performance analysis');
      console.log('  dex --prompt "Custom prompt"    Use custom analysis prompt');
      console.log('  dex --no-prompt                 Disable prompt generation');
      console.log('  dex prompts list                Browse available prompt templates');
      console.log('  dex prompts show <id>           Preview a specific prompt template');
      console.log('  dex prompts init <name>         Create custom prompt template\n');

      console.log(chalk.yellow('Output Formats:'));
      console.log('  markdown               Human-readable format (default)');
      console.log('  json                   Structured data for tools/agents');
      console.log('  claude                 XML-structured for Claude AI');
      console.log('  gpt                    Optimized for GPT with CoT prompts');
      console.log('  gemini                 End-loaded context with few-shot examples');
      console.log('  grok                   JSON schemas for structured output');
      console.log('  llama                  Uses [INST] tags for instruction separation');
      console.log('  mistral                Concise format with [INST] delimiters');
      console.log('  pr                     GitHub pull request format\n');

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

    // Check if range is a time-based or snapshot reference
    let isSnapshot = false;
    let isTimeRange = false;
    
    if (range) {
      // Check for time-based pattern: @2h, @30m, @1d
      const isTimePattern = range.match(/^@\d+[mhdwM]$/);
      
      // Check for snapshot position pattern: @-1, @-2
      const isSnapshotPosition = range.match(/^@-\d+$/);
      
      if (isTimePattern) {
        // Time-based file changes
        isTimeRange = true;
      } else if (isSnapshotPosition || !range.includes('..')) {
        // Try to resolve as snapshot
        const { SnapshotManager } = await import('./core/snapshot');
        const snapshotManager = new SnapshotManager(process.cwd());
        try {
          const snapshot = await snapshotManager.get(range);
          if (snapshot) {
            isSnapshot = true;
          }
        } catch (err) {
          // Not a snapshot, continue as git ref
        }
      }
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
      range: isSnapshot || isTimeRange ? undefined : range,
      snapshot: isSnapshot ? range : undefined,
      isSnapshot,
      timeRange: isTimeRange ? range.substring(1) : undefined, // Remove @ prefix
      isTimeRange,
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
      select: options.select,
      aid,
      symbols,
      noMetadata: !options.metadata,
      prompt: options.prompt,
      promptTemplate: options.promptTemplate,
      noPrompt: options.prompt === false,
    };

    // Merge with config file defaults
    dexOptions = mergeWithConfig(dexOptions);

    // Validate format after config merge
    const validFormats = ['markdown', 'json', 'claude', 'gpt', 'gemini', 'grok', 'llama', 'mistral', 'github-pr'];
    if (dexOptions.format && !validFormats.includes(dexOptions.format)) {
      spinner.fail(chalk.red(`Error: Invalid format '${dexOptions.format}'. Valid formats are: markdown, json, claude, gpt, gemini, grok, llama, mistral, pr`));
      process.exit(1);
    }

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
    let context = await contextEngine.extract(dexOptions);

    if (context.changes.length === 0) {
      spinner.warn(
        chalk.yellow('No changes found') + chalk.gray(' - try --staged or --since=<branch>')
      );
      process.exit(0);
    }

    // Launch interactive file selection mode if requested
    if (dexOptions.select && !dexOptions.path && !dexOptions.type) {
      spinner.stop();
      
      try {
        const { launchInteractiveMode } = await import('./interactive/index.js');
        const selectedChanges = await launchInteractiveMode({
          changes: context.changes
        });
        
        // Update context with selected files
        context = {
          ...context,
          changes: selectedChanges,
          scope: {
            filesChanged: selectedChanges.length,
            functionsModified: 0,
            linesAdded: selectedChanges.reduce((sum, c) => sum + c.additions, 0),
            linesDeleted: selectedChanges.reduce((sum, c) => sum + c.deletions, 0),
          }
        };
        
        // Re-estimate tokens after selection
        const charCount = selectedChanges.reduce((sum, change) => sum + change.diff.length, 0);
        context.metadata.tokens.estimated = Math.ceil(charCount / 4);
        
        spinner.start('Processing selection...');
      } catch (error) {
        if (error instanceof Error && error.message === 'Interactive mode cancelled') {
          console.log(chalk.yellow('\nInteractive mode cancelled.'));
          process.exit(0);
        }
        throw error;
      }
    }

    // Update spinner with extraction info
    spinner.text = chalk.gray(`Processing ${chalk.yellow(context.scope.filesChanged)} files...`);

    // Format output
    spinner.text = chalk.gray(`Formatting as ${chalk.cyan(dexOptions.format || 'markdown')}...`);
    let formatter;
    switch (dexOptions.format || 'markdown') {
      case 'json':
        formatter = new JsonFormatter();
        break;
      case 'claude':
        formatter = new ClaudeFormatter();
        break;
      case 'gpt':
        formatter = new GptFormatter();
        break;
      case 'gemini':
        formatter = new GeminiFormatter();
        break;
      case 'grok':
        formatter = new GrokFormatter();
        break;
      case 'llama':
        formatter = new LlamaFormatter();
        break;
      case 'mistral':
        formatter = new MistralFormatter();
        break;
      case 'markdown':
        formatter = new MarkdownFormatter();
        break;
      default:
        // This should never happen due to validation above
        throw new Error(`Invalid format: ${dexOptions.format}`);
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
