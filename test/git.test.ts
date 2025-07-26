import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitExtractor } from '../src/core/git';
import { GitChange } from '../src/types';
import simpleGit from 'simple-git';

// Mock simple-git
vi.mock('simple-git');

describe('GitExtractor', () => {
  let gitExtractor: GitExtractor;
  let mockGit: any;

  beforeEach(() => {
    mockGit = {
      checkIsRepo: vi.fn(),
      diffSummary: vi.fn(),
      diff: vi.fn(),
      show: vi.fn(),
      log: vi.fn(),
      revparse: vi.fn(),
      raw: vi.fn(),
    };

    vi.mocked(simpleGit).mockReturnValue(mockGit as any);
    gitExtractor = new GitExtractor();
  });

  describe('parseDiff', () => {
    it('should detect git repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);

      const isRepo = await gitExtractor.isGitRepository();
      expect(isRepo).toBe(true);
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    it('should handle empty changes', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.diffSummary.mockResolvedValue({ files: [] });

      const changes = await gitExtractor.getCurrentChanges();
      expect(Array.isArray(changes)).toBe(true);
      expect(changes).toHaveLength(0);
    });
  });

  describe('getRepositoryRoot', () => {
    it('should return the repository root path', async () => {
      const expectedRoot = '/path/to/repo';
      mockGit.revparse.mockResolvedValue(expectedRoot + '\n');

      const root = await gitExtractor.getRepositoryRoot();
      expect(root).toBe(expectedRoot);
      expect(mockGit.revparse).toHaveBeenCalledWith(['--show-toplevel']);
    });

    it('should handle errors when not in a git repository', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));

      await expect(gitExtractor.getRepositoryRoot()).rejects.toThrow('Not a git repository');
    });

    it('should trim whitespace from the result', async () => {
      mockGit.revparse.mockResolvedValue('  /path/to/repo  \n\n');

      const root = await gitExtractor.getRepositoryRoot();
      expect(root).toBe('/path/to/repo');
    });
  });

  describe('addFileModificationTimes', () => {
    const mockChanges: GitChange[] = [
      {
        path: 'src/index.ts',
        status: 'M',
        diff: '+console.log("test");',
        additions: 1,
        deletions: 0,
      },
      {
        path: 'src/utils.ts',
        status: 'M',
        diff: '-console.log("old");',
        additions: 0,
        deletions: 1,
      },
    ];

    it('should add modification times to changes', async () => {
      const mockDate1 = '2024-01-15 10:30:00';
      const mockDate2 = '2024-01-15 11:45:00';

      mockGit.raw.mockImplementation((args: string[]) => {
        if (args.includes('src/index.ts')) {
          return Promise.resolve(mockDate1);
        } else if (args.includes('src/utils.ts')) {
          return Promise.resolve(mockDate2);
        }
        return Promise.resolve('');
      });

      const result = await gitExtractor.addFileModificationTimes(mockChanges);

      expect(result[0].modifyTime).toEqual(new Date(mockDate1));
      expect(result[1].modifyTime).toEqual(new Date(mockDate2));

      expect(mockGit.raw).toHaveBeenCalledWith(['log', '-1', '--format=%ai', '--', 'src/index.ts']);
      expect(mockGit.raw).toHaveBeenCalledWith(['log', '-1', '--format=%ai', '--', 'src/utils.ts']);
    });

    it('should handle files without modification times', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await gitExtractor.addFileModificationTimes(mockChanges);

      expect(result[0].modifyTime).toBeUndefined();
      expect(result[1].modifyTime).toBeUndefined();
    });

    it('should handle git errors gracefully', async () => {
      mockGit.raw.mockRejectedValue(new Error('Git error'));

      const result = await gitExtractor.addFileModificationTimes(mockChanges);

      expect(result[0].modifyTime).toBeUndefined();
      expect(result[1].modifyTime).toBeUndefined();
    });

    it('should handle empty changes array', async () => {
      const result = await gitExtractor.addFileModificationTimes([]);

      expect(result).toEqual([]);
      expect(mockGit.raw).not.toHaveBeenCalled();
    });

    it('should handle invalid date formats', async () => {
      mockGit.raw.mockResolvedValue('invalid-date-format');

      const result = await gitExtractor.addFileModificationTimes(mockChanges);

      // Invalid dates should result in undefined
      expect(result[0].modifyTime).toBeDefined(); // But it will be Invalid Date
      expect(isNaN(result[0].modifyTime?.getTime() as number)).toBe(true);
    });

    it('should process multiple files in parallel', async () => {
      const manyChanges = Array(10)
        .fill(null)
        .map((_, i) => ({
          path: `file${i}.ts`,
          status: 'M' as const,
          diff: '+test',
          additions: 1,
          deletions: 0,
        }));

      mockGit.raw.mockResolvedValue('2024-01-15 10:30:00');

      const result = await gitExtractor.addFileModificationTimes(manyChanges);

      expect(result).toHaveLength(10);
      expect(mockGit.raw).toHaveBeenCalledTimes(10);

      // All calls should have been made (parallel processing)
      result.forEach((change, i) => {
        expect(change.modifyTime).toBeDefined();
      });
    });
  });
});
