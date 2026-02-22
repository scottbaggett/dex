import type {
    DetectionSource,
    FindingCategory,
    SensitiveFinding,
} from "./scanner.js";

export interface RedactionSummary {
    applied: number;
    skipped: number;
    countsByCategory: Record<FindingCategory, number>;
}

export interface RedactionResult {
    content: string;
    summary: RedactionSummary;
}

export interface RedactionOptions {
    includeSensitive?: boolean;
    source?: DetectionSource;
}

interface RangeRedaction {
    start: number;
    end: number;
    category: FindingCategory;
}

const PLACEHOLDERS: Record<FindingCategory, string> = {
    credential: "[REDACTED:CREDENTIAL]",
    private_key: "[REDACTED:PRIVATE_KEY]",
    secret_assignment: "[REDACTED:SECRET]",
    email: "[REDACTED:EMAIL]",
    phone: "[REDACTED:PHONE]",
    ssn: "[REDACTED:SSN]",
};

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

function normalizeRanges(
    contentLength: number,
    findings: SensitiveFinding[],
): RangeRedaction[] {
    const ranges = findings
        .filter((finding) => finding.start >= 0 && finding.end > finding.start)
        .map((finding) => ({
            start: Math.max(0, Math.min(contentLength, finding.start)),
            end: Math.max(0, Math.min(contentLength, finding.end)),
            category: finding.category,
        }))
        .filter((range) => range.end > range.start)
        .sort((a, b) => {
            if (a.start !== b.start) {
                return a.start - b.start;
            }
            return b.end - a.end;
        });

    const nonOverlapping: RangeRedaction[] = [];
    let lastEnd = -1;

    for (const range of ranges) {
        if (range.start < lastEnd) {
            continue;
        }
        nonOverlapping.push(range);
        lastEnd = range.end;
    }

    return nonOverlapping;
}

export class SensitiveDataRedactor {
    /**
     * Redact sensitive spans from content deterministically.
     */
    redact(
        content: string,
        findings: SensitiveFinding[],
        options: RedactionOptions = {},
    ): RedactionResult {
        const countsByCategory = createEmptyCounts();
        const filteredFindings =
            options.source !== undefined
                ? findings.filter((finding) => finding.source === options.source)
                : findings;

        if (options.includeSensitive) {
            return {
                content,
                summary: {
                    applied: 0,
                    skipped: filteredFindings.length,
                    countsByCategory,
                },
            };
        }

        try {
            const ranges = normalizeRanges(content.length, filteredFindings);
            if (ranges.length === 0) {
                return {
                    content,
                    summary: {
                        applied: 0,
                        skipped: 0,
                        countsByCategory,
                    },
                };
            }

            let cursor = 0;
            const parts: string[] = [];

            for (const range of ranges) {
                parts.push(content.slice(cursor, range.start));
                parts.push(PLACEHOLDERS[range.category]);
                countsByCategory[range.category] += 1;
                cursor = range.end;
            }
            parts.push(content.slice(cursor));

            const applied = ranges.length;
            const skipped = Math.max(0, filteredFindings.length - applied);

            return {
                content: parts.join(""),
                summary: {
                    applied,
                    skipped,
                    countsByCategory,
                },
            };
        } catch (error) {
            throw new Error(
                `Sensitive content redaction failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            );
        }
    }
}

export function getRedactionPlaceholder(category: FindingCategory): string {
    return PLACEHOLDERS[category];
}

