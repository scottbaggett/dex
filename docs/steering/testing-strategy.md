# DEX Testing Strategy

This document outlines the testing strategy for DEX, a CLI tool for intelligent code analysis and context extraction. All code contributions must include tests following these guidelines to ensure reliability, maintainability, and architectural integrity.

## Testing Philosophy & Organization

Our testing philosophy prioritizes **real-world scenarios** over implementation details. Tests must verify that DEX works correctly across different project structures, file systems, and git repositories. We focus on testing behavior that users and AI agents depend on: accurate parsing, reliable git operations, consistent output formats, and graceful error handling.

We follow the testing pyramid model: **80% Unit tests** (parsers, utilities, core logic), **15% Integration tests** (command workflows, file operations), and **5% End-to-End tests** (full CLI scenarios).

### Test Organization

```
src/
├── core/
│   ├── git.ts
│   ├── git.test.ts              # Unit tests
│   └── git.integration.test.ts  # Integration tests
├── commands/
│   ├── distill.ts
│   └── distill.test.ts
└── __tests__/
    ├── e2e/
    │   ├── distill.e2e.test.ts
    │   └── extract.e2e.test.ts
    ├── fixtures/
    │   ├── sample-repos/
    │   └── test-files/
    └── helpers/
        ├── cli-runner.ts
        └── temp-repo.ts
```

## Unit Testing Standards

### Basic Structure

Use `describe`, `test`, and `expect` from `bun:test`. Group related functionality and use descriptive test names that explain the scenario being tested.

```typescript
import { test, expect, describe } from "bun:test";
import { GitExtractor } from "./git";

describe("GitExtractor", () => {
  test("should detect git repository correctly", async () => {
    const extractor = new GitExtractor();
    const isGitRepo = await extractor.isGitRepository();
    expect(isGitRepo).toBe(true);
  });

  test("should handle non-git directory gracefully", async () => {
    const extractor = new GitExtractor("/tmp");
    const isGitRepo = await extractor.isGitRepository();
    expect(isGitRepo).toBe(false);
  });
});
```

### Parser Testing

Test parsers with real code samples to ensure accurate extraction:

```typescript
import { RegexParser } from "./regex-parser";

describe("RegexParser TypeScript extraction", () => {
  test("should extract exported functions with signatures", async () => {
    const code = `
      export function calculateSum(a: number, b: number): number {
        return a + b;
      }
    `;

    const parser = new RegexParser();
    const parsed = await parser.parse(code, "typescript");
    const result = parser.extract(parsed);

    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]).toMatchObject({
      name: "calculateSum",
      type: "function",
      visibility: "public",
      signature: expect.stringContaining("(a: number, b: number): number")
    });
  });

  test("should distinguish between public and private class methods", async () => {
    const code = `
      export class DataProcessor {
        public process(data: string): string { /* ... */ }
        private sanitize(input: string): string { /* ... */ }
      }
    `;

    const parser = new RegexParser();
    const parsed = await parser.parse(code, "typescript");
    const result = parser.extract(parsed);

    const classExport = result.exports.find(e => e.name === "DataProcessor");
    expect(classExport?.members).toContainEqual(
      expect.objectContaining({ name: "process", visibility: "public" })
    );
    expect(classExport?.members).toContainEqual(
      expect.objectContaining({ name: "sanitize", visibility: "private" })
    );
  });
});
```

### File System Operations

Test file operations with temporary directories and mock scenarios:

```typescript
import { OutputManager } from "./output-manager";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers/temp-repo";

describe("OutputManager", () => {
  let tempDir: string;
  let outputManager: OutputManager;

  beforeEach(async () => {
    tempDir = await createTempDir();
    outputManager = new OutputManager(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  test("should create output file with correct naming pattern", async () => {
    const content = "# Test Output";
    const options = { command: "distill", context: "test", format: "markdown" };

    const filePath = await outputManager.saveOutput(content, options);

    expect(filePath).toMatch(/dex\.distill\.test\.txt$/);
    expect(await fs.readFile(filePath, "utf-8")).toBe(content);
  });

  test("should detect git root correctly", async () => {
    // Create a git repo in temp directory
    await simpleGit(tempDir).init();

    const projectRoot = await outputManager.getProjectRoot();
    expect(projectRoot).toBe(tempDir);
  });
});
```

### Error Handling

Test both expected errors and edge cases:

```typescript
describe("Error handling", () => {
  test("should throw specific error for invalid file path", async () => {
    const distiller = new Distiller({ path: "/nonexistent/path" });

    await expect(distiller.distill("/nonexistent/path"))
      .rejects.toThrow("Path not found: /nonexistent/path");
  });

  test("should provide helpful error message for git operations outside repo", async () => {
    const extractor = new GitExtractor("/tmp");

    await expect(extractor.getCurrentChanges())
      .rejects.toThrow("Not in a git repository");
  });

  test("should gracefully handle parser failures", async () => {
    const parser = new RegexParser();
    const malformedCode = "export function incomplete(";

    const parsed = await parser.parse(malformedCode, "typescript");
    const result = parser.extract(parsed);

    // Should not crash, may return partial results
    expect(result).toHaveProperty("exports");
    expect(Array.isArray(result.exports)).toBe(true);
  });
});
```

## Integration Testing

### Command Workflow Testing

Test complete command workflows with realistic scenarios:

```typescript
import { runCLI } from "../__tests__/helpers/cli-runner";
import { createTestRepo } from "../__tests__/helpers/temp-repo";

describe("Distill command integration", () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await createTestRepo({
      "src/index.ts": "export const version = '1.0.0';",
      "src/utils.ts": "export function helper() { return true; }"
    });
  });

  test("should distill repository and generate output file", async () => {
    const result = await runCLI(["distill", "src/"], { cwd: testRepo });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Distilled 2 files");
    expect(result.stdout).toContain("dex.distill.src.txt");

    // Verify output file exists and has expected content
    const outputPath = path.join(testRepo, ".dex", "dex.distill.src.txt");
    expect(await fs.pathExists(outputPath)).toBe(true);

    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("export const version");
    expect(content).toContain("export function helper");
  });

  test("should respect exclude patterns", async () => {
    const result = await runCLI([
      "distill", "src/",
      "--exclude", "**/*.test.ts"
    ], { cwd: testRepo });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("test.ts");
  });
});
```

### Git Integration Testing

Test git operations with real repositories:

```typescript
describe("Git integration", () => {
  test("should extract changes from commit range", async () => {
    const repo = await createTestRepo();
    const git = simpleGit(repo);

    // Create initial commit
    await git.add(".");
    await git.commit("Initial commit");

    // Make changes
    await fs.writeFile(path.join(repo, "new-file.ts"), "export const NEW = true;");
    await git.add(".");
    await git.commit("Add new file");

    // Test extraction
    const result = await runCLI(["HEAD~1..HEAD"], { cwd: repo });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("new-file.ts");
    expect(result.stdout).toContain("export const NEW");
  });
});
```

## End-to-End Testing

### Full CLI Scenarios

Test complete user workflows:

```typescript
describe("DEX E2E scenarios", () => {
  test("developer workflow: analyze unknown codebase", async () => {
    // Create a realistic project structure
    const project = await createTestRepo({
      "package.json": JSON.stringify({ name: "test-project" }),
      "src/index.ts": "export { API } from './api';",
      "src/api.ts": "export class API { public getData() {} }",
      "src/utils/helper.ts": "export function format(data: any) { return data; }"
    });

    // Step 1: Get overview with tree command
    const treeResult = await runCLI(["tree", "src/"], { cwd: project });
    expect(treeResult.exitCode).toBe(0);
    expect(treeResult.stdout).toContain("API");
    expect(treeResult.stdout).toContain("getData");

    // Step 2: Dry run to preview distillation
    const dryRunResult = await runCLI(["distill", "src/", "--dry-run"], { cwd: project });
    expect(dryRunResult.exitCode).toBe(0);
    expect(dryRunResult.stdout).toContain("Files that would be processed");
    expect(dryRunResult.stdout).toContain("3 files");

    // Step 3: Full distillation
    const distillResult = await runCLI(["distill", "src/"], { cwd: project });
    expect(distillResult.exitCode).toBe(0);
    expect(distillResult.stdout).toContain("Distilled 3 files");

    // Verify output quality
    const outputFile = path.join(project, ".dex", "dex.distill.src.txt");
    const content = await fs.readFile(outputFile, "utf-8");
    expect(content).toContain("export class API");
    expect(content).toContain("public getData()");
  });

  test("AI agent workflow: structured output consumption", async () => {
    const project = await createTestRepo({
      "src/service.ts": `
        export interface UserService {
          getUser(id: string): Promise<User>;
          updateUser(user: User): Promise<void>;
        }
      `
    });

    const result = await runCLI(["distill", "src/", "--stdout"], { cwd: project });

    expect(result.exitCode).toBe(0);

    // Verify structured output suitable for AI consumption
    const output = result.stdout;
    expect(output).toContain("interface UserService");
    expect(output).toContain("getUser(id: string): Promise<User>");
    expect(output).toContain("updateUser(user: User): Promise<void>");

    // Should be valid parseable format
    expect(() => {
      // Basic structural validation
      expect(output).toMatch(/<.*>/); // Contains structured markup
    }).not.toThrow();
  });
});
```

## Test Utilities & Helpers

### CLI Runner Helper

```typescript
// __tests__/helpers/cli-runner.ts
import { spawn } from "child_process";

export interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCLI(args: string[], options: { cwd?: string } = {}): Promise<CLIResult> {
  return new Promise((resolve) => {
    const child = spawn("node", ["dist/cli.js", ...args], {
      cwd: options.cwd || process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => stdout += data.toString());
    child.stderr.on("data", (data) => stderr += data.toString());

    child.on("close", (code) => {
      resolve({ exitCode: code || 0, stdout, stderr });
    });
  });
}
```

### Test Repository Helper

```typescript
// __tests__/helpers/temp-repo.ts
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import simpleGit from "simple-git";

export async function createTestRepo(files: Record<string, string> = {}): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dex-test-"));

  // Initialize git repo
  const git = simpleGit(tempDir);
  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");

  // Create files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return tempDir;
}

export async function cleanupTempDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}
```

## Performance & Coverage Requirements

### Performance Testing

```typescript
describe("Performance requirements", () => {
  test("should process large repository within reasonable time", async () => {
    const largeRepo = await createLargeTestRepo(100); // 100 files

    const startTime = Date.now();
    const result = await runCLI(["distill", "src/"], { cwd: largeRepo });
    const duration = Date.now() - startTime;

    expect(result.exitCode).toBe(0);
    expect(duration).toBeLessThan(30000); // 30 seconds max
  });

  test("should handle concurrent operations efficiently", async () => {
    const repo = await createTestRepo();

    const promises = Array(5).fill(0).map(() =>
      runCLI(["tree", "src/"], { cwd: repo })
    );

    const results = await Promise.all(promises);
    results.forEach(result => {
      expect(result.exitCode).toBe(0);
    });
  });
});
```

### Coverage Requirements

- **Statements**: 85% minimum
- **Functions**: 85% minimum
- **Lines**: 85% minimum
- **Branches**: 80% minimum

Critical paths require 100% coverage:
- Parser extraction logic
- Git operations
- File system operations
- Error handling paths
- CLI argument processing

### CI Pipeline

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    bun test --coverage --bail
    bun run test:integration
    bun run test:e2e

- name: Check coverage thresholds
  run: bun run coverage:check
```

## Best Practices

### Do:
- ✅ Test with realistic file structures and git repositories
- ✅ Use descriptive test names that explain the scenario
- ✅ Test both success and error paths
- ✅ Mock external dependencies (network, file system when appropriate)
- ✅ Test CLI output format stability for AI agent compatibility
- ✅ Use temporary directories for file system tests
- ✅ Clean up resources in `afterEach` hooks

### Don't:
- ❌ Test private methods directly
- ❌ Make real network requests in unit tests
- ❌ Share state between tests
- ❌ Hardcode file paths or rely on specific directory structures
- ❌ Ignore flaky tests - fix them immediately
- ❌ Test implementation details over behavior

### Debugging Test Failures

```bash
# Run specific test with verbose output
bun test --grep "should extract functions" --verbose

# Run tests in watch mode during development
bun test --watch

# Debug with inspector
bun test --inspect-wait --grep "failing test"

# Run only integration tests
bun test --grep "integration"
```

This testing strategy ensures DEX remains reliable, maintainable, and trustworthy for both developers and AI agents consuming its output.
