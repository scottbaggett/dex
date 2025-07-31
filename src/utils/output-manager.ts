import { promises as fs } from "fs";
import { join } from "path";
import type { OutputFormat } from "../types";

export interface OutputOptions {
    command: string;
    context: string;
    format: OutputFormat;
}

export class OutputManager {
    private dexDir: string;

    constructor(workingDir: string = process.cwd()) {
        this.dexDir = join(workingDir, ".dex");
    }

    /**
     * Generate filename following dex.command.context.extension pattern
     */
    generateFilename(options: OutputOptions): string {
        const { command, context, format } = options;

        // Sanitize context for filename
        const sanitizedContext = this.sanitizeContext(context);

        // Get extension based on format
        const extension = this.getExtension(format);

        return `dex.${command}.${sanitizedContext}.${extension}`;
    }

    /**
     * Get full file path
     */
    getFilePath(options: OutputOptions): string {
        const filename = this.generateFilename(options);
        return join(this.dexDir, filename);
    }

    /**
     * Save content to file and return the path
     */
    async saveOutput(content: string, options: OutputOptions): Promise<string> {
        // Ensure .dex directory exists
        await this.ensureDexDir();

        const filePath = this.getFilePath(options);
        await fs.writeFile(filePath, content, "utf-8");

        return filePath;
    }

    /**
     * Get relative path for display
     */
    getRelativePath(options: OutputOptions): string {
        const filename = this.generateFilename(options);
        return `.dex/${filename}`;
    }

    private async ensureDexDir(): Promise<void> {
        try {
            await fs.mkdir(this.dexDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    }

    private sanitizeContext(context: string): string {
        // Replace problematic characters for filenames
        return context
            .replace(/[\/\\]/g, "-") // Replace slashes with dashes
            .replace(/[<>:"|?*]/g, "") // Remove invalid filename characters
            .replace(/\s+/g, "-") // Replace spaces with dashes
            .replace(/\.+/g, ".") // Collapse multiple dots
            .replace(/^\.+|\.+$/g, "") // Remove leading/trailing dots
            .toLowerCase();
    }

    private getExtension(format: OutputFormat): string {
        switch (format) {
            case "json":
                return "json";
            case "markdown":
                return "md";
            case "xml":
            default:
                return "xml";
        }
    }
}
