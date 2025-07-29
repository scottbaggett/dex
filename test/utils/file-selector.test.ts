import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSelector } from '../../src/utils/file-selector';
import { GitChange } from '../../src/types';
import { statSync } from 'fs';
import simpleGit from 'simple-git';

// Mock dependencies
vi.mock('fs');
vi.mock('simple-git');
vi.mock('../../src/utils/file-scanner');
vi.mock('../../src/core/git');

describe('FileSelector', () => {
  let fileSelector: FileSelector;

  beforeEach(() => {
    fileSelector = new FileSelector();
    vi.clearAllMocks();
  });

  describe('enhanceGitChanges', () => {
    it('should enhance GitChange objects with file size and status info', async () => {
      const mockChanges: GitChange[] = [
        {
          file: 'src/index.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          diff: 'mock diff',
        },
        {
          file: 'src/new-file.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          diff: 'mock diff',
        },
      ];

      // Mock git status
      const mockGit = {
        status: vi.fn().mockResolvedValue({
          staged: ['src/index.ts'],
          modified: [],
          not_added: ['src/new-file.ts'],
        }),
      };
      vi.mocked(simpleGit).mockReturnValue(mockGit as any);

      // Mock file stats
      vi.mocked(statSync).mockImplementation((path) => {
        if (path.includes('index.ts')) {
          return { size: 1024 } as any;
        }
        return { size: 2048 } as any;
      });

      const enhanced = await fileSelector['enhanceGitChanges'](mockChanges);

      expect(enhanced[0]).toMatchObject({
        file: 'src/index.ts',
        fileSize: 1024,
        isStaged: true,
        isUnstaged: false,
        isUntracked: false,
      });

      expect(enhanced[1]).toMatchObject({
        file: 'src/new-file.ts',
        fileSize: 2048,
        isStaged: false,
        isUnstaged: false,
        isUntracked: true,
      });
    });
  });

  describe('filterChanges', () => {
    const mockEnhancedChanges = [
      {
        file: 'staged.ts',
        status: 'modified' as const,
        additions: 10,
        deletions: 5,
        diff: '',
        isStaged: true,
        isUnstaged: false,
        isUntracked: false,
      },
      {
        file: 'unstaged.ts',
        status: 'modified' as const,
        additions: 5,
        deletions: 3,
        diff: '',
        isStaged: false,
        isUnstaged: true,
        isUntracked: false,
      },
      {
        file: 'untracked.ts',
        status: 'added' as const,
        additions: 20,
        deletions: 0,
        diff: '',
        isStaged: false,
        isUnstaged: false,
        isUntracked: true,
      },
    ];

    it('should return all changes when filter is "all"', () => {
      const filtered = fileSelector['filterChanges'](mockEnhancedChanges, 'all');
      expect(filtered).toHaveLength(3);
    });

    it('should filter staged files', () => {
      const filtered = fileSelector['filterChanges'](mockEnhancedChanges, 'staged');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('staged.ts');
    });

    it('should filter unstaged files', () => {
      const filtered = fileSelector['filterChanges'](mockEnhancedChanges, 'unstaged');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('unstaged.ts');
    });

    it('should filter untracked files', () => {
      const filtered = fileSelector['filterChanges'](mockEnhancedChanges, 'untracked');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('untracked.ts');
    });

    it('should filter by status', () => {
      const filtered = fileSelector['filterChanges'](mockEnhancedChanges, 'added');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe('untracked.ts');
    });
  });

  describe('sortChanges', () => {
    const mockChanges = [
      {
        file: 'b.ts',
        status: 'modified' as const,
        additions: 10,
        deletions: 5,
        diff: '',
        fileSize: 2000,
        lastModified: new Date('2024-01-02'),
      },
      {
        file: 'a.ts',
        status: 'added' as const,
        additions: 20,
        deletions: 0,
        diff: '',
        fileSize: 1000,
        lastModified: new Date('2024-01-03'),
      },
      {
        file: 'c.ts',
        status: 'deleted' as const,
        additions: 0,
        deletions: 30,
        diff: '',
        fileSize: 3000,
        lastModified: new Date('2024-01-01'),
      },
    ];

    it('should sort by name ascending', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'name', 'asc');
      expect(sorted.map((c) => c.file)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('should sort by name descending', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'name', 'desc');
      expect(sorted.map((c) => c.file)).toEqual(['c.ts', 'b.ts', 'a.ts']);
    });

    it('should sort by size ascending', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'size', 'asc');
      expect(sorted.map((c) => c.fileSize)).toEqual([1000, 2000, 3000]);
    });

    it('should sort by size descending', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'size', 'desc');
      expect(sorted.map((c) => c.fileSize)).toEqual([3000, 2000, 1000]);
    });

    it('should sort by updated date ascending', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'updated', 'asc');
      expect(sorted.map((c) => c.file)).toEqual(['c.ts', 'b.ts', 'a.ts']);
    });

    it('should sort by updated date descending', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'updated', 'desc');
      expect(sorted.map((c) => c.file)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('should sort by status', () => {
      const sorted = fileSelector['sortChanges'](mockChanges, 'status', 'asc');
      expect(sorted.map((c) => c.status)).toEqual(['added', 'deleted', 'modified']);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(fileSelector['formatFileSize'](0)).toBe('0 B');
      expect(fileSelector['formatFileSize'](100)).toBe('100 B');
      expect(fileSelector['formatFileSize'](1024)).toBe('1 KB');
      expect(fileSelector['formatFileSize'](1536)).toBe('1.5 KB');
      expect(fileSelector['formatFileSize'](1048576)).toBe('1 MB');
      expect(fileSelector['formatFileSize'](1073741824)).toBe('1 GB');
    });
  });

  describe('getRelativeTime', () => {
    it('should format relative times correctly', () => {
      const now = new Date();

      expect(fileSelector['getRelativeTime'](now)).toBe('just now');

      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(fileSelector['getRelativeTime'](fiveMinutesAgo)).toBe('5m ago');

      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(fileSelector['getRelativeTime'](twoHoursAgo)).toBe('2h ago');

      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(fileSelector['getRelativeTime'](threeDaysAgo)).toBe('3d ago');

      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      expect(fileSelector['getRelativeTime'](twoWeeksAgo)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('getStatusBadge', () => {
    it('should return correct badges for different statuses', () => {
      const staged = {
        file: 'test.ts',
        status: 'modified' as const,
        additions: 10,
        deletions: 5,
        diff: '',
        isStaged: true,
      };
      expect(fileSelector['getStatusBadge'](staged)).toContain('●');

      const untracked = {
        file: 'test.ts',
        status: 'added' as const,
        additions: 20,
        deletions: 0,
        diff: '',
        isUntracked: true,
      };
      expect(fileSelector['getStatusBadge'](untracked)).toContain('?');
      expect(fileSelector['getStatusBadge'](untracked)).toContain('+');
    });
  });

  describe('getOptionsHelp', () => {
    it('should return help text with all options', () => {
      const help = FileSelector.getOptionsHelp();

      expect(help).toContain('Sorting Options');
      expect(help).toContain('--sort-by');
      expect(help).toContain('name');
      expect(help).toContain('updated');
      expect(help).toContain('size');
      expect(help).toContain('status');

      expect(help).toContain('Filtering Options');
      expect(help).toContain('--filter-by');
      expect(help).toContain('staged');
      expect(help).toContain('unstaged');
      expect(help).toContain('untracked');

      expect(help).toContain('Examples');
    });
  });
});
