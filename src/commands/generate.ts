import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AIContextEngine } from '../core/ai-context-engine';
import { ContextExporter } from '../core/context-exporter';
import { OutputManager } from '../utils/output-manager';
import { getAICache } from '../core/ai-cache';
import clipboardy from 'clipboardy';
import { OutputFormat } from '../types';

export interface GenerateOptions {
  dryRun?: boolean;
  export?: OutputFormat;
  clipboard?: boolean;
  maxFiles?: number;
  aiProvider?: string;
  aiModel?: string;
}

export function createGenerateCommand(): Command {
  const command = new Command('generate');

  command
    .description('Generate AI-selected context based on a task description')
    .argument('<task>', 'Task description for AI analysis')
    .option('--dry-run', 'Preview file selection without generating output')
    .option(
      '--export <format>',
      'Export context in specified format (text, markdown, json)',
      'markdown'
    )
    .option('-c, --clipboard', 'Copy output to clipboard')
    .option('--max-files <number>', 'Maximum number of files to select', '20')
    .option('--ai-provider <provider>', 'AI provider to use (anthropic, openai)')
    .option('--ai-model <model>', 'AI model to use')
    .action(async (task: string, options: GenerateOptions) => {
      await generateCommand(task, options);
    });

  return command;
}

/**
 * Extract number of files requested from prompt text
 */
function extractFileCountFromPrompt(prompt: string): number | null {
  const lowerPrompt = prompt.toLowerCase();

  // Look for patterns like "two files", "3 files", "select 5", etc.
  const patterns = [
    /(?:select|choose|pick|find|get)\s+(?:only\s+)?(\d+)(?:\s+files?)?/,
    /(?:only\s+)?(\d+)\s+files?\s+only/,
    /(one|two|three|four|five|six|seven|eight|nine|ten)\s+files?\s+only/,
    /(?:exactly|just|only)\s+(\d+)/,
    /(one|two|three|four|five|six|seven|eight|nine|ten)\s+files?(?:\s+(?:only|max))?/,
  ];

  const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  for (const pattern of patterns) {
    const match = lowerPrompt.match(pattern);
    if (match) {
      const captured = match[1];
      if (/^\d+$/.test(captured)) {
        return parseInt(captured, 10);
      } else if (numberWords[captured]) {
        return numberWords[captured];
      }
    }
  }

  return null;
}

async function generateCommand(task: string, options: GenerateOptions): Promise<void> {
  const spinner = ora('Initializing AI context engine...').start();

  try {
    // Validate task input
    if (!task || task.trim().length === 0) {
      spinner.fail(chalk.red('Error: Task description cannot be empty'));
      process.exit(1);
    }

    // Initialize AI Context Engine
    const aiEngine = new AIContextEngine();
    const codebasePath = process.cwd();

    // Validate export format
    const validFormats: OutputFormat[] = ['text', 'markdown', 'json'];
    const exportFormat = options.export || 'markdown';
    if (!validFormats.includes(exportFormat as OutputFormat)) {
      spinner.fail(
        chalk.red(
          `Invalid export format '${exportFormat}'. Valid formats: ${validFormats.join(', ')}`
        )
      );
      process.exit(1);
    }

    // Parse max files - first try to extract from prompt, then use option, then default
    let maxFiles = 20; // default

    // Try to extract file count from prompt text
    const promptFileCount = extractFileCountFromPrompt(task);
    if (promptFileCount !== null) {
      maxFiles = promptFileCount;
      console.log(chalk.dim(`Detected request for ${maxFiles} files from prompt`));
    } else if (options.maxFiles) {
      maxFiles = parseInt(options.maxFiles.toString(), 10);
      if (isNaN(maxFiles) || maxFiles <= 0) {
        spinner.fail(chalk.red('Invalid max-files value. Must be a positive number.'));
        process.exit(1);
      }
    }

    // Show task being analyzed
    console.log(chalk.cyan('\n📋 Task Analysis'));
    console.log(chalk.white('─'.repeat(50)));
    console.log(chalk.white(`Task: ${task}`));
    console.log(chalk.white('─'.repeat(50)));

    // Analyze codebase with user-provided task
    spinner.text = 'Analyzing codebase with AI...';
    const analysisResult = await aiEngine.analyze({
      prompt: task,
      codebasePath,
      maxFiles,
      aiProvider: options.aiProvider,
      aiModel: options.aiModel,
    });

    // Display analysis summary
    const { summary } = analysisResult;
    spinner.succeed(
      chalk.green('Analysis complete') +
        chalk.dim(
          ` • Found ${summary.selectedFiles} relevant files from ${summary.totalFiles} total`
        )
    );

    // Show priority breakdown
    console.log(chalk.cyan('\nFile Selection Summary:'));
    console.log(chalk.white('─'.repeat(40)));
    console.log(chalk.red(`🔴 High Priority:    ${summary.highPriorityCount} files`));
    console.log(chalk.yellow(`🟠 Medium Priority:  ${summary.mediumPriorityCount} files`));
    console.log(chalk.blue(`🔵 Low Priority:     ${summary.lowPriorityCount} files`));
    console.log(chalk.white('─'.repeat(40)));

    // Show token estimates
    const tokenStr =
      summary.totalTokens >= 1000
        ? `${Math.round(summary.totalTokens / 1000)}k tokens`
        : `${summary.totalTokens} tokens`;
    console.log(chalk.white(`💾 Total Context: ${tokenStr}`));

    if (summary.estimatedCost > 0) {
      console.log(chalk.white(`💰 Estimated Cost: $${summary.estimatedCost.toFixed(4)}`));
    }

    // Show selected files grouped by priority
    console.log(chalk.cyan('\nSelected Files:'));
    console.log(chalk.white('─'.repeat(40)));

    const filesByPriority = {
      high: analysisResult.selections.filter((s) => s.priority === 'high'),
      medium: analysisResult.selections.filter((s) => s.priority === 'medium'),
      low: analysisResult.selections.filter((s) => s.priority === 'low'),
    };

    for (const [priority, files] of Object.entries(filesByPriority)) {
      if (files.length === 0) continue;

      const priorityIcon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟠' : '🔵';
      const priorityColor =
        priority === 'high' ? chalk.red : priority === 'medium' ? chalk.yellow : chalk.blue;

      console.log(priorityColor(`\n${priorityIcon} ${priority.toUpperCase()} PRIORITY:`));
      for (const file of files) {
        const tokenStr =
          file.tokenEstimate >= 1000
            ? `${Math.round(file.tokenEstimate / 1000)}k`
            : `${file.tokenEstimate}`;
        console.log(chalk.white(`  ✓ ${file.file}`) + chalk.dim(` (${tokenStr} tokens)`));
        if (file.reason) {
          console.log(chalk.gray(`    → ${file.reason}`));
        }
      }
    }

    // Handle dry-run mode
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run complete - no output generated'));
      console.log(chalk.dim('Remove --dry-run flag to generate context'));
      return;
    }

    // Ask for confirmation
    console.log(chalk.cyan('\nContinue with context generation?'));
    const { default: readline } = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let confirmed = false;
    try {
      confirmed = await new Promise<boolean>((resolve, reject) => {
        rl.question(chalk.blue('Generate context? [Y/n] '), (answer) => {
          resolve(answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no');
        });

        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          reject(new Error('Input timeout'));
        }, 30000);

        rl.on('close', () => {
          clearTimeout(timeout);
        });
      });
    } finally {
      rl.close();
    }

    if (!confirmed) {
      console.log(chalk.yellow('\nContext generation cancelled.'));
      return;
    }

    // Generate context
    spinner.start('Generating context...');
    const contextExporter = new ContextExporter();
    const context = await contextExporter.export(analysisResult.selections, {
      format: exportFormat as OutputFormat,
      includeContent: true,
      includePriority: true,
      includeReason: true,
    });

    // Handle output
    if (options.clipboard) {
      await clipboardy.write(context);
      spinner.succeed(chalk.green('Context copied to clipboard') + chalk.dim(` • ${tokenStr}`));
    } else {
      // Save to file
      const outputManager = new OutputManager();

      // Create a safe filename from the task description
      const taskSlug = task
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      await outputManager.saveOutput(context, {
        command: 'generate',
        context: taskSlug,
        format: exportFormat as OutputFormat,
      });

      const relativePath = outputManager.getRelativePath({
        command: 'generate',
        context: taskSlug,
        format: exportFormat as OutputFormat,
      });

      spinner.succeed(
        chalk.green('Context saved to ') + chalk.white(relativePath) + chalk.dim(` • ${tokenStr}`)
      );

      // Show agent instruction
      console.log(chalk.dim(`\nFor agents: cat ${relativePath}`));
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.error(error);

    // Cleanup cache before exiting
    try {
      const cache = getAICache();
      cache.dispose();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    process.exit(1);
  } finally {
    // Always cleanup cache to prevent hanging
    try {
      const cache = getAICache();
      cache.dispose();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    // Force exit if process is still hanging
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }
}
