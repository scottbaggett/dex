/**
 * Types for AI-assisted context generation
 */

/**
 * Priority levels for AI-selected files
 */
export type FilePriority = 'high' | 'medium' | 'low';

/**
 * Represents a file selected by AI for context generation
 */
export interface AIFileSelection {
  /** File path relative to repository root */
  file: string;
  /** Absolute file path */
  path: string;
  /** File content */
  content: string;
  /** Priority level assigned by AI */
  priority: FilePriority;
  /** Explanation for why this file was selected */
  reason: string;
  /** Whether this file should be pre-selected in the UI */
  preSelected: boolean;
  /** Estimated token count for this file */
  tokenEstimate: number;
}

/**
 * Options for AI context analysis
 */
export interface AnalysisOptions {
  /** The prompt describing the task or context needed */
  prompt: string;
  /** Path to the codebase root */
  codebasePath: string;
  /** Maximum number of files to select */
  maxFiles?: number;
  /** Patterns to exclude from selection */
  excludePatterns?: string[];
  /** Patterns to include in selection */
  includePatterns?: string[];
  /** AI provider to use */
  aiProvider?: string;
  /** AI model to use */
  aiModel?: string;
}

/**
 * Result of AI analysis
 */
export interface AIAnalysisResult {
  /** Selected files */
  selections: AIFileSelection[];
  /** Summary statistics */
  summary: {
    /** Total number of files in codebase */
    totalFiles: number;
    /** Number of files selected */
    selectedFiles: number;
    /** Number of high priority files */
    highPriorityCount: number;
    /** Number of medium priority files */
    mediumPriorityCount: number;
    /** Number of low priority files */
    lowPriorityCount: number;
    /** Total token count */
    totalTokens: number;
    /** Estimated cost in USD */
    estimatedCost: number;
  };
  /** The prompt used for analysis */
  prompt: string;
  /** Timestamp of analysis */
  timestamp: Date;
}

/**
 * Supported AI providers
 */
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'groq' | 'ollama';

/**
 * AI model configurations by provider
 */
export interface AIModelConfig {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Cost per 1M input tokens (USD) */
  inputCost: number;
  /** Cost per 1M output tokens (USD) */
  outputCost?: number;
  /** Whether this model supports function calling */
  supportsFunctions?: boolean;
}

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  /** Provider name */
  name: AIProvider;
  /** Base URL for API (optional, uses default if not specified) */
  baseUrl?: string;
  /** API key environment variable name */
  apiKeyEnvVar: string;
  /** Available models */
  models: Record<string, AIModelConfig>;
  /** Default model to use */
  defaultModel: string;
}

/**
 * AI-specific configuration
 */
export interface AIConfig {
  /** AI provider (e.g., 'anthropic', 'openai') */
  provider?: AIProvider;
  /** AI model to use */
  model?: string;
  /** API key (optional, can be provided via environment variable) */
  apiKey?: string;
  /** Custom provider configurations */
  providers?: Partial<Record<AIProvider, Partial<AIProviderConfig>>>;
  /** Bootstrap configuration */
  bootstrap?: {
    /** Default prompt for bootstrap command */
    prompt?: string;
    /** Priority levels to include by default */
    includePriority?: FilePriority[];
    /** Maximum number of files to select */
    maxFiles?: number;
  };
  /** Prompt templates for different use cases */
  templates?: Record<string, string>;
  /** Interactive mode configuration */
  interactive?: {
    /** Auto-accept threshold (0-1) */
    autoAcceptThreshold?: number;
    /** Whether to show AI reasoning by default */
    showReasoning?: boolean;
    /** Whether to group files by priority */
    groupByPriority?: boolean;
    /** Whether to pre-select high priority files */
    preSelectHigh?: boolean;
    /** Whether to pre-select medium priority files */
    preSelectMedium?: boolean;
    /** Whether to pre-select low priority files */
    preSelectLow?: boolean;
  };
  /** Performance settings */
  performance?: {
    /** Enable caching of AI responses */
    enableCaching?: boolean;
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Maximum concurrent requests */
    maxConcurrentRequests?: number;
    /** Request timeout in milliseconds */
    requestTimeout?: number;
  };
}
