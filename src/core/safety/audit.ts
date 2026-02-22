import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { simpleGit } from "simple-git";
import type { FindingCategory } from "./scanner.js";

export interface SafetyAuditEntry {
    command: "extract" | "distill" | "combine";
    outputPath: string;
    payload: string;
    target?: "claude" | "gpt" | "local" | "custom";
    includeSensitive?: boolean;
    redactionCountsByType: Record<FindingCategory, number>;
    result: "success" | "failed";
}

interface PersistedSafetyAuditEntry {
    timestamp: string;
    command: "extract" | "distill" | "combine";
    outputPath: string;
    payloadHash: string;
    target: "claude" | "gpt" | "local" | "custom" | "unspecified";
    includeSensitive: boolean;
    redactionCountsByType: Record<FindingCategory, number>;
    result: "success" | "failed";
}

async function resolveProjectRoot(workingDir: string): Promise<string> {
    try {
        const git = simpleGit(workingDir);
        const root = await git.revparse(["--show-toplevel"]);
        return root.trim();
    } catch {
        return workingDir;
    }
}

function buildPayloadHash(payload: string): string {
    return createHash("sha256").update(payload).digest("hex");
}

export async function appendSafetyAuditManifest(
    entry: SafetyAuditEntry,
    workingDir: string = process.cwd(),
): Promise<void> {
    const projectRoot = await resolveProjectRoot(workingDir);
    const auditDir = join(projectRoot, ".dex", "audit");
    const manifestPath = join(auditDir, "manifest.jsonl");

    const persisted: PersistedSafetyAuditEntry = {
        timestamp: new Date().toISOString(),
        command: entry.command,
        outputPath: entry.outputPath,
        payloadHash: buildPayloadHash(entry.payload),
        target: entry.target || "unspecified",
        includeSensitive: entry.includeSensitive === true,
        redactionCountsByType: entry.redactionCountsByType,
        result: entry.result,
    };

    await fs.mkdir(auditDir, { recursive: true });
    await fs.appendFile(manifestPath, `${JSON.stringify(persisted)}\n`, "utf-8");
}

