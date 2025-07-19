import { describe, it, expect } from 'vitest';
import { ModelRegistry } from '../src/core/ai-providers/model-registry';

describe('ModelRegistry', () => {
  describe('Provider Management', () => {
    it('should return all supported providers', () => {
      const providers = ModelRegistry.getProviders();
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).toContain('groq');
      expect(providers).toContain('ollama');
      expect(providers.length).toBeGreaterThanOrEqual(5);
    });

    it('should validate provider existence', () => {
      expect(ModelRegistry.hasProvider('anthropic')).toBe(true);
      expect(ModelRegistry.hasProvider('openai')).toBe(true);
      expect(ModelRegistry.hasProvider('nonexistent')).toBe(false);
    });

    it('should get provider configuration', () => {
      const anthropicConfig = ModelRegistry.getProvider('anthropic');
      expect(anthropicConfig).toBeDefined();
      expect(anthropicConfig?.name).toBe('anthropic');
      expect(anthropicConfig?.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
      expect(anthropicConfig?.defaultModel).toBe('claude-3-5-sonnet');
    });
  });

  describe('Model Management', () => {
    it('should return available models for each provider', () => {
      const anthropicModels = ModelRegistry.getAvailableModels('anthropic');
      expect(anthropicModels).toContain('claude-3-5-sonnet');
      expect(anthropicModels).toContain('claude-4-opus');
      expect(anthropicModels.length).toBeGreaterThan(5);

      const openaiModels = ModelRegistry.getAvailableModels('openai');
      expect(openaiModels).toContain('gpt-4o');
      expect(openaiModels).toContain('o1');
      expect(openaiModels.length).toBeGreaterThan(10);

      const googleModels = ModelRegistry.getAvailableModels('google');
      expect(googleModels).toContain('gemini-1.5-pro');
      expect(googleModels.length).toBeGreaterThan(3);
    });

    it('should return empty array for invalid provider', () => {
      const models = ModelRegistry.getAvailableModels('invalid');
      expect(models).toEqual([]);
    });

    it('should validate model existence', () => {
      expect(ModelRegistry.hasModel('anthropic', 'claude-3-5-sonnet')).toBe(true);
      expect(ModelRegistry.hasModel('openai', 'gpt-4o')).toBe(true);
      expect(ModelRegistry.hasModel('anthropic', 'nonexistent-model')).toBe(false);
    });

    it('should get default models for providers', () => {
      expect(ModelRegistry.getDefaultModel('anthropic')).toBe('claude-3-5-sonnet');
      expect(ModelRegistry.getDefaultModel('openai')).toBe('gpt-4o');
      expect(ModelRegistry.getDefaultModel('google')).toBe('gemini-1.5-pro');
      expect(ModelRegistry.getDefaultModel('invalid')).toBeUndefined();
    });
  });

  describe('API ID Mapping', () => {
    it('should map friendly names to API IDs correctly', () => {
      expect(ModelRegistry.getApiId('anthropic', 'claude-3-5-sonnet')).toBe('claude-3-5-sonnet-20241022');
      expect(ModelRegistry.getApiId('anthropic', 'claude-4-opus')).toBe('claude-4-opus-20250514');
      expect(ModelRegistry.getApiId('openai', 'gpt-4o')).toBe('gpt-4o');
      expect(ModelRegistry.getApiId('google', 'gemini-2.0-flash-exp')).toBe('gemini-2.0-flash-exp');
    });

    it('should return undefined for invalid mappings', () => {
      expect(ModelRegistry.getApiId('anthropic', 'nonexistent')).toBeUndefined();
      expect(ModelRegistry.getApiId('invalid', 'any-model')).toBeUndefined();
    });

    it('should map API IDs back to friendly names', () => {
      expect(ModelRegistry.getFriendlyName('anthropic', 'claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet');
      expect(ModelRegistry.getFriendlyName('openai', 'gpt-4o')).toBe('gpt-4o');
    });

    it('should get all API IDs for a provider', () => {
      const anthropicApiIds = ModelRegistry.getAPIModelIds('anthropic');
      expect(anthropicApiIds).toContain('claude-3-5-sonnet-20241022');
      expect(anthropicApiIds).toContain('claude-4-opus-20250514');

      const openaiApiIds = ModelRegistry.getAPIModelIds('openai');
      expect(openaiApiIds).toContain('gpt-4o');
      expect(openaiApiIds).toContain('o1');
    });

    it('should validate API model existence', () => {
      expect(ModelRegistry.hasApiModel('anthropic', 'claude-3-5-sonnet-20241022')).toBe(true);
      expect(ModelRegistry.hasApiModel('openai', 'gpt-4o')).toBe(true);
      expect(ModelRegistry.hasApiModel('anthropic', 'invalid-api-id')).toBe(false);
    });
  });

  describe('Model Configuration', () => {
    it('should get detailed model configuration', () => {
      const claudeConfig = ModelRegistry.getModelConfig('anthropic', 'claude-3-5-sonnet');
      expect(claudeConfig).toBeDefined();
      expect(claudeConfig?.friendlyName).toBe('claude-3-5-sonnet');
      expect(claudeConfig?.apiId).toBe('claude-3-5-sonnet-20241022');
      expect(claudeConfig?.displayName).toBe('Claude 3.5 Sonnet');
      expect(claudeConfig?.contextWindow).toBe(200000);
      expect(claudeConfig?.inputCost).toBe(3);
      expect(claudeConfig?.outputCost).toBe(15);
      expect(claudeConfig?.supportsFunctions).toBe(true);
      expect(claudeConfig?.available).toBe(true);

      const gptConfig = ModelRegistry.getModelConfig('openai', 'gpt-4o');
      expect(gptConfig).toBeDefined();
      expect(gptConfig?.contextWindow).toBe(128000);
      expect(gptConfig?.inputCost).toBe(5);
      expect(gptConfig?.outputCost).toBe(15);
    });

    it('should return undefined for invalid model config', () => {
      expect(ModelRegistry.getModelConfig('anthropic', 'nonexistent')).toBeUndefined();
      expect(ModelRegistry.getModelConfig('invalid', 'any-model')).toBeUndefined();
    });

    it('should get model config by API ID', () => {
      const config = ModelRegistry.getModelConfigByApiId('anthropic', 'claude-3-5-sonnet-20241022');
      expect(config?.friendlyName).toBe('claude-3-5-sonnet');
      expect(config?.displayName).toBe('Claude 3.5 Sonnet');
    });
  });

  describe('Cost Estimation', () => {
    it('should calculate costs correctly', () => {
      // Test Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
      const claudeCost = ModelRegistry.estimateCost('anthropic', 'claude-3-5-sonnet', 1000, 500);
      expect(claudeCost).toBeCloseTo(0.0105); // (1000/1M * 3) + (500/1M * 15) = 0.003 + 0.0075 = 0.0105

      // Test GPT-4o: $5/MTok input, $15/MTok output
      const gptCost = ModelRegistry.estimateCost('openai', 'gpt-4o', 2000, 1000);
      expect(gptCost).toBeCloseTo(0.025); // (2000/1M * 5) + (1000/1M * 15) = 0.01 + 0.015 = 0.025

      // Test with only input tokens
      const inputOnlyCost = ModelRegistry.estimateCost('anthropic', 'claude-3-5-sonnet', 1000);
      expect(inputOnlyCost).toBeCloseTo(0.003); // 1000/1M * 3 = 0.003
    });

    it('should return 0 for invalid models', () => {
      expect(ModelRegistry.estimateCost('invalid', 'model', 1000, 500)).toBe(0);
      expect(ModelRegistry.estimateCost('anthropic', 'invalid', 1000, 500)).toBe(0);
    });

    it('should handle free models (Ollama)', () => {
      const ollamaCost = ModelRegistry.estimateCost('ollama', 'llama3', 1000, 500);
      expect(ollamaCost).toBe(0);
    });
  });

  describe('Capability Filtering', () => {
    it('should find vision models', () => {
      const anthropicVision = ModelRegistry.getVisionModels('anthropic');
      expect(anthropicVision).toContain('claude-3-5-sonnet');
      expect(anthropicVision).toContain('claude-4-opus');
      expect(anthropicVision.length).toBeGreaterThan(5);

      const openaiVision = ModelRegistry.getVisionModels('openai');
      expect(openaiVision).toContain('gpt-4o');
      expect(openaiVision).toContain('gpt-4.1');

      const groqVision = ModelRegistry.getVisionModels('groq');
      expect(groqVision).toContain('llama-4-scout');
    });

    it('should find reasoning models', () => {
      const anthropicReasoning = ModelRegistry.getReasoningModels('anthropic');
      expect(anthropicReasoning).toContain('claude-4-opus');
      expect(anthropicReasoning).toContain('claude-4-sonnet');
      expect(anthropicReasoning).toContain('claude-3-7-sonnet');

      const openaiReasoning = ModelRegistry.getReasoningModels('openai');
      expect(openaiReasoning).toContain('o1');
      expect(openaiReasoning).toContain('o3');
      expect(openaiReasoning).toContain('o3-mini');

      const groqReasoning = ModelRegistry.getReasoningModels('groq');
      expect(groqReasoning).toContain('qwen-qwq-32b');
      expect(groqReasoning).toContain('deepseek-r1');
    });

    it('should return empty arrays for providers without capabilities', () => {
      const ollamaVision = ModelRegistry.getVisionModels('ollama');
      expect(ollamaVision).toEqual([]);

      const ollamaReasoning = ModelRegistry.getReasoningModels('ollama');
      expect(ollamaReasoning).toEqual([]);
    });

    it('should find models by custom capabilities', () => {
      const computerUseModels = ModelRegistry.getModelsByCapability('anthropic', 'computerUse');
      expect(computerUseModels).toContain('claude-4-opus');
      expect(computerUseModels).toContain('claude-4-sonnet');
      expect(computerUseModels).toContain('claude-3-7-sonnet');

      const webSearchModels = ModelRegistry.getModelsByCapability('anthropic', 'webSearch');
      expect(webSearchModels).toContain('claude-4-opus');
      expect(webSearchModels).toContain('claude-3-5-sonnet');
    });
  });

  describe('Model Sorting', () => {
    it('should sort models by cost (cheapest first)', () => {
      const sortedByCost = ModelRegistry.getModelsByCost('anthropic');
      expect(sortedByCost.length).toBeGreaterThan(0);

      // Verify sorting order (cheapest first)
      for (let i = 1; i < sortedByCost.length; i++) {
        expect(sortedByCost[i].config.inputCost).toBeGreaterThanOrEqual(
          sortedByCost[i - 1].config.inputCost
        );
      }

      // Claude 3 Haiku should be among the cheapest
      const haikuIndex = sortedByCost.findIndex(m => m.friendlyName === 'claude-3-haiku');
      expect(haikuIndex).toBeGreaterThanOrEqual(0);
      expect(haikuIndex).toBeLessThan(3); // Should be in first few positions
    });

    it('should sort models by context window (largest first)', () => {
      const sortedByContext = ModelRegistry.getModelsByContextWindow('anthropic');
      expect(sortedByContext.length).toBeGreaterThan(0);

      // Verify sorting order (largest first)
      for (let i = 1; i < sortedByContext.length; i++) {
        expect(sortedByContext[i].config.contextWindow).toBeLessThanOrEqual(
          sortedByContext[i - 1].config.contextWindow
        );
      }

      // All Claude models should have 200k context
      expect(sortedByContext[0].config.contextWindow).toBe(200000);
    });

    it('should return empty arrays for invalid providers', () => {
      expect(ModelRegistry.getModelsByCost('invalid')).toEqual([]);
      expect(ModelRegistry.getModelsByContextWindow('invalid')).toEqual([]);
    });
  });

  describe('Model Features', () => {
    it('should correctly identify model capabilities', () => {
      const claude4Opus = ModelRegistry.getModelConfig('anthropic', 'claude-4-opus');
      expect(claude4Opus?.capabilities?.imageInput).toBe(true);
      expect(claude4Opus?.capabilities?.computerUse).toBe(true);
      expect(claude4Opus?.capabilities?.webSearch).toBe(true);
      expect(claude4Opus?.capabilities?.reasoning).toBe(true);

      const gpt4o = ModelRegistry.getModelConfig('openai', 'gpt-4o');
      expect(gpt4o?.capabilities?.imageInput).toBe(true);
      expect(gpt4o?.capabilities?.reasoning).toBeUndefined();

      const o1 = ModelRegistry.getModelConfig('openai', 'o1');
      expect(o1?.capabilities?.reasoning).toBe(true);
      expect(o1?.capabilities?.imageInput).toBe(true);
    });

    it('should correctly identify function support', () => {
      const claude = ModelRegistry.getModelConfig('anthropic', 'claude-3-5-sonnet');
      expect(claude?.supportsFunctions).toBe(true);

      const gpt = ModelRegistry.getModelConfig('openai', 'gpt-4o');
      expect(gpt?.supportsFunctions).toBe(true);

      const ollama = ModelRegistry.getModelConfig('ollama', 'llama3');
      expect(ollama?.supportsFunctions).toBe(false);
    });

    it('should have correct pricing information', () => {
      // Verify some known pricing
      const claude3Haiku = ModelRegistry.getModelConfig('anthropic', 'claude-3-haiku');
      expect(claude3Haiku?.inputCost).toBe(0.25);
      expect(claude3Haiku?.outputCost).toBe(1.25);

      const gpt4oMini = ModelRegistry.getModelConfig('openai', 'gpt-4o-mini');
      expect(gpt4oMini?.inputCost).toBe(0.15);
      expect(gpt4oMini?.outputCost).toBe(0.6);

      // Ollama models should be free
      const ollamaModel = ModelRegistry.getModelConfig('ollama', 'llama3');
      expect(ollamaModel?.inputCost).toBe(0);
      expect(ollamaModel?.outputCost).toBe(0);
    });
  });

  describe('Provider-Specific Features', () => {
    it('should handle Anthropic-specific models', () => {
      const anthropicModels = ModelRegistry.getAvailableModels('anthropic');
      expect(anthropicModels).toContain('claude-4-opus');
      expect(anthropicModels).toContain('claude-4-sonnet');
      expect(anthropicModels).toContain('claude-3-7-sonnet');
      expect(anthropicModels).toContain('claude-3-5-sonnet-legacy');
    });

    it('should handle OpenAI reasoning models', () => {
      const reasoningModels = ModelRegistry.getReasoningModels('openai');
      expect(reasoningModels).toContain('o1');
      expect(reasoningModels).toContain('o3');
      expect(reasoningModels).toContain('o4-mini');
    });

    it('should handle Google experimental models', () => {
      const googleModels = ModelRegistry.getAvailableModels('google');
      expect(googleModels).toContain('gemini-2.0-flash-exp');
      expect(googleModels).toContain('gemini-2.0-flash-thinking-exp');
    });

    it('should handle Groq specialized models', () => {
      const groqModels = ModelRegistry.getAvailableModels('groq');
      expect(groqModels).toContain('qwen-qwq-32b'); // Reasoning
      expect(groqModels).toContain('llama-4-scout'); // Vision
      expect(groqModels).toContain('deepseek-r1'); // Reasoning
    });

    it('should handle Ollama local models', () => {
      const ollamaModels = ModelRegistry.getAvailableModels('ollama');
      expect(ollamaModels).toContain('llama3.2');
      expect(ollamaModels).toContain('codellama');
      expect(ollamaModels).toContain('qwen2.5-coder');
      expect(ollamaModels).toContain('deepseek-coder');

      // All should be free
      ollamaModels.forEach(modelName => {
        const config = ModelRegistry.getModelConfig('ollama', modelName);
        expect(config?.inputCost).toBe(0);
        expect(config?.outputCost).toBe(0);
      });
    });
  });
});
