# Task 05: Comprehensive Testing Coverage

## Problem
Insufficient test coverage. Only 7 test files exist. No integration or e2e tests as required by P0 Charter.

## Current State
- 37 passing tests across 7 files
- Only unit tests exist
- No integration tests
- No e2e tests
- No coverage reporting
- Missing tests for many components

## Requirements (P0 Charter)
- Unit tests for all components
- Integration tests for commands
- End-to-end tests for workflows
- No feature "done" without tests
- Coverage reporting

## Implementation Plan
1. Set up test structure and conventions
2. Add unit tests for all uncovered components
3. Create integration test suite
4. Implement e2e test scenarios
5. Add coverage reporting with targets
6. Set up CI/CD test pipeline
7. Document testing guidelines

## Acceptance Criteria
- [ ] >80% code coverage
- [ ] All commands have integration tests
- [ ] E2E tests for common workflows
- [ ] Test fixtures for different repo types
- [ ] Performance benchmarks
- [ ] Coverage reports generated
- [ ] Tests run in CI/CD

---

## 1. Test Structure and Organization

### Recommended Directory Structure

```
test/
├── unit/                     # Pure unit tests
│   ├── core/
│   │   ├── config.test.ts
│   │   ├── context.test.ts
│   │   ├── git.test.ts
│   │   ├── formatter.test.ts
│   │   ├── performance-monitor.test.ts
│   │   └── task-extractor.test.ts
│   ├── distiller/
│   │   ├── index.test.ts
│   │   ├── compression.test.ts
│   │   ├── progress.test.ts
│   │   └── formatters/
│   │       └── aid-style.test.ts
│   ├── parser/
│   │   ├── hybrid-parser.test.ts
│   │   ├── tree-sitter-parser.test.ts
│   │   └── ast-parser.test.ts
│   ├── templates/
│   │   ├── markdown.test.ts
│   │   ├── json.test.ts
│   │   └── xml.test.ts
│   └── utils/
│       ├── file-scanner.test.ts
│       ├── output-manager.test.ts
│       └── format.test.ts
├── integration/              # Command integration tests
│   ├── commands/
│   │   ├── combine.integration.test.ts
│   │   ├── config.integration.test.ts
│   │   ├── distill.integration.test.ts
│   │   ├── init.integration.test.ts
│   │   └── tree.integration.test.ts
│   ├── workflows/
│   │   ├── extract-distill.test.ts
│   │   ├── multi-format.test.ts
│   │   └── config-override.test.ts
│   └── git-scenarios/
│       ├── branch-extraction.test.ts
│       ├── staged-changes.test.ts
│       └── merge-conflicts.test.ts
├── e2e/                     # End-to-end scenarios
│   ├── full-workflows.test.ts
│   ├── large-repos.test.ts
│   ├── cross-platform.test.ts
│   └── error-recovery.test.ts
├── fixtures/                # Test data and repositories
│   ├── repos/
│   │   ├── simple-js/
│   │   ├── complex-ts/
│   │   ├── monorepo/
│   │   └── large-repo/
│   ├── configs/
│   │   ├── basic.dex.yml
│   │   ├── advanced.dex.yml
│   │   └── exclude-patterns.dex.yml
│   └── expected-outputs/
│       ├── markdown/
│       ├── json/
│       └── xml/
├── helpers/                 # Test utilities
│   ├── git-setup.ts
│   ├── temp-repo.ts
│   ├── fixtures-loader.ts
│   └── assertions.ts
└── performance/             # Benchmarks and perf tests
    ├── extract-benchmarks.test.ts
    ├── distill-benchmarks.test.ts
    └── memory-usage.test.ts
```

### Test Configuration (`bun.config.ts`)

```ts
import { defineConfig } from "bun";

export default defineConfig({
  test: {
    preload: ["./test/helpers/setup.ts"],
    coverage: {
      enabled: true,
      threshold: {
        line: 80,
        branch: 75,
        function: 80,
        statement: 80,
      },
      exclude: [
        "test/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.config.*",
      ],
      reporter: ["text", "html", "json"],
      reportsDirectory: "./coverage",
    },
    timeout: 30000,
    concurrency: 4,
  },
});
```

---

## 2. Unit Test Implementations

### Core Components Unit Tests

#### `test/unit/core/context.test.ts`

```ts
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ContextEngine } from "../../../src/core/context";
import { GitExtractor } from "../../../src/core/git";
import type { DexOptions, GitChange } from "../../../src/types";

describe("ContextEngine", () => {
  let mockGitExtractor: GitExtractor;
  let contextEngine: ContextEngine;

  beforeEach(() => {
    mockGitExtractor = {
      getCurrentChanges: mock(() => Promise.resolve([])),
      getChangesSince: mock(() => Promise.resolve([])),
      getChangesInRange: mock(() => Promise.resolve([])),
      getUntrackedFiles: mock(() => Promise.resolve([])),
      getCurrentBranch: mock(() => Promise.resolve("main")),
      getLatestCommit: mock(() => Promise.resolve("abc123")),
      getRepositoryName: mock(() => Promise.resolve("test-repo")),
    } as any;

    contextEngine = new ContextEngine(mockGitExtractor);
  });

  describe("extract", () => {
    it("should extract staged changes when staged option is true", async () => {
      const stagedChanges: GitChange[] = [
        {
          file: "test.ts",
          status: "modified",
          additions: 10,
          deletions: 2,
          diff: "mock diff content",
        },
      ];

      mockGitExtractor.getCurrentChanges = mock(() => 
        Promise.resolve(stagedChanges)
      );

      const options: DexOptions = { staged: true };
      const result = await contextEngine.extract(options);

      expect(result.changes).toEqual(stagedChanges);
      expect(result.scope.filesChanged).toBe(1);
      expect(result.scope.linesAdded).toBe(10);
      expect(result.scope.linesDeleted).toBe(2);
      expect(mockGitExtractor.getCurrentChanges).toHaveBeenCalledWith(true);
    });

    it("should apply path filters correctly", async () => {
      const allChanges: GitChange[] = [
        {
          file: "src/component.tsx",
          status: "modified",
          additions: 5,
          deletions: 1,
          diff: "diff",
        },
        {
          file: "test/component.test.ts",
          status: "added",
          additions: 20,
          deletions: 0,
          diff: "diff",
        },
        {
          file: "README.md",
          status: "modified",
          additions: 2,
          deletions: 0,
          diff: "diff",
        },
      ];

      mockGitExtractor.getCurrentChanges = mock(() => 
        Promise.resolve(allChanges)
      );

      const options: DexOptions = { 
        staged: true, 
        path: "src/**" 
      };
      const result = await contextEngine.extract(options);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].file).toBe("src/component.tsx");
    });

    it("should handle range extraction", async () => {
      const rangeChanges: GitChange[] = [
        {
          file: "feature.ts",
          status: "added",
          additions: 50,
          deletions: 0,
          diff: "new feature implementation",
        },
      ];

      mockGitExtractor.getChangesInRange = mock(() => 
        Promise.resolve(rangeChanges)
      );

      const options: DexOptions = { range: "main..feature" };
      const result = await contextEngine.extract(options);

      expect(result.changes).toEqual(rangeChanges);
      expect(mockGitExtractor.getChangesInRange).toHaveBeenCalledWith(
        "main", 
        "feature"
      );
    });

    it("should include untracked files when requested", async () => {
      mockGitExtractor.getCurrentChanges = mock(() => Promise.resolve([]));
      mockGitExtractor.getUntrackedFiles = mock(() => 
        Promise.resolve(["new-file.ts"])
      );

      const options: DexOptions = { 
        staged: true, 
        includeUntracked: true 
      };
      const result = await contextEngine.extract(options);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].file).toBe("new-file.ts");
      expect(result.changes[0].status).toBe("added");
    });

    it("should calculate token savings correctly", async () => {
      const changes: GitChange[] = [
        {
          file: "large-file.ts",
          status: "modified",
          additions: 10,
          deletions: 5,
          diff: "small diff",
        },
      ];

      mockGitExtractor.getCurrentChanges = mock(() => 
        Promise.resolve(changes)
      );

      const options: DexOptions = { staged: true };
      const result = await contextEngine.extract(options);

      expect(result.tokenSavings).toBeDefined();
      expect(result.tokenSavings!.actualTokens).toBeGreaterThanOrEqual(0);
      expect(result.tokenSavings!.saved).toBeGreaterThanOrEqual(0);
    });
  });

  describe("applyFilters", () => {
    it("should filter by file type", async () => {
      const changes: GitChange[] = [
        { file: "app.ts", status: "modified", additions: 1, deletions: 0, diff: "" },
        { file: "app.js", status: "modified", additions: 1, deletions: 0, diff: "" },
        { file: "README.md", status: "modified", additions: 1, deletions: 0, diff: "" },
      ];

      const options: DexOptions = { type: ["ts", "tsx"] };
      const filtered = (contextEngine as any).applyFilters(changes, options);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].file).toBe("app.ts");
    });
  });
});
```

#### `test/unit/core/git.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { GitExtractor } from "../../../src/core/git";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("GitExtractor", () => {
  let testDir: string;
  let gitExtractor: GitExtractor;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "dex-git-test-"));
    gitExtractor = new GitExtractor(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("isGitRepository", () => {
    it("should return false for non-git directory", async () => {
      const result = await gitExtractor.isGitRepository();
      expect(result).toBe(false);
    });

    it("should return true for git repository", async () => {
      // Initialize git repo
      await Bun.spawn(["git", "init"], { 
        cwd: testDir, 
        stdout: "ignore" 
      }).exited;
      await Bun.spawn(["git", "config", "user.email", "test@example.com"], { 
        cwd: testDir, 
        stdout: "ignore" 
      }).exited;
      await Bun.spawn(["git", "config", "user.name", "Test User"], { 
        cwd: testDir, 
        stdout: "ignore" 
      }).exited;

      const result = await gitExtractor.isGitRepository();
      expect(result).toBe(true);
    });
  });

  describe("getCurrentChanges", () => {
    beforeEach(async () => {
      // Setup git repo
      await Bun.spawn(["git", "init"], { cwd: testDir }).exited;
      await Bun.spawn(["git", "config", "user.email", "test@example.com"], { 
        cwd: testDir 
      }).exited;
      await Bun.spawn(["git", "config", "user.name", "Test User"], { 
        cwd: testDir 
      }).exited;
    });

    it("should detect staged changes", async () => {
      // Create and stage a file
      const testFile = join(testDir, "test.ts");
      writeFileSync(testFile, "export const test = 'hello';");
      await Bun.spawn(["git", "add", "test.ts"], { cwd: testDir }).exited;

      const changes = await gitExtractor.getCurrentChanges(true);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("test.ts");
      expect(changes[0].status).toBe("added");
      expect(changes[0].additions).toBeGreaterThan(0);
    });

    it("should detect unstaged changes", async () => {
      // Create file and commit
      const testFile = join(testDir, "test.ts");
      writeFileSync(testFile, "export const test = 'hello';");
      await Bun.spawn(["git", "add", "test.ts"], { cwd: testDir }).exited;
      await Bun.spawn(["git", "commit", "-m", "Initial commit"], { 
        cwd: testDir 
      }).exited;

      // Modify file (unstaged)
      writeFileSync(testFile, "export const test = 'world';");

      const changes = await gitExtractor.getCurrentChanges(false);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("test.ts");
      expect(changes[0].status).toBe("modified");
    });
  });

  describe("getChangesSince", () => {
    it("should get changes since specific commit", async () => {
      // Setup repo with commits
      await Bun.spawn(["git", "init"], { cwd: testDir }).exited;
      await Bun.spawn(["git", "config", "user.email", "test@example.com"], { 
        cwd: testDir 
      }).exited;
      await Bun.spawn(["git", "config", "user.name", "Test User"], { 
        cwd: testDir 
      }).exited;

      // First commit
      writeFileSync(join(testDir, "file1.ts"), "const a = 1;");
      await Bun.spawn(["git", "add", "."], { cwd: testDir }).exited;
      await Bun.spawn(["git", "commit", "-m", "First commit"], { 
        cwd: testDir 
      }).exited;

      // Second commit
      writeFileSync(join(testDir, "file2.ts"), "const b = 2;");
      await Bun.spawn(["git", "add", "."], { cwd: testDir }).exited;
      await Bun.spawn(["git", "commit", "-m", "Second commit"], { 
        cwd: testDir 
      }).exited;

      const changes = await gitExtractor.getChangesSince("HEAD~1");
      
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("file2.ts");
      expect(changes[0].status).toBe("added");
    });
  });

  describe("parseDiff", () => {
    it("should parse git diff output correctly", () => {
      const diffOutput = `
diff --git a/test.ts b/test.ts
new file mode 100644
index 0000000..abcdef1
--- /dev/null
+++ b/test.ts
@@ -0,0 +1,3 @@
+export function test() {
+  return 'hello world';
+}
`;

      const changes = (gitExtractor as any).parseDiff(diffOutput);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("test.ts");
      expect(changes[0].status).toBe("added");
      expect(changes[0].additions).toBe(3);
      expect(changes[0].deletions).toBe(0);
      expect(changes[0].diff).toContain("export function test()");
    });

    it("should handle renamed files", () => {
      const diffOutput = `
diff --git a/old-name.ts b/new-name.ts
similarity index 100%
rename from old-name.ts
rename to new-name.ts
`;

      const changes = (gitExtractor as any).parseDiff(diffOutput);
      
      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("new-name.ts");
      expect(changes[0].status).toBe("renamed");
      expect(changes[0].oldFile).toBe("old-name.ts");
    });
  });
});
```

#### `test/unit/core/performance-monitor.test.ts`

```ts
import { describe, it, expect, beforeEach } from "bun:test";
import { PerformanceMonitor } from "../../../src/core/performance-monitor";

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      scanningTime: 5, // 5 seconds
      prioritizationTime: 2,
      tokenEstimationTime: 1,
      totalTime: 30,
      filesPerSecond: 50,
      tokensPerSecond: 1000,
    });
  });

  describe("phase tracking", () => {
    it("should track phase durations", () => {
      monitor.startPhase("scanning");
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Wait 100ms
      }
      
      const duration = monitor.endPhase("scanning");
      
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(monitor.getPhaseDuration("scanning")).toBe(duration);
    });

    it("should track multiple phases", () => {
      monitor.startPhase("scanning");
      monitor.endPhase("scanning");
      
      monitor.startPhase("prioritization");
      monitor.endPhase("prioritization");

      const report = monitor.generateReport();
      
      expect(report.phases.scanning).toBeGreaterThan(0);
      expect(report.phases.prioritization).toBeGreaterThan(0);
    });
  });

  describe("counters", () => {
    it("should track counter values", () => {
      monitor.incrementCounter("filesScanned", 10);
      monitor.incrementCounter("filesScanned", 5);
      monitor.setCounter("totalTokens", 1000);

      expect(monitor.getCounter("filesScanned")).toBe(15);
      expect(monitor.getCounter("totalTokens")).toBe(1000);
    });
  });

  describe("bottleneck detection", () => {
    it("should identify slow phases as bottlenecks", () => {
      // Simulate slow scanning phase (over threshold)
      monitor.startPhase("scanning");
      const start = Date.now();
      while (Date.now() - start < 6000) {
        // Wait 6 seconds (over 5s threshold)
      }
      monitor.endPhase("scanning");

      const report = monitor.generateReport();
      
      expect(report.bottlenecks).toHaveLength(1);
      expect(report.bottlenecks[0].phase).toBe("scanning");
      expect(report.bottlenecks[0].suggestions).toContain(
        expect.stringContaining("parallel")
      );
    });

    it("should provide performance recommendations", () => {
      monitor.incrementCounter("filesScanned", 100);
      monitor.incrementCounter("totalTokens", 10000);
      monitor.setCounter("cacheHits", 10);
      monitor.setCounter("cacheMisses", 90);

      const report = monitor.generateReport();
      
      expect(report.recommendations).toContain(
        expect.stringContaining("cache")
      );
    });
  });

  describe("report generation", () => {
    it("should generate comprehensive performance report", () => {
      monitor.startPhase("scanning");
      monitor.endPhase("scanning");
      
      monitor.incrementCounter("filesScanned", 50);
      monitor.incrementCounter("totalTokens", 5000);

      const report = monitor.generateReport();
      
      expect(report.totalDuration).toBeGreaterThan(0);
      expect(report.metrics.filesScanned).toBe(50);
      expect(report.metrics.totalTokens).toBe(5000);
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("should format report as string", () => {
      monitor.incrementCounter("filesScanned", 100);
      monitor.incrementCounter("totalTokens", 10000);
      
      const formatted = monitor.formatReport(monitor.generateReport());
      
      expect(formatted).toContain("Performance Report");
      expect(formatted).toContain("Duration:");
      expect(formatted).toContain("Files/sec:");
      expect(formatted).toContain("Tokens/sec:");
    });
  });
});
```

---

## 3. Integration Test Patterns

### Command Integration Tests

#### `test/integration/commands/distill.integration.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("Distill Command Integration", () => {
  let testRepoDir: string;
  let dexBinPath: string;

  beforeEach(async () => {
    testRepoDir = mkdtempSync(join(tmpdir(), "dex-distill-integration-"));
    dexBinPath = join(process.cwd(), "dist", "cli.js");
    
    // Setup test repository structure
    await setupTestRepository(testRepoDir);
  });

  afterEach(() => {
    rmSync(testRepoDir, { recursive: true, force: true });
  });

  describe("basic distillation", () => {
    it("should distill TypeScript project to stdout", () => {
      const result = execSync(
        `bun ${dexBinPath} distill . --stdout --format=distilled`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
          timeout: 30000,
        }
      );

      expect(result).toContain("Project Structure");
      expect(result).toContain("APIs and Exports");
      expect(result).toContain("export function calculateTotal");
      expect(result).toContain("export class UserService");
    });

    it("should compress files when --compress-first is used", () => {
      const result = execSync(
        `bun ${dexBinPath} distill . --stdout --format=compressed`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
        }
      );

      expect(result).toContain("// File: src/utils/math.ts");
      expect(result).toContain("// File: src/services/user.ts");
      expect(result).toContain("export function calculateTotal");
    });

    it("should respect exclude patterns", () => {
      // Create config with exclude patterns
      writeFileSync(
        join(testRepoDir, ".dex.yml"),
        `
distiller:
  excludePatterns:
    - "**/*.test.ts"
    - "**/node_modules/**"
`
      );

      const result = execSync(
        `bun ${dexBinPath} distill . --stdout`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
        }
      );

      expect(result).not.toContain("math.test.ts");
      expect(result).toContain("math.ts");
    });
  });

  describe("output formats", () => {
    it("should generate JSON output", () => {
      const result = execSync(
        `bun ${dexBinPath} distill . --stdout --format=json`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
        }
      );

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("apis");
      expect(parsed).toHaveProperty("structure");
      expect(parsed).toHaveProperty("dependencies");
      expect(parsed).toHaveProperty("metadata");
    });

    it("should save to file when --output is specified", () => {
      const outputFile = join(testRepoDir, "distilled.json");
      
      execSync(
        `bun ${dexBinPath} distill . --output="${outputFile}" --format=json`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
        }
      );

      const result = Bun.file(outputFile).text();
      const parsed = JSON.parse(await result);
      expect(parsed).toHaveProperty("apis");
    });
  });

  describe("filtering and targeting", () => {
    it("should filter by file path patterns", () => {
      const result = execSync(
        `bun ${dexBinPath} distill . --path="src/utils/**" --stdout`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
        }
      );

      expect(result).toContain("math.ts");
      expect(result).not.toContain("user.ts");
    });

    it("should filter by file types", () => {
      const result = execSync(
        `bun ${dexBinPath} distill . --type=ts --stdout`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
        }
      );

      expect(result).toContain(".ts");
      expect(result).not.toContain(".js");
    });
  });

  describe("error handling", () => {
    it("should handle non-existent directory gracefully", () => {
      expect(() => {
        execSync(
          `bun ${dexBinPath} distill /non-existent-path --stdout`,
          { 
            encoding: "utf-8",
            timeout: 5000,
          }
        );
      }).toThrow();
    });

    it("should handle empty directory", () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "empty-"));
      
      const result = execSync(
        `bun ${dexBinPath} distill ${emptyDir} --stdout`,
        { 
          encoding: "utf-8",
        }
      );

      expect(result).toContain("No files found");
      
      rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe("performance with large projects", () => {
    it("should complete within reasonable time for medium projects", () => {
      // Create larger test structure
      createLargeTestProject(testRepoDir);

      const startTime = Date.now();
      const result = execSync(
        `bun ${dexBinPath} distill . --stdout --format=distilled`,
        { 
          cwd: testRepoDir,
          encoding: "utf-8",
          timeout: 60000, // 1 minute max
        }
      );
      const duration = Date.now() - startTime;

      expect(result).toContain("Project Structure");
      expect(duration).toBeLessThan(30000); // Should complete in under 30s
    });
  });
});

async function setupTestRepository(dir: string) {
  // Create source structure
  mkdirSync(join(dir, "src", "utils"), { recursive: true });
  mkdirSync(join(dir, "src", "services"), { recursive: true });
  mkdirSync(join(dir, "test"), { recursive: true });

  // Create TypeScript files
  writeFileSync(
    join(dir, "src", "utils", "math.ts"),
    `
/**
 * Calculate total with tax
 */
export function calculateTotal(price: number, tax: number): number {
  return price * (1 + tax);
}

export const TAX_RATES = {
  standard: 0.1,
  reduced: 0.05,
} as const;

export type TaxRate = typeof TAX_RATES[keyof typeof TAX_RATES];
`
  );

  writeFileSync(
    join(dir, "src", "services", "user.ts"),
    `
export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...userData,
    };
    this.users.push(user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) ?? null;
  }
}
`
  );

  writeFileSync(
    join(dir, "test", "math.test.ts"),
    `
import { expect, test } from "bun:test";
import { calculateTotal } from "../src/utils/math";

test("calculateTotal should add tax correctly", () => {
  expect(calculateTotal(100, 0.1)).toBe(110);
});
`
  );

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      type: "module",
      scripts: {
        test: "bun test",
        build: "tsc",
      },
      devDependencies: {
        typescript: "^5.0.0",
      },
    }, null, 2)
  );

  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        lib: ["ES2022"],
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist", "test"],
    }, null, 2)
  );
}

function createLargeTestProject(dir: string) {
  // Create many files to test performance
  for (let i = 0; i < 50; i++) {
    const moduleDir = join(dir, "src", `module${i}`);
    mkdirSync(moduleDir, { recursive: true });
    
    writeFileSync(
      join(moduleDir, "index.ts"),
      `
export interface Config${i} {
  value: string;
  enabled: boolean;
}

export class Service${i} {
  constructor(private config: Config${i}) {}
  
  async process(): Promise<string> {
    return this.config.enabled ? this.config.value : "";
  }
}

export const DEFAULT_CONFIG_${i}: Config${i} = {
  value: "default${i}",
  enabled: true,
};
`
    );
  }
}
```

#### `test/integration/workflows/extract-distill.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("Extract to Distill Workflow", () => {
  let testRepoDir: string;
  let dexBinPath: string;

  beforeEach(async () => {
    testRepoDir = mkdtempSync(join(tmpdir(), "dex-workflow-"));
    dexBinPath = join(process.cwd(), "dist", "cli.js");
    
    await setupGitRepository(testRepoDir);
  });

  afterEach(() => {
    rmSync(testRepoDir, { recursive: true, force: true });
  });

  it("should extract changes and then distill the project", async () => {
    // Make changes to the repository
    writeFileSync(
      join(testRepoDir, "src", "feature.ts"),
      `
export interface FeatureConfig {
  enabled: boolean;
  options: Record<string, any>;
}

export class FeatureManager {
  async enableFeature(config: FeatureConfig): Promise<void> {
    // Implementation here
  }
}
`
    );

    // Stage the new file
    execSync("git add .", { cwd: testRepoDir });

    // Extract the staged changes
    const extractResult = execSync(
      `bun ${dexBinPath} extract --staged --stdout --format=json`,
      { 
        cwd: testRepoDir,
        encoding: "utf-8",
      }
    );

    const extractedData = JSON.parse(extractResult);
    expect(extractedData.changes).toHaveLength(1);
    expect(extractedData.changes[0].file).toBe("src/feature.ts");
    expect(extractedData.changes[0].status).toBe("added");

    // Distill the entire project
    const distillResult = execSync(
      `bun ${dexBinPath} distill . --stdout --format=json`,
      { 
        cwd: testRepoDir,
        encoding: "utf-8",
      }
    );

    const distilledData = JSON.parse(distillResult);
    expect(distilledData.apis.some((api: any) => 
      api.file === "src/feature.ts"
    )).toBe(true);
    
    // Should contain the new feature's exports
    const featureApi = distilledData.apis.find((api: any) => 
      api.file === "src/feature.ts"
    );
    expect(featureApi.exports.some((exp: any) => 
      exp.name === "FeatureManager"
    )).toBe(true);
  });

  it("should combine multiple workflow steps with different formats", async () => {
    // Create multiple changed files
    writeFileSync(
      join(testRepoDir, "src", "utils", "validation.ts"),
      `export const validateEmail = (email: string): boolean => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);`
    );

    writeFileSync(
      join(testRepoDir, "src", "constants.ts"),
      `export const API_BASE_URL = "https://api.example.com";`
    );

    execSync("git add .", { cwd: testRepoDir });

    // Extract as markdown
    const extractMarkdown = execSync(
      `bun ${dexBinPath} extract --staged --stdout --format=markdown`,
      { 
        cwd: testRepoDir,
        encoding: "utf-8",
      }
    );

    expect(extractMarkdown).toContain("# Code Context");
    expect(extractMarkdown).toContain("validation.ts");
    expect(extractMarkdown).toContain("constants.ts");

    // Extract as XML
    const extractXml = execSync(
      `bun ${dexBinPath} extract --staged --stdout --format=xml`,
      { 
        cwd: testRepoDir,
        encoding: "utf-8",
      }
    );

    expect(extractXml).toContain("<code_context>");
    expect(extractXml).toContain("<path>src/utils/validation.ts</path>");
    expect(extractXml).toContain("<path>src/constants.ts</path>");

    // Distill the project structure
    const distillTree = execSync(
      `bun ${dexBinPath} tree . --stdout --format=tree`,
      { 
        cwd: testRepoDir,
        encoding: "utf-8",
      }
    );

    expect(distillTree).toContain("src/");
    expect(distillTree).toContain("validateEmail");
    expect(distillTree).toContain("API_BASE_URL");
  });
});

async function setupGitRepository(dir: string) {
  // Initialize git
  execSync("git init", { cwd: dir });
  execSync("git config user.email 'test@example.com'", { cwd: dir });
  execSync("git config user.name 'Test User'", { cwd: dir });

  // Create initial structure
  const srcDir = join(dir, "src");
  const utilsDir = join(dir, "src", "utils");
  require("fs").mkdirSync(srcDir, { recursive: true });
  require("fs").mkdirSync(utilsDir, { recursive: true });

  // Create initial files
  writeFileSync(
    join(dir, "src", "index.ts"),
    `
export * from './utils/math';

console.log('Application started');
`
  );

  writeFileSync(
    join(dir, "src", "utils", "math.ts"),
    `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`
  );

  // Initial commit
  execSync("git add .", { cwd: dir });
  execSync("git commit -m 'Initial commit'", { cwd: dir });
}
```

---

## 4. E2E Test Scenarios with Fixtures

### End-to-End Test Suite

#### `test/e2e/full-workflows.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { 
  createTestRepository, 
  createMonorepoStructure,
  simulateTeamWorkflow 
} from "../helpers/fixture-factory";

describe("Full Workflow E2E Tests", () => {
  let testWorkspace: string;
  let dexBinPath: string;

  beforeAll(() => {
    testWorkspace = mkdtempSync(join(tmpdir(), "dex-e2e-"));
    dexBinPath = join(process.cwd(), "dist", "cli.js");
  });

  afterAll(() => {
    rmSync(testWorkspace, { recursive: true, force: true });
  });

  describe("Feature Development Workflow", () => {
    it("should handle complete feature branch workflow", async () => {
      const repoDir = join(testWorkspace, "feature-repo");
      await createTestRepository(repoDir, "typescript-api");

      // Step 1: Create feature branch
      execSync("git checkout -b feature/user-auth", { cwd: repoDir });

      // Step 2: Implement feature with multiple commits
      await simulateFeatureDevelopment(repoDir);

      // Step 3: Extract feature branch changes
      const featureExtract = execSync(
        `bun ${dexBinPath} extract --range=main..feature/user-auth --stdout --format=json`,
        { cwd: repoDir, encoding: "utf-8" }
      );

      const featureData = JSON.parse(featureExtract);
      expect(featureData.changes.length).toBeGreaterThan(0);
      expect(featureData.metadata.extraction.method).toContain("range");

      // Step 4: Distill project structure
      const distillResult = execSync(
        `bun ${dexBinPath} distill . --stdout --format=json`,
        { cwd: repoDir, encoding: "utf-8" }
      );

      const distilledData = JSON.parse(distillResult);
      expect(distilledData.apis.some((api: any) => 
        api.file.includes("auth")
      )).toBe(true);

      // Step 5: Generate tree view for code review
      const treeView = execSync(
        `bun ${dexBinPath} tree . --stdout --format=tree --show-types --show-params`,
        { cwd: repoDir, encoding: "utf-8" }
      );

      expect(treeView).toContain("AuthService");
      expect(treeView).toContain("authenticate");
      expect(treeView).toContain("(username: string, password: string)");
    });

    it("should handle PR review workflow", async () => {
      const repoDir = join(testWorkspace, "pr-review-repo");
      await createTestRepository(repoDir, "react-app");

      // Simulate PR changes
      await simulateTeamWorkflow(repoDir, "pr-review");

      // Extract PR changes for review
      const prExtract = execSync(
        `bun ${dexBinPath} extract --since=HEAD~3 --stdout --format=markdown`,
        { cwd: repoDir, encoding: "utf-8" }
      );

      expect(prExtract).toContain("# Code Context");
      expect(prExtract).toContain("## Files Changed");
      expect(prExtract).toContain("## Summary");
      expect(prExtract).toMatch(/\d+ files? changed/);

      // Generate focused tree for specific components
      const componentTree = execSync(
        `bun ${dexBinPath} tree . --path="src/components/**" --stdout --group-by=type`,
        { cwd: repoDir, encoding: "utf-8" }
      );

      expect(componentTree).toContain("Components");
      expect(componentTree).toContain("Functions");
      expect(componentTree).toContain("Interfaces");
    });
  });

  describe("Monorepo Workflow", () => {
    it("should handle workspace-specific extraction", async () => {
      const monorepoDir = join(testWorkspace, "monorepo");
      await createMonorepoStructure(monorepoDir);

      // Extract changes from specific workspace
      const workspaceExtract = execSync(
        `bun ${dexBinPath} extract --path="packages/api/**" --staged --stdout`,
        { cwd: monorepoDir, encoding: "utf-8" }
      );

      expect(workspaceExtract).toContain("packages/api");
      expect(workspaceExtract).not.toContain("packages/web");

      // Distill specific workspace
      const apiDistill = execSync(
        `bun ${dexBinPath} distill packages/api --stdout --format=distilled`,
        { cwd: monorepoDir, encoding: "utf-8" }
      );

      expect(apiDistill).toContain("API Structure");
      expect(apiDistill).toContain("endpoints");
      expect(apiDistill).not.toContain("React");

      // Generate cross-workspace dependencies
      const fullTree = execSync(
        `bun ${dexBinPath} tree . --stdout --format=json`,
        { cwd: monorepoDir, encoding: "utf-8" }
      );

      const treeData = JSON.parse(fullTree);
      expect(treeData.structure.directories).toContain("packages/api");
      expect(treeData.structure.directories).toContain("packages/web");
      expect(treeData.dependencies.imports.some((imp: string) => 
        imp.includes("@monorepo/api")
      )).toBe(true);
    });
  });

  describe("Configuration Scenarios", () => {
    it("should respect hierarchical configuration", async () => {
      const configRepoDir = join(testWorkspace, "config-repo");
      await createTestRepository(configRepoDir, "configured-project");

      // Create global config
      const globalConfig = join(configRepoDir, ".dex.yml");
      require("fs").writeFileSync(globalConfig, `
defaults:
  format: json
  noMetadata: true
filters:
  ignorePaths:
    - "**/node_modules/**"
    - "**/*.test.ts"
distiller:
  excludePatterns:
    - "**/*.d.ts"
    - "**/dist/**"
`);

      // Test extraction with global config
      const result = execSync(
        `bun ${dexBinPath} extract --staged --stdout`,
        { cwd: configRepoDir, encoding: "utf-8" }
      );

      const data = JSON.parse(result);
      expect(data.metadata).toBeUndefined(); // noMetadata: true
      expect(data.changes.every((change: any) => 
        !change.file.includes(".test.ts")
      )).toBe(true);

      // Test distillation with config
      const distillResult = execSync(
        `bun ${dexBinPath} distill . --stdout`,
        { cwd: configRepoDir, encoding: "utf-8" }
      );

      const distillData = JSON.parse(distillResult);
      expect(distillData.apis.every((api: any) => 
        !api.file.includes(".d.ts")
      )).toBe(true);
    });
  });

  describe("Error Recovery", () => {
    it("should handle corrupted git repository gracefully", async () => {
      const corruptedRepoDir = join(testWorkspace, "corrupted-repo");
      await createTestRepository(corruptedRepoDir, "basic");

      // Corrupt git directory
      rmSync(join(corruptedRepoDir, ".git", "refs"), { recursive: true });

      // Should fall back to file system scanning
      const result = execSync(
        `bun ${dexBinPath} distill . --stdout`,
        { cwd: corruptedRepoDir, encoding: "utf-8" }
      );

      expect(result).toContain("Project Structure");
      // Should still work but without git metadata
    });

    it("should handle missing dependencies gracefully", async () => {
      const missingDepsDir = join(testWorkspace, "missing-deps");
      await createTestRepository(missingDepsDir, "typescript-with-missing-deps");

      const result = execSync(
        `bun ${dexBinPath} distill . --stdout --format=distilled`,
        { cwd: missingDepsDir, encoding: "utf-8" }
      );

      expect(result).toContain("Project Structure");
      expect(result).toContain("Dependencies");
      // Should handle missing node_modules gracefully
    });
  });
});

async function simulateFeatureDevelopment(repoDir: string) {
  const { writeFileSync, mkdirSync } = require("fs");
  
  // Create auth module
  mkdirSync(join(repoDir, "src", "auth"), { recursive: true });
  
  writeFileSync(
    join(repoDir, "src", "auth", "types.ts"),
    `
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: number;
  refreshTokenExpiry: number;
}
`
  );

  writeFileSync(
    join(repoDir, "src", "auth", "service.ts"),
    `
import type { User, AuthConfig } from './types';

export class AuthService {
  constructor(private config: AuthConfig) {}

  async authenticate(username: string, password: string): Promise<User | null> {
    // Implementation would go here
    return null;
  }

  async generateToken(user: User): Promise<string> {
    // JWT generation logic
    return 'mock-token';
  }

  async validateToken(token: string): Promise<User | null> {
    // Token validation logic
    return null;
  }
}
`
  );

  writeFileSync(
    join(repoDir, "src", "auth", "index.ts"),
    `
export * from './types';
export * from './service';
`
  );

  // Stage and commit auth module
  execSync("git add src/auth/", { cwd: repoDir });
  execSync("git commit -m 'Add authentication types and service'", { cwd: repoDir });

  // Add auth middleware
  writeFileSync(
    join(repoDir, "src", "middleware", "auth.ts"),
    `
import { AuthService } from '../auth/service';

export class AuthMiddleware {
  constructor(private authService: AuthService) {}

  async authenticate(request: any): Promise<boolean> {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;

    const user = await this.authService.validateToken(token);
    return user !== null;
  }
}
`
  );

  execSync("git add src/middleware/", { cwd: repoDir });
  execSync("git commit -m 'Add authentication middleware'", { cwd: repoDir });

  // Update main application to use auth
  writeFileSync(
    join(repoDir, "src", "app.ts"),
    `
import { AuthService } from './auth';
import { AuthMiddleware } from './middleware/auth';

const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  tokenExpiry: 3600,
  refreshTokenExpiry: 86400,
};

const authService = new AuthService(authConfig);
const authMiddleware = new AuthMiddleware(authService);

export { authService, authMiddleware };
`
  );

  execSync("git add src/app.ts", { cwd: repoDir });
  execSync("git commit -m 'Integrate authentication into app'", { cwd: repoDir });
}
```

### Test Fixtures Factory

#### `test/helpers/fixture-factory.ts`

```ts
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

export interface RepositoryTemplate {
  name: string;
  structure: FileStructure;
  gitHistory?: GitCommit[];
}

export interface FileStructure {
  [path: string]: string | FileStructure;
}

export interface GitCommit {
  message: string;
  files: string[];
}

export const REPOSITORY_TEMPLATES: Record<string, RepositoryTemplate> = {
  "typescript-api": {
    name: "TypeScript API Project",
    structure: {
      "package.json": JSON.stringify({
        name: "typescript-api",
        version: "1.0.0",
        type: "module",
        scripts: {
          build: "tsc",
          test: "bun test",
          dev: "bun --watch src/index.ts",
        },
        dependencies: {
          express: "^4.18.0",
        },
        devDependencies: {
          "@types/express": "^4.17.0",
          typescript: "^5.0.0",
        },
      }, null, 2),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          strict: true,
          esModuleInterop: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src/**/*"],
      }, null, 2),
      src: {
        "index.ts": `
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`,
        routes: {
          "users.ts": `
import { Router } from 'express';

const router = Router();

interface User {
  id: string;
  name: string;
  email: string;
}

const users: User[] = [];

router.get('/', (req, res) => {
  res.json(users);
});

router.post('/', (req, res) => {
  const user: User = {
    id: crypto.randomUUID(),
    ...req.body,
  };
  users.push(user);
  res.status(201).json(user);
});

export default router;
`,
        },
        utils: {
          "validation.ts": `
export const validateEmail = (email: string): boolean => {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
};

export const validateRequired = (value: any): boolean => {
  return value !== null && value !== undefined && value !== '';
};
`,
        },
      },
    },
    gitHistory: [
      {
        message: "Initial project setup",
        files: ["package.json", "tsconfig.json", "src/index.ts"],
      },
      {
        message: "Add user routes",
        files: ["src/routes/users.ts"],
      },
      {
        message: "Add validation utilities",
        files: ["src/utils/validation.ts"],
      },
    ],
  },

  "react-app": {
    name: "React Application",
    structure: {
      "package.json": JSON.stringify({
        name: "react-app",
        version: "0.1.0",
        dependencies: {
          react: "^18.0.0",
          "react-dom": "^18.0.0",
        },
        devDependencies: {
          "@types/react": "^18.0.0",
          "@types/react-dom": "^18.0.0",
          typescript: "^5.0.0",
          vite: "^4.0.0",
        },
      }, null, 2),
      src: {
        "App.tsx": `
import React from 'react';
import { UserList } from './components/UserList';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>User Management</h1>
        <UserList />
      </header>
    </div>
  );
}

export default App;
`,
        components: {
          "UserList.tsx": `
import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="user-list">
      {users.map(user => (
        <div key={user.id} className="user-card">
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  );
};
`,
          "UserForm.tsx": `
import React, { useState } from 'react';

interface UserFormProps {
  onSubmit: (user: { name: string; email: string }) => void;
}

export const UserForm: React.FC<UserFormProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email });
    setName('');
    setEmail('');
  };

  return (
    <form onSubmit={handleSubmit} className="user-form">
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit">Add User</button>
    </form>
  );
};
`,
        },
        hooks: {
          "useUsers.ts": `
import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Failed to add user');
      const newUser = await response.json();
      setUsers(prev => [...prev, newUser]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    }
  };

  return { users, loading, error, fetchUsers, addUser };
};
`,
        },
      },
    },
  },
};

export async function createTestRepository(
  dir: string, 
  template: keyof typeof REPOSITORY_TEMPLATES
): Promise<void> {
  const repo = REPOSITORY_TEMPLATES[template];
  
  // Create directory structure and files
  createFileStructure(dir, repo.structure);
  
  // Initialize git
  execSync("git init", { cwd: dir });
  execSync("git config user.email 'test@example.com'", { cwd: dir });
  execSync("git config user.name 'Test User'", { cwd: dir });
  
  // Create git history if specified
  if (repo.gitHistory) {
    for (const commit of repo.gitHistory) {
      execSync(`git add ${commit.files.join(' ')}`, { cwd: dir });
      execSync(`git commit -m "${commit.message}"`, { cwd: dir });
    }
  } else {
    // Single initial commit
    execSync("git add .", { cwd: dir });
    execSync("git commit -m 'Initial commit'", { cwd: dir });
  }
}

export async function createMonorepoStructure(dir: string): Promise<void> {
  const structure = {
    "package.json": JSON.stringify({
      name: "monorepo",
      private: true,
      workspaces: ["packages/*"],
      scripts: {
        build: "bun run build --recursive",
        test: "bun test --recursive",
      },
    }, null, 2),
    packages: {
      api: {
        "package.json": JSON.stringify({
          name: "@monorepo/api",
          version: "1.0.0",
          main: "dist/index.js",
          dependencies: {
            express: "^4.18.0",
          },
        }, null, 2),
        src: {
          "index.ts": `
import express from 'express';

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
`,
          endpoints: {
            "users.ts": `
export const getUsersEndpoint = (req: any, res: any) => {
  res.json([]);
};
`,
          },
        },
      },
      web: {
        "package.json": JSON.stringify({
          name: "@monorepo/web",
          version: "1.0.0",
          dependencies: {
            react: "^18.0.0",
            "@monorepo/api": "workspace:*",
          },
        }, null, 2),
        src: {
          "App.tsx": `
import React from 'react';

const App = () => {
  return <div>Web App</div>;
};

export default App;
`,
        },
      },
    },
  };

  createFileStructure(dir, structure);
  
  // Initialize git
  execSync("git init", { cwd: dir });
  execSync("git config user.email 'test@example.com'", { cwd: dir });
  execSync("git config user.name 'Test User'", { cwd: dir });
  execSync("git add .", { cwd: dir });
  execSync("git commit -m 'Initial monorepo setup'", { cwd: dir });
}

export async function simulateTeamWorkflow(
  repoDir: string, 
  scenario: "pr-review" | "feature-branch" | "hotfix"
): Promise<void> {
  switch (scenario) {
    case "pr-review":
      // Simulate PR with multiple commits
      writeFileSync(
        join(repoDir, "src", "components", "UserProfile.tsx"),
        `
import React from 'react';

interface UserProfileProps {
  userId: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  return (
    <div className="user-profile">
      <h2>User Profile: {userId}</h2>
    </div>
  );
};
`
      );
      
      execSync("git add .", { cwd: repoDir });
      execSync("git commit -m 'Add UserProfile component'", { cwd: repoDir });

      // Update existing component
      writeFileSync(
        join(repoDir, "src", "components", "UserList.tsx"),
        `
import React, { useState, useEffect } from 'react';
import { UserProfile } from './UserProfile';

interface User {
  id: string;
  name: string;
  email: string;
}

export const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // ... existing implementation

  return (
    <div className="user-list">
      {selectedUserId ? (
        <UserProfile userId={selectedUserId} />
      ) : (
        users.map(user => (
          <div key={user.id} onClick={() => setSelectedUserId(user.id)}>
            {user.name}
          </div>
        ))
      )}
    </div>
  );
};
`
      );
      
      execSync("git add .", { cwd: repoDir });
      execSync("git commit -m 'Integrate UserProfile into UserList'", { cwd: repoDir });
      break;
  }
}

function createFileStructure(basePath: string, structure: FileStructure): void {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = join(basePath, name);
    
    if (typeof content === "string") {
      // It's a file
      mkdirSync(require("path").dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content.trim());
    } else {
      // It's a directory
      mkdirSync(fullPath, { recursive: true });
      createFileStructure(fullPath, content);
    }
  }
}
```

---

## 5. CI/CD Pipeline Configuration

### GitHub Actions Workflow

#### `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        bun-version: [1.0.0, latest]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: ${{ matrix.bun-version }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Type check
      run: bun run typecheck

    - name: Lint
      run: bun run lint

    - name: Run unit tests
      run: bun test test/unit/ --coverage --reporter=junit --output-file=test-results.xml

    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: unit-test-results-${{ matrix.bun-version }}
        path: test-results.xml

    - name: Upload coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-unit-${{ matrix.bun-version }}
        path: coverage/

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Setup Bun
      uses: oven-sh/setup-bun@v1

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build project
      run: bun run build

    - name: Setup test git config
      run: |
        git config --global user.name "Test User"
        git config --global user.email "test@example.com"
        git config --global init.defaultBranch main

    - name: Run integration tests
      run: bun test test/integration/ --timeout=60000 --coverage
      env:
        NODE_ENV: test

    - name: Upload coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-integration
        path: coverage/

  e2e-tests:
    runs-on: ${{ matrix.os }}
    needs: [unit-tests, integration-tests]
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Setup Node.js (for cross-platform testing)
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}

    - name: Setup Bun
      uses: oven-sh/setup-bun@v1

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build project
      run: bun run build

    - name: Setup test git config
      run: |
        git config --global user.name "Test User"
        git config --global user.email "test@example.com"
        git config --global init.defaultBranch main

    - name: Run E2E tests
      run: bun test test/e2e/ --timeout=120000
      env:
        NODE_ENV: test
        CI: true

    - name: Upload E2E artifacts
      uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: e2e-artifacts-${{ matrix.os }}-node${{ matrix.node-version }}
        path: |
          test-results/
          coverage/

  performance-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Setup Bun
      uses: oven-sh/setup-bun@v1

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build project
      run: bun run build

    - name: Run performance benchmarks
      run: bun test test/performance/ --timeout=300000
      env:
        NODE_ENV: production

    - name: Upload benchmark results
      uses: actions/upload-artifact@v4
      with:
        name: performance-results
        path: benchmark-results.json

  coverage-report:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: always()
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v1

    - name: Download all coverage artifacts
      uses: actions/download-artifact@v4
      with:
        pattern: coverage-*
        merge-multiple: true
        path: coverage/

    - name: Merge coverage reports
      run: |
        bun install --frozen-lockfile
        bun run coverage:merge

    - name: Upload merged coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/merged-coverage.json
        flags: unittests,integration
        name: dex-coverage
        fail_ci_if_error: true

    - name: Comment coverage on PR
      if: github.event_name == 'pull_request'
      uses: marocchino/sticky-pull-request-comment@v2
      with:
        recreate: true
        path: coverage/coverage-summary.md

  test-summary:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests, performance-tests]
    if: always()
    
    steps:
    - name: Test Summary
      uses: test-summary/action@v2
      with:
        paths: "test-results.xml"
        show: "all"

    - name: Notify on failure
      if: failure()
      uses: 8398a7/action-slack@v3
      with:
        status: failure
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        text: "❌ Tests failed in ${{ github.repository }} on ${{ github.ref }}"
```

### Coverage Configuration

#### `scripts/coverage-merge.ts`

```ts
#!/usr/bin/env bun

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

interface CoverageReport {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    statements: { total: number; covered: number; skipped: number; pct: number };
    functions: { total: number; covered: number; skipped: number; pct: number };
    branches: { total: number; covered: number; skipped: number; pct: number };
  };
  files: Record<string, any>;
}

async function mergeCoverageReports() {
  const coverageDir = "coverage";
  const mergedReport: CoverageReport = {
    total: {
      lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
      statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
      functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
    },
    files: {},
  };

  // Find all coverage.json files
  const coverageFiles = readdirSync(coverageDir, { recursive: true })
    .filter((file) => file.toString().endsWith("coverage.json"))
    .map((file) => join(coverageDir, file.toString()));

  for (const file of coverageFiles) {
    try {
      const report: CoverageReport = JSON.parse(readFileSync(file, "utf-8"));
      
      // Merge totals
      for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
        mergedReport.total[metric].total += report.total[metric].total;
        mergedReport.total[metric].covered += report.total[metric].covered;
        mergedReport.total[metric].skipped += report.total[metric].skipped;
      }

      // Merge file-level data
      Object.assign(mergedReport.files, report.files);
    } catch (error) {
      console.warn(`Failed to merge coverage from ${file}:`, error);
    }
  }

  // Calculate percentages
  for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
    const { total, covered } = mergedReport.total[metric];
    mergedReport.total[metric].pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  }

  // Write merged report
  writeFileSync(
    join(coverageDir, "merged-coverage.json"),
    JSON.stringify(mergedReport, null, 2)
  );

  // Generate summary markdown
  const summary = `
## Coverage Summary

| Metric | Coverage | Total | Covered |
|--------|----------|-------|---------|
| **Lines** | **${mergedReport.total.lines.pct}%** | ${mergedReport.total.lines.total} | ${mergedReport.total.lines.covered} |
| **Statements** | **${mergedReport.total.statements.pct}%** | ${mergedReport.total.statements.total} | ${mergedReport.total.statements.covered} |
| **Functions** | **${mergedReport.total.functions.pct}%** | ${mergedReport.total.functions.total} | ${mergedReport.total.functions.covered} |
| **Branches** | **${mergedReport.total.branches.pct}%** | ${mergedReport.total.branches.total} | ${mergedReport.total.branches.covered} |

### Coverage Status: ${mergedReport.total.lines.pct >= 80 ? '✅ PASS' : '❌ FAIL'}

${mergedReport.total.lines.pct < 80 ? `⚠️ Coverage is below the 80% threshold (${mergedReport.total.lines.pct}%)` : ''}
`;

  writeFileSync(join(coverageDir, "coverage-summary.md"), summary.trim());
  
  console.log("Coverage reports merged successfully!");
  console.log(`Total line coverage: ${mergedReport.total.lines.pct}%`);
  
  // Exit with non-zero if coverage is below threshold
  if (mergedReport.total.lines.pct < 80) {
    console.error("❌ Coverage below threshold!");
    process.exit(1);
  }
}

await mergeCoverageReports();
```

---

## 6. Coverage Reporting and Enforcement

### Enhanced Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test test/unit/ --coverage",
    "test:integration": "bun test test/integration/ --coverage --timeout=60000",
    "test:e2e": "bun test test/e2e/ --timeout=120000",
    "test:performance": "bun test test/performance/ --timeout=300000",
    "test:watch": "bun test --watch",
    "test:ci": "bun run test:unit && bun run test:integration && bun run test:e2e",
    "coverage": "bun test --coverage",
    "coverage:merge": "bun scripts/coverage-merge.ts",
    "coverage:report": "bun test --coverage --reporter=html",
    "coverage:check": "bun test --coverage && bun scripts/coverage-check.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "lint:fix": "eslint src test --fix"
  }
}
```

### Coverage Enforcement Script

#### `scripts/coverage-check.ts`

```ts
#!/usr/bin/env bun

import { readFileSync } from "fs";
import { join } from "path";

interface CoverageThresholds {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

const THRESHOLDS: CoverageThresholds = {
  lines: 80,
  statements: 80, 
  functions: 80,
  branches: 75,
};

async function checkCoverage() {
  try {
    const coveragePath = join("coverage", "merged-coverage.json");
    const coverage = JSON.parse(readFileSync(coveragePath, "utf-8"));
    
    const results: Array<{ metric: keyof CoverageThresholds; actual: number; threshold: number; passed: boolean }> = [];
    
    for (const [metric, threshold] of Object.entries(THRESHOLDS)) {
      const actual = coverage.total[metric as keyof CoverageThresholds].pct;
      const passed = actual >= threshold;
      
      results.push({
        metric: metric as keyof CoverageThresholds,
        actual,
        threshold,
        passed,
      });
    }
    
    console.log("\n📊 Coverage Report");
    console.log("=".repeat(50));
    
    for (const result of results) {
      const status = result.passed ? "✅" : "❌";
      const metric = result.metric.charAt(0).toUpperCase() + result.metric.slice(1);
      console.log(
        `${status} ${metric.padEnd(12)} ${result.actual.toString().padStart(5)}% (threshold: ${result.threshold}%)`
      );
    }
    
    const failedChecks = results.filter(r => !r.passed);
    
    if (failedChecks.length > 0) {
      console.log("\n❌ Coverage check failed!");
      console.log("\nFailing metrics:");
      for (const failed of failedChecks) {
        console.log(`  • ${failed.metric}: ${failed.actual}% < ${failed.threshold}%`);
      }
      
      console.log("\n💡 To improve coverage:");
      console.log("  1. Add tests for uncovered code paths");
      console.log("  2. Remove unused code");
      console.log("  3. Add edge case tests");
      console.log("  4. Test error handling paths");
      
      process.exit(1);
    }
    
    console.log("\n✅ All coverage thresholds met!");
    
  } catch (error) {
    console.error("❌ Failed to check coverage:", error);
    process.exit(1);
  }
}

await checkCoverage();
```

### Pre-commit Hook Configuration

#### `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run type check
echo "🔍 Running type check..."
bun run typecheck

# Run linter
echo "🧹 Running linter..."
bun run lint

# Run unit tests only (fast feedback)
echo "🧪 Running unit tests..."
bun test test/unit/ --coverage --bail

# Check coverage thresholds
echo "📊 Checking coverage..."
bun run coverage:check

echo "✅ Pre-commit checks passed!"
```

### Test Helper Utilities

#### `test/helpers/assertions.ts`

```ts
import { expect } from "bun:test";

export function expectValidGitChange(change: any) {
  expect(change).toMatchObject({
    file: expect.any(String),
    status: expect.stringMatching(/^(added|modified|deleted|renamed)$/),
    additions: expect.any(Number),
    deletions: expect.any(Number),
    diff: expect.any(String),
  });
  
  expect(change.additions).toBeGreaterThanOrEqual(0);
  expect(change.deletions).toBeGreaterThanOrEqual(0);
}

export function expectValidMetadata(metadata: any) {
  expect(metadata).toMatchObject({
    generated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    repository: {
      name: expect.any(String),
      branch: expect.any(String),
      commit: expect.any(String),
    },
    extraction: {
      method: expect.any(String),
    },
    tokens: {
      estimated: expect.any(Number),
    },
    tool: {
      name: expect.any(String),
      version: expect.any(String),
    },
  });
}

export function expectValidDistillationResult(result: any) {
  expect(result).toMatchObject({
    apis: expect.any(Array),
    structure: {
      directories: expect.any(Array),
      fileCount: expect.any(Number),
      languages: expect.any(Object),
    },
    dependencies: {
      imports: expect.any(Array),
      exports: expect.any(Array),
    },
    metadata: {
      originalTokens: expect.any(Number),
      distilledTokens: expect.any(Number),
      compressionRatio: expect.any(Number),
    },
  });
  
  expect(result.metadata.originalTokens).toBeGreaterThan(0);
  expect(result.metadata.distilledTokens).toBeGreaterThan(0);
  expect(result.metadata.compressionRatio).toBeGreaterThan(0);
}

export async function expectCommandToSucceed(
  command: string,
  cwd: string,
  timeout = 30000
): Promise<string> {
  const { execSync } = await import("child_process");
  
  try {
    const result = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout,
    });
    
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    
    return result;
  } catch (error: any) {
    console.error(`Command failed: ${command}`);
    console.error(`Exit code: ${error.status}`);
    console.error(`Stdout: ${error.stdout}`);
    console.error(`Stderr: ${error.stderr}`);
    throw error;
  }
}

export function expectPerformanceWithinBounds(
  duration: number,
  maxDuration: number,
  operation: string
) {
  expect(duration).toBeLessThan(maxDuration);
  
  if (duration > maxDuration * 0.8) {
    console.warn(
      `⚠️ ${operation} took ${duration}ms (${(duration/maxDuration*100).toFixed(1)}% of limit)`
    );
  }
}
```

### Performance Benchmarks

#### `test/performance/extract-benchmarks.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PerformanceMonitor } from "../../src/core/performance-monitor";
import { createTestRepository } from "../helpers/fixture-factory";
import { expectPerformanceWithinBounds } from "../helpers/assertions";

describe("Extract Performance Benchmarks", () => {
  let testWorkspace: string;
  let monitor: PerformanceMonitor;

  beforeAll(() => {
    testWorkspace = mkdtempSync(join(tmpdir(), "dex-perf-"));
    monitor = new PerformanceMonitor({
      scanningTime: 10,
      prioritizationTime: 5,
      tokenEstimationTime: 2,
      totalTime: 30,
      filesPerSecond: 100,
      tokensPerSecond: 10000,
    });
  });

  afterAll(() => {
    rmSync(testWorkspace, { recursive: true, force: true });
  });

  it("should extract small repository within performance bounds", async () => {
    const repoDir = join(testWorkspace, "small-repo");
    await createTestRepository(repoDir, "typescript-api");

    monitor.reset();
    const startTime = Date.now();

    const { execSync } = await import("child_process");
    const result = execSync(
      `bun ${join(process.cwd(), "dist", "cli.js")} extract --all --stdout --format=json`,
      { cwd: repoDir, encoding: "utf-8" }
    );

    const duration = Date.now() - startTime;
    expectPerformanceWithinBounds(duration, 5000, "Small repo extraction");

    const data = JSON.parse(result);
    expect(data.changes.length).toBeGreaterThan(0);
  });

  it("should handle medium repository efficiently", async () => {
    const repoDir = join(testWorkspace, "medium-repo");
    await createMediumRepository(repoDir);

    const startTime = Date.now();
    
    const { execSync } = await import("child_process");
    const result = execSync(
      `bun ${join(process.cwd(), "dist", "cli.js")} extract --all --stdout --format=json`,
      { cwd: repoDir, encoding: "utf-8" }
    );

    const duration = Date.now() - startTime;
    expectPerformanceWithinBounds(duration, 15000, "Medium repo extraction");

    const data = JSON.parse(result);
    expect(data.changes.length).toBeGreaterThan(10);
  });

  it("should maintain consistent performance across multiple runs", async () => {
    const repoDir = join(testWorkspace, "consistent-repo");
    await createTestRepository(repoDir, "react-app");

    const durations: number[] = [];
    const runs = 5;

    for (let i = 0; i < runs; i++) {
      const startTime = Date.now();
      
      const { execSync } = await import("child_process");
      execSync(
        `bun ${join(process.cwd(), "dist", "cli.js")} extract --all --stdout --format=json`,
        { cwd: repoDir, encoding: "utf-8" }
      );

      durations.push(Date.now() - startTime);
    }

    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    const maxVariation = Math.max(...durations) - Math.min(...durations);
    
    // Performance should be consistent (variation < 50% of average)
    expect(maxVariation).toBeLessThan(avgDuration * 0.5);
    
    console.log(`Average duration: ${avgDuration.toFixed(0)}ms (±${(maxVariation/2).toFixed(0)}ms)`);
  });
});

async function createMediumRepository(dir: string): Promise<void> {
  const { mkdirSync, writeFileSync } = await import("fs");
  const { execSync } = await import("child_process");
  
  // Create larger repository structure
  mkdirSync(dir, { recursive: true });
  
  // Create 50 TypeScript files across multiple directories
  for (let i = 0; i < 10; i++) {
    const moduleDir = join(dir, `src/modules/module${i}`);
    mkdirSync(moduleDir, { recursive: true });
    
    for (let j = 0; j < 5; j++) {
      writeFileSync(
        join(moduleDir, `component${j}.ts`),
        `
// Module ${i} Component ${j}
export interface Config${i}${j} {
  enabled: boolean;
  value: string;
  options: Record<string, any>;
}

export class Service${i}${j} {
  constructor(private config: Config${i}${j}) {}

  async process(data: any[]): Promise<string[]> {
    return data
      .filter(item => this.config.enabled)
      .map(item => \`\${this.config.value}: \${JSON.stringify(item)}\`);
  }

  async validate(input: unknown): Promise<boolean> {
    return typeof input === 'object' && input !== null;
  }
}

export const DEFAULT_CONFIG_${i}_${j}: Config${i}${j} = {
  enabled: true,
  value: 'default${i}${j}',
  options: {},
};
`
      );
    }
  }

  // Initialize git and commit
  execSync("git init", { cwd: dir });
  execSync("git config user.email 'test@example.com'", { cwd: dir });
  execSync("git config user.name 'Test User'", { cwd: dir });
  execSync("git add .", { cwd: dir });
  execSync("git commit -m 'Initial medium repository'", { cwd: dir });
}
```

This comprehensive testing implementation provides:

1. **Structured test organization** with separate directories for different test types
2. **Complete unit test coverage** for core components with mocking and edge cases
3. **Integration tests** that verify command workflows and configurations
4. **End-to-end scenarios** testing real-world usage patterns
5. **Performance benchmarks** with measurable thresholds
6. **CI/CD pipeline** with parallel execution and comprehensive reporting
7. **Coverage enforcement** with automated threshold checking
8. **Test utilities and fixtures** for consistent test data and assertions

The implementation follows Bun test patterns and includes proper error handling, cleanup, and performance monitoring throughout.