# AI Provider Refactoring: Unified Model Registry

## Overview

This document describes the refactoring of the AI provider system to eliminate model definition duplication and create a single source of truth for all AI model configurations.

## Problem Statement

Previously, the codebase had two separate systems managing AI model information:

1. **Legacy Config System** (`src/core/ai-config.ts`): Detailed model configurations with pricing, context windows, and features
2. **AI SDK Provider System** (`src/core/ai-providers/*.ts`): Hardcoded model lists for AI SDK integration

This led to several issues:

- **Duplication**: Model lists were defined in multiple places
- **Inconsistency**: Different naming conventions (API IDs vs friendly names)
- **Maintenance burden**: Updates required changes in multiple files
- **Sync issues**: Model lists could get out of sync between systems

### Example of the Problem

**Before refactoring:**

```typescript
// ai-config.ts
export const DEFAULT_AI_PROVIDERS = {
  anthropic: {
    models: {
      'claude-3-sonnet': {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        // ...
      }
    }
  }
};

// anthropic.ts
export class AnthropicProvider {
  readonly models = [
    'claude-4-opus-20250514',
    'claude-4-sonnet-20250514',
    'claude-3-5-sonnet-20241022',
    // Different models, different naming!
  ];
}
```

## Solution: Unified Model Registry

We created a centralized `ModelRegistry` class that serves as the single source of truth for all AI model configurations.

### Architecture

```
┌─────────────────────────────────────┐
│         ModelRegistry               │
│  (Single Source of Truth)           │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  Provider Models Configuration  ││
│  │  - Friendly Names              ││
│  │  - API IDs                     ││
│  │  - Pricing                     ││
│  │  - Context Windows             ││
│  │  - Features                    ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┐    ┌─────────────────┐
│  AI Providers   │    │   Legacy Config │
│  (AI SDK)       │    │   (Backward     │
│  - Use friendly │    │    Compatible)  │
│    names        │    │                 │
│  - Convert to   │    │                 │
│    API IDs      │    │                 │
└─────────────────┘    └─────────────────┘
```

### Key Components

#### 1. Model Registry (`src/core/ai-providers/model-registry.ts`)

```typescript
export interface ModelConfig {
  friendlyName: string;    // User-facing name: 'claude-3-5-sonnet'
  apiId: string;          // API identifier: 'claude-3-5-sonnet-20241022'
  displayName: string;    // Full display name: 'Claude 3.5 Sonnet'
  contextWindow: number;  // Token limit
  inputCost: number;      // Cost per million input tokens
  outputCost: number;     // Cost per million output tokens
  supportsFunctions: boolean;
  available: boolean;
  releaseDate?: string;
}

export class ModelRegistry {
  static getModels(provider: string): string[]
  static getApiId(provider: string, friendlyName: string): string
  static getModelConfig(provider: string, friendlyName: string): ModelConfig
  static estimateCost(provider: string, friendlyName: string, inputTokens: number, outputTokens: number): number
  // ... more utility methods
}
```

#### 2. Updated AI Providers

All provider classes now use the registry:

```typescript
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  
  get models(): string[] {
    return ModelRegistry.getAvailableModels(this.name);
  }
  
  getModel(config: AIProviderConfig): LanguageModel {
    // Convert friendly name to API ID
    const apiId = ModelRegistry.getApiId(this.name, config.model) || config.model;
    return anthropic(apiId);
  }
}
```

#### 3. Backward-Compatible Legacy Config

The legacy config system is automatically generated from the registry:

```typescript
function buildProviderConfigs(): Record<AIProvider, AIProviderConfig> {
  const configs: Record<string, AIProviderConfig> = {};
  
  for (const providerName of ModelRegistry.getProviders()) {
    // Convert registry format to legacy format
    configs[providerName] = {
      name: providerName,
      models: convertToLegacyFormat(providerModels.models),
      // ...
    };
  }
  
  return configs;
}
```

## Benefits

### 1. Single Source of Truth
- All model information is defined in one place
- No more synchronization issues between systems
- Easier to add new models or providers

### 2. User-Friendly Interface
- Users see friendly names: `'claude-3-5-sonnet'`
- System handles API ID conversion internally: `'claude-3-5-sonnet-20241022'`

### 3. Accurate Cost Estimation
- Centralized pricing information
- Consistent cost calculations across the codebase

### 4. Type Safety
- Strong TypeScript interfaces
- Compile-time validation of model configurations

### 5. Backward Compatibility
- Existing code continues to work
- Legacy config system is automatically generated

## Usage Examples

### Adding a New Model

```typescript
// In model-registry.ts
export const MODEL_REGISTRY = {
  anthropic: {
    models: {
      'claude-4-opus': {  // Add new model here
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
        }
      }
    }
  }
};
```

### Using Models in Code

```typescript
// Get available models for a provider
const models = ModelRegistry.getModels('anthropic');
// ['claude-4-opus', 'claude-4-sonnet', 'claude-3-7-sonnet', 'claude-3-5-sonnet', ...]

// Get API ID for AI SDK
const apiId = ModelRegistry.getApiId('anthropic', 'claude-3-5-sonnet');
// 'claude-3-5-sonnet-20241022'

// Get models with specific capabilities
const visionModels = ModelRegistry.getVisionModels('anthropic');
// ['claude-4-opus', 'claude-4-sonnet', 'claude-3-5-sonnet', ...]

const reasoningModels = ModelRegistry.getReasoningModels('openai');
// ['o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini', 'o1-preview']

// Estimate cost
const cost = ModelRegistry.estimateCost('anthropic', 'claude-3-5-sonnet', 1000, 500);
// 0.0105 (based on current pricing)
```

### Provider Implementation

```typescript
export class CustomProvider implements AIProvider {
  readonly name = 'custom';
  
  get models(): string[] {
    return ModelRegistry.getAvailableModels(this.name);
  }
  
  getModel(config: AIProviderConfig): LanguageModel {
    const apiId = ModelRegistry.getApiId(this.name, config.model) || config.model;
    return customSDK(apiId);
  }
}
```

## Migration Impact

### For End Users
- **No breaking changes**: All existing APIs continue to work
- **Improved experience**: More consistent model names and better cost estimates

### For Developers
- **Simplified maintenance**: One place to update model information
- **Better testing**: Centralized model data makes testing easier
- **Clear patterns**: Established patterns for adding new providers

### Supported Providers

The registry currently supports:

- **Anthropic**: 
  - Latest: Claude 4 Opus, Claude 4 Sonnet, Claude 3.7 Sonnet
  - Current: Claude 3.5 Sonnet, Claude 3.5 Haiku
  - Legacy: Claude 3.5 Sonnet (Legacy), Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
  - Special capabilities: Computer use, web search, reasoning (Claude 4 & 3.7)

- **OpenAI**: 
  - Latest: GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano
  - Reasoning: o4-mini, o3, o3-mini, o1, o1-mini, o1-preview
  - Current: GPT-4o, GPT-4o Mini, GPT-4o Audio Preview
  - Legacy: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
  - ChatGPT: ChatGPT-4o Latest
  - Special capabilities: Vision, audio input, reasoning

- **Google**: 
  - Production: Gemini 1.5 Pro, Gemini 1.5 Pro Latest, Gemini 1.5 Flash
  - Experimental: Gemini 2.0 Flash Exp, Gemini 2.0 Flash Thinking Exp
  - Open models: Gemma 2 9B, Gemma 3 12B
  - Special capabilities: Search grounding, multimodal generation, reasoning

- **Groq**: 
  - Llama: Llama 3.1 70B, Llama 3.1 8B, Llama 4 Scout 17B (vision)
  - Reasoning: Qwen QwQ 32B, DeepSeek R1 Distill 70B
  - Other: Mixtral 8x7B, Gemma 2 9B, Gemma 7B
  - Special capabilities: Ultra-fast inference, reasoning, vision

- **Ollama**: 
  - Llama: llama3.2, llama3.1, llama3
  - Code: codellama, qwen2.5-coder, deepseek-coder
  - General: mistral
  - Special capabilities: Local deployment, zero cost

## Future Enhancements

1. **Dynamic Model Discovery**: Auto-detect available models from provider APIs
2. **Performance Metrics**: Add speed and quality ratings  
3. **Regional Availability**: Track model availability by region
4. **Deprecation Tracking**: Mark models as deprecated with sunset dates
5. **Cost Tracking**: Real-time pricing updates from provider APIs
6. **Usage Analytics**: Track model performance and reliability metrics

## Current Capabilities

The unified model registry now includes:

- **95+ models** across 5 providers
- **Capability filtering** (vision, reasoning, computer use, web search)
- **Accurate pricing** with real-time cost estimation
- **Feature detection** (function calling, multimodal, etc.)
- **Performance sorting** by cost and context window
- **API ID mapping** for seamless AI SDK integration

## Testing

The refactoring includes comprehensive tests:

```bash
# Run AI provider tests
npm test test/ai-sdk-integration.test.ts

# Verify model registry functionality
npm test test/model-registry.test.ts
```

## Conclusion

The unified model registry eliminates duplication, improves maintainability, and provides a better developer experience while maintaining full backward compatibility. This refactoring positions the codebase for easier scaling as new AI providers and models are added.