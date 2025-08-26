import { cosmiconfigSync } from "cosmiconfig";
import type { DexOptions } from "../types.js";

export interface DexConfig {
    defaults?: Partial<DexOptions>;
    filters?: {
        ignorePaths?: string[];
        includeTypes?: string[];
        maxFileSize?: number; // Max file size in bytes
        respectGitignore?: boolean;
    };
    tasks?: {
        defaultSource?: string;
        autoDetect?: boolean;
    };
    output?: {
        defaultFormat?: "txt" | "md" | "json" | "xml";
        defaultDestination?: "save" | "clipboard" | "stdout";
        saveDirectory?: string;
        preserveStructure?: boolean;
    };
    distiller?: {
        defaultOutput?: "save" | "clipboard" | "stdout";
        saveDirectory?: string;
        excludePatterns?: string[];
        includeComments?: boolean;
        includeDocstrings?: boolean;
        includePrivate?: boolean;
        maxDepth?: number;
        maxFiles?: number;
    };
    extract?: {
        defaultFormat?: "txt" | "md" | "json" | "xml";
        includeMetadata?: boolean;
        maxLines?: number;
        contextLines?: number;
    };
    combine?: {
        defaultFormat?: "txt" | "md" | "json" | "xml";
        maxFiles?: number;
        sortBy?: "name" | "updated" | "size" | "status";
        sortOrder?: "asc" | "desc";
    };
    tree?: {
        groupBy?: "file" | "type" | "none";
        showTypes?: boolean;
        showParams?: boolean;
        includePrivate?: boolean;
        maxDepth?: number;
        outline?: boolean;  // Show as outline instead of tree structure
    };
    performance?: {
        parallel?: boolean;
        maxConcurrency?: number;
        cacheEnabled?: boolean;
        cacheTTL?: number; // Cache time-to-live in seconds
    };
}

const explorer = cosmiconfigSync("dex", {
    searchPlaces: [
        ".dex/config.yml",
        ".dexrc",
        "package.json",
    ],
});

// Binary file extensions that should always be ignored
const ALWAYS_IGNORE_EXTENSIONS = [
    "*.zip", "*.tar", "*.tar.gz", "*.tgz", "*.rar", "*.7z",
    "*.dmg", "*.iso", "*.img",
    "*.exe", "*.dll", "*.so", "*.dylib",
    "*.pdf", "*.doc", "*.docx", "*.xls", "*.xlsx", "*.ppt", "*.pptx",
    "*.jpg", "*.jpeg", "*.png", "*.gif", "*.bmp", "*.ico", "*.svg", "*.webp",
    "*.mp3", "*.mp4", "*.avi", "*.mov", "*.wmv", "*.flv", "*.mkv",
    "*.woff", "*.woff2", "*.ttf", "*.otf", "*.eot",
    "*.db", "*.sqlite", "*.sqlite3",
    "*.pyc", "*.pyo", "*.class", "*.jar",
    "*.o", "*.obj", "*.a", "*.lib",
    "*.DS_Store", "*.swp", "*.swo", "Thumbs.db"
];

// Default configuration
const DEFAULT_CONFIG: DexConfig = {
    filters: {
        respectGitignore: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        ignorePaths: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/coverage/**",
            "**/.next/**",
            "**/.nuxt/**",
            "**/.cache/**",
            "**/vendor/**",
            "**/*.min.js",
            "**/*.min.css",
            // Always ignore binary files
            ...ALWAYS_IGNORE_EXTENSIONS.map(ext => `**/${ext}`)
        ]
    },
    output: {
        defaultFormat: "md",
        defaultDestination: "save",
        saveDirectory: ".dex",
        preserveStructure: true
    },
    distiller: {
        defaultOutput: "save",
        saveDirectory: ".dex",
        includeComments: false,
        includeDocstrings: true,
        includePrivate: false,
        maxDepth: 10,
        maxFiles: 1000,
        excludePatterns: [
            "**/*.test.ts",
            "**/*.test.tsx",
            "**/*.spec.ts",
            "**/*.spec.tsx",
            "**/*.test.js",
            "**/*.test.jsx",
            "**/*.spec.js",
            "**/*.spec.jsx"
        ]
    },
    extract: {
        defaultFormat: "md",
        includeMetadata: true,
        maxLines: 2000,
        contextLines: 3
    },
    combine: {
        defaultFormat: "md",
        maxFiles: 100,
        sortBy: "name",
        sortOrder: "asc"
    },
    tree: {
        groupBy: "file",
        showTypes: false,
        showParams: false,
        includePrivate: false,
        maxDepth: 10,
        outline: false
    },
    performance: {
        parallel: true,
        maxConcurrency: 4,
        cacheEnabled: true,
        cacheTTL: 900 // 15 minutes
    }
};

let configCache: DexConfig | null = null;

export function loadConfig(): DexConfig {
    if (configCache !== null) return configCache;

    try {
        const result = explorer.search();
        const userConfig = result?.config || {};
        
        // Deep merge user config with defaults
        const config = deepMerge(DEFAULT_CONFIG, userConfig);

        configCache = config;
        return config;
    } catch (error) {
        console.warn("Failed to load config:", error);
        configCache = DEFAULT_CONFIG;
        return DEFAULT_CONFIG;
    }
}

/**
 * Deep merge two objects, with source overwriting target
 */
function deepMerge<T extends Record<string, any>>(
    target: T,
    source: Partial<T>
): T {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] !== undefined) {
            if (
                typeof source[key] === 'object' && 
                source[key] !== null &&
                !Array.isArray(source[key]) &&
                typeof target[key] === 'object' &&
                target[key] !== null &&
                !Array.isArray(target[key])
            ) {
                result[key] = deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key] as any;
            }
        }
    }
    
    return result;
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
export function validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    const config = loadConfig();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate output settings
    if (config.output?.defaultFormat && 
        !["txt", "md", "json", "xml"].includes(config.output.defaultFormat)) {
        errors.push(`Invalid output.defaultFormat: ${config.output.defaultFormat}`);
    }

    // Validate performance settings
    if (config.performance?.maxConcurrency && 
        (config.performance.maxConcurrency < 1 || config.performance.maxConcurrency > 16)) {
        warnings.push(`performance.maxConcurrency should be between 1 and 16 (got ${config.performance.maxConcurrency})`);
    }

    // Validate file size limits
    if (config.filters?.maxFileSize && config.filters.maxFileSize < 0) {
        errors.push("filters.maxFileSize must be positive");
    }

    // Validate distiller settings
    if (config.distiller?.maxFiles && config.distiller.maxFiles < 1) {
        errors.push("distiller.maxFiles must be at least 1");
    }

    if (config.distiller?.maxDepth && config.distiller.maxDepth < 1) {
        errors.push("distiller.maxDepth must be at least 1");
    }

    // Check for deprecated settings
    if ((config as any).tasks?.defaultSource) {
        warnings.push("tasks.defaultSource is deprecated");
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

export function mergeWithConfig(options: DexOptions): DexOptions {
    const config = loadConfig();

    // Merge defaults with CLI options (CLI takes precedence)
    const merged: DexOptions = {
        ...config.defaults,
        ...options,
    };

    // Apply config-based defaults if not specified in CLI
    if (!merged.format && config.output?.defaultFormat) {
        merged.format = config.output.defaultFormat;
    }

    // Note: exclude and parallel are not part of DexOptions schema
    // They should be handled at the command level

    return merged;
}

/**
 * Get configuration for a specific command
 */
export function getCommandConfig(command: 'extract' | 'distill' | 'combine' | 'tree'): any {
    const config = loadConfig();
    
    switch (command) {
        case 'extract':
            return config.extract || {};
        case 'distill':
            return config.distiller || {};
        case 'combine':
            return config.combine || {};
        case 'tree':
            return config.tree || {};
        default:
            return {};
    }
}

/**
 * Check if a file should be ignored based on config
 */
export function shouldIgnorePath(filePath: string): boolean {
    const config = loadConfig();
    const ignorePatterns = config.filters?.ignorePaths || DEFAULT_CONFIG.filters!.ignorePaths!;
    
    // Always check binary extensions first (these are non-negotiable)
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext) {
        for (const pattern of ALWAYS_IGNORE_EXTENSIONS) {
            const cleanPattern = pattern.replace(/\*/g, '');
            if (cleanPattern === `.${ext}` || filePath.endsWith(cleanPattern)) {
                return true;
            }
        }
    }
    
    // Check against configured ignore patterns
    for (const pattern of ignorePatterns) {
        if (filePath.includes(pattern.replace(/\*\*/g, '').replace(/\*/g, ''))) {
            return true;
        }
    }
    
    return false;
}

/**
 * Get list of binary file extensions that are always ignored
 */
export function getBinaryExtensions(): string[] {
    return ALWAYS_IGNORE_EXTENSIONS;
}

/**
 * Get default output settings
 */
export function getOutputConfig(): NonNullable<DexConfig['output']> {
    const config = loadConfig();
    return config.output || DEFAULT_CONFIG.output!;
}
