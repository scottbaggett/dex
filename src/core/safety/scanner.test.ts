// @ts-expect-error - bun:test types not available in this environment
import { describe, expect, test } from "bun:test";
import { SensitiveDataScanner, type ScannableFile } from "./scanner.js";

describe("SensitiveDataScanner", () => {
    test("should detect credentials in file pass with line hints", () => {
        const scanner = new SensitiveDataScanner();
        const files: ScannableFile[] = [
            {
                path: "src/config.ts",
                content: [
                    "export const endpoint = 'https://api.example.com';",
                    "export const key = 'sk-1234567890abcdefghijkl';",
                ].join("\n"),
            },
        ];

        const result = scanner.scanFiles(files);
        const credentialFinding = result.findings.find(
            (finding) => finding.category === "credential",
        );

        expect(credentialFinding).toBeDefined();
        expect(credentialFinding?.source).toBe("file");
        expect(credentialFinding?.filePath).toBe("src/config.ts");
        expect(credentialFinding?.line).toBe(2);
        expect(result.countsByCategory.credential).toBeGreaterThanOrEqual(1);
    });

    test("should detect private key blocks", () => {
        const scanner = new SensitiveDataScanner();
        const result = scanner.scanFiles([
            {
                path: "id_rsa",
                content: [
                    "-----BEGIN PRIVATE KEY-----",
                    "MIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA4",
                    "-----END PRIVATE KEY-----",
                ].join("\n"),
            },
        ]);

        expect(result.countsByCategory.private_key).toBe(1);
        expect(result.findings[0]?.severity).toBe("critical");
    });

    test("should run two-pass scanning and capture payload-only findings", () => {
        const scanner = new SensitiveDataScanner();
        const files: ScannableFile[] = [
            {
                path: "src/user.ts",
                content: "export const userName = 'Jane';",
            },
        ];
        const payload = [
            "Context snapshot",
            "Contact: jane.doe@example.com",
        ].join("\n");

        const result = scanner.scanTwoPass(files, payload);

        expect(result.filePass.findings.length).toBe(0);
        expect(result.payloadPass.countsByCategory.email).toBe(1);
        expect(result.countsByCategory.email).toBe(1);
        expect(
            result.findings.some((finding) => finding.source === "payload"),
        ).toBe(true);
    });

    test("should detect secret assignments and ssn-like patterns", () => {
        const scanner = new SensitiveDataScanner();
        const result = scanner.scanFiles([
            {
                path: "src/env.ts",
                content: [
                    "const password = \"super-secret-password\";",
                    "const fakeSsn = \"123-45-6789\";",
                ].join("\n"),
            },
        ]);

        expect(result.countsByCategory.secret_assignment).toBe(1);
        expect(result.countsByCategory.ssn).toBe(1);
    });
});

