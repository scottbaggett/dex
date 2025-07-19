import { describe, it, expect, beforeEach } from 'vitest';
import { AIFileSelectionManager } from '../src/core/ai-file-selection';
import { AIFileSelection } from '../src/types/ai-context';

describe('AIFileSelectionManager', () => {
  let manager: AIFileSelectionManager;
  let mockSelections: AIFileSelection[];
  
  beforeEach(() => {
    // Create mock selections
    mockSelections = [
      {
        file: 'src/index.ts',
        path: '/repo/src/index.ts',
        content: 'console.log("Hello, world!");',
        priority: 'high',
        reason: 'Main entry point',
        preSelected: true,
        tokenEstimate: 100
      },
      {
        file: 'src/utils.ts',
        path: '/repo/src/utils.ts',
        content: 'export const add = (a, b) => a + b;',
        priority: 'medium',
        reason: 'Utility functions',
        preSelected: true,
        tokenEstimate: 50
      },
      {
        file: 'README.md',
        path: '/repo/README.md',
        content: '# Project\nThis is a test project.',
        priority: 'high',
        reason: 'Core documentation',
        preSelected: true,
        tokenEstimate: 75
      },
      {
        file: 'config/settings.json',
        path: '/repo/config/settings.json',
        content: '{"debug": true}',
        priority: 'low',
        reason: 'Configuration file',
        preSelected: false,
        tokenEstimate: 25
      }
    ];
    
    manager = new AIFileSelectionManager(mockSelections);
  });
  
  it('should get all selections', () => {
    const selections = manager.getSelections();
    expect(selections).toHaveLength(4);
    expect(selections).toEqual(mockSelections);
  });
  
  it('should add a selection', () => {
    const newSelection: AIFileSelection = {
      file: 'src/app.ts',
      path: '/repo/src/app.ts',
      content: 'import { add } from "./utils";',
      priority: 'high',
      reason: 'Application file',
      preSelected: true,
      tokenEstimate: 60
    };
    
    manager.addSelection(newSelection);
    
    const selections = manager.getSelections();
    expect(selections).toHaveLength(5);
    expect(selections).toContainEqual(newSelection);
  });
  
  it('should remove a selection', () => {
    const removed = manager.removeSelection('src/utils.ts');
    expect(removed).toBe(true);
    
    const selections = manager.getSelections();
    expect(selections).toHaveLength(3);
    expect(selections.find(s => s.file === 'src/utils.ts')).toBeUndefined();
  });
  
  it('should get selections by priority', () => {
    const highPriority = manager.getSelectionsByPriority('high');
    expect(highPriority).toHaveLength(2);
    expect(highPriority.every(s => s.priority === 'high')).toBe(true);
    
    const mediumPriority = manager.getSelectionsByPriority('medium');
    expect(mediumPriority).toHaveLength(1);
    expect(mediumPriority[0].file).toBe('src/utils.ts');
    
    const lowPriority = manager.getSelectionsByPriority('low');
    expect(lowPriority).toHaveLength(1);
    expect(lowPriority[0].file).toBe('config/settings.json');
  });
  
  it('should get high, medium, and low priority selections', () => {
    expect(manager.getHighPrioritySelections()).toHaveLength(2);
    expect(manager.getMediumPrioritySelections()).toHaveLength(1);
    expect(manager.getLowPrioritySelections()).toHaveLength(1);
  });
  
  it('should get pre-selected files', () => {
    const preSelected = manager.getPreSelectedFiles();
    expect(preSelected).toHaveLength(3);
    expect(preSelected.every(s => s.preSelected)).toBe(true);
  });
  
  it('should set pre-selected state for a file', () => {
    const updated = manager.setPreSelected('config/settings.json', true);
    expect(updated).toBe(true);
    
    const selection = manager.getSelections().find(s => s.file === 'config/settings.json');
    expect(selection?.preSelected).toBe(true);
  });
  
  it('should set pre-selected state for all files with a given priority', () => {
    const count = manager.setPreSelectedByPriority('high', false);
    expect(count).toBe(2);
    
    const highPriority = manager.getHighPrioritySelections();
    expect(highPriority.every(s => !s.preSelected)).toBe(true);
  });
  
  it('should get total token count', () => {
    const totalTokens = manager.getTotalTokenCount();
    expect(totalTokens).toBe(250); // 100 + 50 + 75 + 25
  });
  
  it('should get token count for selected files', () => {
    const selectedTokens = manager.getSelectedTokenCount();
    expect(selectedTokens).toBe(225); // 100 + 50 + 75
  });
  
  it('should get token count by priority', () => {
    expect(manager.getTokenCountByPriority('high')).toBe(175); // 100 + 75
    expect(manager.getTokenCountByPriority('medium')).toBe(50);
    expect(manager.getTokenCountByPriority('low')).toBe(25);
  });
  
  it('should get selections by file extension', () => {
    const tsFiles = manager.getSelectionsByExtension('.ts');
    expect(tsFiles).toHaveLength(2);
    expect(tsFiles.every(s => s.file.endsWith('.ts'))).toBe(true);
    
    const mdFiles = manager.getSelectionsByExtension('md');
    expect(mdFiles).toHaveLength(1);
    expect(mdFiles[0].file).toBe('README.md');
  });
  
  it('should get selections by directory', () => {
    const srcFiles = manager.getSelectionsByDirectory('src');
    expect(srcFiles).toHaveLength(2);
    expect(srcFiles.every(s => s.file.startsWith('src/'))).toBe(true);
    
    const configFiles = manager.getSelectionsByDirectory('config/');
    expect(configFiles).toHaveLength(1);
    expect(configFiles[0].file).toBe('config/settings.json');
  });
  
  it('should sort selections by priority', () => {
    const sorted = manager.sortByPriority();
    expect(sorted[0].priority).toBe('high');
    expect(sorted[1].priority).toBe('high');
    expect(sorted[2].priority).toBe('medium');
    expect(sorted[3].priority).toBe('low');
  });
  
  it('should sort selections by file path', () => {
    const sorted = manager.sortByPath();
    expect(sorted[0].file).toBe('README.md');
    expect(sorted[1].file).toBe('config/settings.json');
    expect(sorted[2].file).toBe('src/index.ts');
    expect(sorted[3].file).toBe('src/utils.ts');
  });
  
  it('should group selections by directory', () => {
    const groups = manager.groupByDirectory();
    expect(Object.keys(groups)).toHaveLength(3);
    expect(groups['.']).toHaveLength(1); // README.md
    expect(groups['src']).toHaveLength(2); // index.ts, utils.ts
    expect(groups['config']).toHaveLength(1); // settings.json
  });
  
  it('should create a summary of the selections', () => {
    const summary = manager.createSummary();
    expect(summary).toEqual({
      totalFiles: 0, // Not set in the manager
      selectedFiles: 4,
      highPriorityCount: 2,
      mediumPriorityCount: 1,
      lowPriorityCount: 1,
      totalTokens: 250,
      estimatedCost: 0 // Not calculated in the manager
    });
  });
  
  it('should filter selections', () => {
    const filtered = manager.filter(s => s.tokenEstimate > 50);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].file).toBe('src/index.ts');
    expect(filtered[1].file).toBe('README.md');
  });
  
  it('should map selections', () => {
    const fileNames = manager.map(s => s.file);
    expect(fileNames).toEqual(['src/index.ts', 'src/utils.ts', 'README.md', 'config/settings.json']);
  });
  
  it('should get selection count', () => {
    expect(manager.count).toBe(4);
  });
  
  it('should create a manager from an analysis result', () => {
    const result = {
      selections: mockSelections,
      summary: {
        totalFiles: 10,
        selectedFiles: 4,
        highPriorityCount: 2,
        mediumPriorityCount: 1,
        lowPriorityCount: 1,
        totalTokens: 250,
        estimatedCost: 0.05
      },
      prompt: 'Test prompt',
      timestamp: new Date()
    };
    
    const newManager = AIFileSelectionManager.fromAnalysisResult(result);
    expect(newManager.count).toBe(4);
    expect(newManager.getSelections()).toEqual(mockSelections);
  });
});