import { promises as fs } from "fs";
import { join } from "path";
import simpleGit from "simple-git";
import type { OutputFormat } from "../types";

export interface OutputOptions {
    command: string;
    context: string;
    format: OutputFormat;
}

export class OutputManager {
    private workingDir: string;
    private projectRoot: string | null = null;

    constructor(workingDir: string = process.cwd()) {
        this.workingDir = workingDir;
    }

    /**
     * Get the project root using git, with caching
     */
    private async getProjectRoot(): Promise<string> {
        if (this.projectRoot) return this.projectRoot;

        try {
            const git = simpleGit(this.workingDir);
            const root = await git.revparse(["--show-toplevel"]);
            this.projectRoot = root.trim();
            return this.projectRoot;
        } catch {
            // Not in a git repository, use working directory
            this.projectRoot = this.workingDir;
            return this.projectRoot;
        }
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
    async getFilePath(options: OutputOptions): Promise<string> {
        const projectRoot = await this.getProjectRoot();
        const filename = this.generateFilename(options);
        return join(projectRoot, ".dex", filename);
    }

    /**
     * Save content to file and return the path
     */
    async saveOutput(content: string, options: OutputOptions): Promise<string> {
        // Ensure .dex directory exists
        await this.ensureDexDir();

        const filePath = await this.getFilePath(options);
        await fs.writeFile(filePath, content, "utf-8");

        return filePath;
    }

    /**
     * Get relative path for display
     */
    async getRelativePath(options: OutputOptions): Promise<string> {
        const filename = this.generateFilename(options);
        return `.dex/${filename}`;
    }

    private async ensureDexDir(): Promise<void> {
        try {
            const projectRoot = await this.getProjectRoot();
            const dexDir = join(projectRoot, ".dex");
            await fs.mkdir(dexDir, { recursive: true });
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
        return "txt";
    }
}
