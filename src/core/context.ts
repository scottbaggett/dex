import { GitExtractor } from './git';
import { DexOptions, ExtractedContext, GitChange, TaskContext, Metadata } from '../types';
import { minimatch } from 'minimatch';
import { readFileSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TaskExtractor, TaskSource } from './task-extractor';
import { SnapshotManager } from './snapshot';
import * as diff from 'diff';

export class ContextEngine {
  private gitExtractor: GitExtractor;
  private taskExtractor: TaskExtractor;
  private snapshotManager: SnapshotManager;
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
    this.gitExtractor = new GitExtractor(workingDir);
    this.taskExtractor = new TaskExtractor();
    this.snapshotManager = new SnapshotManager(workingDir);
  }

  async extract(options: DexOptions): Promise<ExtractedContext> {
    // Get git changes
    let changes: GitChange[];
    
    // Handle time-based file changes
    if (options.isTimeRange && options.timeRange) {
      changes = await this.getTimeBasedChanges(options.timeRange);
    } else if (options.isSnapshot && options.snapshot) {
      // Handle snapshot-based diffs
      changes = await this.snapshotManager.diff(options.snapshot);
    } else if (options.range) {
      const [from, to] = options.range.split('..');
      changes = await this.gitExtractor.getChangesInRange(from, to || 'HEAD');
    } else if (options.since) {
      changes = await this.gitExtractor.getChangesSince(options.since);
    } else if (options.all) {
      // Get both staged and unstaged changes
      const [staged, unstaged] = await Promise.all([
        this.gitExtractor.getCurrentChanges(true),
        this.gitExtractor.getCurrentChanges(false)
      ]);
      
      // Merge and deduplicate changes
      const changeMap = new Map<string, GitChange>();
      
      // Add staged changes first
      for (const change of staged) {
        changeMap.set(change.file, change);
      }
      
      // Add or update with unstaged changes
      for (const change of unstaged) {
        const existing = changeMap.get(change.file);
        if (existing) {
          // File has both staged and unstaged changes
          // Combine the diffs
          existing.additions += change.additions;
          existing.deletions += change.deletions;
          if (change.diff) {
            existing.diff = existing.diff ? existing.diff + '\n' + change.diff : change.diff;
          }
        } else {
          changeMap.set(change.file, change);
        }
      }
      
      changes = Array.from(changeMap.values());
    } else {
      changes = await this.gitExtractor.getCurrentChanges(options.staged);
    }

    // Apply filters
    changes = this.applyFilters(changes, options);

    // Handle untracked files if requested
    if (options.includeUntracked) {
      const untrackedChanges = await this.getUntrackedChanges(options);
      changes = [...changes, ...untrackedChanges];
    }

    // Extract full files if requested
    const fullFiles = await this.extractFullFiles(changes, options);

    // Calculate scope
    const scope = this.calculateScope(changes);

    // Build task context if provided
    const task = await this.buildTaskContext(options);

    // Collect metadata
    const metadata = await this.collectMetadata(options, changes, fullFiles);

    return {
      changes,
      scope,
      task,
      fullFiles: fullFiles.size > 0 ? fullFiles : undefined,
      metadata,
    };
  }

  private applyFilters(changes: GitChange[], options: DexOptions): GitChange[] {
    let filtered = changes;

    // Path filter
    if (options.path) {
      filtered = filtered.filter(change => 
        minimatch(change.file, options.path!, { matchBase: true })
      );
    }

    // Type filter
    if (options.type && options.type.length > 0) {
      const extensions = options.type.map(t => `.${t}`);
      filtered = filtered.filter(change => 
        extensions.some(ext => change.file.endsWith(ext))
      );
    }

    return filtered;
  }

  private async extractFullFiles(
    changes: GitChange[], 
    options: DexOptions
  ): Promise<Map<string, string>> {
    const fullFiles = new Map<string, string>();

    // Bootstrap mode includes all changed files
    if (options.bootstrap) {
      for (const change of changes) {
        if (change.status !== 'deleted') {
          const content = await this.gitExtractor.getFileContent(change.file);
          fullFiles.set(change.file, content);
        }
      }
    }
    
    // Always include untracked files as full files
    if (options.includeUntracked) {
      for (const change of changes) {
        if (change.status === 'added' && change.diff === '') {
          // This is an untracked file
          const content = await this.gitExtractor.getFileContent(change.file);
          fullFiles.set(change.file, content);
        }
      }
    }

    // Extended depth or specific full files
    if (options.depth === 'extended' || options.fullFiles) {
      const patterns = options.fullFiles || ['**/*'];
      
      for (const change of changes) {
        if (change.status === 'deleted') continue;
        
        const shouldInclude = patterns.some(pattern => 
          minimatch(change.file, pattern, { matchBase: true })
        );
        
        if (shouldInclude && !fullFiles.has(change.file)) {
          const content = await this.gitExtractor.getFileContent(change.file);
          fullFiles.set(change.file, content);
        }
      }
    }

    return fullFiles;
  }

  private async getUntrackedChanges(options: DexOptions): Promise<GitChange[]> {
    const untrackedFiles = await this.gitExtractor.getUntrackedFiles();
    const changes: GitChange[] = [];
    
    for (const file of untrackedFiles) {
      // Apply pattern filter if specified
      if (options.untrackedPattern && !minimatch(file, options.untrackedPattern, { matchBase: true })) {
        continue;
      }
      
      // Apply general path filter
      if (options.path && !minimatch(file, options.path, { matchBase: true })) {
        continue;
      }
      
      // Apply type filter
      if (options.type && options.type.length > 0) {
        const extensions = options.type.map(t => `.${t}`);
        if (!extensions.some(ext => file.endsWith(ext))) {
          continue;
        }
      }
      
      // Read file content to count lines
      const content = await this.gitExtractor.getFileContent(file);
      const lines = content.split('\n').length;
      
      // Get file modification time
      let lastModified: Date | undefined;
      try {
        // Get the git root directory for proper path resolution
        const gitRoot = await this.gitExtractor.getRepositoryRoot();
        const stats = await fs.stat(join(gitRoot, file));
        lastModified = stats.mtime;
      } catch {
        // File might not be accessible
      }
      
      changes.push({
        file,
        status: 'added',
        additions: lines,
        deletions: 0,
        diff: '', // We'll include as full file
        lastModified,
      });
    }
    
    return changes;
  }

  private calculateScope(changes: GitChange[]) {
    const linesAdded = changes.reduce((sum, c) => sum + c.additions, 0);
    const linesDeleted = changes.reduce((sum, c) => sum + c.deletions, 0);

    return {
      filesChanged: changes.length,
      functionsModified: 0, // TODO: Implement with AST parsing
      linesAdded,
      linesDeleted,
    };
  }

  private async buildTaskContext(options: DexOptions): Promise<TaskContext | undefined> {
    // Check if any task source is provided
    if (!options.task && !options.taskFile && !options.taskUrl && !options.taskStdin) {
      return undefined;
    }

    // Determine task source
    let taskSource: TaskSource | undefined;
    
    if (options.task) {
      // Direct text input
      taskSource = { type: 'text', source: options.task };
    } else if (options.taskFile) {
      // File input
      taskSource = { type: 'file', source: options.taskFile };
    } else if (options.taskUrl) {
      // URL input
      taskSource = { type: 'url', source: options.taskUrl };
    } else if (options.taskStdin) {
      // Stdin input
      taskSource = { type: 'stdin', source: '' };
    }

    // Extract task context
    let context: TaskContext | undefined;
    
    if (taskSource) {
      try {
        context = await this.taskExtractor.extract(taskSource);
      } catch (error) {
        throw new Error(`Failed to extract task: ${error instanceof Error ? error.message : error}`);
      }
    }

    return context;
  }

  private async collectMetadata(
    options: DexOptions, 
    changes: GitChange[],
    fullFiles: Map<string, string>
  ): Promise<Metadata> {
    // Get package version
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
    );

    // Get repository info
    const [repoName, branch, commit] = await Promise.all([
      this.gitExtractor.getRepositoryName(),
      this.gitExtractor.getCurrentBranch(),
      this.gitExtractor.getLatestCommit(),
    ]);

    // Estimate tokens (rough estimate: 1 token ≈ 4 characters)
    const tokensEstimate = this.estimateTokens(changes, fullFiles);

    return {
      generated: new Date().toISOString(),
      repository: {
        name: repoName,
        branch,
        commit,
      },
      extraction: {
        depth: options.depth || 'focused',
        filters: {
          path: options.path,
          type: options.type,
        },
      },
      tokens: {
        estimated: tokensEstimate,
      },
      tool: {
        name: packageJson.name,
        version: packageJson.version,
      },
    };
  }

  private estimateTokens(changes: GitChange[], fullFiles: Map<string, string>): number {
    let charCount = 0;

    // Count characters in diffs
    for (const change of changes) {
      charCount += change.diff.length;
    }

    // Count characters in full files
    if (fullFiles) {
      for (const content of fullFiles.values()) {
        charCount += content.length;
      }
    }

    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(charCount / 4);
  }

  private async getTimeBasedChanges(timeRange: string): Promise<GitChange[]> {
    // Parse time range to get cutoff timestamp
    const cutoffTime = this.parseTimeRange(timeRange);
    if (!cutoffTime) {
      throw new Error(`Invalid time range format: ${timeRange}`);
    }

    // Get the git root directory for proper path resolution
    const gitRoot = await this.gitExtractor.getRepositoryRoot();
    
    // Get all tracked files from git
    const trackedFiles = await this.gitExtractor.getTrackedFiles();
    const changes: GitChange[] = [];

    // Check each file's modification time
    for (const filePath of trackedFiles) {
      try {
        const fullPath = join(gitRoot, filePath);
        const stats = await fs.stat(fullPath);
        
        // Check if file was modified within the time range
        if (stats.mtime.getTime() >= cutoffTime) {
          // Get the file's last committed version
          const lastCommittedContent = await this.gitExtractor.getFileContentFromHead(filePath);
          const currentContent = await fs.readFile(fullPath, 'utf8');
          
          // Generate diff between last committed and current
          if (lastCommittedContent !== currentContent) {
            const patch = diff.createPatch(filePath, lastCommittedContent, currentContent);
            const diffStats = this.calculateDiffStats(patch);
            
            changes.push({
              file: filePath,
              status: 'modified',
              additions: diffStats.additions,
              deletions: diffStats.deletions,
              diff: patch,
              lastModified: stats.mtime
            });
          }
        }
      } catch {
        // File might have been deleted or is inaccessible
        continue;
      }
    }

    // Also check for new untracked files
    const untrackedFiles = await this.gitExtractor.getUntrackedFiles();
    for (const filePath of untrackedFiles) {
      try {
        const fullPath = join(gitRoot, filePath);
        const stats = await fs.stat(fullPath);
        
        if (stats.mtime.getTime() >= cutoffTime) {
          const content = await fs.readFile(fullPath, 'utf8');
          const lines = content.split('\n').length;
          
          changes.push({
            file: filePath,
            status: 'added',
            additions: lines,
            deletions: 0,
            diff: this.createAddedDiff(content),
            lastModified: stats.mtime
          });
        }
      } catch {
        continue;
      }
    }

    return changes;
  }

  private parseTimeRange(timeRange: string): number | null {
    const match = timeRange.match(/^(\d+)([mhdwM])$/);
    if (!match) return null;
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    let milliseconds = 0;
    switch (unit) {
      case 'm': milliseconds = value * 60 * 1000; break;           // minutes
      case 'h': milliseconds = value * 60 * 60 * 1000; break;      // hours
      case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break; // days
      case 'w': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break; // weeks
      case 'M': milliseconds = value * 30 * 24 * 60 * 60 * 1000; break; // months
      default: return null;
    }
    
    // Return cutoff timestamp (now - duration)
    return Date.now() - milliseconds;
  }

  private calculateDiffStats(patch: string): { additions: number; deletions: number } {
    const lines = patch.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    return { additions, deletions };
  }

  private createAddedDiff(content: string): string {
    const lines = content.split('\n');
    return lines.map(line => `+${line}`).join('\n');
  }
}