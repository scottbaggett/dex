import { BaseFormatter } from "./base";
import type { DistillationResult } from "../../../types";

/**
 * JSON Formatter - Structured data output
 * Produces clean JSON for tool consumption
 */
export class JsonFormatter extends BaseFormatter {
    format(result: DistillationResult): string {
        const output: any = {
            files: [],
            structure: result.structure,
        };
        
        // Add metadata if requested
        if (this.options.includeMetadata) {
            output.metadata = result.metadata;
        }
        
        // Group by file and structure the output
        const fileMap = new Map<string, any>();
        
        for (const api of result.apis) {
            const path = this.cleanPath(api.file);
            
            if (!fileMap.has(path)) {
                fileMap.set(path, {
                    path,
                    imports: [],
                    exports: [],
                });
            }
            
            const file = fileMap.get(path)!;
            
            // Merge imports (deduplicated)
            const existingImports = new Set(file.imports);
            for (const imp of api.imports || []) {
                existingImports.add(imp);
            }
            file.imports = [...existingImports].sort();
            
            // Add exports
            for (const exp of api.exports || []) {
                file.exports.push(this.cleanExport(exp));
            }
        }
        
        // Convert to array and sort
        output.files = [...fileMap.values()].sort((a, b) => 
            a.path.localeCompare(b.path)
        );
        
        // Sort exports within each file if requested
        if (this.options.sortNodes) {
            for (const file of output.files) {
                file.exports = this.sortExports(file.exports);
            }
        }
        
        return JSON.stringify(output, null, this.options.compact ? 0 : 2);
    }
    
    extension(): string {
        return 'json';
    }
    
    private cleanExport(exp: any): any {
        const cleaned: any = {
            name: exp.name,
            type: exp.type,
            signature: exp.signature,
        };
        
        if (exp.members && exp.members.length > 0) {
            cleaned.members = exp.members.map((m: any) => ({
                name: m.name,
                type: m.type,
                signature: m.signature,
            }));
        }
        
        if (this.options.includeLocation && exp.location) {
            cleaned.location = exp.location;
        }
        
        return cleaned;
    }
}