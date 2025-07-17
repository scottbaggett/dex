import { ExtractedContext, DexOptions } from '../types';
import { PromptLoader } from './prompt-loader';

export interface PromptContext {
  task?: string;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  fileTypes: Set<string>;
  hasTests: boolean;
  hasConfig: boolean;
  hasDocs: boolean;
  primaryLanguage: string;
}

export class PromptGenerator {
  private static analyzeContext(context: ExtractedContext): PromptContext {
    const fileTypes = new Set<string>();
    let hasTests = false;
    let hasConfig = false;
    let hasDocs = false;
    
    // Analyze file types and patterns
    for (const change of context.changes) {
      // Handle both file and path properties for compatibility
      const filePath = (change as any).path || change.file;
      const ext = filePath.split('.').pop() || '';
      fileTypes.add(ext);
      
      const pathLower = filePath.toLowerCase();
      if (pathLower.includes('test') || pathLower.includes('spec')) hasTests = true;
      if (pathLower.includes('config') || pathLower.includes('.env') || pathLower.includes('settings')) hasConfig = true;
      if (pathLower.includes('readme') || pathLower.includes('docs') || ext === 'md') hasDocs = true;
    }
    
    // Determine primary language
    const langPriority = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c'];
    let primaryLanguage = 'unknown';
    for (const lang of langPriority) {
      if (fileTypes.has(lang)) {
        primaryLanguage = lang;
        break;
      }
    }
    
    return {
      task: context.task?.description,
      filesChanged: context.scope.filesChanged,
      linesAdded: context.scope.linesAdded,
      linesDeleted: context.scope.linesDeleted,
      fileTypes,
      hasTests,
      hasConfig,
      hasDocs,
      primaryLanguage
    };
  }
  
  static generate(context: ExtractedContext, options: DexOptions): string {
    const analysis = this.analyzeContext(context);
    const promptLoader = PromptLoader.getInstance();
    
    // If custom prompt provided, use it
    if (options.prompt) {
      return options.prompt;
    }
    
    // If prompt template requested, use it
    if (options.promptTemplate) {
      const template = promptLoader.getPrompt(options.promptTemplate);
      if (template) {
        let instructions = template.instructions;
        
        // Interpolate variables if provided
        if (template.variables) {
          const variables = {
            ...template.variables,
            task: analysis.task || '',
            file_count: String(analysis.filesChanged),
            primary_language: analysis.primaryLanguage
          };
          instructions = promptLoader.interpolateVariables(instructions, variables);
        }
        
        return instructions;
      }
      
      // Fall back to old system if template not found
      console.warn(`Prompt template '${options.promptTemplate}' not found, using default`);
      return this.getPromptByName(options.promptTemplate, analysis);
    }
    
    // Auto-suggest prompts if in interactive mode
    if (options.interactive && !options.noPrompt) {
      const suggestions = promptLoader.suggestPrompts({
        format: options.format,
        task: analysis.task,
        fileTypes: analysis.fileTypes
      });
      
      if (suggestions.length > 0) {
        // In a real implementation, this would be shown in interactive UI
        // For now, we'll just use the top suggestion
        const topSuggestion = suggestions[0];
        console.log(`💡 Suggested prompt template: ${topSuggestion.name}`);
      }
    }
    
    // Generate contextual prompt based on what changed
    return this.generateContextualPrompt(analysis, options);
  }
  
  private static generateContextualPrompt(analysis: PromptContext, options: DexOptions): string {
    const parts: string[] = [];
    
    // If task provided, make it the primary focus
    if (analysis.task) {
      parts.push(`Review these changes in the context of: "${analysis.task}"`);
      parts.push('');
      parts.push('Please analyze:');
      parts.push('1. Whether the changes properly address the task');
      parts.push('2. Any missing implementations or edge cases');
      parts.push('3. Potential side effects or breaking changes');
    } else {
      // No task - infer intent from changes
      const changeSize = analysis.linesAdded + analysis.linesDeleted;
      
      if (changeSize < 50) {
        parts.push('Review this focused change for:');
      } else if (changeSize < 200) {
        parts.push('Review these changes for:');
      } else {
        parts.push('Review this substantial changeset for:');
      }
      
      parts.push('');
      
      // Contextual analysis points
      if (analysis.hasTests) {
        parts.push('- Test coverage and quality');
        parts.push('- Whether tests properly validate the implementation');
      }
      
      if (analysis.hasConfig) {
        parts.push('- Configuration changes and their impact');
        parts.push('- Environment compatibility');
      }
      
      if (analysis.hasDocs) {
        parts.push('- Documentation accuracy and completeness');
        parts.push('- Whether docs match the implementation');
      }
      
      // Language-specific concerns
      const langConcerns = this.getLanguageSpecificConcerns(analysis.primaryLanguage);
      if (langConcerns.length > 0) {
        parts.push('');
        parts.push(`${this.getLanguageName(analysis.primaryLanguage)}-specific considerations:`);
        langConcerns.forEach(concern => parts.push(`- ${concern}`));
      }
      
      // Always include these core concerns
      parts.push('');
      parts.push('Core review points:');
      parts.push('- Code correctness and logic errors');
      parts.push('- Security vulnerabilities');
      parts.push('- Performance implications');
      parts.push('- Code style and best practices');
    }
    
    // Add output format hint for JSON
    if (options.format === 'json') {
      parts.push('');
      parts.push('Provide structured JSON output with: summary, issues[], suggestions[]');
    }
    
    return parts.join('\\n');
  }
  
  private static getLanguageSpecificConcerns(language: string): string[] {
    const concerns: Record<string, string[]> = {
      ts: [
        'Type safety and any usage',
        'Null/undefined handling',
        'Async/await error handling'
      ],
      tsx: [
        'React hooks dependencies',
        'Component re-rendering performance',
        'Props validation'
      ],
      js: [
        'Type coercion issues',
        'Async error handling',
        'ES6+ feature compatibility'
      ],
      py: [
        'Type hints accuracy',
        'Exception handling',
        'Python idioms and PEP compliance'
      ],
      go: [
        'Error handling patterns',
        'Goroutine safety',
        'Interface design'
      ],
      rs: [
        'Memory safety',
        'Error handling with Result<T,E>',
        'Lifetime correctness'
      ],
      java: [
        'Null pointer safety',
        'Thread safety',
        'Resource management'
      ]
    };
    
    return concerns[language] || [];
  }
  
  private static getLanguageName(ext: string): string {
    const names: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'React/TypeScript',
      js: 'JavaScript',
      jsx: 'React/JavaScript',
      py: 'Python',
      go: 'Go',
      rs: 'Rust',
      java: 'Java',
      cpp: 'C++',
      c: 'C'
    };
    return names[ext] || 'Programming language';
  }
  
  private static getPromptByName(promptName: string, analysis: PromptContext): string {
    const prompts: Record<string, string> = {
      'security': `Perform a security audit of these changes. Focus on:
- Authentication/authorization vulnerabilities
- Input validation and sanitization
- SQL injection, XSS, CSRF risks
- Sensitive data exposure
- Dependency vulnerabilities
- Cryptographic weaknesses
Provide specific vulnerabilities found with severity ratings.`,

      'performance': `Analyze performance implications of these changes:
- Time complexity of algorithms
- Memory usage and leaks
- Database query optimization
- Caching opportunities
- Network request optimization
- UI rendering performance
Suggest specific optimizations with expected impact.`,

      'refactor': `Review this refactoring for:
- Whether behavior is preserved
- Code clarity improvements
- SOLID principles adherence
- Reduced complexity metrics
- Test coverage maintenance
- Breaking change risks
Rate the refactoring success and suggest improvements.`,

      'feature': `Review this feature implementation:
- Completeness against requirements
- Edge cases handling
- Error scenarios
- User experience considerations
- Integration points
- Documentation needs
Identify any gaps in the implementation.`,

      'bugfix': `Verify this bug fix:
- Root cause properly addressed
- No regression risks
- Edge cases covered
- Tests added for the bug
- Related issues that might exist
Confirm the fix is complete and safe.`,

      'migration': `Review this migration/upgrade:
- Breaking changes identified
- Backwards compatibility
- Data migration safety
- Rollback procedures
- Performance impact
- Required documentation updates
Assess migration risk level.`,

      'api': `Review API changes for:
- Contract compatibility
- Versioning approach
- Error response formats
- Authentication/authorization
- Rate limiting needs
- Documentation completeness
Ensure API best practices are followed.`,

      'testing': `Evaluate test quality:
- Coverage of happy paths
- Edge case testing
- Error condition testing
- Test isolation and speed
- Mock/stub appropriateness
- Assertion quality
Suggest missing test scenarios.`
    };
    
    return prompts[promptName] || this.generateContextualPrompt(analysis, { format: 'markdown' });
  }
}