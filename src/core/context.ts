import { GitExtractor } from './git';
import { DexOptions, ExtractedContext, GitChange, TaskContext, Metadata } from '../types';
import { minimatch } from 'minimatch';
import { SessionManager } from './session';

export class ContextEngine {
  constructor(
    private gitExtractor: GitExtractor,
    private sessionManager: SessionManager
  ) {}

  async extract(options: DexOptions): Promise<ExtractedContext> {
    let changes: GitChange[] = [];
    let detectionMethod = 'none';
    let additionalContext: { totalChanges?: number; notIncluded?: number } = {};

    // Staged changes
    if (options.staged) {
      changes = await this.gitExtractor.getCurrentChanges(true);
      detectionMethod = 'staged';
      // Check for unstaged changes to inform user
      const unstaged = await this.gitExtractor.getCurrentChanges(false);
      if (unstaged.length > 0) {
        additionalContext.totalChanges = changes.length + unstaged.length;
        additionalContext.notIncluded = unstaged.length;
      }
    }
    // All changes (staged + unstaged)
    else if (options.all) {
      changes = await this.getAllChanges();
      detectionMethod = 'all (staged + unstaged)';
    }
    // Smart detection (default)
    else {
      const result = await this.smartDetectChanges();
      changes = result.changes;
      detectionMethod = result.method;
      additionalContext = result.additionalContext || {};
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
    const metadata = await this.collectMetadata(options, changes, fullFiles, detectionMethod);

    // Calculate token savings
    const tokenSavings = await this.calculateTokenSavings(changes, fullFiles);

    return {
      changes,
      scope,
      task,
      fullFiles: fullFiles.size > 0 ? fullFiles : undefined,
      metadata,
      tokenSavings,
      additionalContext,
    };
  }

  private applyFilters(changes: GitChange[], options: DexOptions): GitChange[] {
    let filtered = changes;

    // Path filter
    if (options.path) {
      filtered = filtered.filter((change) =>
        minimatch(change.file, options.path!, { matchBase: true })
      );
    }

    // Type filter
    if (options.type && options.type.length > 0) {
      const extensions = options.type.map((t) => `.${t}`);
      filtered = filtered.filter((change) => extensions.some((ext) => change.file.endsWith(ext)));
    }

    return filtered;
  }

  private async extractFullFiles(
    changes: GitChange[],
    options: DexOptions
  ): Promise<Map<string, string>> {
    const fullFiles = new Map<string, string>();
    const smartContextInfo: string[] = [];

    // Smart Context: Automatically decide diff vs full file for each change
    for (const change of changes) {
      if (change.status === 'deleted') continue;

      let showFull = false;
      let reason = '';

      // NEW files: Show full if small (< 50 lines)
      if (change.status === 'added') {
        const content = await this.gitExtractor.getFileContent(change.file);
        const lineCount = content.split('\n').length;
        if (lineCount < 50) {
          showFull = true;
          reason = `new file (${lineCount} lines)`;
          fullFiles.set(change.file, content);
        }
      }
      // MODIFIED files: Show full if > 40% changed
      else if (change.status === 'modified') {
        const content = await this.gitExtractor.getFileContent(change.file);
        const totalLines = content.split('\n').length;
        const changedLines = change.additions + change.deletions;
        const changePercentage = (changedLines / totalLines) * 100;

        if (changePercentage > 40) {
          showFull = true;
          reason = `${Math.round(changePercentage)}% changed`;
          fullFiles.set(change.file, content);
        }
      }

      // Manual override: --full pattern
      if (!showFull && options.full) {
        if (minimatch(change.file, options.full, { matchBase: true })) {
          const content = await this.gitExtractor.getFileContent(change.file);
          fullFiles.set(change.file, content);
          showFull = true;
          reason = 'manual override';
        }
      }

      // Log Smart Context decision
      if (showFull) {
        smartContextInfo.push(`  ${change.file} → full (${reason})`);
      }
    }

    // Show Smart Context feedback if any full files were included
    if (smartContextInfo.length > 0) {
      console.log('\nSmart Context:');
      smartContextInfo.forEach((info) => console.log(info));
    }

    return fullFiles;
  }

  private async getUntrackedChanges(options: DexOptions): Promise<GitChange[]> {
    const untrackedFiles = await this.gitExtractor.getUntrackedFiles();
    const changes: GitChange[] = [];

    for (const file of untrackedFiles) {
      // Apply filters
      if (options.path && !minimatch(file, options.path, { matchBase: true })) {
        continue;
      }

      if (options.type && options.type.length > 0) {
        const extensions = options.type.map((t) => `.${t}`);
        if (!extensions.some((ext) => file.endsWith(ext))) {
          continue;
        }
      }

      // Get file content
      const content = await this.gitExtractor.getFileContent(file);
      const lines = content.split('\n').length;

      changes.push({
        file,
        status: 'added',
        additions: lines,
        deletions: 0,
        diff: this.createAddedDiff(content),
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
    if (!options.task) {
      return undefined;
    }

    const context: TaskContext = {
      description: options.task,
    };

    return context;
  }

  private async collectMetadata(
    options: DexOptions,
    changes: GitChange[],
    fullFiles: Map<string, string>,
    detectionMethod: string
  ): Promise<Metadata> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require('../../package.json');

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
        method: detectionMethod,
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



  private createAddedDiff(content: string): string {
    const lines = content.split('\n');
    return lines.map((line) => `+${line}`).join('\n');
  }

  private async calculateTokenSavings(
    changes: GitChange[],
    fullFiles: Map<string, string>
  ): Promise<ExtractedContext['tokenSavings']> {
    let fullFileTokens = 0;
    let actualTokens = 0;

    for (const change of changes) {
      // Skip deleted files
      if (change.status === 'deleted') continue;

      // Calculate actual tokens (what we're showing)
      if (fullFiles.has(change.file)) {
        // We're showing the full file
        const content = fullFiles.get(change.file)!;
        actualTokens += Math.ceil(content.length / 4);
      } else {
        // We're showing the diff
        actualTokens += Math.ceil(change.diff.length / 4);
      }

      // Calculate what it would cost to show full file
      try {
        const fullContent = await this.gitExtractor.getFileContent(change.file);
        fullFileTokens += Math.ceil(fullContent.length / 4);
      } catch {
        // If we can't get the file, estimate based on diff
        fullFileTokens += Math.ceil(change.diff.length / 4);
      }
    }

    const saved = fullFileTokens - actualTokens;
    const percentSaved = fullFileTokens > 0 ? Math.round((saved / fullFileTokens) * 100) : 0;

    return {
      fullFileTokens,
      actualTokens,
      saved,
      percentSaved,
    };
  }

  private async smartDetectChanges(): Promise<{
    changes: GitChange[];
    method: string;
    additionalContext?: any;
  }> {
    // 1. Check for active session
    const session = await this.sessionManager.getCurrentSession();
    if (session) {
      // Get all changes since session start
      const changes = await this.gitExtractor.getChangesSince(session.startCommit);
      return {
        changes,
        method: `session (started ${new Date(session.startTime).toLocaleTimeString()})`,
      };
    }

    // 2. Check if on feature branch
    const isFeatureBranch = await this.gitExtractor.isFeatureBranch();
    if (isFeatureBranch) {
      // Get all changes from main branch
      const currentBranch = await this.gitExtractor.getCurrentBranch();
      const mainBranch = await this.gitExtractor.findMainBranch();
      if (mainBranch) {
        const changes = await this.gitExtractor.getFeatureBranchChanges(mainBranch);
        return {
          changes,
          method: `feature branch (${currentBranch} from ${mainBranch})`,
        };
      }
    }

    // 3. Check for staged changes
    const hasStagedChanges = await this.gitExtractor.hasStagedChanges();
    if (hasStagedChanges) {
      const staged = await this.gitExtractor.getCurrentChanges(true);
      const unstaged = await this.gitExtractor.getCurrentChanges(false);

      const additionalContext: any = {};
      if (unstaged.length > 0) {
        additionalContext.totalChanges = staged.length + unstaged.length;
        additionalContext.notIncluded = unstaged.length;
      }

      return {
        changes: staged,
        method: 'staged changes',
        additionalContext,
      };
    }

    // 4. Default to unstaged changes
    const changes = await this.gitExtractor.getCurrentChanges(false);
    return {
      changes,
      method: 'unstaged changes',
    };
  }

  private async getAllChanges(): Promise<GitChange[]> {
    const [staged, unstaged] = await Promise.all([
      this.gitExtractor.getCurrentChanges(true),
      this.gitExtractor.getCurrentChanges(false),
    ]);

    // Merge changes, preferring staged version if file appears in both
    const changeMap = new Map<string, GitChange>();

    for (const change of staged) {
      changeMap.set(change.file, change);
    }

    for (const change of unstaged) {
      const existing = changeMap.get(change.file);
      if (!existing) {
        changeMap.set(change.file, change);
      } else {
        // Combine the changes
        existing.additions += change.additions;
        existing.deletions += change.deletions;
        existing.diff = existing.diff + '\n' + change.diff;
      }
    }

    return Array.from(changeMap.values());
  }
}
