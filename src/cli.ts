#!/usr/bin/env node
import { Command, Option } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { ContextEngine } from './core/context';
import { GitExtractor } from './core/git';
import { SessionManager } from './core/session';
import { MarkdownFormatter } from './templates/markdown';
import { JsonFormatter } from './templates/json';
import { XmlFormatter } from './templates/xml';
import { DexOptions, OutputFormat } from './types';
import { OutputManager } from './utils/output-manager';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { mergeWithConfig } from './core/config';
import { DexHelpFormatter } from './core/help/dex-help';

const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

if (process.argv.includes('--help-extended')) {
  // Remove the custom flag then fall back to Commander's default help
  process.argv = process.argv.filter((a) => a !== '--help-extended');
  program.parse(process.argv);
  program.outputHelp(); // the default
  process.exit(0);
}

program.configureHelp({
  formatHelp: (cmd, helper) => new DexHelpFormatter().formatHelp(cmd, helper),
});

program.name('dex').description(packageJson.description).version(packageJson.version);

// Default command (extract)
program
  .argument('[range]', 'Git commit range (e.g., HEAD~5..HEAD)', '')
  .option('-s, --staged', 'Include only staged changes')
  .option('-a, --all', 'Include both staged and unstaged changes')

  .option('--full <pattern>', 'Include full files matching pattern')
  .option('-p, --path <pattern>', 'Filter by file path pattern')
  .option('-t, --type <types>', 'Filter by file types (comma-separated)')
  .addOption(
    new Option('-f, --format <format>', 'Output format')
      .default('xml')
      .choices(['markdown', 'json', 'xml'])
  )
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('--task <source>', 'Task context (description, file path, URL, or - for stdin)')
  .option('-i, --interactive', 'Interactive mode for task input')
  .option('-u, --include-untracked', 'Include untracked files')
  .option('--untracked-pattern <pattern>', 'Pattern for untracked files to include')
  .option('--optimize <types...>', 'Optimizations: aid, symbols')
  .option('--no-metadata', 'Exclude metadata from output')
  .option('--prompt <text>', 'Custom AI analysis prompt')
  .option(
    '--prompt-template <name>',
    'Use prompt template: security, performance, refactor, feature, bugfix, migration, api, testing'
  )
  .option('--no-prompt', 'Disable AI prompt generation')
  .option('--select', 'Interactive file selection mode')
  .action(async (range, options) => {
    await extractCommand(range, options);
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
import { createDistillCommand } from './commands/distill';
import { createCombineCommand } from './commands/combine';

// Add snapshot command
program.addCommand(createSnapshotCommand());

// Add distill command
program.addCommand(createDistillCommand());

// Add combine command
program.addCommand(createCombineCommand());

// Session command
const sessionCmd = program
  .command('session')
  .description('Manage dex sessions for tracking work');

sessionCmd
  .command('start [description]')
  .description('Start a new session')
  .action(async (description) => {
    const spinner = ora('Starting session...').start();
    try {
      const gitExtractor = new GitExtractor();
      const sessionManager = new SessionManager();
      
      // Check if session already exists
      if (await sessionManager.hasActiveSession()) {
        spinner.fail(chalk.red('A session is already active. End it first with: dex session end'));
        process.exit(1);
      }
      
      // Get current commit and branch
      const [commit, branch] = await Promise.all([
        gitExtractor.getLatestCommit(),
        gitExtractor.getCurrentBranch()
      ]);
      
      // Start session
      const session = await sessionManager.startSession(commit, branch, description);
      
      spinner.succeed(chalk.green('Session started'));
      console.log(chalk.dim(`  ID: ${session.id}`));
      console.log(chalk.dim(`  Branch: ${branch}`));
      console.log(chalk.dim(`  Starting commit: ${commit}`));
      if (description) {
        console.log(chalk.dim(`  Description: ${description}`));
      }
      console.log(chalk.dim(`\nSession now tracking ALL changes (committed and uncommitted)`));
      console.log(chalk.dim(`Use 'dex' to package everything you've worked on`));
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

sessionCmd
  .command('end')
  .description('End the current session')
  .action(async () => {
    const spinner = ora('Ending session...').start();
    try {
      const sessionManager = new SessionManager();
      
      // Check if session exists
      const session = await sessionManager.getCurrentSession();
      if (!session) {
        spinner.fail(chalk.yellow('No active session found'));
        process.exit(1);
      }
      
      // End session
      await sessionManager.endSession();
      
      spinner.succeed(chalk.green('Session ended'));
      
      // Calculate session duration
      const duration = Date.now() - new Date(session.startTime).getTime();
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(chalk.dim(`  Duration: ${hours}h ${minutes}m`));
      if (session.description) {
        console.log(chalk.dim(`  Description: ${session.description}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

sessionCmd
  .command('status')
  .description('Show current session status')
  .action(async () => {
    try {
      const sessionManager = new SessionManager();
      const { active, session } = await sessionManager.getSessionStatus();
      
      if (!active || !session) {
        console.log(chalk.yellow('No active session'));
        console.log(chalk.dim(`\nStart a session with: dex session start [description]`));
        return;
      }
      
      console.log(chalk.green('Active session'));
      console.log(chalk.dim(`  ID: ${session.id}`));
      console.log(chalk.dim(`  Branch: ${session.branch}`));
      console.log(chalk.dim(`  Started: ${new Date(session.startTime).toLocaleString()}`));
      
      // Calculate duration
      const duration = Date.now() - new Date(session.startTime).getTime();
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      console.log(chalk.dim(`  Duration: ${hours}h ${minutes}m`));
      
      if (session.description) {
        console.log(chalk.dim(`  Description: ${session.description}`));
      }
      
      // Show what would be included
      const sessionChanges = await sessionManager.getSessionChanges();
      const totalChanges = sessionChanges.added.length + sessionChanges.modified.length + sessionChanges.deleted.length;
      
      if (totalChanges > 0) {
        console.log(chalk.dim(`\n  Changes since session start:`));
        if (sessionChanges.added.length > 0) {
          console.log(chalk.dim(`    Added: ${sessionChanges.added.length} files`));
        }
        if (sessionChanges.modified.length > 0) {
          console.log(chalk.dim(`    Modified: ${sessionChanges.modified.length} files`));
        }
        if (sessionChanges.deleted.length > 0) {
          console.log(chalk.dim(`    Deleted: ${sessionChanges.deleted.length} files`));
        }
        console.log(chalk.dim(`\n  Run 'dex' to package ALL changes (including uncommitted)`));
      } else {
        console.log(chalk.dim(`\n  No changes since session start`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

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
      prompts = prompts.filter((p) => p.tags && p.tags.some((tag) => filterTags.includes(tag)));
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
        changes: [{ file: 'auth.js', status: 'modified', additions: 20, deletions: 5, diff: '' }],
        scope: { filesChanged: 1, linesAdded: 20, linesDeleted: 5, functionsModified: 2 },
        metadata: {
          repository: { name: 'example-app', branch: 'main', commit: 'abc123' },
          extraction: { depth: 'focused' },
          tokens: { estimated: 500 },
          tool: { name: 'dex', version: '0.1.0' },
          generated: new Date().toISOString(),
        },
      };

      const prompt = PromptGenerator.generate(
        mockContext as any,
        {
          promptTemplate: id,
          format: 'markdown',
        } as any
      );

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
      tags: ['custom'],
      ...(options.extends && { extends: options.extends }),
      instructions: `# ${name} Review\n\nProvide detailed analysis focusing on:\n\n1. **First Focus Area**\n   - Specific check 1\n   - Specific check 2\n\n2. **Second Focus Area**\n   - Specific check 1\n   - Specific check 2\n\nFormat your response as:\n- **Finding**: Description\n- **Severity**: High/Medium/Low\n- **Suggestion**: How to address`,
      examples: [
        {
          input: 'Example issue in code',
          output:
            '**Finding**: Description of issue\\n**Severity**: Medium\\n**Suggestion**: How to fix',
        },
      ],
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
${
  options.extends
    ? `extends: ${options.extends}
`
    : ''
}instructions: |
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

// Helper function to generate context string for filename
function generateContextString(dexOptions: DexOptions, method: string): string {
  if (dexOptions.range) {
    return dexOptions.range;
  }
  if (dexOptions.staged) {
    return 'staged';
  }
  if (dexOptions.all) {
    return 'all';
  }
  // Parse method string to extract meaningful context
  if (method.includes('session')) {
    return 'session';
  }
  if (method.includes('feature branch')) {
    return 'feature-branch';
  }
  return 'current';
}

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

    // Check if range is a snapshot reference
    let isSnapshot = false;

    if (range) {
      // Check for snapshot position pattern: @-1, @-2
      const isSnapshotPosition = range.match(/^@-\d+$/);

      if (isSnapshotPosition || !range.includes('..')) {
        // Try to resolve as snapshot
        const { SnapshotManager } = await import('./core/snapshot');
        const snapshotManager = new SnapshotManager(process.cwd());
        try {
          const snapshot = await snapshotManager.get(range);
          if (snapshot) {
            isSnapshot = true;
          }
        } catch {
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

    // Use format directly
    const format = options.format;

    // Map optimize flags
    const aid = options.optimize?.includes('aid');
    const symbols = options.optimize?.includes('symbols');

    // Parse options
    let dexOptions: DexOptions = {
      range: isSnapshot ? undefined : range,
      snapshot: isSnapshot ? range : undefined,
      isSnapshot,
      staged: options.staged,
      all: options.all,
      full: options.full,
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
      prompt: options.prompt,
      promptTemplate: options.promptTemplate,
      noPrompt: options.prompt === false,
    };

    // Merge with config file defaults
    dexOptions = mergeWithConfig(dexOptions);

    // Validate format after config merge
    const validFormats = ['markdown', 'json', 'xml'];
    if (dexOptions.format && !validFormats.includes(dexOptions.format)) {
      spinner.fail(
        chalk.red(
          `Error: Invalid format '${dexOptions.format}'. Valid formats are: markdown, json, xml`
        )
      );
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

    // Handle interactive selection if requested - do this BEFORE context extraction
    if (options.select) {
      // Check if interactive mode is possible
      if (!process.stdin.isTTY || !process.stdin.setRawMode) {
        spinner.fail(chalk.red('Interactive mode requires a TTY terminal'));
        const { FileSelector } = await import('./utils/file-selector');
        const fileSelector = new FileSelector();
        fileSelector.showTTYError();
        process.exit(1);
      }
      
      spinner.text = chalk.gray('Scanning files for selection...');
      
      try {
        const { FileSelector } = await import('./utils/file-selector');
        const fileSelector = new FileSelector();
        
        // Collect all files in the repository (similar to combine command)
        const { files: allFiles, errors } = await fileSelector.collectFiles([process.cwd()], {
          excludePatterns: [
            '.git/**',
            '.dex/**',
            'node_modules/**',
            'dist/**',
            'build/**',
            '.next/**',
            '.nuxt/**',
            '.cache/**',
            '.DS_Store',
            '*.log',
            'coverage/**',
            '.env.local',
            '.env.*.local',
            'vendor/**',
            '__pycache__/**',
            '*.pyc',
            '.pytest_cache/**',
            'target/**',
            'Cargo.lock',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml'
          ],
          maxFiles: 10000,
          maxDepth: 20,
          respectGitignore: true
        });

        if (errors.length > 0) {
          spinner.warn(chalk.yellow('Some paths had issues:'));
          for (const error of errors) {
            console.warn(chalk.yellow(`  ${error}`));
          }
        }

        if (allFiles.length === 0) {
          spinner.fail(chalk.red('No valid files found'));
          process.exit(1);
        }

        spinner.stop();

        // Convert to GitChange objects for selection
        const fileChanges = fileSelector.filesToGitChanges(allFiles);
        const result = await fileSelector.selectFiles(fileChanges);

        // Override clipboard option if user pressed 'c'
        if (result.copyToClipboard) {
          dexOptions.clipboard = true;
        }

        // Update dexOptions to include selected files for context extraction
        dexOptions.selectedFiles = result.files.map(change => change.file);

        spinner.start('Extracting context from selected files...');
      } catch (error) {
        if (error instanceof Error && error.message === 'File selection cancelled') {
          console.log(chalk.yellow('\nFile selection cancelled.'));
          process.exit(0);
        }
        throw error;
      }
    }

    // Extract context (either from git changes or selected files)
    spinner.text = chalk.gray('Extracting context...');
    const startTime = Date.now();
    const { SessionManager } = await import('./core/session');
    const sessionManager = new SessionManager();
    const contextEngine = new ContextEngine(gitExtractor, sessionManager);
    let context = await contextEngine.extract(dexOptions);
    const extractionTime = Date.now() - startTime;

    if (context.changes.length === 0) {
      spinner.warn(
        chalk.yellow('No changes found') + chalk.gray(' - try --staged or --all')
      );
      process.exit(0);
    }

    // Show detection feedback message with progress bar
    if (context.metadata.extraction.method) {
      // Calculate progress bar
      let progressBar = '';
      let compressionPercent = 0;
      if (context.tokenSavings && context.tokenSavings.percentSaved > 0) {
        compressionPercent = context.tokenSavings.percentSaved;
        const filled = Math.round(compressionPercent / 10);
        const empty = 10 - filled;
        progressBar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
      }

      // Format the main message
      let message =
        chalk.white('Packaged ') +
        chalk.white(`${context.scope.filesChanged} ${context.metadata.extraction.method}`);

      if (progressBar) {
        message +=
          ' ' +
          chalk.dim('[') +
          progressBar +
          chalk.dim(']') +
          ' ' +
          chalk.white(`${compressionPercent}% compression`);
      }

      // Add timing
      message += chalk.dim(` in ${extractionTime}ms`);

      spinner.succeed(message);

      // Show skipped files if any
      if (context.additionalContext?.notIncluded && context.additionalContext.notIncluded > 0) {
        console.log(
          chalk.yellow('Skipped ') +
            chalk.white(`${context.additionalContext.notIncluded} unstaged files`) +
            chalk.dim(' (use ') +
            chalk.white('--all') +
            chalk.dim(' to include)')
        );
      }

      spinner.start(); // Restart spinner for formatting
    }

    // Update spinner with extraction info
    spinner.text = chalk.gray(`Processing ${chalk.yellow(context.scope.filesChanged)} files...`);

    // Format output
    spinner.text = chalk.gray(`Formatting as ${chalk.cyan(dexOptions.format || 'xml')}...`);
    let formatter;
    switch (dexOptions.format || 'xml') {
      case 'json':
        formatter = new JsonFormatter();
        break;
      case 'xml':
        formatter = new XmlFormatter();
        break;
      case 'markdown':
        formatter = new MarkdownFormatter();
        break;
      default:
        // This should never happen due to validation above
        throw new Error(`Invalid format: ${dexOptions.format}`);
    }

    const output = formatter.format({ context, options: dexOptions });

    // Generate context string for filename
    const contextString = generateContextString(dexOptions, context.metadata.extraction.method || 'default');

    // Handle output
    if (dexOptions.clipboard) {
      await clipboardy.write(output);

      // Format token display
      const tokenCount = context.metadata.tokens.estimated;
      const tokenStr =
        tokenCount >= 1000 ? `${Math.round(tokenCount / 1000)}k tokens` : `${tokenCount} tokens`;

      spinner.succeed(
        chalk.green('Copied to clipboard') + chalk.dim(' • ') + chalk.white(tokenStr)
      );
    } else {
      // Save to file instead of printing to console
      const outputManager = new OutputManager();
      await outputManager.saveOutput(output, {
        command: 'extract',
        context: contextString,
        format: dexOptions.format || 'xml'
      });
      
      const relativePath = outputManager.getRelativePath({
        command: 'extract',
        context: contextString,
        format: dexOptions.format || 'xml'
      });

      // Format token display
      const tokenCount = context.metadata.tokens.estimated;
      const tokenStr =
        tokenCount >= 1000 ? `${Math.round(tokenCount / 1000)}k tokens` : `${tokenCount} tokens`;

      spinner.succeed(
        chalk.green('Saved to ') + chalk.white(relativePath) + chalk.dim(' • ') + chalk.white(tokenStr)
      );

      // Show agent instruction
      console.log(chalk.dim(`\nFor agents: cat ${relativePath}`));
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
