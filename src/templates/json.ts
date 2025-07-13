import { Formatter } from '../core/formatter';
import { FormatterOptions, TaskContext, ExtractedContext } from '../types';

interface JsonOutput {
  task?: TaskContext;
  scope: ExtractedContext['scope'];
  changes: Array<{
    file: string;
    status: string;
    additions: number;
    deletions: number;
    oldFile?: string;
    diff?: string;
    fullContent?: string;
  }>;
  metadata?: ExtractedContext['metadata'];
}

export class JsonFormatter extends Formatter {
  format({ context, options }: FormatterOptions): string {
    const output: JsonOutput = {
      task: context.task,
      scope: context.scope,
      changes: context.changes.map(change => ({
        file: change.file,
        status: change.status,
        additions: change.additions,
        deletions: change.deletions,
        oldFile: change.oldFile,
        diff: change.diff,
        fullContent: context.fullFiles?.get(change.file),
      })),
    };

    // Include metadata unless excluded
    if (!options.noMetadata) {
      output.metadata = context.metadata;
    }

    return JSON.stringify(output, null, 2);
  }
}