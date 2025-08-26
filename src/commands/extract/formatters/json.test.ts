// @ts-expect-error - bun:test types not available in this environment
import { test, expect } from "bun:test";
import { JsonFormatter } from "./json.js";
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
        format: "json",
        noMetadata: false,
    };
}

test("JsonFormatter formats complete context with metadata", () => {
    const formatter = new JsonFormatter();
    const context = createMockContext();
    const options = createMockOptions();

    const result = formatter.format({ context, options });
    const parsed = JSON.parse(result);

    expect(parsed.scope).toEqual(context.scope);
    expect(parsed.changes).toHaveLength(2);
    expect(parsed.changes[0].file).toBe("test.ts");
    expect(parsed.changes[0].status).toBe("modified");
    expect(parsed.changes[0].additions).toBe(5);
    expect(parsed.changes[0].deletions).toBe(2);
    expect(parsed.changes[0].diff).toContain("@@ -1,2 +1,5 @@");
    expect(parsed.changes[0].fullContent).toBe(
        "export function test() {\n  return 'hello';\n}",
    );
    expect(parsed.changes[1].file).toBe("test.js");
    expect(parsed.changes[1].status).toBe("added");
    expect(parsed.changes[1].fullContent).toBeUndefined();
    expect(parsed.metadata).toEqual(context.metadata);
});

test("JsonFormatter excludes metadata when noMetadata is true", () => {
    const formatter = new JsonFormatter();
    const context = createMockContext();
    const options = { ...createMockOptions(), noMetadata: true };

    const result = formatter.format({ context, options });
    const parsed = JSON.parse(result);

    expect(parsed.scope).toEqual(context.scope);
    expect(parsed.changes).toHaveLength(2);
    expect(parsed.metadata).toBeUndefined();
});

test("JsonFormatter handles empty changes array", () => {
    const formatter = new JsonFormatter();
    const context = {
        ...createMockContext(),
        changes: [],
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });
    const parsed = JSON.parse(result);

    expect(parsed.scope).toEqual(context.scope);
    expect(parsed.changes).toHaveLength(0);
    expect(parsed.metadata).toEqual(context.metadata);
});

test("JsonFormatter handles files without full content", () => {
    const formatter = new JsonFormatter();
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
    const parsed = JSON.parse(result);

    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0].file).toBe("test.js");
    expect(parsed.changes[0].fullContent).toBeUndefined();
    expect(parsed.changes[0].diff).toContain("@@ -1,1 +1,2 @@");
});

test("JsonFormatter handles renamed files", () => {
    const formatter = new JsonFormatter();
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
    const parsed = JSON.parse(result);

    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0].file).toBe("newname.ts");
    expect(parsed.changes[0].status).toBe("renamed");
    expect(parsed.changes[0].oldFile).toBe("oldname.ts");
});

test("JsonFormatter produces valid JSON", () => {
    const formatter = new JsonFormatter();
    const context = createMockContext();
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(() => JSON.parse(result)).not.toThrow();
    expect(typeof result).toBe("string");
    expect(result).toContain('"scope"');
    expect(result).toContain('"changes"');
    expect(result).toContain('"metadata"');
});

test("JsonFormatter handles context without fullFiles", () => {
    const formatter = new JsonFormatter();
    const context = {
        ...createMockContext(),
        fullFiles: undefined,
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });
    const parsed = JSON.parse(result);

    expect(parsed.changes[0].fullContent).toBeUndefined();
    expect(parsed.changes[1].fullContent).toBeUndefined();
});
