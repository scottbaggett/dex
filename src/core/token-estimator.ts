import { ModelRegistry } from './ai-providers/model-registry';

/**
 * Responsible for estimating token usage and costs
 */
export class TokenEstimator {
  // Token cost per 1M tokens (in USD)
  private tokenCosts: Record<string, Record<string, { input: number; output?: number }>> = {
    anthropic: {
      'claude-3-opus': { input: 15, output: 75 },
      'claude-3-sonnet': { input: 3, output: 15 },
      'claude-3-haiku': { input: 0.25, output: 1.25 },
      'claude-2': { input: 8, output: 24 },
    },
    openai: {
      'gpt-4o': { input: 5, output: 15 },
      'gpt-4': { input: 10, output: 30 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    },
    groq: {
      'llama-3-8b': { input: 0.2, output: 0.2 },
      'llama-3-70b': { input: 0.7, output: 0.7 },
      'mixtral-8x7b': { input: 0.27, output: 0.27 },
    },
  };

  // Token ratio estimates for different languages (characters per token)
  private languageTokenRatios: Record<string, number> = {
    // Latin-based languages (default: 4 chars per token)
    default: 4,
    js: 4,
    ts: 4,
    jsx: 4,
    tsx: 4,
    py: 4,
    java: 4,
    c: 4,
    cpp: 4,
    cs: 4,
    go: 4,
    rb: 4,
    php: 4,
    html: 4,
    css: 4,
    md: 4,
    json: 5, // More structured, fewer tokens per character
    yaml: 5,
    xml: 5,

    // CJK languages (fewer characters per token)
    zh: 1.5, // Chinese
    ja: 1.5, // Japanese
    ko: 2, // Korean
  };

  // Model-specific token limits
  private modelTokenLimits: Record<string, Record<string, number>> = {
    anthropic: {
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'claude-2': 100000,
    },
    openai: {
      'gpt-4o': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16384,
    },
    groq: {
      'llama-3-8b': 8192,
      'llama-3-70b': 8192,
      'mixtral-8x7b': 32768,
    },
  };

  // Cache for token estimates to avoid recalculating
  private tokenCache: Map<string, number> = new Map();

  /**
   * Estimate the number of tokens in a string
   */
  async estimateTokens(text: string, model: string, language: string = 'default'): Promise<number> {
    // Generate a cache key based on content hash for better cache efficiency
    const contentHash = this.generateContentHash(text);
    const cacheKey = `${contentHash}:${model}:${language}`;

    // Check cache first
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }

    // Get the appropriate ratio for the language
    const ratio = this.languageTokenRatios[language] || this.languageTokenRatios.default;

    // Simple estimation based on character count and language ratio
    const tokenEstimate = Math.ceil(text.length / ratio);

    // Cache the result
    this.tokenCache.set(cacheKey, tokenEstimate);

    return tokenEstimate;
  }

  /**
   * Estimate tokens for multiple texts in parallel
   */
  async estimateTokensBatch(
    texts: Array<{ text: string; model: string; language?: string }>,
    maxConcurrency: number = 10
  ): Promise<number[]> {
    const processText = async (item: {
      text: string;
      model: string;
      language?: string;
    }): Promise<number> => {
      return this.estimateTokens(item.text, item.model, item.language);
    };

    return this.processInParallel(texts, processText, maxConcurrency);
  }

  /**
   * Generate a hash for content to improve cache efficiency
   */
  private generateContentHash(text: string): string {
    // Simple hash function for content
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Process items in parallel with concurrency limit
   */
  private async processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    maxConcurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const semaphore = new Array(maxConcurrency).fill(null);
    let index = 0;

    const processNext = async (): Promise<void> => {
      const currentIndex = index++;
      if (currentIndex >= items.length) return;

      const result = await processor(items[currentIndex]);
      results[currentIndex] = result;

      // Process next item
      await processNext();
    };

    // Start initial batch
    const initialPromises = semaphore.map(() => processNext());
    await Promise.all(initialPromises);

    return results;
  }

  /**
   * Estimate tokens for a file based on its content and extension
   */
  async estimateFileTokens(filePath: string, content: string, model: string): Promise<number> {
    // Extract file extension
    const extension = filePath.split('.').pop()?.toLowerCase() || 'default';

    // Use the extension as the language for token estimation
    return this.estimateTokens(content, model, extension);
  }

  /**
   * Estimate the cost of processing tokens
   */
  estimateCost(tokenCount: number, provider: string, model: string): number {
    // Try to get cost from ModelRegistry first
    const modelConfig = ModelRegistry.getModelConfig(provider, model);
    if (modelConfig) {
      const costPer1M = modelConfig.inputCost;
      return (tokenCount / 1_000_000) * costPer1M;
    }

    // Fallback to hardcoded costs
    const providerCosts = this.tokenCosts[provider];
    if (!providerCosts) {
      return 0; // Unknown provider
    }

    const modelCosts = providerCosts[model];
    if (!modelCosts) {
      return 0; // Unknown model
    }

    // Calculate cost based on input tokens
    const costPer1M = modelCosts.input;
    return (tokenCount / 1_000_000) * costPer1M;
  }

  /**
   * Format a cost as a string
   */
  formatCost(cost: number): string {
    if (cost < 0.01) {
      return '< $0.01';
    }
    return cost.toFixed(2);
  }

  /**
   * Check if token count exceeds model limits
   */
  exceedsModelLimit(tokenCount: number, provider: string, model: string): boolean {
    const providerLimits = this.modelTokenLimits[provider];
    if (!providerLimits) {
      return false; // Unknown provider
    }

    const modelLimit = providerLimits[model];
    if (!modelLimit) {
      return false; // Unknown model
    }

    return tokenCount > modelLimit;
  }

  /**
   * Get the token limit for a model
   */
  getModelTokenLimit(provider: string, model: string): number {
    // Try to get limit from ModelRegistry first
    const modelConfig = ModelRegistry.getModelConfig(provider, model);
    if (modelConfig) {
      return modelConfig.contextWindow;
    }

    // Fallback to hardcoded limits
    const providerLimits = this.modelTokenLimits[provider];
    if (!providerLimits) {
      return 0; // Unknown provider
    }

    return providerLimits[model] || 0;
  }

  /**
   * Calculate percentage of token limit used
   */
  calculateTokenLimitPercentage(tokenCount: number, provider: string, model: string): number {
    const limit = this.getModelTokenLimit(provider, model);
    if (limit === 0) {
      return 0;
    }

    return (tokenCount / limit) * 100;
  }

  /**
   * Format token count as a string
   */
  formatTokenCount(tokenCount: number): string {
    if (tokenCount < 1000) {
      return tokenCount.toString();
    }
    return `${(tokenCount / 1000).toFixed(1)}k`;
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }
}
