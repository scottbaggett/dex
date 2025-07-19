import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilePrioritizer } from '../src/core/file-prioritizer';
import { FileInfo } from '../src/utils/file-scanner';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');

describe('FilePrioritizer', () => {
  let filePrioritizer: FilePrioritizer;
  let mockFiles: FileInfo[];
  
  beforeEach(() => {
    vi.resetAllMocks();
    filePrioritizer = new FilePrioritizer();
    
    // Mock file content for import analysis
    (fs.readFile as any).mockImplementation((path: string) => {
      if (path.includes('index.ts')) {
        return Promise.resolve(`
          import { Component } from './component';
          import { utils } from './utils';
          import axios from 'axios';
        `);
      }
      if (path.includes('component.ts')) {
        return Promise.resolve(`
          import { utils } from './utils';
          export class Component {}
        `);
      }
      if (path.includes('utils.ts')) {
        return Promise.resolve(`
          export const utils = {};
        `);
      }
      return Promise.reject(new Error('File not found'));
    });
    
    // Create mock files
    mockFiles = [
      {
        path: '/repo/README.md',
        relativePath: 'README.md',
        size: 1000,
        lastModified: new Date(),
        isDirectory: false
      },
      {
        path: '/repo/src/index.ts',
        relativePath: 'src/index.ts',
        size: 500,
        lastModified: new Date(),
        isDirectory: false
      },
      {
        path: '/repo/src/component.ts',
        relativePath: 'src/component.ts',
        size: 300,
        lastModified: new Date(),
        isDirectory: false
      },
      {
        path: '/repo/src/utils.ts',
        relativePath: 'src/utils.ts',
        size: 200,
        lastModified: new Date(),
        isDirectory: false
      },
      {
        path: '/repo/config/settings.json',
        relativePath: 'config/settings.json',
        size: 100,
        lastModified: new Date(),
        isDirectory: false
      },
      {
        path: '/repo/test/index.test.ts',
        relativePath: 'test/index.test.ts',
        size: 400,
        lastModified: new Date(),
        isDirectory: false
      }
    ];
  });
  
  it('should prioritize files based on heuristics', async () => {
    const result = await filePrioritizer.prioritize({
      files: mockFiles,
      prompt: 'Implement authentication feature',
      provider: 'anthropic',
      model: 'claude-3-opus',
      maxFiles: 10
    });
    
    // Verify result structure
    expect(result).toHaveLength(6);
    
    // Verify priorities
    const readmeFile = result.find(f => f.relativePath === 'README.md');
    expect(readmeFile).toBeDefined();
    expect(readmeFile?.priority).toBe('high');
    
    const indexFile = result.find(f => f.relativePath === 'src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile?.priority).toBe('high');
    
    const componentFile = result.find(f => f.relativePath === 'src/component.ts');
    expect(componentFile).toBeDefined();
    expect(componentFile?.priority).toBe('medium');
    
    const utilsFile = result.find(f => f.relativePath === 'src/utils.ts');
    expect(utilsFile).toBeDefined();
    expect(utilsFile?.priority).toBe('medium');
    
    const configFile = result.find(f => f.relativePath === 'config/settings.json');
    expect(configFile).toBeDefined();
    expect(configFile?.priority).toBe('low');
    
    const testFile = result.find(f => f.relativePath === 'test/index.test.ts');
    expect(testFile).toBeDefined();
    expect(testFile?.priority).toBe('low');
    
    // Verify sorting (high priority first)
    expect(result[0].priority).toBe('high');
    expect(result[1].priority).toBe('high');
  });
  
  it('should boost priority for files matching keywords in prompt', async () => {
    const result = await filePrioritizer.prioritize({
      files: mockFiles,
      prompt: 'Fix the component rendering issue',
      provider: 'anthropic',
      model: 'claude-3-opus',
      maxFiles: 10
    });
    
    // Verify that component.ts has high priority due to keyword match
    const componentFile = result.find(f => f.relativePath === 'src/component.ts');
    expect(componentFile).toBeDefined();
    expect(componentFile?.priority).toBe('high');
    expect(componentFile?.reason).toContain('matches keywords in prompt');
  });
  
  it('should analyze file relationships and boost imported files', async () => {
    const result = await filePrioritizer.prioritize({
      files: mockFiles,
      prompt: 'Update the index file',
      provider: 'anthropic',
      model: 'claude-3-opus',
      maxFiles: 10
    });
    
    // Verify that utils.ts has at least medium priority due to being imported
    const utilsFile = result.find(f => f.relativePath === 'src/utils.ts');
    expect(utilsFile).toBeDefined();
    expect(['medium', 'high']).toContain(utilsFile?.priority);
  });
  
  it('should limit results to maxFiles', async () => {
    const result = await filePrioritizer.prioritize({
      files: mockFiles,
      prompt: 'General code review',
      provider: 'anthropic',
      model: 'claude-3-opus',
      maxFiles: 3
    });
    
    // Verify that only 3 files are returned
    expect(result).toHaveLength(3);
    
    // Verify that high priority files are included
    expect(result.some(f => f.relativePath === 'README.md')).toBe(true);
    expect(result.some(f => f.relativePath === 'src/index.ts')).toBe(true);
  });
});