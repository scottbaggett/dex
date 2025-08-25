import { Formatter, FormatterOptions } from "./types";
import { DistillationResult, CompressionResult } from "../../../types";

/**
 * JSON formatter
 * Produces clean JSON output
 */
export class JsonFormatter implements Formatter {
    name = "JSON Formatter";
    format = "json";

    formatDistillation(
        result: DistillationResult,
        options: FormatterOptions = {},
    ): string {
        const output: any = {
            files: [],
        };

        if (options.includeMetadata !== false) {
            output.metadata = {
                fileCount: result.structure.fileCount,
                originalTokens: result.metadata.originalTokens,
                distilledTokens: result.metadata.distilledTokens,
                compressionRatio: result.metadata.compressionRatio,
                languages: result.structure.languages,
            };
        }

        for (const api of result.apis) {
            const file: any = {
                path: api.file,
                exports: [],
            };

            if (options.includeImports !== false && api.imports.length > 0) {
                file.imports = api.imports;
            }

            for (const exp of api.exports) {
                if (exp.visibility === "private" && !options.includePrivate) {
                    continue;
                }

                const exportItem: any = {
                    name: exp.name,
                    type: exp.type,
                    signature: exp.signature,
                    visibility: exp.visibility,
                };

                if (options.includeDocstrings && exp.docstring) {
                    exportItem.docstring = exp.docstring;
                }

                if (exp.members && exp.members.length > 0) {
                    exportItem.members = exp.members;
                }

                file.exports.push(exportItem);
            }

            output.files.push(file);
        }

        return JSON.stringify(output, null, 2);
    }

    formatCompression(
        result: CompressionResult,
        options: FormatterOptions = {},
    ): string {
        const output: any = {
            files: result.files.map((f) => ({
                path: f.path,
                size: f.size,
                hash: f.hash,
                language: f.language,
                content: f.content,
            })),
        };

        if (options.includeMetadata !== false) {
            output.metadata = result.metadata;
        }

        return JSON.stringify(output, null, 2);
    }

    formatCombined(
        compression: CompressionResult,
        distillation: DistillationResult,
        options: FormatterOptions = {},
    ): string {
        const output = {
            compression: JSON.parse(
                this.formatCompression(compression, options),
            ),
            distillation: JSON.parse(
                this.formatDistillation(distillation, options),
            ),
        };

        return JSON.stringify(output, null, 2);
    }
}
