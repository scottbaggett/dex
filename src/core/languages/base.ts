import { LanguageModule, ProcessResult, ProcessingOptions } from './types';

/**
 * Base class for language modules
 * Provides common functionality and utilities
 */
export abstract class BaseLanguageModule implements LanguageModule {
    abstract name: string;
    abstract displayName: string;
    abstract extensions: string[];
    
    protected initialized = false;
    protected treeSitterLanguage: any = null;
    protected parser: any = null;
    
    /**
     * Initialize the language module
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        try {
            await this.loadTreeSitter();
            this.initialized = true;
        } catch (error) {
            console.warn(`Failed to initialize ${this.name} language module:`, error);
            // Continue without tree-sitter
            this.initialized = true;
        }
    }
    
    /**
     * Load tree-sitter parser for this language
     */
    protected abstract loadTreeSitter(): Promise<void>;
    
    /**
     * Check if module is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
    
    /**
     * Check if extension is supported
     */
    supportsExtension(ext: string): boolean {
        return this.extensions.includes(ext.toLowerCase());
    }
    
    /**
     * Check if can process file
     */
    canProcess(filePath: string): boolean {
        const ext = filePath.split('.').pop()?.toLowerCase();
        return ext ? this.supportsExtension(`.${ext}`) : false;
    }
    
    /**
     * Process source code - must be implemented by subclasses
     */
    abstract process(
        source: string, 
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult>;
    
    /**
     * Get language capabilities - must be implemented by subclasses
     */
    abstract getCapabilities(): import('./types').LanguageCapabilities;
    
    /**
     * Get tree-sitter language if available
     */
    getTreeSitterLanguage(): any {
        return this.treeSitterLanguage;
    }
    
    /**
     * Extract text from a node
     */
    protected getNodeText(node: any, source: string): string {
        if (!node) return '';
        
        const startIndex = node.startIndex || 0;
        const endIndex = node.endIndex || source.length;
        
        return source.slice(startIndex, endIndex);
    }
    
    /**
     * Find first child of a specific type
     */
    protected findChildByType(node: any, type: string): any {
        if (!node || !node.children) return null;
        
        for (const child of node.children) {
            if (child.type === type) {
                return child;
            }
        }
        
        return null;
    }
    
    /**
     * Find all children of a specific type
     */
    protected findChildrenByType(node: any, type: string): any[] {
        if (!node || !node.children) return [];
        
        return node.children.filter((child: any) => child.type === type);
    }
    
    /**
     * Get line number from byte offset
     */
    protected getLineNumber(source: string, byteOffset: number): number {
        let line = 1;
        for (let i = 0; i < byteOffset && i < source.length; i++) {
            if (source[i] === '\n') {
                line++;
            }
        }
        return line;
    }
}