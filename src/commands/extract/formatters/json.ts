import { Formatter } from "../../../core/formatter.js";
import type { FormatterOptions, ExtractedContext } from "../../../types.js";

interface JsonOutput {
    scope: ExtractedContext["scope"];
    changes: Array<{
        file: string;
        status: string;
        additions: number;
        deletions: number;
        oldFile?: string;
        diff?: string;
        fullContent?: string;
    }>;
    metadata?: ExtractedContext["metadata"];
}

export class JsonFormatter extends Formatter {
    format({ context, options }: FormatterOptions): string {
        const output: JsonOutput = {
            scope: context.scope,
            changes: context.changes.map((change) => ({
                file: change.file,
                status: change.status,
                additions: change.additions,
                deletions: change.deletions,
                oldFile: change.oldFile,
                diff: change.diff,
                fullContent: context.fullFiles?.get(change.file),
            })),
        };

        // Include metadata unless excluded
        if (!options.noMetadata) {
            output.metadata = context.metadata;
        }

        return JSON.stringify(output, null, 2);
    }
}
