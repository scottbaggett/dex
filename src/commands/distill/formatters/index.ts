/**
 * Formatter exports and initialization
 */

export * from './types';
export * from './registry';
export { StructuredFormatter } from './structured';
export { MarkdownFormatter } from './markdown';
export { JsonFormatter } from './json';

import { formattersRegistry } from './registry';
import { StructuredFormatter } from './structured';
import { MarkdownFormatter } from './markdown';
import { JsonFormatter } from './json';

/**
 * Initialize default formatters
 */
export function initializeFormatters(): void {
    // Register formatters
    formattersRegistry.register(new StructuredFormatter());
    formattersRegistry.register(new MarkdownFormatter());
    formattersRegistry.register(new JsonFormatter());
    
    // Set default
    formattersRegistry.setDefault('structured');
}

/**
 * Get the formatter registry
 */
export function getFormatterRegistry() {
    return formattersRegistry;
}

// Auto-initialize on import
initializeFormatters();