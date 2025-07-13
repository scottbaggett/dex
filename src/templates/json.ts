import { Formatter } from '../core/formatter';
import { FormatterOptions } from '../types';

export class JsonFormatter extends Formatter {
  format({ context, options }: FormatterOptions): string {
    const output: any = {
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