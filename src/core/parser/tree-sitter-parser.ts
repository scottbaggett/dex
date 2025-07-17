import { Parser as BaseParser, ParsedFile, ParserOptions } from './parser';
import { DistillDepth, ExtractedAPI } from '../../types';

// Optional Tree-sitter imports with graceful fallback
let Parser: any = null;
let TypeScript: any = null;
let JavaScript: any = null;
let Python: any = null;

try {
  Parser = require('tree-sitter');
  TypeScript = require('tree-sitter-typescript');
  JavaScript = require('tree-sitter-javascript');
  Python = require('tree-sitter-python');
} catch (error) {
  // Tree-sitter native bindings not available
}

interface TreeSitterExport {
  name: string;
  type: 'function' | 'class' | 'interface' | 'const' | 'type' | 'enum';
  signature: string;
  visibility: 'public' | 'private';
  location: {
    startLine: number;
    endLine: number;
  };
  members?: Array<{
    name: string;
    signature: string;
    type: 'property' | 'method';
  }>;
  docstring?: string;
}

interface TreeSitterExtractedAPI {
  file: string;
  imports: string[];
  exports: TreeSitterExport[];
}

/**
 * Actual Tree-sitter based parser that uses AST traversal for accurate code parsing
 */
export class TreeSitterParser extends BaseParser {
  protected options: ParserOptions;
  private parser: any;
  private initialized = false;
  private languageMap: Map<string, any>;
  private isTreeSitterAvailable: boolean;

  constructor(options: ParserOptions = { includeComments: false, includeDocstrings: true }) {
    super(options);
    this.options = options;
    this.isTreeSitterAvailable = Parser !== null;

    if (this.isTreeSitterAvailable) {
      this.parser = new Parser();
      this.languageMap = new Map([
        ['typescript', TypeScript?.typescript],
        ['tsx', TypeScript?.tsx],
        ['javascript', JavaScript],
        ['python', Python],
      ]);
    } else {
      this.parser = null;
      this.languageMap = new Map();
    }
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async parse(content: string, language: string): Promise<ParsedFile> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isTreeSitterAvailable) {
      throw new Error('Tree-sitter native bindings not available');
    }

    const treeSitterLanguage = this.languageMap.get(language);
    if (!treeSitterLanguage) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.parser.setLanguage(treeSitterLanguage);
    const tree = this.parser.parse(content);

    return {
      path: '',
      language,
      ast: tree,
      content,
    };
  }

  extract(parsedFile: ParsedFile, depth: DistillDepth): ExtractedAPI {
    const { content, path, language, ast } = parsedFile;

    if (!ast) {
      throw new Error('No AST available for extraction');
    }

    const extracted = this.extractFromAST(ast, content, language);

    return {
      file: path,
      imports: extracted.imports,
      exports: this.filterByDepth(extracted.exports, depth),
    };
  }

  private extractFromAST(tree: any, content: string, language: string): TreeSitterExtractedAPI {
    const imports: string[] = [];
    const exports: TreeSitterExport[] = [];
    const lines = content.split('\n');

    // Walk the AST and extract relevant nodes
    this.walkAST(tree.rootNode, (node: any) => {
      switch (language) {
        case 'typescript':
        case 'tsx':
        case 'javascript':
          this.extractTypeScriptNode(node, content, lines, imports, exports);
          break;
        case 'python':
          this.extractPythonNode(node, content, lines, imports, exports);
          break;
        // Go and Rust support can be added later
      }
    });

    return {
      file: '',
      imports: [...new Set(imports)].sort(),
      exports,
    };
  }

  private walkAST(node: any, callback: (node: any) => void): void {
    callback(node);

    for (let i = 0; i < node.childCount; i++) {
      this.walkAST(node.child(i), callback);
    }
  }

  private extractTypeScriptNode(
    node: any,
    content: string,
    lines: string[],
    imports: string[],
    exports: TreeSitterExport[]
  ): void {
    switch (node.type) {
      case 'import_statement':
        this.extractTypeScriptImport(node, content, imports);
        break;
      case 'export_statement':
        this.extractTypeScriptExport(node, content, lines, exports);
        break;
      case 'function_declaration':
        if (this.isExported(node)) {
          this.extractTypeScriptFunction(node, content, lines, exports);
        }
        break;
      case 'class_declaration':
        if (this.isExported(node)) {
          this.extractTypeScriptClass(node, content, lines, exports);
        }
        break;
      case 'interface_declaration':
        if (this.isExported(node)) {
          this.extractTypeScriptInterface(node, content, lines, exports);
        }
        break;
      case 'type_alias_declaration':
        if (this.isExported(node)) {
          this.extractTypeScriptTypeAlias(node, content, lines, exports);
        }
        break;
      case 'enum_declaration':
        if (this.isExported(node)) {
          this.extractTypeScriptEnum(node, content, lines, exports);
        }
        break;
    }
  }

  private extractTypeScriptImport(node: any, content: string, imports: string[]): void {
    // Extract import source
    const importClause = node.childForFieldName('source');
    if (importClause) {
      const source = this.getNodeText(importClause, content);
      // Remove quotes
      const cleanSource = source.replace(/['"]/g, '');
      imports.push(cleanSource);
    }
  }

  private extractTypeScriptExport(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    // Handle different export types
    const declaration = node.childForFieldName('declaration');
    if (declaration) {
      switch (declaration.type) {
        case 'function_declaration':
          this.extractTypeScriptFunction(declaration, content, lines, exports, true);
          break;
        case 'class_declaration':
          this.extractTypeScriptClass(declaration, content, lines, exports, true);
          break;
        case 'interface_declaration':
          this.extractTypeScriptInterface(declaration, content, lines, exports, true);
          break;
        case 'type_alias_declaration':
          this.extractTypeScriptTypeAlias(declaration, content, lines, exports, true);
          break;
        case 'enum_declaration':
          this.extractTypeScriptEnum(declaration, content, lines, exports, true);
          break;
      }
    }
  }

  private extractTypeScriptFunction(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[],
    isExported = false
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getNodeText(node, content).split('{')[0].trim();
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'function',
      signature,
      visibility: isExported || this.isExported(node) ? 'public' : 'private',
      location: { startLine, endLine },
      docstring: this.extractDocstring(node, lines),
    });
  }

  private extractTypeScriptClass(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[],
    isExported = false
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getClassSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const members = this.extractClassMembers(node, content);

    exports.push({
      name,
      type: 'class',
      signature,
      visibility: isExported || this.isExported(node) ? 'public' : 'private',
      location: { startLine, endLine },
      members,
      docstring: this.extractDocstring(node, lines),
    });
  }

  private extractTypeScriptInterface(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[],
    isExported = false
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getInterfaceSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const members = this.extractInterfaceMembers(node, content);

    exports.push({
      name,
      type: 'interface',
      signature,
      visibility: isExported || this.isExported(node) ? 'public' : 'private',
      location: { startLine, endLine },
      members,
      docstring: this.extractDocstring(node, lines),
    });
  }

  private extractTypeScriptTypeAlias(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[],
    isExported = false
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getNodeText(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'type',
      signature,
      visibility: isExported || this.isExported(node) ? 'public' : 'private',
      location: { startLine, endLine },
      docstring: this.extractDocstring(node, lines),
    });
  }

  private extractTypeScriptEnum(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[],
    isExported = false
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getEnumSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'enum',
      signature,
      visibility: isExported || this.isExported(node) ? 'public' : 'private',
      location: { startLine, endLine },
      docstring: this.extractDocstring(node, lines),
    });
  }

  private extractPythonNode(
    node: any,
    content: string,
    lines: string[],
    imports: string[],
    exports: TreeSitterExport[]
  ): void {
    switch (node.type) {
      case 'import_statement':
      case 'import_from_statement':
        this.extractPythonImport(node, content, imports);
        break;
      case 'function_definition':
        if (this.isPythonTopLevel(node)) {
          this.extractPythonFunction(node, content, lines, exports);
        }
        break;
      case 'class_definition':
        this.extractPythonClass(node, content, lines, exports);
        break;
    }
  }

  private extractPythonImport(node: any, content: string, imports: string[]): void {
    if (node.type === 'import_statement') {
      // import module
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        imports.push(this.getNodeText(nameNode, content));
      }
    } else if (node.type === 'import_from_statement') {
      // from module import ...
      const moduleNode = node.childForFieldName('module_name');
      if (moduleNode) {
        imports.push(this.getNodeText(moduleNode, content));
      }
    }
  }

  private extractPythonFunction(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getPythonFunctionSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'function',
      signature,
      visibility: name.startsWith('_') ? 'private' : 'public',
      location: { startLine, endLine },
      docstring: this.extractPythonDocstring(node, content),
    });
  }

  private extractPythonClass(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getPythonClassSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const members = this.extractPythonClassMembers(node, content);

    exports.push({
      name,
      type: 'class',
      signature,
      visibility: name.startsWith('_') ? 'private' : 'public',
      location: { startLine, endLine },
      members,
      docstring: this.extractPythonDocstring(node, content),
    });
  }

  private extractGoImport(node: any, content: string, imports: string[]): void {
    // Extract Go import paths
    const importSpec = node.childForFieldName('import_spec');
    if (importSpec) {
      const path = this.getNodeText(importSpec, content);
      imports.push(path.replace(/['"]/g, ''));
    }
  }

  private extractGoFunction(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getGoFunctionSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'function',
      signature,
      visibility: this.isGoExported(name) ? 'public' : 'private',
      location: { startLine, endLine },
    });
  }

  private extractGoType(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    // Extract Go type declarations
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getNodeText(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'type',
      signature,
      visibility: this.isGoExported(name) ? 'public' : 'private',
      location: { startLine, endLine },
    });
  }

  private extractRustUse(node: any, content: string, imports: string[]): void {
    // Extract Rust use statements
    const useTree = node.childForFieldName('argument');
    if (useTree) {
      const path = this.getNodeText(useTree, content);
      imports.push(path);
    }
  }

  private extractRustFunction(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getRustFunctionSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'function',
      signature,
      visibility: this.isRustPublic(node) ? 'public' : 'private',
      location: { startLine, endLine },
    });
  }

  private extractRustStruct(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getRustStructSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'class', // Treat struct as class-like
      signature,
      visibility: this.isRustPublic(node) ? 'public' : 'private',
      location: { startLine, endLine },
    });
  }

  private extractRustEnum(
    node: any,
    content: string,
    lines: string[],
    exports: TreeSitterExport[]
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const name = this.getNodeText(nameNode, content);
    const signature = this.getRustEnumSignature(node, content);
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    exports.push({
      name,
      type: 'enum',
      signature,
      visibility: this.isRustPublic(node) ? 'public' : 'private',
      location: { startLine, endLine },
    });
  }

  // Helper methods
  private getNodeText(node: any, content: string): string {
    return content.slice(node.startIndex, node.endIndex);
  }

  private isExported(node: any): boolean {
    // Check if node has export modifier
    let current = node.parent;
    while (current) {
      if (current.type === 'export_statement') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private isPythonTopLevel(node: any): boolean {
    // Check if function is at module level (not inside class)
    let current = node.parent;
    while (current) {
      if (current.type === 'class_definition') {
        return false;
      }
      current = current.parent;
    }
    return true;
  }

  private isGoExported(name: string): boolean {
    // In Go, exported names start with uppercase letter
    return name.length > 0 && name[0] === name[0].toUpperCase();
  }

  private isRustPublic(node: any): boolean {
    // Check for pub modifier
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'visibility_modifier' && this.getNodeText(child, '').includes('pub')) {
        return true;
      }
    }
    return false;
  }

  private extractDocstring(node: any, lines: string[]): string | undefined {
    if (!this.options.includeDocstrings) return undefined;

    const startLine = node.startPosition.row;
    if (startLine > 0) {
      const prevLine = lines[startLine - 1];
      if (prevLine.trim().startsWith('/**') || prevLine.trim().startsWith('///')) {
        return prevLine.trim();
      }
    }
    return undefined;
  }

  private extractPythonDocstring(node: any, content: string): string | undefined {
    if (!this.options.includeDocstrings) return undefined;

    // Look for string literal as first statement in function/class body
    const body = node.childForFieldName('body');
    if (body && body.childCount > 0) {
      const firstChild = body.child(0);
      if (firstChild.type === 'expression_statement') {
        const expr = firstChild.child(0);
        if (expr && expr.type === 'string') {
          return this.getNodeText(expr, content);
        }
      }
    }
    return undefined;
  }

  private extractClassMembers(
    node: any,
    content: string
  ): Array<{ name: string; signature: string; type: 'property' | 'method' }> {
    const members: Array<{ name: string; signature: string; type: 'property' | 'method' }> = [];

    // Find class body
    const body = node.childForFieldName('body');
    if (!body) return members;

    this.walkAST(body, (child: any) => {
      if (child.type === 'method_definition') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          members.push({
            name: this.getNodeText(nameNode, content),
            signature: this.getMethodSignature(child, content),
            type: 'method',
          });
        }
      } else if (child.type === 'property_definition' || child.type === 'public_field_definition') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          members.push({
            name: this.getNodeText(nameNode, content),
            signature: this.getNodeText(child, content),
            type: 'property',
          });
        }
      }
    });

    return members;
  }

  private extractInterfaceMembers(
    node: any,
    content: string
  ): Array<{ name: string; signature: string; type: 'property' | 'method' }> {
    const members: Array<{ name: string; signature: string; type: 'property' | 'method' }> = [];

    // Find interface body
    const body = node.childForFieldName('body');
    if (!body) return members;

    this.walkAST(body, (child: any) => {
      if (child.type === 'method_signature') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          members.push({
            name: this.getNodeText(nameNode, content),
            signature: this.getNodeText(child, content),
            type: 'method',
          });
        }
      } else if (child.type === 'property_signature') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          members.push({
            name: this.getNodeText(nameNode, content),
            signature: this.getNodeText(child, content),
            type: 'property',
          });
        }
      }
    });

    return members;
  }

  private extractPythonClassMembers(
    node: any,
    content: string
  ): Array<{ name: string; signature: string; type: 'property' | 'method' }> {
    const members: Array<{ name: string; signature: string; type: 'property' | 'method' }> = [];

    // Find class body
    const body = node.childForFieldName('body');
    if (!body) return members;

    this.walkAST(body, (child: any) => {
      if (child.type === 'function_definition') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          members.push({
            name: this.getNodeText(nameNode, content),
            signature: this.getPythonFunctionSignature(child, content),
            type: 'method',
          });
        }
      }
    });

    return members;
  }

  // Signature extraction helpers
  private getClassSignature(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : '';

    // Extract class declaration up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getInterfaceSignature(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : '';

    // Extract interface declaration up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getEnumSignature(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : '';

    // Extract enum declaration up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getMethodSignature(node: any, content: string): string {
    // Extract method signature up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getPythonFunctionSignature(node: any, content: string): string {
    // Extract function signature up to colon
    const fullText = this.getNodeText(node, content);
    const colonIndex = fullText.indexOf(':');
    return colonIndex > -1 ? fullText.substring(0, colonIndex).trim() : fullText;
  }

  private getPythonClassSignature(node: any, content: string): string {
    // Extract class signature up to colon
    const fullText = this.getNodeText(node, content);
    const colonIndex = fullText.indexOf(':');
    return colonIndex > -1 ? fullText.substring(0, colonIndex).trim() : fullText;
  }

  private getGoFunctionSignature(node: any, content: string): string {
    // Extract Go function signature up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getRustFunctionSignature(node: any, content: string): string {
    // Extract Rust function signature up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getRustStructSignature(node: any, content: string): string {
    // Extract Rust struct signature up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private getRustEnumSignature(node: any, content: string): string {
    // Extract Rust enum signature up to opening brace
    const fullText = this.getNodeText(node, content);
    const braceIndex = fullText.indexOf('{');
    return braceIndex > -1 ? fullText.substring(0, braceIndex).trim() : fullText;
  }

  private filterByDepth(exports: TreeSitterExport[], depth: DistillDepth): TreeSitterExport[] {
    switch (depth) {
      case 'minimal':
        return exports.filter((e) => e.visibility === 'public');
      case 'public':
        return exports.filter((e) => e.visibility === 'public');
      case 'extended':
        return exports.filter(
          (e) =>
            e.visibility === 'public' ||
            (e.visibility === 'private' && this.isKeyPrivateMethod(e.name))
        );
      case 'full':
        return exports;
      default:
        return exports.filter((e) => e.visibility === 'public');
    }
  }

  private isKeyPrivateMethod(name: string): boolean {
    const keyPatterns = [/^_init/, /^_validate/, /^_process/, /^_handle/, /^_parse/, /^_transform/];

    return keyPatterns.some((pattern) => pattern.test(name));
  }

  isLanguageSupported(language: string): boolean {
    return this.isTreeSitterAvailable && this.languageMap.has(language);
  }

  getSupportedLanguages(): string[] {
    return this.isTreeSitterAvailable ? Array.from(this.languageMap.keys()) : [];
  }

  static getAutoDepth(fileSize: number, tokenBudget: number = 100000): DistillDepth {
    const estimatedTokens = fileSize / 4;

    if (estimatedTokens < tokenBudget * 0.1) {
      return 'extended';
    } else if (estimatedTokens < tokenBudget * 0.3) {
      return 'public';
    } else {
      return 'minimal';
    }
  }

  static detectLanguage(filePath: string): string | null {
    return BaseParser.detectLanguage(filePath);
  }
}
