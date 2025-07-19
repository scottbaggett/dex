import { AIFileSelection, FilePriority, AIAnalysisResult } from '../types/ai-context';
import path from 'path';

/**
 * Class for working with AI-selected files
 */
export class AIFileSelectionManager {
  private selections: AIFileSelection[];
  
  constructor(selections: AIFileSelection[] = []) {
    this.selections = [...selections];
  }
  
  /**
   * Get all selections
   */
  getSelections(): AIFileSelection[] {
    return [...this.selections];
  }
  
  /**
   * Add a file selection
   */
  addSelection(selection: AIFileSelection): void {
    this.selections.push(selection);
  }
  
  /**
   * Remove a file selection by path
   */
  removeSelection(filePath: string): boolean {
    const initialLength = this.selections.length;
    this.selections = this.selections.filter(s => s.file !== filePath);
    return this.selections.length < initialLength;
  }
  
  /**
   * Get selections by priority
   */
  getSelectionsByPriority(priority: FilePriority): AIFileSelection[] {
    return this.selections.filter(s => s.priority === priority);
  }
  
  /**
   * Get high priority selections
   */
  getHighPrioritySelections(): AIFileSelection[] {
    return this.getSelectionsByPriority('high');
  }
  
  /**
   * Get medium priority selections
   */
  getMediumPrioritySelections(): AIFileSelection[] {
    return this.getSelectionsByPriority('medium');
  }
  
  /**
   * Get low priority selections
   */
  getLowPrioritySelections(): AIFileSelection[] {
    return this.getSelectionsByPriority('low');
  }
  
  /**
   * Get pre-selected files
   */
  getPreSelectedFiles(): AIFileSelection[] {
    return this.selections.filter(s => s.preSelected);
  }
  
  /**
   * Set pre-selected state for a file
   */
  setPreSelected(filePath: string, preSelected: boolean): boolean {
    const selection = this.selections.find(s => s.file === filePath);
    if (selection) {
      selection.preSelected = preSelected;
      return true;
    }
    return false;
  }
  
  /**
   * Set pre-selected state for all files with a given priority
   */
  setPreSelectedByPriority(priority: FilePriority, preSelected: boolean): number {
    let count = 0;
    for (const selection of this.selections) {
      if (selection.priority === priority) {
        selection.preSelected = preSelected;
        count++;
      }
    }
    return count;
  }
  
  /**
   * Get total token count for all selections
   */
  getTotalTokenCount(): number {
    return this.selections.reduce((sum, s) => sum + s.tokenEstimate, 0);
  }
  
  /**
   * Get token count for selected files
   */
  getSelectedTokenCount(): number {
    return this.selections
      .filter(s => s.preSelected)
      .reduce((sum, s) => sum + s.tokenEstimate, 0);
  }
  
  /**
   * Get token count by priority
   */
  getTokenCountByPriority(priority: FilePriority): number {
    return this.selections
      .filter(s => s.priority === priority)
      .reduce((sum, s) => sum + s.tokenEstimate, 0);
  }
  
  /**
   * Get selections by file extension
   */
  getSelectionsByExtension(extension: string): AIFileSelection[] {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return this.selections.filter(s => path.extname(s.file) === ext);
  }
  
  /**
   * Get selections by directory
   */
  getSelectionsByDirectory(directory: string): AIFileSelection[] {
    const dir = directory.endsWith('/') ? directory : `${directory}/`;
    return this.selections.filter(s => s.file.startsWith(dir));
  }
  
  /**
   * Sort selections by priority
   */
  sortByPriority(): AIFileSelection[] {
    const priorityOrder: Record<FilePriority, number> = {
      high: 0,
      medium: 1,
      low: 2
    };
    
    this.selections.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return this.getSelections();
  }
  
  /**
   * Sort selections by file path
   */
  sortByPath(): AIFileSelection[] {
    // Sort by path, but put root files first
    this.selections.sort((a, b) => {
      const aHasDir = a.file.includes('/');
      const bHasDir = b.file.includes('/');
      
      // If one is a root file and the other isn't, root file comes first
      if (aHasDir && !bHasDir) return 1;
      if (!aHasDir && bHasDir) return -1;
      
      // Otherwise, sort alphabetically
      return a.file.localeCompare(b.file);
    });
    
    return this.getSelections();
  }
  
  /**
   * Group selections by directory
   */
  groupByDirectory(): Record<string, AIFileSelection[]> {
    const groups: Record<string, AIFileSelection[]> = {};
    
    for (const selection of this.selections) {
      const directory = path.dirname(selection.file);
      if (!groups[directory]) {
        groups[directory] = [];
      }
      groups[directory].push(selection);
    }
    
    return groups;
  }
  
  /**
   * Create a summary of the selections
   */
  createSummary(): AIAnalysisResult['summary'] {
    const highPriorityCount = this.getHighPrioritySelections().length;
    const mediumPriorityCount = this.getMediumPrioritySelections().length;
    const lowPriorityCount = this.getLowPrioritySelections().length;
    const totalTokens = this.getTotalTokenCount();
    
    return {
      totalFiles: 0, // This would need to be provided externally
      selectedFiles: this.selections.length,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      totalTokens,
      estimatedCost: 0 // This would need to be calculated externally
    };
  }
  
  /**
   * Filter selections by a predicate function
   */
  filter(predicate: (selection: AIFileSelection) => boolean): AIFileSelection[] {
    return this.selections.filter(predicate);
  }
  
  /**
   * Map selections to a new array
   */
  map<T>(mapper: (selection: AIFileSelection) => T): T[] {
    return this.selections.map(mapper);
  }
  
  /**
   * Get selection count
   */
  get count(): number {
    return this.selections.length;
  }
  
  /**
   * Create a manager from an analysis result
   */
  static fromAnalysisResult(result: AIAnalysisResult): AIFileSelectionManager {
    return new AIFileSelectionManager(result.selections);
  }
}