import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ContextEngine } from '../src/core/context';
import { GitExtractor } from '../src/core/git';
import { promises as fs } from 'fs';
import { readFileSync } from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('../src/core/git');
vi.mock('../src/core/snapshot');
vi.mock('../src/core/task-extractor');
vi.mock('fs/promises');
vi.mock('fs');

describe('ContextEngine', () => {
  let contextEngine: ContextEngine;
  let mockGitExtractor: any;
  const mockWorkingDir = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock GitExtractor
    mockGitExtractor = {
      getCurrentChanges: vi.fn().mockResolvedValue([]),
      getChangesInRange: vi.fn().mockResolvedValue([]),
      getChangesSince: vi.fn().mockResolvedValue([]),
      getFileContent: vi.fn().mockResolvedValue(''),
      getUntrackedFiles: vi.fn().mockResolvedValue([]),
      getTrackedFiles: vi.fn().mockResolvedValue([]),
      getFileContentFromHead: vi.fn().mockResolvedValue(''),
      isGitRepository: vi.fn().mockResolvedValue(true),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getLatestCommit: vi.fn().mockResolvedValue('abc123'),
      getRepositoryName: vi.fn().mockResolvedValue('test-repo'),
      getRepositoryRoot: vi.fn().mockResolvedValue(mockWorkingDir),
      addFileModificationTimes: vi.fn().mockImplementation((changes) => Promise.resolve(changes)),
    };
    
    (GitExtractor as any).mockImplementation(() => mockGitExtractor);
    
    // Mock package.json
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      name: 'dex',
      version: '0.1.0'
    }));
    
    contextEngine = new ContextEngine(mockWorkingDir);
  });

  describe('Time-based change extraction', () => {
    it('should extract files changed in the last 2 hours', async () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const threeHoursAgo = now - (3 * 60 * 60 * 1000);
      
      // Mock tracked files
      mockGitExtractor.getTrackedFiles.mockResolvedValue([
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ]);
      
      // Mock file stats
      (fs.stat as Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('file1.ts')) {
          return Promise.resolve({ mtime: new Date(oneHourAgo) });
        } else if (filePath.includes('file2.ts')) {
          return Promise.resolve({ mtime: new Date(threeHoursAgo) });
        } else {
          return Promise.resolve({ mtime: new Date(now) });
        }
      });
      
      // Mock file contents
      mockGitExtractor.getFileContentFromHead.mockResolvedValue('old content');
      (fs.readFile as Mock).mockResolvedValue('new content');
      
      // Mock untracked files
      mockGitExtractor.getUntrackedFiles.mockResolvedValue(['new-file.ts']);
      
      const result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '2h',
      });
      
      // Should include file1 (1 hour ago) and file3 (now), but not file2 (3 hours ago)
      expect(result.changes).toHaveLength(3); // file1, file3, and new-file
      expect(result.changes.map(c => c.file)).toContain('src/file1.ts');
      expect(result.changes.map(c => c.file)).toContain('src/file3.ts');
      expect(result.changes.map(c => c.file)).toContain('new-file.ts');
      expect(result.changes.map(c => c.file)).not.toContain('src/file2.ts');
    });

    it('should handle different time units', async () => {
      const now = Date.now();
      
      mockGitExtractor.getTrackedFiles.mockResolvedValue(['file.ts']);
      mockGitExtractor.getUntrackedFiles.mockResolvedValue([]);
      
      // Test minutes
      (fs.stat as Mock).mockResolvedValue({ mtime: new Date(now - 30 * 60 * 1000) }); // 30 minutes ago
      mockGitExtractor.getFileContentFromHead.mockResolvedValue('old');
      (fs.readFile as Mock).mockResolvedValue('new');
      
      let result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '45m', // 45 minutes
      });
      
      expect(result.changes).toHaveLength(1);
      
      // Test days
      (fs.stat as Mock).mockResolvedValue({ mtime: new Date(now - 2 * 24 * 60 * 60 * 1000) }); // 2 days ago
      
      result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '1d', // 1 day
      });
      
      expect(result.changes).toHaveLength(0); // File is too old
      
      result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '3d', // 3 days
      });
      
      expect(result.changes).toHaveLength(1); // File is within range
    });

    it('should handle untracked files with time-based filtering', async () => {
      const now = Date.now();
      
      mockGitExtractor.getTrackedFiles.mockResolvedValue([]);
      mockGitExtractor.getUntrackedFiles.mockResolvedValue(['new1.ts', 'new2.ts']);
      
      (fs.stat as Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('new1.ts')) {
          return Promise.resolve({ mtime: new Date(now - 10 * 60 * 1000) }); // 10 minutes ago
        } else {
          return Promise.resolve({ mtime: new Date(now - 2 * 60 * 60 * 1000) }); // 2 hours ago
        }
      });
      
      (fs.readFile as Mock).mockResolvedValue('file content\nline 2\nline 3');
      
      const result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '30m',
      });
      
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].file).toBe('new1.ts');
      expect(result.changes[0].status).toBe('added');
      expect(result.changes[0].additions).toBe(3);
    });

    it('should handle files that have not changed', async () => {
      const now = Date.now();
      
      mockGitExtractor.getTrackedFiles.mockResolvedValue(['unchanged.ts']);
      mockGitExtractor.getUntrackedFiles.mockResolvedValue([]);
      
      (fs.stat as Mock).mockResolvedValue({ mtime: new Date(now - 10 * 60 * 1000) });
      
      // File content is the same in HEAD and working directory
      const sameContent = 'unchanged content';
      mockGitExtractor.getFileContentFromHead.mockResolvedValue(sameContent);
      (fs.readFile as Mock).mockResolvedValue(sameContent);
      
      const result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '1h',
      });
      
      expect(result.changes).toHaveLength(0);
    });

    it('should handle invalid time range format', async () => {
      await expect(contextEngine.extract({
        isTimeRange: true,
        timeRange: 'invalid',
      })).rejects.toThrow('Invalid time range format: invalid');
    });

    it('should handle file access errors gracefully', async () => {
      mockGitExtractor.getTrackedFiles.mockResolvedValue(['file1.ts', 'file2.ts']);
      mockGitExtractor.getUntrackedFiles.mockResolvedValue([]);
      
      // file1 throws error, file2 succeeds
      (fs.stat as Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('file1.ts')) {
          return Promise.reject(new Error('Permission denied'));
        } else {
          return Promise.resolve({ mtime: new Date() });
        }
      });
      
      mockGitExtractor.getFileContentFromHead.mockResolvedValue('old');
      (fs.readFile as Mock).mockResolvedValue('new');
      
      const result = await contextEngine.extract({
        isTimeRange: true,
        timeRange: '1h',
      });
      
      // Should only include file2, not file1
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].file).toBe('file2.ts');
    });
  });

  describe('Regular extraction modes', () => {
    it('should extract current changes', async () => {
      const mockChanges = [
        {
          file: 'test.ts',
          status: 'modified',
          additions: 5,
          deletions: 2,
          diff: 'diff content',
        },
      ];
      
      mockGitExtractor.getCurrentChanges.mockResolvedValue(mockChanges);
      
      const result = await contextEngine.extract({});
      
      expect(result.changes).toEqual(mockChanges);
      expect(mockGitExtractor.getCurrentChanges).toHaveBeenCalledWith(undefined);
    });

    it('should extract staged changes', async () => {
      const mockChanges = [
        {
          file: 'staged.ts',
          status: 'modified',
          additions: 3,
          deletions: 1,
          diff: 'staged diff',
        },
      ];
      
      mockGitExtractor.getCurrentChanges.mockResolvedValue(mockChanges);
      
      const result = await contextEngine.extract({ staged: true });
      
      expect(result.changes).toEqual(mockChanges);
      expect(mockGitExtractor.getCurrentChanges).toHaveBeenCalledWith(true);
    });
  });
});