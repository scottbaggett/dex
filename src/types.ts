// Re-export from schemas for backwards compatibility
export {
    OutputFormat,
    OutputFormatSchema,
    DexOptions,
    DexOptionsSchema,
    GitChange,
    GitChangeSchema,
    GitStatus,
    GitStatusSchema,
    Metadata,
    MetadataSchema,
    ExtractedContext,
    ExtractedContextSchema,
    ExtractOptions,
    ExtractOptionsSchema,
    CombineOptions,
    CombineOptionsSchema,
    DistillOptions,
    DistillOptionsSchema,
    TreeOptions,
    TreeOptionsSchema,
} from "./schemas.js";

// Import for use in local interfaces
import type { ExtractedContext, DexOptions, DistillOptions } from "./schemas.js";

export interface SymbolMap {
    [file: string]: {
        functions: string[];
        classes: string[];
        exports: string[];
        imports: string[];
    };
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

// Re-export DistillerOptions as alias for DistillOptions
export type DistillerOptions = DistillOptions;

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

// ============================================================
// FORMATTER TYPES
// ============================================================

// Extract Command Formatters (format Git changes/diffs)
export interface FormatterOptions {
    context: ExtractedContext;
    options: DexOptions;
}

export interface Formatter {
    format(options: FormatterOptions): string;
}

// Distill Command Formatters (format API signatures)
export interface DistillFormatterOptions {
    // Control what to include
    includeImports?: boolean;
    includePrivate?: boolean;
    includeDocstrings?: boolean;
    includeComments?: boolean;
    includeMetadata?: boolean;
    
    // Output style
    preserveStructure?: boolean;
    groupByType?: boolean;
    
    // Language hints
    language?: string;
    syntaxHighlight?: boolean;
}

export interface DistillFormatter {
    name: string;
    format: string;  // 'xml', 'markdown', 'json', 'text'
    
    /**
     * Format a distillation result
     */
    formatDistillation(
        result: DistillationResult,
        options?: DistillFormatterOptions
    ): string;
    
    /**
     * Format a compression result
     */
    formatCompression(
        result: CompressionResult,
        options?: DistillFormatterOptions
    ): string;
    
    /**
     * Format combined results
     */
    formatCombined(
        compression: CompressionResult,
        distillation: DistillationResult,
        options?: DistillFormatterOptions
    ): string;
}

export interface FormatterRegistry {
    register(formatter: DistillFormatter): void;
    get(format: string): DistillFormatter | null;
    getDefault(): DistillFormatter;
    list(): string[];
}
