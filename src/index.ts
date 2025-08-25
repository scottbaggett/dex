export { ContextEngine } from "./core/context";
export { GitExtractor } from "./core/git";
export { Formatter } from "./core/formatter";
export { TaskExtractor, type TaskSource } from "./core/task-extractor";
export { MarkdownFormatter } from "./commands/extract/formatters/markdown";
export { JsonFormatter } from "./commands/extract/formatters/json";
export { XmlFormatter } from "./commands/extract/formatters/xml";

export type {
    DexOptions,
    OutputFormat,
    GitChange,
    ExtractedContext,
    TaskContext,
    SymbolMap,
    FormatterOptions,
} from "./types";
