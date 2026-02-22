export { ContextEngine } from "./core/context.js";
export { GitExtractor } from "./core/git.js";
export { Formatter } from "./core/formatter.js";
export { MarkdownFormatter } from "./commands/extract/formatters/markdown.js";
export { JsonFormatter } from "./commands/extract/formatters/json.js";
export { TextFormatter } from "./commands/extract/formatters/text.js";
export { SensitiveDataScanner } from "./core/safety/scanner.js";
export { SensitiveDataRedactor } from "./core/safety/redactor.js";

export type {
    DexOptions,
    OutputFormat,
    GitChange,
    ExtractedContext,
    SymbolMap,
    FormatterOptions,
} from "./types.js";
export type {
    ScannableFile,
    SensitiveFinding,
    DetectionPassResult,
    TwoPassDetectionResult,
    FindingCategory,
    FindingSeverity,
} from "./core/safety/scanner.js";
export type { RedactionResult, RedactionSummary } from "./core/safety/redactor.js";
