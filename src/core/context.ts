import { GitExtractor } from './git';
import { DexOptions, ExtractedContext, GitChange, TaskContext, Metadata, ContextLevel } from '../types';
import { minimatch } from 'minimatch';
import { readFileSync } from 'fs';
import { join } from 'path';

export class ContextEngine {
  private gitExtractor: GitExtractor;

  constructor(workingDir: string = process.cwd()) {
    this.gitExtractor = new GitExtractor(workingDir);
  }

  async extract(options: DexOptions): Promise<ExtractedContext> {
    // Get git changes
    let changes: GitChange[];
    if (options.range) {
      const [from, to] = options.range.split('..');
      changes = await this.gitExtractor.getChangesInRange(from, to || 'HEAD');
    } else if (options.since) {
      changes = await this.gitExtractor.getChangesSince(options.since);
    } else {
      changes = await this.gitExtractor.getCurrentChanges(options.staged);
    }

    // Apply filters
    changes = this.applyFilters(changes, options);

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

    // Extended context or specific full files
    if (options.context === 'extended' || options.fullFiles) {
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
    if (!options.task && !options.issue) {
      return undefined;
    }

    const context: TaskContext = {
      description: options.task || '',
    };

    // TODO: Implement GitHub issue fetching
    if (options.issue) {
      context.issueUrl = options.issue;
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
        context: options.context || 'focused',
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
}