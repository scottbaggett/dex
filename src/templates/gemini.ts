import { Formatter as FormatterInterface, FormatterOptions } from '../types';
import { Formatter } from '../core/formatter';
import { PromptGenerator } from '../core/prompts';

export class GeminiFormatter extends Formatter implements FormatterInterface {
  format({ context, options }: { context: any; options: any }): string {
    const sections: string[] = [];

    // Add task context at the end (end-loaded for Gemini's long context preference)
    const taskSection = options.task
      ? `# Task Context
${options.task}

`
      : '';

    // Start with metadata
    sections.push(`# Code Context

## Metadata
- **Generated:** ${context.metadata.generated}
- **Repository:** ${context.metadata.repository.name} (${context.metadata.repository.branch})
- **Commit:** ${context.metadata.repository.commit}
- **Extraction Depth:** ${context.metadata.extraction.depth}
- **Estimated Tokens:** ~${context.metadata.tokens.estimated.toLocaleString()}
- **dex Version:** ${context.metadata.tool.version}

## Scope
- **Files Changed:** ${context.scope.filesChanged}
- **Lines:** +${context.scope.linesAdded} -${context.scope.linesDeleted}
`);

    // Add changes with clear structure for Gemini
    sections.push('## Changes\n');
    
    for (const change of context.changes) {
      sections.push(`### ${change.file}`);
      
      if (context.fullFiles?.has(change.file)) {
        const ext = change.file.split('.').pop() || '';
        const lang = this.getLanguageFromExtension(ext);
        sections.push('```' + lang);
        sections.push(context.fullFiles.get(change.file)!);
        sections.push('```\n');
      } else {
        sections.push('```diff');
        sections.push(change.diff);
        sections.push('```\n');
      }
    }

    // Add task at the end for Gemini's preference
    if (taskSection) {
      sections.push(taskSection);
    }

    // Add contextual prompt unless disabled
    if (!options.noPrompt) {
      sections.push('## Analysis Request\n');
      sections.push(PromptGenerator.generate(context, options));
      
      // Add few-shot example for Gemini
      sections.push('\nExample response format:');
      sections.push('- **Summary:** Brief overview of changes');
      sections.push('- **Issues Found:** List of potential problems');
      sections.push('- **Suggestions:** Recommendations for improvement');
      sections.push('- **Security Notes:** Any security considerations');
    }

    return sections.join('\n');
  }
}