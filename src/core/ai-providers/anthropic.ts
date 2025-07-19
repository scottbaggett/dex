import {
  AIProvider,
  AIPrioritizationRequest,
  AIPrioritizationResponse,
  AIProviderConfig,
  AIProviderError,
  AIRateLimitError,
  AIAuthError,
  AIQuotaError,
  FilePrioritySchema,
  buildFilePrioritizationPrompt,
} from './base';
import { ModelRegistry } from './model-registry';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { LanguageModel } from 'ai';
/**
 * Anthropic Claude provider using AI SDK
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  get models(): string[] {
    return ModelRegistry.getAvailableModels(this.name);
  }

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  getModel(config: AIProviderConfig): LanguageModel {
    // Convert friendly name to API ID
    const apiId = ModelRegistry.getApiId(this.name, config.model) || config.model;
    return anthropic(apiId);
  }

  async prioritizeFiles(
    request: AIPrioritizationRequest,
    config: AIProviderConfig
  ): Promise<AIPrioritizationResponse> {
    if (!this.isConfigured() && !config.apiKey) {
      throw new AIAuthError(this.name);
    }

    const model = this.getModel(config);
    const prompt = buildFilePrioritizationPrompt(request);

    try {
      const result = await generateObject({
        model,
        schema: FilePrioritySchema,
        prompt,
        temperature: config.temperature || 0.3,
      });

      return result.object;
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      // Handle common AI SDK errors
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw new AIAuthError(this.name);
        }
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw new AIRateLimitError(this.name);
        }
        if (error.message.includes('quota') || error.message.includes('billing')) {
          throw new AIQuotaError(this.name);
        }
      }

      throw new AIProviderError(
        `Failed to prioritize files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name
      );
    }
  }

  async estimateCost(request: AIPrioritizationRequest, config: AIProviderConfig): Promise<number> {
    // Estimate tokens for the prompt
    const prompt = buildFilePrioritizationPrompt(request);
    const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimate: 4 chars per token

    // Use model registry for accurate pricing
    return ModelRegistry.estimateCost(this.name, config.model, estimatedTokens, 0);
  }
}
