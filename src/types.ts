export type OutputFormat = "markdown" | "json" | "xml" | "txt";

export interface DexOptions {
    // Git options
    since?: string;
    range?: string;
    staged?: boolean;
    all?: boolean;

    // Time-based options
    timeRange?: string; // e.g., "2h", "30m", "1d"
    isTimeRange?: boolean;

    // Full file options
    full?: string; // Pattern for files to show in full
    diffOnly?: boolean; // Force diff view for all files (disable Smart Context)

    // Untracked files
    includeUntracked?: boolean;
    untrackedPattern?: string;

    // Filter options
    path?: string;
    type?: string[];

    // File selection options
    selectedFiles?: string[];

    // Output options
    format?: OutputFormat;
    clipboard?: boolean;

    interactive?: boolean;

    // Optimization (from --optimize flag)
    symbols?: boolean;
    aid?: boolean;

    // Display options
    noMetadata?: boolean;

    // Prompt options removed
}

export interface GitChange {
    file: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
    diff: string;
    oldFile?: string; // for renames
    lastModified?: Date; // file modification time
}

export interface Metadata {
    generated: string; // ISO timestamp
    repository: {
        name: string;
        branch: string;
        commit: string;
    };
    extraction: {
        method?: string; // How changes were detected (e.g., "feature branch", "staged changes")
        filters?: {
            path?: string;
            type?: string[];
        };
    };
    tokens: {
        estimated: number;
    };
    tool: {
        name: string;
        version: string;
    };
}

export interface ExtractedContext {
    changes: GitChange[];
    scope: {
        filesChanged: number;
        functionsModified: number;
        linesAdded: number;
        linesDeleted: number;
    };
    fullFiles?: Map<string, string>;
    metadata: Metadata;
    tokenSavings?: {
        fullFileTokens: number;
        actualTokens: number;
        saved: number;
        percentSaved: number;
    };
    additionalContext?: {
        totalChanges?: number;
        notIncluded?: number;
    };
}

export interface SymbolMap {
    [file: string]: {
        functions: string[];
        classes: string[];
        exports: string[];
        imports: string[];
    };
}

export interface FormatterOptions {
    context: ExtractedContext;
    options: DexOptions;
}

export interface Formatter {
    format(options: FormatterOptions): string;
}

// Snapshot-related types
export interface SnapshotMetadata {
    id: string;
    time: string; // ISO timestamp
    description?: string;
    tags?: string[];
    filesCount: number;
    totalSize: number;
}

export interface SnapshotTree {
    files: {
        [path: string]: {
            hash: string;
            size: number;
            mode: string;
        };
    };
}

export interface Snapshot {
    metadata: SnapshotMetadata;
    tree: SnapshotTree;
}

export interface SnapshotDiff {
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
}

export interface SnapshotOptions {
    message?: string;
    tags?: string[];
    includeUntracked?: boolean;
    path?: string;
    ignorePatterns?: string[];
    selectedFiles?: string[];
    onProgress?: (progress: {
        current: number;
        total: number;
        file: string;
    }) => void;
}

// Distiller types

export interface DistillerOptions {
    path?: string;
    excludePatterns?: string[];
    includeComments?: boolean;
    includeDocstrings?: boolean;
    includeImports?: boolean;
    format?: "txt" | "markdown" | "json" | string;
    output?: string;
    since?: string;
    staged?: boolean;
    parallel?: boolean;
    dryRun?: boolean;
    includePrivate?: boolean;
    includePatterns?: string[];
}

export interface CompressionResult {
    files: CompressedFile[];
    metadata: {
        totalFiles: number;
        totalSize: number;
        excludedCount: number;
        timestamp: string;
    };
}

export interface CompressedFile {
    path: string;
    size: number;
    hash: string;
    content: string;
    language?: string;
}

export interface DistillationResult {
    apis: ExtractedAPI[];
    structure: ProjectStructure;
    dependencies: DependencyMap;
    metadata: {
        originalTokens: number;
        distilledTokens: number;
        compressionRatio: number;
    };
}

export interface ExtractedAPI {
    file: string;
    imports?: string[];
    exports: Array<{
        name: string;
        type: "function" | "class" | "interface" | "const" | "type" | "enum";
        signature: string;
        docstring?: string;
        visibility: "public" | "private" | "protected";
        location: {
            startLine: number;
            endLine: number;
        };
        members?: Array<{
            name: string;
            signature: string;
            type: "property" | "method";
        }>;
    }>;
}

export interface ProjectStructure {
    directories: string[];
    fileCount: number;
    languages: Record<string, number>;
}

export interface DependencyMap {
    [file: string]: {
        imports: string[];
        exports: string[];
    };
}
