import { LanguageModule, ProcessResult, ProcessingOptions, LanguageCapabilities } from "../types.js";
import { PythonProcessor } from "./processor.js";

/**
 * Python language module
 */
export class PythonModule implements LanguageModule {
    name = 'python';
    displayName = 'Python';
    extensions = ['.py', '.pyw', '.pyi'];
    
    private processor?: PythonProcessor;
    private initialized = false;
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Initialize processor
        this.processor = new PythonProcessor();
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
            supportsStreaming: true,
            supportsPartialParsing: true,
            maxRecommendedFileSize: 5 * 1024 * 1024  // 5MB
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