// @ts-expect-error - bun:test types not available in this environment
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

type DistillRun = {
    status: number | null;
    output: string;
};

describe("distill command integration tests", () => {
    let testDir: string;
    const repoRoot = process.cwd();

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dex-distill-test-"));

        fs.writeFileSync(
            path.join(testDir, "public.ts"),
            `
export class PublicClass {
    public publicMethod() {
        return 'public';
    }

    private privateMethod() {
        return 'private';
    }

    protected protectedMethod() {
        return 'protected';
    }
}

export interface Config {
    /** API key for authentication */
    apiKey: string;
    endpoint?: string;
}

export function publicFunction() {
    // This is a comment
    return true;
}
            `.trim(),
        );

        fs.writeFileSync(
            path.join(testDir, "test.py"),
            `
class PublicClass:
    """This is a docstring"""
    def __init__(self):
        pass

    def public_method(self):
        # Comment here
        return "public"

    def _private_method(self):
        return "private"

def public_function():
    """Function docstring"""
    pass
            `.trim(),
        );

        fs.mkdirSync(path.join(testDir, "src"));
        fs.writeFileSync(
            path.join(testDir, "src", "index.ts"),
            `
export { PublicClass } from "../public.js";
export default function main() {
    console.log('main');
}
            `.trim(),
        );
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    function runDistill(args: string[] = [], targetPath: string = testDir): DistillRun {
        const result = spawnSync(
            "bun",
            ["run", "src/cli.ts", "distill", targetPath, ...args],
            {
                cwd: repoRoot,
                encoding: "utf-8",
            },
        );

        return {
            status: result.status,
            output: `${result.stdout || ""}${result.stderr || ""}`,
        };
    }

    test("should distill all files by default", () => {
        const result = runDistill(["--stdout"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("PublicClass");
        expect(result.output).toContain("publicFunction");
        expect(result.output).toContain("public_function");
    });

    test("should handle single file target", () => {
        const result = runDistill(["--stdout"], path.join(testDir, "public.ts"));
        expect(result.status).toBe(0);
        expect(result.output).toContain("PublicClass");
        expect(result.output).not.toContain("public_function");
    });

    test("-o should write output to file", () => {
        const outputFile = path.join(testDir, "output.txt");
        const result = runDistill(["-o", outputFile]);

        expect(result.status).toBe(0);
        expect(fs.existsSync(outputFile)).toBe(true);

        const content = fs.readFileSync(outputFile, "utf-8");
        expect(content).toContain("PublicClass");
        expect(content).toContain("publicFunction");
    });

    test("--include should filter files", () => {
        const result = runDistill(["--stdout", "--include", "*.ts"]);

        expect(result.status).toBe(0);
        expect(result.output).toContain("PublicClass");
        expect(result.output).toContain("publicFunction");
        expect(result.output).not.toContain("public_function");
    });

    test("--exclude should exclude files", () => {
        const result = runDistill(["--stdout", "--exclude", "*.py"]);

        expect(result.status).toBe(0);
        expect(result.output).toContain("PublicClass");
        expect(result.output).not.toContain("public_function");
    });

    test("--format md should produce markdown output", () => {
        const result = runDistill(["--stdout", "--format", "md"]);

        expect(result.status).toBe(0);
        expect(result.output).toContain("## public.ts");
        expect(result.output).toContain("```typescript");
        expect(result.output).toContain("class PublicClass");
    });

    test("--format json should produce parseable JSON output", () => {
        const result = runDistill(["--stdout", "--format", "json"]);

        expect(result.status).toBe(0);

        const parsed = JSON.parse(result.output);
        expect(parsed.files.length).toBeGreaterThan(0);
        expect(parsed.metadata.fileCount).toBeGreaterThan(0);
    });

    test("--private and --protected should be accepted and include private python members", () => {
        const baseline = runDistill(["--stdout"]);
        const result = runDistill([
            "--stdout",
            "--private",
            "1",
            "--protected",
            "1",
        ]);

        expect(baseline.status).toBe(0);
        expect(baseline.output).not.toContain("_private_method");
        expect(result.status).toBe(0);
        expect(result.output).toContain("_private_method");
    });

    test("--dry-run should report files and token estimates", () => {
        const result = runDistill(["--dry-run"]);

        expect(result.status).toBe(0);
        expect(result.output).toContain("Dry run - Files that would be processed");
        expect(result.output).toContain("Summary:");
        expect(result.output).toContain("Original tokens:");
        expect(result.output).toContain("Estimated tokens:");
    });

    test("--workers should be accepted", () => {
        const result = runDistill(["--stdout", "--workers", "1"]);

        expect(result.status).toBe(0);
        expect(result.output).toContain("PublicClass");
    });

    test("should accept safety flags", () => {
        const result = runDistill([
            "--stdout",
            "--include-sensitive",
            "--yes",
            "--target",
            "claude",
        ]);

        expect(result.status).toBe(0);
        expect(result.output).toContain("PublicClass");
    });

    test("should require --yes for non-tty unsafe override", () => {
        const result = runDistill([
            "--stdout",
            "--include-sensitive",
            "--target",
            "claude",
        ]);

        expect(result.status).toBe(1);
        expect(result.output).toContain(
            "Non-interactive unsafe override requires --yes",
        );
    });

    test("--target should validate allowed values", () => {
        const result = runDistill(["--stdout", "--target", "invalid-target"]);

        expect(result.status).toBe(1);
        expect(result.output).toContain("Allowed choices are");
    });

    test("should handle non-existent path gracefully", () => {
        const result = runDistill([], "/non/existent/path");
        expect(result.status).toBe(1);
        expect(result.output).toContain("Path not found");
    });

    test("should handle invalid options", () => {
        const result = runDistill(["--invalid-option"]);
        expect(result.status).toBe(1);
        expect(result.output).toContain("unknown option");
    });
});
