/**
 * Formatter exports and initialization
 */

// Types are now in central /src/types.ts
export * from "./registry.js";
export { TextFormatter } from "./text.js";
export { MarkdownFormatter } from "./markdown.js";
export { JsonFormatter } from "./json.js";

import { formattersRegistry } from "./registry.js";
import { TextFormatter } from "./text.js";
import { MarkdownFormatter } from "./markdown.js";
import { JsonFormatter } from "./json.js";

/**
 * Initialize default formatters
 */
export function initializeFormatters(): void {
    // Register formatters
    formattersRegistry.register(new TextFormatter());
    formattersRegistry.register(new MarkdownFormatter());
    formattersRegistry.register(new JsonFormatter());

    // Set default
    formattersRegistry.setDefault("txt");
}

/**
 * Get the formatter registry
 */
export function getFormatterRegistry() {
    return formattersRegistry;
}

// Auto-initialize on import
initializeFormatters();
