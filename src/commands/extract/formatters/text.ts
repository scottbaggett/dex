import { Formatter } from "../../../core/formatter.js";
import type {
    FormatterOptions,
    ExtractedContext,
    Metadata,
} from "../../../types.js";

export class TextFormatter extends Formatter {
    format({ context, options }: FormatterOptions): string {
        const sections: string[] = [];
        // code context section
        sections.push("<code_context>");

        // Changes section
        if (context.changes.length > 0) {
            sections.push(this.formatChanges(context, options));
        }

        sections.push("</code_context>");

        return sections.join("\n");
    }

    private formatMetadata(metadata: Metadata): string {
        const lines = ["  <metadata>"];
        lines.push(
            `    <generated>${this.escapeXml(metadata.generated)}</generated>`,
        );
        lines.push(`    <repository>`);
        lines.push(
            `      <name>${this.escapeXml(metadata.repository.name)}</name>`,
        );
        lines.push(
            `      <branch>${this.escapeXml(metadata.repository.branch)}</branch>`,
        );
        lines.push(
            `      <commit>${this.escapeXml(metadata.repository.commit)}</commit>`,
        );
        lines.push(`    </repository>`);
        lines.push(`    <extraction>`);

        if (metadata.extraction.method) {
            lines.push(
                `      <method>${this.escapeXml(metadata.extraction.method)}</method>`,
            );
        }

        if (
            metadata.extraction.filters?.path ||
            metadata.extraction.filters?.type
        ) {
            lines.push(`      <filters>`);
            if (metadata.extraction.filters.path) {
                lines.push(
                    `        <path>${this.escapeXml(metadata.extraction.filters.path)}</path>`,
                );
            }
            if (metadata.extraction.filters.type?.length) {
                lines.push(
                    `        <types>${this.escapeXml(metadata.extraction.filters.type.join(", "))}</types>`,
                );
            }
            lines.push(`      </filters>`);
        }

        lines.push(`    </extraction>`);
        lines.push(`    <tokens>`);
        lines.push(`      <estimated>${metadata.tokens.estimated}</estimated>`);
        lines.push(`    </tokens>`);
        lines.push(`    <tool>`);
        lines.push(`      <name>${this.escapeXml(metadata.tool.name)}</name>`);
        lines.push(
            `      <version>${this.escapeXml(metadata.tool.version)}</version>`,
        );
        lines.push(`    </tool>`);
        lines.push(`  </metadata>`);

        return lines.join("\n");
    }

    private formatScope(scope: ExtractedContext["scope"]): string {
        return `  <scope>
    <files_changed>${scope.filesChanged}</files_changed>
    <lines_added>${scope.linesAdded}</lines_added>
    <lines_deleted>${scope.linesDeleted}</lines_deleted>
    <functions_modified>${scope.functionsModified}</functions_modified>
  </scope>`;
    }

    private formatChanges(
        context: ExtractedContext,
        _options: FormatterOptions["options"],
    ): string {
        const lines = ["  <changes>"];

        for (const change of context.changes) {
            lines.push(`    <file>`);
            lines.push(`      <path>${this.escapeXml(change.file)}</path>`);
            lines.push(
                `      <status>${this.escapeXml(change.status)}</status>`,
            );
            lines.push(`      <additions>${change.additions}</additions>`);
            lines.push(`      <deletions>${change.deletions}</deletions>`);

            if (change.oldFile) {
                lines.push(
                    `      <old_path>${this.escapeXml(change.oldFile)}</old_path>`,
                );
            }

            // Include full file if available
            if (context.fullFiles?.has(change.file)) {
                const content = context.fullFiles.get(change.file);
                const ext = this.getFileExtension(change.file);
                const lang = this.getLanguageFromExtension(ext);

                lines.push(
                    `      <content language="${this.escapeXml(lang)}">`,
                );
                lines.push(`<![CDATA[${content}]]>`);
                lines.push(`      </content>`);
            } else if (change.diff) {
                // Show diff
                lines.push(`      <diff>`);
                lines.push(`<![CDATA[${this.formatDiff(change.diff)}]]>`);
                lines.push(`      </diff>`);
            }

            lines.push(`    </file>`);
        }

        lines.push(`  </changes>`);
        return lines.join("\n");
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}
