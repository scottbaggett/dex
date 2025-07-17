export { ContextEngine } from './core/context';
export { GitExtractor } from './core/git';
export { Formatter } from './core/formatter';
export { TaskExtractor, type TaskSource } from './core/task-extractor';
export { MarkdownFormatter } from './templates/markdown';
export { JsonFormatter } from './templates/json';
export { XmlFormatter } from './templates/xml';

export type {
  DexOptions,
  OutputFormat,
  GitChange,
  ExtractedContext,
  TaskContext,
  SymbolMap,
  FormatterOptions,
} from './types';