import simpleGit, { SimpleGit } from 'simple-git';
import { GitChange } from '../types';

export class GitExtractor {
  private git: SimpleGit;

  constructor(workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir);
  }

  async getCurrentChanges(staged: boolean = false): Promise<GitChange[]> {
    const args = staged ? ['--cached'] : [];
    const diff = await this.git.diff(args);
    return this.parseDiff(diff);
  }

  async getChangesSince(base: string): Promise<GitChange[]> {
    const diff = await this.git.diff([`${base}...HEAD`]);
    return this.parseDiff(diff);
  }

  async getChangesInRange(from: string, to: string): Promise<GitChange[]> {
    const diff = await this.git.diff([`${from}..${to}`]);
    return this.parseDiff(diff);
  }

  async getFileContent(path: string): Promise<string> {
    try {
      return await this.git.show([`HEAD:${path}`]);
    } catch {
      // File might be new, read from filesystem
      const fs = await import('fs/promises');
      return await fs.readFile(path, 'utf-8');
    }
  }

  async getUntrackedFiles(): Promise<string[]> {
    const result = await this.git.raw(['ls-files', '--others', '--exclude-standard']);
    return result.trim().split('\n').filter(Boolean);
  }

  private parseDiff(diffOutput: string): GitChange[] {
    if (!diffOutput) return [];

    const changes: GitChange[] = [];
    const fileDiffs = diffOutput.split(/^diff --git/m).slice(1);

    for (const fileDiff of fileDiffs) {
      const lines = fileDiff.split('\n');
      const fileMatch = lines[0].match(/a\/(.*) b\/(.*)/);
      if (!fileMatch) continue;

      const [, oldPath, newPath] = fileMatch;
      
      let status: GitChange['status'] = 'modified';
      if (lines.some(l => l.startsWith('new file mode'))) {
        status = 'added';
      } else if (lines.some(l => l.startsWith('deleted file mode'))) {
        status = 'deleted';
      } else if (lines.some(l => l.startsWith('rename from'))) {
        status = 'renamed';
      }

      let additions = 0;
      let deletions = 0;
      const diffContent: string[] = [];
      
      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
          diffContent.push(line);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
          diffContent.push(line);
        } else if (line.startsWith('@@')) {
          diffContent.push(line);
        } else if (line.startsWith(' ')) {
          diffContent.push(line);
        }
      }

      changes.push({
        file: newPath,
        status,
        additions,
        deletions,
        diff: diffContent.join('\n'),
        oldFile: status === 'renamed' ? oldPath : undefined,
      });
    }

    return changes;
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    const branches = await this.git.branch();
    return branches.current;
  }

  async getLatestCommit(): Promise<string> {
    const log = await this.git.log({ n: 1 });
    return log.latest?.hash.substring(0, 7) || 'unknown';
  }

  async getRepositoryName(): Promise<string> {
    try {
      const remotes = await this.git.getRemotes(true);
      if (remotes.length > 0 && remotes[0].refs.fetch) {
        const url = remotes[0].refs.fetch;
        // Extract repo name from URL (e.g., git@github.com:user/repo.git)
        const match = url.match(/([^/]+)\.git$/);
        if (match) {
          return match[1];
        }
      }
    } catch {
      // Fallback to directory name
    }
    
    const path = await import('path');
    return path.basename(process.cwd());
  }
}