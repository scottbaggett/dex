import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { FileScanner, formatFileSize } from '../src/utils/file-scanner';

describe('FileScanner', () => {
  const testDir = join(__dirname, 'temp-scanner-test');
  
  beforeEach(() => {
    // Create test directory structure
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'src'), { recursive: true });
    mkdirSync(join(testDir, 'test'), { recursive: true });
    mkdirSync(join(testDir, 'node_modules'), { recursive: true });
    mkdirSync(join(testDir, '.git'), { recursive: true });
    
    // Create test files
    writeFileSync(join(testDir, 'README.md'), '# Test Project\n\nThis is a test.');
    writeFileSync(join(testDir, 'package.json'), '{"name": "test"}');
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export function hello() { return "world"; }');
    writeFileSync(join(testDir, 'src', 'utils.js'), 'function add(a, b) { return a + b; }');
    writeFileSync(join(testDir, 'test', 'index.test.ts'), 'import { hello } from "../src/index";');
    writeFileSync(join(testDir, 'node_modules', 'dep.js'), 'module.exports = {};');
    writeFileSync(join(testDir, '.git', 'config'), '[core]');
    
    // Create .gitignore
    writeFileSync(join(testDir, '.gitignore'), 'node_modules/\n.git/\n*.log\n');
    
    // Create binary file (should be ignored)
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    writeFileSync(join(testDir, 'binary.bin'), binaryData);
  });
  
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic Scanning', () => {
    it('should scan directory and find text files', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir);
      
      const filePaths = files.map(f => f.relativePath).sort();
      
      expect(filePaths).toContain('README.md');
      expect(filePaths).toContain('package.json');
      expect(filePaths).toContain('src/index.ts');
      expect(filePaths).toContain('src/utils.js');
      expect(filePaths).toContain('test/index.test.ts');
      
      // Should ignore node_modules and .git by default
      expect(filePaths).not.toContain('node_modules/dep.js');
      expect(filePaths).not.toContain('.git/config');
      
      // Should ignore binary files
      expect(filePaths).not.toContain('binary.bin');
    });

    it('should include file metadata', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir);
      
      const readmeFile = files.find(f => f.relativePath === 'README.md');
      expect(readmeFile).toBeDefined();
      expect(readmeFile!.size).toBeGreaterThan(0);
      expect(readmeFile!.lastModified).toBeInstanceOf(Date);
      expect(readmeFile!.isDirectory).toBe(false);
    });
  });

  describe('Include Patterns', () => {
    it('should filter files by include patterns', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        includePatterns: ['*.ts']
      });
      
      const filePaths = files.map(f => f.relativePath).sort();
      
      expect(filePaths).toContain('src/index.ts');
      expect(filePaths).toContain('test/index.test.ts');
      expect(filePaths).not.toContain('README.md');
      expect(filePaths).not.toContain('package.json');
      expect(filePaths).not.toContain('src/utils.js');
    });

    it('should support multiple include patterns', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        includePatterns: ['*.ts', '*.md']
      });
      
      const filePaths = files.map(f => f.relativePath).sort();
      
      expect(filePaths).toContain('README.md');
      expect(filePaths).toContain('src/index.ts');
      expect(filePaths).toContain('test/index.test.ts');
      expect(filePaths).not.toContain('package.json');
      expect(filePaths).not.toContain('src/utils.js');
    });
  });

  describe('Exclude Patterns', () => {
    it('should filter out files by exclude patterns', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        excludePatterns: ['*.test.*']
      });
      
      const filePaths = files.map(f => f.relativePath).sort();
      
      expect(filePaths).toContain('README.md');
      expect(filePaths).toContain('src/index.ts');
      expect(filePaths).toContain('src/utils.js');
      expect(filePaths).not.toContain('test/index.test.ts');
    });

    it('should support multiple exclude patterns', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        excludePatterns: ['*.test.*', '*.json']
      });
      
      const filePaths = files.map(f => f.relativePath).sort();
      
      expect(filePaths).toContain('README.md');
      expect(filePaths).toContain('src/index.ts');
      expect(filePaths).toContain('src/utils.js');
      expect(filePaths).not.toContain('test/index.test.ts');
      expect(filePaths).not.toContain('package.json');
    });
  });

  describe('Gitignore Support', () => {
    it('should respect .gitignore patterns by default', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir);
      
      const filePaths = files.map(f => f.relativePath);
      
      // Should ignore files matching .gitignore patterns
      expect(filePaths).not.toContain('node_modules/dep.js');
      expect(filePaths).not.toContain('.git/config');
    });

    it('should ignore .gitignore when respectGitignore is false', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        respectGitignore: false
      });
      
      const filePaths = files.map(f => f.relativePath);
      
      // Should still ignore due to default patterns, but would include if not in defaults
      expect(filePaths).not.toContain('node_modules/dep.js'); // Still ignored by default patterns
      expect(filePaths).not.toContain('.git/config'); // Still ignored by default patterns
    });
  });

  describe('Limits and Safety', () => {
    it('should respect maxFiles limit', async () => {
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        maxFiles: 2
      });
      
      expect(files.length).toBeLessThanOrEqual(2);
    });

    it('should respect maxDepth limit', async () => {
      // Create deeper directory structure
      mkdirSync(join(testDir, 'deep', 'nested', 'dir'), { recursive: true });
      writeFileSync(join(testDir, 'deep', 'nested', 'dir', 'deep.txt'), 'deep file');
      
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir, {
        maxDepth: 1
      });
      
      const filePaths = files.map(f => f.relativePath);
      
      // Should include files at depth 1 (src/index.ts)
      expect(filePaths).toContain('src/index.ts');
      
      // Should not include files at depth 3 (deep/nested/dir/deep.txt)
      expect(filePaths).not.toContain('deep/nested/dir/deep.txt');
    });
  });

  describe('Text File Detection', () => {
    it('should detect text files by extension', async () => {
      // Create files with known text extensions
      writeFileSync(join(testDir, 'script.py'), 'print("hello")');
      writeFileSync(join(testDir, 'style.css'), 'body { margin: 0; }');
      writeFileSync(join(testDir, 'config.yml'), 'key: value');
      
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir);
      
      const filePaths = files.map(f => f.relativePath);
      
      expect(filePaths).toContain('script.py');
      expect(filePaths).toContain('style.css');
      expect(filePaths).toContain('config.yml');
    });

    it('should detect text files by content analysis', async () => {
      // Create file without extension but with text content
      writeFileSync(join(testDir, 'Dockerfile'), 'FROM node:16\nRUN npm install');
      writeFileSync(join(testDir, 'Makefile'), 'all:\n\techo "building"');
      
      const scanner = new FileScanner();
      const files = await scanner.scan(testDir);
      
      const filePaths = files.map(f => f.relativePath);
      
      expect(filePaths).toContain('Dockerfile');
      expect(filePaths).toContain('Makefile');
    });
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0.0 B');
    expect(formatFileSize(512)).toBe('512.0 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});