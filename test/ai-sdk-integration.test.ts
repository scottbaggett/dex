import { describe, it, expect, vi } from 'vitest';
import { aiProviderRegistry } from '../src/core/ai-providers/registry';
import { AnthropicProvider } from '../src/core/ai-providers/anthropic';
import { OpenAIProvider } from '../src/core/ai-providers/openai';
import { GoogleProvider } from '../src/core/ai-providers/google';
import { GroqProvider } from '../src/core/ai-providers/groq';

describe('AI SDK Integration', () => {
  describe('AI Provider Registry', () => {
    it('should register all providers', () => {
      const providers = aiProviderRegistry.getAllProviders();
      expect(providers).toHaveLength(4);

      const providerNames = aiProviderRegistry.getProviderNames();
      expect(providerNames).toContain('anthropic');
      expect(providerNames).toContain('openai');
      expect(providerNames).toContain('google');
      expect(providerNames).toContain('groq');
    });

    it('should get providers by name', () => {
      const anthropic = aiProviderRegistry.getProvider('anthropic');
      expect(anthropic).toBeInstanceOf(AnthropicProvider);

      const openai = aiProviderRegistry.getProvider('openai');
      expect(openai).toBeInstanceOf(OpenAIProvider);

      const google = aiProviderRegistry.getProvider('google');
      expect(google).toBeInstanceOf(GoogleProvider);

      const groq = aiProviderRegistry.getProvider('groq');
      expect(groq).toBeInstanceOf(GroqProvider);
    });

    it('should return undefined for unknown providers', () => {
      const unknown = aiProviderRegistry.getProvider('unknown');
      expect(unknown).toBeUndefined();
    });
  });

  describe('AI Providers', () => {
    it('should have correct provider names', () => {
      const anthropic = new AnthropicProvider();
      expect(anthropic.name).toBe('anthropic');

      const openai = new OpenAIProvider();
      expect(openai.name).toBe('openai');

      const google = new GoogleProvider();
      expect(google.name).toBe('google');

      const groq = new GroqProvider();
      expect(groq.name).toBe('groq');
    });

    it('should have models defined', () => {
      const anthropic = new AnthropicProvider();
      expect(anthropic.models.length).toBeGreaterThan(0);
      expect(anthropic.models).toContain('claude-3-5-sonnet');

      const openai = new OpenAIProvider();
      expect(openai.models.length).toBeGreaterThan(0);
      expect(openai.models).toContain('gpt-4o');

      const google = new GoogleProvider();
      expect(google.models.length).toBeGreaterThan(0);
      expect(google.models).toContain('gemini-1.5-pro');

      const groq = new GroqProvider();
      expect(groq.models.length).toBeGreaterThan(0);
      expect(groq.models).toContain('llama-3.1-70b');
    });

    it('should check configuration correctly', () => {
      // Mock environment variables
      const originalEnv = process.env;

      // Test without API keys
      process.env = { ...originalEnv };
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.GROQ_API_KEY;

      const anthropic = new AnthropicProvider();
      expect(anthropic.isConfigured()).toBe(false);

      const openai = new OpenAIProvider();
      expect(openai.isConfigured()).toBe(false);

      const google = new GoogleProvider();
      expect(google.isConfigured()).toBe(false);

      const groq = new GroqProvider();
      expect(groq.isConfigured()).toBe(false);

      // Test with API keys
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
      process.env.GROQ_API_KEY = 'test-key';

      expect(anthropic.isConfigured()).toBe(true);
      expect(openai.isConfigured()).toBe(true);
      expect(google.isConfigured()).toBe(true);
      expect(groq.isConfigured()).toBe(true);

      // Restore environment
      process.env = originalEnv;
    });

    it('should create AI SDK models', () => {
      const anthropic = new AnthropicProvider();
      const config = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      };

      const model = anthropic.getModel(config);
      expect(model).toBeDefined();
      expect(typeof model).toBe('object');
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate costs for different providers', async () => {
      const mockRequest = {
        files: [
          {
            path: '/test/file.ts',
            relativePath: 'test/file.ts',
            content: 'console.log("test");',
            size: 20,
            extension: 'ts',
            directory: 'test',
          },
        ],
        prompt: 'Analyze this code',
        maxFiles: 10,
      };

      const config = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      };

      const anthropic = new AnthropicProvider();
      const cost = await anthropic.estimateCost(mockRequest, config);

      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });
});
