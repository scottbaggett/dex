import { Formatter } from '../types';

export class MistralFormatter implements Formatter {
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
      sections.push(`[FILE] ${change.path}`);
      
      if (change.type === 'full') {
        sections.push('```' + change.language);
        sections.push(change.content);
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