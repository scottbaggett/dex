import type { GitChange } from "../../../types";

type ChangeWithContent = GitChange & { content?: string };

export class JsonFormatter {
    format(changes: ChangeWithContent[]): string {
        const output = {
            files: changes.map(change => ({
                path: change.file,
                status: change.status,
                content: change.content || change.diff || "",
                additions: change.additions,
                deletions: change.deletions,
            })),
            metadata: {
                totalFiles: changes.length,
                totalAdditions: changes.reduce((sum, c) => sum + (c.additions || 0), 0),
                totalDeletions: changes.reduce((sum, c) => sum + (c.deletions || 0), 0),
            }
        };
        
        return JSON.stringify(output, null, 2);
    }
}