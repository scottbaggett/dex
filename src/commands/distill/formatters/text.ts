import { DistillFormatter, DistillFormatterOptions } from "../../../types.js";
import {
    DistillationResult,
    CompressionResult,
    ExtractedAPI,
} from "../../../types.js";

/**
 * Text Formatter
 * Produces clean, structured output with proper code organization
 */
export class TextFormatter implements DistillFormatter {
    name = "Text Formatter";
    format = "txt";

    formatDistillation(
        result: DistillationResult,
        options: DistillFormatterOptions = {},
    ): string {
        if (!result || !result.apis || !Array.isArray(result.apis)) {
            return "# Distillation Result\n\nNo APIs were extracted from the codebase.";
        }

        let output = "";

        // Group files by directory
        const filesByDir = this.groupFilesByDirectory(result.apis);

        for (const [dir, files] of filesByDir.entries()) {
            for (const api of files) {
                output += this.formatFile(api, options) + "\n";
            }
        }

        return output.trim();
    }

    formatCompression(
        result: CompressionResult,
        options: DistillFormatterOptions = {},
    ): string {
        let output = "";

        for (const file of result.files) {
            output += `<file path="${file.path}"`;
            if (file.language) {
                output += ` language="${file.language}"`;
            }
            output += `>\n${file.content}\n</file>\n\n`;
        }

        return output.trim();
    }

    formatCombined(
        compression: CompressionResult,
        distillation: DistillationResult,
        options: DistillFormatterOptions = {},
    ): string {
        return `${this.formatCompression(compression, options)}\n\n---\n\n${this.formatDistillation(distillation, options)}`;
    }

    private groupFilesByDirectory(
        apis: ExtractedAPI[],
    ): Map<string, ExtractedAPI[]> {
        const grouped = new Map<string, ExtractedAPI[]>();

        for (const api of apis) {
            const parts = api.file.split("/");
            const dir = parts.slice(0, -1).join("/") || ".";

            if (!grouped.has(dir)) {
                grouped.set(dir, []);
            }
            grouped.get(dir)!.push(api);
        }

        // Sort directories and files
        const sorted = new Map<string, ExtractedAPI[]>();
        const dirs = Array.from(grouped.keys()).sort();

        for (const dir of dirs) {
            const files = grouped
                .get(dir)!
                .sort((a, b) => a.file.localeCompare(b.file));
            sorted.set(dir, files);
        }

        return sorted;
    }

    private formatFile(
        api: ExtractedAPI,
        options: DistillFormatterOptions,
    ): string {
        let output = `<file path="${this.cleanPath(api.file)}">\n`;

        // Add imports
        if (
            options.includeImports !== false &&
            api.imports &&
            api.imports.length > 0
        ) {
            for (const imp of api.imports) {
                output += `import '${imp}'\n`;
            }
        }

        // Group exports by type
        const exports = options.includePrivate
            ? api.exports
            : api.exports.filter((e) => e.visibility !== "private");

        if (options.groupByType !== false) {
            const grouped = this.groupExportsByType(exports);

            // Output in order: interfaces, classes, functions, types, constants, enums
            const order = [
                "interface",
                "class",
                "function",
                "type",
                "const",
                "enum",
            ];

            for (const type of order) {
                const items = grouped.get(type);
                if (!items || items.length === 0) continue;

                for (const exp of items) {
                    output += this.formatExport(exp, options);
                }
            }

            // Handle any items with undefined or unknown types
            for (const [type, items] of grouped.entries()) {
                if (!order.includes(type) && items && items.length > 0) {
                    for (const exp of items) {
                        output += this.formatExport(exp, options);
                    }
                }
            }
        } else {
            // Output in original order
            for (const exp of exports) {
                output += this.formatExport(exp, options);
            }
        }

        output += "</file>\n";
        return output;
    }

    private formatExport(exp: any, options: DistillFormatterOptions): string {
        let output = "";

        // Add docstring if available and requested
        if (options.includeDocstrings && exp.docstring) {
            output += `/**\n${exp.docstring
                .split("\n")
                .map((l: string) => ` * ${l}`)
                .join("\n")}\n */\n`;
        }

        // Format based on type (or kind for compatibility)
        const exportType = exp.type || exp.kind;
        switch (exportType) {
            case "interface":
                output += this.formatInterface(exp, options);
                break;
            case "class":
                output += this.formatClass(exp, options);
                break;
            case "function":
                output += this.formatFunction(exp, options);
                break;
            case "type":
                output += this.formatType(exp, options);
                break;
            case "const":
                output += this.formatConst(exp, options);
                break;
            case "enum":
                output += this.formatEnum(exp, options);
                break;
            default:
                output += `export ${exp.signature}\n`;
        }

        return output;
    }

    private formatInterface(
        exp: any,
        options: DistillFormatterOptions,
    ): string {
        let output = `export interface ${exp.name}`;

        // Add extends if in signature
        const extendsMatch = exp.signature.match(/extends\s+(.+?)(?:\s*{|$)/);
        if (extendsMatch) {
            output += ` extends ${extendsMatch[1]}`;
        }

        output += " {\n";

        if (exp.members) {
            for (const member of exp.members) {
                output += `    ${member.signature};\n`;
            }
        }

        output += "}\n";
        return output;
    }

    private formatClass(exp: any, options: DistillFormatterOptions): string {
        let output = `export class ${exp.name}`;

        // Add extends/implements
        const extendsMatch = exp.signature.match(/extends\s+(\w+)/);
        const implementsMatch = exp.signature.match(
            /implements\s+(.+?)(?:\s*{|$)/,
        );

        if (extendsMatch) {
            output += ` extends ${extendsMatch[1]}`;
        }
        if (implementsMatch) {
            output += ` implements ${implementsMatch[1]}`;
        }

        output += " {\n";

        if (exp.members) {
            // Constructor first
            const constructor = exp.members.find(
                (m: any) => m.name === "constructor",
            );
            if (constructor) {
                output += `    ${constructor.signature}\n`;
            }

            // Properties
            const properties = exp.members.filter(
                (m: any) => m.type === "property",
            );
            for (const prop of properties) {
                output += `    ${prop.signature};\n`;
            }

            // Methods
            const methods = exp.members.filter(
                (m: any) => m.type === "method" && m.name !== "constructor",
            );
            for (const method of methods) {
                output += `    ${method.signature}\n`;
            }
        }

        output += "}\n";
        return output;
    }

    private formatFunction(exp: any, options: DistillFormatterOptions): string {
        // Clean up the signature - remove duplicate 'export' if present
        let signature = exp.signature.trim();
        if (signature.startsWith("export ")) {
            signature = signature.substring(7).trim();
        }

        // The signature should already be complete from the parser
        return `export ${signature}\n`;
    }

    private formatType(exp: any, options: DistillFormatterOptions): string {
        // Clean up the signature
        let signature = exp.signature.trim();
        if (signature.startsWith("export ")) {
            signature = signature.substring(7).trim();
        }

        // The signature should already be complete from the parser
        return `export ${signature}\n`;
    }

    private formatConst(exp: any, options: DistillFormatterOptions): string {
        // Clean up the signature
        let signature = exp.signature.trim();
        if (signature.startsWith("export ")) {
            signature = signature.substring(7).trim();
        }

        // The signature should already be complete from the parser
        return `export ${signature}\n`;
    }

    private formatEnum(exp: any, options: DistillFormatterOptions): string {
        // Clean up the signature
        let signature = exp.signature.trim();
        if (signature.startsWith("export ")) {
            signature = signature.substring(7).trim();
        }

        // For enums, use the full signature if available
        if (signature.includes("enum ")) {
            return `export ${signature}\n`;
        }

        return `export enum ${exp.name} {}\n`;
    }

    private groupExportsByType(exports: any[]): Map<string, any[]> {
        const grouped = new Map<string, any[]>();

        for (const exp of exports) {
            const type = exp.type;
            if (!grouped.has(type)) {
                grouped.set(type, []);
            }
            grouped.get(type)!.push(exp);
        }

        return grouped;
    }

    private cleanPath(path: string): string {
        // Remove common prefixes
        if (path.startsWith("src/")) {
            return path.substring(4);
        }
        if (path.startsWith("./")) {
            return path.substring(2);
        }
        if (path.startsWith("/")) {
            return path.substring(1);
        }
        return path;
    }
}
