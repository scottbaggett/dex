// @ts-expect-error - bun:test types not available in this environment
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Command } from "commander";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createScanCommand } from "./index.js";

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

describe("scan command", () => {
    let testDir: string;
    let originalCwd: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test-"));
        originalCwd = process.cwd();
        process.chdir(testDir);

        fs.writeFileSync(
            "secrets.ts",
            [
                "export const email = 'jane.doe@example.com';",
                "export const key = 'sk-1234567890abcdefghijkl';",
            ].join("\n"),
        );
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    test("should emit text summary output by default", async () => {
        const program = new Command();
        program.addCommand(createScanCommand());

        const output = await captureConsole(async () => {
            await parseUser(program, ["scan", "."]);
        });

        expect(output).toContain("Dex Safety Scan");
        expect(output).toContain("Findings:");
        expect(output).toContain("credential=");
    });

    test("should emit parseable json output", async () => {
        const program = new Command();
        program.addCommand(createScanCommand());

        const output = await captureConsole(async () => {
            await parseUser(program, ["scan", ".", "--format", "json"]);
        });

        const parsed = JSON.parse(output) as Record<string, unknown>;
        expect(parsed.scannedFiles).toBeNumber();
        expect(parsed.findingsCount).toBeNumber();
        expect(parsed.countsByCategory).toBeObject();
        expect(parsed.findings).toBeArray();
    });
});

