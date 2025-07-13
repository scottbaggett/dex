import { Formatter as FormatterInterface } from '../types';
import { Formatter } from '../core/formatter';

export class MistralFormatter extends Formatter implements FormatterInterface {
  format({ context, options }: { context: any; options: any }): string {
    const sections: string[] = [];

    // Mistral uses [INST] tags similar to Llama but with different structure
    sections.push('[INST]');
    
    // Concise system context
    sections.push('Analyze code changes. Focus on: bugs, performance, security, best practices.');
    
    if (options.task) {
      sections.push(`Task: ${options.task}`);
    }
    
    // Minimal metadata for efficiency
    sections.push(`\nContext: ${context.metadata.repository.name}@${context.metadata.repository.commit.substring(0, 7)} | ${context.scope.filesChanged} files | +${context.scope.linesAdded}/-${context.scope.linesDeleted}`);
    
    sections.push('\nChanges:');
    sections.push('[/INST]\n');
    
    // Add changes with minimal formatting
    for (const change of context.changes) {
      sections.push(`[FILE] ${change.file}`);
      
      if (context.fullFiles?.has(change.file)) {
        const ext = this.getFileExtension(change.file);
        const lang = this.getLanguageFromExtension(ext);
        sections.push('```' + lang);
        sections.push(context.fullFiles.get(change.file)!);
        sections.push('```');
      } else {
        sections.push('```diff');
        sections.push(change.diff);
        sections.push('```');
      }
      sections.push('');
    }
    
    // Concise instruction for output
    sections.push('[INST]');
    sections.push('Output format: JSON with keys: summary, issues[], improvements[], security[]');
    sections.push('[/INST]');

    return sections.join('\n');
  }
}