import { ProcessResult, ProcessingOptions, ExportNode, ImportNode, SkippedItem, ExportKind, MemberNode } from '../types';
import { TypeScriptASTProcessor } from './ast-processor';

interface WalkContext {
    source: string;
    options: ProcessingOptions;
    exports: ExportNode[];
    imports: ImportNode[];
    skipped: SkippedItem[];
    depth: number;
}

/**
 * TypeScript processor
 * Handles TypeScript and JavaScript parsing with TypeScript compiler API or line-based fallback
 */
export class TypeScriptProcessor {
    private parser: any;
    private treeSitterAvailable = false;
    private astProcessor: TypeScriptASTProcessor | null = null;
    
    async initialize(): Promise<void> {
        try {
            // Try to use TypeScript compiler API first
            this.astProcessor = new TypeScriptASTProcessor();
        } catch {
            // Try tree-sitter as fallback
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
    }
    
    async process(
        source: string,
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult> {
        // Try AST processor first (most reliable)
        if (this.astProcessor) {
            try {
                return this.astProcessor.process(source, filePath, options);
            } catch (error) {
                // Fall through to other methods
                if (process.env.DEBUG) {
                    console.warn('AST processing failed:', error);
                }
            }
        }
        
        // Try tree-sitter next
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
            case 'import_statement':
            case 'import_declaration':
                if (context.options.includeImports !== false) {
                    this.processImport(node, context);
                }
                break;
                
            case 'class_declaration':
                this.processClass(node, context);
                break;
                
            case 'function_declaration':
            case 'function':
                this.processFunction(node, context);
                break;
                
            case 'interface_declaration':
                this.processInterface(node, context);
                break;
                
            case 'type_alias_declaration':
                this.processTypeAlias(node, context);
                break;
                
            case 'enum_declaration':
                this.processEnum(node, context);
                break;
                
            case 'variable_declaration':
            case 'lexical_declaration':
                this.processVariable(node, context);
                break;
        }
        
        // Walk children
        for (const child of node.children || []) {
            this.walkNode(child, {
                ...context,
                depth: context.depth + 1
            });
        }
    }
    
    private processImport(node: any, context: WalkContext): void {
        const text = this.getNodeText(node, context.source);
        const match = text.match(/from\s+['"](.+?)['"]/);
        const source = match ? match[1] : '';
        
        const specifiers: string[] = [];
        // Simple extraction - could be improved
        const importMatch = text.match(/import\s+(.+?)\s+from/);
        if (importMatch) {
            specifiers.push(...importMatch[1].split(',').map(s => s.trim()));
        }
        
        context.imports.push({
            source,
            specifiers: specifiers.map(name => ({ name })),
            line: this.getLineNumber(node, context.source)
        });
    }
    
    private processClass(node: any, context: WalkContext): void {
        const visibility = this.getVisibility(node, context.source);
        
        // Check if should include based on options
        if (!this.shouldInclude(visibility, context.options)) {
            context.skipped.push({
                name: this.getNodeName(node) || 'unknown',
                reason: 'private',
                line: this.getLineNumber(node, context.source)
            });
            return;
        }
        
        const exportNode: ExportNode = {
            name: this.getNodeName(node) || 'Anonymous',
            kind: 'class',
            signature: this.getSignature(node, context),
            visibility,
            line: this.getLineNumber(node, context.source),
            depth: context.depth
        };
        
        // Add docstring if requested
        if (context.options.includeDocstrings) {
            exportNode.docstring = this.extractDocstring(node, context.source);
        }
        
        // Add comments if requested
        if (context.options.includeComments) {
            exportNode.comment = this.extractComment(node, context.source);
        }
        
        // Process members if not compact
        if (!context.options.compact) {
            exportNode.members = this.extractMembers(node, context);
        }
        
        // Check if exported
        exportNode.isExported = this.isExported(node, context.source);
        
        context.exports.push(exportNode);
    }
    
    private processFunction(node: any, context: WalkContext): void {
        const visibility = this.getVisibility(node, context.source);
        
        if (!this.shouldInclude(visibility, context.options)) {
            context.skipped.push({
                name: this.getNodeName(node) || 'unknown',
                reason: 'private',
                line: this.getLineNumber(node, context.source)
            });
            return;
        }
        
        const exportNode: ExportNode = {
            name: this.getNodeName(node) || 'Anonymous',
            kind: 'function',
            signature: this.getSignature(node, context),
            visibility,
            line: this.getLineNumber(node, context.source),
            depth: context.depth
        };
        
        if (context.options.includeDocstrings) {
            exportNode.docstring = this.extractDocstring(node, context.source);
        }
        
        if (context.options.includeComments) {
            exportNode.comment = this.extractComment(node, context.source);
        }
        
        exportNode.isExported = this.isExported(node, context.source);
        
        context.exports.push(exportNode);
    }
    
    private processInterface(node: any, context: WalkContext): void {
        const visibility = this.getVisibility(node, context.source);
        
        if (!this.shouldInclude(visibility, context.options)) {
            context.skipped.push({
                name: this.getNodeName(node) || 'unknown',
                reason: 'private',
                line: this.getLineNumber(node, context.source)
            });
            return;
        }
        
        const exportNode: ExportNode = {
            name: this.getNodeName(node) || 'Anonymous',
            kind: 'interface',
            signature: this.getSignature(node, context),
            visibility,
            line: this.getLineNumber(node, context.source),
            depth: context.depth
        };
        
        if (context.options.includeDocstrings) {
            exportNode.docstring = this.extractDocstring(node, context.source);
        }
        
        if (!context.options.compact) {
            exportNode.members = this.extractInterfaceMembers(node, context);
        }
        
        exportNode.isExported = this.isExported(node, context.source);
        
        context.exports.push(exportNode);
    }
    
    private processTypeAlias(node: any, context: WalkContext): void {
        const visibility = this.getVisibility(node, context.source);
        
        if (!this.shouldInclude(visibility, context.options)) {
            context.skipped.push({
                name: this.getNodeName(node) || 'unknown',
                reason: 'private',
                line: this.getLineNumber(node, context.source)
            });
            return;
        }
        
        context.exports.push({
            name: this.getNodeName(node) || 'Anonymous',
            kind: 'type',
            signature: this.getSignature(node, context),
            visibility,
            line: this.getLineNumber(node, context.source),
            depth: context.depth,
            isExported: this.isExported(node, context.source)
        });
    }
    
    private processEnum(node: any, context: WalkContext): void {
        const visibility = this.getVisibility(node, context.source);
        
        if (!this.shouldInclude(visibility, context.options)) {
            context.skipped.push({
                name: this.getNodeName(node) || 'unknown',
                reason: 'private',
                line: this.getLineNumber(node, context.source)
            });
            return;
        }
        
        context.exports.push({
            name: this.getNodeName(node) || 'Anonymous',
            kind: 'enum',
            signature: this.getSignature(node, context),
            visibility,
            line: this.getLineNumber(node, context.source),
            depth: context.depth,
            isExported: this.isExported(node, context.source)
        });
    }
    
    private processVariable(node: any, context: WalkContext): void {
        // Get all variable declarators
        const declarators = node.children?.filter((c: any) => c.type === 'variable_declarator') || [];
        
        for (const declarator of declarators) {
            const name = this.getNodeName(declarator);
            if (!name) continue;
            
            const visibility = this.getVisibility(node, context.source);
            
            if (!this.shouldInclude(visibility, context.options)) {
                context.skipped.push({
                    name,
                    reason: 'private',
                    line: this.getLineNumber(declarator, context.source)
                });
                continue;
            }
            
            const kind = this.getVariableKind(node);
            
            context.exports.push({
                name,
                kind: kind as ExportKind,
                signature: this.getVariableSignature(declarator, context),
                visibility,
                line: this.getLineNumber(declarator, context.source),
                depth: context.depth,
                isExported: this.isExported(node, context.source)
            });
        }
    }
    
    private extractMembers(node: any, context: WalkContext): MemberNode[] {
        const members: MemberNode[] = [];
        const body = node.children?.find((c: any) => c.type === 'class_body');
        
        if (!body) return members;
        
        for (const child of body.children || []) {
            if (child.type === 'method_definition' || child.type === 'public_field_definition') {
                const memberName = this.getNodeName(child);
                if (!memberName) continue;
                
                const isPrivate = memberName.startsWith('_') || memberName.startsWith('#');
                const visibility = isPrivate ? 'private' : 'public';
                
                if (!this.shouldInclude(visibility, context.options)) {
                    context.skipped.push({
                        name: memberName,
                        reason: 'private',
                        line: this.getLineNumber(child, context.source)
                    });
                    continue;
                }
                
                members.push({
                    name: memberName,
                    kind: child.type === 'method_definition' ? 'method' : 'property',
                    signature: this.getMemberSignature(child, context),
                    isStatic: this.isStatic(child, context.source),
                    isPrivate
                });
            }
        }
        
        return members;
    }
    
    private extractInterfaceMembers(node: any, context: WalkContext): MemberNode[] {
        const members: MemberNode[] = [];
        const body = node.children?.find((c: any) => c.type === 'interface_body');
        
        if (!body) return members;
        
        for (const child of body.children || []) {
            if (child.type === 'property_signature' || child.type === 'method_signature') {
                const memberName = this.getNodeName(child);
                if (!memberName) continue;
                
                members.push({
                    name: memberName,
                    kind: child.type === 'method_signature' ? 'method' : 'property',
                    signature: this.getMemberSignature(child, context),
                    isOptional: this.isOptional(child, context.source)
                });
            }
        }
        
        return members;
    }
    
    private shouldInclude(visibility: 'public' | 'private' | 'protected', options: ProcessingOptions): boolean {
        if (options.depth === 'all') return true;
        if (options.depth === 'protected' && visibility !== 'private') return true;
        if (options.depth === 'public' && visibility === 'public') return true;
        if (!options.depth && visibility === 'public') return true;  // Default
        
        return options.includePrivate === true && visibility === 'private';
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
    
    private matchesPattern(name: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regex = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regex}$`).test(name);
    }
    
    // Line-based fallback parsing with state machine approach
    private processLineBased(
        source: string,
        filePath: string,
        options: ProcessingOptions
    ): ProcessResult {
        const lines = source.split('\n');
        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        const skipped: SkippedItem[] = [];
        
        // State tracking
        let insideClass = false;
        let insideInterface = false;
        let insideEnum = false;
        let currentBlock: {
            type: ExportKind;
            name: string;
            startLine: number;
            signature: string[];
            members?: MemberNode[];
        } | null = null;
        let braceDepth = 0;
        let parenDepth = 0;
        let currentSignature: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Track brace depth
            for (const char of line) {
                if (char === '{') braceDepth++;
                if (char === '}') braceDepth--;
                if (char === '(') parenDepth++;
                if (char === ')') parenDepth--;
            }
            
            // Skip empty lines and pure comments
            if (!trimmed || (trimmed.startsWith('//') && !trimmed.includes('export'))) {
                continue;
            }
            
            // Process imports
            if (options.includeImports !== false && (trimmed.startsWith('import ') || trimmed.startsWith('export * from'))) {
                const match = trimmed.match(/from\s+['"](.+?)['"]/);
                if (match) {
                    imports.push({
                        source: match[1],
                        specifiers: [],
                        line: i + 1
                    });
                }
                continue;
            }
            
            // Check if we're starting a new export
            if (trimmed.startsWith('export ')) {
                const exportData = this.parseExportStart(trimmed, i + 1);
                if (exportData) {
                    // If we have a complete single-line export
                    if (exportData.complete) {
                        const exportItem: ExportNode = {
                            name: exportData.name,
                            kind: exportData.kind,
                            signature: exportData.signature,
                            line: i + 1,
                            isExported: true
                        };
                        
                        if (this.shouldIncludeExport(exportItem, options)) {
                            exports.push(exportItem);
                        } else {
                            skipped.push({
                                name: exportItem.name,
                                reason: 'private',
                                line: i + 1
                            });
                        }
                    } else {
                        // Start tracking multi-line export
                        currentBlock = {
                            type: exportData.kind,
                            name: exportData.name,
                            startLine: i + 1,
                            signature: [exportData.signature],
                            members: exportData.kind === 'class' || exportData.kind === 'interface' ? [] : undefined
                        };
                        
                        if (exportData.kind === 'class') insideClass = true;
                        if (exportData.kind === 'interface') insideInterface = true;
                        if (exportData.kind === 'enum') insideEnum = true;
                    }
                }
                continue;
            }
            
            // If we're inside a block, only extract members for classes/interfaces
            if (currentBlock && braceDepth > 0) {
                // For classes and interfaces, try to extract members
                if ((insideClass || insideInterface) && currentBlock.members && !options.compact) {
                    const member = this.parseClassMember(trimmed, i + 1);
                    if (member) {
                        currentBlock.members.push(member);
                    }
                }
                // Don't add implementation lines to the signature
                // The signature should already be complete from parseExportStart
            } else if (currentBlock && parenDepth > 0) {
                // Continue multi-line function signature (before the opening brace)
                currentBlock.signature.push(line);
            } else if (currentBlock && !currentBlock.signature.includes('{') && trimmed.includes('{')) {
                // We've reached the opening brace, finalize the signature
                currentBlock.signature[currentBlock.signature.length - 1] += ' {';
            }
            
            // Check if we're closing a block
            if (currentBlock && braceDepth === 0 && parenDepth === 0) {
                // Finalize the signature - join only the signature parts, not the body
                let fullSignature = currentBlock.signature[0]; // Start with the initial signature
                
                // Remove any 'export' keywords that snuck in
                fullSignature = fullSignature.replace(/^export\s+/, '').trim();
                
                // Clean up the signature - remove everything after the opening brace
                const bodyStart = fullSignature.indexOf('{');
                if (bodyStart > -1) {
                    fullSignature = fullSignature.substring(0, bodyStart).trim();
                }
                
                // Clean up semicolons for variable declarations
                if (currentBlock.type === 'const' || currentBlock.type === 'let' || currentBlock.type === 'var') {
                    fullSignature = fullSignature.replace(/;$/, '').trim();
                }
                
                // Normalize whitespace
                fullSignature = fullSignature.replace(/\s+/g, ' ').trim();
                
                const exportItem: ExportNode = {
                    name: currentBlock.name,
                    kind: currentBlock.type,
                    signature: fullSignature,
                    line: currentBlock.startLine,
                    isExported: true
                };
                
                if (currentBlock.members && currentBlock.members.length > 0) {
                    exportItem.members = currentBlock.members;
                }
                
                if (this.shouldIncludeExport(exportItem, options)) {
                    exports.push(exportItem);
                } else {
                    skipped.push({
                        name: exportItem.name,
                        reason: 'private',
                        line: currentBlock.startLine
                    });
                }
                
                // Reset state
                currentBlock = null;
                insideClass = false;
                insideInterface = false;
                insideEnum = false;
            }
        }
        
        return {
            imports,
            exports: this.filterExports(exports, options),
            metadata: {
                skipped: skipped.length > 0 ? skipped : undefined
            }
        };
    }
    
    private parseExportStart(line: string, lineNumber: number): {
        name: string;
        kind: ExportKind;
        signature: string;
        complete: boolean;
    } | null {
        // Remove 'export' prefix to analyze the actual declaration
        const withoutExport = line.replace(/^export\s+/, '').trim();
        let kind: ExportKind = 'const';
        let name = '';
        // Store signature WITHOUT the 'export' keyword
        let signature = withoutExport;
        let complete = false;
        
        // Check for different export types
        if (withoutExport.startsWith('class ')) {
            kind = 'class';
            const match = withoutExport.match(/class\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('{') && line.includes('}');
        } else if (withoutExport.startsWith('interface ')) {
            kind = 'interface';
            const match = withoutExport.match(/interface\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('{') && line.includes('}');
        } else if (withoutExport.startsWith('function ') || withoutExport.startsWith('async function ')) {
            kind = 'function';
            const match = withoutExport.match(/function\s+(\w+)/);
            name = match ? match[1] : '';
            // Function is complete if it has balanced parens and either a semicolon or opening brace
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;
            complete = openParens === closeParens && (line.includes(';') || line.includes('{'));
            // For complete functions, extract just the signature part (no body)
            if (complete && line.includes('{')) {
                signature = withoutExport.substring(0, withoutExport.indexOf('{')).trim();
            }
        } else if (withoutExport.startsWith('type ')) {
            kind = 'type';
            const match = withoutExport.match(/type\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('=') && line.includes(';');
            // Clean up the signature - remove semicolon
            if (complete) {
                signature = withoutExport.replace(/;$/, '').trim();
            }
        } else if (withoutExport.startsWith('enum ')) {
            kind = 'enum';
            const match = withoutExport.match(/enum\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('{') && line.includes('}');
        } else if (withoutExport.startsWith('const ')) {
            kind = 'const';
            const match = withoutExport.match(/const\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('=') && (line.includes(';') || line.endsWith('}'));
            // Clean up the signature - remove semicolon
            if (complete) {
                signature = withoutExport.replace(/;$/, '').trim();
            }
        } else if (withoutExport.startsWith('let ')) {
            kind = 'let';
            const match = withoutExport.match(/let\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('=') && line.includes(';');
            // Clean up the signature - remove semicolon
            if (complete) {
                signature = withoutExport.replace(/;$/, '').trim();
            }
        } else if (withoutExport.startsWith('var ')) {
            kind = 'var';
            const match = withoutExport.match(/var\s+(\w+)/);
            name = match ? match[1] : '';
            complete = line.includes('=') && line.includes(';');
            // Clean up the signature - remove semicolon
            if (complete) {
                signature = withoutExport.replace(/;$/, '').trim();
            }
        } else {
            // Default export or other patterns
            return null;
        }
        
        if (!name) return null;
        
        return {
            name,
            kind,
            signature,
            complete
        };
    }
    
    private parseClassMember(line: string, lineNumber: number): MemberNode | null {
        const trimmed = line.trim();
        
        // Skip empty lines, comments, and braces
        if (!trimmed || trimmed === '{' || trimmed === '}' || trimmed.startsWith('//')) {
            return null;
        }
        
        let name = '';
        let signature = trimmed;
        let memberKind: 'method' | 'property' = 'property';
        
        // Check for constructor
        if (trimmed.includes('constructor(')) {
            name = 'constructor';
            memberKind = 'method';
            signature = trimmed.split('{')[0].trim();
        }
        // Check for method (has parentheses)
        else if (trimmed.match(/\w+\s*\(/)) {
            const match = trimmed.match(/(\w+)\s*\(/);
            if (match) {
                name = match[1];
                memberKind = 'method';
                signature = trimmed.split('{')[0].trim();
            }
        }
        // Check for property
        else if (trimmed.match(/\w+\s*[:\?]/)) {
            const match = trimmed.match(/(\w+)\s*[:\?]/);
            if (match) {
                name = match[1];
                memberKind = 'property';
                signature = trimmed.replace(/;$/, '').trim();
            }
        }
        
        if (!name) return null;
        
        return {
            name,
            kind: memberKind === 'property' ? 'property' : 'method',
            signature,
            line: lineNumber
        } as MemberNode;
    }
    
    private shouldIncludeExport(node: ExportNode, options: ProcessingOptions): boolean {
        // Check visibility
        if (node.visibility === 'private' && !options.includePrivate) {
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
    
    // Helper methods
    private getNodeText(node: any, source: string): string {
        return source.slice(node.startIndex, node.endIndex);
    }
    
    private getNodeName(node: any): string | null {
        // Look for identifier child
        for (const child of node.children || []) {
            if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'property_identifier') {
                return child.text;
            }
        }
        return null;
    }
    
    private getLineNumber(node: any, source: string): number {
        let line = 1;
        for (let i = 0; i < node.startIndex && i < source.length; i++) {
            if (source[i] === '\n') {
                line++;
            }
        }
        return line;
    }
    
    private getVisibility(node: any, source: string): 'public' | 'private' | 'protected' {
        const text = this.getNodeText(node, source);
        if (text.includes('private ')) return 'private';
        if (text.includes('protected ')) return 'protected';
        
        // Check for TypeScript/JavaScript conventions
        const name = this.getNodeName(node);
        if (name && (name.startsWith('_') || name.startsWith('#'))) {
            return 'private';
        }
        
        return 'public';
    }
    
    private isExported(node: any, source: string): boolean {
        // Check if node or parent has export keyword
        const text = this.getNodeText(node, source);
        return text.startsWith('export ');
    }
    
    private isStatic(node: any, source: string): boolean {
        const text = this.getNodeText(node, source);
        return text.includes('static ');
    }
    
    private isOptional(node: any, source: string): boolean {
        const text = this.getNodeText(node, source);
        return text.includes('?:') || text.includes('?: ');
    }
    
    private getSignature(node: any, context: WalkContext): string {
        const text = this.getNodeText(node, context.source);
        
        if (context.options.compact) {
            // Return just the declaration line
            const lines = text.split('\n');
            return lines[0].replace(/\s*{$/, '');
        }
        
        // Return full signature but stop at body
        const bodyStart = text.indexOf('{');
        if (bodyStart > -1) {
            return text.slice(0, bodyStart).trim();
        }
        
        return text.trim();
    }
    
    private getMemberSignature(node: any, context: WalkContext): string {
        const text = this.getNodeText(node, context.source);
        
        if (context.options.compact) {
            const lines = text.split('\n');
            return lines[0].replace(/\s*{$/, '').trim();
        }
        
        // For members, just return the signature line
        const bodyStart = text.indexOf('{');
        if (bodyStart > -1) {
            return text.slice(0, bodyStart).trim();
        }
        
        return text.split('\n')[0].trim();
    }
    
    private getVariableKind(node: any): string {
        if (node.type === 'lexical_declaration') {
            const firstChild = node.children?.[0];
            if (firstChild?.type === 'const') return 'const';
            if (firstChild?.type === 'let') return 'let';
        }
        return 'var';
    }
    
    private getVariableSignature(node: any, context: WalkContext): string {
        const text = this.getNodeText(node, context.source);
        
        if (context.options.compact) {
            // Just the variable name and type if present
            const match = text.match(/^(\w+)(\s*:\s*[^=]+)?/);
            return match ? match[0].trim() : text.split('=')[0].trim();
        }
        
        // Full declaration without initializer
        return text.split('=')[0].trim();
    }
    
    private extractDocstring(node: any, source: string): string | undefined {
        // Look for JSDoc comment before the node
        const startIndex = node.startIndex;
        const beforeText = source.slice(Math.max(0, startIndex - 500), startIndex);
        
        const jsdocMatch = beforeText.match(/\/\*\*[\s\S]*?\*\/\s*$/);
        if (jsdocMatch) {
            return jsdocMatch[0].trim();
        }
        
        return undefined;
    }
    
    private extractComment(node: any, source: string): string | undefined {
        // Look for any comment before the node
        const startIndex = node.startIndex;
        const beforeText = source.slice(Math.max(0, startIndex - 200), startIndex);
        
        const lines = beforeText.split('\n');
        const comments: string[] = [];
        
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('//')) {
                comments.unshift(line);
            } else if (line && !line.match(/^[\s]*$/)) {
                break;
            }
        }
        
        return comments.length > 0 ? comments.join('\n') : undefined;
    }
}