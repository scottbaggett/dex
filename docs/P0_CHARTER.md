# Dex Project Charter – P0 (v1.0)

## Mission

Build the fastest, most reliable CLI for **intelligent code analysis and context extraction**.
Dex turns any codebase—of any size—into **structured, token-efficient, agent-ready context** that’s still easy for humans to read.

---

## Core Pillars

1. **Command-Based CLI**

   * Each command (`extract`, `distill`, `combine`, `tree`) is self-contained, typed, and tested.
   * Clear, stable interfaces between CLI, core logic, and output.

2. **Pluggable Parsing**

   * Unified `Parser` interface: `init`, `parse`, `extract`, `supportsLanguage`.
   * Supports both high-precision (Tree-sitter) and fallback (regex) parsing.
   * Easy to add new languages without touching existing commands.

3. **Git as Source of Truth**

   * All file operations are git-aware.
   * Detects project root, respects ignore rules, works from any subdirectory.
   * Uses git metadata for change detection and context scoping.

4. **Token-Efficient, Agent-First Output**

   * Output is deterministic, unambiguous, and structured for machine parsing.
   * Human readability is secondary but never sacrificed entirely.

---

## Guiding Principles

* **Reliability First** – Must work consistently across OSes, filesystems, and repo layouts. Fail gracefully, explain failures clearly.
* **Speed + Scale** – Handle large repos efficiently with streaming, concurrency controls, and caching.
* **DX-Driven** – Sensible defaults, fast startup, `--dry-run` everywhere, rich help text.
* **Extensible** – Add new languages, outputs, and analyses without regressions.
* **Separation of Concerns** – Core logic has no CLI/UX code; CLI has no parsing or business logic.
* **Type Safety + Validation** – All options, results, and inputs validated with TypeScript + Zod.

---

## Non-Negotiable System Requirements

* **Parser Abstraction** – Every parser implements the unified interface.
* **Central Output Management** – All generated files in `.dex` at project root; consistent naming (`dex.<cmd>.<context>.<ext>`).
* **Progress Feedback** – For long operations, show file counts, phase names, ETA.
* **Error Boundaries** – Clear recovery paths; never crash with raw stack traces.
* **Comprehensive Testing** – Unit + integration + e2e. No feature “done” without tests.

---

## Command Definitions

### Extract

* Git-aware change analysis.
* Supports commit ranges, staged/unstaged, and smart file inclusion.

### Distill

* Full codebase/API extraction.
* Outputs structured symbol maps, dependency graphs, and summaries.
* Configurable depth & filtering.

### Combine

* Merges multiple files into a single structured context.
* Preserves relationships & metadata.

### Tree

* Visual or textual API structure.
* Custom grouping, formatting, and output target (terminal or file).

---

## User Experience Standards

* **Unix-Like** – Predictable flags, clear stdout/stderr usage.
* **Readable + Parseable Output** – No hidden ANSI codes in saved files.
* **Smart Defaults** – Works immediately on any repo without config.
* **Cross-Platform** – Identical behavior on macOS, Linux, Windows.

---

## Definition of Done for v1.0

1. **Developer Experience**
   Run `dex distill ./` in any repo and get a complete, agent-ready snapshot—no setup required.

2. **Agent Readiness**
   An LLM can consume the output and correctly infer architecture, key APIs, and dependencies.

3. **Integration Ready**
   Dex runs headless in CI/CD and automation pipelines; all outputs stable and versioned.

4. **Extensibility Proven**
   Adding a new language parser requires <30 min and no edits to unrelated commands.

---

## Enforcement

This charter is **the P0 baseline** for all decisions.
