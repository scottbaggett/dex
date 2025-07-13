import { describe, it, expect } from 'vitest';
import { MarkdownFormatter } from '../src/templates/markdown';
import { JsonFormatter } from '../src/templates/json';
import { ExtractedContext, DexOptions } from '../src/types';

describe('Formatters', () => {
  const mockContext: ExtractedContext = {
    changes: [
      {
        file: 'src/test.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        diff: '+console.log("test");\n-console.log("old");',
      },
    ],
    scope: {
      filesChanged: 1,
      functionsModified: 0,
      linesAdded: 10,
      linesDeleted: 5,
    },
    metadata: {
      generated: '2025-07-13T12:00:00Z',
      repository: {
        name: 'test-repo',
        branch: 'main',
        commit: 'abc1234',
      },
      extraction: {
        depth: 'focused',
      },
      tokens: {
        estimated: 100,
      },
      tool: {
        name: 'dex',
        version: '0.1.0',
      },
    },
  };

  const mockOptions: DexOptions = {
    depth: 'focused',
    format: 'markdown',
  };

  describe('MarkdownFormatter', () => {
    it('should format basic context', () => {
      const formatter = new MarkdownFormatter();
      const output = formatter.format({ context: mockContext, options: mockOptions });
      
      expect(output).toContain('# Code Context');
      expect(output).toContain('## Scope');
      expect(output).toContain('**Files Changed:** 1');
      expect(output).toContain('## Changes');
      expect(output).toContain('src/test.ts');
    });

    it('should include task context when provided', () => {
      const formatter = new MarkdownFormatter();
      const contextWithTask: ExtractedContext = {
        ...mockContext,
        task: {
          description: 'Fix authentication bug',
          goals: ['Improve security', 'Fix token validation'],
        },
      };
      
      const output = formatter.format({ context: contextWithTask, options: mockOptions });
      
      expect(output).toContain('Fix authentication bug');
      expect(output).toContain('Improve security');
      expect(output).toContain('Fix token validation');
    });

    it('should include metadata by default', () => {
      const formatter = new MarkdownFormatter();
      const output = formatter.format({ context: mockContext, options: mockOptions });
      
      expect(output).toContain('## Metadata');
      expect(output).toContain('test-repo');
      expect(output).toContain('main');
      expect(output).toContain('abc1234');
      expect(output).toContain('**Estimated Tokens:** ~100');
    });

    it('should exclude metadata when noMetadata is true', () => {
      const formatter = new MarkdownFormatter();
      const optionsNoMetadata = { ...mockOptions, noMetadata: true };
      const output = formatter.format({ context: mockContext, options: optionsNoMetadata });
      
      expect(output).not.toContain('## Metadata');
      expect(output).not.toContain('Generated:');
    });
  });

  describe('JsonFormatter', () => {
    it('should format as valid JSON', () => {
      const formatter = new JsonFormatter();
      const output = formatter.format({ context: mockContext, options: mockOptions });
      
      expect(() => JSON.parse(output)).not.toThrow();
      
      const parsed = JSON.parse(output);
      expect(parsed.scope.filesChanged).toBe(1);
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.changes[0].file).toBe('src/test.ts');
    });
  });
});