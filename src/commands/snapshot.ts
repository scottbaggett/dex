/* test change */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SnapshotManager } from '../core/snapshot';
import { formatRelativeTime, formatFileSize } from '../utils/format';
import { FileSelector } from '../utils/file-selector';
import { SnapshotOptions } from '../types';

export function createSnapshotCommand(): Command {
  const snapshot = new Command('snapshot').description(
    'Manage code snapshots for efficient change tracking'
  );

  // Create subcommand
  snapshot
    .command('create [name]')
    .description('Create a new snapshot of the current state')
    .option('-m, --message <message>', 'Snapshot description')
    .option('-t, --tags <tags>', 'Comma-separated tags', (value) =>
      value.split(',').map((t) => t.trim())
    )
    .option('-p, --path <path>', 'Specific path to snapshot')
    .option('--include-untracked', 'Include untracked files')
    .action(async (name, options, command) => {
      // Merge parent options (including --select)
      // For nested commands, we need to go up two levels: create -> snapshot -> main
      const snapshotCommand = command.parent;
      const mainCommand = snapshotCommand?.parent;
      const parentOptions = mainCommand?.opts() || {};
      const mergedOptions = { ...parentOptions, ...options };
      
      const manager = new SnapshotManager(process.cwd());

      let snapshotOptions: SnapshotOptions = {
        message: mergedOptions.message || name,
        tags: mergedOptions.tags,
        path: mergedOptions.path,
        includeUntracked: mergedOptions.includeUntracked,
      };

      // Handle file selection if requested
      if (mergedOptions.select) {
        // Check if interactive mode is possible
        if (!process.stdin.isTTY || !process.stdin.setRawMode) {
          console.error(chalk.red('Interactive mode requires a TTY terminal'));
          const fileSelector = new FileSelector();
          fileSelector.showTTYError();
          process.exit(1);
        }
        
        const spinner = ora('Collecting files...').start();
        
        try {
          // Use FileSelector to collect and select files
          const fileSelector = new FileSelector();
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

          // Convert back to file paths and add to snapshot options
          const selectedFiles = result.files.map(change => change.file);
          snapshotOptions = {
            message: snapshotOptions.message,
            tags: snapshotOptions.tags,
            path: snapshotOptions.path,
            includeUntracked: snapshotOptions.includeUntracked,
            selectedFiles // Add selected files to options
          };
        } catch (error) {
          if (error instanceof Error && error.message === 'File selection cancelled') {
            console.log(chalk.yellow('\nFile selection cancelled.'));
            process.exit(0);
          }
          throw error;
        }
      }

      // Get file count first for warning
      const spinner = ora('Analyzing files...').start();

      try {
        const id = await manager.create(snapshotOptions);
        const snapshot = await manager.get(id);

        if (snapshot && snapshot.metadata.filesCount > 1000) {
          spinner.warn(chalk.yellow(`Created large snapshot: ${chalk.bold(id)}`));
          console.log(
            chalk.yellow(`  ⚠️  Warning: ${snapshot.metadata.filesCount} files included!`)
          );
          console.log(chalk.yellow(`  Consider using -p flag to limit scope or check .gitignore`));
        } else {
          spinner.succeed(chalk.green(`Created snapshot: ${chalk.bold(id)}`));
        }

        if (snapshot) {
          console.log(chalk.gray(`  Files: ${snapshot.metadata.filesCount}`));
          console.log(chalk.gray(`  Size: ${formatFileSize(snapshot.metadata.totalSize)}`));
          if (snapshot.metadata.tags?.length) {
            console.log(chalk.gray(`  Tags: ${snapshot.metadata.tags.join(', ')}`));
          }
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to create snapshot'));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // List subcommand
  snapshot
    .command('list')
    .alias('ls')
    .description('List all snapshots')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)', (value) =>
      value.split(',').map((t) => t.trim())
    )
    .option('-n, --limit <limit>', 'Limit number of results', parseInt)
    .action(async (options) => {
      try {
        const manager = new SnapshotManager(process.cwd());
        const snapshots = await manager.list({
          tags: options.tags,
          limit: options.limit,
        });

        if (snapshots.length === 0) {
          console.log(chalk.yellow('No snapshots found.'));
          return;
        }

        console.log(chalk.cyan('\nSnapshots:\n'));

        for (const snapshot of snapshots) {
          const time = formatRelativeTime(new Date(snapshot.time));
          console.log(chalk.bold(`${snapshot.id}`) + chalk.gray(` (${time})`));

          if (snapshot.description) {
            console.log(`  ${snapshot.description}`);
          }

          console.log(
            chalk.gray(
              `  Files: ${snapshot.filesCount}, Size: ${formatFileSize(snapshot.totalSize)}`
            )
          );

          if (snapshot.tags?.length) {
            console.log(chalk.gray(`  Tags: ${snapshot.tags.join(', ')}`));
          }

          console.log();
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // View subcommand
  snapshot
    .command('view <id>')
    .description('View details of a specific snapshot')
    .action(async (id) => {
      try {
        const manager = new SnapshotManager(process.cwd());
        const snapshot = await manager.get(id);

        if (!snapshot) {
          console.error(chalk.red(`Snapshot not found: ${id}`));
          process.exit(1);
        }

        console.log(chalk.cyan('\nSnapshot Details:\n'));
        console.log(chalk.bold('ID:'), snapshot.metadata.id);
        console.log(chalk.bold('Time:'), new Date(snapshot.metadata.time).toLocaleString());

        if (snapshot.metadata.description) {
          console.log(chalk.bold('Description:'), snapshot.metadata.description);
        }

        if (snapshot.metadata.tags?.length) {
          console.log(chalk.bold('Tags:'), snapshot.metadata.tags.join(', '));
        }

        console.log(chalk.bold('Files:'), snapshot.metadata.filesCount);
        console.log(chalk.bold('Total Size:'), formatFileSize(snapshot.metadata.totalSize));

        console.log(chalk.cyan('\nFile List:'));
        const files = Object.entries(snapshot.tree.files).sort(([a], [b]) => a.localeCompare(b));

        for (const [path, info] of files.slice(0, 20)) {
          console.log(chalk.gray(`  ${path} (${formatFileSize(info.size)})`));
        }

        if (files.length > 20) {
          console.log(chalk.gray(`  ... and ${files.length - 20} more files`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Diff subcommand
  snapshot
    .command('diff <from> [to]')
    .description('Show differences between snapshots or current state')
    .action(async (from, to) => {
      const spinner = ora('Calculating differences...').start();

      try {
        const manager = new SnapshotManager(process.cwd());
        const changes = await manager.diff(from, to);

        spinner.stop();

        if (changes.length === 0) {
          console.log(chalk.yellow('No changes found.'));
          return;
        }

        console.log(chalk.cyan('\nChanges:\n'));

        const added = changes.filter((c) => c.status === 'added');
        const modified = changes.filter((c) => c.status === 'modified');
        const deleted = changes.filter((c) => c.status === 'deleted');

        if (added.length > 0) {
          console.log(chalk.green(`Added (${added.length}):`));
          for (const change of added) {
            console.log(chalk.green(`  + ${change.file}`));
          }
          console.log();
        }

        if (modified.length > 0) {
          console.log(chalk.yellow(`Modified (${modified.length}):`));
          for (const change of modified) {
            console.log(
              chalk.yellow(`  ~ ${change.file} (+${change.additions} -${change.deletions})`)
            );
          }
          console.log();
        }

        if (deleted.length > 0) {
          console.log(chalk.red(`Deleted (${deleted.length}):`));
          for (const change of deleted) {
            console.log(chalk.red(`  - ${change.file}`));
          }
        }

        const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
        const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);

        console.log(chalk.gray(`\nTotal: +${totalAdditions} -${totalDeletions}`));
      } catch (error) {
        spinner.fail(chalk.red('Failed to calculate differences'));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Clean subcommand
  snapshot
    .command('clean')
    .description('Remove old snapshots')
    .option('--older-than <time>', 'Remove snapshots older than (e.g., 30m, 2h, 7d, 2w, 1M)')
    .option('--keep-tags <tags>', 'Keep snapshots with these tags (comma-separated)', (value) =>
      value.split(',').map((t) => t.trim())
    )
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const manager = new SnapshotManager(process.cwd());

        // Preview what will be deleted
        const snapshots = await manager.list();
        let toDelete = 0;

        if (options.olderThan) {
          const cutoff = parseRelativeTime(options.olderThan);
          const cutoffTime = Date.now() - cutoff;

          for (const snapshot of snapshots) {
            const snapshotTime = new Date(snapshot.time).getTime();
            if (snapshotTime < cutoffTime) {
              if (options.keepTags && snapshot.tags) {
                const hasKeepTag = options.keepTags.some((tag: string) =>
                  snapshot.tags?.includes(tag)
                );
                if (!hasKeepTag) {
                  toDelete++;
                }
              } else {
                toDelete++;
              }
            }
          }
        }

        if (toDelete === 0) {
          console.log(chalk.yellow('No snapshots to clean.'));
          return;
        }

        if (!options.yes) {
          console.log(chalk.yellow(`This will delete ${toDelete} snapshot(s).`));
          // In a real implementation, we'd prompt for confirmation here
        }

        const spinner = ora('Cleaning snapshots...').start();
        const deleted = await manager.clean({
          olderThan: options.olderThan,
          keepTags: options.keepTags,
        });

        spinner.succeed(chalk.green(`Cleaned ${deleted} snapshot(s)`));
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return snapshot;
}

function parseRelativeTime(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([mhdwM])$/);
  if (!match) {
    throw new Error('Invalid time format. Use format like: 5m, 2h, 7d, 2w, 1M');
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return value * 60 * 1000;           // minutes
    case 'h':
      return value * 60 * 60 * 1000;      // hours
    case 'd':
      return value * 24 * 60 * 60 * 1000; // days
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000; // weeks
    case 'M':
      return value * 30 * 24 * 60 * 60 * 1000; // months
    default:
      throw new Error('Invalid time unit');
  }
}
