# PRD: Safety-First Context Transfer for Dex (Lean v2)

**Status:** Draft v2.0  
**Date:** 2026-02-22  
**Owner:** Dex Core  
**Related:** `docs/internal/P0_CHARTER.md`, `docs/internal/P0_GIT_STRATEGY.md`

## 1. Why This Matters

Every AI-assisted coding tool is a trust boundary. The moment code leaves a repo and enters a model context window, it becomes a potential exfiltration event. Most tools optimize for "send more context" and treat safety as a configuration exercise rather than a default. Dex should optimize for "send safe context by default."

This is not an enterprise compliance product. It is a developer tool with strong opinions: always scan, redact by default, and leave an audit trail on every output.

## 2. Product Thesis

Dex is not just a context compressor. Dex is a safe context transfer layer between source code and models.

## 3. Scope (v1)

Three decisions are in scope and non-negotiable:

1. **Always-on scanning:** `extract`, `distill`, and `combine` always run secret/PII detection.
2. **Redact-by-default:** sensitive spans are redacted unless user explicitly opts into inclusion.
3. **Audit-every-output:** every generated output writes a manifest entry in `.dex/audit/`.

Everything else is out of scope for v1.

## 4. Non-Goals (v1)

1. Domain profiles (`regulated-health`, `regulated-finance`, etc.).
2. Policy matrix gating by profile/target/command.
3. Dedicated audit query/verify commands.
4. Plugin framework for custom detectors.
5. Full DLP or legal/compliance feature set.

## 5. User Experience

### 5.1 Default behavior

1. User runs `dex extract|distill|combine`.
2. Dex scans candidate content for sensitive material.
3. Dex redacts findings with deterministic placeholders.
4. Dex writes output.
5. Dex writes an audit manifest entry for that run.

### 5.2 Explicit override behavior

1. User can include sensitive content using `--include-sensitive`.
2. CLI warns that sensitive content may be exported.
3. Audit manifest records override usage.

### 5.3 Destination metadata

1. User can set `--target claude|gpt|local|custom`.
2. `--target` is recorded in audit metadata only.
3. No target-based blocking logic in v1.

## 6. Functional Requirements

### 6.1 Detection

Dex must detect at least:

1. API keys and token-like credentials.
2. Private key blocks.
3. Password/secret assignments.
4. Obvious PII patterns: email, phone, SSN-like patterns.

Detection runs in two passes:

1. **Per-file pass:** scans individual file content as selected for command execution. Catches secrets and PII present in source files.
2. **Payload pass:** scans the final assembled payload before output write. Catches sensitive material that only manifests when files are combined (e.g., credentials split across imports, composite patterns).

Both passes are required. The payload pass is the final gate before any content leaves the system.

### 6.2 Redaction

1. Redactions use deterministic placeholders such as:
   - `[REDACTED:SECRET]`
   - `[REDACTED:EMAIL]`
2. Redaction must preserve valid output formats (`txt`, `md`, `json`, `xml`).
3. Output summary must include redaction counts by category.

### 6.3 Override

1. `--include-sensitive` disables redaction for matched spans.
2. Non-TTY runs require `--yes` when `--include-sensitive` is used.
3. Override path is clearly logged in manifest.

**Known limitation (v1):** `--include-sensitive` is a global toggle. Path-scoped overrides (e.g., `--include-sensitive "src/public-api/**"`) are a natural extension but out of scope for v1.

### 6.4 Audit Manifest

For every output-producing run, Dex appends JSONL to `.dex/audit/manifest.jsonl` containing:

1. timestamp (ISO8601)
2. command (`extract|distill|combine`)
3. output path
4. payload hash (SHA-256)
5. target (or `unspecified`)
6. redaction counts by type
7. whether `--include-sensitive` was used
8. execution result (`success|failed`)

No raw sensitive payload is stored in audit logs.

### 6.5 Standalone Scan Command

1. Add `dex scan [path]`.
2. Outputs detection summary without generating context output.
3. Supports machine-readable output format for CI (`--format json`).

## 7. CLI Surface (v1)

1. `dex extract --target claude`
2. `dex distill --include-sensitive --yes --target local`
3. `dex combine --target custom`
4. `dex scan . --format json`

## 8. Success Metrics

1. >=95% detection/redaction rate on seeded secret fixtures.
2. 100% of output-producing runs generate audit manifest records.
3. Median runtime overhead <=20% versus current baseline.
4. 0 uncaught errors from safety pipeline in command integration tests.

## 9. Delivery Plan (Single Phase)

1. Add schemas/options:
   - `includeSensitive: boolean`
   - `yes: boolean`
   - `target?: "claude" | "gpt" | "local" | "custom"`
2. Implement detector pipeline and deterministic redactor.
3. Integrate into `extract`, `distill`, and `combine`.
4. Add audit manifest writer in output flow.
5. Add `scan` command.
6. Add tests and docs.

## 10. Test Plan

1. Unit tests for each detector category.
2. Unit tests for redaction formatting integrity.
3. Integration tests per command to verify:
   - detection runs by default
   - redaction is default
   - override works only with explicit flags
   - audit manifest entry is always written
4. Fixture tests for seeded secrets and PII.
5. Run full suite with:

```bash
bun test
```

## 11. Definition of Done

1. `extract`, `distill`, and `combine` always scan and redact by default.
2. `--include-sensitive` is the only override and is auditable.
3. Every output-producing run appends a manifest entry.
4. `dex scan` is available and tested.
5. Documentation includes safety rationale and behavior.
