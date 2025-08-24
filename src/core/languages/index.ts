/**
 * Language module exports and registry initialization
 */

export * from './types';
export * from './registry';
export * from './base';

// Import language modules
import { TypeScriptModule } from './typescript';
import { PythonModule } from './python';
import { registry } from './registry';

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