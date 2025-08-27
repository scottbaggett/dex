import { z } from "zod";

// Output format schema
export const OutputFormatSchema = z.enum(["md", "json", "xml", "txt"]);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

// Git change status schema
export const GitStatusSchema = z.enum([
    "added",
    "modified",
    "deleted",
    "renamed",
]);
export type GitStatus = z.infer<typeof GitStatusSchema>;

// Git change schema
export const GitChangeSchema = z.object({
    file: z.string(),
    status: GitStatusSchema,
    additions: z.number(),
    deletions: z.number(),
    diff: z.string(),
    oldFile: z.string().optional(),
    lastModified: z.date().optional(),
    content: z.string().optional(),
});
export type GitChange = z.infer<typeof GitChangeSchema>;

// Command options schemas
export const ExtractOptionsSchema = z.object({
    // Git options
    since: z.string().optional(),
    range: z.string().optional(),
    staged: z.boolean().optional(),
    all: z.boolean().optional(),

    // Time-based options
    timeRange: z.string().optional(),
    isTimeRange: z.boolean().optional(),

    // Full file options
    full: z.string().optional(),
    diffOnly: z.boolean().optional(),

    // Untracked files
    includeUntracked: z.boolean().optional(),
    untrackedPattern: z.string().optional(),

    // Filter options
    path: z.string().optional(),
    type: z.array(z.string()).optional(),

    // File selection options
    selectedFiles: z.array(z.string()).optional(),

    // Output options
    format: OutputFormatSchema.optional(),
    clipboard: z.boolean().optional(),
    interactive: z.boolean().optional(),

    // Optimization
    symbols: z.boolean().optional(),
    aid: z.boolean().optional(),

    // Display options
    noMetadata: z.boolean().optional(),

    // Interactive selection
    select: z.boolean().optional(),
    sortBy: z.enum(["name", "updated", "size", "status"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    filterBy: z
        .enum([
            "all",
            "staged",
            "unstaged",
            "untracked",
            "modified",
            "added",
            "deleted",
        ])
        .optional(),
});
export type ExtractOptions = z.infer<typeof ExtractOptionsSchema>;

export const CombineOptionsSchema = z.object({
    format: OutputFormatSchema.optional().default("txt"),
    output: z.string().optional(),
    clipboard: z.boolean().optional(),
    stdout: z.boolean().optional(),
    select: z.boolean().optional(),
    exclude: z.array(z.string()).optional().default([]),
    include: z.array(z.string()).optional().default([]),
    staged: z.boolean().optional(),
    since: z.string().optional(),
    dryRun: z.boolean().optional(),
    maxFiles: z.union([z.string(), z.number()]).optional().default("1000"),
    maxDepth: z.union([z.string(), z.number()]).optional().default("10"),
    noGitignore: z.boolean().optional(),
});
export type CombineOptions = z.infer<typeof CombineOptionsSchema>;

export const DistillOptionsSchema = z.object({
    path: z.string().optional(),
    comments: z.boolean().optional(),
    docstrings: z.boolean().optional(),
    format: OutputFormatSchema.optional(),
    output: z.string().optional(),
    since: z.string().optional(),
    staged: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    clipboard: z.boolean().optional(),
    stdout: z.boolean().optional(),
    select: z.boolean().optional(),
    private: z.boolean().optional(),
    public: z.boolean().optional(),
    protected: z.boolean().optional(),
    internal: z.boolean().optional(),
    exclude: z.array(z.string()).optional().default([]),
    include: z.array(z.string()).optional().default([]),
    workers: z.number().min(1).max(16).optional(),
});
export type DistillOptions = z.infer<typeof DistillOptionsSchema>;

export const TreeOptionsSchema = z.object({
    output: z.string().optional(),
    stdout: z.boolean().optional(),
    clipboard: z.boolean().optional(),
    exclude: z.array(z.string()).optional(),
    includePrivate: z.boolean().optional(),
    showTypes: z.boolean().optional(),
    showParams: z.boolean().optional(),
    groupBy: z.enum(["file", "type", "none"]).optional(),
});
export type TreeOptions = z.infer<typeof TreeOptionsSchema>;

// Metadata schema
export const MetadataSchema = z.object({
    generated: z.string(),
    repository: z.object({
        name: z.string(),
        branch: z.string(),
        commit: z.string(),
    }),
    extraction: z.object({
        method: z.string().optional(),
        filters: z
            .object({
                path: z.string().optional(),
                type: z.array(z.string()).optional(),
            })
            .optional(),
    }),
    tokens: z.object({
        estimated: z.number(),
    }),
    tool: z.object({
        name: z.string(),
        version: z.string(),
    }),
});
export type Metadata = z.infer<typeof MetadataSchema>;

// Extracted context schema
export const ExtractedContextSchema = z.object({
    changes: z.array(GitChangeSchema),
    scope: z.object({
        filesChanged: z.number(),
        functionsModified: z.number(),
        linesAdded: z.number(),
        linesDeleted: z.number(),
    }),
    fullFiles: z.instanceof(Map<string, string>).optional(),
    metadata: MetadataSchema,
    tokenSavings: z
        .object({
            fullFileTokens: z.number(),
            actualTokens: z.number(),
            saved: z.number(),
            percentSaved: z.number(),
        })
        .optional(),
    additionalContext: z.record(z.string(), z.unknown()).optional(),
});
export type ExtractedContext = z.infer<typeof ExtractedContextSchema>;

// Keep DexOptions for backwards compatibility but use ExtractOptions
export const DexOptionsSchema = ExtractOptionsSchema;
export type DexOptions = ExtractOptions;
