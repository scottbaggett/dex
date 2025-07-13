import { Formatter } from '../types';

export class LlamaFormatter implements Formatter {
  format({ context, options }: { context: any; options: any }): string {
    const sections: string[] = [];

    // Llama uses <s>[INST] tags for instruction separation
    sections.push('<s>[INST]');
    
    // System instruction
    sections.push('You are a helpful code review assistant. Analyze the following code changes and provide feedback on quality, potential issues, and improvements.');
    
    if (options.task) {
      sections.push(`\nTask Context: ${options.task}`);
    }
    
    sections.push('\nCode Context:');
    
    // Metadata in concise format for Llama
    sections.push(`Repository: ${context.metadata.repository.name} (${context.metadata.repository.branch})
Commit: ${context.metadata.repository.commit}
Files Changed: ${context.scope.filesChanged}
Lines: +${context.scope.linesAdded} -${context.scope.linesDeleted}
Tokens: ~${context.metadata.tokens.estimated}`);
    
    sections.push('\nChanges:');
    sections.push('[/INST]</s>');
    
    // Add the actual changes
    for (const change of context.changes) {
      sections.push(`\n<s>File: ${change.path}</s>`);
      
      if (change.type === 'full') {
        sections.push('```' + change.language);
        sections.push(change.content);
        sections.push('```');
      } else {
        sections.push('```diff');
        sections.push(change.diff);
        sections.push('```');
      }
    }
    
    // Add instruction for response format
    sections.push('\n<s>[INST]');
    sections.push(`Please provide:
1. A brief summary of the changes
2. Any potential issues or bugs
3. Suggestions for improvement
4. Code quality assessment`);
    sections.push('[/INST]</s>');

    return sections.join('\n');
  }
}