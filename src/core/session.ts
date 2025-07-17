import { promises as fs } from 'fs';
import { join } from 'path';

export interface SessionInfo {
  id: string;
  startTime: string;
  startCommit: string;
  branch: string;
  description?: string;
}

export class SessionManager {
  private workingDir: string;
  private sessionDir: string;
  private sessionFile: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
    this.sessionDir = join(workingDir, '.dex');
    this.sessionFile = join(this.sessionDir, 'session.json');
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

    const session: SessionInfo = {
      id: this.generateSessionId(),
      startTime: new Date().toISOString(),
      startCommit,
      branch,
      description,
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
}