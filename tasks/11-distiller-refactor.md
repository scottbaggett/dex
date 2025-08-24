# Task 11: Distiller Refactor Implementation

## Overview
Refactor the distiller command to provide deterministic, clean API surface extraction with multiple output formats and improved performance.

## Current State
- Complex hybrid parser with regex fallback
- Inconsistent output formats
- Performance issues with large codebases
- Runtime noise and artifacts in output
- Limited CLI options

## Target State
- Clean, deterministic API surface extraction
- Multiple output formats (markdown, json, xml, txt, jsonl)
- Parallel processing with worker pools
- No regex fallback - simplified parsing
- Rich CLI with format selection and performance controls

## Implementation Steps

### Core Insight from Go Implementation
The Go parser demonstrates a clean separation of concerns:
- **Parser**: Handles tree-sitter WASM/native interface only
- **Converter**: Transforms AST nodes to IR format
- **No Regex Fallback**: Unknown nodes return nil, no complex guessing
- **Language-Specific Methods**: Clean switch statements for each language
- **Deterministic Output**: Only structural elements, no runtime noise

### Phase 1: Remove Regex Fallback & Create Converter Pattern
1. **Delete regex parser files**
   - Remove `src/core/parser/regex-parser.ts`
   - Remove regex parser tests
   - Remove hybrid parser complexity

2. **Create Converter pattern (inspired by Go implementation)**
   ```typescript
   // src/core/parser/converter.ts
   export class Converter {
     constructor(
       private language: string,
       private source: string
     ) {}
     
     convertTree(tree: Parser.Tree): CanonicalAPI {
       const root = tree.rootNode;
       const api: CanonicalAPI = {
         file: '',
         imports: [],
         exports: []
       };
       
       for (const child of root.children) {
         const node = this.convertNode(child);
         if (node) {
           // Add to appropriate collection
         }
       }
       
       return api;
     }
     
     private convertNode(node: Parser.SyntaxNode): CanonicalExport | null {
       // Skip unnamed nodes
       if (!node.isNamed) return null;
       
       switch (this.language) {
         case 'typescript':
         case 'javascript':
           return this.convertJSNode(node);
         case 'python':
           return this.convertPythonNode(node);
         case 'go':
           return this.convertGoNode(node);
         default:
           return null; // Skip unsupported
       }
     }
     
     private convertJSNode(node: Parser.SyntaxNode): CanonicalExport | null {
       switch (node.type) {
         case 'class_declaration':
           return this.createClassExport(node);
         case 'function_declaration':
         case 'arrow_function':
           return this.createFunctionExport(node);
         case 'lexical_declaration': // const/let
           return this.createVariableExport(node);
         case 'type_alias_declaration':
           return this.createTypeExport(node);
         case 'interface_declaration':
           return this.createInterfaceExport(node);
         default:
           return null; // Skip unknown nodes
       }
     }
   }
   ```

3. **Simplify Parser interface**
   ```typescript
   export abstract class Parser {
     abstract parse(content: string): Parser.Tree | null;
     abstract supportsLanguage(lang: string): boolean;
   }
   ```

### Phase 2: Formatter Abstraction
1. **Create Formatter interface**
   ```typescript
   // src/core/distiller/formatters/types.ts
   export interface Formatter {
     format(result: DistillationResult, options: FormatterOptions): string;
     extension(): string;
   }
   
   export interface FormatterOptions {
     includeMetadata?: boolean;
     includeLocation?: boolean;
     compact?: boolean;
     absolutePaths?: boolean;
     sortNodes?: boolean;
   }
   ```

2. **Implement formatters**
   - `TxtFormatter` - compact plain text (default)
   - `MarkdownFormatter` - human-readable
   - `JsonFormatter` - structured data
   - `XmlFormatter` - verbose markup
   - `JsonlFormatter` - line-delimited JSON

3. **Update distiller to use formatters**
   - Replace current formatting logic
   - Use formatter based on `--format` flag

### Phase 3: Parser Normalization with Converter

1. **Leverage Converter for normalization**
   - All AST → IR conversion goes through Converter
   - Language-specific logic isolated in converter methods
   - No attempts to parse unknown constructs

2. **Simple extraction rules**
   ```typescript
   // Only extract these node types per language
   const EXTRACTABLE_NODES = {
     typescript: [
       'class_declaration',
       'function_declaration', 
       'interface_declaration',
       'type_alias_declaration',
       'enum_declaration',
       'export_statement',
       'import_statement'
     ],
     python: [
       'class_definition',
       'function_definition',
       'import_statement',
       'import_from_statement'
     ],
     go: [
       'type_declaration',
       'function_declaration',
       'method_declaration',
       'import_declaration',
       'package_clause'
     ]
   };
   ```

3. **Skip runtime constructs**
   - No if/else/switch statements
   - No loops or control flow
   - No function bodies
   - No variable values
   - Only signatures and structure
1. **Create canonical export shape**
   ```typescript
   interface CanonicalExport {
     name: string;
     type: 'function' | 'class' | 'interface' | 'const' | 'type' | 'enum';
     signature: string;
     members?: CanonicalMember[];
   }
   
   interface CanonicalAPI {
     file: string;
     imports: string[];
     exports: CanonicalExport[];
   }
   ```

2. **Normalize parser output**
   - Strip modifiers (export, async, visibility)
   - Deduplicate by (name, type)
   - Merge duplicate members
   - Stable ordering

3. **Create language map**
   - Single source of truth: `src/core/language-map.ts`
   - Extension to language mapping
   - Parser capabilities per language

### Phase 4: Performance Improvements
1. **Implement worker pool**
   ```typescript
   // src/utils/parallel.ts
   export async function parallel<T, R>(
     items: T[],
     processor: (item: T) => Promise<R>,
     workers: number = os.cpus().length
   ): Promise<R[]>
   ```

2. **Add early skip logic**
   - Check .gitignore patterns
   - Skip binary files
   - Honor exclude globs
   - Size limits

3. **Optimize file operations**
   - Stream large files
   - Cache parsed results
   - Batch I/O operations

### Phase 5: CLI Enhancement
1. **Add new flags**
   ```typescript
   .option('--surface <mode>', 'Surface extraction mode', 'compact')
   .option('-f, --format <format>', 'Output format', 'txt')
   .option('-w, --workers <num>', 'Worker threads (0=auto)', '0')
   .option('--select', 'Interactive file selection')
   .option('--file-path-type <type>', 'Path display type')
   ```

2. **Update output handling**
   - Use formatter extension for file naming
   - Consistent .dex/ output location
   - Progress on stderr only

3. **Improve help text**
   - Document all formats
   - Explain worker options
   - Show examples

### Phase 6: Quality Gates
1. **Add regex guards**
   ```typescript
   const ARTIFACT_PATTERNS = [
     /\b(useState|useEffect|console\.log)\b/,
     /\{[\s\n]*\.\.\./,  // Spread artifacts
     /\[\s*\d+\s*\]/,     // Array indices
   ];
   
   function hasArtifacts(output: string): boolean {
     return ARTIFACT_PATTERNS.some(p => p.test(output));
   }
   ```

2. **Create golden tests**
   - Snapshot tests per formatter
   - Known input → expected output
   - Detect regressions

3. **Add performance tests**
   - Benchmark with 1k, 10k files
   - Memory usage monitoring
   - Ensure linear scaling

## Acceptance Criteria
- [ ] No regex fallback parser in codebase
- [ ] 5 working formatters (txt, md, json, xml, jsonl)
- [ ] Deterministic output (no runtime artifacts)
- [ ] Parallel processing with --workers flag
- [ ] All formats have golden snapshot tests
- [ ] Performance: 10k files < 30s with bounded memory
- [ ] Clean CLI with --format, --surface, --workers flags
- [ ] Output saved to .dex/ with correct extensions

## Migration Guide
1. Default behavior changes:
   - Output is now `.txt` not `.md`
   - Compact format by default
   - No regex fallback for unsupported files

2. New recommended usage:
   ```bash
   # Compact API surface (default)
   dex distill ./src
   
   # Human-readable markdown
   dex distill ./src --format markdown
   
   # Structured JSON for tools
   dex distill ./src --format json
   
   # Parallel processing
   dex distill ./large-repo --workers 8
   ```

3. Breaking changes:
   - Removed complex parsing for unsupported languages
   - Output format structure changed
   - Some CLI flags renamed/removed

## Files to Modify
- **Remove**:
  - `src/core/parser/regex-parser.ts`
  - `src/core/parser/hybrid-parser.ts`
  
- **Create**:
  - `src/core/parser/converter.ts` - AST → IR converter
  - `src/core/distiller/formatters/txt.ts` - Compact text formatter
  - `src/core/distiller/formatters/markdown.ts` - Human-readable formatter
  - `src/core/distiller/formatters/json.ts` - Structured data formatter
  - `src/core/distiller/formatters/xml.ts` - Verbose formatter
  - `src/core/distiller/formatters/jsonl.ts` - Streaming formatter
  - `src/utils/parallel.ts` - Worker pool implementation
  - `src/core/language-map.ts` - Extension → language mapping
  
- **Modify**:
  - `src/core/parser/tree-sitter-parser.ts` - Simplify, remove fallback logic
  - `src/core/distiller/index.ts` - Use converter pattern
  - `src/commands/distill.ts` - Add new CLI flags
  - Tests - Update for new structure

## Risk Mitigation
- Keep tree-sitter parser working during refactor
- Implement formatters incrementally
- Test each phase before moving to next
- Keep old formatter code until new ones verified
- Document breaking changes clearly

## Success Metrics
- Distiller output 50% smaller (no artifacts)
- Performance 2x faster with parallel processing
- Zero regression in supported languages
- Consistent output across runs (deterministic)
- All tests passing with new implementation