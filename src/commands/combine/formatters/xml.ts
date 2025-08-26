import type { GitChange } from "../../../types.js";

type ChangeWithContent = GitChange & { content?: string };

export class XmlFormatter {
    format(changes: ChangeWithContent[]): string {
        const sections: string[] = [];
        
        // Start with root element directly (no XML declaration)
        sections.push("<code_context>");
        sections.push("");
        
        // Add each file
        for (const change of changes) {
            sections.push(`<file path="${this.escapeXml(change.file)}">`);
            
            if (change.content) {
                sections.push(change.content);
            } else if (change.diff) {
                sections.push(change.diff);
            }
            
            sections.push("</file>");
            sections.push("");
        }
        
        sections.push("</code_context>");
        
        return sections.join("\n");
    }
    
    private escapeXml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}