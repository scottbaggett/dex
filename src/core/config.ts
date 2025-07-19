import { cosmiconfigSync } from 'cosmiconfig';
import { DexOptions } from '../types';
import { PromptsConfig } from '../types/prompts';
import { AIConfig } from '../types/ai-context';
import { mergeAIConfig, validateAIConfig, AIConfigError, DEFAULT_AI_CONFIG } from './ai-config';

export interface DexConfig {
  defaults?: Partial<DexOptions>;
  filters?: {
    ignorePaths?: string[];
    includeTypes?: string[];
  };
  tasks?: {
    defaultSource?: string;
  };
  prompts?: PromptsConfig['prompts'];
  distiller?: {
    defaultOutput?: 'save' | 'clipboard' | 'stdout';
    saveDirectory?: string;
    excludePatterns?: string[];
  };
  ai?: AIConfig;
}

const explorer = cosmiconfigSync('dex', {
  searchPlaces: [
    '.dex/config.yml',
    '.dex/config.yaml',
    '.dex/config.json',
    '.dex/config.js',
    '.dexrc',
    '.dexrc.json',
    '.dexrc.yaml',
    '.dexrc.yml',
    '.dexrc.js',
    '.dexrc.cjs',
    'dex.config.js',
    'dex.config.cjs',
    'package.json',
  ],
});

let configCache: DexConfig | null = null;

export function loadConfig(): DexConfig {
  if (configCache !== null) return configCache;
  
  try {
    const result = explorer.search();
    const config = result?.config || {};
    
    // Validate AI configuration if present
    if (config.ai) {
      const validationErrors = validateAIConfig(config.ai);
      if (validationErrors.length > 0) {
        console.warn('AI configuration validation warnings:');
        validationErrors.forEach(error => console.warn(`  - ${error}`));
      }
    }
    
    configCache = config;
    return config;
  } catch (error) {
    console.warn('Failed to load config:', error);
    const config = {};
    configCache = config;
    return config;
  }
}

/**
 * Load and merge AI configuration with defaults
 */
export function loadAIConfig(): typeof DEFAULT_AI_CONFIG {
  const config = loadConfig();
  return mergeAIConfig(config.ai);
}

/**
 * Clear configuration cache (useful for testing)
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * Validate the current configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const config = loadConfig();
  const errors: string[] = [];
  
  // Validate AI configuration
  if (config.ai) {
    const aiErrors = validateAIConfig(config.ai);
    errors.push(...aiErrors);
  }
  
  // Add other configuration validations here as needed
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function mergeWithConfig(options: DexOptions): DexOptions {
  const config = loadConfig();
  
  // Merge defaults with CLI options (CLI takes precedence)
  const merged: DexOptions = {
    ...config.defaults,
    ...options,
  };
  
  // Apply filters if not overridden
  if (config.filters?.ignorePaths && !options.path) {
    // TODO: Implement path filtering with ignore patterns
  }
  
  return merged;
}