import {
    CanonicalAPI,
    CanonicalExport,
    CanonicalImport,
    CanonicalMember,
    EXTRACTABLE_NODES,
} from './canonical-types';

/**
 * Converter transforms AST nodes to canonical IR format
 * Inspired by Go implementation - simple, deterministic, no complex guessing
 */
export class Converter {
    private language: string;
    private source: string;
    private extractableNodes: Set<string>;

    constructor(language: string, source: string) {
        this.language = language;
        this.source = source;
        const nodes = EXTRACTABLE_NODES[language as keyof typeof EXTRACTABLE_NODES];
        this.extractableNodes = new Set(nodes ? [...nodes] : []);
    }

    /**
     * Convert tree-sitter AST to canonical API format
     */
    convertTree(tree: any): CanonicalAPI {
        if (!tree || !tree.rootNode) {
            return {
                file: '',
                imports: [],
                exports: [],
            };
        }

        const api: CanonicalAPI = {
            file: '',
            imports: [],
            exports: [],
        };

        // Walk the tree and extract nodes
        this.walkNode(tree.rootNode, api);

        // Deduplicate and sort
        api.exports = this.deduplicateExports(api.exports);
        api.imports = this.deduplicateImports(api.imports);

        return api;
    }

    /**
     * Walk AST node recursively
     */
    private walkNode(node: any, api: CanonicalAPI): void {
        if (!node) return;

        // Skip unnamed nodes (punctuation, keywords, etc.)
        if (!node.isNamed) {
            for (const child of node.children || []) {
                this.walkNode(child, api);
            }
            return;
        }

        // Process node based on language
        const processed = this.processNode(node);
        if (processed) {
            if ('source' in processed) {
                api.imports.push(processed as CanonicalImport);
            } else {
                api.exports.push(processed as CanonicalExport);
            }
        }

        // Continue walking children
        for (const child of node.children || []) {
            this.walkNode(child, api);
        }
    }

    /**
     * Process a single node based on language
     */
    private processNode(node: any): CanonicalExport | CanonicalImport | null {
        // Skip non-extractable nodes
        if (!this.extractableNodes.has(node.type)) {
            return null;
        }

        switch (this.language) {
            case 'typescript':
            case 'javascript':
                return this.processJSNode(node);
            case 'python':
                return this.processPythonNode(node);
            case 'go':
                return this.processGoNode(node);
            default:
                return null;
        }
    }

    /**
     * Process JavaScript/TypeScript nodes
     */
    private processJSNode(node: any): CanonicalExport | CanonicalImport | null {
        switch (node.type) {
            case 'class_declaration':
                return this.extractJSClass(node);
            case 'function_declaration':
                return this.extractJSFunction(node);
            case 'interface_declaration':
                return this.extractTSInterface(node);
            case 'type_alias_declaration':
                return this.extractTSType(node);
            case 'enum_declaration':
                return this.extractTSEnum(node);
            case 'lexical_declaration':
            case 'variable_declaration':
                return this.extractJSVariable(node);
            case 'import_statement':
                return this.extractJSImport(node);
            case 'export_statement':
                return this.extractJSExport(node);
            default:
                return null;
        }
    }

    /**
     * Process Python nodes
     */
    private processPythonNode(node: any): CanonicalExport | CanonicalImport | null {
        switch (node.type) {
            case 'class_definition':
                return this.extractPythonClass(node);
            case 'function_definition':
            case 'decorated_definition':
                return this.extractPythonFunction(node);
            case 'import_statement':
            case 'import_from_statement':
                return this.extractPythonImport(node);
            default:
                return null;
        }
    }

    /**
     * Process Go nodes
     */
    private processGoNode(node: any): CanonicalExport | CanonicalImport | null {
        switch (node.type) {
            case 'type_declaration':
            case 'type_spec':
                return this.extractGoType(node);
            case 'function_declaration':
            case 'method_declaration':
                return this.extractGoFunction(node);
            case 'const_declaration':
            case 'var_declaration':
                return this.extractGoVariable(node);
            case 'import_declaration':
                return this.extractGoImport(node);
            default:
                return null;
        }
    }

    // JavaScript/TypeScript extractors

    private extractJSClass(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'identifier')?.text || 'Anonymous';
        const members = this.extractClassMembers(node);
        
        return {
            name,
            type: 'class',
            signature: this.getNodeText(node).split('{')[0].trim(),
            members,
        };
    }

    private extractJSFunction(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'identifier')?.text || 'Anonymous';
        const signature = this.getFunctionSignature(node);
        
        return {
            name,
            type: 'function',
            signature,
        };
    }

    private extractTSInterface(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'type_identifier')?.text || 'Anonymous';
        const members = this.extractInterfaceMembers(node);
        
        return {
            name,
            type: 'interface',
            signature: `interface ${name}`,
            members,
        };
    }

    private extractTSType(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'type_identifier')?.text || 'Anonymous';
        
        return {
            name,
            type: 'type',
            signature: this.getNodeText(node).split('=')[0].trim() + ' = ...',
        };
    }

    private extractTSEnum(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'identifier')?.text || 'Anonymous';
        
        return {
            name,
            type: 'enum',
            signature: `enum ${name}`,
        };
    }

    private extractJSVariable(node: any): CanonicalExport | null {
        const declarator = this.findChildByType(node, 'variable_declarator');
        if (!declarator) return null;
        
        const name = this.findChildByType(declarator, 'identifier')?.text || 'Anonymous';
        const kind = node.children?.[0]?.text || 'const'; // const/let/var
        
        return {
            name,
            type: 'variable',
            signature: `${kind} ${name}`,
        };
    }

    private extractJSImport(node: any): CanonicalImport | null {
        const source = this.findChildByType(node, 'string')?.text?.slice(1, -1) || '';
        const specifiers: string[] = [];
        
        // Extract import specifiers
        const importClause = this.findChildByType(node, 'import_clause');
        if (importClause) {
            // Default import
            const defaultImport = this.findChildByType(importClause, 'identifier');
            if (defaultImport) {
                specifiers.push(defaultImport.text);
            }
            
            // Named imports
            const namedImports = this.findChildByType(importClause, 'named_imports');
            if (namedImports) {
                for (const child of namedImports.children || []) {
                    if (child.type === 'import_specifier') {
                        const name = this.findChildByType(child, 'identifier')?.text;
                        if (name) specifiers.push(name);
                    }
                }
            }
        }
        
        return {
            source,
            specifiers,
        };
    }

    private extractJSExport(node: any): CanonicalExport | null {
        // Handle export declarations
        const declaration = node.children?.find((c: any) => 
            c.type.includes('declaration') || c.type === 'expression_statement'
        );
        
        if (declaration) {
            const result = this.processNode(declaration);
            // Only return if it's an export (not an import)
            if (result && 'name' in result) {
                return result as CanonicalExport;
            }
        }
        
        return null;
    }

    // Python extractors

    private extractPythonClass(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'identifier')?.text || 'Anonymous';
        const members = this.extractPythonClassMembers(node);
        
        return {
            name,
            type: 'class',
            signature: `class ${name}`,
            members,
        };
    }

    private extractPythonFunction(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'identifier')?.text || 'Anonymous';
        const params = this.findChildByType(node, 'parameters')?.text || '()';
        
        return {
            name,
            type: 'function',
            signature: `def ${name}${params}`,
        };
    }

    private extractPythonImport(node: any): CanonicalImport | null {
        if (node.type === 'import_statement') {
            const moduleName = this.findChildByType(node, 'dotted_name')?.text || '';
            return {
                source: moduleName,
                specifiers: [moduleName],
            };
        } else {
            // import_from_statement
            const source = this.findChildByType(node, 'dotted_name')?.text || '';
            const specifiers: string[] = [];
            
            const importList = this.findChildByType(node, 'import_list');
            if (importList) {
                for (const child of importList.children || []) {
                    if (child.type === 'dotted_name' || child.type === 'identifier') {
                        specifiers.push(child.text);
                    }
                }
            }
            
            return {
                source,
                specifiers,
            };
        }
    }

    // Go extractors

    private extractGoType(node: any): CanonicalExport | null {
        const spec = this.findChildByType(node, 'type_spec') || node;
        const name = this.findChildByType(spec, 'type_identifier')?.text || 'Anonymous';
        
        return {
            name,
            type: 'type',
            signature: `type ${name}`,
        };
    }

    private extractGoFunction(node: any): CanonicalExport | null {
        const name = this.findChildByType(node, 'identifier')?.text || 'Anonymous';
        const params = this.findChildByType(node, 'parameter_list')?.text || '()';
        
        return {
            name,
            type: 'function',
            signature: `func ${name}${params}`,
        };
    }

    private extractGoVariable(node: any): CanonicalExport | null {
        const spec = this.findChildByType(node, 'var_spec') || 
                     this.findChildByType(node, 'const_spec');
        if (!spec) return null;
        
        const name = this.findChildByType(spec, 'identifier')?.text || 'Anonymous';
        const kind = node.type === 'const_declaration' ? 'const' : 'var';
        
        return {
            name,
            type: 'variable',
            signature: `${kind} ${name}`,
        };
    }

    private extractGoImport(node: any): CanonicalImport | null {
        const spec = this.findChildByType(node, 'import_spec');
        if (!spec) return null;
        
        const path = this.findChildByType(spec, 'interpreted_string_literal')?.text;
        if (!path) return null;
        
        const source = path.slice(1, -1); // Remove quotes
        return {
            source,
            specifiers: [],
        };
    }

    // Helper methods

    private extractClassMembers(node: any): CanonicalMember[] {
        const members: CanonicalMember[] = [];
        const body = this.findChildByType(node, 'class_body');
        
        if (body) {
            for (const child of body.children || []) {
                if (child.type === 'method_definition') {
                    const name = this.findChildByType(child, 'property_identifier')?.text || '';
                    if (name) {
                        members.push({
                            name,
                            type: 'method',
                            signature: this.getMethodSignature(child),
                        });
                    }
                } else if (child.type === 'public_field_definition' || child.type === 'field_definition') {
                    const name = this.findChildByType(child, 'property_identifier')?.text || '';
                    if (name) {
                        members.push({
                            name,
                            type: 'property',
                            signature: name,
                        });
                    }
                }
            }
        }
        
        return members;
    }

    private extractInterfaceMembers(node: any): CanonicalMember[] {
        const members: CanonicalMember[] = [];
        const body = this.findChildByType(node, 'interface_body');
        
        if (body) {
            for (const child of body.children || []) {
                if (child.type === 'property_signature') {
                    const name = this.findChildByType(child, 'property_identifier')?.text || '';
                    if (name) {
                        members.push({
                            name,
                            type: 'property',
                            signature: this.getNodeText(child).replace(/[;,]$/, '').trim(),
                        });
                    }
                } else if (child.type === 'method_signature') {
                    const name = this.findChildByType(child, 'property_identifier')?.text || '';
                    if (name) {
                        members.push({
                            name,
                            type: 'method',
                            signature: this.getNodeText(child).replace(/[;,]$/, '').trim(),
                        });
                    }
                }
            }
        }
        
        return members;
    }

    private extractPythonClassMembers(node: any): CanonicalMember[] {
        const members: CanonicalMember[] = [];
        const body = this.findChildByType(node, 'block');
        
        if (body) {
            for (const child of body.children || []) {
                if (child.type === 'function_definition') {
                    const name = this.findChildByType(child, 'identifier')?.text || '';
                    if (name) {
                        members.push({
                            name,
                            type: 'method',
                            signature: this.getFunctionSignature(child),
                        });
                    }
                }
            }
        }
        
        return members;
    }

    private getFunctionSignature(node: any): string {
        const text = this.getNodeText(node);
        // Get just the signature, not the body
        const match = text.match(/^[^{]+/);
        return match ? match[0].trim() : text;
    }

    private getMethodSignature(node: any): string {
        const name = this.findChildByType(node, 'property_identifier')?.text || '';
        const params = this.findChildByType(node, 'formal_parameters')?.text || '()';
        return `${name}${params}`;
    }

    private findChildByType(node: any, type: string): any {
        if (!node || !node.children) return null;
        
        for (const child of node.children) {
            if (child.type === type) {
                return child;
            }
        }
        
        return null;
    }

    private getNodeText(node: any): string {
        if (!node) return '';
        
        const startIndex = node.startIndex || 0;
        const endIndex = node.endIndex || this.source.length;
        
        return this.source.slice(startIndex, endIndex);
    }

    private deduplicateExports(exports: CanonicalExport[]): CanonicalExport[] {
        const seen = new Set<string>();
        const result: CanonicalExport[] = [];
        
        for (const exp of exports) {
            const key = `${exp.type}:${exp.name}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(exp);
            }
        }
        
        // Sort by type, then by name
        return result.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            return a.name.localeCompare(b.name);
        });
    }

    private deduplicateImports(imports: CanonicalImport[]): CanonicalImport[] {
        const seen = new Set<string>();
        const result: CanonicalImport[] = [];
        
        for (const imp of imports) {
            const key = imp.source;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(imp);
            }
        }
        
        // Sort by source
        return result.sort((a, b) => a.source.localeCompare(b.source));
    }
}