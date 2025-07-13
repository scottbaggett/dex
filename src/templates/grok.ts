import { Formatter as FormatterInterface } from '../types';
import { Formatter } from '../core/formatter';

export class GrokFormatter extends Formatter implements FormatterInterface {
  format({ context, options }: { context: any; options: any }): string {
    const output = {
      system_prompt:
        'You are Grok, a helpful AI built by xAI. Analyze the provided code changes and return structured feedback. Use markdown in descriptions and substantiate with code references.', // Refined: Add role and style guidance

      context: {
        metadata: { ...context.metadata }, // Unchanged, solid
        scope: { ...context.scope },
        task: options.task || null,
      },

      changes: context.changes.map((change: any) => ({
        path: change.file,
        type: change.status,
        language: this.getLanguageFromExtension(this.getFileExtension(change.file)),
        content: context.fullFiles?.has(change.file)
          ? context.fullFiles.get(change.file)
          : change.diff,
      })),

      expected_output_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief overview of the changes' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                file: { type: 'string' },
                line: { type: 'number' },
                description: { type: 'string' },
              },
              // Added: Example for few-shot guidance
              examples: [
                {
                  severity: 'medium',
                  file: 'auth.ts',
                  line: 42,
                  description: 'Potential null dereference; add check.',
                },
              ],
            },
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                suggestion: { type: 'string' },
              },
            },
          },
          security_notes: { type: 'array', items: { type: 'string' } },
          // Added: Optional fields for richer responses
          overall_score: { type: 'number', description: 'Score 0-10 on change quality' },
          fixes: {
            type: 'array',
            items: { type: 'object', properties: { file: 'string', patch: 'string' } },
          },
        },
        required: ['summary', 'issues', 'suggestions'],
      },

      constraints: {
        max_response_tokens: 2000,
        response_format: 'json', // Added: Explicitly request JSON mode for parsing
      },
    };

    return JSON.stringify(output, null, 2);
  }
}
