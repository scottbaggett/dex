// @ts-expect-error - bun:test types not available in this environment
import { test, expect } from "bun:test";
import { MarkdownFormatter } from "./markdown.js";
import type { ExtractedContext, DexOptions } from "../../../types.js";

function createMockContext(): ExtractedContext {
    return {
        changes: [
            {
                file: "test.ts",
                status: "modified" as const,
                additions: 5,
                deletions: 2,
                diff: "@@ -1,2 +1,5 @@\n-old line\n+new line\n+another line",
                lastModified: new Date("2024-01-01T00:00:00Z"),
            },
            {
                file: "test.js",
                status: "added" as const,
                additions: 10,
                deletions: 0,
                diff: "@@ -0,0 +1,10 @@\n+console.log('hello');\n+console.log('world');",
            },
        ],
        scope: {
            filesChanged: 2,
            functionsModified: 1,
            linesAdded: 15,
            linesDeleted: 2,
        },
        metadata: {
            generated: "2024-01-01T00:00:00Z",
            repository: {
                name: "test-repo",
                branch: "main",
                commit: "abc123",
            },
            extraction: {
                method: "git-diff",
                filters: {
                    path: "*.ts",
                    type: ["typescript"],
                },
            },
            tokens: {
                estimated: 1500,
            },
            tool: {
                name: "dex",
                version: "1.0.0",
            },
        },
        fullFiles: new Map([
            ["test.ts", "export function test() {\n  return 'hello';\n}"],
        ]),
    };
}

function createMockOptions(): DexOptions {
    return {
        format: "md",
        noMetadata: false,
    };
}

test("MarkdownFormatter formats complete context with metadata", () => {
    const formatter = new MarkdownFormatter();
    const context = createMockContext();
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("## Metadata");
    expect(result).toContain("test-repo");
    expect(result).toContain("## Scope");
    expect(result).toContain("Files Changed:** 2");
    expect(result).toContain("## Changes");
    expect(result).toContain("### test.ts");
    expect(result).toContain("```typescript");
    expect(result).toContain("export function test()");
    expect(result).toContain("### test.js");
    expect(result).toContain("```diff");
});

test("MarkdownFormatter excludes metadata when noMetadata is true", () => {
    const formatter = new MarkdownFormatter();
    const context = createMockContext();
    const options = { ...createMockOptions(), noMetadata: true };

    const result = formatter.format({ context, options });

    expect(result).not.toContain("## Metadata");
    expect(result).toContain("## Scope");
    expect(result).toContain("## Changes");
});

test("MarkdownFormatter handles empty changes array", () => {
    const formatter = new MarkdownFormatter();
    const context = {
        ...createMockContext(),
        changes: [],
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("## Metadata");
    expect(result).toContain("## Scope");
    expect(result).not.toContain("## Changes");
});

test("MarkdownFormatter handles renamed files", () => {
    const formatter = new MarkdownFormatter();
    const context = {
        ...createMockContext(),
        changes: [
            {
                file: "newname.ts",
                status: "renamed" as const,
                additions: 0,
                deletions: 0,
                diff: "",
                oldFile: "oldname.ts",
            },
        ],
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("### newname.ts (renamed from oldname.ts)");
});

test("MarkdownFormatter handles files without full content (shows diff)", () => {
    const formatter = new MarkdownFormatter();
    const context = {
        ...createMockContext(),
        changes: [
            {
                file: "test.js",
                status: "modified" as const,
                additions: 2,
                deletions: 1,
                diff: "@@ -1,1 +1,2 @@\n-old\n+new\n+line",
            },
        ],
        fullFiles: new Map(), // Empty map
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("```diff");
    expect(result).toContain("+ new");
    expect(result).toContain("- old");
});

test("MarkdownFormatter formats diff correctly", () => {
    const formatter = new MarkdownFormatter();
    const context = {
        ...createMockContext(),
        changes: [
            {
                file: "test.ts",
                status: "modified" as const,
                additions: 1,
                deletions: 1,
                diff: "@@ -1,1 +1,1 @@\n-old line\n+new line",
            },
        ],
        fullFiles: new Map(),
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("```diff");
    expect(result).toContain("  @@ -1,1 +1,1 @@");
    expect(result).toContain("+ new line");
    expect(result).toContain("- old line");
});

test("MarkdownFormatter handles files with unknown extensions", () => {
    const formatter = new MarkdownFormatter();
    const context = {
        ...createMockContext(),
        changes: [
            {
                file: "test.unknown",
                status: "modified" as const,
                additions: 1,
                deletions: 0,
                diff: "",
            },
        ],
        fullFiles: new Map([["test.unknown", "some content"]]),
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("```unknown");
});
