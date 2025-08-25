import { Formatter, FormatterOptions } from "./types";
import { DistillationResult, CompressionResult } from "../../../types";
import { getSyntaxLanguage } from "../../../utils/language";

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
        let output = "";
        
        for (const api of result.apis) {
            output += `## ${api.file}\n\n`;
            
            const lang = getSyntaxLanguage(api.file);
            output += `\`\`\`${lang}\n`;
            
            // Add imports
            if (options.includeImports !== false && api.imports.length > 0) {
                for (const imp of api.imports) {
                    output += `import '${imp}'\n`;
                }
            }
            
            // Add exports
            for (const exp of api.exports) {
                if (exp.visibility === "private" && !options.includePrivate) {
                    continue;
                }
                output += `${exp.signature}\n`;
            }
            
            output += `\`\`\`\n\n`;
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

}
