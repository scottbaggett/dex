import { Command, Option } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';
import { XmlFormatter } from '../templates/xml';
import { MarkdownFormatter } from '../templates/markdown';
import { JsonFormatter } from '../templates/json';
import { ExtractedContext, GitChange, DexOptions, OutputFormat, Formatter } from '../types';
import { formatFileSize } from '../utils/file-scanner';
import { FileSelector } from '../utils/file-selector';
import { OutputManager } from '../utils/output-manager';

export function createCombineCommand(): Command {
  const combine = new Command('combine')
    .description('Combine multiple files and directories into a single, LLM-friendly document')
    .argument('[files...]', 'List of file paths and directories to combine (optional if using --select)')
    .addOption(
      new Option('--output-format <format>', 'Output format')
        .default('xml')
        .choices(['xml', 'markdown', 'json'])
    )
    .option('--copy', 'Copy output to clipboard')
    .option('--prompt <text>', 'Custom AI analysis prompt')
    .option('--prompt-template <name>', 'Use prompt template: security, performance, refactor, feature, bugfix, migration, api, testing')
    .option('--no-prompt', 'Disable AI prompt generation')
    .option('--no-metadata', 'Exclude metadata from output')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('--include <patterns>', 'Include file patterns (comma-separated, e.g., "*.ts,*.js")')
    .option('--exclude <patterns>', 'Exclude file patterns (comma-separated, e.g., "*.test.*,*.spec.*")')
    .option('--max-files <number>', 'Maximum number of files to process', '1000')
    .option('--max-depth <number>', 'Maximum directory depth to scan', '10')
    .option('--no-gitignore', 'Do not respect .gitignore patterns')
    .action(async (files: string[], options: any, command: any) => {
      // Merge parent options (including --select)
      const parentOptions = command.parent?.opts() || {};
      const mergedOptions = { ...parentOptions, ...options };
      await combineCommand(files, mergedOptions);
    });

  return combine;
}

async function combineCommand(filePaths: string[], options: any) {
  const spinner = ora('Scanning files...').start();

  try {
    // Handle --select mode without file arguments
    if (options.select && filePaths.length === 0) {
      filePaths.push(process.cwd());
    }

    // If no files provided and not in select mode, show error
    if (filePaths.length === 0) {
      spinner.fail(chalk.red('No files or directories specified'));
      console.error(chalk.red('Usage: dex combine <files...> or dex combine --select'));
      process.exit(1);
    }

    // Parse options
    const includePatterns = options.include ? options.include.split(',').map((p: string) => p.trim()) : [];
    const excludePatterns = options.exclude ? options.exclude.split(',').map((p: string) => p.trim()) : [];
    const maxFiles = parseInt(String(options.maxFiles || '1000'), 10);
    const maxDepth = parseInt(String(options.maxDepth || '10'), 10);
    const respectGitignore = !options.noGitignore;

    // Collect all files from inputs (files and directories)
    const fileSelector = new FileSelector();
    const { files: allFiles, errors } = await fileSelector.collectFiles(filePaths, {
      includePatterns,
      excludePatterns,
      maxFiles,
      maxDepth,
      respectGitignore
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

    // Safety check for too many files
    if (allFiles.length >= maxFiles) {
      spinner.warn(chalk.yellow(`Found ${allFiles.length} files, limited to ${maxFiles}`));
    }

    // Show file count and size info
    const totalSize = allFiles.reduce((sum, filePath) => {
      try {
        return sum + statSync(filePath).size;
      } catch {
        return sum;
      }
    }, 0);

    if (allFiles.length > 50) {
      spinner.warn(chalk.yellow(`Processing ${allFiles.length} files (${formatFileSize(totalSize)}). Consider using --select to choose specific files.`));
    }

    // Handle interactive selection if requested
    let finalFiles = allFiles;
    
    if (options.select) {
      // Check if interactive mode is possible
      if (!process.stdin.isTTY || !process.stdin.setRawMode) {
        spinner.fail(chalk.red('Interactive mode requires a TTY terminal'));
        fileSelector.showTTYError();
        process.exit(1);
      }
      
      spinner.stop();
      
      try {
        // Convert file paths to GitChange objects for the selector
        const fileChanges = fileSelector.filesToGitChanges(allFiles);
        const result = await fileSelector.selectFiles(fileChanges);

        // Convert back to file paths
        finalFiles = result.files.map(change => resolve(change.file));
        
        // Override clipboard option if user pressed 'c'
        if (result.copyToClipboard) {
          options.copy = true;
        }

        spinner.start('Processing selected files...');
      } catch (error) {
        if (error instanceof Error && error.message === 'File selection cancelled') {
          console.log(chalk.yellow('\nFile selection cancelled.'));
          process.exit(0);
        }
        throw error;
      }
    }

    // Read file contents
    spinner.text = chalk.gray(`Reading ${finalFiles.length} files...`);
    const changes: GitChange[] = [];
    const fullFiles = new Map<string, string>();

    for (const filePath of finalFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const relativePath = relative(process.cwd(), filePath);
        
        // Create a GitChange-like object for each file
        const change: GitChange = {
          file: relativePath,
          status: 'added', // Treat all files as "added" for combine operation
          additions: content.split('\n').length,
          deletions: 0,
          diff: '', // No diff for combine operation
        };

        changes.push(change);
        fullFiles.set(relativePath, content);
      } catch (error) {
        errors.push(`Failed to read ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      spinner.warn(chalk.yellow('Some files could not be read'));
      for (const error of errors) {
        console.warn(chalk.yellow(`  ${error}`));
      }
    }

    if (changes.length === 0) {
      spinner.fail(chalk.red('No files could be read'));
      process.exit(1);
    }

    // Create context object
    const totalLines = Array.from(fullFiles.values()).reduce((sum, content) => sum + content.split('\n').length, 0);
    const totalChars = Array.from(fullFiles.values()).reduce((sum, content) => sum + content.length, 0);

    const context: ExtractedContext = {
      changes,
      scope: {
        filesChanged: changes.length,
        functionsModified: 0, // Could be enhanced with AST analysis
        linesAdded: totalLines,
        linesDeleted: 0,
      },
      fullFiles,
      metadata: {
        generated: new Date().toISOString(),
        repository: {
          name: 'combined-files',
          branch: 'local',
          commit: 'local',
        },
        extraction: {
          method: 'combine',
        },
        tokens: {
          estimated: Math.ceil(totalChars / 4), // Rough token estimation
        },
        tool: {
          name: 'dex',
          version: '1.0.0', // Should be read from package.json
        },
      },
    };

    // Create DexOptions for formatting
    const dexOptions: DexOptions = {
      format: options.outputFormat as OutputFormat,
      noMetadata: options.noMetadata,
      prompt: options.prompt,
      promptTemplate: options.promptTemplate,
      noPrompt: options.noPrompt,
      clipboard: options.clipboard,
    };

    // Format output
    const formatToUse = options.outputFormat || 'xml';
    spinner.text = chalk.gray(`Formatting as ${chalk.cyan(formatToUse)}...`);
    let formatter: Formatter;

    switch (formatToUse) {
      case 'xml':
        formatter = new XmlFormatter();
        break;
      case 'json':
        formatter = new JsonFormatter();
        break;
      case 'markdown':
        formatter = new MarkdownFormatter();
        break;
      default:
        throw new Error(`Invalid format: ${options.outputFormat}`);
    }

    const output = formatter.format({ context, options: dexOptions });

    // Handle output
    if (options.output) {
      const { writeFileSync } = await import('fs');
      writeFileSync(options.output, output);
      spinner.succeed(chalk.green(`Combined files written to: ${options.output}`));
    } else if (options.copy) {
      try {
        await clipboardy.write(output);

        // Show enhanced success message with metadata
        const tokenStr = chalk.cyan(`~${context.metadata.tokens.estimated.toLocaleString()} tokens`);
        const filesStr = chalk.yellow(`${context.scope.filesChanged} files`);
        const linesStr = chalk.green(`${context.scope.linesAdded} lines`);
        spinner.succeed(
          chalk.green('Combined files copied to clipboard') +
            chalk.gray(' • ') +
            tokenStr +
            chalk.gray(' • ') +
            filesStr +
            chalk.gray(' • ') +
            linesStr +
            chalk.gray(' • ') +
            chalk.blue(options.outputFormat || 'xml')
        );
      } catch (error) {
        spinner.fail(chalk.red('Failed to copy to clipboard'));
        console.error(chalk.red(`Clipboard error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        console.log(chalk.yellow('Falling back to terminal output:'));
        console.log(output);
      }
    } else {
      // Save to .dex/ directory using OutputManager
      const outputManager = new OutputManager();
      
      // Generate context string for filename
      const contextParts = filePaths.map(p => p.replace(/[^a-zA-Z0-9]/g, '-')).join('-');
      const contextString = contextParts.length > 20 ? contextParts.substring(0, 20) : contextParts;
      
      await outputManager.saveOutput(output, {
        command: 'combine',
        context: contextString,
        format: options.outputFormat || 'xml'
      });
      
      const relativePath = outputManager.getRelativePath({
        command: 'combine',
        context: contextString,
        format: options.outputFormat || 'xml'
      });

      // Format token display
      const tokenCount = context.metadata.tokens.estimated;
      const tokenStr = tokenCount >= 1000 ? `${Math.round(tokenCount / 1000)}k tokens` : `${tokenCount} tokens`;

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