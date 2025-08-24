import { BaseFormatter } from "./base";
import type { DistillationResult } from "../../../types";

/**
 * Markdown Formatter - Human-readable documentation format
 */
export class MarkdownFormatter extends BaseFormatter {
    format(result: DistillationResult): string {
        const lines: string[] = [];
        
        // Header
        lines.push('# API Surface');
        lines.push('');
        
        // Metadata section if requested
        if (this.options.includeMetadata && result.metadata) {
            lines.push('## Metadata');
            lines.push('');
            lines.push(`- **Files**: ${result.structure.fileCount}`);
            lines.push(`- **Original Tokens**: ${result.metadata.originalTokens.toLocaleString()}`);
            lines.push(`- **Distilled Tokens**: ${result.metadata.distilledTokens.toLocaleString()}`);
            lines.push(`- **Compression Ratio**: ${result.metadata.compressionRatio.toFixed(2)}x`);
            lines.push('');
        }
        
        // Group APIs by file
        const fileGroups = this.groupByFile(result.apis);
        
        // Table of contents
        if (fileGroups.size > 3) {
            lines.push('## Files');
            lines.push('');
            for (const [filePath] of fileGroups.entries()) {
                const anchor = this.pathToAnchor(filePath);
                lines.push(`- [${filePath}](#${anchor})`);
            }
            lines.push('');
        }
        
        // Output each file's API
        for (const [filePath, apis] of fileGroups.entries()) {
            lines.push(this.formatFile(filePath, apis));
            lines.push('');
        }
        
        return lines.join('\n').trim();
    }
    
    extension(): string {
        return 'md';
    }
    
    private groupByFile(apis: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();
        
        for (const api of apis) {
            const path = this.cleanPath(api.file);
            if (!groups.has(path)) {
                groups.set(path, []);
            }
            groups.get(path)!.push(api);
        }
        
        return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    }
    
    private formatFile(filePath: string, apis: any[]): string {
        const lines: string[] = [];
        
        // File header
        lines.push(`## ${filePath}`);
        lines.push('');
        
        // Collect all imports
        const allImports = new Set<string>();
        for (const api of apis) {
            for (const imp of api.imports || []) {
                allImports.add(imp);
            }
        }
        
        // Output imports
        if (allImports.size > 0) {
            lines.push('### Imports');
            lines.push('');
            lines.push('```typescript');
            for (const imp of [...allImports].sort()) {
                lines.push(`import ${imp}`);
            }
            lines.push('```');
            lines.push('');
        }
        
        // Collect and categorize exports
        const allExports: any[] = [];
        for (const api of apis) {
            allExports.push(...(api.exports || []));
        }
        
        const exportsByType = this.categorizeExports(allExports);
        
        // Output each category
        for (const [category, exports] of exportsByType.entries()) {
            if (exports.length === 0) continue;
            
            lines.push(`### ${this.categoryTitle(category)}`);
            lines.push('');
            
            for (const exp of exports) {
                lines.push(this.formatExport(exp, category));
                lines.push('');
            }
        }
        
        return lines.join('\n').trim();
    }
    
    private categorizeExports(exports: any[]): Map<string, any[]> {
        const categories = new Map<string, any[]>();
        const order = ['interface', 'type', 'class', 'function', 'const', 'variable', 'enum'];
        
        // Initialize categories
        for (const cat of order) {
            categories.set(cat, []);
        }
        
        // Categorize exports
        for (const exp of exports) {
            const cat = categories.get(exp.type);
            if (cat) {
                cat.push(exp);
            } else {
                // Unknown type, add to 'other'
                if (!categories.has('other')) {
                    categories.set('other', []);
                }
                categories.get('other')!.push(exp);
            }
        }
        
        // Sort within categories
        if (this.options.sortNodes) {
            for (const [, exps] of categories.entries()) {
                exps.sort((a, b) => a.name.localeCompare(b.name));
            }
        }
        
        return categories;
    }
    
    private categoryTitle(category: string): string {
        const titles: Record<string, string> = {
            'interface': 'Interfaces',
            'type': 'Types',
            'class': 'Classes',
            'function': 'Functions',
            'const': 'Constants',
            'variable': 'Variables',
            'enum': 'Enums',
            'other': 'Other',
        };
        return titles[category] || category;
    }
    
    private formatExport(exp: any, category: string): string {
        const lines: string[] = [];
        
        // Name as heading
        lines.push(`#### ${exp.name}`);
        lines.push('');
        
        // Signature in code block
        if (category === 'class' || category === 'interface') {
            lines.push('```typescript');
            lines.push(`${exp.signature} {`);
            
            if (exp.members && exp.members.length > 0) {
                for (const member of exp.members) {
                    lines.push(`  ${member.signature}`);
                }
            }
            
            lines.push('}');
            lines.push('```');
        } else {
            lines.push('```typescript');
            lines.push(exp.signature);
            lines.push('```');
        }
        
        return lines.join('\n');
    }
    
    private pathToAnchor(path: string): string {
        return path
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}