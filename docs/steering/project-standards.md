# DEX Project Standards

These development standards for DEX are mandatory for all code contributions to ensure consistency, quality, and architectural integrity of our code analysis CLI tool.

-----

## Core Architecture

DEX uses a **command-based CLI architecture** with pluggable parsers and formatters for flexible code analysis and context extraction.

### Command Pattern
- **Commands:** Each command (extract, distill, combine, tree) is a self-contained module with its own options and logic.
  ```typescript
  // Command structure
  export function createDistillCommand(): Command {
    return new Command("distill")
      .description("Compress and distill entire codebases...")
      .option("-f, --format <type>", "Processing format", "distilled")
      .action(async (path, options) => {
        await distillCommand(path, options);
      });
  }
  ```

### Parser Abstraction
- **Abstract Parser:** All parsers implement the same interface for consistency.
  ```typescript
  abstract class Parser {
    abstract initialize(): Promise<void>;
    abstract parse(content: string, language: string): Promise<ParsedFile>;
    abstract extract(parsedFile: ParsedFile): ExtractedAPI;
    abstract isLanguageSupported(language: string): boolean;
  }
  ```

### Git-Centric Architecture
Project root detection and file operations are git-aware, using `git revparse --show-toplevel` to ensure consistent behavior regardless of working directory.

-----

## TypeScript Standards

### Strict Mode Enforcement
TypeScript strict mode is mandatory. All public APIs require explicit types with comprehensive interfaces.

```typescript
// Explicit interface definitions
export interface DistillerOptions {
  path?: string;
  compressFirst?: boolean;
  excludePatterns?: string[];
  includeComments?: boolean;
  format?: "compressed" | "distilled" | "both";
  dryRun?: boolean;
}

// Type-safe option parsing
function parseOptions(rawOptions: Record<string, any>): DistillerOptions {
  return {
    compressFirst: rawOptions.compress !== false,
    excludePatterns: rawOptions.exclude || [],
    // ... validate all options
  };
}
```

### External Data Validation
All external inputs (file content, git output, user options) must be validated:

```typescript
// Git output validation
async function getGitRoot(): Promise<string> {
  try {
    const root = await git.revparse(["--show-toplevel"]);
    if (!root || typeof root !== 'string') {
      throw new Error("Invalid git root response");
    }
    return root.trim();
  } catch (error) {
    // Fallback to working directory
    return process.cwd();
  }
}
```

-----

## Code Organization

### Directory Structure
```
src/
├── cli.ts              # Main CLI entry point
├── commands/           # Command implementations
│   ├── distill.ts
│   ├── combine.ts
│   └── tree.ts
├── core/              # Core business logic
│   ├── git.ts
│   ├── distiller/
│   └── parser/
├── utils/             # Utility functions
└── types.ts           # Type definitions
```

### Export Patterns
- Use **named exports** for classes, functions, and types
- Export command creators as functions
- Group related utilities in namespaced exports

```typescript
// Named exports for main functionality
export { Distiller } from './distiller';
export { GitExtractor } from './git';
export type { DistillerOptions } from './types';

// Command exports
export function createDistillCommand(): Command { /* ... */ }
```

### Import Organization
Order imports: 1) Node.js built-ins, 2) external libraries, 3) types, 4) internal modules

```typescript
import { promises as fs } from "fs";
import { resolve, basename } from "path";
import chalk from "chalk";
import { Command } from "commander";
import type { DistillerOptions } from "../types";
import { Distiller } from "../core/distiller";
```

-----

## Error Handling & User Experience

### Custom Error Classes
Define specific error types for different failure modes:

```typescript
export class GitRepositoryError extends Error {
  constructor(message: string) {
    super(`Git repository error: ${message}`);
    this.name = "GitRepositoryError";
  }
}

export class FileProcessingError extends Error {
  constructor(filePath: string, cause: Error) {
    super(`Failed to process ${filePath}: ${cause.message}`);
    this.name = "FileProcessingError";
    this.cause = cause;
  }
}
```

### Graceful Degradation
Commands should provide helpful error messages and recovery suggestions:

```typescript
// User-friendly error handling
try {
  await gitExtractor.getCurrentChanges();
} catch (error) {
  if (error instanceof GitRepositoryError) {
    console.error(chalk.red("Error: Not in a git repository"));
    console.log(chalk.yellow("To analyze files directly, use:"));
    console.log(chalk.green("  dex distill ./"));
    process.exit(1);
  }
  throw error;
}
```

### Progress Reporting
Long-running operations must provide progress feedback:

```typescript
class DistillerProgress {
  private spinner = ora();

  start(totalFiles: number): void {
    this.spinner.start(`Processing ${totalFiles} files...`);
  }

  update(processed: number, total: number): void {
    this.spinner.text = `Processed ${processed}/${total} files`;
  }

  complete(result: { fileCount: number; compressionRatio: number }): void {
    this.spinner.succeed(
      `✨ Distilled ${result.fileCount} files with ${(result.compressionRatio * 100).toFixed(1)}% compression`
    );
  }
}
```

-----

## File System & Path Handling

### Project Root Detection
Always use git-aware project root detection for consistent file operations:

```typescript
class OutputManager {
  private async getProjectRoot(): Promise<string> {
    try {
      const git = simpleGit(this.workingDir);
      const root = await git.revparse(["--show-toplevel"]);
      return root.trim();
    } catch {
      return this.workingDir; // Fallback for non-git projects
    }
  }
}
```

### Path Safety
Use proper path handling to prevent directory traversal and ensure cross-platform compatibility:

```typescript
// Safe path resolution
function resolveSafePath(userPath: string, basePath: string): string {
  const resolved = path.resolve(basePath, userPath);

  // Ensure resolved path is within base path
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error(`Path ${userPath} is outside allowed directory`);
  }

  return resolved;
}
```

-----

## Performance & Resource Management

### Async Operations
Use proper async/await patterns and handle concurrent operations safely:

```typescript
// Controlled concurrency
async function processFiles(files: string[], maxConcurrency = 5): Promise<Result[]> {
  const results: Result[] = [];

  for (let i = 0; i < files.length; i += maxConcurrency) {
    const batch = files.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(file => processFile(file))
    );
    results.push(...batchResults);
  }

  return results;
}
```

### Memory Management
Process large files in streams and clean up resources properly:

```typescript
async function processLargeFile(filePath: string): Promise<void> {
  const stream = fs.createReadStream(filePath);

  try {
    // Process in chunks
    for await (const chunk of stream) {
      await processChunk(chunk);
    }
  } finally {
    stream.destroy(); // Ensure cleanup
  }
}
```

-----

## Testing & Quality Assurance

### Unit Tests
All core functionality must have comprehensive unit tests:

```typescript
import { test, expect } from "bun:test";
import { GitExtractor } from "../core/git";

test("GitExtractor detects git repository", async () => {
  const extractor = new GitExtractor();
  const isGitRepo = await extractor.isGitRepository();
  expect(isGitRepo).toBe(true);
});

test("handles non-git directory gracefully", async () => {
  const extractor = new GitExtractor("/tmp");
  const isGitRepo = await extractor.isGitRepository();
  expect(isGitRepo).toBe(false);
});
```

### Integration Tests
Test command-line interfaces with realistic scenarios:

```typescript
test("distill command processes files correctly", async () => {
  const tempDir = await createTempProject();
  const result = await runCLI(["distill", tempDir, "--dry-run"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Files that would be processed");
});
```

-----

## Documentation Standards

### JSDoc Requirements
All public APIs must have comprehensive JSDoc documentation:

```typescript
/**
 * Extracts and analyzes code structure from files
 *
 * @param targetPath - Path to file or directory to analyze
 * @param options - Configuration options for distillation
 * @returns Promise resolving to distillation results
 *
 * @example
 * ```typescript
 * const distiller = new Distiller({ format: "distilled" });
 * const result = await distiller.distill("./src");
 * console.log(`Processed ${result.structure.fileCount} files`);
 * ```
 *
 * @throws {FileProcessingError} When file cannot be processed
 * @throws {GitRepositoryError} When git operations fail
 */
async distill(targetPath: string, options: DistillerOptions): Promise<DistillationResult> {
  // Implementation
}
```

### CLI Help Text
Command help must be clear and include practical examples:

```typescript
command
  .description("Compress and distill entire codebases into token-efficient formats")
  .addHelpText('after', `
Examples:
  $ dex distill src/           # Distill source directory
  $ dex distill --dry-run      # Preview files without processing
  $ dex distill --exclude "**/*.test.ts"  # Exclude test files
  `);
```

-----

## Version Control & Maintenance

### Commit Standards
- **Atomic commits:** Each commit should represent a complete, testable change
- **Descriptive messages:** Follow conventional commit format
- **Include tests:** New features must include corresponding tests

### Breaking Changes
- Update version numbers following semantic versioning
- Document breaking changes in CHANGELOG.md
- Provide migration guidance for CLI changes

### Code Review Requirements
- All changes require review focusing on:
  - Type safety and error handling
  - User experience and error messages
  - Performance implications
  - Test coverage
  - Documentation completeness

This document is living and should be updated as DEX evolves, ensuring all changes align with our core principles of reliability, usability, and maintainability.
