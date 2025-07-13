import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { PromptTemplate, PromptsConfig } from '../types/prompts';
import { loadConfig } from './config';

export class PromptLoader {
  private static instance: PromptLoader;
  private prompts: Map<string, PromptTemplate> = new Map();
  private userPrompts: Map<string, PromptTemplate> = new Map();
  private projectPrompts: Map<string, PromptTemplate> = new Map();
  
  private constructor() {
    this.loadBuiltinPrompts();
    this.loadProjectPrompts();
    this.loadUserPrompts();
  }
  
  static getInstance(): PromptLoader {
    if (!PromptLoader.instance) {
      PromptLoader.instance = new PromptLoader();
    }
    return PromptLoader.instance;
  }
  
  private loadBuiltinPrompts(): void {
    const promptsDir = join(__dirname, '..', 'prompts');
    
    if (!existsSync(promptsDir)) {
      console.warn('Built-in prompts directory not found');
      return;
    }
    
    const files = readdirSync(promptsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml') || f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = readFileSync(join(promptsDir, file), 'utf-8');
        let prompt;
        
        if (file.endsWith('.json')) {
          prompt = JSON.parse(content);
        } else {
          prompt = yaml.load(content) as any;
        }
        
        const id = file.replace(/\.(yml|yaml|json)$/, '');
        
        this.prompts.set(id, {
          id,
          ...prompt
        });
      } catch (error) {
        console.warn(`Failed to load prompt ${file}:`, error);
      }
    }
  }
  
  private loadProjectPrompts(): void {
    // Load prompts from .dex/prompts/ directory
    const projectPromptsDir = join(process.cwd(), '.dex', 'prompts');
    
    if (existsSync(projectPromptsDir)) {
      try {
        const files = readdirSync(projectPromptsDir).filter(f => 
          f.endsWith('.yml') || f.endsWith('.yaml') || f.endsWith('.json')
        );
        
        for (const file of files) {
          try {
            const content = readFileSync(join(projectPromptsDir, file), 'utf-8');
            let prompt;
            
            if (file.endsWith('.json')) {
              prompt = JSON.parse(content);
            } else {
              // Remove comment lines for YAML parsing
              const cleanContent = content.split('\n')
                .filter(line => !line.trim().startsWith('#') || line.trim() === '#')
                .join('\n');
              prompt = yaml.load(cleanContent) as any;
            }
            
            const id = file.replace(/\.(yml|yaml|json)$/, '');
            
            this.projectPrompts.set(id, {
              id,
              ...prompt
            });
          } catch (error) {
            console.warn(`Failed to load project prompt ${file}:`, error);
          }
        }
      } catch (error) {
        // Directory might not exist, that's fine
      }
    }
  }
  
  private loadUserPrompts(): void {
    const config = loadConfig();
    
    if (config.prompts) {
      for (const [id, prompt] of Object.entries(config.prompts)) {
        this.userPrompts.set(id, {
          id,
          ...prompt as any
        });
      }
    }
  }
  
  getPrompt(id: string, visitedIds: Set<string> = new Set()): PromptTemplate | null {
    // Check for circular inheritance early
    if (visitedIds.has(id)) {
      console.warn(`Circular inheritance detected for prompt '${id}'`);
      return null;
    }
    
    // Priority: user config > project prompts > built-in
    let prompt = this.userPrompts.get(id) || this.projectPrompts.get(id) || this.prompts.get(id);
    
    if (!prompt) {
      return null;
    }
    
    // Handle inheritance
    if (prompt.extends) {
      const newVisitedIds = new Set(visitedIds);
      newVisitedIds.add(id);
      const basePrompt = this.getPrompt(prompt.extends, newVisitedIds);
      if (basePrompt) {
        prompt = this.mergePrompts(basePrompt, prompt);
      }
    }
    
    return prompt;
  }
  
  private mergePrompts(base: PromptTemplate, override: PromptTemplate): PromptTemplate {
    return {
      ...base,
      ...override,
      instructions: override.instructions || base.instructions,
      examples: [...(base.examples || []), ...(override.examples || [])],
      tags: [...new Set([...(base.tags || []), ...(override.tags || [])])],
      llm: override.llm || base.llm,
      variables: { ...base.variables, ...override.variables }
    };
  }
  
  getAllPrompts(): PromptTemplate[] {
    const allIds = new Set([
      ...this.prompts.keys(), 
      ...this.projectPrompts.keys(),
      ...this.userPrompts.keys()
    ]);
    const results: PromptTemplate[] = [];
    
    for (const id of allIds) {
      const prompt = this.getPrompt(id);
      if (prompt) {
        results.push(prompt);
      }
    }
    
    return results;
  }
  
  suggestPrompts(context: {
    format?: string;
    task?: string;
    fileTypes?: Set<string>;
    tags?: string[];
  }): PromptTemplate[] {
    const allPrompts = this.getAllPrompts();
    const scores = new Map<string, number>();
    
    for (const prompt of allPrompts) {
      let score = 0;
      
      // Match by LLM format
      if (context.format && prompt.llm?.includes(context.format)) {
        score += 3;
      }
      
      // Match by task keywords
      if (context.task) {
        const taskLower = context.task.toLowerCase();
        const promptText = (prompt.name + prompt.description + prompt.instructions).toLowerCase();
        
        // Check for keyword matches
        const keywords = ['security', 'performance', 'refactor', 'bug', 'feature', 'test', 'api', 'migration'];
        for (const keyword of keywords) {
          if (taskLower.includes(keyword) && promptText.includes(keyword)) {
            score += 2;
          }
        }
      }
      
      // Match by tags
      if (context.tags && prompt.tags) {
        const matchingTags = prompt.tags.filter(tag => context.tags!.includes(tag));
        score += matchingTags.length;
      }
      
      // Match by file types (e.g., .test.ts suggests testing prompt template)
      if (context.fileTypes) {
        if (context.fileTypes.has('test.ts') && prompt.id === 'testing') {
          score += 2;
        }
      }
      
      if (score > 0) {
        scores.set(prompt.id, score);
      }
    }
    
    // Sort by score and return top suggestions
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => this.getPrompt(id)!)
      .filter(Boolean);
  }
  
  interpolateVariables(instructions: string, variables: Record<string, string>): string {
    let result = instructions;
    
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
    
    return result;
  }
}