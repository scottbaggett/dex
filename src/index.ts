export { ContextEngine } from './core/context';
export { GitExtractor } from './core/git';
export { Formatter } from './core/formatter';
export { TaskExtractor, type TaskSource } from './core/task-extractor';
export { MarkdownFormatter } from './templates/markdown';
export { JsonFormatter } from './templates/json';
export { ClaudeFormatter } from './templates/claude';
export { GptFormatter } from './templates/gpt';

export type {
  DexOptions,
  DepthLevel,
  OutputFormat,
  GitChange,
  ExtractedContext,
  TaskContext,
  SymbolMap,
  FormatterOptions,
} from './types';