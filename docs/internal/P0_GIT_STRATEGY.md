# P0 Git Strategy

This document defines the minimum git hygiene expected for DEX development.

## Branching

- `main` is always releasable.
- Create short-lived feature branches from `main`.
- Keep one logical change per branch.

## Commit Strategy

- Prefer small, reviewable commits.
- Commit messages should explain intent and impact.
- Avoid "wip" and "fix" messages without context.

## Pull Requests

Before opening a PR, run:

```bash
bun run typecheck
bun test
bun run lint
```

PRs should include:

- What changed
- Why it changed
- How it was validated
- Any migration or compatibility notes

## Review Expectations

- Prioritize correctness, regressions, and maintainability.
- Require tests for behavior changes.
- Keep feedback specific and actionable.

## Merge Policy

- Do not merge failing checks.
- Prefer squash merges for focused history unless preserving commit boundaries is useful.
- Do not rewrite shared branch history after review starts.
