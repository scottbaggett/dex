// @ts-expect-error - bun:test types not available in this environment
import { test, expect, mock } from "bun:test";
import {
    createTreeCommand,
    treeCommand,
    generateTree,
    TreeOptions,
} from "./index.js";
import { Distiller } from "../../core/distiller/index.js";
import { OutputManager } from "../../utils/output-manager.js";
import { ProgressBar } from "../../utils/progress.js";
import clipboardy from "clipboardy";
import { promises as fs } from "fs";
import { resolve } from "path";
import { ExtractedAPI } from "../../types.js";

// Mock dependencies
mock("../../core/distiller/index.js");
mock("../../utils/output-manager.js");
mock("../../utils/progress.js");
mock("clipboardy");
mock("fs");

test("createTreeCommand creates a commander command with correct options", () => {
    const command = createTreeCommand();
    expect(command.name()).toBe("tree");
    expect(command.description()).toBe(
        "Generate visual trees of codebase APIs and structure",
    );
    // Test options are set up correctly
    const opts = command.options;
    expect(opts.some((opt) => opt.flags === "--outline")).toBe(true);
    expect(opts.some((opt) => opt.flags === "-o, --output <file>")).toBe(true);
    expect(opts.some((opt) => opt.flags === "--stdout")).toBe(true);
    expect(opts.some((opt) => opt.flags === "-c, --clipboard")).toBe(true);
    expect(opts.some((opt) => opt.flags === "--exclude <patterns...>")).toBe(
        true,
    );
    expect(opts.some((opt) => opt.flags === "--include-private")).toBe(true);
    expect(opts.some((opt) => opt.flags === "--show-types")).toBe(true);
    expect(opts.some((opt) => opt.flags === "--show-params")).toBe(true);
    expect(opts.some((opt) => opt.flags === "--group-by <method>")).toBe(true);
});

test("treeCommand with valid path and default options", async () => {
    // Mock fs.access to succeed
    const mockAccess = mock(() => Promise.resolve());
    fs.access = mockAccess;

    // Mock Distiller
    const mockDistill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function" as const,
                            visibility: "public" as const,
                            signature: "() => void",
                            location: { startLine: 1, endLine: 5 },
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );
    Distiller.prototype.distill = mockDistill;

    // Mock ProgressBar
    const mockComplete = mock(() => {});
    ProgressBar.prototype.complete = mockComplete;

    // Mock OutputManager
    const mockSaveOutput = mock(() => Promise.resolve());
    const mockGetFilePath = mock(() => Promise.resolve("/path/to/output.txt"));
    OutputManager.prototype.saveOutput = mockSaveOutput;
    OutputManager.prototype.getFilePath = mockGetFilePath;

    // Mock console.log
    const originalLog = console.log;
    console.log = mock(() => {});

    try {
        await treeCommand(".", {});
        expect(mockAccess).toHaveBeenCalledWith(resolve("."));
        expect(mockDistill).toHaveBeenCalled();
        expect(mockComplete).toHaveBeenCalled();
        expect(mockSaveOutput).toHaveBeenCalled();
        expect(mockGetFilePath).toHaveBeenCalled();
    } finally {
        console.log = originalLog;
    }
});

test("treeCommand with invalid path", async () => {
    // Mock fs.access to throw
    const mockAccess = mock(() => Promise.reject(new Error("ENOENT")));
    fs.access = mockAccess;

    // Mock console.error and process.exit
    const originalError = console.error;
    const originalExit = process.exit;
    console.error = mock(() => {});
    process.exit = mock(() => {
        throw new Error("exit");
    });

    try {
        await expect(treeCommand("/invalid/path", {})).rejects.toThrow("exit");
        expect(mockAccess).toHaveBeenCalledWith(resolve("/invalid/path"));
    } finally {
        console.error = originalError;
        process.exit = originalExit;
    }
});

test("treeCommand with stdout option", async () => {
    // Mock fs.access
    fs.access = mock(() => Promise.resolve());

    // Mock Distiller
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function" as const,
                            visibility: "public" as const,
                            signature: "() => void",
                            location: { startLine: 1, endLine: 5 },
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );

    ProgressBar.prototype.complete = mock(() => {});

    // Mock console.log
    const mockLog = mock(() => {});
    console.log = mockLog;

    try {
        await treeCommand(".", { stdout: true });
        expect(mockLog).toHaveBeenCalled();
    } finally {
        console.log = mockLog;
    }
});

test("treeCommand with clipboard option", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function" as const,
                            visibility: "public" as const,
                            signature: "() => void",
                            location: { startLine: 1, endLine: 5 },
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockWrite = mock(() => Promise.resolve());
    clipboardy.write = mockWrite;

    const mockLog = mock(() => {});
    console.log = mockLog;

    try {
        await treeCommand(".", { clipboard: true });
        expect(mockWrite).toHaveBeenCalled();
        expect(mockLog).toHaveBeenCalled();
    } finally {
        console.log = mockLog;
    }
});

test("treeCommand with output option", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function" as const,
                            visibility: "public" as const,
                            signature: "() => void",
                            location: { startLine: 1, endLine: 5 },
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockWriteFile = mock(() => Promise.resolve());
    fs.writeFile = mockWriteFile;

    const mockLog = mock(() => {});
    console.log = mockLog;

    try {
        await treeCommand(".", { output: "output.txt" });
        expect(mockWriteFile).toHaveBeenCalledWith(
            "output.txt",
            expect.any(String),
            "utf-8",
        );
        expect(mockLog).toHaveBeenCalled();
    } finally {
        console.log = mockLog;
    }
});

test("generateTree with groupBy file", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "TestClass",
                    type: "class" as const,
                    visibility: "public" as const,
                    signature: "class TestClass",
                    docstring: "A test class",
                    location: { startLine: 1, endLine: 10 },
                },
            ],
        },
    ];
    const options = {
        groupBy: "file" as const,
        includePrivate: false,
        showTypes: true,
        showParams: false,
        outline: false,
    } as const;
    const result = generateTree(apis, undefined, options, "/base/path", false);
    expect(result).toContain("TestClass");
    expect(result).toContain("test.ts");
});

test("generateTree with groupBy type", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "TestClass",
                    type: "class" as const,
                    visibility: "public" as const,
                    signature: "class TestClass",
                    location: { startLine: 1, endLine: 10 },
                },
            ],
        },
    ];
    const options = {
        groupBy: "type" as const,
        includePrivate: false,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis, undefined, options, "/base/path", false);
    expect(result).toContain("APIs by Type");
    expect(result).toContain("CLASS");
});

test("generateTree with groupBy none", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "TestClass",
                    type: "class" as const,
                    visibility: "public" as const,
                    signature: "class TestClass",
                    location: { startLine: 1, endLine: 10 },
                },
            ],
        },
    ];
    const options = {
        groupBy: "none" as const,
        includePrivate: false,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis, undefined, options, "/base/path", false);
    expect(result).toContain("All APIs");
    expect(result).toContain("TestClass");
});

test("generateTree filters private exports", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "PublicFunction",
                    type: "function" as const,
                    visibility: "public" as const,
                    signature: "() => void",
                    location: { startLine: 1, endLine: 5 },
                },
                {
                    name: "PrivateFunction",
                    type: "function" as const,
                    visibility: "private" as const,
                    signature: "() => void",
                    location: { startLine: 6, endLine: 10 },
                },
            ],
        },
    ];
    const options = {
        groupBy: "file" as const,
        includePrivate: false,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis, undefined, options, "/base/path", false);
    expect(result).toContain("PublicFunction");
    expect(result).not.toContain("PrivateFunction");
});

test("generateTree includes private exports when includePrivate is true", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "PublicFunction",
                    type: "function" as const,
                    visibility: "public" as const,
                    signature: "() => void",
                    location: { startLine: 1, endLine: 5 },
                },
                {
                    name: "PrivateFunction",
                    type: "function" as const,
                    visibility: "private" as const,
                    signature: "() => void",
                    location: { startLine: 6, endLine: 10 },
                },
            ],
        },
    ];
    const options = {
        groupBy: "file",
        includePrivate: true,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis, undefined, options as TreeOptions, "/base/path", false);
    expect(result).toContain("PublicFunction");
    expect(result).toContain("PrivateFunction");
});

test("treeCommand handles error from distiller", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.reject(new Error("Distiller error")),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockError = mock(() => {});
    const mockExit = mock(() => {
        throw new Error("exit");
    });
    console.error = mockError;
    process.exit = mockExit;

    try {
        await expect(treeCommand(".", {})).rejects.toThrow("exit");
        expect(mockError).toHaveBeenCalled();
    } finally {
        console.error = mockError;
        process.exit = mockExit;
    }
});

test("treeCommand handles no APIs found", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            structure: undefined,
            // No apis property
        }),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockError = mock(() => {});
    const mockExit = mock(() => {
        throw new Error("exit");
    });
    console.error = mockError;
    process.exit = mockExit;

    try {
        await expect(treeCommand(".", {})).rejects.toThrow("exit");
        expect(mockError).toHaveBeenCalled();
    } finally {
        console.error = mockError;
        process.exit = mockExit;
    }
});

test("treeCommand with valid path and default options", async () => {
    // Mock fs.access to succeed
    const mockAccess = mock(() => Promise.resolve());
    fs.access = mockAccess;

    // Mock Distiller
    const mockDistill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function" as const,
                            visibility: "public" as const,
                            signature: "() => void",
                            location: { startLine: 1, endLine: 5 },
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );
    Distiller.prototype.distill = mockDistill;

    // Mock ProgressBar
    const mockComplete = mock(() => {});
    ProgressBar.prototype.complete = mockComplete;

    // Mock OutputManager
    const mockSaveOutput = mock(() => Promise.resolve());
    const mockGetFilePath = mock(() => Promise.resolve("/path/to/output.txt"));
    OutputManager.prototype.saveOutput = mockSaveOutput;
    OutputManager.prototype.getFilePath = mockGetFilePath;

    // Mock console.log
    const originalLog = console.log;
    console.log = mock(() => {});

    try {
        await treeCommand(".", {});
        expect(mockAccess).toHaveBeenCalledWith(resolve("."));
        expect(mockDistill).toHaveBeenCalled();
        expect(mockComplete).toHaveBeenCalled();
        expect(mockSaveOutput).toHaveBeenCalled();
        expect(mockGetFilePath).toHaveBeenCalled();
    } finally {
        console.log = originalLog;
    }
});

test("treeCommand with invalid path", async () => {
    // Mock fs.access to throw
    const mockAccess = mock(() => Promise.reject(new Error("ENOENT")));
    fs.access = mockAccess;

    // Mock console.error and process.exit
    const originalError = console.error;
    const originalExit = process.exit;
    console.error = mock(() => {});
    process.exit = mock(() => {
        throw new Error("exit");
    });

    try {
        await expect(treeCommand("/invalid/path", {})).rejects.toThrow("exit");
        expect(mockAccess).toHaveBeenCalledWith(resolve("/invalid/path"));
    } finally {
        console.error = originalError;
        process.exit = originalExit;
    }
});

test("treeCommand with stdout option", async () => {
    // Mock fs.access
    fs.access = mock(() => Promise.resolve());

    // Mock Distiller
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function" as const,
                            visibility: "public" as const,
                            signature: "() => void",
                            location: { startLine: 1, endLine: 5 },
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );

    ProgressBar.prototype.complete = mock(() => {});

    // Mock console.log
    const mockLog = mock(() => {});
    console.log = mockLog;

    try {
        await treeCommand(".", { stdout: true });
        expect(mockLog).toHaveBeenCalled();
    } finally {
        console.log = mockLog;
    }
});

test("treeCommand with clipboard option", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function",
                            visibility: "public",
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockWrite = mock(() => Promise.resolve());
    clipboardy.write = mockWrite;

    const mockLog = mock(() => {});
    console.log = mockLog;

    try {
        await treeCommand(".", { clipboard: true });
        expect(mockWrite).toHaveBeenCalled();
        expect(mockLog).toHaveBeenCalled();
    } finally {
        console.log = mockLog;
    }
});

test("treeCommand with output option", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            apis: [
                {
                    file: "test.ts",
                    exports: [
                        {
                            name: "testFunction",
                            type: "function",
                            visibility: "public",
                        },
                    ],
                },
            ],
            structure: undefined,
        }),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockWriteFile = mock(() => Promise.resolve());
    fs.writeFile = mockWriteFile;

    const mockLog = mock(() => {});
    console.log = mockLog;

    try {
        await treeCommand(".", { output: "output.txt" });
        expect(mockWriteFile).toHaveBeenCalledWith(
            "output.txt",
            expect.any(String),
            "utf-8",
        );
        expect(mockLog).toHaveBeenCalled();
    } finally {
        console.log = mockLog;
    }
});

test("generateTree with groupBy file", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "TestClass",
                    type: "class",
                    visibility: "public",
                    signature: "class TestClass",
                    docstring: "A test class",
                },
            ],
        },
    ];
    const options = {
        groupBy: "file",
        includePrivate: false,
        showTypes: true,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis as ExtractedAPI[], undefined, options as TreeOptions, "/base/path", false);
    expect(result).toContain("TestClass");
    expect(result).toContain("test.ts");
});

test("generateTree with groupBy type", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "TestClass",
                    type: "class",
                    visibility: "public",
                },
            ],
        },
    ];
    const options = {
        groupBy: "type",
        includePrivate: false,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis as ExtractedAPI[], undefined, options as TreeOptions, "/base/path", false);
    expect(result).toContain("APIs by Type");
    expect(result).toContain("CLASS");
});

test("generateTree with groupBy none", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "TestClass",
                    type: "class",
                    visibility: "public",
                },
            ],
        },
    ];
    const options = {
        groupBy: "none",
        includePrivate: false,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis as ExtractedAPI[], undefined, options as TreeOptions, "/base/path", false);
    expect(result).toContain("All APIs");
    expect(result).toContain("TestClass");
});

test("generateTree filters private exports", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "PublicFunction",
                    type: "function",
                    visibility: "public",
                },
                {
                    name: "PrivateFunction",
                    type: "function",
                    visibility: "private",
                },
            ],
        },
    ];
    const options = {
        groupBy: "file",
        includePrivate: false,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis as ExtractedAPI[], undefined, options as TreeOptions, "/base/path", false);
    expect(result).toContain("PublicFunction");
    expect(result).not.toContain("PrivateFunction");
});

test("generateTree includes private exports when includePrivate is true", () => {
    const apis = [
        {
            file: "src/test.ts",
            exports: [
                {
                    name: "PublicFunction",
                    type: "function",
                    visibility: "public",
                },
                {
                    name: "PrivateFunction",
                    type: "function",
                    visibility: "private",
                },
            ],
        },
    ];
    const options = {
        groupBy: "file",
        includePrivate: true,
        showTypes: false,
        showParams: false,
        outline: false,
    };
    const result = generateTree(apis as ExtractedAPI[], undefined, options as TreeOptions, "/base/path", false);
    expect(result).toContain("PublicFunction");
    expect(result).toContain("PrivateFunction");
});

test("treeCommand handles error from distiller", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.reject(new Error("Distiller error")),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockError = mock(() => {});
    const mockExit = mock(() => {
        throw new Error("exit");
    });
    console.error = mockError;
    process.exit = mockExit;

    try {
        await expect(treeCommand(".", {})).rejects.toThrow("exit");
        expect(mockError).toHaveBeenCalled();
    } finally {
        console.error = mockError;
        process.exit = mockExit;
    }
});

test("treeCommand handles no APIs found", async () => {
    fs.access = mock(() => Promise.resolve());
    Distiller.prototype.distill = mock(() =>
        Promise.resolve({
            structure: undefined,
            // No apis property
        }),
    );
    ProgressBar.prototype.complete = mock(() => {});

    const mockError = mock(() => {});
    const mockExit = mock(() => {
        throw new Error("exit");
    });
    console.error = mockError;
    process.exit = mockExit;

    try {
        await expect(treeCommand(".", {})).rejects.toThrow("exit");
        expect(mockError).toHaveBeenCalled();
    } finally {
        console.error = mockError;
        process.exit = mockExit;
    }
});
