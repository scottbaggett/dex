import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { promisify } from 'util';
import { 
  Snapshot, 
  SnapshotMetadata, 
  SnapshotTree, 
  SnapshotOptions, 
  GitChange 
} from '../types';
import { GitExtractor } from './git';
import * as diff from 'diff';
import { formatFileSize } from '../utils/format';

export class SnapshotManager {
  private rootPath: string;
  private snapshotsPath: string;
  private objectsPath: string;
  private gitExtractor: GitExtractor;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.snapshotsPath = path.join(rootPath, '.dex', 'snapshots');
    this.objectsPath = path.join(rootPath, '.dex', 'objects');
    this.gitExtractor = new GitExtractor(rootPath);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.snapshotsPath, { recursive: true });
    await fs.mkdir(this.objectsPath, { recursive: true });
  }

  async create(options: SnapshotOptions = {}): Promise<string> {
    await this.init();
    
    const id = this.generateId();
    const snapshotDir = path.join(this.snapshotsPath, id);
    await fs.mkdir(snapshotDir, { recursive: true });

    // Get files to snapshot
    const files = await this.getFilesToSnapshot(options);
    
    // Create tree and store objects
    const tree: SnapshotTree = { files: {} };
    let totalSize = 0;
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    
    // Process files in parallel batches
    const BATCH_SIZE = 10;
    const results: Array<{ path: string; info: { hash: string; size: number; mode: string } }> = [];
    let processed = 0;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          const reportProgress = () => {
            processed++;
            options.onProgress?.({ current: processed, total: files.length, file: filePath });
          };
          
          try {
            // Prevent path traversal
            const fullPath = path.resolve(this.rootPath, filePath);
            if (!fullPath.startsWith(this.rootPath)) {
              console.warn(`Invalid file path detected: ${filePath}`);
              return null;
            }
            
            // Check file existence and size first
            const stat = await fs.stat(fullPath);
            if (!stat.isFile()) {
              return null;
            }
            
            // Skip files that are too large
            if (stat.size > MAX_FILE_SIZE) {
              console.warn(`Skipping large file: ${filePath} (${formatFileSize(stat.size)})`);
              return null;
            }
            
            // Hash the file
            const hash = await this.hashFile(fullPath);
            
            // Store object after successful hashing
            await this.storeObject(hash, fullPath);
            
            // Report progress
            reportProgress();
            
            return {
              path: filePath,
              info: { hash, size: stat.size, mode: stat.mode.toString(8) }
            };
          } catch (error: any) {
            reportProgress();
            // Handle specific errors
            if (error.code === 'ENOENT') {
              console.warn(`File deleted during snapshot: ${filePath}`);
            } else if (error.code === 'EACCES') {
              console.warn(`Permission denied: ${filePath}`);
            } else {
              console.warn(`Error processing ${filePath}: ${error.message}`);
            }
            return null;
          }
        })
      );
      
      results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
    }
    
    // Build tree from results
    for (const { path, info } of results) {
      tree.files[path] = info;
      totalSize += info.size;
    }

    // Create metadata
    const metadata: SnapshotMetadata = {
      id,
      time: new Date().toISOString(),
      description: options.message,
      tags: options.tags,
      filesCount: Object.keys(tree.files).length,
      totalSize
    };

    // Save metadata and tree
    await fs.writeFile(
      path.join(snapshotDir, 'meta.yml'),
      yaml.dump(metadata),
      'utf8'
    );
    
    await fs.writeFile(
      path.join(snapshotDir, 'tree.yml'),
      yaml.dump(tree),
      'utf8'
    );

    return id;
  }

  async list(options: { tags?: string[]; limit?: number } = {}): Promise<SnapshotMetadata[]> {
    await this.init();
    
    const snapshots: SnapshotMetadata[] = [];
    const dirs = await fs.readdir(this.snapshotsPath);

    for (const dir of dirs) {
      const metaPath = path.join(this.snapshotsPath, dir, 'meta.yml');
      
      try {
        const metaContent = await fs.readFile(metaPath, 'utf8');
        const metadata = yaml.load(metaContent) as SnapshotMetadata;
        
        // Validate required fields
        if (!metadata || typeof metadata !== 'object' || !metadata.id || !metadata.time) {
          continue;
        }
        
        // Filter by tags if specified
        if (options.tags && options.tags.length > 0) {
          const hasTag = options.tags.some(tag => 
            metadata.tags?.includes(tag)
          );
          if (!hasTag) continue;
        }
        
        snapshots.push(metadata);
      } catch {
        // Skip invalid snapshots
        continue;
      }
    }

    // Sort by time (newest first)
    snapshots.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    // Apply limit if specified
    if (options.limit) {
      return snapshots.slice(0, options.limit);
    }

    return snapshots;
  }

  async get(idOrName: string): Promise<Snapshot | null> {
    // Handle relative references like @-1, @2h
    if (idOrName.startsWith('@')) {
      const resolvedId = await this.resolveRelativeSnapshotId(idOrName);
      if (!resolvedId) return null;
      return this.getById(resolvedId);
    }
    
    // Try exact ID match first
    const byId = await this.getById(idOrName);
    if (byId) return byId;
    
    // Try to find by description/name
    const snapshots = await this.list();
    for (const meta of snapshots) {
      if (meta.description && meta.description.includes(idOrName)) {
        return this.getById(meta.id);
      }
    }
    
    return null;
  }

  private async getById(id: string): Promise<Snapshot | null> {
    const snapshotDir = path.join(this.snapshotsPath, id);
    
    try {
      const metaContent = await fs.readFile(
        path.join(snapshotDir, 'meta.yml'),
        'utf8'
      );
      const metadata = yaml.load(metaContent) as SnapshotMetadata;
      
      // Validate metadata
      if (!metadata || typeof metadata !== 'object' || !metadata.id || !metadata.time) {
        return null;
      }
      
      const treeContent = await fs.readFile(
        path.join(snapshotDir, 'tree.yml'),
        'utf8'
      );
      const tree = yaml.load(treeContent) as SnapshotTree;
      
      // Validate tree
      if (!tree || typeof tree !== 'object' || !tree.files || typeof tree.files !== 'object') {
        return null;
      }
      
      return {
        metadata,
        tree
      };
    } catch {
      return null;
    }
  }

  async diff(from: string, to?: string): Promise<GitChange[]> {
    const fromSnapshot = await this.resolveSnapshot(from);
    if (!fromSnapshot) {
      throw new Error(`Snapshot not found: ${from}`);
    }

    const changes: GitChange[] = [];
    
    if (!to) {
      // Compare snapshot to current working directory
      const currentFiles = await this.getCurrentFiles();
      const snapshotFiles = fromSnapshot.tree.files;
      
      // Find added files
      for (const file of Object.keys(currentFiles)) {
        if (!snapshotFiles[file]) {
          const content = await fs.readFile(
            path.join(this.rootPath, file),
            'utf8'
          );
          changes.push({
            file,
            status: 'added',
            additions: content.split('\n').length,
            deletions: 0,
            diff: this.createAddedDiff(content)
          });
        }
      }
      
      // Find modified and deleted files
      for (const [file, info] of Object.entries(snapshotFiles)) {
        if (!currentFiles[file]) {
          // Deleted file
          const content = await this.getObjectContent(info.hash);
          changes.push({
            file,
            status: 'deleted',
            additions: 0,
            deletions: content.split('\n').length,
            diff: this.createDeletedDiff(content)
          });
        } else if (currentFiles[file].hash !== info.hash) {
          // Modified file
          const oldContent = await this.getObjectContent(info.hash);
          const newContent = await fs.readFile(
            path.join(this.rootPath, file),
            'utf8'
          );
          
          const patch = diff.createPatch(file, oldContent, newContent);
          const stats = this.calculateDiffStats(patch);
          
          changes.push({
            file,
            status: 'modified',
            additions: stats.additions,
            deletions: stats.deletions,
            diff: patch
          });
        }
      }
    } else {
      // Compare two snapshots
      const toSnapshot = await this.resolveSnapshot(to);
      if (!toSnapshot) {
        throw new Error(`Snapshot not found: ${to}`);
      }
      
      // Similar logic for comparing two snapshots
      const fromFiles = fromSnapshot.tree.files;
      const toFiles = toSnapshot.tree.files;
      
      // Process additions, modifications, and deletions
      for (const [file, info] of Object.entries(toFiles)) {
        if (!fromFiles[file]) {
          // Added in 'to' snapshot
          const content = await this.getObjectContent(info.hash);
          changes.push({
            file,
            status: 'added',
            additions: content.split('\n').length,
            deletions: 0,
            diff: this.createAddedDiff(content)
          });
        } else if (fromFiles[file].hash !== info.hash) {
          // Modified
          const oldContent = await this.getObjectContent(fromFiles[file].hash);
          const newContent = await this.getObjectContent(info.hash);
          
          const patch = diff.createPatch(file, oldContent, newContent);
          const stats = this.calculateDiffStats(patch);
          
          changes.push({
            file,
            status: 'modified',
            additions: stats.additions,
            deletions: stats.deletions,
            diff: patch
          });
        }
      }
      
      // Check for deletions
      for (const [file, info] of Object.entries(fromFiles)) {
        if (!toFiles[file]) {
          const content = await this.getObjectContent(info.hash);
          changes.push({
            file,
            status: 'deleted',
            additions: 0,
            deletions: content.split('\n').length,
            diff: this.createDeletedDiff(content)
          });
        }
      }
    }
    
    return changes;
  }

  async clean(options: { olderThan?: string; keepTags?: string[] } = {}): Promise<number> {
    const snapshots = await this.list();
    let deleted = 0;
    
    for (const snapshot of snapshots) {
      let shouldDelete = false;
      
      // Check age
      if (options.olderThan) {
        const age = this.parseRelativeTime(options.olderThan);
        const snapshotTime = new Date(snapshot.time).getTime();
        if (Date.now() - snapshotTime > age) {
          shouldDelete = true;
        }
      }
      
      // Check tags to keep
      if (shouldDelete && options.keepTags && snapshot.tags) {
        const hasKeepTag = options.keepTags.some(tag => 
          snapshot.tags?.includes(tag)
        );
        if (hasKeepTag) {
          shouldDelete = false;
        }
      }
      
      if (shouldDelete) {
        await this.delete(snapshot.id);
        deleted++;
      }
    }
    
    // Clean up orphaned objects
    await this.cleanOrphanedObjects();
    
    return deleted;
  }

  private async delete(id: string): Promise<void> {
    const snapshotDir = path.join(this.snapshotsPath, id);
    await fs.rm(snapshotDir, { recursive: true, force: true });
  }

  private async resolveSnapshot(reference: string): Promise<Snapshot | null> {
    return this.get(reference);
  }

  private async resolveRelativeSnapshotId(reference: string): Promise<string | null> {
    const snapshots = await this.list();
    
    if (reference.match(/^@-\d+$/)) {
      // Handle @-1, @-2, etc.
      const index = parseInt(reference.substring(2), 10) - 1;
      if (index >= 0 && index < snapshots.length) {
        return snapshots[index].id;
      }
    }
    
    // Note: Time-based references (@2h, @30m) are now handled differently
    // They show all files changed in that time period, not snapshots
    
    return null;
  }

  private parseRelativeTime(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([mhdwM])$/);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value * 60 * 1000;           // minutes
      case 'h': return value * 60 * 60 * 1000;      // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      case 'M': return value * 30 * 24 * 60 * 60 * 1000; // months
      default: return 0;
    }
  }

  private async getFilesToSnapshot(options: SnapshotOptions): Promise<string[]> {
    const files: string[] = [];
    const ignorePatterns: string[] = [...(options.ignorePatterns || [])];
    
    // Default ignore patterns
    const defaultIgnores = [
      '.git',
      '.dex',
      'node_modules',
      'dist',
      'build',
      '.next',
      '.nuxt',
      '.cache',
      '.DS_Store',
      '*.log',
      'coverage',
      '.env.local',
      '.env.*.local',
      'vendor',
      '__pycache__',
      '*.pyc',
      '.pytest_cache',
      'target', // Rust
      'Cargo.lock',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ];
    
    // Read .gitignore if exists
    try {
      const gitignorePath = path.join(this.rootPath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      const gitignorePatterns = gitignoreContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      ignorePatterns.push(...gitignorePatterns);
    } catch {
      // .gitignore doesn't exist, that's ok
    }
    
    // Read .dexignore if exists
    try {
      const dexignorePath = path.join(this.rootPath, '.dex', '.dexignore');
      const dexignoreContent = await fs.readFile(dexignorePath, 'utf8');
      const dexignorePatterns = dexignoreContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      ignorePatterns.push(...dexignorePatterns);
    } catch {
      // .dexignore doesn't exist, that's ok
    }
    
    // Add defaults
    ignorePatterns.push(...defaultIgnores);
    
    const shouldIgnore = (filePath: string): boolean => {
      const parts = filePath.split(path.sep);
      
      // Check each pattern
      for (const pattern of ignorePatterns) {
        // Directory patterns
        if (pattern.endsWith('/')) {
          const dirPattern = pattern.slice(0, -1);
          if (parts.some(part => part === dirPattern)) {
            return true;
          }
        }
        
        // Check if any part of the path matches
        for (const part of parts) {
          if (this.matchPattern(part, pattern)) {
            return true;
          }
        }
        
        // Check full path
        if (this.matchPattern(filePath, pattern)) {
          return true;
        }
      }
      
      return false;
    };
    
    const walkDir = async (dir: string, relativePath = ''): Promise<void> => {
      try {
        const entries = await fs.readdir(path.join(this.rootPath, dir), { 
          withFileTypes: true 
        });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
          
          // Check if should ignore
          if (shouldIgnore(relPath)) continue;
          
          if (entry.isDirectory()) {
            await walkDir(fullPath, relPath);
          } else if (entry.isFile()) {
            // Apply path filter if specified
            if (!options.path || relPath.startsWith(options.path)) {
              files.push(relPath);
            }
          }
        }
      } catch (err) {
        // Skip directories we can't read
      }
    };
    
    await walkDir('.');
    
    // Add untracked files if requested
    if (options.includeUntracked) {
      const untracked = await this.gitExtractor.getUntrackedFiles();
      files.push(...untracked.filter(f => !shouldIgnore(f)));
    }
    
    return [...new Set(files)]; // Remove duplicates
  }

  private async getCurrentFiles(): Promise<{ [path: string]: { hash: string } }> {
    // Use the same file list logic as getFilesToSnapshot but without options
    const fileList = await this.getFilesToSnapshot({});
    const files: { [path: string]: { hash: string } } = {};
    
    for (const filePath of fileList) {
      try {
        // Prevent path traversal
        const fullPath = path.resolve(this.rootPath, filePath);
        if (!fullPath.startsWith(this.rootPath)) {
          console.warn(`Invalid file path detected: ${filePath}`);
          continue;
        }
        
        const hash = await this.hashFile(fullPath);
        files[filePath] = { hash };
      } catch {
        // Skip files we can't read
      }
    }
    
    return files;
  }

  private async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);
      let size = 0;
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      
      stream.on('data', data => {
        size += data.length;
        if (size > MAX_FILE_SIZE) {
          stream.destroy();
          reject(new Error(`File too large: ${filePath} (>${MAX_FILE_SIZE} bytes)`));
          return;
        }
        hash.update(data);
      });
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async storeObject(hash: string, filePath: string): Promise<void> {
    const objectPath = path.join(this.objectsPath, hash.substring(0, 2), hash);
    
    // Check if already exists
    try {
      await fs.access(objectPath);
      return;
    } catch {
      // Object doesn't exist, store it
    }
    
    // Create directory
    await fs.mkdir(path.dirname(objectPath), { recursive: true });
    
    // Copy and compress file
    const input = createReadStream(filePath);
    const output = createWriteStream(objectPath);
    const gzip = createGzip();
    
    await pipeline(input, gzip, output);
  }

  private async getObjectContent(hash: string): Promise<string> {
    const objectPath = path.join(this.objectsPath, hash.substring(0, 2), hash);
    
    const input = createReadStream(objectPath);
    const gunzip = createGunzip();
    
    let content = '';
    gunzip.on('data', chunk => content += chunk.toString());
    
    await pipeline(input, gunzip);
    return content;
  }

  private async cleanOrphanedObjects(): Promise<void> {
    // Get all referenced hashes
    const referencedHashes = new Set<string>();
    const snapshots = await this.list();
    
    for (const meta of snapshots) {
      const snapshot = await this.get(meta.id);
      if (snapshot) {
        for (const file of Object.values(snapshot.tree.files)) {
          referencedHashes.add(file.hash);
        }
      }
    }
    
    // Walk objects directory and remove unreferenced
    const walkObjects = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await walkObjects(fullPath);
          } else if (entry.isFile()) {
            const hash = entry.name;
            if (!referencedHashes.has(hash)) {
              await fs.unlink(fullPath);
            }
          }
        }
      } catch {
        // Skip errors
      }
    };
    
    await walkObjects(this.objectsPath);
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    // Handle different glob patterns
    
    // Exact match
    if (!pattern.includes('*') && !pattern.includes('?')) {
      return filePath === pattern;
    }
    
    // Convert glob to regex
    let regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*\*/g, '{{DOUBLESTAR}}')  // Temporary placeholder
      .replace(/\*/g, '[^/]*')  // * matches anything except /
      .replace(/\?/g, '.')  // ? matches single character
      .replace(/{{DOUBLESTAR}}/g, '.*');  // ** matches anything including /
    
    // Handle patterns that should match at any level
    if (!pattern.startsWith('/') && !pattern.includes('/')) {
      // Pattern like "*.log" should match at any level
      regexPattern = `(^|/)${regexPattern}$`;
    } else {
      regexPattern = `^${regexPattern}$`;
    }
    
    try {
      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    } catch {
      return false;
    }
  }

  private createAddedDiff(content: string): string {
    const lines = content.split('\n');
    return lines.map(line => `+${line}`).join('\n');
  }

  private createDeletedDiff(content: string): string {
    const lines = content.split('\n');
    return lines.map(line => `-${line}`).join('\n');
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

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
}