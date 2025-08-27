import {
    ProcessResult,
    ProcessingOptions,
    ExportNode,
    ImportNode,
    SkippedItem,
} from "../types.js";

/**
 * Python processor
 * Uses line-based parsing optimized for Python's indentation-based syntax
 */
export class PythonProcessor {
    async initialize(): Promise<void> {}

    async process(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): Promise<ProcessResult> {
        // Use line-based parsing for Python
        return this.processLineBased(source, filePath, options);
    }

    private processLineBased(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): ProcessResult {
        const lines = source.split("\n");
        const exports: ExportNode[] = [];
        const imports: ImportNode[] = [];
        const skipped: SkippedItem[] = [];

        let currentClass: ExportNode | null = null;
        let currentIndent = 0;
        let inDocstring = false;
        let docstringBuffer: string[] = [];
        let docstringQuotes = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line?.trim() || "";
            const indent = this.getIndentLevel(line || "");

            // Skip docstrings inside methods/functions
            if (!inDocstring && this.isDocstringStart(trimmed)) {
                // Only handle docstrings at module level or directly inside class (not in methods)
                const isMethodDocstring = currentClass && indent > currentIndent;
                if (isMethodDocstring) {
                    // Skip method docstrings - find the end and continue
                    const quotes = trimmed.startsWith('"""') ? '"""' : "'''";
                    if (!(this.isDocstringEnd(trimmed, quotes) && trimmed.length > 6)) {
                        // Multi-line docstring in method - skip to end
                        for (let j = i + 1; j < lines.length; j++) {
                            if (this.isDocstringEnd(lines[j]?.trim() || "", quotes)) {
                                i = j;
                                break;
                            }
                        }
                    }
                    continue;
                }
                
                // Module or class-level docstring
                inDocstring = true;
                docstringQuotes = trimmed.startsWith('"""') ? '"""' : "'''";
                docstringBuffer = [trimmed];

                // Check if it's a single-line docstring
                if (
                    this.isDocstringEnd(trimmed, docstringQuotes) &&
                    trimmed.length > 6
                ) {
                    inDocstring = false;
                    docstringBuffer = [];
                }
                continue;
            }

            if (inDocstring) {
                docstringBuffer.push(line || "");
                if (this.isDocstringEnd(trimmed, docstringQuotes)) {
                    inDocstring = false;
                    const docstring = docstringBuffer.join("\n");

                    // Attach docstring to the last export if docstrings is enabled
                    // Module-level docstrings (when there are no exports yet) are just stored
                    if (options.docstrings && exports.length > 0) {
                        const lastExport = exports[exports.length - 1];
                        if (lastExport) {
                            lastExport.docstring = docstring;
                        }
                    }

                    docstringBuffer = [];
                }
                continue;
            }

            // Skip empty lines
            if (!trimmed) continue;

            // Skip comments unless requested
            if (trimmed.startsWith("#")) {
                if (!options.comments) continue;

                // Attach comment to next export if comments is enabled
                if (options.comments && i < lines.length - 1) {
                    // Store comment for next declaration
                    continue;
                }
            }

            // Process imports - always include for context
            if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
                imports.push(this.parseImport(trimmed, i + 1));
                continue;
            }

            // Process class definitions
            if (trimmed.startsWith("class ")) {
                // Save previous class if exists
                if (currentClass && indent === 0) {
                    currentClass = null;
                }

                const classNode = this.parseClass(
                    trimmed,
                    i + 1,
                    indent,
                    options,
                );
                if (this.shouldIncludeExport(classNode, options)) {
                    exports.push(classNode);
                    currentClass = classNode;
                    currentIndent = indent;
                } else {
                    skipped.push({
                        name: classNode.name,
                        reason: this.getSkipReason(classNode, options),
                        line: i + 1,
                    });
                    // Still track the class for its methods even if we skip it
                    currentClass = classNode;
                    currentIndent = indent;
                }
                continue;
            }

            // Process function definitions
            if (
                trimmed.startsWith("def ") ||
                trimmed.startsWith("async def ")
            ) {
                const func = this.parseFunction(
                    trimmed,
                    i + 1,
                    indent,
                    options,
                );

                // Check if it's a method inside a class
                if (currentClass && indent > currentIndent) {
                    if (this.shouldIncludeMember(func, options)) {
                        if (!currentClass.members) {
                            currentClass.members = [];
                        }

                        const isPrivate = func.name.startsWith("_");
                        const isSpecial =
                            func.name.startsWith("__") &&
                            func.name.endsWith("__");

                        currentClass.members.push({
                            name: func.name,
                            kind:
                                func.name === "__init__"
                                    ? "constructor"
                                    : "method",
                            signature: func.signature,
                            isPrivate: isPrivate && !isSpecial,
                        });
                    } else if (!this.shouldIncludeMember(func, options)) {
                        skipped.push({
                            name: func.name,
                            reason: this.getSkipReason(func, options),
                            line: i + 1,
                        });
                    }
                } else {
                    // Top-level function or function at same/lower indent
                    if (indent <= currentIndent) {
                        currentClass = null;
                    }

                    // Only export if we're at the top level (indent = 0)
                    if (indent === 0) {
                        if (this.shouldIncludeExport(func, options)) {
                            exports.push(func);
                        } else {
                            skipped.push({
                                name: func.name,
                                reason: this.getSkipReason(func, options),
                                line: i + 1,
                            });
                        }
                    }
                }
                continue;
            }

            // Process variable assignments (constants)
            // Skip 'pass' statements
            if (
                trimmed !== "pass" &&
                this.isConstantDeclaration(trimmed) &&
                indent === 0
            ) {
                const constant = this.parseConstant(trimmed, i + 1, options);
                if (constant && this.shouldIncludeExport(constant, options)) {
                    exports.push(constant);
                } else if (constant) {
                    skipped.push({
                        name: constant.name,
                        reason: this.getSkipReason(constant, options),
                        line: i + 1,
                    });
                }
            }

            // Reset current class if we're back at top level
            if (
                indent === 0 &&
                currentClass &&
                !trimmed.startsWith(" ") &&
                !trimmed.startsWith("\t")
            ) {
                currentClass = null;
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

    private parseImport(line: string, lineNumber: number): ImportNode {
        let source = "";
        const specifiers: string[] = [];

        if (line.startsWith("import ")) {
            // import module
            const match = line.match(/import\s+(.+?)(?:\s+as\s+(.+))?$/);
            if (match) {
                source = match[1] || "";
                specifiers.push(match[2] || match[1] || "");
            }
        } else if (line.startsWith("from ")) {
            // from module import ...
            const match = line.match(/from\s+(.+?)\s+import\s+(.+)$/);
            if (match) {
                source = match[1] || "";
                const imports = match[2] || "";

                if (imports === "*") {
                    specifiers.push("*");
                } else {
                    // Parse individual imports
                    imports.split(",").forEach((imp) => {
                        const trimmed = imp.trim();
                        if (trimmed.includes(" as ")) {
                            const [name, alias] = trimmed
                                .split(" as ")
                                .map((s) => s.trim());
                            specifiers.push(alias || name || "");
                        } else {
                            specifiers.push(trimmed);
                        }
                    });
                }
            }
        }

        return {
            source,
            specifiers: specifiers.map((name) => ({ name })),
            line: lineNumber,
        };
    }

    private parseClass(
        line: string,
        lineNumber: number,
        indent: number,
        options: ProcessingOptions,
    ): ExportNode {
        const match = line.match(/class\s+(\w+)(?:\(([^)]*)\))?:/);
        const name = match ? match[1] : "Anonymous";
        const bases =
            match && match[2] ? match[2].split(",").map((b) => b.trim()) : [];

        const isPrivate = name?.startsWith("_") || false;

        let signature = `class ${name}`;
        if (bases.length > 0) {
            signature += `(${bases.join(", ")})`;
        }

        return {
            name: name || "",
            kind: "class",
            signature,
            visibility: isPrivate ? "private" : "public",
            line: lineNumber,
            depth: Math.floor(indent / 4), // Assuming 4-space indentation
            members: [],
        };
    }

    private parseFunction(
        line: string,
        lineNumber: number,
        indent: number,
        options: ProcessingOptions,
    ): ExportNode {
        const isAsync = line.trim().startsWith("async ");
        const funcPattern = isAsync
            ? /async\s+def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?:/
            : /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?:/;

        const match = line.match(funcPattern);
        const name = match ? match[1] : "Anonymous";
        const params = match && match[2] ? match[2] : "";
        const returnType = match && match[3] ? match[3].trim() : "";

        const isPrivate = name?.startsWith("_") || false;

        let signature = `${isAsync ? "async " : ""}def ${name}`;

        signature += `(${this.cleanParameters(params)})`;
        if (returnType) {
            signature += ` -> ${returnType}`;
        }

        return {
            name: name || "",
            kind: "function",
            signature,
            visibility: isPrivate ? "private" : "public",
            line: lineNumber,
            depth: Math.floor(indent / 4),
        };
    }

    private parseConstant(
        line: string,
        lineNumber: number,
        options: ProcessingOptions,
    ): ExportNode | null {
        // Match CONSTANT_NAME = value or regular assignment
        const match = line.match(
            /^([A-Z_][A-Z0-9_]*|[a-z_][a-z0-9_]*)\s*(?::\s*[^=]+)?\s*=\s*(.+)$/,
        );
        if (!match) return null;

        const name = match[1] || "";

        // Only consider uppercase as constants unless it's a type alias
        const isConstant = /^[A-Z_][A-Z0-9_]*$/.test(name);
        const isTypeAlias = line?.includes(":") || false;

        if (!isConstant && !isTypeAlias) return null;

        const isPrivate = name.startsWith("_");

        let signature = line.trim();

        return {
            name,
            kind: "const",
            signature,
            visibility: isPrivate ? "private" : "public",
            line: lineNumber,
            depth: 0,
        };
    }

    private cleanParameters(params: string): string {
        // Remove 'self' parameter for methods
        return params
            .split(",")
            .filter((p) => !p.trim().startsWith("self"))
            .map((p) => p.trim())
            .join(", ");
    }

    private getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === " ") indent++;
            else if (char === "\t")
                indent += 4; // Count tab as 4 spaces
            else break;
        }
        return indent;
    }

    private isDocstringStart(line: string): boolean {
        return (
            line === '"""' ||
            line === "'''" ||
            line.startsWith('"""') ||
            line.startsWith("'''")
        );
    }

    private isDocstringEnd(line: string, quotes: string): boolean {
        return line.endsWith(quotes);
    }

    private isConstantDeclaration(line: string): boolean {
        // Check for uppercase constant or type alias pattern
        return (
            /^[A-Z_][A-Z0-9_]*\s*(?::\s*[^=]+)?\s*=/.test(line) ||
            /^[a-z_][a-z0-9_]*\s*:\s*[^=]+\s*=/.test(line)
        );
    }

    private shouldIncludeExport(
        node: ExportNode,
        options: ProcessingOptions,
    ): boolean {
        // Check visibility
        if (node.visibility === "private") {
            // Python convention: _ prefix means private (except __special__)
            const isSpecial =
                node.name.startsWith("__") && node.name.endsWith("__");

            // Include if private is enabled, or if it's a special method
            if (!options.private && !isSpecial) {
                return false;
            }
        }

        // Check visibility
        if (node.visibility === "private" && !options.private) {
            return false;
        }

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

    private shouldIncludeMember(
        node: ExportNode,
        options: ProcessingOptions,
    ): boolean {
        // For Python, check if it's a private method
        const isPrivate = node.name?.startsWith("_") || false;

        if (isPrivate && !options.private) {
            return false;
        }

        // Apply same filters as exports
        return this.shouldIncludeExport(node, options);
    }

    private getSkipReason(
        node: ExportNode,
        options: ProcessingOptions,
    ): "private" | "pattern" | "depth" | "comment" {
        if (node.visibility === "private" && !options.private) {
            return "private";
        }

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

        return "private"; // Default reason
    }

    private filterExports(
        exports: ExportNode[],
        options: ProcessingOptions,
    ): ExportNode[] {
        const filtered = exports;

        // Sort if not preserving order
        if (!options.preserveOrder) {
            filtered.sort((a, b) => {
                // Sort by kind, then name
                const kindOrder = ["class", "function", "const"];
                const aOrder = kindOrder.indexOf(a.kind) || 999;
                const bOrder = kindOrder.indexOf(b.kind) || 999;

                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }
                return a.name.localeCompare(b.name);
            });
        }

        return filtered;
    }

    private matchesPattern(name: string, pattern: string): boolean {
        // Convert glob pattern to regex
        // First escape regex special chars except * and ?
        let regexPattern = "";
        for (let i = 0; i < pattern.length; i++) {
            const char = pattern[i];
            if (char === "*") {
                regexPattern += ".*";
            } else if (char === "?") {
                regexPattern += ".";
            } else if (char && "^+${}()|[]\\".includes(char)) {
                regexPattern += "\\" + char;
            } else {
                regexPattern += char;
            }
        }

        try {
            return new RegExp(`^${regexPattern}$`).test(name);
        } catch {
            // If regex is invalid, fall back to simple string matching
            return name.includes(pattern.replace(/\*/g, ""));
        }
    }
}
