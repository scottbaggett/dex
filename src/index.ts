export { ContextEngine } from './core/context';
export { GitExtractor } from './core/git';
export { Formatter } from './core/formatter';
export { MarkdownFormatter } from './templates/markdown';
export { JsonFormatter } from './templates/json';
export { ClaudeFormatter } from './templates/claude';
export { GptFormatter } from './templates/gpt';

export type {
  DexOptions,
  ContextLevel,
  OutputFormat,
  ExtractMode,
  GitChange,
  ExtractedContext,
  TaskContext,
  SymbolMap,
  FormatterOptions,
} from './types';