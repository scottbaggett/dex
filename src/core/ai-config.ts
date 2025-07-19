import { AIConfig, AIProvider, AIProviderConfig, AIModelConfig } from '../types/ai-context';
import { ModelRegistry } from './ai-providers/model-registry';

/**
 * Default AI provider configurations
 */
/**
 * Build AI provider configurations from unified model registry
 */
function buildProviderConfigs(): Record<AIProvider, AIProviderConfig> {
  const configs: Record<string, AIProviderConfig> = {};

  for (const providerName of ModelRegistry.getProviders()) {
    const providerModels = ModelRegistry.getProvider(providerName);
    if (!providerModels) continue;

    // Convert model registry format to legacy AIProviderConfig format
    const models: Record<string, AIModelConfig> = {};
    for (const [friendlyName, modelConfig] of Object.entries(providerModels.models)) {
      models[friendlyName] = {
        id: modelConfig.apiId,
        name: modelConfig.displayName,
        contextWindow: modelConfig.contextWindow,
        inputCost: modelConfig.inputCost,
        outputCost: modelConfig.outputCost,
        supportsFunctions: modelConfig.supportsFunctions,
      };
    }

    configs[providerName] = {
      name: providerName as AIProvider,
      apiKeyEnvVar: providerModels.apiKeyEnvVar,
      baseUrl: providerModels.baseUrl,
      defaultModel: providerModels.defaultModel,
      models,
    };
  }

  return configs as Record<AIProvider, AIProviderConfig>;
}

export const DEFAULT_AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = buildProviderConfigs();

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG = {
  provider: 'anthropic' as AIProvider,
  model: 'claude-3-5-sonnet',
  apiKey: undefined as string | undefined,
  providers: DEFAULT_AI_PROVIDERS,
  bootstrap: {
    prompt:
      'I am a new agent and want to understand this codebase so I can effectively contribute. Please select the most important files that would help me understand the architecture, core functionality, and how to get started.',
    includePriority: ['high', 'medium'],
    maxFiles: 20,
  },
  templates: {
    architect:
      'Analyze this codebase from an architectural perspective. Focus on design patterns, system boundaries, and overall structure.',
    engineer:
      'Review this code for implementation details, best practices, and potential improvements.',
    security:
      'Perform a security review of this codebase. Look for vulnerabilities, security anti-patterns, and areas of concern.',
    performance:
      'Analyze this code for performance issues, bottlenecks, and optimization opportunities.',
    testing: 'Review the testing strategy and coverage. Identify areas that need better testing.',
    documentation:
      'Review the documentation and code comments. Identify areas that need better documentation.',
  },
  interactive: {
    autoAcceptThreshold: 0.8,
    showReasoning: true,
    groupByPriority: true,
    preSelectHigh: true,
    preSelectMedium: false,
    preSelectLow: false,
  },
  performance: {
    enableCaching: true,
    cacheTtl: 3600, // 1 hour
    maxConcurrentRequests: 3,
    requestTimeout: 30000, // 30 seconds
  },
};

/**
 * Configuration validation errors
 */
export class AIConfigError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'AIConfigError';
  }
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: Partial<AIConfig>): string[] {
  const errors: string[] = [];

  // Validate provider
  if (config.provider && !Object.keys(DEFAULT_AI_PROVIDERS).includes(config.provider)) {
    errors.push(
      `Invalid AI provider: ${config.provider}. Supported providers: ${Object.keys(DEFAULT_AI_PROVIDERS).join(', ')}`
    );
  }

  // Validate model for provider
  if (config.provider && config.model) {
    const providerConfig = DEFAULT_AI_PROVIDERS[config.provider];
    if (providerConfig && !providerConfig.models[config.model]) {
      const availableModels = Object.keys(providerConfig.models).join(', ');
      errors.push(
        `Invalid model '${config.model}' for provider '${config.provider}'. Available models: ${availableModels}`
      );
    }
  }

  // Validate bootstrap config
  if (config.bootstrap) {
    if (
      config.bootstrap.maxFiles !== undefined &&
      (config.bootstrap.maxFiles < 1 || config.bootstrap.maxFiles > 100)
    ) {
      errors.push('bootstrap.maxFiles must be between 1 and 100');
    }

    if (config.bootstrap.includePriority) {
      const validPriorities = ['high', 'medium', 'low'];
      const invalidPriorities = config.bootstrap.includePriority.filter(
        (p) => !validPriorities.includes(p)
      );
      if (invalidPriorities.length > 0) {
        errors.push(
          `Invalid priority levels: ${invalidPriorities.join(', ')}. Valid priorities: ${validPriorities.join(', ')}`
        );
      }
    }
  }

  // Validate interactive config
  if (config.interactive?.autoAcceptThreshold !== undefined) {
    const threshold = config.interactive.autoAcceptThreshold;
    if (threshold < 0 || threshold > 1) {
      errors.push('interactive.autoAcceptThreshold must be between 0 and 1');
    }
  }

  // Validate performance config
  if (config.performance) {
    if (config.performance.cacheTtl !== undefined && config.performance.cacheTtl < 0) {
      errors.push('performance.cacheTtl must be non-negative');
    }

    if (
      config.performance.maxConcurrentRequests !== undefined &&
      config.performance.maxConcurrentRequests < 1
    ) {
      errors.push('performance.maxConcurrentRequests must be at least 1');
    }

    if (
      config.performance.requestTimeout !== undefined &&
      config.performance.requestTimeout < 1000
    ) {
      errors.push('performance.requestTimeout must be at least 1000ms');
    }
  }

  return errors;
}

/**
 * Merge user configuration with defaults
 */
export function mergeAIConfig(userConfig: Partial<AIConfig> = {}): typeof DEFAULT_AI_CONFIG {
  const merged = {
    ...DEFAULT_AI_CONFIG,
    ...userConfig,
    bootstrap: {
      ...DEFAULT_AI_CONFIG.bootstrap,
      ...userConfig.bootstrap,
    },
    templates: {
      ...DEFAULT_AI_CONFIG.templates,
      ...userConfig.templates,
    },
    interactive: {
      ...DEFAULT_AI_CONFIG.interactive,
      ...userConfig.interactive,
    },
    performance: {
      ...DEFAULT_AI_CONFIG.performance,
      ...userConfig.performance,
    },
    providers: DEFAULT_AI_PROVIDERS,
  };

  return merged;
}

/**
 * Get API key from environment or configuration
 */
export function getAPIKey(config: typeof DEFAULT_AI_CONFIG): string | undefined {
  // First check explicit API key in config
  if (config.apiKey) {
    return config.apiKey;
  }

  // Then check environment variable for the provider
  const providerConfig = config.providers[config.provider];
  if (providerConfig?.apiKeyEnvVar) {
    const envKey = process.env[providerConfig.apiKeyEnvVar];
    if (envKey) {
      return envKey;
    }
  }

  // For Ollama, API key is optional (local deployment)
  if (config.provider === 'ollama') {
    return undefined;
  }

  return undefined;
}

/**
 * Check if AI is properly configured
 */
export function isAIConfigured(config: typeof DEFAULT_AI_CONFIG): boolean {
  // Ollama doesn't require API key for local deployment
  if (config.provider === 'ollama') {
    return true;
  }

  // Other providers require API key
  return getAPIKey(config) !== undefined;
}

/**
 * Get model configuration for current provider and model
 */
export function getModelConfig(config: typeof DEFAULT_AI_CONFIG): AIModelConfig | undefined {
  const providerConfig = config.providers[config.provider];
  if (!providerConfig || !providerConfig.models) {
    return undefined;
  }

  return providerConfig.models[config.model];
}

/**
 * Get provider configuration
 */
export function getProviderConfig(config: typeof DEFAULT_AI_CONFIG): AIProviderConfig | undefined {
  return config.providers[config.provider];
}

/**
 * Create a configuration summary for display
 */
export function getConfigSummary(config: typeof DEFAULT_AI_CONFIG): {
  provider: string;
  model: string;
  configured: boolean;
  apiKeySource?: string;
  modelInfo?: {
    name: string;
    contextWindow: number;
    inputCost: number;
    outputCost?: number;
  };
} {
  const modelConfig = getModelConfig(config);
  const apiKey = getAPIKey(config);
  const providerConfig = getProviderConfig(config);

  let apiKeySource: string | undefined;
  if (config.apiKey) {
    apiKeySource = 'configuration';
  } else if (apiKey && providerConfig?.apiKeyEnvVar) {
    apiKeySource = `environment (${providerConfig.apiKeyEnvVar})`;
  }

  return {
    provider: config.provider,
    model: config.model,
    configured: isAIConfigured(config),
    apiKeySource,
    modelInfo: modelConfig
      ? {
          name: modelConfig.name,
          contextWindow: modelConfig.contextWindow,
          inputCost: modelConfig.inputCost,
          outputCost: modelConfig.outputCost,
        }
      : undefined,
  };
}
