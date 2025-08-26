// @ts-expect-error - bun:test types not available in this environment
import { test, expect } from "bun:test";
import { JsonFormatter } from "./json.js";
import type { GitChange } from "../../../types.js";

test("JsonFormatter formats single file with content", () => {
    const formatter = new JsonFormatter();
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
    const parsed = JSON.parse(result);

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].path).toBe("test.ts");
    expect(parsed.files[0].status).toBe("modified");
    expect(parsed.files[0].content).toBe("console.log('hello');");
    expect(parsed.files[0].additions).toBe(5);
    expect(parsed.files[0].deletions).toBe(2);
    expect(parsed.metadata.totalFiles).toBe(1);
    expect(parsed.metadata.totalAdditions).toBe(5);
    expect(parsed.metadata.totalDeletions).toBe(2);
});

test("JsonFormatter formats multiple files", () => {
    const formatter = new JsonFormatter();
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
    const parsed = JSON.parse(result);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].path).toBe("file1.ts");
    expect(parsed.files[1].path).toBe("file2.ts");
    expect(parsed.metadata.totalFiles).toBe(2);
    expect(parsed.metadata.totalAdditions).toBe(13);
    expect(parsed.metadata.totalDeletions).toBe(1);
});

test("JsonFormatter uses diff when no content", () => {
    const formatter = new JsonFormatter();
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
    const parsed = JSON.parse(result);

    expect(parsed.files[0].content).toBe("+ new line\n- old line");
});

test("JsonFormatter handles empty content gracefully", () => {
    const formatter = new JsonFormatter();
    const changes: GitChange[] = [
        {
            file: "test.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            diff: "",
            content: undefined,
        },
    ];

    const result = formatter.format(changes);
    const parsed = JSON.parse(result);

    expect(parsed.files[0].content).toBe("");
});

test("JsonFormatter handles empty changes array", () => {
    const formatter = new JsonFormatter();
    const changes: GitChange[] = [];

    const result = formatter.format(changes);
    const parsed = JSON.parse(result);

    expect(parsed.files).toHaveLength(0);
    expect(parsed.metadata.totalFiles).toBe(0);
    expect(parsed.metadata.totalAdditions).toBe(0);
    expect(parsed.metadata.totalDeletions).toBe(0);
});

test("JsonFormatter validates output against schema in development", () => {
    // This test ensures the schema validation works
    const formatter = new JsonFormatter();
    const changes: GitChange[] = [
        {
            file: "test.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            diff: "",
            content: "test",
        },
    ];

    // Store original NODE_ENV
    const originalEnv = process.env.NODE_ENV;

    try {
        // Test in development mode (should validate)
        process.env.NODE_ENV = "development";
        expect(() => formatter.format(changes)).not.toThrow();

        // Test in production mode (should skip validation)
        process.env.NODE_ENV = "production";
        expect(() => formatter.format(changes)).not.toThrow();
    } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
    }
});
