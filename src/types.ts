export type DepthLevel = 'minimal' | 'focused' | 'full' | 'extended';
export type OutputFormat = 'markdown' | 'json' | 'claude' | 'gpt' | 'gemini' | 'grok' | 'llama' | 'mistral' | 'github-pr' | 'pr';

export interface DexOptions {
  // Git options
  since?: string;
  range?: string;
  staged?: boolean;
  all?: boolean;
  
  // Depth options
  depth?: DepthLevel;
  fullFiles?: string[];
  bootstrap?: boolean;
  
  // Untracked files
  includeUntracked?: boolean;
  untrackedPattern?: string;
  
  // Filter options
  path?: string;
  type?: string[];
  
  // Output options
  format?: OutputFormat;
  clipboard?: boolean;
  
  // Task integration
  task?: string;          // Direct task description
  taskFile?: string;      // Path to task file
  taskUrl?: string;       // URL to fetch task from
  taskStdin?: boolean;    // Read task from stdin (--task=-)
  interactive?: boolean;
  
  // Optimization (from --optimize flag)
  symbols?: boolean;
  aid?: boolean;
  
  // Display options
  noMetadata?: boolean;
}

export interface GitChange {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
  oldFile?: string; // for renames
}

export interface Metadata {
  generated: string; // ISO timestamp
  repository: {
    name: string;
    branch: string;
    commit: string;
  };
  extraction: {
    depth: DepthLevel;
    filters?: {
      path?: string;
      type?: string[];
    };
  };
  tokens: {
    estimated: number;
  };
  tool: {
    name: string;
    version: string;
  };
}

export interface ExtractedContext {
  changes: GitChange[];
  scope: {
    filesChanged: number;
    functionsModified: number;
    linesAdded: number;
    linesDeleted: number;
  };
  task?: TaskContext;
  fullFiles?: Map<string, string>;
  symbols?: SymbolMap;
  metadata: Metadata;
}

export interface TaskContext {
  description: string;
  goals?: string[];
  issueUrl?: string;
  issueTitle?: string;
  issueBody?: string;
  labels?: string[];
}

export interface SymbolMap {
  [file: string]: {
    functions: string[];
    classes: string[];
    exports: string[];
    imports: string[];
  };
}

export interface FormatterOptions {
  context: ExtractedContext;
  options: DexOptions;
}

export interface Formatter {
  format(options: FormatterOptions): string;
}