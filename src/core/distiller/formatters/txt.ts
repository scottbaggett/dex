import { BaseFormatter } from "./base";
import type { DistillationResult, ExtractedAPI } from "../../../types";

/**
 * TXT Formatter - Compact plain text output
 * Produces deterministic, minimal output ideal for LLM consumption
 */
export class TxtFormatter extends BaseFormatter {
    format(result: DistillationResult): string {
        const lines: string[] = [];
        
        // Group APIs by file
        const fileGroups = this.groupByFile(result.apis);
        
        // Output each file's API surface
        for (const [filePath, apis] of fileGroups.entries()) {
            lines.push(this.formatFile(filePath, apis));
        }
        
        return lines.join('\n\n');
    }
    
    extension(): string {
        return 'txt';
    }
    
    private groupByFile(apis: ExtractedAPI[]): Map<string, ExtractedAPI[]> {
        const groups = new Map<string, ExtractedAPI[]>();
        
        for (const api of apis) {
            const path = this.cleanPath(api.file);
            if (!groups.has(path)) {
                groups.set(path, []);
            }
            groups.get(path)!.push(api);
        }
        
        // Sort files alphabetically
        return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    }
    
    private formatFile(filePath: string, apis: ExtractedAPI[]): string {
        const lines: string[] = [];
        
        // File header
        lines.push(`<file path="${filePath}">`);
        
        // Combine all imports (deduplicated)
        const allImports = new Set<string>();
        for (const api of apis) {
            for (const imp of api.imports || []) {
                allImports.add(imp);
            }
        }
        
        // Output imports
        if (allImports.size > 0) {
            for (const imp of [...allImports].sort()) {
                lines.push(`  import ${imp}`);
            }
            lines.push(''); // Empty line after imports
        }
        
        // Combine and sort all exports
        const allExports: any[] = [];
        for (const api of apis) {
            allExports.push(...(api.exports || []));
        }
        
        const sortedExports = this.sortExports(allExports);
        
        // Output exports
        for (const exp of sortedExports) {
            lines.push(this.formatExport(exp));
        }
        
        lines.push('</file>');
        
        return lines.join('\n');
    }
    
    private formatExport(exp: any): string {
        const prefix = '  ';
        
        // Format based on type
        switch (exp.type) {
            case 'class':
                return this.formatClass(exp, prefix);
            case 'interface':
                return this.formatInterface(exp, prefix);
            case 'function':
                return `${prefix}${exp.signature}`;
            case 'type':
                return `${prefix}${exp.signature}`;
            case 'const':
            case 'variable':
                return `${prefix}${exp.signature}`;
            case 'enum':
                return `${prefix}${exp.signature}`;
            default:
                return `${prefix}${exp.signature || exp.name}`;
        }
    }
    
    private formatClass(cls: any, prefix: string): string {
        const lines: string[] = [];
        
        lines.push(`${prefix}class ${cls.name} {`);
        
        if (cls.members && cls.members.length > 0) {
            for (const member of cls.members) {
                if (member.type === 'method') {
                    lines.push(`${prefix}  ${member.signature}`);
                } else {
                    lines.push(`${prefix}  ${member.name}: any`);
                }
            }
        }
        
        lines.push(`${prefix}}`);
        
        return lines.join('\n');
    }
    
    private formatInterface(iface: any, prefix: string): string {
        const lines: string[] = [];
        
        lines.push(`${prefix}interface ${iface.name} {`);
        
        if (iface.members && iface.members.length > 0) {
            for (const member of iface.members) {
                lines.push(`${prefix}  ${member.signature}`);
            }
        }
        
        lines.push(`${prefix}}`);
        
        return lines.join('\n');
    }
}