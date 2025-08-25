import { Formatter, FormatterRegistry } from './types';

/**
 * Central registry for output formatters
 */
export class FormattersRegistry implements FormatterRegistry {
    private formatters: Map<string, Formatter> = new Map();
    private defaultFormat = 'structured';
    
    register(formatter: Formatter): void {
        this.formatters.set(formatter.format, formatter);
    }
    
    get(format: string): Formatter | null {
        return this.formatters.get(format) || null;
    }
    
    getDefault(): Formatter {
        const formatter = this.formatters.get(this.defaultFormat);
        if (!formatter) {
            throw new Error(`Default formatter '${this.defaultFormat}' not found`);
        }
        return formatter;
    }
    
    list(): string[] {
        return Array.from(this.formatters.keys());
    }
    
    setDefault(format: string): void {
        if (!this.formatters.has(format)) {
            throw new Error(`Formatter '${format}' not found`);
        }
        this.defaultFormat = format;
    }
}

// Singleton instance
export const formattersRegistry = new FormattersRegistry();

// Export function for compatibility
export function getFormatterRegistry(): FormattersRegistry {
    return formattersRegistry;
}