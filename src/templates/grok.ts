import { Formatter as FormatterInterface } from '../types';
import { Formatter } from '../core/formatter';

export class GrokFormatter extends Formatter implements FormatterInterface {
  format({ context, options }: { context: any; options: any }): string {
    // Grok prefers JSON schemas for structured output
    const output = {
      system_prompt: "You are a code review assistant. Analyze the provided code changes and return structured feedback.",
      
      context: {
        metadata: {
          generated: context.metadata.generated,
          repository: context.metadata.repository,
          extraction_depth: context.metadata.extraction.depth,
          estimated_tokens: context.metadata.tokens.estimated,
          tool_version: context.metadata.tool.version
        },
        
        scope: {
          files_changed: context.scope.filesChanged,
          lines_added: context.scope.linesAdded,
          lines_deleted: context.scope.linesDeleted
        },
        
        task: options.task || null
      },
      
      changes: context.changes.map((change: any) => ({
        path: change.file,
        type: change.status,
        language: this.getLanguageFromExtension(this.getFileExtension(change.file)),
        content: context.fullFiles?.has(change.file) ? context.fullFiles.get(change.file) : change.diff
      })),
      
      expected_output_schema: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Brief overview of the changes"
          },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["low", "medium", "high"] },
                file: { type: "string" },
                line: { type: "number" },
                description: { type: "string" }
              }
            }
          },
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                file: { type: "string" },
                suggestion: { type: "string" }
              }
            }
          },
          security_notes: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["summary", "issues", "suggestions"]
      },
      
      constraints: {
        max_response_tokens: 2000,
        response_format: "json"
      }
    };

    return JSON.stringify(output, null, 2);
  }
}