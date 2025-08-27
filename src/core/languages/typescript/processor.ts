import { ProcessResult, ProcessingOptions } from "../types.js";
import { TsMorphProcessor } from "./ts-morph-processor.js";
import { TypeScriptASTProcessor } from "./ast-processor.js";

/**
 * TypeScript processor
 * Handles TypeScript and JavaScript parsing using ts-morph or TypeScript compiler API
 */
export class TypeScriptProcessor {
    private tsMorphProcessor: TsMorphProcessor | null = null;
    private astProcessor: TypeScriptASTProcessor | null = null;

    async initialize(): Promise<void> {
        try {
            this.tsMorphProcessor = new TsMorphProcessor();
        } catch {
            try {
                console.warn(
                    "ts-morph processor initialization failed, falling back to AST processor",
                );
                this.astProcessor = new TypeScriptASTProcessor();
            } catch {
                // Both failed, will use line-based parsing
                console.warn("Failed to initialize TypeScript processor");
            }
        }
    }

    async process(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): Promise<ProcessResult> {
        // Try ts-morph first (best API)
        if (this.tsMorphProcessor) {
            try {
                return this.tsMorphProcessor.process(source, filePath, options);
            } catch (error) {
                if (process.env.DEBUG) {
                    console.warn("ts-morph processing failed:", error);
                }
            }
        }

        // Try AST processor as fallback
        if (this.astProcessor) {
            try {
                return this.astProcessor.process(source, filePath, options);
            } catch (error) {
                if (process.env.DEBUG) {
                    console.warn("AST processing failed:", error);
                }
            }
        }

        // Fall back to basic parsing if all else fails
        return this.processBasic(source, filePath, options);
    }

    private processBasic(
        source: string,
        filePath: string,
        options: ProcessingOptions,
    ): ProcessResult {
        // Very basic fallback - just extract obvious exports
        const lines = source.split("\n");
        const exports: any[] = [];
        const imports: any[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line?.trim();

            // Extract imports - always include for context
            if (trimmed?.startsWith("import ")) {
                const match = trimmed.match(/from\s+['"](.+?)['"]/);
                if (match) {
                    imports.push({
                        source: match[1],
                        specifiers: [],
                        line: i + 1,
                    });
                }
            }

            // Extract exports (very basic)
            if (trimmed?.startsWith("export ")) {
                const name = this.extractName(trimmed);
                if (name) {
                    exports.push({
                        name,
                        kind: this.detectKind(trimmed),
                        signature: trimmed.replace(/\s*{[\s\S]*$/, ""),
                        line: i + 1,
                        isExported: true,
                    });
                }
            }
        }

        return {
            imports,
            exports,
            metadata: {},
        };
    }

    private extractName(line: string): string | null {
        // Extract name from various export patterns
        const patterns = [
            /export\s+(?:const|let|var)\s+(\w+)/,
            /export\s+function\s+(\w+)/,
            /export\s+class\s+(\w+)/,
            /export\s+interface\s+(\w+)/,
            /export\s+type\s+(\w+)/,
            /export\s+enum\s+(\w+)/,
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) return match[1] ?? null;
        }

        return null;
    }

    private detectKind(line: string): string {
        if (line.includes("function")) return "function";
        if (line.includes("class")) return "class";
        if (line.includes("interface")) return "interface";
        if (line.includes("type")) return "type";
        if (line.includes("enum")) return "enum";
        return "const";
    }
}
