import type { DistillationResult, ExtractedAPI } from "../../../types";

export class AidStyleFormatter {
    formatDistillation(
        result: DistillationResult,
        originalPath: string,
    ): string {
        let output = "";

        // Group files by directory for better organization
        const filesByDir = this.groupFilesByDirectory(result.apis);

        for (const [dir, files] of Array.from(filesByDir.entries())) {
            for (const api of files) {
                output += this.formatFile(api) + "\n";
            }
        }

        return output.trim();
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

        // Sort directories and files within each directory
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

    private formatFile(api: ExtractedAPI): string {
        let output = `<file path="${this.cleanPath(api.file)}">\n`;

        // Get imports if available
        const imports = api.imports || this.extractImportsFromExports(api);
        if (imports.length > 0) {
            for (const imp of imports) {
                output += `import '${imp}'\n`;
            }
            output += "\n";
        }

        // Format exports
        const publicExports = api.exports.filter(
            (e) => e.visibility === "public",
        );
        const privateExports = api.exports.filter(
            (e) => e.visibility === "private",
        );

        // Group by type
        const interfaces = publicExports.filter((e) => e.type === "interface");
        const classes = publicExports.filter((e) => e.type === "class");
        const functions = publicExports.filter((e) => e.type === "function");
        const types = publicExports.filter((e) => e.type === "type");
        const consts = publicExports.filter((e) => e.type === "const");
        const enums = publicExports.filter((e) => e.type === "enum");

        // Format each group
        for (const iface of interfaces) {
            output += this.formatInterface(iface);
        }

        for (const cls of classes) {
            output += this.formatClass(cls);
        }

        for (const func of functions) {
            output += this.formatFunction(func);
        }

        for (const type of types) {
            output += this.formatType(type);
        }

        for (const cnst of consts) {
            output += this.formatConst(cnst);
        }

        for (const enm of enums) {
            output += this.formatEnum(enm);
        }

        output += "</file>\n";
        return output;
    }

    private cleanPath(path: string): string {
        // Remove src/ prefix if present
        if (path.startsWith("src/")) {
            return path.substring(4);
        }
        // Remove leading slash
        if (path.startsWith("/")) {
            return path.substring(1);
        }
        return path;
    }

    private extractImportsFromExports(api: ExtractedAPI): string[] {
        // This is a simplified version - in reality we'd need the parser to provide imports
        const imports = new Set<string>();

        // Look for common patterns in signatures
        for (const exp of api.exports) {
            // Extract types from signatures
            const typeMatches = exp.signature.matchAll(
                /:\s*([A-Z]\w+)(?:<|>|\s|$)/g,
            );
            for (const match of Array.from(typeMatches)) {
                const type = match?.[1];
                if (!type) continue;
                // Common external types
                if (["Promise", "Observable", "Subject"].includes(type)) {
                    continue;
                }
                // Likely an import
                if (
                    type &&
                    type.length > 0 &&
                    type[0] === type[0]?.toUpperCase()
                ) {
                    // Try to guess module (simplified)
                    if (type.includes("Options") || type.includes("Config")) {
                        imports.add("../types");
                    }
                }
            }
        }

        return Array.from(imports).sort();
    }

    private formatInterface(exp: {
        name: string;
        signature: string;
        members?: Array<{
            name: string;
            signature: string;
            type: "property" | "method";
        }>;
    }): string {
        let output = `\nexport interface ${exp.name}`;

        // Add extends if present in signature
        const extendsMatch = exp.signature.match(/extends\s+(.+)$/);
        if (extendsMatch?.[1]) {
            output += ` extends ${extendsMatch[1]}`;
        }

        output += " {\n";

        // Format members if available
        if (exp.members) {
            for (const member of exp.members) {
                if (member.type === "property") {
                    output += `    ${member.signature}\n`;
                } else if (member.type === "method") {
                    output += `    ${member.signature}\n`;
                }
            }
        }

        output += "}\n";
        return output;
    }

    private formatClass(exp: {
        name: string;
        signature: string;
        members?: Array<{
            name: string;
            signature: string;
            type: "property" | "method";
        }>;
    }): string {
        let output = `\nexport class ${exp.name}`;

        // Add extends/implements if present
        const extendsMatch = exp.signature.match(/extends\s+(\w+)/);
        const implementsMatch = exp.signature.match(/implements\s+(.+)$/);

        if (extendsMatch?.[1]) {
            output += ` extends ${extendsMatch[1]}`;
        }
        if (implementsMatch?.[1]) {
            output += ` implements ${implementsMatch[1]}`;
        }

        output += " {\n";

        // Format members if available
        if (exp.members) {
            // Constructor first
            const constructor = exp.members.find(
                (m) => m.name === "constructor",
            );
            if (constructor) {
                output += `    public ${constructor.signature}\n`;
            }

            // Then other members
            for (const member of exp.members) {
                if (member.name === "constructor") continue;

                if (member.type === "property") {
                    output += `    ${member.signature}\n`;
                } else if (member.type === "method") {
                    const sig = member.signature;
                    // Add public if not specified
                    if (
                        !sig.includes("public") &&
                        !sig.includes("private") &&
                        !sig.includes("protected")
                    ) {
                        output += `    public ${sig}\n`;
                    } else {
                        output += `    ${sig}\n`;
                    }
                }
            }
        }

        output += "}\n";
        return output;
    }

    private formatFunction(exp: { signature: string }): string {
        return `export ${exp.signature}\n`;
    }

    private formatType(exp: { signature: string }): string {
        return `export ${exp.signature}\n`;
    }

    private formatConst(exp: { signature: string }): string {
        return `export ${exp.signature}\n`;
    }

    private formatEnum(exp: { signature: string }): string {
        return `export ${exp.signature}\n`;
    }
}
