// @ts-expect-error - bun:test types not available in this environment
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createCombineCommand } from "./index.js";
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { countTokens, formatEstimatedTokens } from "../../utils/tokens.js";

function parseUser(program: Command, args: string[]) {
    return program.parseAsync(args, { from: "user" });
}

async function captureConsole(run: () => Promise<void>): Promise<string> {
    const originalLog = console.log;
    const lines: string[] = [];

    console.log = ((...args: unknown[]) => {
        lines.push(args.map((arg) => String(arg)).join(" "));
    }) as typeof console.log;

    try {
        await run();
    } finally {
        console.log = originalLog;
    }

    return lines.join("\n");
}

async function captureConsoleAndStderr(
    run: () => Promise<void>,
): Promise<{ stdout: string; stderr: string }> {
    const originalLog = console.log;
    const originalStderrWrite = process.stderr.write;
    const stdoutLines: string[] = [];
    const stderrChunks: string[] = [];

    console.log = ((...args: unknown[]) => {
        stdoutLines.push(args.map((arg) => String(arg)).join(" "));
    }) as typeof console.log;

    process.stderr.write = ((chunk: unknown) => {
        stderrChunks.push(String(chunk));
        return true;
    }) as typeof process.stderr.write;

    try {
        await run();
    } finally {
        console.log = originalLog;
        process.stderr.write = originalStderrWrite;
    }

    return {
        stdout: stdoutLines.join("\n"),
        stderr: stderrChunks.join(""),
    };
}

describe("combine command", () => {
    let testDir: string;
    let originalCwd: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "combine-test-"));
        originalCwd = process.cwd();
        process.chdir(testDir);

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
        const program = new Command();
        program.addCommand(createCombineCommand());

        const output = await captureConsole(async () => {
            await parseUser(program, ["combine", "file1.txt", "file2.txt", "--stdout"]);
        });

        expect(output).toContain("<code_context>");
        expect(output).toContain('<file path="file1.txt">');
        expect(output).toContain("This is file 1 content");
        expect(output).toContain('<file path="file2.txt">');
        expect(output).toContain("This is file 2 content");
    });

    test("should combine files with markdown format", async () => {
        const program = new Command();
        program.addCommand(createCombineCommand());

        const output = await captureConsole(async () => {
            await parseUser(program, ["combine", "file1.txt", "-f", "md", "--stdout"]);
        });

        expect(output).toContain("# Code Context");
        expect(output).toContain("## file1.txt");
        expect(output).toContain("This is file 1 content");
    });

    test("should combine files with json format", async () => {
        const program = new Command();
        program.addCommand(createCombineCommand());

        const output = await captureConsole(async () => {
            await parseUser(program, ["combine", "file1.txt", "--format", "json", "--stdout"]);
        });

        const parsed = JSON.parse(output);
        expect(parsed.files).toHaveLength(1);
        expect(parsed.files[0].path).toBe("file1.txt");
        expect(parsed.files[0].content).toBe("This is file 1 content");
        expect(parsed.metadata.totalFiles).toBe(1);
    });

    test("should apply include and exclude patterns", async () => {
        const includeProgram = new Command();
        includeProgram.addCommand(createCombineCommand());

        const includeOutput = await captureConsole(async () => {
            await parseUser(includeProgram, ["combine", ".", "--include", "*.txt", "--stdout"]);
        });

        expect(includeOutput).toContain("file1.txt");
        expect(includeOutput).toContain("file2.txt");
        expect(includeOutput).toContain("subdir/file3.txt");

        const excludeProgram = new Command();
        excludeProgram.addCommand(createCombineCommand());

        const excludeOutput = await captureConsole(async () => {
            await parseUser(excludeProgram, ["combine", ".", "--exclude", "subdir/**", "--stdout"]);
        });

        expect(excludeOutput).toContain("file1.txt");
        expect(excludeOutput).toContain("file2.txt");
        expect(excludeOutput).not.toContain("subdir/file3.txt");
    });

    test("should show dry-run estimates using token counts", async () => {
        const program = new Command();
        program.addCommand(createCombineCommand());

        const output = await captureConsoleAndStderr(async () => {
            await parseUser(program, ["combine", "file1.txt", "--dry-run"]);
        });

        const expectedTokens = formatEstimatedTokens(
            countTokens("This is file 1 content"),
        );

        expect(output.stdout).toContain("file1.txt");
        expect(output.stderr).toContain(expectedTokens);
        expect(output.stderr).not.toContain("~22 tokens");
    });

    test("should respect max-files option", async () => {
        const program = new Command();
        program.addCommand(createCombineCommand());

        const output = await captureConsole(async () => {
            await parseUser(program, ["combine", ".", "--max-files", "1", "--stdout"]);
        });

        const fileCount = (output.match(/<file path="/g) || []).length;
        expect(fileCount).toBe(1);
    });

    test("should write output to file", async () => {
        const program = new Command();
        program.addCommand(createCombineCommand());

        const outputPath = "combined_output.txt";
        await parseUser(program, ["combine", "file1.txt", "--output", outputPath]);

        expect(fs.existsSync(outputPath)).toBe(true);
        const content = fs.readFileSync(outputPath, "utf-8");
        expect(content).toContain("<code_context>");
        expect(content).toContain("This is file 1 content");
    });

    test("should exit with code 1 when no files are found", async () => {
        const program = new Command();
        program.addCommand(createCombineCommand());

        const originalExit = process.exit;
        process.exit = ((code?: number) => {
            throw new Error(`process.exit:${code ?? 0}`);
        }) as typeof process.exit;

        try {
            await expect(
                parseUser(program, ["combine", "nonexistent*.txt", "--stdout"]),
            ).rejects.toThrow("process.exit:1");
        } finally {
            process.exit = originalExit;
        }
    });
});
