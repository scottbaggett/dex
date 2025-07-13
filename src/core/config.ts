import { cosmiconfigSync } from 'cosmiconfig';
import { DexOptions } from '../types';

export interface DexConfig {
  defaults?: Partial<DexOptions>;
  filters?: {
    ignorePaths?: string[];
    includeTypes?: string[];
  };
  tasks?: {
    defaultSource?: string;
  };
}

const explorer = cosmiconfigSync('dex', {
  searchPlaces: [
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
    configCache = config;
    return config;
  } catch (error) {
    console.warn('Failed to load config:', error);
    const config = {};
    configCache = config;
    return config;
  }
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