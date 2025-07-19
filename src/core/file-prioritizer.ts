import { FileInfo } from '../utils/file-scanner';
import { FilePriority } from '../types/ai-context';
import { Distiller } from './distiller';
import { DistillerOptions } from '../types';
import { generateObject } from 'ai';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

/**
 * Interface for a prioritized file
 */
export interface PrioritizedFile extends FileInfo {
  priority: FilePriority;
  reason: string;
}

/**
 * Options for file prioritization
 */
export interface PrioritizeOptions {
  files: FileInfo[];
  prompt: string;
  provider: string;
  model: string;
  maxFiles?: number;
}

/**
 * Responsible for prioritizing files based on relevance to a task
 */
export class FilePrioritizer {
  // File type categories for heuristics
  private fileTypeCategories: Record<string, { priority: FilePriority; reason: string }> = {
    // Core files
    'readme.md': { priority: 'high', reason: 'Core documentation' },
    'package.json': { priority: 'high', reason: 'Project configuration' },
    'tsconfig.json': { priority: 'high', reason: 'TypeScript configuration' },
    'index.ts': { priority: 'high', reason: 'Main entry point' },
    'index.js': { priority: 'high', reason: 'Main entry point' },
    'main.ts': { priority: 'high', reason: 'Main entry point' },
    'main.js': { priority: 'high', reason: 'Main entry point' },
    'app.ts': { priority: 'high', reason: 'Main application file' },
    'app.js': { priority: 'high', reason: 'Main application file' },

    // Config files
    '.gitignore': { priority: 'low', reason: 'Git configuration' },
    '.eslintrc': { priority: 'low', reason: 'ESLint configuration' },
    '.prettierrc': { priority: 'low', reason: 'Prettier configuration' },
    '.dexrc': { priority: 'medium', reason: 'DEX configuration' },
    'jest.config.js': { priority: 'low', reason: 'Jest configuration' },
    'vitest.config.ts': { priority: 'low', reason: 'Vitest configuration' },
    'webpack.config.js': { priority: 'low', reason: 'Webpack configuration' },
    'vite.config.ts': { priority: 'low', reason: 'Vite configuration' },
  };

  // Directory name heuristics
  private directoryHeuristics: Record<string, { priority: FilePriority; reason: string }> = {
    src: { priority: 'medium', reason: 'Source code directory' },
    lib: { priority: 'medium', reason: 'Library code directory' },
    core: { priority: 'high', reason: 'Core functionality directory' },
    utils: { priority: 'medium', reason: 'Utility functions directory' },
    components: { priority: 'medium', reason: 'UI components directory' },
    test: { priority: 'low', reason: 'Test directory' },
    tests: { priority: 'low', reason: 'Test directory' },
    docs: { priority: 'low', reason: 'Documentation directory' },
    scripts: { priority: 'low', reason: 'Build scripts directory' },
    config: { priority: 'low', reason: 'Configuration directory' },
  };

  /**
   * Prioritize files based on their relevance to the prompt
   */
  async prioritize(options: PrioritizeOptions): Promise<PrioritizedFile[]> {
    const { files, prompt, provider, model, maxFiles = 20 } = options;

    // Step 1: Apply heuristics to get initial priorities
    const prioritizedFiles = await this.applyHeuristics(files, prompt);

    // Step 2: Analyze file relationships to refine priorities
    await this.analyzeFileRelationships(prioritizedFiles);

    // Step 3: If AI provider is available, use it to refine priorities
    try {
      const aiPrioritizedFiles = await this.callAIProvider(
        prioritizedFiles,
        prompt,
        provider,
        model,
        maxFiles
      );

      // Step 4: Sort by priority (high -> medium -> low)
      aiPrioritizedFiles.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Let AI decide how many files to return
      return aiPrioritizedFiles;
    } catch (error) {
      console.warn(
        `Warning: Could not use AI provider for prioritization: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fall back to heuristic-based prioritization
      prioritizedFiles.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      return prioritizedFiles;
    }
  }

  /**
   * Apply heuristics to prioritize files
   */
  private async applyHeuristics(files: FileInfo[], prompt: string): Promise<PrioritizedFile[]> {
    const promptLower = prompt.toLowerCase();
    const prioritizedFiles: PrioritizedFile[] = [];

    // Extract keywords from prompt
    const keywords = this.extractKeywords(promptLower);

    // File extension priority mappings
    const extensionPriorities: Record<string, { priority: FilePriority; reason: string }> = {
      // Source code files (medium priority by default)
      ts: { priority: 'medium', reason: 'TypeScript source file' },
      js: { priority: 'medium', reason: 'JavaScript source file' },
      tsx: { priority: 'medium', reason: 'React TypeScript component' },
      jsx: { priority: 'medium', reason: 'React JavaScript component' },
      vue: { priority: 'medium', reason: 'Vue component' },
      svelte: { priority: 'medium', reason: 'Svelte component' },
      py: { priority: 'medium', reason: 'Python source file' },
      java: { priority: 'medium', reason: 'Java source file' },
      go: { priority: 'medium', reason: 'Go source file' },
      rb: { priority: 'medium', reason: 'Ruby source file' },
      php: { priority: 'medium', reason: 'PHP source file' },
      cs: { priority: 'medium', reason: 'C# source file' },

      // Config files (low priority by default)
      json: { priority: 'low', reason: 'JSON configuration file' },
      yml: { priority: 'low', reason: 'YAML configuration file' },
      yaml: { priority: 'low', reason: 'YAML configuration file' },
      toml: { priority: 'low', reason: 'TOML configuration file' },
      ini: { priority: 'low', reason: 'INI configuration file' },

      // Documentation files (low priority by default)
      md: { priority: 'low', reason: 'Markdown documentation' },
      txt: { priority: 'low', reason: 'Text file' },

      // Style files (low priority by default)
      css: { priority: 'low', reason: 'CSS stylesheet' },
      scss: { priority: 'low', reason: 'SCSS stylesheet' },
      less: { priority: 'low', reason: 'LESS stylesheet' },
      sass: { priority: 'low', reason: 'Sass stylesheet' },
    };

    for (const file of files) {
      const fileName = path.basename(file.relativePath);
      const fileNameLower = fileName.toLowerCase();
      const filePathLower = file.relativePath.toLowerCase();
      const extension = path.extname(fileName).slice(1).toLowerCase();
      const directoryPath = path.dirname(file.relativePath);
      const directoryName = path.basename(directoryPath).toLowerCase();

      let priority: FilePriority = 'low';
      let reason = '';

      // Check for specific known files
      if (this.fileTypeCategories[fileNameLower]) {
        priority = this.fileTypeCategories[fileNameLower].priority;
        reason = this.fileTypeCategories[fileNameLower].reason;
      }
      // Check for directory-based heuristics
      else if (this.directoryHeuristics[directoryName]) {
        priority = this.directoryHeuristics[directoryName].priority;
        reason = this.directoryHeuristics[directoryName].reason;
      }
      // Check for extension-based heuristics
      else if (extensionPriorities[extension]) {
        priority = extensionPriorities[extension].priority;
        reason = extensionPriorities[extension].reason;
      }
      // Check for keyword matches in filename or path
      else if (
        keywords.some(
          (keyword) => fileNameLower.includes(keyword) || filePathLower.includes(keyword)
        )
      ) {
        priority = 'high';
        reason = `Matches keywords in prompt`;
      }
      // Default to low priority
      else {
        priority = 'low';
        reason = `Other file type`;
      }

      // Boost priority for files that match keywords in prompt
      if (
        priority !== 'high' &&
        keywords.some(
          (keyword) => fileNameLower.includes(keyword) || filePathLower.includes(keyword)
        )
      ) {
        priority = priority === 'low' ? 'medium' : 'high';
        reason += ` (matches keywords in prompt)`;
      }

      prioritizedFiles.push({
        ...file,
        priority,
        reason,
      });
    }

    return prioritizedFiles;
  }

  /**
   * Extract meaningful keywords from a prompt
   */
  private extractKeywords(prompt: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'and',
      'or',
      'but',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'shall',
      'should',
      'may',
      'might',
      'must',
      'can',
      'could',
      'to',
      'for',
      'with',
      'about',
      'against',
      'between',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'from',
      'up',
      'down',
      'in',
      'out',
      'on',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'any',
      'both',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'that',
      'these',
      'this',
      'those',
      'which',
      'whose',
      'if',
      'else',
      'because',
      'as',
      'until',
      'while',
      'of',
      'at',
      'by',
      'i',
      'me',
      'my',
      'myself',
      'we',
      'our',
      'ours',
      'ourselves',
      'you',
      'your',
      'yours',
      'yourself',
      'yourselves',
      'he',
      'him',
      'his',
      'himself',
      'she',
      'her',
      'hers',
      'herself',
      'it',
      'its',
      'itself',
      'they',
      'them',
      'their',
      'theirs',
      'themselves',
      'what',
      'who',
      'whom',
      'want',
      'need',
      'like',
      'get',
      'make',
      'know',
      'think',
      'go',
      'just',
      'now',
      'also',
      'help',
      'understand',
      'implement',
      'create',
      'build',
      'develop',
      'code',
      'file',
      'files',
      'codebase',
      'project',
    ]);

    // Split prompt into words, filter out stop words and short words
    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Analyze file relationships to refine priorities
   */
  private async analyzeFileRelationships(files: PrioritizedFile[]): Promise<void> {
    // Create a map of files for quick lookup
    const fileMap = new Map<string, PrioritizedFile>();
    for (const file of files) {
      fileMap.set(file.relativePath, file);
    }

    // Analyze imports/requires to establish relationships
    for (const file of files) {
      // Skip non-source files
      const ext = path.extname(file.relativePath).toLowerCase();
      if (!['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        continue;
      }

      try {
        // Read file content
        const content = await fs.readFile(file.path, 'utf-8');

        // Extract imports
        const imports = this.extractImports(content);

        // Boost priority of imported files
        for (const importPath of imports) {
          // Resolve relative import path
          const resolvedPath = this.resolveImportPath(file.relativePath, importPath);
          if (!resolvedPath) continue;

          // Find the imported file
          const importedFile = fileMap.get(resolvedPath);
          if (importedFile && importedFile.priority === 'low') {
            // Boost priority of imported files
            importedFile.priority = 'medium';
            importedFile.reason += ' (imported by other files)';
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Extract import statements from file content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];

    // Match ES6 imports
    const es6ImportRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match CommonJS requires
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Resolve a relative import path to an absolute path
   */
  private resolveImportPath(filePath: string, importPath: string): string | null {
    // Skip package imports
    if (!importPath.startsWith('.')) {
      return null;
    }

    const fileDir = path.dirname(filePath);
    let resolvedPath = path.join(fileDir, importPath);

    // Handle index files
    if (!path.extname(resolvedPath)) {
      resolvedPath += '.js'; // Default to .js
    }

    return resolvedPath;
  }

  /**
   * Call AI provider to get file priorities based on the prompt
   */
  private async callAIProvider(
    files: PrioritizedFile[],
    prompt: string,
    provider: string,
    model: string,
    maxFiles: number
  ): Promise<PrioritizedFile[]> {
    try {
      // Import AI provider registry
      const { aiProviderRegistry } = await import('./ai-providers/registry');

      // Get the AI provider
      const aiProvider = aiProviderRegistry.getProvider(provider);
      if (!aiProvider) {
        console.warn(`AI provider '${provider}' not found, falling back to heuristics`);
        return files;
      }

      // Check if provider is configured
      if (!aiProvider.isConfigured()) {
        console.warn(`AI provider '${provider}' is not configured, falling back to heuristics`);
        return files;
      }

      // Try to create a lightweight repository structure using the distiller
      let structureSummary = '';
      let aiFiles: any[] = [];

      try {
        // Use current working directory as codebase root
        const codebasePath = process.cwd();
        const distillerOptions: DistillerOptions = {
          path: codebasePath,
          depth: 'minimal',
          compressFirst: false,
          includeComments: false,
          includeDocstrings: false,
          format: 'distilled',
          parallel: false,
        };

        const distiller = new Distiller(distillerOptions);

        // Generate lightweight repository structure instead of reading all files
        const repoStructure = await distiller.distill(codebasePath);
        structureSummary = distiller.formatResult(repoStructure, codebasePath);

        // Convert files to minimal format for AI (no content, just metadata)
        aiFiles = files.map((file) => ({
          path: file.path,
          relativePath: file.relativePath,
          size: file.size || 0,
          extension: path.extname(file.relativePath).slice(1),
          directory: path.dirname(file.relativePath),
        }));
      } catch (distillError) {
        console.warn(
          `Distiller failed, falling back to basic file metadata: ${distillError instanceof Error ? distillError.message : 'Unknown error'}`
        );

        // Fallback: use basic file information without reading content
        structureSummary = `Repository with ${files.length} files in various directories.`;
        aiFiles = files.map((file) => ({
          path: file.path,
          relativePath: file.relativePath,
          size: file.size || 0,
          extension: path.extname(file.relativePath).slice(1),
          directory: path.dirname(file.relativePath),
        }));
      }

      // Enhanced prompt with repository structure and intelligent file selection
      const enhancedPrompt = `${prompt}

${
  structureSummary
    ? `REPOSITORY STRUCTURE:
${structureSummary}

`
    : ''
}AVAILABLE FILES:
${aiFiles.map((f) => `${f.relativePath} (${f.extension || 'unknown'}, ${f.size || 0} bytes)`).join('\n')}

INSTRUCTIONS:
- Analyze the task and determine how many files are truly needed
- If the user specified a number (like "find THE main file" or "two files"), respect that exactly
- If the user was vague, select the most relevant files based on the task complexity
- Quality over quantity - fewer focused files are better than many loosely related ones
- Prioritize files that directly address the task

Return your selections with priority levels (high/medium/low) and reasoning for each choice.`;

      // Create provider config for getModel
      const modelConfig = {
        provider,
        model,
        temperature: 0.3,
      };

      // Get the AI model
      const aiModel = aiProvider.getModel(modelConfig);

      // Define response schema
      const FileSelectionSchema = z.object({
        files: z.array(
          z.object({
            path: z.string(),
            priority: z.enum(['high', 'medium', 'low']),
            reason: z.string(),
          })
        ),
      });

      // Log the request being sent to AI (if DEBUG enabled)
      if (process.env.DEBUG) {
        console.log('\n=== AI REQUEST ===');
        console.log('Provider:', provider);
        console.log('Model:', model);
        console.log('Max Files:', maxFiles);
        console.log('Prompt Length:', enhancedPrompt.length, 'characters');
        console.log('\n--- FULL PROMPT ---');
        console.log(enhancedPrompt);
        console.log('\n--- END PROMPT ---\n');
      }

      const result = await generateObject({
        model: aiModel,
        schema: FileSelectionSchema,
        prompt: enhancedPrompt,
        temperature: 0.3,
      });

      const response = result.object;

      // Log the response from AI (if DEBUG enabled)
      if (process.env.DEBUG) {
        console.log('\n=== AI RESPONSE ===');
        console.log('Files returned:', response.files.length);
        console.log('Response structure:', JSON.stringify(response, null, 2));
        console.log('\n--- SELECTED FILES ---');
        response.files.forEach((file, index) => {
          console.log(`${index + 1}. ${file.path}`);
          console.log(`   Priority: ${file.priority}`);
          console.log(`   Reason: ${file.reason}`);
        });
        console.log('\n=== END AI RESPONSE ===\n');
      }

      // Only return files that AI actually selected
      const aiResultMap = new Map(response.files.map((f) => [f.path, f]));

      return files
        .map((file) => {
          const aiResult = aiResultMap.get(file.relativePath);
          if (aiResult) {
            return {
              ...file,
              priority: aiResult.priority,
              reason: aiResult.reason,
            };
          }
          return null;
        })
        .filter((file) => file !== null);
    } catch (error) {
      if (process.env.DEBUG) {
        console.log('\n=== AI ERROR ===');
        console.log('Error type:', error?.constructor?.name);
        console.log('Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.log('Full error:', error);
        console.log('=== END AI ERROR ===\n');
      }

      console.warn(
        `AI provider failed: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to heuristics`
      );
      return files;
    }
  }
}
