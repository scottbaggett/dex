import { readFile } from 'fs/promises';
import { TaskContext } from '../types';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface TaskSource {
  type: 'text' | 'file' | 'url' | 'stdin';
  source: string;
  format?: 'markdown' | 'plain' | 'json';
}

export class TaskExtractor {
  async extract(source: TaskSource): Promise<TaskContext> {
    switch (source.type) {
      case 'text':
        return this.extractFromText(source.source);
      case 'file':
        return this.extractFromFile(source.source);
      case 'url':
        return this.extractFromUrl(source.source);
      case 'stdin':
        return this.extractFromStdin();
      default:
        throw new Error(`Unknown task source type: ${source.type}`);
    }
  }

  private async extractFromText(text: string): Promise<TaskContext> {
    // Simple text extraction - just use the text as description
    return {
      description: text.trim(),
      goals: this.extractGoals(text),
    };
  }

  private async extractFromFile(filePath: string): Promise<TaskContext> {
    // Resolve relative paths
    const absolutePath = resolve(filePath);
    
    // Check if file exists
    if (!existsSync(absolutePath)) {
      throw new Error(`Task file not found: ${filePath}`);
    }

    // Read file content
    const content = await readFile(absolutePath, 'utf-8');
    
    // Detect format based on extension
    const format = this.detectFormat(filePath);
    
    return this.parseContent(content, format);
  }

  private async extractFromUrl(_url: string): Promise<TaskContext> {
    // TODO: Implement URL fetching in Phase 3
    throw new Error('URL task fetching not yet implemented');
  }

  private async extractFromStdin(): Promise<TaskContext> {
    return new Promise((resolve, reject) => {
      let content = '';
      
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        content += chunk;
      });
      
      process.stdin.on('end', () => {
        resolve(this.parseContent(content, 'plain'));
      });
      
      process.stdin.on('error', reject);
      
      // Set a timeout to avoid hanging
      setTimeout(() => {
        if (content === '') {
          reject(new Error('No input received from stdin'));
        }
      }, 5000);
    });
  }

  private detectFormat(filePath: string): 'markdown' | 'plain' | 'json' {
    const ext = filePath.toLowerCase();
    if (ext.endsWith('.md') || ext.endsWith('.markdown')) {
      return 'markdown';
    } else if (ext.endsWith('.json')) {
      return 'json';
    }
    return 'plain';
  }

  private parseContent(content: string, format: 'markdown' | 'plain' | 'json'): TaskContext {
    switch (format) {
      case 'markdown':
        return this.parseMarkdown(content);
      case 'json':
        return this.parseJson(content);
      case 'plain':
      default:
        return this.parsePlainText(content);
    }
  }

  private parseMarkdown(content: string): TaskContext {
    const lines = content.split('\n');
    let description = '';
    const goals: string[] = [];
    const labels: string[] = [];
    
    // Look for common patterns in markdown
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Title (first # heading)
      if (line.startsWith('# ') && !description) {
        description = line.substring(2).trim();
        continue;
      }
      
      // Task description section (only if no description yet)
      if (!description && (line.toLowerCase().includes('## description') || 
          line.toLowerCase().includes('## task'))) {
        // Get the next non-empty line
        for (let j = i + 1; j < lines.length && j < i + 5; j++) {
          if (lines[j].trim() && !lines[j].startsWith('#')) {
            description = lines[j].trim();
            break;
          }
        }
      }
      
      // Goals/objectives section
      if (line.toLowerCase().includes('## goal') || 
          line.toLowerCase().includes('## objective')) {
        // Extract bullet points
        for (let j = i + 1; j < lines.length && j < i + 10; j++) {
          const goalLine = lines[j].trim();
          if (goalLine.startsWith('-') || goalLine.startsWith('*')) {
            goals.push(goalLine.substring(1).trim());
          } else if (goalLine.startsWith('#')) {
            break; // Next section
          }
        }
      }
      
      // Labels/tags
      if (line.toLowerCase().includes('tags:') || 
          line.toLowerCase().includes('labels:')) {
        const tagPart = line.split(':')[1];
        if (tagPart) {
          const tags = tagPart.split(',').map(t => t.trim()).filter(Boolean);
          labels.push(...tags);
        }
      }
    }
    
    // If no description found, use first non-empty, non-metadata line
    if (!description) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
          description = trimmed;
          break;
        }
      }
    }
    
    return {
      description: description || 'Task from markdown file',
      goals: goals.length > 0 ? goals : undefined,
      labels: labels.length > 0 ? labels : undefined,
    };
  }

  private parseJson(content: string): TaskContext {
    try {
      const data = JSON.parse(content);
      
      // Support various JSON structures
      return {
        description: data.description || data.task || data.title || 'Task from JSON',
        goals: data.goals || data.objectives || undefined,
        labels: data.labels || data.tags || undefined,
        issueUrl: data.url || data.issueUrl || undefined,
        issueTitle: data.issueTitle || data.title || undefined,
        issueBody: data.issueBody || data.body || undefined,
      };
    } catch (error) {
      throw new Error(`Failed to parse JSON task file: ${error}`);
    }
  }

  private parsePlainText(content: string): TaskContext {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    
    // First line is description
    const description = lines[0] || 'Task';
    
    // Look for goals (lines starting with -, *, or numbers)
    const goals = lines.slice(1)
      .filter(line => /^[-*•]|\d+\./.test(line))
      .map(line => line.replace(/^[-*•]\s*|\d+\.\s*/, ''));
    
    return {
      description,
      goals: goals.length > 0 ? goals : this.extractGoals(content),
    };
  }

  private extractGoals(text: string): string[] | undefined {
    // Simple goal extraction from text
    const goalKeywords = ['todo:', 'goal:', 'objective:', 'task:', '- [ ]'];
    const goals: string[] = [];
    
    const lines = text.split('\n');
    for (const line of lines) {
      const lower = line.toLowerCase();
      for (const keyword of goalKeywords) {
        if (lower.includes(keyword)) {
          const goal = line.substring(line.toLowerCase().indexOf(keyword) + keyword.length).trim();
          if (goal) {
            goals.push(goal);
          }
        }
      }
    }
    
    return goals.length > 0 ? goals : undefined;
  }
}