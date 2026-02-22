# Contributing to DEX

Thanks for contributing to DEX.

## Prerequisites

- Bun 1.0+
- Git

## Local Setup

```bash
git clone https://github.com/scottbaggett/dex.git
cd dex
bun install
bun link
```

## Development Workflow

1. Create a branch from `main`.
2. Make focused changes with tests.
3. Run quality checks before opening a PR:

```bash
bun run typecheck
bun test
bun run lint
```

4. Update documentation when behavior changes.
5. Open a pull request with a clear description and test evidence.

## Branch and Commit Guidance

- Keep branches scoped to one change set.
- Prefer small, reviewable commits.
- Use descriptive commit messages (what changed and why).
- See `docs/internal/P0_GIT_STRATEGY.md` for the repository strategy.

## Testing Expectations

- Add or update tests for all behavior changes.
- Favor deterministic tests and explicit setup/teardown.
- For CLI changes, include integration-style tests where practical.

## Reporting Issues

Use GitHub Issues and include:

- Reproduction steps
- Expected behavior
- Actual behavior
- Environment details (`bun --version`, OS, command used)

## Security Issues

Do not file public issues for sensitive vulnerabilities.
See `SECURITY.md` for reporting instructions.
