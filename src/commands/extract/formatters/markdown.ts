import { Formatter } from "../../../core/formatter.js";
import type {
    FormatterOptions,
    ExtractedContext,
    Metadata,
} from "../../../types.js";

export class MarkdownFormatter extends Formatter {
    format({ context, options }: FormatterOptions): string {
        const sections: string[] = [];

        // Metadata (unless excluded)
        if (!options.noMetadata) {
            sections.push(this.formatMetadata(context.metadata));
        }

        // Scope summary
        sections.push(this.formatScope(context.scope));

        // Changes section
        if (context.changes.length > 0) {
            sections.push(this.formatChanges(context, options));
        }

        return sections.join("\n\n");
    }

    private formatMetadata(metadata: Metadata): string {
        const lines = ["## Metadata"];
        lines.push(`- **Generated:** ${metadata.generated}`);
        lines.push(
            `- **Repository:** ${metadata.repository.name} (${metadata.repository.branch})`,
        );
        lines.push(`- **Commit:** ${metadata.repository.commit}`);
        lines.push(`- **Extraction Method:** ${metadata.extraction.method}`);

        if (
            metadata.extraction.filters?.path ||
            metadata.extraction.filters?.type
        ) {
            lines.push("- **Filters:**");
            if (metadata.extraction.filters.path) {
                lines.push(`  - Path: ${metadata.extraction.filters.path}`);
            }
            if (metadata.extraction.filters.type?.length) {
                lines.push(
                    `  - Types: ${metadata.extraction.filters.type.join(", ")}`,
                );
            }
        }

        lines.push(
            `- **Estimated Tokens:** ~${metadata.tokens.estimated.toLocaleString()}`,
        );
        lines.push(`- **dex Version:** ${metadata.tool.version}`);

        return lines.join("\n");
    }

    private formatScope(scope: ExtractedContext["scope"]): string {
        return `## Scope
- **Files Changed:** ${scope.filesChanged}
- **Lines:** +${scope.linesAdded} -${scope.linesDeleted}`;
    }

    private formatChanges(
        context: ExtractedContext,
        _options: FormatterOptions["options"],
    ): string {
        const lines = ["## Changes"];

        for (const change of context.changes) {
            lines.push("");
            lines.push(
                `### ${change.file}${change.status === "renamed" ? ` (renamed from ${change.oldFile})` : ""}`,
            );

            // Include full file if available
            if (context.fullFiles?.has(change.file)) {
                const content = context.fullFiles.get(change.file);
                const ext = this.getFileExtension(change.file);
                const lang = this.getLanguageFromExtension(ext);

                lines.push(`\`\`\`${lang}`);
                lines.push(content!);
                lines.push("```");
            } else if (change.diff) {
                // Show diff
                lines.push("```diff");
                lines.push(this.formatDiff(change.diff));
                lines.push("```");
            }
        }

        return lines.join("\n");
    }
}
