import { cosmiconfigSync } from "cosmiconfig";
import type { DexOptions } from "../types.js";

export interface DexConfig {
    defaults?: Partial<DexOptions>;
    filters?: {
        ignorePaths?: string[];
        includeTypes?: string[];
    };
    tasks?: {
        defaultSource?: string;
    };
    // Prompt configuration removed
    distiller?: {
        defaultOutput?: "save" | "clipboard" | "stdout";
        saveDirectory?: string;
        excludePatterns?: string[];
    };
}

const explorer = cosmiconfigSync("dex", {
    searchPlaces: [
        ".dex/config.yml",
        ".dex/config.yaml",
        ".dex/config.json",
        ".dex/config.js",
        ".dexrc",
        ".dexrc.json",
        ".dexrc.yaml",
        ".dexrc.yml",
        ".dexrc.js",
        ".dexrc.cjs",
        "dex.config.js",
        "dex.config.cjs",
        "package.json",
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
        console.warn("Failed to load config:", error);
        const config = {};
        configCache = config;
        return config;
    }
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

    // Add other configuration validations here as needed

    return {
        valid: errors.length === 0,
        errors,
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
