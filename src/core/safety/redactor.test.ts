// @ts-expect-error - bun:test types not available in this environment
import { describe, expect, test } from "bun:test";
import { SensitiveDataRedactor, getRedactionPlaceholder } from "./redactor.js";
import { SensitiveDataScanner } from "./scanner.js";

describe("SensitiveDataRedactor", () => {
    test("should redact findings with deterministic placeholders", () => {
        const scanner = new SensitiveDataScanner();
        const redactor = new SensitiveDataRedactor();
        const content = [
            "email=jane.doe@example.com",
            "apiKey=sk-1234567890abcdefghijkl",
        ].join("\n");

        const findings = scanner.scanPayload(content).findings;
        const result = redactor.redact(content, findings);

        expect(result.content).toContain(getRedactionPlaceholder("email"));
        expect(result.content).toContain(getRedactionPlaceholder("credential"));
        expect(result.summary.applied).toBe(2);
        expect(result.summary.countsByCategory.email).toBe(1);
        expect(result.summary.countsByCategory.credential).toBe(1);
    });

    test("should skip redaction when includeSensitive is true", () => {
        const scanner = new SensitiveDataScanner();
        const redactor = new SensitiveDataRedactor();
        const content = "contact = jane.doe@example.com";
        const findings = scanner.scanPayload(content).findings;

        const result = redactor.redact(content, findings, {
            includeSensitive: true,
        });

        expect(result.content).toBe(content);
        expect(result.summary.applied).toBe(0);
        expect(result.summary.skipped).toBe(findings.length);
    });

    test("should preserve JSON parseability after redaction", () => {
        const scanner = new SensitiveDataScanner();
        const redactor = new SensitiveDataRedactor();
        const content = JSON.stringify({
            email: "jane.doe@example.com",
            token: "sk-1234567890abcdefghijkl",
        });

        const findings = scanner.scanPayload(content).findings;
        const result = redactor.redact(content, findings);
        const parsed = JSON.parse(result.content) as Record<string, string>;

        expect(parsed.email).toBe(getRedactionPlaceholder("email"));
        expect(parsed.token).toBe(getRedactionPlaceholder("credential"));
    });

    test("should produce deterministic output across runs", () => {
        const scanner = new SensitiveDataScanner();
        const redactor = new SensitiveDataRedactor();
        const content = "token=sk-1234567890abcdefghijkl";
        const findings = scanner.scanPayload(content).findings;

        const first = redactor.redact(content, findings);
        const second = redactor.redact(content, findings);

        expect(first.content).toBe(second.content);
        expect(first.summary).toEqual(second.summary);
    });
});

