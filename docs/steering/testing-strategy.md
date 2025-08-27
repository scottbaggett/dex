# DEX Testing Strategy

Essential testing patterns for reliable CLI functionality.

## Test Structure

```
src/
├── core/git.ts
├── core/git.test.ts         # Unit tests
├── commands/distill.test.ts # Integration tests
└── tests/
    ├── e2e/                 # End-to-end scenarios
    ├── fixtures/            # Test data
    └── helpers/             # Test utilities
```

## Unit Tests

**Test core logic with real examples**

```typescript
import { test, expect, describe } from "bun:test";
import { GitExtractor } from "./git";
import { DistillOptionsSchema } from "./schemas";

describe("GitExtractor", () => {
  test("detects git repository", async () => {
    const extractor = new GitExtractor();
    const isGitRepo = await extractor.isGitRepository();
    expect(isGitRepo).toBe(true);
  });

  test("handles non-git directory gracefully", async () => {
    const extractor = new GitExtractor("/tmp");
    const isGitRepo = await extractor.isGitRepository();
    expect(isGitRepo).toBe(false);
  });
});

describe("Schema validation", () => {
  test("validates options correctly", () => {
    const valid = { format: "md", exclude: ["*.test.ts"] };
    expect(() => DistillOptionsSchema.parse(valid)).not.toThrow();

    const invalid = { format: "bad-format" };
    expect(() => DistillOptionsSchema.parse(invalid)).toThrow();
  });
});
```

## Parser Testing

**Use real code samples**

```typescript
describe("RegexParser TypeScript", () => {
  test("extracts exported functions", async () => {
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
      signature: expect.stringContaining("(a: number, b: number)")
    });
  });

  test("distinguishes public/private methods", async () => {
    const code = `
      export class DataProcessor {
        public process(data: string): string { /* ... */ }
        private sanitize(input: string): string { /* ... */ }
      }
    `;

    const parser = new RegexParser();
    const parsed = await parser.parse(code, "typescript");
    const result = parser.extract(parsed);

    const classExport = result.exports[0];
    expect(classExport.members).toContainEqual(
      expect.objectContaining({ name: "process", visibility: "public" })
    );
    expect(classExport.members).toContainEqual(
      expect.objectContaining({ name: "sanitize", visibility: "private" })
    );
  });
});
```

## Integration Tests

**Test command workflows with temp directories**

```typescript
import { runCLI, createTestRepo } from "../tests/helpers";

describe("Distill command", () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await createTestRepo({
      "src/index.ts": "export const version = '1.0.0';",
      "src/utils.ts": "export function helper() { return true; }"
    });
  });

  test("distills repository successfully", async () => {
    const result = await runCLI(["distill", "src/"], { cwd: testRepo });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Distilled 2 files");

    // Verify output file
    const outputPath = path.join(testRepo, ".dex", "dex.distill.src.txt");
    const content = await fs.readFile(outputPath, "utf-8");
    expect(content).toContain("export const version");
  });

  test("respects exclude patterns", async () => {
    const result = await runCLI([
      "distill", "src/",
      "--exclude", "**/*.test.ts"
    ], { cwd: testRepo });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("test.ts");
  });
});
```

## E2E Tests

**Test complete user workflows**

```typescript
describe("Developer workflow", () => {
  test("analyzes unknown codebase", async () => {
    const project = await createTestRepo({
      "src/index.ts": "export { API } from './api';",
      "src/api.ts": "export class API { getData() {} }"
    });

    // Get overview
    const treeResult = await runCLI(["tree", "src/"], { cwd: project });
    expect(treeResult.stdout).toContain("API");

    // Distill files
    const distillResult = await runCLI(["distill", "src/"], { cwd: project });
    expect(distillResult.exitCode).toBe(0);
    expect(distillResult.stdout).toContain("Distilled 2 files");
  });

  test("AI agent consumes structured output", async () => {
    const project = await createTestRepo({
      "src/service.ts": `
        export interface UserService {
          getUser(id: string): Promise<User>;
        }
      `
    });

    const result = await runCLI(["distill", "src/", "--stdout"], { cwd: project });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("interface UserService");
    expect(result.stdout).toContain("getUser(id: string)");
  });
});
```

## Test Helpers

**CLI Runner**

```typescript
// tests/helpers/cli-runner.ts
export interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCLI(args: string[], options: { cwd?: string } = {}): Promise<CLIResult> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", "cli.ts", ...args], {
      cwd: options.cwd || process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => stdout += data.toString());
    child.stderr.on("data", (data) => stderr += data.toString());
    child.on("close", (code) => resolve({ exitCode: code || 0, stdout, stderr }));
  });
}
```

**Test Repository**

```typescript
// tests/helpers/temp-repo.ts
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import simpleGit from "simple-git";

export async function createTestRepo(files: Record<string, string> = {}): Promise<string> {
  const tempDir = await fs.mkdtemp(join(tmpdir(), "dex-test-"));

  // Init git
  const git = simpleGit(tempDir);
  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");

  // Create files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(tempDir, filePath);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return tempDir;
}
```

## Error Testing

**Test both success and failure paths**

```typescript
describe("Error handling", () => {
  test("invalid file path throws helpful error", async () => {
    await expect(distiller.distill("/nonexistent"))
      .rejects.toThrow("Path not found: /nonexistent");
  });

  test("git operations outside repo fail gracefully", async () => {
    const extractor = new GitExtractor("/tmp");
    await expect(extractor.getCurrentChanges())
      .rejects.toThrow("Not in a git repository");
  });

  test("schema validation provides clear errors", () => {
    expect(() => OptionsSchema.parse({ format: "invalid" }))
      .toThrow("Invalid enum value");
  });
});
```

## Coverage Requirements

- **85% minimum** for statements, functions, lines
- **80% minimum** for branches
- **100% coverage** for critical paths: parsers, git ops, CLI args

## Test Commands

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test
bun test --grep "should extract functions"

# Watch mode
bun test --watch

# Integration tests only
bun test --grep "integration"
```

## Best Practices

✅ **Do:**
- Test with realistic code samples
- Use descriptive test names
- Test both success and error paths
- Clean up temp directories
- Mock external dependencies

❌ **Don't:**
- Test private methods directly
- Share state between tests
- Ignore flaky tests
- Hardcode file paths
- Test implementation over behavior

Keep tests focused, fast, and reliable. Every feature needs tests before merging.
