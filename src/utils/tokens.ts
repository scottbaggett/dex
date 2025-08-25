import { encode } from 'gpt-tokenizer';

/**
 * Estimates the number of tokens in a text string using GPT tokenizer
 * @param text The text to count tokens for
 * @returns The number of tokens
 */
export function countTokens(text: string): number {
    try {
        const tokens = encode(text);
        return tokens.length;
    } catch (error) {
        // Fallback to rough estimation if encoding fails
        return Math.ceil(text.length / 4);
    }
}

/**
 * Formats token count for display
 * @param count The token count
 * @returns Formatted string like "1.2k tokens" or "456 tokens"
 */
export function formatTokenCount(count: number): string {
    if (count >= 1000) {
        const k = count / 1000;
        return k >= 10 
            ? `${Math.round(k)}k tokens` 
            : `${k.toFixed(1)}k tokens`;
    }
    return `${count} tokens`;
}

/**
 * Formats token count with ~ prefix for estimates
 * @param count The token count
 * @returns Formatted string like "~1.2k tokens" or "~456 tokens"
 */
export function formatEstimatedTokens(count: number): string {
    return `~${formatTokenCount(count)}`;
}

/**
 * Calculates token savings between two counts
 * @param original Original token count
 * @param reduced Reduced token count
 * @returns Object with savings info
 */
export function calculateTokenSavings(original: number, reduced: number): {
    saved: number;
    percentSaved: number;
    formatted: string;
} {
    const saved = original - reduced;
    const percentSaved = original > 0 ? (saved / original) * 100 : 0;
    
    return {
        saved,
        percentSaved,
        formatted: `${formatTokenCount(saved)} saved (${percentSaved.toFixed(0)}%)`
    };
}