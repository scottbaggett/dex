import { describe, it, expect } from 'vitest';
import { PromptGenerator } from '../src/core/prompts';
import { ExtractedContext, DexOptions } from '../src/types';

describe('PromptGenerator', () => {
  const createMockContext = (overrides: Partial<ExtractedContext> = {}): ExtractedContext => ({
    changes: [],
    scope: {
      filesChanged: 0,
      functionsModified: 0,
      linesAdded: 0,
      linesDeleted: 0
    },
    metadata: {
      generated: new Date().toISOString(),
      repository: { name: 'test-repo', branch: 'main', commit: 'abc123' },
      extraction: { depth: 'focused' },
      tokens: { estimated: 100 },
      tool: { name: 'dex', version: '0.1.0' }
    },
    ...overrides
  });

  describe('generate', () => {
    it('should use custom prompt when provided', () => {
      const context = createMockContext();
      const options: DexOptions = {
        prompt: 'Custom prompt for testing'
      };
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toBe('Custom prompt for testing');
    });

    it('should generate contextual prompt for small changes', () => {
      const context = createMockContext({
        changes: [
          { file: 'test.js', status: 'modified', additions: 10, deletions: 5, diff: '' }
        ],
        scope: { filesChanged: 1, functionsModified: 1, linesAdded: 10, linesDeleted: 5 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Review this focused change for:');
    });

    it('should generate contextual prompt for large changes', () => {
      const context = createMockContext({
        changes: Array(10).fill(null).map((_, i) => ({
          file: `file${i}.js`,
          status: 'modified' as const,
          additions: 50,
          deletions: 30,
          diff: ''
        })),
        scope: { filesChanged: 10, functionsModified: 20, linesAdded: 500, linesDeleted: 300 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Review this substantial changeset for:');
    });

    it('should include task context when provided', () => {
      const context = createMockContext({
        task: { description: 'Fix authentication bug in login flow' }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Fix authentication bug in login flow');
      expect(result).toContain('Whether the changes properly address the task');
    });

    it('should handle test file changes', () => {
      const context = createMockContext({
        changes: [
          { file: 'auth.test.js', status: 'modified', additions: 20, deletions: 5, diff: '' },
          { file: 'login.spec.ts', status: 'added', additions: 50, deletions: 0, diff: '' }
        ],
        scope: { filesChanged: 2, functionsModified: 5, linesAdded: 70, linesDeleted: 5 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Test coverage and quality');
    });

    it('should handle config file changes', () => {
      const context = createMockContext({
        changes: [
          { file: '.env.production', status: 'modified', additions: 3, deletions: 1, diff: '' },
          { file: 'config/database.js', status: 'modified', additions: 10, deletions: 5, diff: '' }
        ],
        scope: { filesChanged: 2, functionsModified: 0, linesAdded: 13, linesDeleted: 6 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Configuration changes and their impact');
    });

    it('should include language-specific concerns for TypeScript', () => {
      const context = createMockContext({
        changes: [
          { file: 'auth.ts', status: 'modified', additions: 30, deletions: 10, diff: '' },
          { file: 'types.d.ts', status: 'added', additions: 20, deletions: 0, diff: '' }
        ],
        scope: { filesChanged: 2, functionsModified: 3, linesAdded: 50, linesDeleted: 10 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('TypeScript-specific considerations:');
      expect(result).toContain('Type safety and any usage');
    });

    it('should include language-specific concerns for React', () => {
      const context = createMockContext({
        changes: [
          { file: 'Button.tsx', status: 'modified', additions: 40, deletions: 20, diff: '' },
          { file: 'hooks/useAuth.tsx', status: 'added', additions: 60, deletions: 0, diff: '' }
        ],
        scope: { filesChanged: 2, functionsModified: 4, linesAdded: 100, linesDeleted: 20 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('React/TypeScript-specific considerations:');
      expect(result).toContain('React hooks dependencies');
    });

    it('should add format hint for Grok', () => {
      const context = createMockContext();
      const options: DexOptions = { format: 'grok' };
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Provide structured JSON output');
    });

    it('should use prompt template when specified', () => {
      const context = createMockContext();
      const options: DexOptions = { promptTemplate: 'security' };
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('security audit');
    });

    it('should handle mixed file types', () => {
      const context = createMockContext({
        changes: [
          { file: 'server.py', status: 'modified', additions: 25, deletions: 10, diff: '' },
          { file: 'client.js', status: 'modified', additions: 30, deletions: 15, diff: '' },
          { file: 'README.md', status: 'modified', additions: 5, deletions: 2, diff: '' }
        ],
        scope: { filesChanged: 3, functionsModified: 4, linesAdded: 60, linesDeleted: 27 }
      });
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toMatchSnapshot();
      expect(result).toContain('Documentation accuracy and completeness');
    });
  });

  describe('analyzeContext', () => {
    it('should correctly identify file types', () => {
      const context = createMockContext({
        changes: [
          { file: 'app.ts', status: 'modified', additions: 10, deletions: 5, diff: '' },
          { file: 'style.css', status: 'added', additions: 20, deletions: 0, diff: '' },
          { file: 'test.spec.js', status: 'modified', additions: 15, deletions: 8, diff: '' }
        ]
      });
      
      // This is a private method, but we can test it indirectly through generate
      const result = PromptGenerator.generate(context, {});
      
      expect(result).toContain('Test coverage and quality'); // Because we have test files
    });

    it('should detect primary language correctly', () => {
      const context = createMockContext({
        changes: [
          { file: 'main.go', status: 'modified', additions: 50, deletions: 20, diff: '' },
          { file: 'utils.go', status: 'added', additions: 30, deletions: 0, diff: '' },
          { file: 'config.json', status: 'modified', additions: 5, deletions: 2, diff: '' }
        ]
      });
      
      const result = PromptGenerator.generate(context, {});
      
      expect(result).toContain('Go-specific considerations:');
      expect(result).toContain('Error handling patterns');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty context', () => {
      const context = createMockContext();
      const options: DexOptions = {};
      
      const result = PromptGenerator.generate(context, options);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with no file extensions', () => {
      const context = createMockContext({
        changes: [
          { file: 'Makefile', status: 'modified', additions: 10, deletions: 5, diff: '' },
          { file: 'Dockerfile', status: 'added', additions: 20, deletions: 0, diff: '' }
        ]
      });
      
      const result = PromptGenerator.generate(context, {});
      
      expect(result).toBeDefined();
      expect(result).not.toContain('-specific considerations:'); // No language detected
    });

    it('should handle very long task descriptions', () => {
      const longTask = 'This is a very long task description '.repeat(20);
      const context = createMockContext({
        task: { description: longTask }
      });
      
      const result = PromptGenerator.generate(context, {});
      
      expect(result).toContain(longTask);
    });
  });
});