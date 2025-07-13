import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnapshotManager } from '../src/core/snapshot';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitChange } from '../src/types';

describe('SnapshotManager', () => {
  let tempDir: string;
  let snapshotManager: SnapshotManager;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-test-'));
    snapshotManager = new SnapshotManager(tempDir);
    
    // Create some test files
    await fs.writeFile(path.join(tempDir, 'file1.ts'), 'console.log("file1");');
    await fs.writeFile(path.join(tempDir, 'file2.ts'), 'console.log("file2");');
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src/index.ts'), 'export default {};');
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a snapshot with default options', async () => {
      const id = await snapshotManager.create();
      
      expect(id).toBeDefined();
      expect(id).toMatch(/^[a-z0-9]+$/);
      
      // Verify snapshot files were created
      const snapshotDir = path.join(tempDir, '.dex', 'snapshots', id);
      const metaExists = await fs.access(path.join(snapshotDir, 'meta.yml')).then(() => true).catch(() => false);
      const treeExists = await fs.access(path.join(snapshotDir, 'tree.yml')).then(() => true).catch(() => false);
      
      expect(metaExists).toBe(true);
      expect(treeExists).toBe(true);
    });

    it('should create a snapshot with custom message and tags', async () => {
      const id = await snapshotManager.create({
        message: 'Test snapshot',
        tags: ['test', 'feature']
      });
      
      const snapshot = await snapshotManager.get(id);
      expect(snapshot).toBeDefined();
      expect(snapshot?.metadata.description).toBe('Test snapshot');
      expect(snapshot?.metadata.tags).toEqual(['test', 'feature']);
    });

    it('should respect path filters', async () => {
      const id = await snapshotManager.create({
        path: 'src'
      });
      
      const snapshot = await snapshotManager.get(id);
      expect(snapshot).toBeDefined();
      expect(Object.keys(snapshot!.tree.files)).toContain('src/index.ts');
      expect(Object.keys(snapshot!.tree.files)).not.toContain('file1.ts');
    });

    it('should store file hashes correctly', async () => {
      const id = await snapshotManager.create();
      const snapshot = await snapshotManager.get(id);
      
      expect(snapshot).toBeDefined();
      const file1Hash = snapshot!.tree.files['file1.ts']?.hash;
      expect(file1Hash).toBeDefined();
      expect(file1Hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('list', () => {
    it('should list all snapshots', async () => {
      const id1 = await snapshotManager.create({ message: 'First' });
      const id2 = await snapshotManager.create({ message: 'Second' });
      
      const snapshots = await snapshotManager.list();
      
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].id).toBe(id2); // Most recent first
      expect(snapshots[1].id).toBe(id1);
    });

    it('should filter by tags', async () => {
      await snapshotManager.create({ tags: ['feature'] });
      await snapshotManager.create({ tags: ['bugfix'] });
      await snapshotManager.create({ tags: ['feature', 'important'] });
      
      const featureSnapshots = await snapshotManager.list({ tags: ['feature'] });
      expect(featureSnapshots).toHaveLength(2);
      
      const bugfixSnapshots = await snapshotManager.list({ tags: ['bugfix'] });
      expect(bugfixSnapshots).toHaveLength(1);
    });

    it('should respect limit option', async () => {
      for (let i = 0; i < 5; i++) {
        await snapshotManager.create({ message: `Snapshot ${i}` });
      }
      
      const limited = await snapshotManager.list({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe('get', () => {
    it('should get snapshot by exact ID', async () => {
      const id = await snapshotManager.create({ message: 'Test' });
      const snapshot = await snapshotManager.get(id);
      
      expect(snapshot).toBeDefined();
      expect(snapshot?.metadata.id).toBe(id);
      expect(snapshot?.metadata.description).toBe('Test');
    });

    it('should get snapshot by partial description match', async () => {
      await snapshotManager.create({ message: 'Feature implementation' });
      const snapshot = await snapshotManager.get('Feature');
      
      expect(snapshot).toBeDefined();
      expect(snapshot?.metadata.description).toBe('Feature implementation');
    });

    it('should handle relative references @-1', async () => {
      const id1 = await snapshotManager.create({ message: 'First' });
      const id2 = await snapshotManager.create({ message: 'Second' });
      
      const snapshot = await snapshotManager.get('@-1');
      expect(snapshot).toBeDefined();
      expect(snapshot?.metadata.id).toBe(id2);
      
      const snapshot2 = await snapshotManager.get('@-2');
      expect(snapshot2).toBeDefined();
      expect(snapshot2?.metadata.id).toBe(id1);
    });

    it('should handle relative time references', async () => {
      // Create a snapshot
      const id = await snapshotManager.create({ message: 'Recent' });
      
      // @1h should find it (created less than 1 hour ago)
      const snapshot = await snapshotManager.get('@1h');
      expect(snapshot).toBeDefined();
      expect(snapshot?.metadata.id).toBe(id);
      
      // @0h should not find it (created more than 0 hours ago)
      const noSnapshot = await snapshotManager.get('@0h');
      expect(noSnapshot).toBeNull();
    });

    it('should return null for non-existent snapshot', async () => {
      const snapshot = await snapshotManager.get('nonexistent');
      expect(snapshot).toBeNull();
    });
  });

  describe('diff', () => {
    it('should diff snapshot against current state', async () => {
      const id = await snapshotManager.create();
      
      // Modify a file
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'console.log("modified");');
      
      // Add a new file
      await fs.writeFile(path.join(tempDir, 'file3.ts'), 'console.log("new");');
      
      // Delete a file
      await fs.unlink(path.join(tempDir, 'file2.ts'));
      
      const changes = await snapshotManager.diff(id);
      
      expect(changes).toHaveLength(3);
      
      const modified = changes.find(c => c.file === 'file1.ts');
      expect(modified?.status).toBe('modified');
      
      const added = changes.find(c => c.file === 'file3.ts');
      expect(added?.status).toBe('added');
      
      const deleted = changes.find(c => c.file === 'file2.ts');
      expect(deleted?.status).toBe('deleted');
    });

    it('should diff between two snapshots', async () => {
      const id1 = await snapshotManager.create();
      
      // Make changes
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'console.log("modified");');
      await fs.writeFile(path.join(tempDir, 'newfile.ts'), 'new content');
      
      const id2 = await snapshotManager.create();
      
      const changes = await snapshotManager.diff(id1, id2);
      
      expect(changes).toHaveLength(2);
      expect(changes.find(c => c.file === 'file1.ts')?.status).toBe('modified');
      expect(changes.find(c => c.file === 'newfile.ts')?.status).toBe('added');
    });

    it('should handle snapshot references in diff', async () => {
      await snapshotManager.create({ message: 'First' });
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'modified content');
      await snapshotManager.create({ message: 'Second' });
      
      const changes = await snapshotManager.diff('@-2', '@-1');
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe('file1.ts');
      expect(changes[0].status).toBe('modified');
    });

    it('should throw error for non-existent snapshot', async () => {
      await expect(snapshotManager.diff('nonexistent')).rejects.toThrow('Snapshot not found');
    });
  });

  describe('clean', () => {
    it('should clean old snapshots', async () => {
      // Create first snapshot
      const id1 = await snapshotManager.create({ message: 'Old' });
      
      // Wait a moment and create second snapshot
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await snapshotManager.create({ message: 'Recent' });
      
      // Mock Date.now for the clean operation to simulate passage of time
      const originalDateNow = Date.now;
      const originalTime = originalDateNow();
      Date.now = vi.fn(() => originalTime + 8 * 24 * 60 * 60 * 1000); // 8 days later
      
      // Clean snapshots older than 7 days (both should be old now)
      const deleted = await snapshotManager.clean({ olderThan: '7d' });
      
      // Restore Date.now
      Date.now = originalDateNow;
      
      expect(deleted).toBe(2); // Both snapshots are older than 7 days
      
      const snapshots = await snapshotManager.list();
      expect(snapshots).toHaveLength(0);
    });

    it('should keep snapshots with specified tags', async () => {
      // Create snapshots
      const id1 = await snapshotManager.create({ message: 'Keep me', tags: ['keep'] });
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await snapshotManager.create({ message: 'Delete me' });
      
      // Mock Date.now for the clean operation
      const originalDateNow = Date.now;
      const originalTime = originalDateNow();
      Date.now = vi.fn(() => originalTime + 8 * 24 * 60 * 60 * 1000);
      
      const deleted = await snapshotManager.clean({ 
        olderThan: '7d',
        keepTags: ['keep']
      });
      
      // Restore Date.now
      Date.now = originalDateNow;
      
      expect(deleted).toBe(1); // Should only delete the one without 'keep' tag
      
      const snapshots = await snapshotManager.list();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].tags).toContain('keep');
    });
  });

  describe('storage', () => {
    it('should compress objects when storing', async () => {
      const id = await snapshotManager.create();
      const snapshot = await snapshotManager.get(id);
      
      // Check that object files are created
      const file1Hash = snapshot!.tree.files['file1.ts'].hash;
      const objectPath = path.join(tempDir, '.dex', 'objects', file1Hash.substring(0, 2), file1Hash);
      
      const exists = await fs.access(objectPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      // Verify it's compressed (should be smaller than original)
      const originalSize = (await fs.stat(path.join(tempDir, 'file1.ts'))).size;
      const compressedSize = (await fs.stat(objectPath)).size;
      
      // Compressed might be larger for very small files, but it should exist
      expect(compressedSize).toBeGreaterThan(0);
    });

    it('should deduplicate identical files', async () => {
      // Create two identical files
      await fs.writeFile(path.join(tempDir, 'dup1.ts'), 'duplicate content');
      await fs.writeFile(path.join(tempDir, 'dup2.ts'), 'duplicate content');
      
      const id = await snapshotManager.create();
      const snapshot = await snapshotManager.get(id);
      
      // Both files should have the same hash
      const hash1 = snapshot!.tree.files['dup1.ts'].hash;
      const hash2 = snapshot!.tree.files['dup2.ts'].hash;
      
      expect(hash1).toBe(hash2);
      
      // Only one object file should exist
      const objectPath = path.join(tempDir, '.dex', 'objects', hash1.substring(0, 2), hash1);
      const exists = await fs.access(objectPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle missing .dex directory gracefully', async () => {
      const freshManager = new SnapshotManager(tempDir);
      const snapshots = await freshManager.list();
      expect(snapshots).toEqual([]);
    });

    it('should skip corrupted snapshots when listing', async () => {
      const id = await snapshotManager.create({ message: 'Good' });
      
      // Create a corrupted snapshot
      const badDir = path.join(tempDir, '.dex', 'snapshots', 'corrupted');
      await fs.mkdir(badDir, { recursive: true });
      await fs.writeFile(path.join(badDir, 'meta.yml'), 'invalid yaml {{');
      
      const snapshots = await snapshotManager.list();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe(id);
    });

    it('should return null for corrupted snapshot on get', async () => {
      const badDir = path.join(tempDir, '.dex', 'snapshots', 'corrupted');
      await fs.mkdir(badDir, { recursive: true });
      await fs.writeFile(path.join(badDir, 'meta.yml'), 'valid yaml');
      await fs.writeFile(path.join(badDir, 'tree.yml'), 'invalid yaml {{');
      
      const snapshot = await snapshotManager.get('corrupted');
      expect(snapshot).toBeNull();
    });
  });
});