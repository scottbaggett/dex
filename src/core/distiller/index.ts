import {
  DistillerOptions,
  CompressionResult,
  DistillationResult,
  CompressedFile,
  ExtractedAPI,
  ProjectStructure,
  DependencyMap,
} from '../../types';
import { HybridParser } from '../parser/hybrid-parser';
import { Parser } from '../parser/parser';
import { promises as fs } from 'fs';
import { join, relative } from 'path';
import { globby } from 'globby';
import { createHash } from 'crypto';
import { AidStyleFormatter } from './formatters/aid-style';
import { DistillerProgress } from './progress';

export class Distiller {
  private parser: HybridParser;
  private options: DistillerOptions;
  private aidFormatter: AidStyleFormatter;
  private progress?: DistillerProgress;
  private defaultExcludes = [
    'node_modules/**',
    '.git/**',
    '.dex/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.log',
    '.DS_Store',
    'thumbs.db',
    '*.lock',
    'package-lock.json',
    '.env*',
    '*.min.js',
    '*.min.css',
    '*.map',
  ];

  constructor(options: DistillerOptions = {}) {
    this.options = {
      depth: 'public',
      compressFirst: true,
      includeDocstrings: true,
      includeComments: false,
      format: 'distilled',
      parallel: true,
      ...options,
    } as DistillerOptions;

    this.parser = new HybridParser({
      includeComments: this.options.includeComments || false,
      includeDocstrings: this.options.includeDocstrings !== false,
    });

    this.aidFormatter = new AidStyleFormatter();
  }

  async distill(
    targetPath: string,
    progress?: DistillerProgress
  ): Promise<
    | CompressionResult
    | DistillationResult
    | { compression: CompressionResult; distillation: DistillationResult }
  > {
    this.progress = progress;

    // Initialize parser
    await this.parser.initialize();

    // Phase 1: Compression (if enabled)
    let compressionResult: CompressionResult | undefined;
    if (
      this.options.compressFirst !== false ||
      this.options.format === 'compressed' ||
      this.options.format === 'both'
    ) {
      compressionResult = await this.compress(targetPath);
    }

    // Phase 2: Distillation (if format requires it)
    let distillationResult: DistillationResult | undefined;
    if (this.options.format === 'distilled' || this.options.format === 'both') {
      const filesToDistill = compressionResult
        ? compressionResult.files.filter((f) =>
            this.parser.isLanguageSupported(Parser.detectLanguage(f.path) || '')
          )
        : await this.getFilesToProcess(targetPath);

      // Don't restart progress if already running from compression phase
      if (!compressionResult && this.progress) {
        this.progress.start(filesToDistill.length);
      }

      distillationResult = await this.distillFiles(filesToDistill, targetPath);
    }

    // Return based on format option
    if (this.options.format === 'compressed') {
      return compressionResult!;
    } else if (this.options.format === 'distilled') {
      return distillationResult!;
    } else {
      return {
        compression: compressionResult!,
        distillation: distillationResult!,
      };
    }
  }

  async distillSelectedFiles(
    selectedFiles: string[],
    basePath: string,
    progress?: DistillerProgress
  ): Promise<
    | CompressionResult
    | DistillationResult
    | { compression: CompressionResult; distillation: DistillationResult }
  > {
    this.progress = progress;

    // Initialize parser
    await this.parser.initialize();

    // Phase 1: Compression (if enabled)
    let compressionResult: CompressionResult | undefined;
    if (
      this.options.compressFirst !== false ||
      this.options.format === 'compressed' ||
      this.options.format === 'both'
    ) {
      compressionResult = await this.compressSelectedFiles(selectedFiles, basePath);
    }

    // Phase 2: Distillation (if format requires it)
    let distillationResult: DistillationResult | undefined;
    if (this.options.format === 'distilled' || this.options.format === 'both') {
      const filesToDistill = compressionResult
        ? compressionResult.files.filter((f) =>
            this.parser.isLanguageSupported(Parser.detectLanguage(f.path) || '')
          )
        : selectedFiles;

      // Don't restart progress if already running from compression phase
      if (!compressionResult && this.progress) {
        this.progress.start(filesToDistill.length);
      }

      distillationResult = await this.distillFiles(filesToDistill, basePath);
    }

    // Return based on format option
    if (this.options.format === 'compressed') {
      return compressionResult!;
    } else if (this.options.format === 'distilled') {
      return distillationResult!;
    } else {
      return {
        compression: compressionResult!,
        distillation: distillationResult!,
      };
    }
  }

  private async compress(targetPath: string): Promise<CompressionResult> {
    const files = await this.getFilesToProcess(targetPath);
    return this.compressFiles(files, targetPath);
  }

  private async compressSelectedFiles(
    selectedFiles: string[],
    basePath: string
  ): Promise<CompressionResult> {
    return this.compressFiles(selectedFiles, basePath);
  }

  private async compressFiles(files: string[], _basePath: string): Promise<CompressionResult> {
    const compressedFiles: CompressedFile[] = [];
    let totalSize = 0;
    const excludedCount = 0;

    // Start progress if available
    if (this.progress) {
      this.progress.start(files.length);
    }

    // Process files in parallel batches
    if (this.options.parallel) {
      const batchSize = 50;
      let cumulativeOriginalSize = 0;
      let cumulativeDistilledSize = 0;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const results = await Promise.all(batch.map((file) => this.compressFile(file)));
        compressedFiles.push(...results);
        totalSize += results.reduce((sum, f) => sum + f.size, 0);

        // Update cumulative sizes
        cumulativeOriginalSize += results.reduce((sum, f) => sum + f.size, 0);
        cumulativeDistilledSize += results.reduce(
          (sum, f) => sum + Math.ceil(f.content.length / 4) * 4,
          0
        );

        // Update progress
        if (this.progress) {
          const processedCount = Math.min(i + batchSize, files.length);
          this.progress.update(processedCount, cumulativeOriginalSize, cumulativeDistilledSize);
        }
      }
    } else {
      // Sequential processing
      for (const file of files) {
        const compressed = await this.compressFile(file);
        compressedFiles.push(compressed);
        totalSize += compressed.size;
      }
    }

    return {
      files: compressedFiles,
      metadata: {
        totalFiles: compressedFiles.length,
        totalSize,
        excludedCount,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async compressFile(filePath: string): Promise<CompressedFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    const hash = createHash('sha256').update(content).digest('hex').substring(0, 8);
    const language = Parser.detectLanguage(filePath) || undefined;

    return {
      path: filePath,
      size: stats.size,
      hash,
      content,
      language,
    };
  }

  private async distillFiles(
    files: CompressedFile[] | string[],
    basePath: string
  ): Promise<DistillationResult> {
    // Start progress if not already started
    if (this.progress && !this.progress.isSpinning) {
      const fileCount = files.length;
      this.progress.start(fileCount);
    }

    const apis: ExtractedAPI[] = [];
    const directoriesSet = new Set<string>();
    const structure: ProjectStructure = {
      directories: [],
      fileCount: 0,
      languages: {},
    };
    const dependencies: DependencyMap = {};

    let originalTokens = 0;
    let distilledTokens = 0;

    // Process files
    const filesToProcess =
      typeof files[0] === 'string'
        ? await Promise.all((files as string[]).map((f) => this.compressFile(f)))
        : (files as CompressedFile[]);

    let processedCount = 0;
    let cumulativeOriginalSize = 0;
    let cumulativeDistilledSize = 0;

    for (const file of filesToProcess) {
      const language = file.language || Parser.detectLanguage(file.path);
      if (!language || !this.parser.isLanguageSupported(language)) {
        processedCount++;
        // Update progress even for unsupported files
        if (this.progress) {
          this.progress.update(processedCount, cumulativeOriginalSize, cumulativeDistilledSize);
        }
        continue;
      }

      // Update structure
      const dir = join(basePath, file.path).split('/').slice(0, -1).join('/');
      directoriesSet.add(dir);
      structure.fileCount++;
      structure.languages[language] = (structure.languages[language] || 0) + 1;

      // Calculate tokens
      originalTokens += Math.ceil(file.content.length / 4);
      cumulativeOriginalSize += file.size;

      try {
        // Parse and extract
        const parsed = await this.parser.parse(file.content, language);
        parsed.path = file.path;

        // Auto-detect depth if needed
        const depth = this.options.depth || HybridParser.getAutoDepth(file.size);
        const extracted = this.parser.extract(parsed, depth);

        apis.push(extracted);

        // Estimate distilled tokens
        const distilledContent = this.serializeExtractedAPI(extracted);
        const distilledBytes = distilledContent.length;
        distilledTokens += Math.ceil(distilledBytes / 4);
        cumulativeDistilledSize += distilledBytes;

        // Extract dependencies (imports/exports)
        dependencies[file.path] = this.extractDependencies(parsed);
      } catch (error) {
        // Silently continue with other files
        if (process.env.DEBUG) {
          console.warn(`Failed to distill ${file.path}:`, error);
        }
      }

      // Update progress
      processedCount++;
      if (this.progress) {
        this.progress.update(processedCount, cumulativeOriginalSize, cumulativeDistilledSize);
      }
    }

    return {
      apis,
      structure: {
        ...structure,
        directories: Array.from(directoriesSet),
      },
      dependencies,
      metadata: {
        originalTokens,
        distilledTokens,
        compressionRatio: originalTokens > 0 ? 1 - distilledTokens / originalTokens : 0,
      },
    };
  }

  private async getFilesToProcess(targetPath: string): Promise<string[]> {
    const stats = await fs.stat(targetPath);

    if (stats.isFile()) {
      return [targetPath];
    }

    // Get all files using globby
    const patterns = ['**/*'];
    const ignore = [...this.defaultExcludes, ...(this.options.excludePatterns || [])];

    const files = await globby(patterns, {
      cwd: targetPath,
      ignore,
      absolute: false,
      onlyFiles: true,
      dot: true,
    });

    // Apply additional filters if needed
    if (this.options.since || this.options.staged) {
      // This would integrate with git to filter files
      // For now, return all files
    }

    return files.map((f: string) => relative(process.cwd(), join(targetPath, f)));
  }

  private serializeExtractedAPI(api: ExtractedAPI): string {
    let result = `File: ${api.file}\n\n`;

    for (const exp of api.exports) {
      if (exp.docstring) {
        result += `/**\n * ${exp.docstring.split('\n').join('\n * ')}\n */\n`;
      }
      result += `${exp.signature}\n\n`;
    }

    return result;
  }

  private extractDependencies(parsed: any): { imports: string[]; exports: string[] } {
    // This is a simplified implementation
    // In a real implementation, we'd walk the AST to find imports/exports
    return {
      imports: [],
      exports: parsed.exports?.map((e: any) => e.name) || [],
    };
  }

  /**
   * Format the distillation result based on output format
   */
  formatResult(
    result: CompressionResult | DistillationResult | any,
    originalPath?: string
  ): string {
    if ('files' in result) {
      // Compression result - XML format
      return this.formatCompression(result as CompressionResult);
    } else if ('apis' in result) {
      // Distillation result - structured format
      return this.formatDistillation(result as DistillationResult, originalPath);
    } else if ('compression' in result && 'distillation' in result) {
      // Both results
      return `${this.formatCompression(result.compression)}\n\n---\n\n${this.formatDistillation(result.distillation, originalPath)}`;
    }

    return JSON.stringify(result, null, 2);
  }

  private formatCompression(result: CompressionResult): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<context>\n';
    xml += `  <metadata generated="${result.metadata.timestamp}" files="${result.metadata.totalFiles}" size="${result.metadata.totalSize}"/>\n`;

    for (const file of result.files) {
      xml += `  <file path="${file.path}" size="${file.size}" hash="${file.hash}"${file.language ? ` language="${file.language}"` : ''}>\n`;
      xml += this.escapeXml(file.content);
      xml += '\n  </file>\n';
    }

    xml += '</context>';
    return xml;
  }

  private formatDistillation(result: DistillationResult, originalPath?: string): string {
    // Use AID-style formatter for better output
    if (this.options.useAidStyle !== false) {
      return this.aidFormatter.formatDistillation(result, originalPath || '');
    }

    // Original format for backward compatibility
    let output = '# Distilled Context\n\n';

    // Metadata
    output += `## Summary\n`;
    output += `- Files analyzed: ${result.structure.fileCount}\n`;
    output += `- Original tokens: ${result.metadata.originalTokens.toLocaleString()}\n`;
    output += `- Distilled tokens: ${result.metadata.distilledTokens.toLocaleString()}\n`;
    output += `- Compression ratio: ${(result.metadata.compressionRatio * 100).toFixed(1)}%\n\n`;

    // Languages breakdown
    output += `## Languages\n`;
    for (const [lang, count] of Object.entries(result.structure.languages)) {
      output += `- ${lang}: ${count} files\n`;
    }
    output += '\n';

    // APIs by file
    output += `## Extracted APIs\n\n`;
    for (const api of result.apis) {
      output += `### ${api.file}\n\n`;
      for (const exp of api.exports) {
        if (exp.docstring) {
          output += `\`\`\`\n${exp.docstring}\n\`\`\`\n`;
        }
        output += `\`\`\`${this.getLanguageForFile(api.file)}\n${exp.signature}\n\`\`\`\n\n`;
      }
    }

    return output;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getLanguageForFile(filePath: string): string {
    const language = Parser.detectLanguage(filePath);
    return language || 'text';
  }
}
