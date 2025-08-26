// @ts-expect-error - bun:test types not available in this environment
import { test, expect } from "bun:test";
import { TextFormatter } from "./text.js";
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
        format: "xml",
        noMetadata: false,
    };
}

test("TextFormatter formats complete context", () => {
    const formatter = new TextFormatter();
    const context = createMockContext();
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("<code_context>");
    expect(result).toContain("</code_context>");
    expect(result).toContain("<file>");
    expect(result).toContain("<path>test.ts</path>");
    expect(result).toContain("<status>modified</status>");
    expect(result).toContain("<additions>5</additions>");
    expect(result).toContain("<deletions>2</deletions>");
    expect(result).toContain('<content language="typescript">');
    expect(result).toContain("<![CDATA[export function test()");
    expect(result).toContain("<path>test.js</path>");
    expect(result).toContain("<status>added</status>");
    expect(result).toContain("<diff>");
    expect(result).toContain("<![CDATA[  @@ -0,0 +1,10 @@");
});

test("TextFormatter handles empty changes array", () => {
    const formatter = new TextFormatter();
    const context = {
        ...createMockContext(),
        changes: [],
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("<code_context>");
    expect(result).toContain("</code_context>");
    expect(result).not.toContain("<file>");
});

test("TextFormatter handles files without full content (shows diff)", () => {
    const formatter = new TextFormatter();
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

    expect(result).toContain("<file>");
    expect(result).toContain("<path>test.js</path>");
    expect(result).toContain("<diff>");
    expect(result).toContain("<![CDATA[  @@ -1,1 +1,2 @@");
    expect(result).toContain("- old");
    expect(result).toContain("+ new");
    expect(result).not.toContain("<content");
});

test("TextFormatter handles renamed files", () => {
    const formatter = new TextFormatter();
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

    expect(result).toContain("<file>");
    expect(result).toContain("<path>newname.ts</path>");
    expect(result).toContain("<status>renamed</status>");
    expect(result).toContain("<old_path>oldname.ts</old_path>");
});

test("TextFormatter escapes XML characters in content", () => {
    const formatter = new TextFormatter();
    const context = {
        ...createMockContext(),
        changes: [
            {
                file: "test.xml",
                status: "modified" as const,
                additions: 1,
                deletions: 0,
                diff: "",
            },
        ],
        fullFiles: new Map([["test.xml", "<root>&amp;</root>"]]),
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("<path>test.xml</path>");
    expect(result).toContain('<content language="xml">');
    expect(result).toContain("<![CDATA[<root>&amp;</root>]]>");
    expect(result).toContain("</content>");
});

test("TextFormatter escapes XML characters in paths and other fields", () => {
    const formatter = new TextFormatter();
    const context = {
        ...createMockContext(),
        changes: [
            {
                file: 'test&<>".ts',
                status: "modified" as const,
                additions: 1,
                deletions: 0,
                diff: "",
                oldFile: 'old&<>".ts',
            },
        ],
        fullFiles: new Map([['test&<>".ts', "console.log('hello');"]]),
    };
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("<path>test&amp;&lt;&gt;&quot;.ts</path>");
    expect(result).toContain("<old_path>old&amp;&lt;&gt;&quot;.ts</old_path>");
});

test("TextFormatter produces valid XML structure", () => {
    const formatter = new TextFormatter();
    const context = createMockContext();
    const options = createMockOptions();

    const result = formatter.format({ context, options });

    expect(result).toContain("<code_context>");
    expect(result).toContain("<changes>");
    expect(result).toContain("<file>");
    expect(result).toContain("</file>");
    expect(result).toContain("</changes>");
    expect(result).toContain("</code_context>");
    expect(result).toMatch(/<path>[^<]*<\/path>/);
    expect(result).toMatch(/<status>[^<]*<\/status>/);
});

test("TextFormatter handles unknown file extensions", () => {
    const formatter = new TextFormatter();
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

    expect(result).toContain('<content language="unknown">');
});
