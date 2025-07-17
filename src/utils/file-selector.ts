import { resolve, relative } from 'path';
import { statSync, existsSync } from 'fs';
import chalk from 'chalk';
import { GitChange } from '../types';
import { FileScanner } from './file-scanner';

export interface FileSelectionOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
  maxDepth?: number;
  respectGitignore?: boolean;
}

export interface FileSelectionResult {
  files: GitChange[];
  copyToClipboard: boolean;
}

/**
 * Shared utility for file selection across all commands
 */
export class FileSelector {
  private scanner: FileScanner;

  constructor() {
    this.scanner = new FileScanner();
  }

  /**
   * Collect files from input paths (files and directories)
   */
  async collectFiles(
    inputPaths: string[],
    options: FileSelectionOptions = {}
  ): Promise<{ files: string[]; errors: string[] }> {
    const {
      includePatterns = [],
      excludePatterns = [],
      maxFiles = 1000,
      maxDepth = 10,
      respectGitignore = true
    } = options;

    const allFiles: string[] = [];
    const errors: string[] = [];

    for (const inputPath of inputPaths) {
      const resolvedPath = resolve(inputPath);
      
      if (!existsSync(resolvedPath)) {
        errors.push(`Path not found: ${inputPath}`);
        continue;
      }

      const stat = statSync(resolvedPath);
      
      if (stat.isFile()) {
        // Single file
        allFiles.push(resolvedPath);
      } else if (stat.isDirectory()) {
        // Directory - scan for files
        try {
          const scannedFiles = await this.scanner.scan(resolvedPath, {
            includePatterns,
            excludePatterns,
            maxFiles: maxFiles - allFiles.length, // Remaining file limit
            maxDepth,
            respectGitignore
          });
          
          allFiles.push(...scannedFiles.map(f => f.path));
        } catch (error) {
          errors.push(`Failed to scan directory ${inputPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        errors.push(`Not a file or directory: ${inputPath}`);
      }
    }

    // Safety check for too many files
    if (allFiles.length > maxFiles) {
      allFiles.splice(maxFiles);
    }

    return { files: allFiles, errors };
  }

  /**
   * Convert file paths to GitChange objects for interactive selection
   */
  filesToGitChanges(filePaths: string[]): GitChange[] {
    const changes: GitChange[] = [];
    
    for (const filePath of filePaths) {
      const relativePath = relative(process.cwd(), filePath);
      
      try {
        const stats = statSync(filePath);
        
        // Skip directories - they shouldn't be in the file list but let's be safe
        if (stats.isDirectory()) {
          console.warn(`Warning: Skipping directory ${filePath}`);
          continue;
        }
        
        changes.push({
          file: relativePath,
          status: 'added' as const,
          additions: 0, // Will be calculated after reading if needed
          deletions: 0,
          diff: '',
          lastModified: stats.mtime
        });
      } catch (error) {
        console.warn(`Warning: Could not stat file ${filePath}:`, error instanceof Error ? error.message : 'Unknown error');
        // Add a basic GitChange object without lastModified
        changes.push({
          file: relativePath,
          status: 'added' as const,
          additions: 0,
          deletions: 0,
          diff: ''
        });
      }
    }
    
    return changes;
  }

  /**
   * Launch interactive file selection mode
   */
  async selectFiles(changes: GitChange[]): Promise<FileSelectionResult> {
    // Check if interactive mode is possible
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      throw new Error('Interactive mode requires a TTY terminal');
    }
    
    try {
      const { launchInteractiveMode } = await import('../interactive/index.js');
      const result = await launchInteractiveMode({
        changes,
      });

      return {
        files: result.files,
        copyToClipboard: result.copyToClipboard
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Interactive mode cancelled') {
        throw new Error('File selection cancelled');
      }
      throw error;
    }
  }

  /**
   * Show TTY error message with helpful context
   */
  showTTYError() {
    console.log(chalk.red('Interactive mode requires a TTY terminal'));
    console.log(chalk.yellow('Interactive mode is not available in this environment.'));
    console.log(chalk.yellow('This can happen when:'));
    console.log(chalk.yellow('  • Running in a non-interactive shell'));
    console.log(chalk.yellow('  • Output is piped or redirected'));
    console.log(chalk.yellow('  • Running in some CI/CD environments'));
    console.log(chalk.yellow('\nTry running without --select or in a proper terminal.'));
  }
}