# Task 12: Language Registry Architecture

## Overview
Refactor the parser system to use a modular, registry-based architecture where each language is a self-contained module that defines its own parsing strategy and processor implementation.

## Problem Statement
Current issues with the existing approach:
- All language logic mixed in a single Converter class
- Hard to add new languages without modifying core code
- No flexibility in parser types (forced tree-sitter or nothing)
- Difficult to maintain and test language-specific logic
- No clear separation of concerns
- User options not properly propagated to processors

## Goals
1. **Modularity**: Each language owns its entire implementation
2. **Option-Aware**: All processors respect CLI/user options
3. **Self-Contained**: Languages define their own parser and processing logic
4. **Extensibility**: Adding a new language should not require modifying core code
5. **Registry Pattern**: Central registry manages all language modules
6. **Clean API**: Simple interface for processing files with options

## Architecture Design

### Directory Structure
```
src/core/
├── languages/
│   ├── registry.ts           # Central language registry
│   ├── types.ts              # Shared types and interfaces
│   │
│   ├── typescript/           # TypeScript/JavaScript module
│   │   ├── index.ts          # Module entry point
│   │   ├── processor.ts      # TS-specific processor implementation
│   │   ├── patterns.ts       # TS patterns/configs
│   │   └── tests/
│   │
│   ├── python/               # Python module
│   │   ├── index.ts
│   │   ├── processor.ts      # Python processor (tree-sitter or line-based)
│   │   ├── patterns.ts
│   │   └── tests/
│   │
│   ├── go/                   # Go module
│   │   ├── index.ts
│   │   ├── processor.ts      # Go processor implementation
│   │   ├── patterns.ts
│   │   └── tests/
│   │
│   └── yaml/                 # Example of line-based parser
│       ├── index.ts
│       ├── processor.ts      # YAML line-based processor
│       └── tests/
```

### Core Components

#### 1. Processing Options (CLI/User Options)
```typescript
interface ProcessingOptions {
    // Output control
    includePrivate?: boolean;      // Include private members
    includeComments?: boolean;      // Include comment nodes
    includeDocstrings?: boolean;    // Include documentation
    includeImports?: boolean;       // Include import statements
    
    // Depth control
    depth?: 'public' | 'protected' | 'all';  // API surface depth
    maxDepth?: number;              // Maximum nesting depth
    
    // Filtering
    includePatterns?: string[];     // Include only matching names
    excludePatterns?: string[];     // Exclude matching names
    
    // Output format hints
    compact?: boolean;              // Compact output mode
    preserveOrder?: boolean;        // Maintain source order
    
    // Performance
    maxFileSize?: number;           // Skip files larger than this
    timeout?: number;               // Processing timeout in ms
}
```

#### 2. Language Module Interface
```typescript
interface LanguageModule {
    name: string;                    // 'typescript', 'python', etc.
    displayName: string;             // 'TypeScript', 'Python', etc.
    extensions: string[];            // ['.ts', '.tsx', '.js', '.jsx']
    
    // Lifecycle
    initialize(): Promise<void>;
    isInitialized(): boolean;
    
    // Processing - MUST respect options
    process(
        source: string, 
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult>;
    
    // Capabilities
    getCapabilities(): LanguageCapabilities;
    
    // Validation
    canProcess(filePath: string): boolean;
    supportsExtension(ext: string): boolean;
}

interface LanguageCapabilities {
    supportsPrivateMembers: boolean;
    supportsComments: boolean;
    supportsDocstrings: boolean;
    supportsStreaming: boolean;
    supportsPartialParsing: boolean;
    maxRecommendedFileSize?: number;
}
```

#### 3. Process Result
```typescript
interface ProcessResult {
    imports: ImportNode[];
    exports: ExportNode[];
    errors?: ProcessError[];
    metadata?: {
        parseTime?: number;
        nodeCount?: number;
        skipped?: SkippedItem[];    // What was filtered out
        languageVersion?: string;
    };
}

interface SkippedItem {
    name: string;
    reason: 'private' | 'pattern' | 'depth' | 'comment';
    line?: number;
}

interface ExportNode {
    name: string;
    kind: ExportKind;
    signature: string;
    visibility?: 'public' | 'private' | 'protected';
    members?: MemberNode[];
    line?: number;
    depth?: number;                 // Nesting depth
    isExported?: boolean;
    docstring?: string;             // If includeDocstrings is true
    comment?: string;               // If includeComments is true
}
```

#### 4. Language Registry
```typescript
class LanguageRegistry {
    private modules: Map<string, LanguageModule>;
    private extensionMap: Map<string, string>;  // ext -> language name
    
    // Registration
    register(module: LanguageModule): void;
    unregister(name: string): void;
    
    // Discovery
    getLanguageForFile(filePath: string): LanguageModule | null;
    getLanguageByName(name: string): LanguageModule | null;
    getAllLanguages(): LanguageModule[];
    getSupportedExtensions(): string[];
    
    // Processing with options
    async processFile(
        filePath: string, 
        source: string,
        options: ProcessingOptions
    ): Promise<ProcessResult>;
    
    // Initialization
    async initializeAll(): Promise<void>;
    async initializeLanguage(name: string): Promise<void>;
}
```

## Implementation Examples

### TypeScript Language Module
```typescript
// languages/typescript/index.ts
export class TypeScriptModule implements LanguageModule {
    name = 'typescript';
    displayName = 'TypeScript';
    extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    
    private processor?: TypeScriptProcessor;
    private initialized = false;
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Initialize processor (tree-sitter or fallback)
        this.processor = new TypeScriptProcessor();
        await this.processor.initialize();
        this.initialized = true;
    }
    
    async process(
        source: string, 
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult> {
        if (!this.initialized) {
            await this.initialize();
        }
        
        return this.processor!.process(source, filePath, options);
    }
    
    getCapabilities(): LanguageCapabilities {
        return {
            supportsPrivateMembers: true,
            supportsComments: true,
            supportsDocstrings: true,
            supportsStreaming: false,
            supportsPartialParsing: true,
            maxRecommendedFileSize: 10 * 1024 * 1024  // 10MB
        };
    }
}

// languages/typescript/processor.ts
class TypeScriptProcessor {
    private parser: any;
    private treeSitterAvailable = false;
    
    async initialize(): Promise<void> {
        try {
            const Parser = require('tree-sitter');
            const TypeScript = require('tree-sitter-typescript');
            this.parser = new Parser();
            this.parser.setLanguage(TypeScript.typescript);
            this.treeSitterAvailable = true;
        } catch {
            // Fall back to line-based parsing
            this.treeSitterAvailable = false;
        }
    }
    
    async process(
        source: string,
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult> {
        if (this.treeSitterAvailable) {
            return this.processWithTreeSitter(source, filePath, options);
        } else {
            return this.processLineBased(source, filePath, options);
        }
    }
    
    private processWithTreeSitter(
        source: string,
        filePath: string,
        options: ProcessingOptions
    ): ProcessResult {
        const tree = this.parser.parse(source);
        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        const skipped: SkippedItem[] = [];
        
        this.walkNode(tree.rootNode, {
            source,
            options,
            exports,
            imports,
            skipped,
            depth: 0
        });
        
        return {
            imports: options.includeImports !== false ? imports : [],
            exports: this.filterExports(exports, options),
            metadata: {
                skipped: skipped.length > 0 ? skipped : undefined
            }
        };
    }
    
    private walkNode(node: any, context: WalkContext): void {
        // Skip if exceeds max depth
        if (context.options.maxDepth && context.depth > context.options.maxDepth) {
            context.skipped.push({
                name: this.getNodeName(node) || 'unknown',
                reason: 'depth'
            });
            return;
        }
        
        // Process based on node type
        switch (node.type) {
            case 'class_declaration':
                this.processClass(node, context);
                break;
            case 'function_declaration':
                this.processFunction(node, context);
                break;
            // ... etc
        }
        
        // Walk children
        for (const child of node.children || []) {
            this.walkNode(child, {
                ...context,
                depth: context.depth + 1
            });
        }
    }
    
    private processClass(node: any, context: WalkContext): void {
        const visibility = this.getVisibility(node);
        
        // Check if should include based on options
        if (!this.shouldInclude(visibility, context.options)) {
            context.skipped.push({
                name: this.getNodeName(node),
                reason: 'private',
                line: this.getLineNumber(node)
            });
            return;
        }
        
        const exportNode: ExportNode = {
            name: this.getNodeName(node),
            kind: 'class',
            signature: this.getSignature(node, context.options.compact),
            visibility,
            line: this.getLineNumber(node),
            depth: context.depth
        };
        
        // Add docstring if requested
        if (context.options.includeDocstrings) {
            exportNode.docstring = this.extractDocstring(node);
        }
        
        // Add comments if requested
        if (context.options.includeComments) {
            exportNode.comment = this.extractComment(node);
        }
        
        // Process members if not compact
        if (!context.options.compact) {
            exportNode.members = this.extractMembers(node, context);
        }
        
        context.exports.push(exportNode);
    }
    
    private shouldInclude(visibility: string, options: ProcessingOptions): boolean {
        if (options.depth === 'all') return true;
        if (options.depth === 'protected' && visibility !== 'private') return true;
        if (options.depth === 'public' && visibility === 'public') return true;
        if (!options.depth && visibility === 'public') return true;  // Default
        
        return options.includePrivate && visibility === 'private';
    }
    
    private filterExports(exports: ExportNode[], options: ProcessingOptions): ExportNode[] {
        let filtered = exports;
        
        // Apply include patterns
        if (options.includePatterns && options.includePatterns.length > 0) {
            filtered = filtered.filter(exp => 
                options.includePatterns!.some(pattern => 
                    this.matchesPattern(exp.name, pattern)
                )
            );
        }
        
        // Apply exclude patterns
        if (options.excludePatterns && options.excludePatterns.length > 0) {
            filtered = filtered.filter(exp => 
                !options.excludePatterns!.some(pattern => 
                    this.matchesPattern(exp.name, pattern)
                )
            );
        }
        
        // Sort if not preserving order
        if (!options.preserveOrder) {
            filtered.sort((a, b) => {
                // Sort by kind, then name
                if (a.kind !== b.kind) {
                    return a.kind.localeCompare(b.kind);
                }
                return a.name.localeCompare(b.name);
            });
        }
        
        return filtered;
    }
}
```

### Python Module with Line-Based Parsing
```typescript
// languages/python/processor.ts
class PythonProcessor {
    async process(
        source: string,
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult> {
        const lines = source.split('\n');
        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        
        let currentClass: ExportNode | null = null;
        let currentIndent = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const indent = this.getIndentLevel(line);
            
            // Skip comments unless requested
            if (trimmed.startsWith('#')) {
                if (!options.includeComments) continue;
            }
            
            // Process imports
            if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
                if (options.includeImports !== false) {
                    imports.push(this.parseImport(trimmed, i + 1));
                }
                continue;
            }
            
            // Process class definitions
            if (trimmed.startsWith('class ')) {
                currentClass = this.parseClass(trimmed, i + 1, options);
                if (this.shouldIncludeExport(currentClass, options)) {
                    exports.push(currentClass);
                }
                currentIndent = indent;
                continue;
            }
            
            // Process function definitions
            if (trimmed.startsWith('def ')) {
                const func = this.parseFunction(trimmed, i + 1, options);
                
                // Check if it's a method inside a class
                if (currentClass && indent > currentIndent) {
                    if (!options.compact && currentClass.members) {
                        // Check if method should be included
                        if (this.shouldIncludeMember(func, options)) {
                            currentClass.members.push({
                                name: func.name,
                                kind: 'method',
                                signature: func.signature
                            });
                        }
                    }
                } else {
                    // Top-level function
                    if (this.shouldIncludeExport(func, options)) {
                        exports.push(func);
                    }
                    currentClass = null;
                }
            }
        }
        
        return { imports, exports };
    }
    
    private shouldIncludeExport(node: ExportNode, options: ProcessingOptions): boolean {
        // Python convention: _ prefix means private
        const isPrivate = node.name.startsWith('_');
        
        if (isPrivate && !options.includePrivate) {
            return false;
        }
        
        // Check patterns
        if (options.excludePatterns) {
            for (const pattern of options.excludePatterns) {
                if (this.matchesPattern(node.name, pattern)) {
                    return false;
                }
            }
        }
        
        if (options.includePatterns && options.includePatterns.length > 0) {
            return options.includePatterns.some(pattern => 
                this.matchesPattern(node.name, pattern)
            );
        }
        
        return true;
    }
}
```

## Acceptance Criteria
- [ ] Each language module is completely self-contained
- [ ] All processors respect ProcessingOptions from CLI
- [ ] Options properly filter private/public members
- [ ] Pattern matching works for include/exclude
- [ ] Depth control is enforced
- [ ] Comments/docstrings included only when requested
- [ ] Performance options (timeout, maxFileSize) respected
- [ ] Adding a new language requires no core code changes
- [ ] Registry automatically discovers languages by file extension
- [ ] All existing CLI options work with new architecture

## Benefits
1. **Option Propagation**: User preferences respected throughout
2. **Language Ownership**: Each language owns its entire implementation
3. **No Shared Processors**: No confusion about tree-sitter.ts in processors/
4. **Flexibility**: Each language can optimize for its patterns
5. **Maintainability**: Clear boundaries and responsibilities
6. **User Control**: Fine-grained control over output

## Migration Path
1. Implement ProcessingOptions type
2. Create first language module with full option support
3. Test with various CLI option combinations
4. Migrate other languages one by one
5. Remove old converter/parser code
6. Update CLI to pass options through

## Success Metrics
- All CLI options work correctly
- No regression in functionality
- Improved code organization
- Easier to add new languages
- Better test coverage per language