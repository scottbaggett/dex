// @ts-expect-error - bun:test types not available in this environment
import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SensitiveDataScanner } from "./scanner.js";
import { SensitiveDataRedactor } from "./redactor.js";

describe("safety fixture integration", () => {
    test("should achieve high detection and redaction coverage on seeded fixture", () => {
        const fixturePath = resolve(
            process.cwd(),
            "tests/fixtures/safety/seeded-sensitive.ts",
        );
        const content = readFileSync(fixturePath, "utf-8");
        const scanner = new SensitiveDataScanner();
        const redactor = new SensitiveDataRedactor();

        const result = scanner.scanTwoPass(
            [{ path: "tests/fixtures/safety/seeded-sensitive.ts", content }],
            content,
        );
        const redacted = redactor.redact(content, result.payloadPass.findings, {
            source: "payload",
        });

        const expectedMinimumDetections = 19;
        const expectedMinimumRedactions = 19;

        expect(result.findings.length).toBeGreaterThanOrEqual(
            expectedMinimumDetections,
        );
        expect(redacted.summary.applied).toBeGreaterThanOrEqual(
            expectedMinimumRedactions,
        );

        const detectionCoverage =
            (result.findings.length / expectedMinimumDetections) * 100;
        const redactionCoverage =
            (redacted.summary.applied / expectedMinimumRedactions) * 100;

        expect(detectionCoverage).toBeGreaterThanOrEqual(95);
        expect(redactionCoverage).toBeGreaterThanOrEqual(95);
    });
});

