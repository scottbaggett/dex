import { FilePriority } from '../../types/ai-context';
import { LanguageModel } from 'ai';
import { z } from 'zod';

/**
 * Represents a file with its metadata for AI analysis
 */
export interface AIFileInfo {
    path: string;
    relativePath: string;
    content: string;
    size: number;
    extension: string;
    directory: string;
}

/**
 * AI provider response for file prioritization
 */
export interface AIPrioritizationResponse {
    files: Array<{
        path: string;
        priority: FilePriority;
        reason: string;
        confidence: number; // 0-1 confidence score
    }>;
    reasoning?: string; // Overall reasoning for the selections
}

/**
 * Options for AI prioritization request
 */
export interface AIPrioritizationRequest {
    files: AIFileInfo[];
    prompt: string;
    maxFiles: number;
    context?: {
        projectType?: string;
        language?: string;
        framework?: string;
    };
}

/**
 * AI SDK-based provider configuration
 */
export interface AIProviderConfig {
    provider: string;
    model: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Base interface for AI providers using AI SDK
 */
export interface AIProvider {
    readonly name: string;
    readonly models: string[];

    /**
     * Test if the provider is properly configured
     */
    isConfigured(): boolean;

    /**
     * Get the AI SDK language model instance
     */
    getModel(config: AIProviderConfig): LanguageModel;

    /**
     * Prioritize files based on the given prompt
     */
    prioritizeFiles(request: AIPrioritizationRequest, config: AIProviderConfig): Promise<AIPrioritizationResponse>;

    /**
     * Get the cost estimate for a request
     */
    estimateCost(request: AIPrioritizationRequest, config: AIProviderConfig): Promise<number>;
}

/**
 * Base AI provider error
 */
export class AIProviderError extends Error {
    constructor(
        message: string,
        public provider: string,
        public code?: string,
        public statusCode?: number
    ) {
        super(message);
        this.name = 'AIProviderError';
    }
}

/**
 * Rate limit error
 */
export class AIRateLimitError extends AIProviderError {
    constructor(provider: string, retryAfter?: number) {
        super(`Rate limit exceeded for ${provider}`, provider, 'RATE_LIMIT');
        this.retryAfter = retryAfter;
    }

    public retryAfter?: number;
}

/**
 * Authentication error
 */
export class AIAuthError extends AIProviderError {
    constructor(provider: string) {
        super(`Authentication failed for ${provider}. Check your API key.`, provider, 'AUTH_ERROR', 401);
    }
}

/**
 * Quota exceeded error
 */
export class AIQuotaError extends AIProviderError {
    constructor(provider: string) {
        super(`Quota exceeded for ${provider}`, provider, 'QUOTA_EXCEEDED', 429);
    }
}

/**
 * Shared Zod schema for file prioritization responses
 * Used by all AI providers to ensure consistent structured output
 */
export const FilePrioritySchema = z.object({
    files: z.array(z.object({
        path: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        reason: z.string(),
        confidence: z.number().min(0).max(1)
    })),
    reasoning: z.string().optional()
});

/**
 * Shared prompt builder for file prioritization
 * Used by all AI providers to ensure consistent prompts
 */
export function buildFilePrioritizationPrompt(request: AIPrioritizationRequest): string {
    const { files, prompt, maxFiles, context } = request;

    // Create a concise file list for the AI
    const fileList = files.map(file => ({
        path: file.relativePath,
        size: file.size,
        extension: file.extension,
        directory: file.directory,
        // Include first few lines of content for context
        preview: file.content.split('\n').slice(0, 5).join('\n').substring(0, 200)
    }));

    return `You are an expert code analyst helping to select the most relevant files for a specific task.

TASK: ${prompt}

PROJECT CONTEXT:
${context ? `- Type: ${context.projectType || 'Unknown'}
- Language: ${context.language || 'Unknown'}  
- Framework: ${context.framework || 'Unknown'}` : '- No additional context provided'}

FILES TO ANALYZE (${files.length} total):
${fileList.map(file =>
        `- ${file.path} (${file.extension}, ${file.size} bytes, in ${file.directory})
    Preview: ${file.preview}${file.preview.length >= 200 ? '...' : ''}`
    ).join('\n')}

INSTRUCTIONS:
1. Select the ${maxFiles} most relevant files for the given task
2. Assign each selected file a priority: "high", "medium", or "low"
3. Provide a clear reason for each selection
4. Consider file relationships, dependencies, and architectural importance
5. Focus on files that would help someone understand or work on the specified task

Please respond with a JSON object containing the file selections and reasoning.`;
}