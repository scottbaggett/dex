import type { ModelTarget } from "../../schemas.js";
import type { ScannableFile } from "./scanner.js";
import { SensitiveDataRedactor, type RedactionResult } from "./redactor.js";
import {
    SensitiveDataScanner,
    type TwoPassDetectionResult,
} from "./scanner.js";

export interface SafetyPipelineOptions {
    command: "extract" | "distill" | "combine";
    payload: string;
    files: ScannableFile[];
    includeSensitive?: boolean;
    yes?: boolean;
    target?: ModelTarget;
}

export interface SafetyPipelineResult {
    output: string;
    scan: TwoPassDetectionResult;
    redaction: RedactionResult;
}

export function ensureUnsafeOverrideConfirmed(
    includeSensitive: boolean | undefined,
    yes: boolean | undefined,
): void {
    const isNonTTY = !process.stdin.isTTY || !process.stdout.isTTY;
    if (includeSensitive && isNonTTY && !yes) {
        throw new Error(
            "Non-interactive unsafe override requires --yes when using --include-sensitive",
        );
    }
}

/**
 * Run the default safety pipeline for output-producing commands:
 * file pass + payload pass + conditional redaction.
 */
export function runSafetyPipeline(
    options: SafetyPipelineOptions,
): SafetyPipelineResult {
    ensureUnsafeOverrideConfirmed(options.includeSensitive, options.yes);

    const scanner = new SensitiveDataScanner();
    const redactor = new SensitiveDataRedactor();

    const scan = scanner.scanTwoPass(options.files, options.payload);
    const redaction = redactor.redact(options.payload, scan.payloadPass.findings, {
        includeSensitive: options.includeSensitive,
        source: "payload",
    });

    return {
        output: redaction.content,
        scan,
        redaction,
    };
}

