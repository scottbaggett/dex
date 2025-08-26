import type { GitChange } from "../../../types.js";
import { z } from "zod";

// Define the shape of our change with content
type ChangeWithContent = GitChange & { content?: string };

// Define the output schema for type safety
const CombineJsonOutputSchema = z.object({
    files: z.array(z.object({
        path: z.string(),
        status: z.string(),
        content: z.string(),
        additions: z.number(),
        deletions: z.number(),
    })),
    metadata: z.object({
        totalFiles: z.number(),
        totalAdditions: z.number(),
        totalDeletions: z.number(),
    }),
});

type CombineJsonOutput = z.infer<typeof CombineJsonOutputSchema>;

export class JsonFormatter {
    format(changes: ChangeWithContent[]): string {
        const output: CombineJsonOutput = {
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
        
        // Validate our output matches the schema (in development)
        if (process.env.NODE_ENV !== 'production') {
            CombineJsonOutputSchema.parse(output);
        }
        
        return JSON.stringify(output, null, 2);
    }
}