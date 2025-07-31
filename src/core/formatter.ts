import type { FormatterOptions } from "../types";

export abstract class Formatter {
    abstract format(options: FormatterOptions): string;

    protected formatDiff(diff: string): string {
        return diff
            .split("\n")
            .map((line) => {
                if (line.startsWith("+")) return `+ ${line.substring(1)}`;
                if (line.startsWith("-")) return `- ${line.substring(1)}`;
                if (line.startsWith("@@")) return `  ${line}`;
                return `  ${line}`;
            })
            .join("\n");
    }

    protected getFileExtension(filename: string): string {
        const ext = filename.split(".").pop() || "";
        return ext;
    }

    protected getLanguageFromExtension(ext: string): string {
        const langMap: Record<string, string> = {
            ts: "typescript",
            tsx: "typescript",
            js: "javascript",
            jsx: "javascript",
            py: "python",
            rs: "rust",
            go: "go",
            java: "java",
            cpp: "cpp",
            c: "c",
            cs: "csharp",
            rb: "ruby",
            php: "php",
            swift: "swift",
            kt: "kotlin",
            scala: "scala",
            sh: "bash",
            yml: "yaml",
            yaml: "yaml",
            json: "json",
            xml: "xml",
            html: "html",
            css: "css",
            scss: "scss",
            sql: "sql",
            md: "markdown",
        };
        return langMap[ext] || ext;
    }
}
