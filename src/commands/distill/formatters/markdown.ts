import { Formatter, FormatterOptions } from "./types";
import { DistillationResult, CompressionResult } from "@/types";

/**
 * Markdown formatter
 * Produces markdown-formatted output with code blocks
 */
export class MarkdownFormatter implements Formatter {
    name = "Markdown Formatter";
    format = "markdown";

    formatDistillation(
        result: DistillationResult,
        options: FormatterOptions = {},
    ): string {
        let output = "# Distilled Context\n\n";

        // Add metadata if requested
        if (options.includeMetadata !== false) {
            output += "## Summary\n";
            output += `- Files analyzed: ${result.structure.fileCount}\n`;
            output += `- Original tokens: ${result.metadata.originalTokens.toLocaleString()}\n`;
            output += `- Distilled tokens: ${result.metadata.distilledTokens.toLocaleString()}\n`;
            output += `- Compression ratio: ${(result.metadata.compressionRatio * 100).toFixed(1)}%\n\n`;

            // Languages breakdown
            output += "## Languages\n";
            for (const [lang, count] of Object.entries(
                result.structure.languages,
            )) {
                output += `- ${lang}: ${count} files\n`;
            }
            output += "\n";
        }

        // APIs by file
        output += "## Extracted APIs\n\n";
        for (const api of result.apis) {
            output += `### ${api.file}\n\n`;

            // Imports
            if (options.includeImports !== false && api.imports.length > 0) {
                output += "**Imports:**\n```\n";
                for (const imp of api.imports) {
                    output += `import '${imp}'\n`;
                }
                output += "```\n\n";
            }

            // Exports
            for (const exp of api.exports) {
                if (exp.visibility === "private" && !options.includePrivate) {
                    continue;
                }

                if (options.includeDocstrings && exp.docstring) {
                    output += "```\n" + exp.docstring + "\n```\n";
                }

                const lang = this.getLanguageForFile(api.file);
                output += `\`\`\`${lang}\n${exp.signature}\n\`\`\`\n\n`;
            }
        }

        return output.trim();
    }

    formatCompression(
        result: CompressionResult,
        options: FormatterOptions = {},
    ): string {
        let output = "# Compressed Files\n\n";

        if (options.includeMetadata !== false) {
            output += `**Total Files:** ${result.metadata.totalFiles}\n`;
            output += `**Total Size:** ${result.metadata.totalSize.toLocaleString()} bytes\n\n`;
        }

        for (const file of result.files) {
            const lang = file.language || "text";
            output += `## ${file.path}\n\n`;
            output += `\`\`\`${lang}\n${file.content}\n\`\`\`\n\n`;
        }

        return output.trim();
    }

    formatCombined(
        compression: CompressionResult,
        distillation: DistillationResult,
        options: FormatterOptions = {},
    ): string {
        return `${this.formatCompression(compression, options)}\n\n---\n\n${this.formatDistillation(distillation, options)}`;
    }

    private getLanguageForFile(filePath: string): string {
        const ext = filePath.split(".").pop()?.toLowerCase();
        const langMap: Record<string, string> = {
            ts: "typescript",
            tsx: "typescript",
            js: "javascript",
            jsx: "javascript",
            py: "python",
            rb: "ruby",
            go: "go",
            rs: "rust",
            java: "java",
            cpp: "cpp",
            c: "c",
            cs: "csharp",
            php: "php",
            swift: "swift",
            kt: "kotlin",
            scala: "scala",
            sh: "bash",
            yaml: "yaml",
            yml: "yaml",
            json: "json",
            xml: "xml",
            html: "html",
            css: "css",
            scss: "scss",
            sql: "sql",
        };
        return langMap[ext || ""] || "text";
    }
}
