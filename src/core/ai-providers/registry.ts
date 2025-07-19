import { AIProvider } from './base';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';
import { GroqProvider } from './groq';

/**
 * Registry of all available AI providers
 */
export class AIProviderRegistry {
    private providers: Map<string, AIProvider> = new Map();

    constructor() {
        // Register all available providers
        this.registerProvider(new AnthropicProvider());
        this.registerProvider(new OpenAIProvider());
        this.registerProvider(new GoogleProvider());
        this.registerProvider(new GroqProvider());
    }

    /**
     * Register a new AI provider
     */
    registerProvider(provider: AIProvider): void {
        this.providers.set(provider.name, provider);
    }

    /**
     * Get a provider by name
     */
    getProvider(name: string): AIProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Get all available providers
     */
    getAllProviders(): AIProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Get all configured providers (those with valid API keys)
     */
    getConfiguredProviders(): AIProvider[] {
        return this.getAllProviders().filter(provider => provider.isConfigured());
    }

    /**
     * Get provider names
     */
    getProviderNames(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Check if a provider exists
     */
    hasProvider(name: string): boolean {
        return this.providers.has(name);
    }

    /**
     * Get the first configured provider (fallback)
     */
    getDefaultProvider(): AIProvider | undefined {
        const configured = this.getConfiguredProviders();
        return configured.length > 0 ? configured[0] : undefined;
    }
}

// Export a singleton instance
export const aiProviderRegistry = new AIProviderRegistry();