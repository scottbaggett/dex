import type { GitChange } from "../../../types";

type ChangeWithContent = GitChange & { content?: string };

export class MarkdownFormatter {
    format(changes: ChangeWithContent[]): string {
        const sections: string[] = [];
        
        sections.push("# Code Context");
        sections.push("");
        
        for (const change of changes) {
            sections.push(`## ${change.file}`);
            sections.push("");
            
            const extension = this.getFileExtension(change.file);
            const language = this.getLanguageFromExtension(extension);
            
            sections.push("```" + language);
            
            if (change.content) {
                sections.push(change.content);
            } else if (change.diff) {
                sections.push(change.diff);
            }
            
            sections.push("```");
            sections.push("");
        }
        
        return sections.join("\n");
    }
    
    private getFileExtension(path: string): string {
        const parts = path.split(".");
        return parts.length > 1 ? parts[parts.length - 1] : "";
    }
    
    private getLanguageFromExtension(ext: string): string {
        const languageMap: Record<string, string> = {
            ts: "typescript",
            tsx: "typescript",
            js: "javascript",
            jsx: "javascript",
            py: "python",
            rb: "ruby",
            go: "go",
            rs: "rust",
            java: "java",
            cpp: "cpp",
            c: "c",
            cs: "csharp",
            php: "php",
            swift: "swift",
            kt: "kotlin",
            sh: "bash",
            yaml: "yaml",
            yml: "yaml",
            json: "json",
            xml: "xml",
            html: "html",
            css: "css",
            scss: "scss",
            sass: "sass",
            less: "less",
            sql: "sql",
            md: "markdown",
        };
        
        return languageMap[ext.toLowerCase()] || ext;
    }
}