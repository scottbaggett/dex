import { DistillDepth, ExtractedAPI } from '../../types';

export interface ParsedFile {
  path: string;
  language: string;
  ast: any;
  content: string;
}

export interface ParserOptions {
  includeComments: boolean;
  includeDocstrings: boolean;
}

export abstract class Parser {
  protected options: ParserOptions;

  constructor(options: ParserOptions) {
    this.options = options;
  }

  abstract initialize(): Promise<void>;
  abstract parse(content: string, language: string): Promise<ParsedFile>;
  abstract extract(parsedFile: ParsedFile, depth: DistillDepth): ExtractedAPI;
  abstract isLanguageSupported(language: string): boolean;
  abstract getSupportedLanguages(): string[];

  static detectLanguage(filePath: string): string | null {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'lua': 'lua',
      'dart': 'dart',
      'jl': 'julia',
      'ex': 'elixir',
      'exs': 'elixir',
      'clj': 'clojure',
      'cljs': 'clojure',
      'hs': 'haskell',
      'ml': 'ocaml',
      'fs': 'fsharp',
      'nim': 'nim',
      'v': 'vlang',
      'zig': 'zig',
    };

    return languageMap[ext || ''] || null;
  }
}