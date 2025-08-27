import { Project, SourceFile, Node, SyntaxKind } from "ts-morph";
import {
    ProcessingOptions,
    ProcessResult,
    ExportNode,
    ImportNode,
    MemberNode,
    SkippedItem,
} from "../types.js";

/**
 * TypeScript processor using ts-morph
 * Provides a cleaner, higher-level API than raw TypeScript compiler
 */
export class TsMorphProcessor {
    private project: Project;

    constructor() {
        this.project = new Project({
            useInMemoryFileSystem: true,
            compilerOptions: {
                target: 99, // Latest
                allowJs: true,
                checkJs: false,
                noEmit: true,
                skipLibCheck: true,
                skipDefaultLibCheck: true,
            },
        });
    }

    process(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): ProcessResult {
        // Create source file in memory
        const sourceFile = this.project.createSourceFile(filePath, source, {
            overwrite: true,
        });

        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        const skipped: SkippedItem[] = [];

        // Process imports - always include them for context
        {
            sourceFile.getImportDeclarations().forEach((importDecl) => {
                const moduleSpecifier = importDecl.getModuleSpecifierValue();
                const namedImports = importDecl.getNamedImports();
                const defaultImport = importDecl.getDefaultImport();
                const namespaceImport = importDecl.getNamespaceImport();

                const specifiers: { name: string }[] = [];

                if (defaultImport) {
                    specifiers.push({ name: defaultImport.getText() });
                }

                if (namespaceImport) {
                    specifiers.push({
                        name: `* as ${namespaceImport.getText()}`,
                    });
                }

                namedImports.forEach((named) => {
                    const alias = named.getAliasNode();
                    if (alias) {
                        specifiers.push({
                            name: `${named.getName()} as ${alias.getText()}`,
                        });
                    } else {
                        specifiers.push({ name: named.getName() });
                    }
                });

                imports.push({
                    source: moduleSpecifier,
                    specifiers,
                    line: importDecl.getStartLineNumber(),
                });
            });
        }

        // Process exported functions
        sourceFile.getFunctions().forEach((func) => {
            if (!func.isExported()) return;

            const node = this.extractFunction(func, sourceFile, options);
            if (this.shouldInclude(node, options)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, options),
                    line: node.line,
                });
            }
        });

        // Process exported classes
        sourceFile.getClasses().forEach((cls) => {
            if (!cls.isExported()) return;

            const node = this.extractClass(cls, sourceFile, options);
            if (this.shouldInclude(node, options)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, options),
                    line: node.line,
                });
            }
        });

        // Process exported interfaces
        sourceFile.getInterfaces().forEach((iface) => {
            if (!iface.isExported()) return;

            const node = this.extractInterface(iface, sourceFile, options);
            if (this.shouldInclude(node, options)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, options),
                    line: node.line,
                });
            }
        });

        // Process exported type aliases
        sourceFile.getTypeAliases().forEach((typeAlias) => {
            if (!typeAlias.isExported()) return;

            const node = this.extractTypeAlias(typeAlias, sourceFile, options);
            if (this.shouldInclude(node, options)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, options),
                    line: node.line,
                });
            }
        });

        // Process exported enums
        sourceFile.getEnums().forEach((enumDecl) => {
            if (!enumDecl.isExported()) return;

            const node = this.extractEnum(enumDecl, sourceFile, options);
            if (this.shouldInclude(node, options)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, options),
                    line: node.line,
                });
            }
        });

        // Process exported variables/constants
        sourceFile.getVariableDeclarations().forEach((varDecl) => {
            const statement = varDecl.getVariableStatement();
            if (!statement?.isExported()) return;

            const node = this.extractVariable(varDecl, sourceFile, options);
            if (this.shouldInclude(node, options)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, options),
                    line: node.line,
                });
            }
        });

        // Process re-exports (export { ... })
        sourceFile.getExportDeclarations().forEach((exportDecl) => {
            exportDecl.getNamedExports().forEach((namedExport) => {
                const name = namedExport.getName();
                const alias = namedExport.getAliasNode();
                const exportName = alias ? alias.getText() : name;

                exports.push({
                    name: exportName,
                    kind: "const",
                    signature: `export { ${name}${alias ? ` as ${alias.getText()}` : ""} }`,
                    line: namedExport.getStartLineNumber(),
                    isExported: true,
                });
            });
        });

        // Process default export
        const defaultExport = sourceFile.getDefaultExportSymbol();
        if (defaultExport) {
            const declarations = defaultExport.getDeclarations();
            if (declarations.length > 0) {
                const decl = declarations[0];
                exports.push({
                    name: "default",
                    kind: "const",
                    signature: "export default",
                    line: decl?.getStartLineNumber(),
                    isExported: true,
                });
            }
        }

        return {
            imports,
            exports: this.filterExports(exports, options),
            metadata: {
                skipped: skipped.length > 0 ? skipped : undefined,
            },
        };
    }

    private extractFunction(
        func: any,
        sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = func.getName() || "anonymous";
        const isAsync = func.isAsync();
        const isGenerator = func.isGenerator();

        let signature = "";
        if (isAsync) signature += "async ";
        if (isGenerator) signature += "function* ";
        else if (!isAsync) signature += "function ";

        signature += name;

        const params = func
            .getParameters()
            .map((p: any) => {
                const paramName = p.getName();
                const type = p.getType().getText();
                const isOptional = p.isOptional();
                return `${paramName}${isOptional ? "?" : ""}: ${type}`;
            })
            .join(", ");

        const returnType = func.getReturnType().getText();
        signature += `(${params}): ${returnType}`;

        const docstring = options.docstrings
            ? this.extractDocstring(func)
            : undefined;

        return {
            name,
            kind: "function",
            signature,
            line: func.getStartLineNumber(),
            isExported: true,
            docstring,
        };
    }

    private extractClass(
        cls: any,
        sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = cls.getName() || "anonymous";
        const isAbstract = cls.isAbstract();

        let signature = "";
        if (isAbstract) signature += "abstract ";
        signature += `class ${name}`;

        const baseClass = cls.getExtends();
        const _implements = cls.getImplements();

        if (baseClass) {
            signature += ` extends ${baseClass.getText()}`;
        }
        if (_implements.length > 0) {
            signature += ` implements ${_implements.map((i: any) => i.getText()).join(", ")}`;
        }

        const members = this.extractClassMembers(cls, options);
        const docstring = options.docstrings
            ? this.extractDocstring(cls)
            : undefined;

        return {
            name,
            kind: "class",
            signature,
            line: cls.getStartLineNumber(),
            isExported: true,
            members,
            docstring,
        };
    }

    private extractInterface(
        iface: any,
        sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = iface.getName();

        let signature = `interface ${name}`;

        const baseInterfaces = iface.getExtends();
        if (baseInterfaces.length > 0) {
            signature += ` extends ${baseInterfaces.map((b: any) => b.getText()).join(", ")}`;
        }

        const members = this.extractInterfaceMembers(iface, options);
        const docstring = options.docstrings
            ? this.extractDocstring(iface)
            : undefined;

        return {
            name,
            kind: "interface",
            signature,
            line: iface.getStartLineNumber(),
            isExported: true,
            members,
            docstring,
        };
    }

    private extractTypeAlias(
        typeAlias: any,
        sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = typeAlias.getName();

        let signature = `type ${name}`;

        const typeParams = typeAlias.getTypeParameters();
        if (typeParams.length > 0) {
            signature += `<${typeParams.map((t: any) => t.getName()).join(", ")}>`;
        }
        signature += ` = ${typeAlias.getType().getText()}`;

        const docstring = options.docstrings
            ? this.extractDocstring(typeAlias)
            : undefined;

        return {
            name,
            kind: "type",
            signature,
            line: typeAlias.getStartLineNumber(),
            isExported: true,
            docstring,
        };
    }

    private extractEnum(
        enumDecl: any,
        sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = enumDecl.getName();
        const isConst = enumDecl.isConstEnum();

        let signature = "";
        if (isConst) signature += "const ";
        signature += `enum ${name}`;

        const docstring = options.docstrings
            ? this.extractDocstring(enumDecl)
            : undefined;

        return {
            name,
            kind: "enum",
            signature,
            line: enumDecl.getStartLineNumber(),
            isExported: true,
            docstring,
        };
    }

    private extractVariable(
        varDecl: any,
        sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = varDecl.getName();
        const statement = varDecl.getVariableStatement();
        const isConst = statement?.getDeclarationKind() === "const";

        let signature = isConst ? "const " : "let ";
        signature += name;

        const type = varDecl.getType().getText();
        signature += `: ${type}`;

        const initializer = varDecl.getInitializer();
        if (initializer) {
            signature += ` = ${initializer.getText()}`;
        }

        return {
            name,
            kind: "const",
            signature,
            line: varDecl.getStartLineNumber(),
            isExported: true,
        };
    }

    private extractClassMembers(
        cls: any,
        options: ProcessingOptions,
    ): MemberNode[] {
        const members: MemberNode[] = [];

        // Extract properties
        cls.getProperties().forEach((prop: any) => {
            // Check visibility modifiers
            const isPrivate = prop.hasModifier(SyntaxKind.PrivateKeyword);
            const isProtected = prop.hasModifier(SyntaxKind.ProtectedKeyword);
            const isPublic = !isPrivate && !isProtected;
            
            if (isPrivate && !options.private) return;
            if (isProtected && !options.protected) return;
            if (isPublic && options.public === false) return;

            const name = prop.getName();
            const isStatic = prop.isStatic();
            const isReadonly = prop.isReadonly();

            let signature = "";
            if (isStatic) signature += "static ";
            if (isReadonly) signature += "readonly ";
            signature += name;

            const type = prop.getType().getText();
            signature += `: ${type}`;

            members.push({
                name,
                kind: "property",
                signature,
                isPrivate,
                isProtected,
            });
        });

        // Extract methods
        cls.getMethods().forEach((method: any) => {
            // Check visibility modifiers
            const isPrivate = method.hasModifier(SyntaxKind.PrivateKeyword);
            const isProtected = method.hasModifier(SyntaxKind.ProtectedKeyword);
            const isPublic = !isPrivate && !isProtected;
            
            if (isPrivate && !options.private) return;
            if (isProtected && !options.protected) return;
            if (isPublic && options.public === false) return;

            const name = method.getName();
            const isStatic = method.isStatic();
            const isAsync = method.isAsync();

            let signature = "";
            if (isStatic) signature += "static ";
            if (isAsync) signature += "async ";
            signature += name;

            const params = method
                .getParameters()
                .map((p: any) => {
                    const paramName = p.getName();
                    const type = p.getType().getText();
                    const isOptional = p.isOptional();
                    return `${paramName}${isOptional ? "?" : ""}: ${type}`;
                })
                .join(", ");

            const returnType = method.getReturnType().getText();
            signature += `(${params}): ${returnType}`;

            members.push({
                name,
                kind: name === "constructor" ? "constructor" : "method",
                signature,
                isPrivate,
                isProtected,
            });
        });

        // Extract getters and setters
        cls.getGetAccessors().forEach((getter: any) => {
            // Check visibility modifiers
            const isPrivate = getter.hasModifier(SyntaxKind.PrivateKeyword);
            const isProtected = getter.hasModifier(SyntaxKind.ProtectedKeyword);
            const isPublic = !isPrivate && !isProtected;
            
            if (isPrivate && !options.private) return;
            if (isProtected && !options.protected) return;
            if (isPublic && options.public === false) return;

            const name = getter.getName();
            let signature = `get ${name}`;

            const returnType = getter.getReturnType().getText();
            signature += `(): ${returnType}`;

            members.push({
                name,
                kind: "getter",
                signature,
                isPrivate,
                isProtected,
            });
        });

        cls.getSetAccessors().forEach((setter: any) => {
            // Check visibility modifiers
            const isPrivate = setter.hasModifier(SyntaxKind.PrivateKeyword);
            const isProtected = setter.hasModifier(SyntaxKind.ProtectedKeyword);
            const isPublic = !isPrivate && !isProtected;
            
            if (isPrivate && !options.private) return;
            if (isProtected && !options.protected) return;
            if (isPublic && options.public === false) return;

            const name = setter.getName();
            let signature = `set ${name}`;

            const params = setter
                .getParameters()
                .map((p: any) => {
                    const paramName = p.getName();
                    const type = p.getType().getText();
                    return `${paramName}: ${type}`;
                })
                .join(", ");
            signature += `(${params})`;

            members.push({
                name,
                kind: "setter",
                signature,
                isPrivate,
                isProtected,
            });
        });

        return members;
    }

    private extractInterfaceMembers(
        iface: any,
        options: ProcessingOptions,
    ): MemberNode[] {
        const members: MemberNode[] = [];

        // Extract properties
        iface.getProperties().forEach((prop: any) => {
            const name = prop.getName();
            const isOptional = prop.isOptional();

            let signature = name;
            if (isOptional) signature += "?";

            const type = prop.getType().getText();
            signature += `: ${type}`;

            members.push({
                name,
                kind: "property",
                signature,
            });
        });

        // Extract methods
        iface.getMethods().forEach((method: any) => {
            const name = method.getName();

            let signature = name;

            const params = method
                .getParameters()
                .map((p: any) => {
                    const paramName = p.getName();
                    const type = p.getType().getText();
                    const isOptional = p.isOptional();
                    return `${paramName}${isOptional ? "?" : ""}: ${type}`;
                })
                .join(", ");

            const returnType = method.getReturnType().getText();
            signature += `(${params}): ${returnType}`;

            members.push({
                name,
                kind: "method",
                signature,
            });
        });

        return members;
    }

    private extractDocstring(node: any): string | undefined {
        const docs = node.getJsDocs();
        if (docs.length > 0) {
            return docs[0].getInnerText();
        }
        return undefined;
    }

    private shouldInclude(
        node: ExportNode,
        options: ProcessingOptions,
    ): boolean {
        // Check patterns
        if (options.exclude) {
            for (const pattern of options.exclude) {
                if (this.matchesPattern(node.name, pattern)) {
                    return false;
                }
            }
        }

        if (options.include && options.include.length > 0) {
            return options.include.some((pattern) =>
                this.matchesPattern(node.name, pattern),
            );
        }

        return true;
    }

    private getSkipReason(
        node: ExportNode,
        options: ProcessingOptions,
    ): "private" | "pattern" | "depth" | "comment" {
        if (options.exclude) {
            for (const pattern of options.exclude) {
                if (this.matchesPattern(node.name, pattern)) {
                    return "pattern";
                }
            }
        }

        if (options.include && options.include.length > 0) {
            const matches = options.include.some((pattern) =>
                this.matchesPattern(node.name, pattern),
            );
            if (!matches) return "pattern";
        }

        return "pattern";
    }

    private matchesPattern(name: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");

        try {
            return new RegExp(`^${regexPattern}$`).test(name);
        } catch {
            return name.includes(pattern.replace(/\*/g, ""));
        }
    }

    private filterExports(
        exports: ExportNode[],
        options: ProcessingOptions,
    ): ExportNode[] {
        if (options.preserveOrder) {
            return exports;
        }

        // Sort by kind, then name
        return exports.sort((a, b) => {
            const kindOrder = [
                "interface",
                "type",
                "class",
                "function",
                "const",
                "enum",
            ];
            const aOrder = kindOrder.indexOf(a.kind) ?? 999;
            const bOrder = kindOrder.indexOf(b.kind) ?? 999;

            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            return a.name.localeCompare(b.name);
        });
    }
}
