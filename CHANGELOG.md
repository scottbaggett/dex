# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Worker-safe normalization helpers shared between distill paths
- Pattern matching utility shared across processors
- Parallel scanner concurrency tests
- Distill dry-run integration coverage for token estimates
- OSS governance docs (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`)

### Changed

- Distiller defaults to sequential worker mode when workers are unspecified
- `distillSelectedFiles` now guarantees cleanup via `finally`
- Tree command stdout path avoids progress object side effects
- Distill/Extract/Combine command tests updated for current CLI contracts
- TypeScript processor now normalizes legacy depth/private/import/compact options
- Python processor now preserves dunder special-method visibility semantics

### Fixed

- Worker path/test reliability regressions in distill and tree workflows
- Combine dry-run token estimation now uses content tokens instead of byte counts
- File scanner parallel limiter no longer drops concurrency tracking
- Cross-suite command test contamination from global monkey patches
- Distill JSON formatter tests aligned with structured schema contract
