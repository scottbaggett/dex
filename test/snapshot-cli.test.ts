import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('Snapshot CLI Integration', () => {
  let tempDir: string;
  let originalCwd: string;
  const dexBin = path.join(__dirname, '..', 'bin', 'dex');

  beforeEach(async () => {
    originalCwd = process.cwd();
    
    // Create a temporary git repository
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-cli-test-'));
    process.chdir(tempDir);
    
    // Initialize git repo
    await execAsync('git init');
    await execAsync('git config user.email "test@example.com"');
    await execAsync('git config user.name "Test User"');
    
    // Create initial files
    await fs.writeFile('file1.ts', 'console.log("initial");');
    await fs.writeFile('file2.ts', 'export const value = 42;');
    
    // Initial commit
    await execAsync('git add .');
    await execAsync('git commit -m "Initial commit"');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('snapshot create', () => {
    it('should create a snapshot with message', async () => {
      const { stdout } = await execAsync(`node ${dexBin} snapshot create -m "Test snapshot"`);
      
      expect(stdout).toContain('Created snapshot:');
      expect(stdout).toContain('Files:');
      expect(stdout).toContain('Size:');
    });

    it('should create a snapshot with tags', async () => {
      const { stdout } = await execAsync(`node ${dexBin} snapshot create -t feature,important`);
      
      expect(stdout).toContain('Tags: feature, important');
    });

    it('should respect path filters', async () => {
      await fs.mkdir('src');
      await fs.writeFile('src/index.ts', 'export {};');
      
      const { stdout } = await execAsync(`node ${dexBin} snapshot create -p src`);
      
      expect(stdout).toContain('Files: 1'); // Only src/index.ts
    });
  });

  describe('snapshot list', () => {
    it('should list snapshots', async () => {
      await execAsync(`node ${dexBin} snapshot create -m "First"`);
      await execAsync(`node ${dexBin} snapshot create -m "Second"`);
      
      const { stdout } = await execAsync(`node ${dexBin} snapshot list`);
      
      expect(stdout).toContain('First');
      expect(stdout).toContain('Second');
      expect(stdout).toMatch(/Files: \d+, Size:/);
    });

    it('should filter by tags', async () => {
      await execAsync(`node ${dexBin} snapshot create -m "Feature" -t feature`);
      await execAsync(`node ${dexBin} snapshot create -m "Bugfix" -t bugfix`);
      
      const { stdout } = await execAsync(`node ${dexBin} snapshot list -t feature`);
      
      expect(stdout).toContain('Feature');
      expect(stdout).not.toContain('Bugfix');
    });
  });

  describe('snapshot view', () => {
    it('should view snapshot details', async () => {
      const { stdout: createOut } = await execAsync(`node ${dexBin} snapshot create -m "Test view"`);
      const idMatch = createOut.match(/Created snapshot: \x1b\[1m([a-z0-9]+)\x1b/);
      const id = idMatch?.[1];
      
      expect(id).toBeDefined();
      
      const { stdout } = await execAsync(`node ${dexBin} snapshot view ${id}`);
      
      expect(stdout).toContain('Snapshot Details:');
      expect(stdout).toContain(`ID: ${id}`);
      expect(stdout).toContain('Description: Test view');
      expect(stdout).toContain('File List:');
    });
  });

  describe('snapshot diff', () => {
    it('should diff snapshot against current state', async () => {
      const { stdout: createOut } = await execAsync(`node ${dexBin} snapshot create -m "Baseline"`);
      const idMatch = createOut.match(/Created snapshot: \x1b\[1m([a-z0-9]+)\x1b/);
      const id = idMatch?.[1];
      
      // Modify files
      await fs.writeFile('file1.ts', 'console.log("modified");');
      await fs.writeFile('file3.ts', 'new file');
      await fs.unlink('file2.ts');
      
      const { stdout } = await execAsync(`node ${dexBin} snapshot diff ${id}`);
      
      expect(stdout).toContain('Changes:');
      expect(stdout).toContain('Modified (1):');
      expect(stdout).toContain('~ file1.ts');
      expect(stdout).toContain('Added (1):');
      expect(stdout).toContain('+ file3.ts');
      expect(stdout).toContain('Deleted (1):');
      expect(stdout).toContain('- file2.ts');
    });
  });

  describe('main dex command with snapshots', () => {
    it('should extract changes since snapshot using @-1', async () => {
      await execAsync(`node ${dexBin} snapshot create -m "Baseline"`);
      
      // Make changes
      await fs.writeFile('file1.ts', 'console.log("changed");');
      
      const { stdout } = await execAsync(`node ${dexBin} @-1`);
      
      expect(stdout).toContain('file1.ts');
      expect(stdout).toContain('-console.log("initial");');
      expect(stdout).toContain('+console.log("changed");');
    });

    it('should handle @1h time reference', async () => {
      await execAsync(`node ${dexBin} snapshot create -m "Recent"`);
      
      const { stdout } = await execAsync(`node ${dexBin} @1h`);
      
      // Should show no changes since snapshot was just created
      expect(stdout).toMatch(/No changes|0 files changed/);
    });

    it('should fall back to git when snapshot not found', async () => {
      // No snapshots exist, should fall back to git
      await fs.writeFile('file1.ts', 'console.log("changed");');
      
      const { stdout, stderr } = await execAsync(`node ${dexBin} HEAD~1`, { 
        // Allow stderr for git warnings
        maxBuffer: 1024 * 1024 
      });
      
      // Should show changes from git
      expect(stdout + stderr).toContain('file1.ts');
    });
  });

  describe('error handling', () => {
    it('should handle non-existent snapshot gracefully', async () => {
      try {
        await execAsync(`node ${dexBin} snapshot view nonexistent`);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.stderr).toContain('Snapshot not found');
      }
    });

    it('should handle invalid time format', async () => {
      try {
        await execAsync(`node ${dexBin} @invalid`);
      } catch (error: any) {
        // Should fall back to git and fail there
        expect(error.stderr).toMatch(/ambiguous argument|unknown revision/);
      }
    });
  });
});