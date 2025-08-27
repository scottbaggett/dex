import * as ts from "typescript";
import {
    ProcessingOptions,
    ProcessResult,
    ExportNode,
    ImportNode,
    MemberNode,
    SkippedItem,
} from "../types.js";

/**
 * TypeScript AST processor using TypeScript compiler API
 * More reliable than tree-sitter for TypeScript parsing
 */
export class TypeScriptASTProcessor {
    process(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): ProcessResult {
        const sourceFile = ts.createSourceFile(
            filePath,
            source,
            ts.ScriptTarget.Latest,
            true,
        );

        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        const skipped: SkippedItem[] = [];

        const visit = (node: ts.Node) => {
            // Process imports
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    imports.push({
                        source: moduleSpecifier.text,
                        specifiers: [],
                        line:
                            sourceFile.getLineAndCharacterOfPosition(
                                node.getStart(),
                            ).line + 1,
                    });
                }
            }

            // Process exports
            if (
                ts.canHaveModifiers(node) &&
                ts
                    .getModifiers(node)
                    ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
            ) {
                const exportNode = this.extractExport(
                    node,
                    sourceFile,
                    options,
                );
                if (exportNode) {
                    if (this.shouldInclude(exportNode, options)) {
                        exports.push(exportNode);
                    } else {
                        skipped.push({
                            name: exportNode.name,
                            reason: "pattern",
                            line: exportNode.line,
                        });
                    }
                }
            }

            // Process export declarations (export { ... })
            if (
                ts.isExportDeclaration(node) &&
                node.exportClause &&
                ts.isNamedExports(node.exportClause)
            ) {
                node.exportClause.elements.forEach((element) => {
                    const name = element.name.text;
                    const line =
                        sourceFile.getLineAndCharacterOfPosition(
                            element.getStart(),
                        ).line + 1;
                    exports.push({
                        name,
                        kind: "const",
                        signature: `export { ${name} }`,
                        line,
                        isExported: true,
                    });
                });
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);

        return {
            imports,
            exports: this.filterExports(exports, options),
            metadata: {
                skipped: skipped.length > 0 ? skipped : undefined,
            },
        };
    }

    private extractExport(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        options: ProcessingOptions,
    ): ExportNode | null {
        const line =
            sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

        if (ts.isClassDeclaration(node) && node.name) {
            return {
                name: node.name.text,
                kind: "class",
                signature: this.getClassSignature(node, options),
                line,
                isExported: true,
                members: this.getClassMembers(node, sourceFile, options),
            };
        }

        if (ts.isInterfaceDeclaration(node)) {
            return {
                name: node.name.text,
                kind: "interface",
                signature: this.getInterfaceSignature(node, options),
                line,
                isExported: true,
                members: this.getInterfaceMembers(node, sourceFile, options),
            };
        }

        if (ts.isFunctionDeclaration(node) && node.name) {
            return {
                name: node.name.text,
                kind: "function",
                signature: this.getFunctionSignature(node),
                line,
                isExported: true,
            };
        }

        if (ts.isTypeAliasDeclaration(node)) {
            return {
                name: node.name.text,
                kind: "type",
                signature: this.getTypeAliasSignature(node),
                line,
                isExported: true,
            };
        }

        if (ts.isEnumDeclaration(node)) {
            return {
                name: node.name.text,
                kind: "enum",
                signature: this.getEnumSignature(node, options),
                line,
                isExported: true,
            };
        }

        if (ts.isVariableStatement(node)) {
            const declaration = node.declarationList.declarations[0];
            if (declaration && ts.isIdentifier(declaration.name)) {
                let kind: "const" | "let" | "var" = "var";
                if (node.declarationList.flags & ts.NodeFlags.Const) {
                    kind = "const";
                } else if (node.declarationList.flags & ts.NodeFlags.Let) {
                    kind = "let";
                }
                return {
                    name: declaration.name.text,
                    kind,
                    signature: this.getVariableSignature(node),
                    line,
                    isExported: true,
                };
            }
        }

        return null;
    }

    private getClassSignature(
        node: ts.ClassDeclaration,
        options: ProcessingOptions,
    ): string {
        let signature = `class ${node.name?.text || "Anonymous"}`;

        // Add type parameters
        if (node.typeParameters) {
            signature +=
                "<" +
                node.typeParameters.map((tp) => tp.getText()).join(", ") +
                ">";
        }

        // Add extends clause
        if (node.heritageClauses) {
            node.heritageClauses.forEach((clause) => {
                if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                    signature +=
                        " extends " +
                        clause.types.map((t) => t.getText()).join(", ");
                } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                    signature +=
                        " implements " +
                        clause.types.map((t) => t.getText()).join(", ");
                }
            });
        }

        return signature;
    }

    private getInterfaceSignature(
        node: ts.InterfaceDeclaration,
        options: ProcessingOptions,
    ): string {
        let signature = `interface ${node.name.text}`;

        // Add type parameters
        if (node.typeParameters) {
            signature +=
                "<" +
                node.typeParameters.map((tp) => tp.getText()).join(", ") +
                ">";
        }

        // Add extends clause
        if (node.heritageClauses) {
            node.heritageClauses.forEach((clause) => {
                if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                    signature +=
                        " extends " +
                        clause.types.map((t) => t.getText()).join(", ");
                }
            });
        }

        return signature;
    }

    private getFunctionSignature(node: ts.FunctionDeclaration): string {
        const name = node.name?.text || "anonymous";
        const params = node.parameters.map((p) => p.getText()).join(", ");
        const returnType = node.type ? `: ${node.type.getText()}` : "";
        const async = node.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
        )
            ? "async "
            : "";

        return `${async}function ${name}(${params})${returnType}`;
    }

    private getTypeAliasSignature(node: ts.TypeAliasDeclaration): string {
        return `type ${node.name.text} = ${node.type.getText()}`;
    }

    private getEnumSignature(
        node: ts.EnumDeclaration,
        options: ProcessingOptions,
    ): string {
        const members = node.members.map((m) => m.getText()).join(", ");
        return `enum ${node.name.text} { ${members} }`;
    }

    private getVariableSignature(node: ts.VariableStatement): string {
        const declaration = node.declarationList.declarations[0];
        let keyword = "var";
        if (node.declarationList.flags & ts.NodeFlags.Const) {
            keyword = "const";
        } else if (node.declarationList.flags & ts.NodeFlags.Let) {
            keyword = "let";
        }

        if (declaration && ts.isIdentifier(declaration.name)) {
            const name = declaration.name.text;
            const type = declaration.type
                ? `: ${declaration.type.getText()}`
                : "";
            const initializer = declaration.initializer
                ? ` = ${declaration.initializer.getText()}`
                : "";

            return `${keyword} ${name}${type}${initializer}`;
        }

        return node.getText();
    }

    private getClassMembers(
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile,
        options: ProcessingOptions,
    ): MemberNode[] {
        const members: MemberNode[] = [];

        node.members.forEach((member) => {
            if (
                ts.isMethodDeclaration(member) ||
                ts.isConstructorDeclaration(member)
            ) {
                const name = ts.isConstructorDeclaration(member)
                    ? "constructor"
                    : member.name && ts.isIdentifier(member.name)
                      ? member.name.text
                      : "";

                if (name && this.shouldIncludeMember(member, options)) {
                    const params = member.parameters
                        .map((p) => p.getText())
                        .join(", ");
                    const returnType =
                        ts.isMethodDeclaration(member) && member.type
                            ? `: ${member.type.getText()}`
                            : "";
                    const async = member.modifiers?.some(
                        (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
                    )
                        ? "async "
                        : "";

                    members.push({
                        name,
                        kind: "method",
                        signature: `${async}${name}(${params})${returnType}`,
                    });
                }
            } else if (ts.isPropertyDeclaration(member)) {
                const name =
                    member.name && ts.isIdentifier(member.name)
                        ? member.name.text
                        : "";

                if (name && this.shouldIncludeMember(member, options)) {
                    const type = member.type
                        ? `: ${member.type.getText()}`
                        : "";
                    const optional = member.questionToken ? "?" : "";

                    members.push({
                        name,
                        kind: "property",
                        signature: `${name}${optional}${type}`,
                    });
                }
            }
        });

        return members;
    }

    private getInterfaceMembers(
        node: ts.InterfaceDeclaration,
        sourceFile: ts.SourceFile,
        options: ProcessingOptions,
    ): MemberNode[] {
        const members: MemberNode[] = [];

        node.members.forEach((member) => {
            if (ts.isMethodSignature(member)) {
                const name =
                    member.name && ts.isIdentifier(member.name)
                        ? member.name.text
                        : "";
                if (name) {
                    const params =
                        member.parameters?.map((p) => p.getText()).join(", ") ||
                        "";
                    const returnType = member.type
                        ? `: ${member.type.getText()}`
                        : "";

                    members.push({
                        name,
                        kind: "method",
                        signature: `${name}(${params})${returnType}`,
                    });
                }
            } else if (ts.isPropertySignature(member)) {
                const name =
                    member.name && ts.isIdentifier(member.name)
                        ? member.name.text
                        : "";
                if (name) {
                    const type = member.type
                        ? `: ${member.type.getText()}`
                        : "";
                    const optional = member.questionToken ? "?" : "";

                    members.push({
                        name,
                        kind: "property",
                        signature: `${name}${optional}${type}`,
                    });
                }
            }
        });

        return members;
    }

    private shouldIncludeMember(
        member: ts.ClassElement,
        options: ProcessingOptions,
    ): boolean {
        const modifiers = ts.canHaveModifiers(member)
            ? ts.getModifiers(member)
            : undefined;
        const isPrivate = modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.PrivateKeyword,
        );
        const isProtected = modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ProtectedKeyword,
        );

        if (isPrivate && !options.private) {
            return false;
        }

        if (isProtected && !options.protected) {
            return false;
        }

        return true;
    }

    private shouldInclude(
        node: ExportNode,
        options: ProcessingOptions,
    ): boolean {
        // Apply pattern filters
        if (options.include && options.include.length > 0) {
            if (!this.matchesPatterns(node.name, options.include)) {
                return false;
            }
        }

        if (options.exclude && options.exclude.length > 0) {
            if (this.matchesPatterns(node.name, options.exclude)) {
                return false;
            }
        }

        return true;
    }

    private matchesPatterns(name: string, patterns: string[]): boolean {
        return patterns.some((pattern) => {
            // Convert glob pattern to regex
            const regex = new RegExp(
                "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
            );
            return regex.test(name);
        });
    }

    private filterExports(
        exports: ExportNode[],
        options: ProcessingOptions,
    ): ExportNode[] {
        return exports.filter((exp) => this.shouldInclude(exp, options));
    }
}
