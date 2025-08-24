import { LanguageModule, ProcessingOptions, ProcessResult } from './types';
import * as path from 'path';

/**
 * Central registry for all language modules
 * Manages language discovery, initialization, and processing
 */
export class LanguageRegistry {
    private modules: Map<string, LanguageModule> = new Map();
    private extensionMap: Map<string, string> = new Map();  // ext -> language name
    
    /**
     * Register a language module
     */
    register(module: LanguageModule): void {
        // Store the module
        this.modules.set(module.name, module);
        
        // Map extensions to language
        for (const ext of module.extensions) {
            this.extensionMap.set(ext.toLowerCase(), module.name);
        }
    }
    
    /**
     * Unregister a language module
     */
    unregister(name: string): void {
        const module = this.modules.get(name);
        if (!module) return;
        
        // Remove extension mappings
        for (const ext of module.extensions) {
            this.extensionMap.delete(ext.toLowerCase());
        }
        
        // Remove module
        this.modules.delete(name);
    }
    
    /**
     * Get language module for a file
     */
    getLanguageForFile(filePath: string): LanguageModule | null {
        const ext = path.extname(filePath).toLowerCase();
        const languageName = this.extensionMap.get(ext);
        
        if (!languageName) return null;
        
        return this.modules.get(languageName) || null;
    }
    
    /**
     * Get language module by name
     */
    getLanguageByName(name: string): LanguageModule | null {
        return this.modules.get(name) || null;
    }
    
    /**
     * Get all registered languages
     */
    getAllLanguages(): LanguageModule[] {
        return Array.from(this.modules.values());
    }
    
    /**
     * Get all supported file extensions
     */
    getSupportedExtensions(): string[] {
        return Array.from(this.extensionMap.keys());
    }
    
    /**
     * Process a file with the appropriate language module
     */
    async processFile(
        filePath: string, 
        source: string,
        options: ProcessingOptions = {}
    ): Promise<ProcessResult> {
        const language = this.getLanguageForFile(filePath);
        
        if (!language) {
            return {
                imports: [],
                exports: [],
                errors: [{
                    message: `No language module found for file: ${filePath}`,
                    severity: 'error'
                }]
            };
        }
        
        // Initialize if needed
        if (!language.isInitialized()) {
            await language.initialize();
        }
        
        // Process with options
        return language.process(source, filePath, options);
    }
    
    /**
     * Initialize all registered languages
     */
    async initializeAll(): Promise<void> {
        const promises = Array.from(this.modules.values()).map(
            module => module.initialize()
        );
        await Promise.all(promises);
    }
    
    /**
     * Initialize a specific language
     */
    async initializeLanguage(name: string): Promise<void> {
        const module = this.modules.get(name);
        if (!module) {
            throw new Error(`Language module not found: ${name}`);
        }
        await module.initialize();
    }
    
    /**
     * Check if a file is supported
     */
    isFileSupported(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.extensionMap.has(ext);
    }
}

// Singleton instance
export const registry = new LanguageRegistry();