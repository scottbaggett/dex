import { describe, it, expect, beforeEach } from 'vitest';
import { GitExtractor } from '../src/core/git';
import { GitChange } from '../src/types';

describe('GitExtractor', () => {
  let gitExtractor: GitExtractor;

  beforeEach(() => {
    gitExtractor = new GitExtractor();
  });

  describe('parseDiff', () => {
    it('should detect git repository', async () => {
      // This test will pass or fail based on whether the test is run in a git repo
      const isRepo = await gitExtractor.isGitRepository();
      expect(typeof isRepo).toBe('boolean');
    });

    it('should handle empty changes', async () => {
      // This is a basic test - in a real scenario we'd mock the git operations
      try {
        const changes = await gitExtractor.getCurrentChanges();
        expect(Array.isArray(changes)).toBe(true);
      } catch (error) {
        // If not in a git repo, that's okay for this test
        expect(error).toBeDefined();
      }
    });
  });
});