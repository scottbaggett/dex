/**
 * Formatter types and interfaces
 */

import { DistillationResult, CompressionResult } from '../../../types';

export interface FormatterOptions {
    // Control what to include
    includeImports?: boolean;
    includePrivate?: boolean;
    includeDocstrings?: boolean;
    includeComments?: boolean;
    includeMetadata?: boolean;
    
    // Output style
    preserveStructure?: boolean;
    groupByType?: boolean;
    
    // Language hints
    language?: string;
    syntaxHighlight?: boolean;
}

export interface Formatter {
    name: string;
    format: string;  // 'xml', 'markdown', 'json', 'text'
    
    /**
     * Format a distillation result
     */
    formatDistillation(
        result: DistillationResult,
        options?: FormatterOptions
    ): string;
    
    /**
     * Format a compression result
     */
    formatCompression(
        result: CompressionResult,
        options?: FormatterOptions
    ): string;
    
    /**
     * Format combined results
     */
    formatCombined(
        compression: CompressionResult,
        distillation: DistillationResult,
        options?: FormatterOptions
    ): string;
}

export interface FormatterRegistry {
    register(formatter: Formatter): void;
    get(format: string): Formatter | null;
    getDefault(): Formatter;
    list(): string[];
}