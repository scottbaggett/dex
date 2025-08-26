// @ts-expect-error - bun:test types not available in this environment
import { test, expect } from "bun:test";
import { TextFormatter } from "./text.js";
import type { GitChange } from "../../../types.js";

test("TextFormatter formats single file with content", () => {
    const formatter = new TextFormatter();
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

    expect(result).toContain("<code_context>");
    expect(result).toContain('<file path="test.ts">');
    expect(result).toContain("console.log('hello');");
    expect(result).toContain("</file>");
    expect(result).toContain("</code_context>");
});

test("TextFormatter formats multiple files", () => {
    const formatter = new TextFormatter();
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
            file: "file2.ts",
            status: "modified",
            additions: 3,
            deletions: 1,
            diff: "",
            content: "const b = 2;",
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain('<file path="file1.ts">');
    expect(result).toContain('<file path="file2.ts">');
    expect(result).toContain("const a = 1;");
    expect(result).toContain("const b = 2;");
});

test("TextFormatter uses diff when no content", () => {
    const formatter = new TextFormatter();
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

test("TextFormatter escapes XML characters in file paths", () => {
    const formatter = new TextFormatter();
    const changes: GitChange[] = [
        {
            file: "test&<>\"'.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: "test",
        },
    ];

    const result = formatter.format(changes);

    expect(result).toContain('<file path="test&amp;&lt;&gt;&quot;&apos;.ts">');
});

test("TextFormatter handles empty changes array", () => {
    const formatter = new TextFormatter();
    const changes: GitChange[] = [];

    const result = formatter.format(changes);

    expect(result).toBe("<code_context>\n\n</code_context>");
});
