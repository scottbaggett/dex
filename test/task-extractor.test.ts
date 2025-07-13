import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskExtractor } from '../src/core/task-extractor';
import { TaskContext } from '../src/types';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

vi.mock('fs/promises');
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('TaskExtractor', () => {
  let extractor: TaskExtractor;

  beforeEach(() => {
    extractor = new TaskExtractor();
    vi.clearAllMocks();
  });

  describe('extractFromText', () => {
    it('should extract simple text task', async () => {
      const result = await extractor.extract({
        type: 'text',
        source: 'Fix authentication bug'
      });

      expect(result.description).toBe('Fix authentication bug');
    });

    it('should extract goals from text', async () => {
      const result = await extractor.extract({
        type: 'text',
        source: 'Implement search\nTODO: Add filters\nGoal: Improve performance'
      });

      expect(result.description).toBe('Implement search\nTODO: Add filters\nGoal: Improve performance');
      expect(result.goals).toBeDefined();
      expect(result.goals).toHaveLength(2);
    });
  });

  describe('extractFromFile', () => {
    it('should parse markdown file', async () => {
      const mockContent = `# Fix User Authentication

## Description
The login system is broken after the OAuth update.

## Goals
- Fix token validation
- Update OAuth scopes
- Add error handling

Tags: bug, auth, urgent`;

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      vi.mocked(fsSync.existsSync).mockReturnValue(true);

      const result = await extractor.extract({
        type: 'file',
        source: 'task.md'
      });

      expect(result.description).toBe('Fix User Authentication');
      expect(result.goals).toHaveLength(3);
      expect(result.goals).toContain('Fix token validation');
      expect(result.labels).toContain('bug');
      expect(result.labels).toContain('auth');
      expect(result.labels).toContain('urgent');
    });

    it('should parse JSON file', async () => {
      const mockJson = {
        title: 'Implement caching',
        description: 'Add Redis caching layer',
        goals: ['Setup Redis', 'Cache API responses'],
        labels: ['enhancement', 'backend']
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJson));
      vi.mocked(fsSync.existsSync).mockReturnValue(true);

      const result = await extractor.extract({
        type: 'file',
        source: 'task.json'
      });

      expect(result.description).toBe('Add Redis caching layer');
      expect(result.goals).toHaveLength(2);
      expect(result.labels).toContain('enhancement');
    });

    it('should parse plain text file', async () => {
      const mockContent = `Update API documentation

- Document new endpoints
- Add authentication examples
- Update response schemas`;

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);
      vi.mocked(fsSync.existsSync).mockReturnValue(true);

      const result = await extractor.extract({
        type: 'file',
        source: 'TODO.txt'
      });

      expect(result.description).toBe('Update API documentation');
      expect(result.goals).toHaveLength(3);
      expect(result.goals?.[0]).toBe('Document new endpoints');
    });

    it('should throw error for non-existent file', async () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);

      await expect(extractor.extract({
        type: 'file',
        source: 'missing.md'
      })).rejects.toThrow('Task file not found');
    });
  });

  describe('markdown parsing', () => {
    it('should handle various markdown formats', async () => {
      const variations = [
        {
          content: '## Task\nImplement feature X',
          expectedDesc: 'Implement feature X'
        },
        {
          content: '# Bug: Login fails\n\nUsers cannot login with email',
          expectedDesc: 'Bug: Login fails'
        },
        {
          content: 'Fix the broken build\n\n## Objectives\n- Update deps\n- Fix tests',
          expectedDesc: 'Fix the broken build'
        }
      ];

      for (const { content, expectedDesc } of variations) {
        vi.mocked(fs.readFile).mockResolvedValue(content);
        vi.mocked(fsSync.existsSync).mockReturnValue(true);

        const result = await extractor.extract({
          type: 'file',
          source: 'task.md'
        });

        expect(result.description).toBe(expectedDesc);
      }
    });
  });
});