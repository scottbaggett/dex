import { promises as fs } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { GitExtractor } from './git';

export interface FileBaseline {
  hash: string;
  size: number;
  modified: string;
}

export interface SessionInfo {
  id: string;
  startTime: string;
  startCommit: string;
  branch: string;
  description?: string;
  baselineFiles: Record<string, FileBaseline>;
}

export class SessionManager {
  private workingDir: string;
  private sessionDir: string;
  private sessionFile: string;
  private gitExtractor: GitExtractor;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
    this.sessionDir = join(workingDir, '.dex');
    this.sessionFile = join(this.sessionDir, 'dex.session.json');
    this.gitExtractor = new GitExtractor(workingDir);
  }

  /**
   * Check if there's an active session
   */
  async hasActiveSession(): Promise<boolean> {
    try {
      await fs.access(this.sessionFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current session info
   */
  async getCurrentSession(): Promise<SessionInfo | null> {
    try {
      const content = await fs.readFile(this.sessionFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Start a new session
   */
  async startSession(startCommit: string, branch: string, description?: string): Promise<SessionInfo> {
    // Ensure .dex directory exists
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Create baseline of current files
    const baselineFiles = await this.createFileBaseline();

    const session: SessionInfo = {
      id: this.generateSessionId(),
      startTime: new Date().toISOString(),
      startCommit,
      branch,
      description,
      baselineFiles,
    };

    await fs.writeFile(this.sessionFile, JSON.stringify(session, null, 2));
    return session;
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    try {
      await fs.unlink(this.sessionFile);
    } catch {
      // Session file might not exist
    }
  }

  /**
   * Get session status info
   */
  async getSessionStatus(): Promise<{ active: boolean; session?: SessionInfo }> {
    const active = await this.hasActiveSession();
    const session = active ? (await this.getCurrentSession()) || undefined : undefined;
    return { active, session };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create a baseline snapshot of all tracked files
   */
  private async createFileBaseline(): Promise<Record<string, FileBaseline>> {
    const baseline: Record<string, FileBaseline> = {};
    
    // Get all tracked files
    const trackedFiles = await this.gitExtractor.getTrackedFiles();
    
    // Get file info for each tracked file
    for (const file of trackedFiles) {
      try {
        const fullPath = join(this.workingDir, file);
        const stats = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        baseline[file] = {
          hash,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      } catch {
        // File might have been deleted or inaccessible
        // Skip it in the baseline
      }
    }
    
    return baseline;
  }

  /**
   * Get all changes since session start (including uncommitted)
   */
  async getSessionChanges(): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
  }> {
    const session = await this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    const changes = {
      added: [] as string[],
      modified: [] as string[],
      deleted: [] as string[],
    };

    // Get current tracked files
    const currentTrackedFiles = await this.gitExtractor.getTrackedFiles();
    const currentTrackedSet = new Set(currentTrackedFiles);

    // Check for deleted files (in baseline but not in current)
    for (const file in session.baselineFiles) {
      if (!currentTrackedSet.has(file)) {
        // Check if file still exists (might be untracked now)
        try {
          await fs.access(join(this.workingDir, file));
          // File exists but is untracked - consider it modified
          changes.modified.push(file);
        } catch {
          // File is truly deleted
          changes.deleted.push(file);
        }
      }
    }

    // Check current files
    for (const file of currentTrackedFiles) {
      const baselineInfo = session.baselineFiles[file];
      
      if (!baselineInfo) {
        // File wasn't in baseline - it's new
        changes.added.push(file);
      } else {
        // Check if file has changed
        try {
          const fullPath = join(this.workingDir, file);
          const content = await fs.readFile(fullPath);
          const currentHash = crypto.createHash('sha256').update(content).digest('hex');
          
          if (currentHash !== baselineInfo.hash) {
            changes.modified.push(file);
          }
        } catch {
          // Error reading file - skip
        }
      }
    }

    // Check for untracked files (new files not yet added to git)
    const untrackedFiles = await this.gitExtractor.getUntrackedFiles();
    changes.added.push(...untrackedFiles);

    return changes;
  }
}