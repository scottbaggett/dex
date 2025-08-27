/**
 * Language module types and interfaces
 * Each language defines its own parser type and processing strategy
 */

import { PrivateIdentifier } from "ts-morph";

export type ParserType = "tree-sitter" | "line-based" | "regex" | "custom";

/**
 * Processing options from CLI/user
 */
export interface ProcessingOptions {
    // Output control
    comments?: boolean; // Include comment nodes
    docstrings?: boolean; // Include documentation
    public?: boolean; // Include public members
    private?: boolean; // Include private members
    protected?: boolean; // Include protected members
    internal?: boolean; // Include internal members

    // Depth control
    maxDepth?: number; // Maximum nesting depth

    // Filtering
    include?: string[]; // Include only matching names
    exclude?: string[]; // Exclude matching names

    // Output format hints
    preserveOrder?: boolean; // Maintain source order

    // Performance
    maxFileSize?: number; // Skip files larger than this
    timeout?: number; // Processing timeout in ms
}

export interface LanguageModule {
    name: string; // 'typescript', 'python', etc.
    displayName: string; // 'TypeScript', 'Python', etc.
    extensions: string[]; // ['.ts', '.tsx', '.js', '.jsx']

    // Lifecycle
    initialize(): Promise<void>;
    isInitialized(): boolean;

    // Processing - MUST respect options
    process(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): Promise<ProcessResult>;

    // Capabilities
    getCapabilities(): LanguageCapabilities;

    // Validation
    canProcess(filePath: string): boolean;
    supportsExtension(ext: string): boolean;
}

export interface LanguageCapabilities {
    supportsPrivateMembers: boolean;
    supportsComments: boolean;
    supportsDocstrings: boolean;
    supportsStreaming: boolean;
    supportsPartialParsing: boolean;
    maxRecommendedFileSize?: number;
}

export interface ProcessResult {
    imports: ImportNode[];
    exports: ExportNode[];
    errors?: ProcessError[];
    metadata?: {
        parseTime?: number;
        nodeCount?: number;
        skipped?: SkippedItem[]; // What was filtered out
        languageVersion?: string;
    };
}

export interface SkippedItem {
    name: string;
    reason: "private" | "pattern" | "depth" | "comment";
    line?: number;
}

export interface ImportNode {
    source: string;
    specifiers: ImportSpecifier[];
    line?: number;
    raw?: string; // Original import statement
}

export interface ImportSpecifier {
    name: string;
    alias?: string;
    isDefault?: boolean;
    isNamespace?: boolean;
}

export interface ExportNode {
    name: string;
    kind: ExportKind;
    signature: string;
    visibility?: "public" | "private" | "protected";
    members?: MemberNode[];
    line?: number;
    depth?: number; // Nesting depth
    isDefault?: boolean;
    isExported?: boolean;
    docstring?: string; // If includeDocstrings is true
    comment?: string; // If includeComments is true
    raw?: string; // Original declaration
}

export type ExportKind =
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "const"
    | "let"
    | "var"
    | "namespace"
    | "module";

export interface MemberNode {
    name: string;
    kind: "property" | "method" | "getter" | "setter" | "constructor";
    signature: string;
    isStatic?: boolean;
    isPrivate?: boolean;
    isProtected?: boolean;
    isOptional?: boolean;
}

export interface ProcessError {
    message: string;
    line?: number;
    column?: number;
    severity?: "error" | "warning" | "info";
}
