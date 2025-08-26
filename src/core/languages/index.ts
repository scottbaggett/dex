/**
 * Language module exports and registry initialization
 */

export * from "./types.js";
export * from "./registry.js";
export * from "./base.js";

// Import language modules
import { TypeScriptModule } from "./typescript/index.js";
import { PythonModule } from "./python/index.js";
import { registry } from "./registry.js";

/**
 * Initialize default language modules
 */
export function initializeDefaultLanguages(): void {
    // Register TypeScript/JavaScript
    registry.register(new TypeScriptModule());
    
    // Register Python
    registry.register(new PythonModule());
    
    // Additional languages can be registered here
}

/**
 * Get the global language registry
 */
export function getLanguageRegistry() {
    return registry;
}

// Auto-initialize on import
initializeDefaultLanguages();