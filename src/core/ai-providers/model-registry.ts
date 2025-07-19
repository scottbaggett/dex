/**
 * Unified model registry for all AI providers
 * Single source of truth for model configurations
 */

export interface ModelConfig {
  /** Friendly name for the model */
  friendlyName: string;
  /** Actual API model ID used by the provider */
  apiId: string;
  /** Display name */
  displayName: string;
  /** Context window in tokens */
  contextWindow: number;
  /** Input cost per million tokens in USD */
  inputCost: number;
  /** Output cost per million tokens in USD */
  outputCost: number;
  /** Whether the model supports function calling */
  supportsFunctions: boolean;
  /** Whether the model is currently available */
  available: boolean;
  /** Model release date for version comparison */
  releaseDate?: string;
  /** Special capabilities */
  capabilities?: {
    imageInput?: boolean;
    audioInput?: boolean;
    computerUse?: boolean;
    webSearch?: boolean;
    reasoning?: boolean;
  };
}

export interface ProviderModels {
  /** Provider name */
  name: string;
  /** Environment variable for API key */
  apiKeyEnvVar: string;
  /** Base URL for API (optional) */
  baseUrl?: string;
  /** Default model friendly name */
  defaultModel: string;
  /** Available models */
  models: Record<string, ModelConfig>;
}

/**
 * Complete model registry for all supported providers
 */
export const MODEL_REGISTRY: Record<string, ProviderModels> = {
  anthropic: {
    name: 'anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet',
    models: {
      'claude-4-opus': {
        friendlyName: 'claude-4-opus',
        apiId: 'claude-4-opus-20250514',
        displayName: 'Claude 4 Opus',
        contextWindow: 200000,
        inputCost: 15,
        outputCost: 75,
        supportsFunctions: true,
        available: true,
        releaseDate: '2025-05-14',
        capabilities: {
          imageInput: true,
          computerUse: true,
          webSearch: true,
          reasoning: true,
        },
      },
      'claude-4-sonnet': {
        friendlyName: 'claude-4-sonnet',
        apiId: 'claude-4-sonnet-20250514',
        displayName: 'Claude 4 Sonnet',
        contextWindow: 200000,
        inputCost: 3,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2025-05-14',
        capabilities: {
          imageInput: true,
          computerUse: true,
          webSearch: true,
          reasoning: true,
        },
      },
      'claude-3-7-sonnet': {
        friendlyName: 'claude-3-7-sonnet',
        apiId: 'claude-3-7-sonnet-20250219',
        displayName: 'Claude 3.7 Sonnet',
        contextWindow: 200000,
        inputCost: 3,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2025-02-19',
        capabilities: {
          imageInput: true,
          computerUse: true,
          webSearch: true,
          reasoning: true,
        },
      },
      'claude-3-5-sonnet': {
        friendlyName: 'claude-3-5-sonnet',
        apiId: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        inputCost: 3,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-10-22',
        capabilities: {
          imageInput: true,
          computerUse: true,
          webSearch: true,
        },
      },
      'claude-3-5-sonnet-legacy': {
        friendlyName: 'claude-3-5-sonnet-legacy',
        apiId: 'claude-3-5-sonnet-20240620',
        displayName: 'Claude 3.5 Sonnet (Legacy)',
        contextWindow: 200000,
        inputCost: 3,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-06-20',
        capabilities: {
          imageInput: true,
          webSearch: true,
        },
      },
      'claude-3-5-haiku': {
        friendlyName: 'claude-3-5-haiku',
        apiId: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        inputCost: 0.8,
        outputCost: 4,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-10-22',
        capabilities: {
          imageInput: true,
        },
      },
      'claude-3-opus': {
        friendlyName: 'claude-3-opus',
        apiId: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        contextWindow: 200000,
        inputCost: 15,
        outputCost: 75,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-02-29',
        capabilities: {
          imageInput: true,
        },
      },
      'claude-3-sonnet': {
        friendlyName: 'claude-3-sonnet',
        apiId: 'claude-3-sonnet-20240229',
        displayName: 'Claude 3 Sonnet',
        contextWindow: 200000,
        inputCost: 3,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-02-29',
        capabilities: {
          imageInput: true,
        },
      },
      'claude-3-haiku': {
        friendlyName: 'claude-3-haiku',
        apiId: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        contextWindow: 200000,
        inputCost: 0.25,
        outputCost: 1.25,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-03-07',
        capabilities: {
          imageInput: true,
        },
      },
    },
  },
  openai: {
    name: 'openai',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: {
      'gpt-4.1': {
        friendlyName: 'gpt-4.1',
        apiId: 'gpt-4.1',
        displayName: 'GPT-4.1',
        contextWindow: 128000,
        inputCost: 5,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2025-01-01',
        capabilities: {
          imageInput: true,
        },
      },
      'gpt-4.1-mini': {
        friendlyName: 'gpt-4.1-mini',
        apiId: 'gpt-4.1-mini',
        displayName: 'GPT-4.1 Mini',
        contextWindow: 128000,
        inputCost: 0.15,
        outputCost: 0.6,
        supportsFunctions: true,
        available: true,
        releaseDate: '2025-01-01',
        capabilities: {
          imageInput: true,
        },
      },
      'gpt-4.1-nano': {
        friendlyName: 'gpt-4.1-nano',
        apiId: 'gpt-4.1-nano',
        displayName: 'GPT-4.1 Nano',
        contextWindow: 128000,
        inputCost: 0.05,
        outputCost: 0.2,
        supportsFunctions: true,
        available: true,
        releaseDate: '2025-01-01',
        capabilities: {
          imageInput: true,
        },
      },
      'o4-mini': {
        friendlyName: 'o4-mini',
        apiId: 'o4-mini',
        displayName: 'GPT o4-mini',
        contextWindow: 128000,
        inputCost: 3,
        outputCost: 12,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          reasoning: true,
          imageInput: true,
        },
      },
      o3: {
        friendlyName: 'o3',
        apiId: 'o3',
        displayName: 'GPT o3',
        contextWindow: 200000,
        inputCost: 60,
        outputCost: 240,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          reasoning: true,
          imageInput: true,
        },
      },
      'o3-mini': {
        friendlyName: 'o3-mini',
        apiId: 'o3-mini',
        displayName: 'GPT o3-mini',
        contextWindow: 128000,
        inputCost: 3,
        outputCost: 12,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          reasoning: true,
        },
      },
      o1: {
        friendlyName: 'o1',
        apiId: 'o1',
        displayName: 'GPT o1',
        contextWindow: 200000,
        inputCost: 15,
        outputCost: 60,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-09-12',
        capabilities: {
          reasoning: true,
          imageInput: true,
        },
      },
      'o1-mini': {
        friendlyName: 'o1-mini',
        apiId: 'o1-mini',
        displayName: 'GPT o1-mini',
        contextWindow: 128000,
        inputCost: 3,
        outputCost: 12,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-09-12',
        capabilities: {
          reasoning: true,
          imageInput: true,
        },
      },
      'o1-preview': {
        friendlyName: 'o1-preview',
        apiId: 'o1-preview',
        displayName: 'GPT o1-preview',
        contextWindow: 128000,
        inputCost: 15,
        outputCost: 60,
        supportsFunctions: false,
        available: true,
        releaseDate: '2024-09-12',
        capabilities: {
          reasoning: true,
        },
      },
      'gpt-4o': {
        friendlyName: 'gpt-4o',
        apiId: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        inputCost: 5,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-05-13',
        capabilities: {
          imageInput: true,
        },
      },
      'gpt-4o-mini': {
        friendlyName: 'gpt-4o-mini',
        apiId: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128000,
        inputCost: 0.15,
        outputCost: 0.6,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-07-18',
        capabilities: {
          imageInput: true,
        },
      },
      'gpt-4o-audio-preview': {
        friendlyName: 'gpt-4o-audio-preview',
        apiId: 'gpt-4o-audio-preview',
        displayName: 'GPT-4o Audio Preview',
        contextWindow: 128000,
        inputCost: 5,
        outputCost: 15,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-10-01',
        capabilities: {
          audioInput: true,
        },
      },
      'gpt-4-turbo': {
        friendlyName: 'gpt-4-turbo',
        apiId: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        contextWindow: 128000,
        inputCost: 10,
        outputCost: 30,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-04-09',
        capabilities: {
          imageInput: true,
        },
      },
      'gpt-4': {
        friendlyName: 'gpt-4',
        apiId: 'gpt-4',
        displayName: 'GPT-4',
        contextWindow: 8192,
        inputCost: 30,
        outputCost: 60,
        supportsFunctions: true,
        available: true,
        releaseDate: '2023-03-14',
      },
      'gpt-3.5-turbo': {
        friendlyName: 'gpt-3.5-turbo',
        apiId: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        contextWindow: 16384,
        inputCost: 0.5,
        outputCost: 1.5,
        supportsFunctions: true,
        available: true,
        releaseDate: '2023-03-01',
      },
      'chatgpt-4o-latest': {
        friendlyName: 'chatgpt-4o-latest',
        apiId: 'chatgpt-4o-latest',
        displayName: 'ChatGPT-4o Latest',
        contextWindow: 128000,
        inputCost: 5,
        outputCost: 15,
        supportsFunctions: false,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          imageInput: true,
        },
      },
    },
  },
  google: {
    name: 'google',
    apiKeyEnvVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    defaultModel: 'gemini-1.5-pro',
    models: {
      'gemini-1.5-pro': {
        friendlyName: 'gemini-1.5-pro',
        apiId: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        contextWindow: 2000000,
        inputCost: 3.5,
        outputCost: 10.5,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-02-15',
        capabilities: {
          imageInput: true,
        },
      },
      'gemini-1.5-pro-latest': {
        friendlyName: 'gemini-1.5-pro-latest',
        apiId: 'gemini-1.5-pro-latest',
        displayName: 'Gemini 1.5 Pro Latest',
        contextWindow: 2000000,
        inputCost: 3.5,
        outputCost: 10.5,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          imageInput: true,
        },
      },
      'gemini-1.5-flash': {
        friendlyName: 'gemini-1.5-flash',
        apiId: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        contextWindow: 1000000,
        inputCost: 0.35,
        outputCost: 1.05,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-05-14',
        capabilities: {
          imageInput: true,
        },
      },
      'gemini-2.0-flash-exp': {
        friendlyName: 'gemini-2.0-flash-exp',
        apiId: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash Experimental',
        contextWindow: 1000000,
        inputCost: 0.35,
        outputCost: 1.05,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-11',
        capabilities: {
          imageInput: true,
        },
      },
      'gemini-2.0-flash-thinking-exp': {
        friendlyName: 'gemini-2.0-flash-thinking-exp',
        apiId: 'gemini-2.0-flash-thinking-exp',
        displayName: 'Gemini 2.0 Flash Thinking Experimental',
        contextWindow: 1000000,
        inputCost: 0.35,
        outputCost: 1.05,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-11',
        capabilities: {
          imageInput: true,
          reasoning: true,
        },
      },
      'gemma2-9b-it': {
        friendlyName: 'gemma2-9b-it',
        apiId: 'gemma2-9b-it',
        displayName: 'Gemma 2 9B',
        contextWindow: 8192,
        inputCost: 0.2,
        outputCost: 0.2,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-06-27',
      },
      'gemma-3-12b-it': {
        friendlyName: 'gemma-3-12b-it',
        apiId: 'gemma-3-12b-it',
        displayName: 'Gemma 3 12B',
        contextWindow: 8192,
        inputCost: 0.2,
        outputCost: 0.2,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
      },
    },
  },
  groq: {
    name: 'groq',
    apiKeyEnvVar: 'GROQ_API_KEY',
    defaultModel: 'llama-3.1-70b',
    models: {
      'llama-3.1-70b': {
        friendlyName: 'llama-3.1-70b',
        apiId: 'llama-3.1-70b-versatile',
        displayName: 'Llama 3.1 70B',
        contextWindow: 131072,
        inputCost: 0.59,
        outputCost: 0.79,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-07-23',
      },
      'llama-3.1-8b': {
        friendlyName: 'llama-3.1-8b',
        apiId: 'llama-3.1-8b-instant',
        displayName: 'Llama 3.1 8B',
        contextWindow: 131072,
        inputCost: 0.05,
        outputCost: 0.08,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-07-23',
      },
      'mixtral-8x7b': {
        friendlyName: 'mixtral-8x7b',
        apiId: 'mixtral-8x7b-32768',
        displayName: 'Mixtral 8x7B',
        contextWindow: 32768,
        inputCost: 0.24,
        outputCost: 0.24,
        supportsFunctions: true,
        available: true,
        releaseDate: '2023-12-11',
      },
      'gemma2-9b': {
        friendlyName: 'gemma2-9b',
        apiId: 'gemma2-9b-it',
        displayName: 'Gemma 2 9B',
        contextWindow: 8192,
        inputCost: 0.2,
        outputCost: 0.2,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-06-27',
      },
      'gemma-7b': {
        friendlyName: 'gemma-7b',
        apiId: 'gemma-7b-it',
        displayName: 'Gemma 7B',
        contextWindow: 8192,
        inputCost: 0.07,
        outputCost: 0.07,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-02-21',
      },
      'qwen-qwq-32b': {
        friendlyName: 'qwen-qwq-32b',
        apiId: 'qwen-qwq-32b',
        displayName: 'Qwen QwQ 32B',
        contextWindow: 32768,
        inputCost: 0.59,
        outputCost: 0.79,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-11-01',
        capabilities: {
          reasoning: true,
        },
      },
      'llama-4-scout': {
        friendlyName: 'llama-4-scout',
        apiId: 'meta-llama/llama-4-scout-17b-16e-instruct',
        displayName: 'Llama 4 Scout 17B',
        contextWindow: 16384,
        inputCost: 0.3,
        outputCost: 0.3,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          imageInput: true,
        },
      },
      'deepseek-r1': {
        friendlyName: 'deepseek-r1',
        apiId: 'deepseek-r1-distill-llama-70b',
        displayName: 'DeepSeek R1 Distill 70B',
        contextWindow: 65536,
        inputCost: 0.59,
        outputCost: 0.79,
        supportsFunctions: true,
        available: true,
        releaseDate: '2024-12-01',
        capabilities: {
          reasoning: true,
        },
      },
    },
  },
  ollama: {
    name: 'ollama',
    apiKeyEnvVar: 'OLLAMA_API_KEY', // Optional for local
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    models: {
      'llama3.2': {
        friendlyName: 'llama3.2',
        apiId: 'llama3.2',
        displayName: 'Llama 3.2',
        contextWindow: 128000,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
      'llama3.1': {
        friendlyName: 'llama3.1',
        apiId: 'llama3.1',
        displayName: 'Llama 3.1',
        contextWindow: 128000,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
      llama3: {
        friendlyName: 'llama3',
        apiId: 'llama3',
        displayName: 'Llama 3',
        contextWindow: 8192,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
      codellama: {
        friendlyName: 'codellama',
        apiId: 'codellama',
        displayName: 'Code Llama',
        contextWindow: 16384,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
      mistral: {
        friendlyName: 'mistral',
        apiId: 'mistral',
        displayName: 'Mistral',
        contextWindow: 32768,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
      'qwen2.5-coder': {
        friendlyName: 'qwen2.5-coder',
        apiId: 'qwen2.5-coder',
        displayName: 'Qwen 2.5 Coder',
        contextWindow: 32768,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
      'deepseek-coder': {
        friendlyName: 'deepseek-coder',
        apiId: 'deepseek-coder',
        displayName: 'DeepSeek Coder',
        contextWindow: 16384,
        inputCost: 0,
        outputCost: 0,
        supportsFunctions: false,
        available: true,
      },
    },
  },
};

/**
 * Model registry utility class
 */
export class ModelRegistry {
  /**
   * Get all providers
   */
  static getProviders(): string[] {
    return Object.keys(MODEL_REGISTRY);
  }

  /**
   * Get provider configuration
   */
  static getProvider(provider: string): ProviderModels | undefined {
    return MODEL_REGISTRY[provider];
  }

  /**
   * Get all models for a provider (returns friendly names)
   */
  static getModels(provider: string): string[] {
    const providerConfig = MODEL_REGISTRY[provider];
    return providerConfig ? Object.keys(providerConfig.models) : [];
  }

  /**
   * Get all API model IDs for a provider (for AI SDK)
   */
  static getAPIModelIds(provider: string): string[] {
    const providerConfig = MODEL_REGISTRY[provider];
    return providerConfig ? Object.values(providerConfig.models).map((m) => m.apiId) : [];
  }

  /**
   * Get model configuration by friendly name
   */
  static getModelConfig(provider: string, friendlyName: string): ModelConfig | undefined {
    const providerConfig = MODEL_REGISTRY[provider];
    return providerConfig?.models[friendlyName];
  }

  /**
   * Get model configuration by API ID
   */
  static getModelConfigByApiId(provider: string, apiId: string): ModelConfig | undefined {
    const providerConfig = MODEL_REGISTRY[provider];
    if (!providerConfig) return undefined;

    return Object.values(providerConfig.models).find((model) => model.apiId === apiId);
  }

  /**
   * Get API ID from friendly name
   */
  static getApiId(provider: string, friendlyName: string): string | undefined {
    return this.getModelConfig(provider, friendlyName)?.apiId;
  }

  /**
   * Get friendly name from API ID
   */
  static getFriendlyName(provider: string, apiId: string): string | undefined {
    return this.getModelConfigByApiId(provider, apiId)?.friendlyName;
  }

  /**
   * Check if a provider exists
   */
  static hasProvider(provider: string): boolean {
    return provider in MODEL_REGISTRY;
  }

  /**
   * Check if a model exists for a provider (by friendly name)
   */
  static hasModel(provider: string, friendlyName: string): boolean {
    const providerConfig = MODEL_REGISTRY[provider];
    return providerConfig ? friendlyName in providerConfig.models : false;
  }

  /**
   * Check if an API model ID exists for a provider
   */
  static hasApiModel(provider: string, apiId: string): boolean {
    return this.getModelConfigByApiId(provider, apiId) !== undefined;
  }

  /**
   * Get default model for a provider
   */
  static getDefaultModel(provider: string): string | undefined {
    return MODEL_REGISTRY[provider]?.defaultModel;
  }

  /**
   * Get available models only
   */
  static getAvailableModels(provider: string): string[] {
    const providerConfig = MODEL_REGISTRY[provider];
    if (!providerConfig) return [];

    return Object.entries(providerConfig.models)
      .filter(([_, config]) => config.available)
      .map(([name, _]) => name);
  }

  /**
   * Get available API model IDs only
   */
  static getAvailableAPIModelIds(provider: string): string[] {
    const providerConfig = MODEL_REGISTRY[provider];
    if (!providerConfig) return [];

    return Object.values(providerConfig.models)
      .filter((config) => config.available)
      .map((config) => config.apiId);
  }

  /**
   * Estimate cost for a given provider, model, and token count
   */
  static estimateCost(
    provider: string,
    friendlyName: string,
    inputTokens: number,
    outputTokens: number = 0
  ): number {
    const modelConfig = this.getModelConfig(provider, friendlyName);
    if (!modelConfig) return 0;

    const inputCost = (inputTokens / 1_000_000) * modelConfig.inputCost;
    const outputCost = (outputTokens / 1_000_000) * modelConfig.outputCost;

    return inputCost + outputCost;
  }

  /**
   * Get models sorted by cost (cheapest first)
   */
  static getModelsByCost(provider: string): Array<{ friendlyName: string; config: ModelConfig }> {
    const providerConfig = MODEL_REGISTRY[provider];
    if (!providerConfig) return [];

    return Object.entries(providerConfig.models)
      .map(([name, config]) => ({ friendlyName: name, config }))
      .sort((a, b) => a.config.inputCost - b.config.inputCost);
  }

  /**
   * Get models sorted by context window (largest first)
   */
  static getModelsByContextWindow(
    provider: string
  ): Array<{ friendlyName: string; config: ModelConfig }> {
    const providerConfig = MODEL_REGISTRY[provider];
    if (!providerConfig) return [];

    return Object.entries(providerConfig.models)
      .map(([name, config]) => ({ friendlyName: name, config }))
      .sort((a, b) => b.config.contextWindow - a.config.contextWindow);
  }

  /**
   * Get models with specific capabilities
   */
  static getModelsByCapability(
    provider: string,
    capability: keyof NonNullable<ModelConfig['capabilities']>
  ): string[] {
    const providerConfig = MODEL_REGISTRY[provider];
    if (!providerConfig) return [];

    return Object.entries(providerConfig.models)
      .filter(([_, config]) => config.available && config.capabilities?.[capability])
      .map(([name, _]) => name);
  }

  /**
   * Get reasoning models for a provider
   */
  static getReasoningModels(provider: string): string[] {
    return this.getModelsByCapability(provider, 'reasoning');
  }

  /**
   * Get vision models for a provider
   */
  static getVisionModels(provider: string): string[] {
    return this.getModelsByCapability(provider, 'imageInput');
  }
}
