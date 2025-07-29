import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { XmlFormatter } from '../src/templates/xml';
import { ExtractedContext, GitChange } from '../src/types';

describe('Combine Command', () => {
  const testDir = join(__dirname, 'temp-combine-test');
  const testFile1 = join(testDir, 'test1.ts');
  const testFile2 = join(testDir, 'test2.js');

  beforeEach(() => {
    // Create test directory and files
    mkdirSync(testDir, { recursive: true });

    writeFileSync(
      testFile1,
      `// TypeScript file
export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

export class Greeter {
  constructor(private name: string) {}

  greet(): string {
    return hello(this.name);
  }
}`
    );

    writeFileSync(
      testFile2,
      `// JavaScript file
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };`
    );
  });

  afterEach(() => {
    // Clean up test files
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('XmlFormatter', () => {
    it('should format multiple files into XML structure', () => {
      const changes: GitChange[] = [
        {
          file: 'test1.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          diff: '',
        },
        {
          file: 'test2.js',
          status: 'added',
          additions: 8,
          deletions: 0,
          diff: '',
        },
      ];

      const fullFiles = new Map<string, string>();
      fullFiles.set(
        'test1.ts',
        `// TypeScript file
export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}`
      );
      fullFiles.set(
        'test2.js',
        `// JavaScript file
function add(a, b) {
  return a + b;
}`
      );

      const context: ExtractedContext = {
        changes,
        scope: {
          filesChanged: 2,
          functionsModified: 0,
          linesAdded: 18,
          linesDeleted: 0,
        },
        fullFiles,
        metadata: {
          generated: '2024-01-01T00:00:00.000Z',
          repository: {
            name: 'test-repo',
            branch: 'main',
            commit: 'abc123',
          },
          extraction: {
            method: 'combine',
          },
          tokens: {
            estimated: 100,
          },
          tool: {
            name: 'dex',
            version: '1.0.0',
          },
        },
      };

      const formatter = new XmlFormatter();
      const result = formatter.format({
        context,
        options: { noPrompt: true },
      });

      // Verify XML structure
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<code_context>');
      expect(result).toContain('</code_context>');
      expect(result).toContain('<title>Code Context</title>');
      expect(result).toContain('<metadata>');
      expect(result).toContain('<scope>');
      expect(result).toContain('<changes>');
      expect(result).toContain('<files_changed>2</files_changed>');
      expect(result).toContain('<lines_added>18</lines_added>');

      // Verify file content is included
      expect(result).toContain('<path>test1.ts</path>');
      expect(result).toContain('<path>test2.js</path>');
      expect(result).toContain('<content language="typescript">');
      expect(result).toContain('<content language="javascript">');
      expect(result).toContain('<![CDATA[// TypeScript file');
      expect(result).toContain('<![CDATA[// JavaScript file');
    });

    it('should escape XML special characters properly', () => {
      const changes: GitChange[] = [
        {
          file: 'test.xml',
          status: 'added',
          additions: 1,
          deletions: 0,
          diff: '',
        },
      ];

      const fullFiles = new Map<string, string>();
      fullFiles.set('test.xml', '<tag>Content with & < > " \' characters</tag>');

      const context: ExtractedContext = {
        changes,
        scope: {
          filesChanged: 1,
          functionsModified: 0,
          linesAdded: 1,
          linesDeleted: 0,
        },
        fullFiles,
        metadata: {
          generated: '2024-01-01T00:00:00.000Z',
          repository: {
            name: 'test-repo',
            branch: 'main',
            commit: 'abc123',
          },
          extraction: {
            method: 'combine',
          },
          tokens: {
            estimated: 50,
          },
          tool: {
            name: 'dex',
            version: '1.0.0',
          },
        },
      };

      const formatter = new XmlFormatter();
      const result = formatter.format({
        context,
        options: { noPrompt: true },
      });

      // Content should be in CDATA section, so special characters are preserved
      expect(result).toContain('<![CDATA[<tag>Content with & < > " \' characters</tag>]]>');

      // But XML attributes should be escaped
      expect(result).toContain('<path>test.xml</path>');
    });

    it('should include task context when provided', () => {
      const changes: GitChange[] = [
        {
          file: 'test.ts',
          status: 'added',
          additions: 5,
          deletions: 0,
          diff: '',
        },
      ];

      const context: ExtractedContext = {
        changes,
        scope: {
          filesChanged: 1,
          functionsModified: 0,
          linesAdded: 5,
          linesDeleted: 0,
        },
        task: {
          description: 'Add new feature for user authentication',
          goals: ['Implement login', 'Add security'],
          issueUrl: 'https://github.com/example/repo/issues/123',
          issueTitle: 'User Authentication Feature',
          labels: ['feature', 'security'],
        },
        metadata: {
          generated: '2024-01-01T00:00:00.000Z',
          repository: {
            name: 'test-repo',
            branch: 'main',
            commit: 'abc123',
          },
          extraction: {
            method: 'combine',
          },
          tokens: {
            estimated: 50,
          },
          tool: {
            name: 'dex',
            version: '1.0.0',
          },
        },
      };

      const formatter = new XmlFormatter();
      const result = formatter.format({
        context,
        options: { noPrompt: true },
      });

      expect(result).toContain('<task_overview>');
      expect(result).toContain(
        '<description>Add new feature for user authentication</description>'
      );
      expect(result).toContain('<goals>');
      expect(result).toContain('<goal>Implement login</goal>');
      expect(result).toContain('<goal>Add security</goal>');
      expect(result).toContain('<issue>');
      expect(result).toContain('<url>https://github.com/example/repo/issues/123</url>');
      expect(result).toContain('<title>User Authentication Feature</title>');
      expect(result).toContain('<labels>');
      expect(result).toContain('<label>feature</label>');
      expect(result).toContain('<label>security</label>');
    });

    it('should exclude metadata when noMetadata option is true', () => {
      const changes: GitChange[] = [
        {
          file: 'test.ts',
          status: 'added',
          additions: 5,
          deletions: 0,
          diff: '',
        },
      ];

      const context: ExtractedContext = {
        changes,
        scope: {
          filesChanged: 1,
          functionsModified: 0,
          linesAdded: 5,
          linesDeleted: 0,
        },
        metadata: {
          generated: '2024-01-01T00:00:00.000Z',
          repository: {
            name: 'test-repo',
            branch: 'main',
            commit: 'abc123',
          },
          extraction: {
            method: 'combine',
          },
          tokens: {
            estimated: 50,
          },
          tool: {
            name: 'dex',
            version: '1.0.0',
          },
        },
      };

      const formatter = new XmlFormatter();
      const result = formatter.format({
        context,
        options: { noMetadata: true, noPrompt: true },
      });

      expect(result).not.toContain('<metadata>');
      expect(result).toContain('<scope>');
      expect(result).toContain('<changes>');
    });
  });

  describe('Staged Files Integration', () => {
    it('should handle staged files extraction method in metadata', () => {
      const changes: GitChange[] = [
        {
          file: 'staged-file.ts',
          status: 'modified',
          additions: 15,
          deletions: 2,
          diff: '',
        },
      ];

      const fullFiles = new Map<string, string>();
      fullFiles.set(
        'staged-file.ts',
        `// Staged TypeScript file
export function stagedFunction(): string {
  return 'This file is staged';
}

export const stagedConst = 'staged-value';`
      );

      const context: ExtractedContext = {
        changes,
        scope: {
          filesChanged: 1,
          functionsModified: 0,
          linesAdded: 15,
          linesDeleted: 2,
        },
        fullFiles,
        metadata: {
          generated: '2024-01-01T00:00:00.000Z',
          repository: {
            name: 'staged-changes',
            branch: 'feature-branch',
            commit: 'def456',
          },
          extraction: {
            method: 'staged-files-combine',
          },
          tokens: {
            estimated: 120,
          },
          tool: {
            name: 'dex',
            version: '1.0.0',
          },
        },
      };

      const formatter = new XmlFormatter();
      const result = formatter.format({
        context,
        options: { noPrompt: true },
      });

      // Verify staged-specific metadata
      expect(result).toContain('<repository>');
      expect(result).toContain('<name>staged-changes</name>');
      expect(result).toContain('<branch>feature-branch</branch>');
      expect(result).toContain('<commit>def456</commit>');
      expect(result).toContain('<extraction>');
      expect(result).toContain('<method>staged-files-combine</method>');

      // Verify file shows as modified (not added)
      expect(result).toContain('<status>modified</status>');
      expect(result).toContain('<path>staged-file.ts</path>');
      expect(result).toContain('<additions>15</additions>');
      expect(result).toContain('<deletions>2</deletions>');

      // Verify content is included
      expect(result).toContain('<![CDATA[// Staged TypeScript file');
      expect(result).toContain('export function stagedFunction()');
    });

    it('should include token savings calculation for staged files', () => {
      const changes: GitChange[] = [
        {
          file: 'staged1.ts',
          status: 'modified',
          additions: 50,
          deletions: 5,
          diff: '',
        },
        {
          file: 'staged2.js',
          status: 'added',
          additions: 30,
          deletions: 0,
          diff: '',
        },
      ];

      const fullFiles = new Map<string, string>();
      fullFiles.set('staged1.ts', 'x'.repeat(2000)); // 2000 chars = ~500 tokens
      fullFiles.set('staged2.js', 'y'.repeat(1200)); // 1200 chars = ~300 tokens

      const context: ExtractedContext = {
        changes,
        scope: {
          filesChanged: 2,
          functionsModified: 0,
          linesAdded: 80,
          linesDeleted: 5,
        },
        fullFiles,
        tokenSavings: {
          fullFileTokens: 800,
          actualTokens: 800, // Same since we're showing full files
          saved: 0,
          percentSaved: 0,
        },
        metadata: {
          generated: '2024-01-01T00:00:00.000Z',
          repository: {
            name: 'staged-changes',
            branch: 'main',
            commit: 'abc123',
          },
          extraction: {
            method: 'staged-files-combine',
          },
          tokens: {
            estimated: 800,
          },
          tool: {
            name: 'dex',
            version: '1.0.0',
          },
        },
      };

      const formatter = new XmlFormatter();
      const result = formatter.format({
        context,
        options: { noPrompt: true },
      });

      expect(result).toContain('<files_changed>2</files_changed>');
      expect(result).toContain('<lines_added>80</lines_added>');
      expect(result).toContain('<estimated>800</estimated>');
    });
  });
});
