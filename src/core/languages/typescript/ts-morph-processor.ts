import {
    Project,
    SourceFile,
    SyntaxKind,
    FunctionDeclaration,
    ClassDeclaration,
    InterfaceDeclaration,
    TypeAliasDeclaration,
    EnumDeclaration,
    VariableDeclaration,
    ParameterDeclaration,
    PropertyDeclaration,
    MethodDeclaration,
    GetAccessorDeclaration,
    SetAccessorDeclaration,
    PropertySignature,
    MethodSignature,
    Node,
} from "ts-morph";
import {
    ProcessingOptions,
    ProcessResult,
    ExportNode,
    ImportNode,
    MemberNode,
    SkippedItem,
} from "../types.js";
import { matchesAnyPattern, matchesGlobPattern } from "../../../utils/patterns.js";

type LegacyProcessingOptions = ProcessingOptions & {
    depth?: "public" | "protected" | "all";
    includePrivate?: boolean;
    includeProtected?: boolean;
    includeImports?: boolean;
    includeDocstrings?: boolean;
    includeComments?: boolean;
    compact?: boolean;
};

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
        const normalizedOptions = this.normalizeOptions(options);

        // Create source file in memory
        const sourceFile = this.project.createSourceFile(filePath, source, {
            overwrite: true,
        });

        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        const skipped: SkippedItem[] = [];

        // Process imports unless explicitly disabled.
        if ((normalizedOptions as LegacyProcessingOptions).includeImports !== false) {
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

            const node = this.extractFunction(func, sourceFile, normalizedOptions);
            if (this.shouldInclude(node, normalizedOptions)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, normalizedOptions),
                    line: node.line,
                });
            }
        });

        // Process exported classes
        sourceFile.getClasses().forEach((cls) => {
            if (!cls.isExported()) return;

            const node = this.extractClass(cls, sourceFile, normalizedOptions);
            if (this.shouldInclude(node, normalizedOptions)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, normalizedOptions),
                    line: node.line,
                });
            }
        });

        // Process exported interfaces
        sourceFile.getInterfaces().forEach((iface) => {
            if (!iface.isExported()) return;

            const node = this.extractInterface(iface, sourceFile, normalizedOptions);
            if (this.shouldInclude(node, normalizedOptions)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, normalizedOptions),
                    line: node.line,
                });
            }
        });

        // Process exported type aliases
        sourceFile.getTypeAliases().forEach((typeAlias) => {
            if (!typeAlias.isExported()) return;

            const node = this.extractTypeAlias(typeAlias, sourceFile, normalizedOptions);
            if (this.shouldInclude(node, normalizedOptions)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, normalizedOptions),
                    line: node.line,
                });
            }
        });

        // Process exported enums
        sourceFile.getEnums().forEach((enumDecl) => {
            if (!enumDecl.isExported()) return;

            const node = this.extractEnum(enumDecl, sourceFile, normalizedOptions);
            if (this.shouldInclude(node, normalizedOptions)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, normalizedOptions),
                    line: node.line,
                });
            }
        });

        // Process exported variables/constants
        sourceFile.getVariableDeclarations().forEach((varDecl) => {
            const statement = varDecl.getVariableStatement();
            if (!statement?.isExported()) return;

            const node = this.extractVariable(varDecl, sourceFile, normalizedOptions);
            if (this.shouldInclude(node, normalizedOptions)) {
                exports.push(node);
            } else {
                skipped.push({
                    name: node.name,
                    reason: this.getSkipReason(node, normalizedOptions),
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
            exports: this.filterExports(exports, normalizedOptions),
            metadata: {
                skipped: skipped.length > 0 ? skipped : undefined,
            },
        };
    }

    private normalizeOptions(options: ProcessingOptions): LegacyProcessingOptions {
        const normalized: LegacyProcessingOptions = {
            ...options,
        };

        // Backward-compatibility aliases used by existing tests/callers.
        if (normalized.includePrivate !== undefined) {
            normalized.private = normalized.private ?? normalized.includePrivate;
        }
        if (normalized.includeProtected !== undefined) {
            normalized.protected = normalized.protected ?? normalized.includeProtected;
        }
        if (normalized.includeDocstrings !== undefined) {
            normalized.docstrings =
                normalized.docstrings ?? normalized.includeDocstrings;
        }
        if (normalized.includeComments !== undefined) {
            normalized.comments = normalized.comments ?? normalized.includeComments;
        }

        // Legacy depth semantics.
        if (normalized.depth === "public") {
            normalized.public = true;
            normalized.protected = false;
            normalized.private = false;
        } else if (normalized.depth === "protected") {
            normalized.public = true;
            normalized.protected = true;
            normalized.private = false;
        } else if (normalized.depth === "all") {
            normalized.public = true;
            normalized.protected = true;
            normalized.private = true;
        }

        return normalized;
    }

    private extractFunction(
        func: FunctionDeclaration,
        _sourceFile: SourceFile,
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
                .map((p: ParameterDeclaration) => {
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
        cls: ClassDeclaration,
        _sourceFile: SourceFile,
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
            signature += ` implements ${_implements.map((i) => i.getText()).join(", ")}`;
        }

        const members = (options as LegacyProcessingOptions).compact
            ? undefined
            : this.extractClassMembers(cls, options);
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
        iface: InterfaceDeclaration,
        _sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = iface.getName();

        let signature = `interface ${name}`;

        const baseInterfaces = iface.getExtends();
        if (baseInterfaces.length > 0) {
            signature += ` extends ${baseInterfaces.map((b) => b.getText()).join(", ")}`;
        }

        const members = (options as LegacyProcessingOptions).compact
            ? undefined
            : this.extractInterfaceMembers(iface, options);
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
        typeAlias: TypeAliasDeclaration,
        _sourceFile: SourceFile,
        options: ProcessingOptions,
    ): ExportNode {
        const name = typeAlias.getName();

        let signature = `type ${name}`;

        const typeParams = typeAlias.getTypeParameters();
        if (typeParams.length > 0) {
            signature += `<${typeParams.map((t) => t.getName()).join(", ")}>`;
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
        enumDecl: EnumDeclaration,
        _sourceFile: SourceFile,
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
        varDecl: VariableDeclaration,
        _sourceFile: SourceFile,
        _options: ProcessingOptions,
    ): ExportNode {
        const name = varDecl.getName();
        const statement = varDecl.getVariableStatement();
        const declarationKind = statement?.getDeclarationKind() ?? "let";
        const kind: ExportNode["kind"] =
            declarationKind === "const"
                ? "const"
                : declarationKind === "var"
                  ? "var"
                  : "let";

        let signature = `${declarationKind} `;
        signature += name;

        const type = varDecl.getType().getText();
        signature += `: ${type}`;

        const initializer = varDecl.getInitializer();
        if (initializer) {
            signature += ` = ${initializer.getText()}`;
        }

        return {
            name,
            kind,
            signature,
            line: varDecl.getStartLineNumber(),
            isExported: true,
        };
    }

    private extractClassMembers(
        cls: ClassDeclaration,
        options: ProcessingOptions,
    ): MemberNode[] {
        const members: MemberNode[] = [];

        // Extract properties
        cls.getProperties().forEach((prop: PropertyDeclaration) => {
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
        cls.getMethods().forEach((method: MethodDeclaration) => {
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
                .map((p: ParameterDeclaration) => {
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
        cls.getGetAccessors().forEach((getter: GetAccessorDeclaration) => {
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

        cls.getSetAccessors().forEach((setter: SetAccessorDeclaration) => {
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
                .map((p: ParameterDeclaration) => {
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
        iface: InterfaceDeclaration,
        _options: ProcessingOptions,
    ): MemberNode[] {
        const members: MemberNode[] = [];

        // Extract properties
        iface.getProperties().forEach((prop: PropertySignature) => {
            const name = prop.getName();
            const isOptional =
                typeof prop.hasQuestionToken === "function"
                    ? prop.hasQuestionToken()
                    : false;

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
        iface.getMethods().forEach((method: MethodSignature) => {
            const name = method.getName();

            let signature = name;

            const params = method
                .getParameters()
                .map((p: ParameterDeclaration) => {
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

    private extractDocstring(node: Node): string | undefined {
        if (!("getJsDocs" in node) || typeof node.getJsDocs !== "function") {
            return undefined;
        }
        const docs = node.getJsDocs();
        if (docs.length > 0) {
            return docs[0]?.getInnerText();
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
                if (matchesGlobPattern(node.name, pattern)) {
                    return false;
                }
            }
        }

        if (options.include && options.include.length > 0) {
            return matchesAnyPattern(node.name, options.include);
        }

        return true;
    }

    private getSkipReason(
        node: ExportNode,
        options: ProcessingOptions,
    ): "private" | "pattern" | "depth" | "comment" {
        if (options.exclude) {
            for (const pattern of options.exclude) {
                if (matchesGlobPattern(node.name, pattern)) {
                    return "pattern";
                }
            }
        }

        if (options.include && options.include.length > 0) {
            const matches = matchesAnyPattern(node.name, options.include);
            if (!matches) return "pattern";
        }

        return "pattern";
    }

    private filterExports(
        exports: ExportNode[],
        options: ProcessingOptions,
    ): ExportNode[] {
        if (options.preserveOrder) {
            return exports;
        }

        // Sort by kind, then name
        return [...exports].sort((a, b) => {
            const kindOrder = [
                "interface",
                "type",
                "class",
                "function",
                "const",
                "let",
                "var",
                "enum",
            ];
            const aOrder = kindOrder.indexOf(a.kind);
            const bOrder = kindOrder.indexOf(b.kind);
            const aRank = aOrder === -1 ? 999 : aOrder;
            const bRank = bOrder === -1 ? 999 : bOrder;

            if (aRank !== bRank) {
                return aRank - bRank;
            }
            return a.name.localeCompare(b.name);
        });
    }
}
