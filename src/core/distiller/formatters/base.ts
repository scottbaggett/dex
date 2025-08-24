import type { DistillationResult } from "../../../types";

export interface FormatterOptions {
    includeMetadata?: boolean;
    includeLocation?: boolean;
    compact?: boolean;
    absolutePaths?: boolean;
    sortNodes?: boolean;
}

export abstract class BaseFormatter {
    protected options: FormatterOptions;

    constructor(options: FormatterOptions = {}) {
        this.options = {
            includeMetadata: true,
            includeLocation: false,
            compact: true,
            absolutePaths: false,
            sortNodes: true,
            ...options,
        };
    }

    /**
     * Format the distillation result
     */
    abstract format(result: DistillationResult): string;

    /**
     * Get the file extension for this format
     */
    abstract extension(): string;

    /**
     * Strip common prefixes from paths for cleaner output
     */
    protected cleanPath(path: string): string {
        if (this.options.absolutePaths) {
            return path;
        }
        
        // Remove common prefixes
        return path
            .replace(/^\.\//, '')
            .replace(/^src\//, '')
            .replace(/\\/g, '/');
    }

    /**
     * Format file size for display
     */
    protected formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    /**
     * Sort exports by type and name
     */
    protected sortExports(exports: any[]): any[] {
        if (!this.options.sortNodes) return exports;
        
        const typeOrder = ['interface', 'type', 'class', 'function', 'const', 'variable', 'enum'];
        
        return [...exports].sort((a, b) => {
            const aIndex = typeOrder.indexOf(a.type);
            const bIndex = typeOrder.indexOf(b.type);
            
            if (aIndex !== bIndex) {
                return aIndex - bIndex;
            }
            
            return a.name.localeCompare(b.name);
        });
    }
}