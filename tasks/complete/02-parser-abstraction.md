# Task 02: Complete Parser Abstraction

## Problem
Parser interface is not fully unified per P0 Charter requirements. Missing fallback regex parser and limited language support.

## Current State
- Tree-sitter parser exists in `src/core/parser/tree-sitter-parser.ts`
- Only supports JavaScript, TypeScript, Python
- No fallback regex parser for other languages
- Interface not fully matching charter specification

## Requirements (P0 Charter)
- Unified Parser interface: `init`, `parse`, `extract`, `supportsLanguage`
- Supports both high-precision (Tree-sitter) and fallback (regex) parsing
- Easy to add new languages without touching existing commands
- Pluggable architecture

## Implementation Plan
1. Define unified `Parser` interface in `src/core/parser/types.ts`
2. Create `RegexParser` class for fallback parsing
3. Update `TreeSitterParser` to match interface
4. Create `ParserFactory` for language detection and parser selection
5. Add support for more languages (Go, Rust, Java, etc.)
6. Implement language auto-detection

## Acceptance Criteria
- [ ] Unified Parser interface with all required methods
- [ ] RegexParser handles any text-based file
- [ ] TreeSitterParser fully implements interface
- [ ] At least 10 languages supported
- [ ] Automatic fallback when Tree-sitter unavailable
- [ ] Parser selection based on file extension
- [ ] Extensibility proven (<30 min to add new language)

## Files to Create/Modify
- `src/core/parser/types.ts` - interface definition
- `src/core/parser/regex-parser.ts` - new fallback parser
- `src/core/parser/parser-factory.ts` - parser selection logic
- `src/core/parser/languages/` - language-specific parsers
- Update existing Tree-sitter parser

---

## Detailed Implementation Guide

### 1. Complete TypeScript Interface Definitions

The unified Parser interface should include all required methods with comprehensive type definitions:

```typescript
// src/core/parser/types.ts
export interface ParsedFile {
    path: string;
    language: string;
    ast: any; // Tree-sitter AST or null for regex
    content: string;
    metadata?: {
        parserType: 'tree-sitter' | 'regex';
        parseTime?: number;
        tokens?: number;
    };
}

export interface ParserOptions {
    includeComments: boolean;
    includeDocstrings: boolean;
    maxDepth?: number;
    timeout?: number;
    preserveWhitespace?: boolean;
}

export interface ParserCapabilities {
    supportsAST: boolean;
    supportsIncrementalParsing: boolean;
    supportsErrorRecovery: boolean;
    supportedFeatures: string[];
    performanceLevel: 'high' | 'medium' | 'basic';
}

export interface LanguageConfig {
    name: string;
    extensions: string[];
    aliases?: string[];
    priority: number; // Higher number = higher priority
    treeSitterGrammar?: string;
    regexPatterns?: LanguagePatterns;
}

export interface LanguagePatterns {
    imports: RegExp[];
    exports: RegExp[];
    functions: RegExp[];
    classes: RegExp[];
    interfaces?: RegExp[];
    types?: RegExp[];
    constants: RegExp[];
    comments: RegExp[];
    docstrings: RegExp[];
}

// Enhanced Parser interface with all P0 Charter requirements
export abstract class Parser {
    protected options: ParserOptions;
    protected capabilities: ParserCapabilities;

    constructor(options: ParserOptions) {
        this.options = options;
        this.capabilities = this.getCapabilities();
    }

    // P0 Charter required methods
    abstract initialize(): Promise<void>;
    abstract parse(content: string, language: string): Promise<ParsedFile>;
    abstract extract(parsedFile: ParsedFile): ExtractedAPI;
    abstract supportsLanguage(language: string): boolean;
    
    // Additional interface methods
    abstract getSupportedLanguages(): string[];
    abstract getCapabilities(): ParserCapabilities;
    abstract getLanguageConfig(language: string): LanguageConfig | null;
    
    // Performance and diagnostics
    abstract getPerformanceMetrics(): ParserPerformanceMetrics;
    abstract validateContent(content: string, language: string): ValidationResult;
    
    // Language detection (static method)
    static detectLanguage(filePath: string): string | null {
        // Implementation in base class
    }
}

export interface ParserPerformanceMetrics {
    parseTime: number;
    memoryUsage: number;
    cacheHits: number;
    cacheMisses: number;
    errorsEncountered: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ParseError[];
    warnings: ParseWarning[];
    confidence: number; // 0-1 score
}

export interface ParseError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
}

export interface ParseWarning extends ParseError {
    suggestion?: string;
}
```

### 2. Enhanced RegexParser Implementation

Expanded RegexParser with patterns for 15+ languages and performance optimizations:

```typescript
// src/core/parser/regex-parser.ts
import {
    Parser as BaseParser,
    type ParsedFile,
    type ParserOptions,
    type LanguagePatterns,
    type ParserCapabilities,
    type LanguageConfig
} from './types';
import { LANGUAGE_CONFIGS } from './languages/index';

export class RegexParser extends BaseParser {
    private languagePatterns: Map<string, LanguagePatterns>;
    private compiledPatterns: Map<string, Map<string, RegExp>>;
    private performanceMetrics: ParserPerformanceMetrics;
    
    constructor(options: ParserOptions = DEFAULT_PARSER_OPTIONS) {
        super(options);
        this.languagePatterns = new Map();
        this.compiledPatterns = new Map();
        this.performanceMetrics = this.initializeMetrics();
        this.initializeLanguagePatterns();
    }

    async initialize(): Promise<void> {
        const startTime = performance.now();
        
        // Pre-compile all regex patterns for better performance
        for (const [language, patterns] of this.languagePatterns) {
            this.compileLanguagePatterns(language, patterns);
        }
        
        this.performanceMetrics.parseTime += performance.now() - startTime;
    }

    getCapabilities(): ParserCapabilities {
        return {
            supportsAST: false,
            supportsIncrementalParsing: false,
            supportsErrorRecovery: true,
            supportedFeatures: [
                'imports', 'exports', 'functions', 'classes', 
                'interfaces', 'types', 'constants', 'comments'
            ],
            performanceLevel: 'medium'
        };
    }

    private initializeLanguagePatterns(): void {
        // TypeScript/JavaScript patterns
        this.languagePatterns.set('typescript', {
            imports: [
                /^import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]+\})|(?:\w+))\s*(?:,\s*(?:\{[^}]+\}|\w+))?\s+from\s+['"]([^'"]+)['"]/gm,
                /(?:const|let|var)\s+(?:\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
                /^import\s+['"]([^'"]+)['"]/gm // side-effect imports
            ],
            exports: [
                /^export\s+(?:(?:default\s+)|(?:async\s+))?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/gm,
                /^export\s*\{([^}]+)\}/gm,
                /^export\s+\*\s+from/gm
            ],
            functions: [
                /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?/gm,
                /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/gm
            ],
            classes: [
                /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?/gm
            ],
            interfaces: [
                /^(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?/gm
            ],
            types: [
                /^(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=/gm
            ],
            constants: [
                /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?!.*=>)/gm
            ],
            comments: [
                /\/\*[\s\S]*?\*\//g,
                /\/\/.*$/gm
            ],
            docstrings: [
                /\/\*\*[\s\S]*?\*\//g
            ]
        });

        // Python patterns
        this.languagePatterns.set('python', {
            imports: [
                /^from\s+(\S+)\s+import/gm,
                /^import\s+(\S+)/gm
            ],
            exports: [
                // Python doesn't have explicit exports, so we detect top-level definitions
                /^def\s+(\w+)/gm,
                /^class\s+(\w+)/gm,
                /^(\w+)\s*=\s*[^\n]+$/gm
            ],
            functions: [
                /^def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/gm
            ],
            classes: [
                /^class\s+(\w+)(?:\s*\([^)]*\))?:/gm
            ],
            constants: [
                /^([A-Z_][A-Z0-9_]*)\s*=\s*[^\n]+$/gm
            ],
            comments: [
                /#.*$/gm
            ],
            docstrings: [
                /"""[\s\S]*?"""/g,
                /'''[\s\S]*?'''/g
            ]
        });

        // Go patterns
        this.languagePatterns.set('go', {
            imports: [
                /^import\s+"([^"]+)"/gm,
                /^import\s+\(([\s\S]*?)\)/gm
            ],
            exports: [
                // Go exports are identified by uppercase first letter
                /^func\s+([A-Z]\w*)/gm,
                /^type\s+([A-Z]\w*)/gm,
                /^var\s+([A-Z]\w*)/gm,
                /^const\s+([A-Z]\w*)/gm
            ],
            functions: [
                /^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)(?:\s*[^{]+)?/gm
            ],
            types: [
                /^type\s+(\w+)\s+(?:struct|interface)/gm,
                /^type\s+(\w+)\s+[^\n]+$/gm
            ],
            constants: [
                /^const\s+(\w+)/gm
            ],
            comments: [
                /\/\*[\s\S]*?\*\//g,
                /\/\/.*$/gm
            ]
        });

        // Rust patterns
        this.languagePatterns.set('rust', {
            imports: [
                /^use\s+([^;]+);/gm
            ],
            exports: [
                /^pub\s+fn\s+(\w+)/gm,
                /^pub\s+struct\s+(\w+)/gm,
                /^pub\s+enum\s+(\w+)/gm,
                /^pub\s+trait\s+(\w+)/gm,
                /^pub\s+type\s+(\w+)/gm
            ],
            functions: [
                /^(?:pub\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)(?:\s*->\s*[^{]+)?/gm
            ],
            classes: [ // Structs in Rust
                /^(?:pub\s+)?struct\s+(\w+)(?:<[^>]+>)?/gm
            ],
            types: [
                /^(?:pub\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=/gm,
                /^(?:pub\s+)?trait\s+(\w+)(?:<[^>]+>)?/gm,
                /^(?:pub\s+)?enum\s+(\w+)(?:<[^>]+>)?/gm
            ],
            comments: [
                /\/\*[\s\S]*?\*\//g,
                /\/\/.*$/gm
            ]
        });

        // Add patterns for additional languages...
        this.addJavaPatterns();
        this.addCppPatterns();
        this.addCSharpPatterns();
        this.addRubyPatterns();
        this.addPhpPatterns();
        this.addSwiftPatterns();
        // ... more languages
    }

    private compileLanguagePatterns(language: string, patterns: LanguagePatterns): void {
        const compiled = new Map<string, RegExp>();
        
        for (const [category, regexArray] of Object.entries(patterns)) {
            if (regexArray && regexArray.length > 0) {
                // Combine multiple patterns into one for better performance
                const combinedPattern = regexArray.map(r => `(${r.source})`).join('|');
                compiled.set(category, new RegExp(combinedPattern, 'gm'));
            }
        }
        
        this.compiledPatterns.set(language, compiled);
    }

    supportsLanguage(language: string): boolean {
        return this.languagePatterns.has(language) || 
               LANGUAGE_CONFIGS.has(language);
    }

    getSupportedLanguages(): string[] {
        return Array.from(this.languagePatterns.keys());
    }

    // Performance optimized extraction
    extractEnhanced(content: string, language: string): EnhancedExtractedAPI {
        const startTime = performance.now();
        const patterns = this.compiledPatterns.get(language);
        
        if (!patterns) {
            throw new Error(`No patterns available for language: ${language}`);
        }

        const result = {
            file: '',
            imports: this.extractWithPattern(content, patterns.get('imports')),
            exports: this.extractExportsWithDetails(content, language, patterns)
        };

        this.performanceMetrics.parseTime += performance.now() - startTime;
        return result;
    }

    private extractWithPattern(content: string, pattern?: RegExp): string[] {
        if (!pattern) return [];
        
        const matches = [];
        let match;
        while ((match = pattern.exec(content)) !== null) {
            // Extract the actual import/export name from capture groups
            for (let i = 1; i < match.length; i++) {
                if (match[i]) {
                    matches.push(match[i]);
                    break;
                }
            }
        }
        
        return [...new Set(matches)].sort();
    }

    // Additional language patterns...
    private addJavaPatterns(): void {
        this.languagePatterns.set('java', {
            imports: [
                /^import\s+(?:static\s+)?(\S+);/gm
            ],
            exports: [
                /^public\s+(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)/gm,
                /^public\s+(?:static\s+)?(?:final\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/gm
            ],
            functions: [
                /^(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/gm
            ],
            classes: [
                /^(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/gm,
                /^(?:public\s+)?interface\s+(\w+)/gm,
                /^(?:public\s+)?enum\s+(\w+)/gm
            ],
            constants: [
                /^(?:public\s+)?static\s+final\s+[\w<>\[\]]+\s+(\w+)\s*=/gm
            ],
            comments: [
                /\/\*[\s\S]*?\*\//g,
                /\/\/.*$/gm
            ],
            docstrings: [
                /\/\*\*[\s\S]*?\*\//g
            ]
        });
    }

    // More language implementations...
}
```

### 3. Language Detection Algorithm and Mapping

Enhanced language detection with confidence scoring and multiple detection strategies:

```typescript
// src/core/parser/language-detector.ts
export interface LanguageDetectionResult {
    language: string;
    confidence: number; // 0-1 score
    detectionMethod: 'extension' | 'shebang' | 'content' | 'filename';
    alternatives: Array<{ language: string; confidence: number }>;
}

export class LanguageDetector {
    private static readonly EXTENSION_MAP = new Map([
        ['ts', { language: 'typescript', confidence: 0.95 }],
        ['tsx', { language: 'typescript', confidence: 0.95 }],
        ['js', { language: 'javascript', confidence: 0.90 }],
        ['jsx', { language: 'javascript', confidence: 0.90 }],
        ['mjs', { language: 'javascript', confidence: 0.85 }],
        ['py', { language: 'python', confidence: 0.95 }],
        ['pyi', { language: 'python', confidence: 0.90 }],
        ['go', { language: 'go', confidence: 0.95 }],
        ['rs', { language: 'rust', confidence: 0.95 }],
        ['java', { language: 'java', confidence: 0.95 }],
        ['cpp', { language: 'cpp', confidence: 0.90 }],
        ['cxx', { language: 'cpp', confidence: 0.90 }],
        ['cc', { language: 'cpp', confidence: 0.85 }],
        ['c', { language: 'c', confidence: 0.80 }], // Could be C++
        ['h', { language: 'c', confidence: 0.70 }], // Could be C++
        ['hpp', { language: 'cpp', confidence: 0.85 }],
        ['cs', { language: 'csharp', confidence: 0.95 }],
        ['rb', { language: 'ruby', confidence: 0.95 }],
        ['php', { language: 'php', confidence: 0.95 }],
        ['swift', { language: 'swift', confidence: 0.95 }],
        ['kt', { language: 'kotlin', confidence: 0.95 }],
        ['scala', { language: 'scala', confidence: 0.95 }],
        ['r', { language: 'r', confidence: 0.80 }], // Could be other files
        ['R', { language: 'r', confidence: 0.90 }],
        ['lua', { language: 'lua', confidence: 0.95 }],
        ['dart', { language: 'dart', confidence: 0.95 }],
        ['jl', { language: 'julia', confidence: 0.95 }],
        ['ex', { language: 'elixir', confidence: 0.95 }],
        ['exs', { language: 'elixir', confidence: 0.95 }],
        ['clj', { language: 'clojure', confidence: 0.95 }],
        ['cljs', { language: 'clojure', confidence: 0.95 }],
        ['hs', { language: 'haskell', confidence: 0.95 }],
        ['ml', { language: 'ocaml', confidence: 0.85 }],
        ['fs', { language: 'fsharp', confidence: 0.95 }],
        ['nim', { language: 'nim', confidence: 0.95 }],
        ['v', { language: 'vlang', confidence: 0.85 }],
        ['zig', { language: 'zig', confidence: 0.95 }]
    ]);

    private static readonly SHEBANG_MAP = new Map([
        [/^#!.*\bnode\b/, { language: 'javascript', confidence: 0.85 }],
        [/^#!.*\bpython[0-9.]*\b/, { language: 'python', confidence: 0.90 }],
        [/^#!.*\bruby\b/, { language: 'ruby', confidence: 0.90 }],
        [/^#!.*\bphp\b/, { language: 'php', confidence: 0.90 }],
        [/^#!.*\bbash\b/, { language: 'bash', confidence: 0.85 }],
        [/^#!.*\bsh\b/, { language: 'bash', confidence: 0.75 }],
        [/^#!.*\bzsh\b/, { language: 'bash', confidence: 0.80 }]
    ]);

    private static readonly CONTENT_PATTERNS = new Map([
        ['typescript', [
            { pattern: /\binterface\s+\w+/, weight: 0.3 },
            { pattern: /\btype\s+\w+\s*=/, weight: 0.25 },
            { pattern: /\b(?:public|private|protected)\s+\w+/, weight: 0.2 },
            { pattern: /\b(?:string|number|boolean)\b/, weight: 0.15 },
            { pattern: /\bimport\s+.*from\s+['"]/, weight: 0.1 }
        ]],
        ['javascript', [
            { pattern: /\bfunction\s+\w+/, weight: 0.2 },
            { pattern: /\bconst\s+\w+\s*=/, weight: 0.15 },
            { pattern: /\b(?:require|module\.exports)/, weight: 0.2 },
            { pattern: /\bimport\s+.*from\s+['"]/, weight: 0.15 }
        ]],
        ['python', [
            { pattern: /^\s*def\s+\w+/, weight: 0.3 },
            { pattern: /^\s*class\s+\w+/, weight: 0.25 },
            { pattern: /^\s*import\s+\w+/, weight: 0.2 },
            { pattern: /^\s*from\s+\w+\s+import/, weight: 0.2 }
        ]],
        ['go', [
            { pattern: /^\s*package\s+\w+/, weight: 0.4 },
            { pattern: /^\s*func\s+\w+/, weight: 0.3 },
            { pattern: /\bfmt\.Print/, weight: 0.2 },
            { pattern: /\b(?:var|const)\s+\w+/, weight: 0.1 }
        ]],
        ['rust', [
            { pattern: /^\s*fn\s+\w+/, weight: 0.3 },
            { pattern: /^\s*struct\s+\w+/, weight: 0.25 },
            { pattern: /^\s*use\s+\w+/, weight: 0.2 },
            { pattern: /\bprintln!/, weight: 0.15 },
            { pattern: /\b(?:let|mut)\s+\w+/, weight: 0.1 }
        ]]
    ]);

    static detectLanguage(filePath: string, content?: string): LanguageDetectionResult {
        const results: Array<{ language: string; confidence: number; method: string }> = [];
        
        // 1. Extension-based detection
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext) {
            const extResult = this.EXTENSION_MAP.get(ext);
            if (extResult) {
                results.push({
                    language: extResult.language,
                    confidence: extResult.confidence,
                    method: 'extension'
                });
            }
        }
        
        // 2. Filename-based detection
        const filename = filePath.split('/').pop()?.toLowerCase();
        const filenameResult = this.detectByFilename(filename);
        if (filenameResult) {
            results.push(filenameResult);
        }
        
        // 3. Content-based detection (if content provided)
        if (content) {
            // Shebang detection
            const shebangResult = this.detectByShebang(content);
            if (shebangResult) {
                results.push(shebangResult);
            }
            
            // Pattern-based detection
            const patternResults = this.detectByPatterns(content);
            results.push(...patternResults);
        }
        
        // Combine results and pick the best
        const combined = this.combineResults(results);
        const best = combined[0];
        
        if (!best) {
            return {
                language: 'unknown',
                confidence: 0,
                detectionMethod: 'none',
                alternatives: []
            };
        }
        
        return {
            language: best.language,
            confidence: best.confidence,
            detectionMethod: best.method as any,
            alternatives: combined.slice(1, 4).map(r => ({
                language: r.language,
                confidence: r.confidence
            }))
        };
    }

    private static detectByFilename(filename?: string): any {
        if (!filename) return null;
        
        const filenamePatterns = new Map([
            ['Dockerfile', { language: 'dockerfile', confidence: 0.95 }],
            ['Makefile', { language: 'makefile', confidence: 0.95 }],
            ['Rakefile', { language: 'ruby', confidence: 0.85 }],
            ['Gemfile', { language: 'ruby', confidence: 0.85 }],
            ['package.json', { language: 'json', confidence: 0.95 }],
            ['tsconfig.json', { language: 'json', confidence: 0.90 }],
            ['cargo.toml', { language: 'toml', confidence: 0.95 }],
            ['go.mod', { language: 'go', confidence: 0.80 }]
        ]);
        
        const result = filenamePatterns.get(filename);
        return result ? { ...result, method: 'filename' } : null;
    }

    private static detectByShebang(content: string): any {
        const firstLine = content.split('\n')[0];
        if (!firstLine.startsWith('#!')) return null;
        
        for (const [pattern, result] of this.SHEBANG_MAP) {
            if (pattern.test(firstLine)) {
                return { ...result, method: 'shebang' };
            }
        }
        
        return null;
    }

    private static detectByPatterns(content: string): any[] {
        const results: any[] = [];
        
        for (const [language, patterns] of this.CONTENT_PATTERNS) {
            let score = 0;
            let matchCount = 0;
            
            for (const { pattern, weight } of patterns) {
                const matches = (content.match(pattern) || []).length;
                if (matches > 0) {
                    score += weight * Math.min(matches, 3); // Cap at 3 matches per pattern
                    matchCount++;
                }
            }
            
            if (matchCount > 0) {
                const confidence = Math.min(score, 0.85); // Cap content-based confidence
                results.push({
                    language,
                    confidence,
                    method: 'content'
                });
            }
        }
        
        return results;
    }

    private static combineResults(results: any[]): any[] {
        const languageScores = new Map<string, { total: number; count: number; methods: string[] }>();
        
        for (const result of results) {
            const existing = languageScores.get(result.language) || { total: 0, count: 0, methods: [] };
            existing.total += result.confidence;
            existing.count++;
            existing.methods.push(result.method);
            languageScores.set(result.language, existing);
        }
        
        const combined = Array.from(languageScores.entries())
            .map(([language, { total, count, methods }]) => ({
                language,
                confidence: Math.min(total / count * 1.2, 1.0), // Slight boost for multiple methods
                method: methods.includes('extension') ? 'extension' : methods[0]
            }))
            .sort((a, b) => b.confidence - a.confidence);
        
        return combined;
    }
}
```

### 4. Parser Factory Pattern Implementation

Centralized parser selection and instantiation:

```typescript
// src/core/parser/parser-factory.ts
import { Parser, ParserOptions } from './types';
import { HybridParser } from './hybrid-parser';
import { TreeSitterParser } from './tree-sitter-parser';
import { RegexParser } from './regex-parser';
import { LanguageDetector } from './language-detector';

export type ParserType = 'auto' | 'tree-sitter' | 'regex' | 'hybrid';

export interface ParserFactoryOptions {
    preferredParser?: ParserType;
    fallbackEnabled?: boolean;
    performanceMode?: 'fast' | 'accurate' | 'balanced';
    cacheEnabled?: boolean;
}

export class ParserFactory {
    private static instance: ParserFactory;
    private parserCache: Map<string, Parser>;
    private options: ParserFactoryOptions;
    
    private constructor(options: ParserFactoryOptions = {}) {
        this.options = {
            preferredParser: 'hybrid',
            fallbackEnabled: true,
            performanceMode: 'balanced',
            cacheEnabled: true,
            ...options
        };
        this.parserCache = new Map();
    }
    
    static getInstance(options?: ParserFactoryOptions): ParserFactory {
        if (!ParserFactory.instance) {
            ParserFactory.instance = new ParserFactory(options);
        }
        return ParserFactory.instance;
    }
    
    async createParser(
        language: string, 
        parserOptions: ParserOptions,
        filePath?: string
    ): Promise<Parser> {
        const cacheKey = this.getCacheKey(language, this.options.preferredParser!, parserOptions);
        
        if (this.options.cacheEnabled && this.parserCache.has(cacheKey)) {
            return this.parserCache.get(cacheKey)!;
        }
        
        let parser: Parser;
        
        switch (this.options.preferredParser) {
            case 'tree-sitter':
                parser = await this.createTreeSitterParser(language, parserOptions);
                break;
                
            case 'regex':
                parser = new RegexParser(parserOptions);
                break;
                
            case 'hybrid':
                parser = new HybridParser(parserOptions);
                break;
                
            case 'auto':
            default:
                parser = await this.createOptimalParser(language, parserOptions, filePath);
                break;
        }
        
        await parser.initialize();
        
        if (this.options.cacheEnabled) {
            this.parserCache.set(cacheKey, parser);
        }
        
        return parser;
    }
    
    async createOptimalParser(
        language: string, 
        parserOptions: ParserOptions,
        filePath?: string
    ): Promise<Parser> {
        // Performance-based parser selection
        const performanceWeights = {
            fast: { treeSitter: 0.3, regex: 0.7, hybrid: 0.5 },
            accurate: { treeSitter: 0.8, regex: 0.2, hybrid: 0.6 },
            balanced: { treeSitter: 0.6, regex: 0.4, hybrid: 0.8 }
        };
        
        const weights = performanceWeights[this.options.performanceMode!];
        
        // Check Tree-sitter availability for language
        const treeSitterParser = new TreeSitterParser(parserOptions);
        const canUseTreeSitter = treeSitterParser.supportsLanguage(language);
        
        if (canUseTreeSitter && weights.treeSitter > weights.hybrid) {
            return treeSitterParser;
        }
        
        if (weights.hybrid > weights.regex) {
            return new HybridParser(parserOptions);
        }
        
        return new RegexParser(parserOptions);
    }
    
    private async createTreeSitterParser(
        language: string, 
        parserOptions: ParserOptions
    ): Promise<Parser> {
        const parser = new TreeSitterParser(parserOptions);
        
        if (!parser.supportsLanguage(language)) {
            if (this.options.fallbackEnabled) {
                console.warn(`Tree-sitter doesn't support ${language}, falling back to regex parser`);
                return new RegexParser(parserOptions);
            }
            throw new Error(`Tree-sitter parser doesn't support language: ${language}`);
        }
        
        return parser;
    }
    
    detectLanguageAndCreateParser(
        filePath: string, 
        content: string, 
        parserOptions: ParserOptions
    ): Promise<{ parser: Parser; language: string; confidence: number }> {
        const detection = LanguageDetector.detectLanguage(filePath, content);
        
        if (detection.confidence < 0.5) {
            console.warn(`Low confidence (${detection.confidence}) for language detection of ${filePath}`);
        }
        
        return this.createParser(detection.language, parserOptions, filePath)
            .then(parser => ({
                parser,
                language: detection.language,
                confidence: detection.confidence
            }));
    }
    
    getSupportedLanguages(): string[] {
        const hybrid = new HybridParser();
        return hybrid.getSupportedLanguages();
    }
    
    getParserCapabilities(language: string): Promise<any> {
        return this.createParser(language, { includeComments: false, includeDocstrings: true })
            .then(parser => parser.getCapabilities());
    }
    
    private getCacheKey(language: string, parserType: ParserType, options: ParserOptions): string {
        return `${language}-${parserType}-${JSON.stringify(options)}`;
    }
    
    clearCache(): void {
        this.parserCache.clear();
    }
}

// Convenience factory functions
export async function createParser(
    language: string,
    options: ParserOptions = { includeComments: false, includeDocstrings: true },
    factoryOptions?: ParserFactoryOptions
): Promise<Parser> {
    const factory = ParserFactory.getInstance(factoryOptions);
    return factory.createParser(language, options);
}

export async function detectAndParse(
    filePath: string,
    content: string,
    options: ParserOptions = { includeComments: false, includeDocstrings: true }
): Promise<{ parser: Parser; language: string; parsedFile: any }> {
    const factory = ParserFactory.getInstance();
    const { parser, language, confidence } = await factory.detectLanguageAndCreateParser(
        filePath, 
        content, 
        options
    );
    
    const parsedFile = await parser.parse(content, language);
    
    return { parser, language, parsedFile };
}
```

### 5. Step-by-Step Guide for Adding New Language Support

#### Adding a New Language (Example: Kotlin)

1. **Define Language Configuration**:
```typescript
// src/core/parser/languages/kotlin.ts
export const KOTLIN_CONFIG: LanguageConfig = {
    name: 'kotlin',
    extensions: ['kt', 'kts'],
    aliases: ['kotlin'],
    priority: 85,
    regexPatterns: {
        imports: [
            /^import\s+(\S+)/gm
        ],
        exports: [
            /^(?:public\s+)?(?:open\s+)?(?:class|interface|object)\s+(\w+)/gm,
            /^(?:public\s+)?fun\s+(\w+)/gm
        ],
        functions: [
            /^(?:public\s+|private\s+|internal\s+|protected\s+)?(?:suspend\s+)?fun\s+(\w+)\s*\(/gm
        ],
        classes: [
            /^(?:public\s+|private\s+|internal\s+|protected\s+)?(?:open\s+|abstract\s+|final\s+)?(?:class|interface|object)\s+(\w+)/gm
        ],
        constants: [
            /^(?:public\s+|private\s+|internal\s+|protected\s+)?const\s+val\s+(\w+)/gm
        ],
        comments: [
            /\/\*[\s\S]*?\*\//g,
            /\/\/.*$/gm
        ],
        docstrings: [
            /\/\*\*[\s\S]*?\*\//g
        ]
    }
};
```

2. **Add Tree-sitter Support (if available)**:
```typescript
// In tree-sitter-parser.ts constructor
try {
    const Kotlin = require('tree-sitter-kotlin');
    this.languageMap.set('kotlin', Kotlin);
} catch (error) {
    console.warn('Tree-sitter Kotlin grammar not available');
}
```

3. **Update Language Detector**:
```typescript
// Add to EXTENSION_MAP
['kt', { language: 'kotlin', confidence: 0.95 }],
['kts', { language: 'kotlin', confidence: 0.90 }],

// Add content patterns
['kotlin', [
    { pattern: /^\s*package\s+\w+/, weight: 0.3 },
    { pattern: /^\s*fun\s+\w+/, weight: 0.25 },
    { pattern: /\bval\s+\w+\s*=/, weight: 0.2 },
    { pattern: /\bvar\s+\w+\s*=/, weight: 0.2 }
]]
```

4. **Add Tests**:
```typescript
// test/parser/kotlin.test.ts
import { test, expect } from 'bun:test';
import { RegexParser } from '../../src/core/parser/regex-parser';

test('Kotlin function extraction', async () => {
    const parser = new RegexParser();
    await parser.initialize();
    
    const content = `
package com.example

fun main() {
    println("Hello World")
}

class MyClass {
    fun myMethod(): String {
        return "test"
    }
}
    `;
    
    const parsed = await parser.parse(content, 'kotlin');
    const extracted = parser.extract(parsed);
    
    expect(extracted.exports).toHaveLength(2);
    expect(extracted.exports[0].name).toBe('main');
    expect(extracted.exports[1].name).toBe('MyClass');
});
```

5. **Update Language Registry**:
```typescript
// src/core/parser/languages/index.ts
import { KOTLIN_CONFIG } from './kotlin';

export const LANGUAGE_CONFIGS = new Map([
    ['kotlin', KOTLIN_CONFIG],
    // ... other languages
]);
```

### 6. Performance Optimization Strategies

#### A. Pattern Compilation and Caching
```typescript
export class OptimizedRegexParser extends RegexParser {
    private compiledPatterns: Map<string, CompiledPattern> = new Map();
    private resultCache: LRUCache<string, ExtractedAPI> = new LRUCache(100);
    
    private compilePatterns(language: string): CompiledPattern {
        const cacheKey = `compiled-${language}`;
        if (this.compiledPatterns.has(cacheKey)) {
            return this.compiledPatterns.get(cacheKey)!;
        }
        
        const patterns = this.languagePatterns.get(language);
        if (!patterns) throw new Error(`No patterns for ${language}`);
        
        const compiled: CompiledPattern = {
            imports: this.combineRegexPatterns(patterns.imports),
            exports: this.combineRegexPatterns(patterns.exports),
            functions: this.combineRegexPatterns(patterns.functions),
            classes: this.combineRegexPatterns(patterns.classes)
        };
        
        this.compiledPatterns.set(cacheKey, compiled);
        return compiled;
    }
    
    private combineRegexPatterns(patterns: RegExp[]): RegExp {
        // Combine multiple patterns into a single regex for better performance
        const sources = patterns.map(p => `(${p.source})`);
        return new RegExp(sources.join('|'), 'gm');
    }
}
```

#### B. Streaming Parser for Large Files
```typescript
export class StreamingParser extends RegexParser {
    async parseStream(stream: ReadableStream, language: string): Promise<ExtractedAPI> {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        
        let buffer = '';
        let lineNumber = 0;
        const result: ExtractedAPI = { file: '', imports: [], exports: [] };
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    this.processLine(line, lineNumber++, language, result);
                }
            }
            
            // Process final buffer
            if (buffer) {
                this.processLine(buffer, lineNumber, language, result);
            }
        } finally {
            reader.releaseLock();
        }
        
        return result;
    }
    
    private processLine(line: string, lineNumber: number, language: string, result: ExtractedAPI): void {
        // Process line-by-line to avoid loading entire file into memory
        const patterns = this.getCompiledPatterns(language);
        
        // Check for imports
        const importMatch = patterns.imports.exec(line);
        if (importMatch) {
            result.imports.push(...this.extractMatches(importMatch));
        }
        
        // Check for exports
        const exportMatch = patterns.exports.exec(line);
        if (exportMatch) {
            result.exports.push({
                name: this.extractMatches(exportMatch)[0],
                type: this.inferType(line),
                signature: line.trim(),
                location: { startLine: lineNumber, endLine: lineNumber },
                visibility: 'public'
            });
        }
    }
}
```

#### C. Parallel Processing
```typescript
export class ParallelParser extends RegexParser {
    async parseFiles(files: Array<{path: string, content: string}>): Promise<Map<string, ExtractedAPI>> {
        const results = new Map<string, ExtractedAPI>();
        const chunks = this.chunkArray(files, 4); // Process in chunks of 4
        
        for (const chunk of chunks) {
            const promises = chunk.map(async file => {
                const language = LanguageDetector.detectLanguage(file.path, file.content).language;
                const parsed = await this.parse(file.content, language);
                const extracted = this.extract(parsed);
                return { path: file.path, extracted };
            });
            
            const chunkResults = await Promise.all(promises);
            chunkResults.forEach(({ path, extracted }) => {
                results.set(path, extracted);
            });
        }
        
        return results;
    }
    
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
```

---

## Testing Requirements
- Unit tests for each parser implementation
- Integration tests for parser factory
- Language detection tests
- Fallback mechanism tests
- Performance benchmarks
- Cross-language compatibility tests

## Success Metrics
- Support for 15+ programming languages
- <100ms parse time for files under 10KB
- >95% accuracy for language detection
- <30 minutes to add new language support
- Zero breaking changes to existing commands
- Graceful fallback in 100% of cases