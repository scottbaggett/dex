export { BaseFormatter, type FormatterOptions } from './base';
export { TxtFormatter } from './txt';
export { JsonFormatter } from './json-formatter';
export { MarkdownFormatter } from './markdown-formatter';

import { BaseFormatter } from './base';
import { TxtFormatter } from './txt';
import { JsonFormatter } from './json-formatter';
import { MarkdownFormatter } from './markdown-formatter';

export type OutputFormat = 'txt' | 'json' | 'markdown' | 'md';

/**
 * Get formatter for the specified format
 */
export function getFormatter(format: OutputFormat): BaseFormatter {
    switch (format) {
        case 'txt':
            return new TxtFormatter();
        case 'json':
            return new JsonFormatter();
        case 'markdown':
        case 'md':
            return new MarkdownFormatter();
        default:
            return new TxtFormatter(); // Default to txt
    }
}