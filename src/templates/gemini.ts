import { Formatter } from '../types';

export class GeminiFormatter implements Formatter {
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
      sections.push(`### ${change.path}`);
      
      if (change.type === 'full') {
        sections.push('```' + change.language);
        sections.push(change.content);
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

    // Add few-shot example prompt for better Gemini performance
    sections.push(`## Analysis Request

Please analyze the above code changes. Consider:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance implications
4. Security considerations
5. Suggestions for improvement

Example response format:
- **Summary:** Brief overview of changes
- **Issues Found:** List of potential problems
- **Suggestions:** Recommendations for improvement
- **Security Notes:** Any security considerations
`);

    return sections.join('\n');
  }
}