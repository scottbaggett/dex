// @ts-expect-error - bun:test types not available in this environment
import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { appendSafetyAuditManifest } from "./audit.js";

describe("appendSafetyAuditManifest", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        for (const tempDir of tempDirs) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        tempDirs.length = 0;
    });

    test("should append jsonl audit entries with payload hash", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dex-audit-"));
        tempDirs.push(tempDir);

        await appendSafetyAuditManifest(
            {
                command: "extract",
                outputPath: "stdout",
                payload: "email=jane.doe@example.com",
                target: "claude",
                includeSensitive: false,
                redactionCountsByType: {
                    credential: 0,
                    private_key: 0,
                    secret_assignment: 0,
                    email: 1,
                    phone: 0,
                    ssn: 0,
                },
                result: "success",
            },
            tempDir,
        );

        const manifestPath = path.join(tempDir, ".dex", "audit", "manifest.jsonl");
        const raw = await fs.readFile(manifestPath, "utf-8");
        const line = raw.trim();
        const parsed = JSON.parse(line) as Record<string, unknown>;

        expect(parsed.command).toBe("extract");
        expect(parsed.outputPath).toBe("stdout");
        expect(parsed.payloadHash).toBeString();
        expect((parsed.payloadHash as string).length).toBe(64);
        expect(parsed.target).toBe("claude");
        expect(parsed.result).toBe("success");
        expect(line).not.toContain("jane.doe@example.com");
    });
});

