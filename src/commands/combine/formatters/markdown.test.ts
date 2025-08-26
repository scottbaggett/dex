// @ts-expect-error - bun:test types not available in this environment
import { test, expect } from "bun:test";
import { MarkdownFormatter } from "./markdown.js";
import type { GitChange } from "../../../types.js";

test("MarkdownFormatter formats single file with content", () => {
    const formatter = new MarkdownFormatter();
    const changes: GitChange[] = [
        {
            file: "test.ts",
            status: "modified",
            additions: 5,
            deletions: 2,
            diff: "",
            content: "console.log('hello');",
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain("# Code Context");
    expect(result).toContain("## test.ts");
    expect(result).toContain("```typescript");
    expect(result).toContain("console.log('hello');");
    expect(result).toContain("```");
});

test("MarkdownFormatter formats multiple files", () => {
    const formatter = new MarkdownFormatter();
    const changes: GitChange[] = [
        {
            file: "file1.ts",
            status: "added",
            additions: 10,
            deletions: 0,
            diff: "",
            content: "const a = 1;",
        },
        {
            file: "file2.js",
            status: "modified",
            additions: 3,
            deletions: 1,
            diff: "",
            content: "const b = 2;",
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain("## file1.ts");
    expect(result).toContain("```typescript");
    expect(result).toContain("const a = 1;");
    expect(result).toContain("## file2.js");
    expect(result).toContain("```javascript");
    expect(result).toContain("const b = 2;");
});

test("MarkdownFormatter uses diff when no content", () => {
    const formatter = new MarkdownFormatter();
    const changes: GitChange[] = [
        {
            file: "test.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            diff: "+ new line\n- old line",
            content: undefined,
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain("+ new line\n- old line");
});

test("MarkdownFormatter detects file extensions correctly", () => {
    const formatter = new MarkdownFormatter();
    const changes: GitChange[] = [
        {
            file: "script.py",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: "print('hello')",
        },
        {
            file: "style.css",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: ".class { color: red; }",
        },
        {
            file: "data.json",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: '{"key": "value"}',
        },
        {
            file: "readme.md",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: "# Title",
        },
        {
            file: "unknown.xyz",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: "unknown content",
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain("```python");
    expect(result).toContain("```css");
    expect(result).toContain("```json");
    expect(result).toContain("```markdown");
    expect(result).toContain("```xyz"); // unknown extension falls back to extension itself
});

test("MarkdownFormatter handles files without extensions", () => {
    const formatter = new MarkdownFormatter();
    const changes: GitChange[] = [
        {
            file: "Makefile",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: "all: build",
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain("```"); // Should use empty language for unknown extensions
});

test("MarkdownFormatter handles empty changes array", () => {
    const formatter = new MarkdownFormatter();
    const changes: GitChange[] = [];

    const result = formatter.format(changes);

    expect(result).toContain("# Code Context");
});
