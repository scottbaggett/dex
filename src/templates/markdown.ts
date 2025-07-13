import { Formatter } from '../core/formatter';
import { FormatterOptions, ExtractedContext, TaskContext, Metadata } from '../types';

export class MarkdownFormatter extends Formatter {
  format({ context, options }: FormatterOptions): string {
    const sections: string[] = [];

    // Header
    sections.push(this.formatHeader(context, options));

    // Metadata (unless excluded)
    if (!options.noMetadata) {
      sections.push(this.formatMetadata(context.metadata));
    }

    // Task context if present
    if (context.task) {
      sections.push(this.formatTaskSection(context.task));
    }

    // Scope summary
    sections.push(this.formatScope(context.scope));

    // Changes section
    if (context.changes.length > 0) {
      sections.push(this.formatChanges(context, options));
    }

    // Impact analysis (placeholder for future AST analysis)
    if (options.bootstrap || options.context === 'extended') {
      sections.push(this.formatImpactAnalysis());
    }

    return sections.join('\n\n');
  }

  private formatHeader(context: ExtractedContext, _options: FormatterOptions['options']): string {
    const title = context.task?.description 
      ? `Context: ${context.task.description}`
      : 'Code Context';
    
    return `# ${title}`;
  }

  private formatMetadata(metadata: Metadata): string {
    const lines = ['## Metadata'];
    lines.push(`- **Generated:** ${metadata.generated}`);
    lines.push(`- **Repository:** ${metadata.repository.name} (${metadata.repository.branch})`);
    lines.push(`- **Commit:** ${metadata.repository.commit}`);
    lines.push(`- **Context Level:** ${metadata.extraction.context}`);
    
    if (metadata.extraction.filters?.path || metadata.extraction.filters?.type) {
      lines.push('- **Filters:**');
      if (metadata.extraction.filters.path) {
        lines.push(`  - Path: ${metadata.extraction.filters.path}`);
      }
      if (metadata.extraction.filters.type?.length) {
        lines.push(`  - Types: ${metadata.extraction.filters.type.join(', ')}`);
      }
    }
    
    lines.push(`- **Estimated Tokens:** ~${metadata.tokens.estimated.toLocaleString()}`);
    lines.push(`- **dex Version:** ${metadata.tool.version}`);
    
    return lines.join('\n');
  }

  private formatTaskSection(task: TaskContext): string {
    const lines = ['## Task Overview'];
    
    if (task.description) {
      lines.push(`- **Description:** ${task.description}`);
    }
    
    if (task.goals && task.goals.length > 0) {
      lines.push(`- **Goals:** ${task.goals.join(', ')}`);
    }
    
    if (task.issueUrl) {
      lines.push(`- **Issue:** [${task.issueTitle || task.issueUrl}](${task.issueUrl})`);
    }
    
    if (task.labels && task.labels.length > 0) {
      lines.push(`- **Labels:** ${task.labels.join(', ')}`);
    }

    // AI prompt section
    lines.push('- **AI Prompt:** Review these changes for correctness, best practices, and potential issues.');

    return lines.join('\n');
  }

  private formatScope(scope: ExtractedContext['scope']): string {
    return `## Scope
- **Files Changed:** ${scope.filesChanged}
- **Lines:** +${scope.linesAdded} -${scope.linesDeleted}`;
  }

  private formatChanges(context: ExtractedContext, _options: FormatterOptions['options']): string {
    const lines = ['## Changes'];

    for (const change of context.changes) {
      lines.push('');
      lines.push(`### ${change.file}${change.status === 'renamed' ? ` (renamed from ${change.oldFile})` : ''}`);
      
      // Include full file if available
      if (context.fullFiles?.has(change.file)) {
        const content = context.fullFiles.get(change.file);
        const ext = this.getFileExtension(change.file);
        const lang = this.getLanguageFromExtension(ext);
        
        lines.push(`\`\`\`${lang}`);
        lines.push(content!);
        lines.push('```');
      } else if (change.diff) {
        // Show diff
        lines.push('```diff');
        lines.push(this.formatDiff(change.diff));
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  private formatImpactAnalysis(): string {
    return `## Impact Analysis
- **Breaking Changes:** None detected
- **Performance:** No significant impact
- **Security:** No security implications identified
- **Dependencies:** No new dependencies`;
  }
}