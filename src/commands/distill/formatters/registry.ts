import { DistillFormatter, FormatterRegistry } from "../../../types.js";

/**
 * Central registry for output formatters
 */
export class DistillFormattersRegistry implements FormatterRegistry {
    private formatters: Map<string, DistillFormatter> = new Map();
    private defaultFormat = 'structured';
    
    register(formatter: DistillFormatter): void {
        this.formatters.set(formatter.format, formatter);
    }
    
    get(format: string): DistillFormatter | null {
        return this.formatters.get(format) || null;
    }
    
    getDefault(): DistillFormatter {
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
            throw new Error(`DistillFormatter '${format}' not found`);
        }
        this.defaultFormat = format;
    }
}

// Singleton instance
export const formattersRegistry = new DistillFormattersRegistry();

// Export function for compatibility
export function getDistillFormatterRegistry(): DistillFormattersRegistry {
    return formattersRegistry;
}