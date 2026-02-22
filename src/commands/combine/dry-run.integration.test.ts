import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { countTokens, formatEstimatedTokens } from "../../utils/tokens.js";

test("combine --dry-run reports token estimate from content, not byte count", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "dex-combine-dry-run-"));
    const fileContent = "This is file 1 content";
    const cliPath = join(process.cwd(), "src/cli.ts");

    try {
        writeFileSync(join(fixtureDir, "file1.txt"), fileContent, "utf-8");

        const result = Bun.spawnSync({
            cmd: ["bun", "run", cliPath, "combine", "file1.txt", "--dry-run"],
            cwd: fixtureDir,
            stdout: "pipe",
            stderr: "pipe",
        });

        const stdout = new TextDecoder().decode(result.stdout);
        const stderr = new TextDecoder().decode(result.stderr);
        const output = `${stdout}\n${stderr}`;

        const expectedTokenEstimate = formatEstimatedTokens(
            countTokens(fileContent),
        );

        expect(result.exitCode).toBe(0);
        expect(output).toContain("Would process 1 files");
        expect(output).toContain(expectedTokenEstimate);
        expect(output).not.toContain("~22 tokens");
    } finally {
        rmSync(fixtureDir, { recursive: true, force: true });
    }
});
