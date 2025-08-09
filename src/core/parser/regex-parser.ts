import {
    Parser as BaseParser,
    type ParsedFile,
    type ParserOptions,
} from "./parser";
import type { ExtractedAPI } from "../../types";

interface EnhancedExport {
    name: string;
    type: "function" | "class" | "interface" | "const" | "type" | "enum";
    signature: string;
    visibility: "public" | "private";
    location: {
        startLine: number;
        endLine: number;
    };
    members?: Array<{
        name: string;
        signature: string;
        type: "property" | "method";
    }>;
    docstring?: string;
}

interface EnhancedExtractedAPI {
    file: string;
    imports: string[];
    exports: EnhancedExport[];
}

/**
 * Regex-based parser that extracts code information using regular expressions
 * Used as fallback when Tree-sitter is not available for a language
 */
export class RegexParser extends BaseParser {
    declare protected options: ParserOptions;
    private initialized = false;

    constructor(
        options: ParserOptions = {
            includeComments: false,
            includeDocstrings: true,
        },
    ) {
        super(options);
        this.options = options;
    }

    async initialize(): Promise<void> {
        this.initialized = true;
    }

    async parse(content: string, language: string): Promise<ParsedFile> {
        if (!this.initialized) {
            await this.initialize();
        }

        return {
            path: "",
            language,
            ast: null,
            content,
        };
    }

    extract(parsedFile: ParsedFile): ExtractedAPI {
        const { content, path, language } = parsedFile;
        const enhanced = this.extractEnhanced(content, language);

        // Convert enhanced format to standard ExtractedAPI format
        const exports = enhanced.exports.map((exp) => ({
            name: exp.name,
            type: exp.type,
            signature: exp.signature,
            visibility: exp.visibility,
            location: exp.location,
            docstring: exp.docstring,
            members: exp.members,
        }));

        return {
            file: path,
            imports: enhanced.imports,
            exports: exports,
        };
    }

    extractEnhanced(content: string, language: string): EnhancedExtractedAPI {
        const imports = this.extractImports(content, language);
        let exports: EnhancedExport[] = [];

        if (language === "typescript" || language === "javascript") {
            exports = this.extractTypeScriptExports(content);
        } else if (language === "python") {
            exports = this.extractPythonExports(content);
        }

        return { file: "", imports, exports };
    }

    private extractImports(content: string, language: string): string[] {
        const imports: string[] = [];

        if (language === "typescript" || language === "javascript") {
            // ES6 imports
            const importRegex =
                /^import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]+\})|(?:\w+))?\s*(?:,\s*(?:\{[^}]+\}|\w+))?\s+from\s+['"]([^'"]+)['"]/gm;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }

            // CommonJS requires
            const requireRegex =
                /(?:const|let|var)\s+(?:\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
            while ((match = requireRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }

            // Side-effect imports
            const sideEffectRegex = /^import\s+['"]([^'"]+)['"]/gm;
            while ((match = sideEffectRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
        } else if (language === "python") {
            // Python imports
            const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                if (match[1]) {
                    imports.push(match[1]);
                } else {
                    // Handle comma-separated imports
                    const modules = match[2]
                        .split(",")
                        .map((m) => m.trim().split(" as ")[0]);
                    imports.push(...modules);
                }
            }
        }

        // Remove duplicates and sort
        return [...new Set(imports)].sort();
    }

    private extractTypeScriptExports(content: string): EnhancedExport[] {
        const exports: EnhancedExport[] = [];
        const lines = content.split("\n");

        // Extract interfaces with members
        const interfaceRegex =
            /^(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{/gm;
        let match;
        while ((match = interfaceRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;
            const members = this.extractInterfaceMembers(
                content,
                match.index + match[0].length,
            );

            exports.push({
                name,
                type: "interface",
                signature: match[0].replace("{", "").trim(),
                visibility: match[0].includes("export") ? "public" : "private",
                location: {
                    startLine,
                    endLine: startLine + members.length + 1,
                },
                members,
            });
        }

        // Extract classes with members
        const classRegex =
            /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?\s*\{/gm;
        while ((match = classRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;
            const members = this.extractClassMembers(
                content,
                match.index + match[0].length,
            );

            exports.push({
                name,
                type: "class",
                signature: match[0].replace("{", "").trim(),
                visibility: match[0].includes("export") ? "public" : "private",
                location: {
                    startLine,
                    endLine: startLine + members.length + 1,
                },
                members,
            });
        }

        // Extract standalone functions
        const functionRegex =
            /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;

            exports.push({
                name,
                type: "function",
                signature: match[0].trim(),
                visibility: match[0].includes("export") ? "public" : "private",
                location: {
                    startLine,
                    endLine: startLine + 1,
                },
            });
        }

        // Extract arrow functions assigned to consts
        const arrowFunctionRegex =
            /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/gm;
        while ((match = arrowFunctionRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;

            exports.push({
                name,
                type: "function",
                signature: match[0].trim(),
                visibility: match[0].includes("export") ? "public" : "private",
                location: {
                    startLine,
                    endLine: startLine + 1,
                },
            });
        }

        // Extract type aliases
        const typeRegex =
            /^(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*[^;]+/gm;
        while ((match = typeRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;

            exports.push({
                name,
                type: "type",
                signature: match[0].trim(),
                visibility: match[0].includes("export") ? "public" : "private",
                location: {
                    startLine,
                    endLine: startLine + 1,
                },
            });
        }

        // Extract enums
        const enumRegex = /^(?:export\s+)?enum\s+(\w+)\s*\{/gm;
        while ((match = enumRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;

            exports.push({
                name,
                type: "enum",
                signature: match[0].replace("{", "").trim(),
                visibility: match[0].includes("export") ? "public" : "private",
                location: {
                    startLine,
                    endLine: startLine + 1,
                },
            });
        }

        return exports;
    }

    private extractInterfaceMembers(
        content: string,
        startPos: number,
    ): Array<{ name: string; signature: string; type: "property" | "method" }> {
        const members: Array<{
            name: string;
            signature: string;
            type: "property" | "method";
        }> = [];
        let braceCount = 1;
        let currentPos = startPos;
        let memberStart = startPos;

        while (braceCount > 0 && currentPos < content.length) {
            const char = content[currentPos];

            if (char === "{") braceCount++;
            else if (char === "}") {
                braceCount--;
                if (braceCount === 0) break;
            } else if (char === ";" || char === "\n") {
                const memberText = content
                    .substring(memberStart, currentPos)
                    .trim();
                if (memberText && !memberText.startsWith("//")) {
                    const propertyMatch = memberText.match(
                        /^\s*(?:readonly\s+)?(\w+)(?:\?)?\s*:\s*(.+)$/,
                    );
                    const methodMatch = memberText.match(
                        /^\s*(\w+)\s*\([^)]*\)(?:\s*:\s*.+)?$/,
                    );

                    if (methodMatch) {
                        members.push({
                            name: methodMatch[1],
                            signature: memberText,
                            type: "method",
                        });
                    } else if (propertyMatch) {
                        members.push({
                            name: propertyMatch[1],
                            signature: memberText,
                            type: "property",
                        });
                    }
                }
                memberStart = currentPos + 1;
            }

            currentPos++;
        }

        return members;
    }

    private extractClassMembers(
        content: string,
        startPos: number,
    ): Array<{ name: string; signature: string; type: "property" | "method" }> {
        const members: Array<{
            name: string;
            signature: string;
            type: "property" | "method";
        }> = [];
        const braceCount = 1;
        const currentPos = startPos;

        const memberContent = this.extractBracedContent(content, startPos - 1);

        // Extract properties
        const propertyRegex =
            /^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:readonly\s+)?(\w+)(?:\?)?\s*(?::\s*[^;]+)?(?:\s*=\s*[^;]+)?;/gm;
        let match;
        while ((match = propertyRegex.exec(memberContent)) !== null) {
            members.push({
                name: match[1],
                signature: match[0].trim(),
                type: "property",
            });
        }

        // Extract methods
        const methodRegex =
            /^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?/gm;
        while ((match = methodRegex.exec(memberContent)) !== null) {
            if (match[1] !== "constructor") {
                members.push({
                    name: match[1],
                    signature: match[0].trim(),
                    type: "method",
                });
            }
        }

        // Extract constructor
        const constructorRegex = /^\s*constructor\s*\([^)]*\)/gm;
        while ((match = constructorRegex.exec(memberContent)) !== null) {
            members.push({
                name: "constructor",
                signature: match[0].trim(),
                type: "method",
            });
        }

        return members;
    }

    private extractBracedContent(content: string, startPos: number): string {
        let braceCount = 0;
        let start = startPos;
        let end = startPos;

        // Find opening brace
        while (start < content.length && content[start] !== "{") {
            start++;
        }

        if (start >= content.length) return "";

        braceCount = 1;
        end = start + 1;

        while (braceCount > 0 && end < content.length) {
            if (content[end] === "{") braceCount++;
            else if (content[end] === "}") braceCount--;
            end++;
        }

        return content.substring(start + 1, end - 1);
    }

    private extractPythonExports(content: string): EnhancedExport[] {
        const exports: EnhancedExport[] = [];

        // Extract classes with methods
        const classRegex = /^class\s+(\w+)(?:\s*\([^)]*\))?:/gm;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;
            const members = this.extractPythonClassMembers(
                content,
                match.index + match[0].length,
                startLine,
            );

            exports.push({
                name,
                type: "class",
                signature: match[0],
                visibility: name.startsWith("_") ? "private" : "public",
                location: {
                    startLine,
                    endLine: startLine + members.length + 1,
                },
                members,
            });
        }

        // Extract functions
        const functionRegex = /^def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            const name = match[1];
            const startLine = content
                .substring(0, match.index)
                .split("\n").length;

            // Skip if it's inside a class (check indentation)
            const lineStart = content.lastIndexOf("\n", match.index) + 1;
            const indentation = match.index - lineStart;
            if (indentation === 0) {
                exports.push({
                    name,
                    type: "function",
                    signature: match[0],
                    visibility: name.startsWith("_") ? "private" : "public",
                    location: {
                        startLine,
                        endLine: startLine + 1,
                    },
                });
            }
        }

        return exports;
    }

    private extractPythonClassMembers(
        content: string,
        startPos: number,
        classStartLine: number,
    ): Array<{ name: string; signature: string; type: "property" | "method" }> {
        const members: Array<{
            name: string;
            signature: string;
            type: "property" | "method";
        }> = [];
        const lines = content.split("\n");
        const classIndentMatch = lines[classStartLine - 1].match(/^(\s*)/);
        const classIndent = classIndentMatch ? classIndentMatch[1].length : 0;

        for (let i = classStartLine; i < lines.length; i++) {
            const line = lines[i];
            const lineIndentMatch = line.match(/^(\s*)/);
            const lineIndent = lineIndentMatch ? lineIndentMatch[1].length : 0;

            // Stop if we're back at class level or less
            if (line.trim() && lineIndent <= classIndent) {
                break;
            }

            // Look for methods
            const methodMatch = line.match(
                /^\s+def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/,
            );
            if (methodMatch) {
                members.push({
                    name: methodMatch[1],
                    signature: methodMatch[0].trim(),
                    type: "method",
                });
            }
        }

        return members;
    }

    private isKeyPrivateMethod(name: string): boolean {
        const keyPatterns = [
            /^_init/,
            /^_validate/,
            /^_process/,
            /^_handle/,
            /^_parse/,
            /^_transform/,
        ];

        return keyPatterns.some((pattern) => pattern.test(name));
    }

    isLanguageSupported(language: string): boolean {
        const supportedLanguages = ["typescript", "javascript", "python"];
        return supportedLanguages.includes(language);
    }

    getSupportedLanguages(): string[] {
        return ["typescript", "javascript", "python"];
    }

    static detectLanguage(filePath: string): string | null {
        return BaseParser.detectLanguage(filePath);
    }
}
