export type FindingCategory =
    | "credential"
    | "private_key"
    | "secret_assignment"
    | "email"
    | "phone"
    | "ssn";

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type DetectionSource = "file" | "payload";

export interface ScannableFile {
    path: string;
    content: string;
}

export interface SensitiveFinding {
    id: string;
    category: FindingCategory;
    severity: FindingSeverity;
    source: DetectionSource;
    detector: string;
    match: string;
    filePath?: string;
    line?: number;
    start: number;
    end: number;
}

export interface DetectionPassResult {
    findings: SensitiveFinding[];
    countsByCategory: Record<FindingCategory, number>;
}

export interface TwoPassDetectionResult {
    filePass: DetectionPassResult;
    payloadPass: DetectionPassResult;
    findings: SensitiveFinding[];
    countsByCategory: Record<FindingCategory, number>;
}

interface DetectorDefinition {
    name: string;
    category: FindingCategory;
    severity: FindingSeverity;
    regex: RegExp;
}

const DEFAULT_DETECTORS: DetectorDefinition[] = [
    {
        name: "aws-access-key",
        category: "credential",
        severity: "high",
        regex: /\bAKIA[0-9A-Z]{16}\b/g,
    },
    {
        name: "github-token",
        category: "credential",
        severity: "high",
        regex: /\bghp_[A-Za-z0-9]{36}\b/g,
    },
    {
        name: "openai-like-secret",
        category: "credential",
        severity: "high",
        regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
    },
    {
        name: "jwt-like-token",
        category: "credential",
        severity: "medium",
        regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    },
    {
        name: "private-key-block",
        category: "private_key",
        severity: "critical",
        regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    },
    {
        name: "secret-assignment",
        category: "secret_assignment",
        severity: "high",
        regex: /\b(?:password|passwd|pwd|secret|api[_-]?key|token)\b\s*[:=]\s*["'][^"'\n]{4,}["']/gi,
    },
    {
        name: "email",
        category: "email",
        severity: "low",
        regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    },
    {
        name: "phone",
        category: "phone",
        severity: "low",
        regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
    },
    {
        name: "ssn-like",
        category: "ssn",
        severity: "high",
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    },
];

function createEmptyCounts(): Record<FindingCategory, number> {
    return {
        credential: 0,
        private_key: 0,
        secret_assignment: 0,
        email: 0,
        phone: 0,
        ssn: 0,
    };
}

function calculateLineHint(content: string, index: number): number {
    if (index <= 0) {
        return 1;
    }
    const prefix = content.slice(0, index);
    return prefix.split("\n").length;
}

function sanitizeMatch(value: string): string {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function buildFindingId(
    source: DetectionSource,
    detector: string,
    start: number,
    end: number,
    filePath?: string,
): string {
    return `${source}:${filePath ?? "payload"}:${detector}:${start}:${end}`;
}

export class SensitiveDataScanner {
    private readonly detectors: DetectorDefinition[];

    constructor(detectors: DetectorDefinition[] = DEFAULT_DETECTORS) {
        this.detectors = detectors.map((detector: DetectorDefinition) => ({
            ...detector,
            regex: new RegExp(detector.regex.source, detector.regex.flags),
        }));
    }

    /**
     * Scan a set of files and return normalized findings with category counts.
     */
    scanFiles(files: ScannableFile[]): DetectionPassResult {
        const countsByCategory = createEmptyCounts();
        const findings: SensitiveFinding[] = [];

        for (const file of files) {
            const fileFindings = this.scanText(file.content, "file", file.path);
            for (const finding of fileFindings) {
                countsByCategory[finding.category] += 1;
                findings.push(finding);
            }
        }

        return {
            findings,
            countsByCategory,
        };
    }

    /**
     * Scan final assembled payload before output to catch composite leaks.
     */
    scanPayload(payload: string): DetectionPassResult {
        const findings = this.scanText(payload, "payload");
        const countsByCategory = createEmptyCounts();

        for (const finding of findings) {
            countsByCategory[finding.category] += 1;
        }

        return {
            findings,
            countsByCategory,
        };
    }

    /**
     * Run required two-pass safety detection: file pass + payload pass.
     */
    scanTwoPass(files: ScannableFile[], payload: string): TwoPassDetectionResult {
        const filePass = this.scanFiles(files);
        const payloadPass = this.scanPayload(payload);
        const countsByCategory = createEmptyCounts();

        for (const category of Object.keys(countsByCategory) as FindingCategory[]) {
            countsByCategory[category] =
                filePass.countsByCategory[category] +
                payloadPass.countsByCategory[category];
        }

        return {
            filePass,
            payloadPass,
            findings: [...filePass.findings, ...payloadPass.findings],
            countsByCategory,
        };
    }

    private scanText(
        content: string,
        source: DetectionSource,
        filePath?: string,
    ): SensitiveFinding[] {
        const findings: SensitiveFinding[] = [];
        const seen = new Set<string>();

        for (const detector of this.detectors) {
            const regex = new RegExp(detector.regex.source, detector.regex.flags);
            let match: RegExpExecArray | null = null;

            try {
                while ((match = regex.exec(content)) !== null) {
                    const matchedValue = match[0];
                    const start = match.index;
                    const end = start + matchedValue.length;
                    const findingId = buildFindingId(
                        source,
                        detector.name,
                        start,
                        end,
                        filePath,
                    );

                    if (seen.has(findingId)) {
                        continue;
                    }

                    seen.add(findingId);
                    findings.push({
                        id: findingId,
                        category: detector.category,
                        severity: detector.severity,
                        source,
                        detector: detector.name,
                        match: sanitizeMatch(matchedValue),
                        filePath,
                        line:
                            source === "file"
                                ? calculateLineHint(content, start)
                                : undefined,
                        start,
                        end,
                    });
                }
            } catch (error) {
                throw new Error(
                    `Sensitive data detection failed for detector '${detector.name}': ${
                        error instanceof Error ? error.message : "Unknown error"
                    }`,
                );
            }
        }

        return findings;
    }
}

