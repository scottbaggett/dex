import { Formatter } from '../core/formatter';
import { FormatterOptions, ExtractedContext, TaskContext, Metadata } from '../types';
import { PromptGenerator } from '../core/prompts';

export class XmlFormatter extends Formatter {
  format({ context, options }: FormatterOptions): string {
    const sections: string[] = [];

    // XML declaration
    sections.push('<?xml version="1.0" encoding="UTF-8"?>');
    sections.push('<code_context>');

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

    // Add AI prompt unless disabled
    if (!options.noPrompt) {
      sections.push('  <ai_analysis_request>');
      sections.push(this.escapeXml(PromptGenerator.generate(context, options)));
      sections.push('  </ai_analysis_request>');
    }

    sections.push('</code_context>');

    return sections.join('\n');
  }

  private formatHeader(context: ExtractedContext, _options: FormatterOptions['options']): string {
    const title = context.task?.description 
      ? `Context: ${context.task.description}`
      : 'Code Context';
    
    return `  <title>${this.escapeXml(title)}</title>`;
  }

  private formatMetadata(metadata: Metadata): string {
    const lines = ['  <metadata>'];
    lines.push(`    <generated>${this.escapeXml(metadata.generated)}</generated>`);
    lines.push(`    <repository>`);
    lines.push(`      <name>${this.escapeXml(metadata.repository.name)}</name>`);
    lines.push(`      <branch>${this.escapeXml(metadata.repository.branch)}</branch>`);
    lines.push(`      <commit>${this.escapeXml(metadata.repository.commit)}</commit>`);
    lines.push(`    </repository>`);
    lines.push(`    <extraction>`);
    lines.push(`      <depth>${this.escapeXml(metadata.extraction.depth)}</depth>`);
    
    if (metadata.extraction.filters?.path || metadata.extraction.filters?.type) {
      lines.push(`      <filters>`);
      if (metadata.extraction.filters.path) {
        lines.push(`        <path>${this.escapeXml(metadata.extraction.filters.path)}</path>`);
      }
      if (metadata.extraction.filters.type?.length) {
        lines.push(`        <types>${this.escapeXml(metadata.extraction.filters.type.join(', '))}</types>`);
      }
      lines.push(`      </filters>`);
    }
    
    lines.push(`    </extraction>`);
    lines.push(`    <tokens>`);
    lines.push(`      <estimated>${metadata.tokens.estimated}</estimated>`);
    lines.push(`    </tokens>`);
    lines.push(`    <tool>`);
    lines.push(`      <name>${this.escapeXml(metadata.tool.name)}</name>`);
    lines.push(`      <version>${this.escapeXml(metadata.tool.version)}</version>`);
    lines.push(`    </tool>`);
    lines.push(`  </metadata>`);
    
    return lines.join('\n');
  }

  private formatTaskSection(task: TaskContext): string {
    const lines = ['  <task_overview>'];
    
    if (task.description) {
      lines.push(`    <description>${this.escapeXml(task.description)}</description>`);
    }
    
    if (task.goals && task.goals.length > 0) {
      lines.push(`    <goals>`);
      for (const goal of task.goals) {
        lines.push(`      <goal>${this.escapeXml(goal)}</goal>`);
      }
      lines.push(`    </goals>`);
    }
    
    if (task.issueUrl) {
      lines.push(`    <issue>`);
      lines.push(`      <url>${this.escapeXml(task.issueUrl)}</url>`);
      if (task.issueTitle) {
        lines.push(`      <title>${this.escapeXml(task.issueTitle)}</title>`);
      }
      if (task.issueBody) {
        lines.push(`      <body>${this.escapeXml(task.issueBody)}</body>`);
      }
      lines.push(`    </issue>`);
    }
    
    if (task.labels && task.labels.length > 0) {
      lines.push(`    <labels>`);
      for (const label of task.labels) {
        lines.push(`      <label>${this.escapeXml(label)}</label>`);
      }
      lines.push(`    </labels>`);
    }

    lines.push(`  </task_overview>`);

    return lines.join('\n');
  }

  private formatScope(scope: ExtractedContext['scope']): string {
    return `  <scope>
    <files_changed>${scope.filesChanged}</files_changed>
    <lines_added>${scope.linesAdded}</lines_added>
    <lines_deleted>${scope.linesDeleted}</lines_deleted>
    <functions_modified>${scope.functionsModified}</functions_modified>
  </scope>`;
  }

  private formatChanges(context: ExtractedContext, _options: FormatterOptions['options']): string {
    const lines = ['  <changes>'];

    for (const change of context.changes) {
      lines.push(`    <file>`);
      lines.push(`      <path>${this.escapeXml(change.file)}</path>`);
      lines.push(`      <status>${this.escapeXml(change.status)}</status>`);
      lines.push(`      <additions>${change.additions}</additions>`);
      lines.push(`      <deletions>${change.deletions}</deletions>`);
      
      if (change.oldFile) {
        lines.push(`      <old_path>${this.escapeXml(change.oldFile)}</old_path>`);
      }
      
      // Include full file if available
      if (context.fullFiles?.has(change.file)) {
        const content = context.fullFiles.get(change.file);
        const ext = this.getFileExtension(change.file);
        const lang = this.getLanguageFromExtension(ext);
        
        lines.push(`      <content language="${this.escapeXml(lang)}">`);
        lines.push(`<![CDATA[${content}]]>`);
        lines.push(`      </content>`);
      } else if (change.diff) {
        // Show diff
        lines.push(`      <diff>`);
        lines.push(`<![CDATA[${this.formatDiff(change.diff)}]]>`);
        lines.push(`      </diff>`);
      }
      
      lines.push(`    </file>`);
    }

    lines.push(`  </changes>`);
    return lines.join('\n');
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}