// @ts-expect-error - bun:test types not available in this environment
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createCombineCommand } from "./index.js";
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("combine command", () => {
    let testDir: string;
    let originalCwd: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "combine-test-"));
        originalCwd = process.cwd();
        process.chdir(testDir);
        // Create test files
        fs.writeFileSync("file1.txt", "This is file 1 content");
        fs.writeFileSync("file2.txt", "This is file 2 content");
        fs.mkdirSync("subdir");
        fs.writeFileSync("subdir/file3.txt", "This is file 3 in subdirectory");
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    test("should combine files with default text format", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync(["combine", "file1.txt", "file2.txt"]);
            expect(output).toContain("<code_context>");
            expect(output).toContain('<file path="file1.txt">');
            expect(output).toContain("This is file 1 content");
            expect(output).toContain('<file path="file2.txt">');
            expect(output).toContain("This is file 2 content");
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should combine files with markdown format", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync([
                "combine",
                "file1.txt",
                "-f",
                "md",
                "--stdout",
            ]);
            expect(output).toContain("# Code Context");
            expect(output).toContain("## file1.txt");
            expect(output).toContain("```");
            expect(output).toContain("This is file 1 content");
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should combine files with json format", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync([
                "combine",
                "file1.txt",
                "--format",
                "json",
                "--stdout",
            ]);
            const parsed = JSON.parse(output);
            expect(parsed.files).toHaveLength(1);
            expect(parsed.files[0].path).toBe("file1.txt");
            expect(parsed.files[0].content).toBe("This is file 1 content");
            expect(parsed.metadata.totalFiles).toBe(1);
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should handle include patterns", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync([
                "combine",
                ".",
                "--include",
                "*.txt",
                "--stdout",
            ]);
            expect(output).toContain("file1.txt");
            expect(output).toContain("file2.txt");
            expect(output).toContain("subdir/file3.txt");
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should handle exclude patterns", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync([
                "combine",
                ".",
                "--exclude",
                "subdir/**",
                "--stdout",
            ]);
            expect(output).toContain("file1.txt");
            expect(output).toContain("file2.txt");
            expect(output).not.toContain("subdir/file3.txt");
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should handle dry-run mode", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync(["combine", "file1.txt", "--dry-run"]);
            expect(output).toContain("Would process 1 files");
            expect(output).toContain("file1.txt");
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should handle max-files option", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync([
                "combine",
                ".",
                "--max-files",
                "1",
                "--stdout",
            ]);
            // Should only contain one file
            const fileCount = (output.match(/<file path="/g) || []).length;
            expect(fileCount).toBe(1);
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should handle output to file", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        const outputPath = "combined_output.txt";
        await program.parseAsync([
            "combine",
            "file1.txt",
            "--output",
            outputPath,
        ]);

        expect(fs.existsSync(outputPath)).toBe(true);
        const content = fs.readFileSync(outputPath, "utf-8");
        expect(content).toContain("<code_context>");
        expect(content).toContain("This is file 1 content");
    });

    test("should handle clipboard option", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync(["combine", "file1.txt", "--clipboard"]);
            expect(output).toContain("Combined output");
            expect(output).toContain("copied to clipboard");
        } finally {
            process.stdout.write = originalWrite;
        }
    });

    test("should handle no files found", async () => {
        const command = createCombineCommand();
        const program = new Command();
        program.addCommand(command);

        let output = "";
        const originalWrite = process.stdout.write;
        process.stdout.write = (chunk: string | Buffer) => {
            output += chunk.toString();
            return true;
        };

        try {
            await program.parseAsync([
                "combine",
                "nonexistent*.txt",
                "--stdout",
            ]);
            expect(output).toContain("No files found");
        } catch (error) {
            // Expected to exit with error
            expect(error.message).toContain("No files found");
        } finally {
            process.stdout.write = originalWrite;
        }
    });
});
