// @ts-expect-error - bun:test types not available in this environment
import { describe, expect, test } from "bun:test";
import {
    ensureUnsafeOverrideConfirmed,
    runSafetyPipeline,
} from "./pipeline.js";

describe("safety pipeline", () => {
    test("should redact payload findings by default", () => {
        const result = runSafetyPipeline({
            command: "extract",
            payload: "email=jane.doe@example.com",
            files: [
                {
                    path: "src/a.ts",
                    content: "const noop = true;",
                },
            ],
        });

        expect(result.output).toContain("[REDACTED:EMAIL]");
        expect(result.scan.payloadPass.countsByCategory.email).toBe(1);
    });

    test("should throw when unsafe override is unconfirmed in non-tty mode", () => {
        expect(() => ensureUnsafeOverrideConfirmed(true, false)).toThrow(
            "Non-interactive unsafe override requires --yes",
        );
    });
});

