import { resolve, relative } from 'path';
import { statSync, existsSync } from 'fs';
import chalk from 'chalk';
import { GitChange } from '../types';
import { FileScanner } from './file-scanner';
import { GitExtractor } from '../core/git';
import simpleGit from 'simple-git';

export interface FileSelectionOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
  maxDepth?: number;
  respectGitignore?: boolean;
  sortBy?: 'name' | 'updated' | 'size' | 'status';
  sortOrder?: 'asc' | 'desc';
  filterBy?: 'all' | 'staged' | 'unstaged' | 'untracked' | 'modified' | 'added' | 'deleted';
}

export interface EnhancedGitChange extends GitChange {
  fileSize?: number;
  isStaged?: boolean;
  isUnstaged?: boolean;
  isUntracked?: boolean;
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
  private gitExtractor: GitExtractor;

  constructor() {
    this.scanner = new FileScanner();
    this.gitExtractor = new GitExtractor();
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
      respectGitignore = true,
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
            respectGitignore,
          });

          allFiles.push(...scannedFiles.map((f) => f.path));
        } catch (error) {
          errors.push(
            `Failed to scan directory ${inputPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
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
   * Get file size in bytes
   */
  private getFileSize(filePath: string): number {
    try {
      const stats = statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Enhance GitChange objects with additional metadata
   */
  private async enhanceGitChanges(changes: GitChange[]): Promise<EnhancedGitChange[]> {
    try {
      // Get git status info
      const git = simpleGit(process.cwd());
      const status = await git.status();
      const stagedFiles = new Set(status.staged);
      const modifiedFiles = new Set(status.modified);
      const untrackedFiles = new Set(status.not_added);

      return changes.map((change) => {
        const enhanced: EnhancedGitChange = { ...change };

        // Add file size
        const fullPath = resolve(process.cwd(), change.file);
        enhanced.fileSize = this.getFileSize(fullPath);

        // Add git status flags
        enhanced.isStaged = stagedFiles.has(change.file);
        enhanced.isUnstaged = modifiedFiles.has(change.file) && !enhanced.isStaged;
        enhanced.isUntracked = untrackedFiles.has(change.file);

        return enhanced;
      });
    } catch {
      // If git status fails, return changes without enhancement
      return changes.map((change) => ({
        ...change,
        fileSize: this.getFileSize(resolve(process.cwd(), change.file)),
      }));
    }
  }

  /**
   * Filter changes based on options
   */
  private filterChanges(changes: EnhancedGitChange[], filterBy?: string): EnhancedGitChange[] {
    if (!filterBy || filterBy === 'all') {
      return changes;
    }

    switch (filterBy) {
      case 'staged':
        return changes.filter((c) => c.isStaged);
      case 'unstaged':
        return changes.filter((c) => c.isUnstaged);
      case 'untracked':
        return changes.filter((c) => c.isUntracked);
      case 'modified':
        return changes.filter((c) => c.status === 'modified');
      case 'added':
        return changes.filter((c) => c.status === 'added');
      case 'deleted':
        return changes.filter((c) => c.status === 'deleted');
      default:
        return changes;
    }
  }

  /**
   * Sort changes based on options
   */
  private sortChanges(
    changes: EnhancedGitChange[],
    sortBy: string = 'name',
    sortOrder: string = 'asc'
  ): EnhancedGitChange[] {
    const sorted = [...changes].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.file.localeCompare(b.file);
          break;
        case 'updated':
          if (a.lastModified && b.lastModified) {
            comparison = a.lastModified.getTime() - b.lastModified.getTime();
          } else if (a.lastModified) {
            comparison = 1;
          } else if (b.lastModified) {
            comparison = -1;
          }
          break;
        case 'size':
          comparison = (a.fileSize || 0) - (b.fileSize || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
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
          lastModified: stats.mtime,
        });
      } catch (error) {
        console.warn(
          `Warning: Could not stat file ${filePath}:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
        // Add a basic GitChange object without lastModified
        changes.push({
          file: relativePath,
          status: 'added' as const,
          additions: 0,
          deletions: 0,
          diff: '',
        });
      }
    }

    return changes;
  }

  /**
   * Launch interactive file selection mode
   */
  async selectFiles(
    changes: GitChange[],
    options: FileSelectionOptions = {}
  ): Promise<FileSelectionResult> {
    // Enhance changes with additional metadata
    const enhancedChanges = await this.enhanceGitChanges(changes);

    // Apply filtering
    const filteredChanges = this.filterChanges(enhancedChanges, options.filterBy);

    // Apply sorting
    const sortedChanges = this.sortChanges(filteredChanges, options.sortBy, options.sortOrder);

    // Show summary of filtering/sorting
    if (options.filterBy && options.filterBy !== 'all') {
      console.log(
        chalk.blue(
          `Filtered to ${options.filterBy} files: ${sortedChanges.length} of ${changes.length} files`
        )
      );
    }
    if (options.sortBy) {
      console.log(chalk.blue(`Sorted by ${options.sortBy} (${options.sortOrder || 'asc'})`));
    }

    // Check if interactive mode is possible
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      this.showTTYError();
      console.log(chalk.yellow('Falling back to selecting all files in non-interactive mode.'));
      return {
        files: sortedChanges,
        copyToClipboard: false,
      };
    }

    try {
      const { launchInteractiveMode } = await import('../interactive/index.js');
      const result = await launchInteractiveMode({
        changes: sortedChanges as EnhancedGitChange[],
      });

      return {
        files: result.files,
        copyToClipboard: result.copyToClipboard,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Interactive mode cancelled') {
        throw new Error('File selection cancelled');
      }
      throw error;
    }
  }

  /**
   * Format file size to human-readable string
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Get status badge/color for a file change
   */
  private getStatusBadge(change: EnhancedGitChange): string {
    const badges: string[] = [];

    // Git status badges
    if (change.isStaged) {
      badges.push(chalk.green('●'));
    } else if (change.isUnstaged) {
      badges.push(chalk.yellow('●'));
    } else if (change.isUntracked) {
      badges.push(chalk.gray('?'));
    }

    // File status badges
    switch (change.status) {
      case 'added':
        badges.push(chalk.green('+'));
        break;
      case 'modified':
        badges.push(chalk.yellow('M'));
        break;
      case 'deleted':
        badges.push(chalk.red('D'));
        break;
      case 'renamed':
        badges.push(chalk.blue('R'));
        break;
    }

    return badges.join(' ');
  }

  /**
   * Format file info for display
   */
  formatFileInfo(
    change: EnhancedGitChange,
    options?: { showSize?: boolean; showStatus?: boolean }
  ): string {
    const parts: string[] = [];

    // Status badges
    if (options?.showStatus) {
      const badge = this.getStatusBadge(change);
      if (badge) parts.push(badge);
    }

    // File path
    parts.push(chalk.white(change.file));

    // File size
    if (options?.showSize && change.fileSize !== undefined) {
      parts.push(chalk.dim(`(${this.formatFileSize(change.fileSize)})`));
    }

    // Last modified
    if (change.lastModified) {
      const relativeTime = this.getRelativeTime(change.lastModified);
      parts.push(chalk.dim(relativeTime));
    }

    return parts.join(' ');
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
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

  /**
   * Display available sorting and filtering options (for help text)
   */
  static getOptionsHelp(): string {
    const help: string[] = [];

    help.push(chalk.bold('Sorting Options:'));
    help.push('  --sort-by <option>     Sort files by:');
    help.push('    • name               Alphabetical order (default)');
    help.push('    • updated            Last modification time');
    help.push('    • size               File size');
    help.push('    • status             Git status (added/modified/deleted)');
    help.push('  --sort-order <order>   Sort direction: asc (default) or desc');

    help.push('');
    help.push(chalk.bold('Filtering Options:'));
    help.push('  --filter-by <option>   Show only files with status:');
    help.push('    • all                All files (default)');
    help.push('    • staged             Staged files ' + chalk.green('●'));
    help.push('    • unstaged           Unstaged changes ' + chalk.yellow('●'));
    help.push('    • untracked          Untracked files ' + chalk.gray('?'));
    help.push('    • modified           Modified files ' + chalk.yellow('M'));
    help.push('    • added              Added files ' + chalk.green('+'));
    help.push('    • deleted            Deleted files ' + chalk.red('D'));

    help.push('');
    help.push(chalk.bold('Examples:'));
    help.push('  dex extract --select --sort-by updated --sort-order desc');
    help.push('  dex extract --select --filter-by staged --sort-by size');
    help.push('  dex extract --select --filter-by untracked');

    return help.join('\n');
  }
}
