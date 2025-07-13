import { Formatter } from '../core/formatter';
import { FormatterOptions } from '../types';

export class GptFormatter extends Formatter {
  format({ context, options }: FormatterOptions): string {
    const sections: string[] = [];

    // System-like context for GPT
    sections.push('## Code Review Context\n');

    // Metadata section (unless excluded)
    if (!options.noMetadata) {
      sections.push('**Metadata:**');
      sections.push(`- Generated: ${context.metadata.generated}`);
      sections.push(`- Repository: ${context.metadata.repository.name} (${context.metadata.repository.branch}@${context.metadata.repository.commit})`);
      sections.push(`- Extraction Depth: ${context.metadata.extraction.depth}`);
      sections.push(`- Estimated Tokens: ~${context.metadata.tokens.estimated.toLocaleString()}`);
      sections.push(`- Tool: ${context.metadata.tool.name} v${context.metadata.tool.version}\n`);
    }

    // Task context
    if (context.task) {
      sections.push('**Task Description:**');
      sections.push(context.task.description);
      
      if (context.task.goals && context.task.goals.length > 0) {
        sections.push('\n**Goals:**');
        context.task.goals.forEach(goal => sections.push(`- ${goal}`));
      }
      
      if (context.task.issueUrl) {
        sections.push(`\n**Related Issue:** ${context.task.issueTitle || context.task.issueUrl}`);
      }
      
      sections.push('');
    }

    // Summary
    sections.push('**Change Summary:**');
    sections.push(`- Files modified: ${context.scope.filesChanged}`);
    sections.push(`- Lines added: ${context.scope.linesAdded}`);
    sections.push(`- Lines removed: ${context.scope.linesDeleted}`);
    sections.push('');

    // Files changed
    sections.push('**Files Changed:**');
    context.changes.forEach(change => {
      const status = change.status === 'renamed' 
        ? `renamed from ${change.oldFile}` 
        : change.status;
      sections.push(`- ${change.file} (${status})`);
    });
    sections.push('');

    // Detailed changes
    sections.push('## Detailed Changes\n');
    
    for (const change of context.changes) {
      sections.push(`### File: ${change.file}`);
      
      if (change.status === 'renamed') {
        sections.push(`*Renamed from: ${change.oldFile}*\n`);
      }
      
      // Show full content or diff
      if (context.fullFiles?.has(change.file)) {
        const ext = this.getFileExtension(change.file);
        const lang = this.getLanguageFromExtension(ext);
        sections.push(`\`\`\`${lang}`);
        sections.push(context.fullFiles.get(change.file)!);
        sections.push('```');
      } else if (change.diff) {
        sections.push('```diff');
        sections.push(this.formatDiff(change.diff));
        sections.push('```');
      }
      
      sections.push('');
    }

    // Review instructions
    sections.push('## Review Guidelines\n');
    sections.push('Please review the above changes and provide feedback on:');
    sections.push('1. **Code Quality**: Are there any improvements to code structure or readability?');
    sections.push('2. **Logic Errors**: Are there any bugs or logical issues?');
    sections.push('3. **Best Practices**: Does the code follow language-specific best practices?');
    sections.push('4. **Performance**: Are there any performance concerns?');
    sections.push('5. **Security**: Are there any security vulnerabilities?');
    
    if (context.task) {
      sections.push(`6. **Task Alignment**: Do these changes properly address "${context.task.description}"?`);
    }

    return sections.join('\n');
  }
}