import { AIFileSelection } from '../types/ai-context';
import { OutputFormat } from '../types';

export interface ExportOptions {
  format: OutputFormat;
  includeContent: boolean;
  includePriority: boolean;
  includeReason: boolean;
  template?: string;
}

/**
 * Exports AI-selected context in various formats
 */
export class ContextExporter {
  /**
   * Export selected files to the specified format
   */
  async export(files: AIFileSelection[], options: ExportOptions): Promise<string> {
    switch (options.format) {
      case 'text':
        return this.exportAsText(files, options);
      case 'markdown':
        return this.exportAsMarkdown(files, options);
      case 'json':
        return this.exportAsJson(files, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }
  
  private exportAsText(files: AIFileSelection[], options: ExportOptions): string {
    const lines: string[] = [];
    
    lines.push('AI-SELECTED CODEBASE CONTEXT');
    lines.push('=' .repeat(50));
    lines.push('');
    
    // Summary
    const totalFiles = files.length;
    const highPriority = files.filter(f => f.priority === 'high').length;
    const mediumPriority = files.filter(f => f.priority === 'medium').length;
    const lowPriority = files.filter(f => f.priority === 'low').length;
    const totalTokens = files.reduce((sum, f) => sum + f.tokenEstimate, 0);
    
    lines.push(`Selected Files: ${totalFiles}`);
    lines.push(`High Priority: ${highPriority}, Medium Priority: ${mediumPriority}, Low Priority: ${lowPriority}`);
    lines.push(`Total Tokens: ${totalTokens}`);
    lines.push('');
    
    // Group files by priority if requested
    const filesByPriority = {
      high: files.filter(f => f.priority === 'high'),
      medium: files.filter(f => f.priority === 'medium'),
      low: files.filter(f => f.priority === 'low')
    };
    
    for (const [priority, priorityFiles] of Object.entries(filesByPriority)) {
      if (priorityFiles.length === 0) continue;
      
      lines.push(`${priority.toUpperCase()} PRIORITY FILES`);
      lines.push('-'.repeat(30));
      
      for (const file of priorityFiles) {
        lines.push(`File: ${file.file}`);
        if (options.includePriority) {
          lines.push(`Priority: ${file.priority}`);
        }
        if (options.includeReason && file.reason) {
          lines.push(`Reason: ${file.reason}`);
        }
        lines.push(`Tokens: ${file.tokenEstimate}`);
        
        if (options.includeContent) {
          lines.push('');
          lines.push('Content:');
          lines.push('-'.repeat(20));
          lines.push(file.content);
          lines.push('-'.repeat(20));
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
  
  private exportAsMarkdown(files: AIFileSelection[], options: ExportOptions): string {
    const lines: string[] = [];
    
    lines.push('# AI-Selected Codebase Context');
    lines.push('');
    
    // Summary
    const totalFiles = files.length;
    const highPriority = files.filter(f => f.priority === 'high').length;
    const mediumPriority = files.filter(f => f.priority === 'medium').length;
    const lowPriority = files.filter(f => f.priority === 'low').length;
    const totalTokens = files.reduce((sum, f) => sum + f.tokenEstimate, 0);
    
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Selected Files:** ${totalFiles}`);
    lines.push(`- **High Priority:** ${highPriority} files`);
    lines.push(`- **Medium Priority:** ${mediumPriority} files`);
    lines.push(`- **Low Priority:** ${lowPriority} files`);
    lines.push(`- **Total Tokens:** ${totalTokens}`);
    lines.push('');
    
    // Group files by priority
    const filesByPriority = {
      high: files.filter(f => f.priority === 'high'),
      medium: files.filter(f => f.priority === 'medium'),
      low: files.filter(f => f.priority === 'low')
    };
    
    for (const [priority, priorityFiles] of Object.entries(filesByPriority)) {
      if (priorityFiles.length === 0) continue;
      
      const priorityIcon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟠' : '🔵';
      lines.push(`## ${priorityIcon} ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Files`);
      lines.push('');
      
      for (const file of priorityFiles) {
        lines.push(`### ${file.file}`);
        lines.push('');
        
        if (options.includePriority || options.includeReason) {
          lines.push('**Metadata:**');
          if (options.includePriority) {
            lines.push(`- Priority: ${file.priority}`);
          }
          if (options.includeReason && file.reason) {
            lines.push(`- Reason: ${file.reason}`);
          }
          lines.push(`- Tokens: ${file.tokenEstimate}`);
          lines.push('');
        }
        
        if (options.includeContent) {
          lines.push('**Content:**');
          lines.push('');
          lines.push('```');
          lines.push(file.content);
          lines.push('```');
          lines.push('');
        }
      }
    }
    
    return lines.join('\n');
  }
  
  private exportAsJson(files: AIFileSelection[], options: ExportOptions): string {
    const exportData = {
      summary: {
        totalFiles: files.length,
        highPriority: files.filter(f => f.priority === 'high').length,
        mediumPriority: files.filter(f => f.priority === 'medium').length,
        lowPriority: files.filter(f => f.priority === 'low').length,
        totalTokens: files.reduce((sum, f) => sum + f.tokenEstimate, 0)
      },
      files: files.map(file => ({
        file: file.file,
        path: file.path,
        ...(options.includePriority && { priority: file.priority }),
        ...(options.includeReason && file.reason && { reason: file.reason }),
        tokenEstimate: file.tokenEstimate,
        ...(options.includeContent && { content: file.content })
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}