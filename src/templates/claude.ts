import { Formatter } from '../core/formatter';
import { FormatterOptions } from '../types';

export class ClaudeFormatter extends Formatter {
  format({ context, options }: FormatterOptions): string {
    const sections: string[] = [];

    // Context header with XML-like structure for Claude
    sections.push('<context>');
    
    // Metadata (unless excluded)
    if (!options.noMetadata) {
      sections.push('<metadata>');
      sections.push(`  <generated>${this.escapeXml(context.metadata.generated)}</generated>`);
      sections.push(`  <repository name="${this.escapeXml(context.metadata.repository.name)}" branch="${this.escapeXml(context.metadata.repository.branch)}" commit="${this.escapeXml(context.metadata.repository.commit)}" />`);
      sections.push(`  <extraction depth="${this.escapeXml(context.metadata.extraction.depth)}" />`);
      sections.push(`  <tokens estimated="${context.metadata.tokens.estimated}" />`);
      sections.push(`  <tool name="${this.escapeXml(context.metadata.tool.name)}" version="${this.escapeXml(context.metadata.tool.version)}" />`);
      sections.push('</metadata>');
    }
    
    // Task information
    if (context.task) {
      sections.push('<task>');
      sections.push(`<description>${this.escapeXml(context.task.description)}</description>`);
      if (context.task.goals) {
        sections.push('<goals>');
        context.task.goals.forEach(goal => {
          sections.push(`  <goal>${this.escapeXml(goal)}</goal>`);
        });
        sections.push('</goals>');
      }
      if (context.task.issueUrl) {
        sections.push(`<issue url="${this.escapeXml(context.task.issueUrl)}">${this.escapeXml(context.task.issueTitle || '')}</issue>`);
      }
      sections.push('</task>');
    }

    // Scope information
    sections.push('<scope>');
    sections.push(`  <files_changed>${context.scope.filesChanged}</files_changed>`);
    sections.push(`  <lines_added>${context.scope.linesAdded}</lines_added>`);
    sections.push(`  <lines_deleted>${context.scope.linesDeleted}</lines_deleted>`);
    sections.push('</scope>');

    // Changes
    sections.push('<changes>');
    for (const change of context.changes) {
      sections.push(`  <file path="${this.escapeXml(change.file)}" status="${change.status}">`);
      
      if (change.oldFile) {
        sections.push(`    <renamed_from>${this.escapeXml(change.oldFile)}</renamed_from>`);
      }
      
      sections.push(`    <stats additions="${change.additions}" deletions="${change.deletions}" />`);
      
      // Include full content if available
      if (context.fullFiles?.has(change.file)) {
        sections.push('    <content>');
        sections.push(this.escapeXml(context.fullFiles.get(change.file)!));
        sections.push('    </content>');
      } else if (change.diff) {
        sections.push('    <diff>');
        sections.push(this.escapeXml(change.diff));
        sections.push('    </diff>');
      }
      
      sections.push('  </file>');
    }
    sections.push('</changes>');

    // AI instructions
    sections.push('<instructions>');
    sections.push('Please analyze these code changes considering:');
    sections.push('1. Correctness and functionality');
    sections.push('2. Best practices and code quality');
    sections.push('3. Potential bugs or edge cases');
    sections.push('4. Performance implications');
    sections.push('5. Security considerations');
    if (context.task) {
      sections.push(`6. Alignment with the task: "${this.escapeXml(context.task.description)}"`);
    }
    sections.push('</instructions>');

    sections.push('</context>');

    return sections.join('\n');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}