import { LanguageModule, ProcessResult, ProcessingOptions, LanguageCapabilities } from '../types';
import { TypeScriptProcessor } from './processor';

/**
 * TypeScript/JavaScript language module
 */
export class TypeScriptModule implements LanguageModule {
    name = 'typescript';
    displayName = 'TypeScript';
    extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    
    private processor?: TypeScriptProcessor;
    private initialized = false;
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Initialize processor (tree-sitter or fallback)
        this.processor = new TypeScriptProcessor();
        await this.processor.initialize();
        this.initialized = true;
    }
    
    isInitialized(): boolean {
        return this.initialized;
    }
    
    async process(
        source: string, 
        filePath: string,
        options: ProcessingOptions
    ): Promise<ProcessResult> {
        if (!this.initialized) {
            await this.initialize();
        }
        
        return this.processor!.process(source, filePath, options);
    }
    
    getCapabilities(): LanguageCapabilities {
        return {
            supportsPrivateMembers: true,
            supportsComments: true,
            supportsDocstrings: true,
            supportsStreaming: false,
            supportsPartialParsing: true,
            maxRecommendedFileSize: 10 * 1024 * 1024  // 10MB
        };
    }
    
    canProcess(filePath: string): boolean {
        const ext = filePath.split('.').pop()?.toLowerCase();
        return ext ? this.extensions.includes(`.${ext}`) : false;
    }
    
    supportsExtension(ext: string): boolean {
        return this.extensions.includes(ext.toLowerCase());
    }
}