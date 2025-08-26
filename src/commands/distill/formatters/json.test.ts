import { describe, test, expect } from "bun:test";
import { JsonFormatter } from "./json.js";
import { DistillationResult, CompressionResult } from "../../../types.js";

describe("JsonFormatter", () => {
    const formatter = new JsonFormatter();

    describe("formatDistillation", () => {
        const mockDistillationResult: DistillationResult = {
            apis: [
                {
                    file: "test.ts",
                    imports: ["react", "lodash"],
                    exports: [
                        {
                            name: "TestClass",
                            type: "class",
                            signature: "class TestClass",
                            visibility: "public",
                            location: { startLine: 10, endLine: 20 },
                            members: [
                                {
                                    name: "constructor",
                                    type: "method",
                                    signature: "constructor()"
                                },
                                {
                                    name: "_privateMethod",
                                    type: "method",
                                    signature: "_privateMethod(): void"
                                }
                            ]
                        },
                        {
                            name: "_privateFunction",
                            type: "function",
                            signature: "_privateFunction(): void",
                            visibility: "private",
                            location: { startLine: 25, endLine: 30 }
                        },
                        {
                            name: "publicFunction",
                            type: "function",
                            signature: "publicFunction(): string",
                            visibility: "public",
                            location: { startLine: 35, endLine: 40 },
                            docstring: "This is a public function"
                        }
                    ]
                },
                {
                    file: "utils.js",
                    imports: [],
                    exports: [
                        {
                            name: "helper",
                            type: "function",
                            signature: "function helper()",
                            visibility: "public",
                            location: { startLine: 1, endLine: 5 }
                        }
                    ]
                }
            ],
            structure: {
                directories: ["src", "src/utils"],
                fileCount: 2,
                languages: {
                    typescript: 1,
                    javascript: 1
                }
            },
            dependencies: {},
            metadata: {
                originalTokens: 1000,
                distilledTokens: 200,
                compressionRatio: 0.8
            }
        };

        test("formats basic distillation result as JSON", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            const parsed = JSON.parse(result);
            
            expect(parsed.files).toHaveLength(2);
            expect(parsed.files[0].path).toBe("test.ts");
            expect(parsed.files[1].path).toBe("utils.js");
            expect(parsed.files[0].exports).toContain("TestClass");
            expect(parsed.files[0].exports).toContain("publicFunction");
        });

        test("includes imports when includeImports is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeImports: true
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.files[0].imports).toEqual(["react", "lodash"]);
            expect(parsed.files[1].imports).toEqual([]);
        });

        test("excludes imports when includeImports is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeImports: false
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.files[0].imports).toBeUndefined();
            expect(parsed.files[1].imports).toBeUndefined();
        });

        test("includes private members when includePrivate is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includePrivate: true
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.files[0].exports).toContain("_privateFunction");
        });

        test("excludes private members when includePrivate is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includePrivate: false
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.files[0].exports).not.toContain("_privateFunction");
        });

        test("includes metadata when includeMetadata is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeMetadata: true
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.metadata).toBeDefined();
            expect(parsed.metadata.fileCount).toBe(2);
            expect(parsed.metadata.originalTokens).toBe(1000);
            expect(parsed.metadata.distilledTokens).toBe(200);
            expect(parsed.metadata.compressionRatio).toBe("80.0%");
            expect(parsed.metadata.languages).toEqual({
                typescript: 1,
                javascript: 1
            });
        });

        test("excludes metadata when includeMetadata is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeMetadata: false
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.metadata).toBeUndefined();
        });

        test("handles empty result", () => {
            const emptyResult: DistillationResult = {
                apis: [],
                structure: {
                    directories: [],
                    fileCount: 0,
                    languages: {}
                },
                dependencies: {},
                metadata: {
                    originalTokens: 0,
                    distilledTokens: 0,
                    compressionRatio: 0
                }
            };
            
            const result = formatter.formatDistillation(emptyResult);
            const parsed = JSON.parse(result);
            
            expect(parsed.files).toEqual([]);
        });

        test("produces valid JSON", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            // Should not throw
            expect(() => JSON.parse(result)).not.toThrow();
            
            const parsed = JSON.parse(result);
            expect(parsed).toBeDefined();
        });

        test("formats with pretty printing", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            // Check for indentation (pretty printed JSON)
            expect(result).toContain("\n");
            expect(result).toContain("  ");
        });
    });

    describe("formatCompression", () => {
        const mockCompressionResult: CompressionResult = {
            files: [
                {
                    path: "test.ts",
                    size: 1024,
                    hash: "abc123",
                    content: "const x = 1;",
                    language: "typescript"
                },
                {
                    path: "utils.js",
                    size: 512,
                    hash: "def456",
                    content: "function helper() {}",
                    language: "javascript"
                }
            ],
            metadata: {
                totalFiles: 2,
                totalSize: 1536,
                excludedCount: 0,
                timestamp: "2023-01-01T00:00:00Z"
            }
        };

        test("formats compression result as JSON", () => {
            const result = formatter.formatCompression(mockCompressionResult);
            const parsed = JSON.parse(result);
            
            expect(parsed.files).toHaveLength(2);
            expect(parsed.files[0]).toEqual({
                path: "test.ts",
                language: "typescript",
                content: "const x = 1;"
            });
            expect(parsed.files[1]).toEqual({
                path: "utils.js",
                language: "javascript",
                content: "function helper() {}"
            });
        });

        test("includes metadata when includeMetadata is true", () => {
            const result = formatter.formatCompression(mockCompressionResult, {
                includeMetadata: true
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.metadata).toBeDefined();
            expect(parsed.metadata.totalFiles).toBe(2);
            expect(parsed.metadata.totalSize).toBe("1.5 KB");
            expect(parsed.metadata.timestamp).toBe("2023-01-01T00:00:00Z");
        });

        test("excludes metadata when includeMetadata is false", () => {
            const result = formatter.formatCompression(mockCompressionResult, {
                includeMetadata: false
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.metadata).toBeUndefined();
        });

        test("handles files without language", () => {
            const resultWithoutLang: CompressionResult = {
                files: [
                    {
                        path: "test.txt",
                        size: 100,
                        hash: "xyz789",
                        content: "Hello world"
                        // language is optional
                    }
                ],
                metadata: {
                    totalFiles: 1,
                    totalSize: 100,
                    excludedCount: 0,
                    timestamp: "2023-01-01T00:00:00Z"
                }
            };
            
            const result = formatter.formatCompression(resultWithoutLang);
            const parsed = JSON.parse(result);
            
            expect(parsed.files[0].language).toBeUndefined();
            expect(parsed.files[0].content).toBe("Hello world");
        });
    });

    describe("formatCombined", () => {
        test("formats both compression and distillation results", () => {
            const compression: CompressionResult = {
                files: [
                    {
                        path: "test.ts",
                        size: 1024,
                        hash: "abc123",
                        content: "const x = 1;",
                        language: "typescript"
                    }
                ],
                metadata: {
                    totalFiles: 1,
                    totalSize: 1024,
                    excludedCount: 0,
                    timestamp: "2023-01-01T00:00:00Z"
                }
            };

            const distillation: DistillationResult = {
                apis: [
                    {
                        file: "test.ts",
                        imports: [],
                        exports: [
                            {
                                name: "x",
                                type: "const",
                                signature: "const x: number",
                                visibility: "public",
                                location: { startLine: 1, endLine: 1 }
                            }
                        ]
                    }
                ],
                structure: {
                    directories: [],
                    fileCount: 1,
                    languages: { typescript: 1 }
                },
                dependencies: {},
                metadata: {
                    originalTokens: 100,
                    distilledTokens: 20,
                    compressionRatio: 0.8
                }
            };

            const result = formatter.formatCombined(compression, distillation);
            const parsed = JSON.parse(result);
            
            expect(parsed.compression).toBeDefined();
            expect(parsed.distillation).toBeDefined();
            expect(parsed.compression.files).toHaveLength(1);
            expect(parsed.distillation.files).toHaveLength(1);
        });

        test("respects options for both parts", () => {
            const compression: CompressionResult = {
                files: [{
                    path: "test.ts",
                    size: 100,
                    hash: "abc",
                    content: "const x = 1;"
                }],
                metadata: {
                    totalFiles: 1,
                    totalSize: 100,
                    excludedCount: 0,
                    timestamp: "2023-01-01T00:00:00Z"
                }
            };

            const distillation: DistillationResult = {
                apis: [{
                    file: "test.ts",
                    imports: ["react"],
                    exports: [{
                        name: "x",
                        type: "const",
                        signature: "const x",
                        visibility: "public",
                        location: { startLine: 1, endLine: 1 }
                    }]
                }],
                structure: {
                    directories: [],
                    fileCount: 1,
                    languages: { typescript: 1 }
                },
                dependencies: {},
                metadata: {
                    originalTokens: 10,
                    distilledTokens: 5,
                    compressionRatio: 0.5
                }
            };

            const result = formatter.formatCombined(compression, distillation, {
                includeMetadata: false,
                includeImports: false
            });
            const parsed = JSON.parse(result);
            
            expect(parsed.compression.metadata).toBeUndefined();
            expect(parsed.distillation.metadata).toBeUndefined();
            expect(parsed.distillation.files[0].imports).toBeUndefined();
        });
    });

    describe("formatFileSize helper", () => {
        test("formats file sizes correctly", () => {
            // @ts-expect-error - accessing private method for testing
            expect(formatter.formatFileSize(512)).toBe("512 B");
            // @ts-expect-error - accessing private method for testing
            expect(formatter.formatFileSize(1024)).toBe("1.0 KB");
            // @ts-expect-error - accessing private method for testing  
            expect(formatter.formatFileSize(1536)).toBe("1.5 KB");
            // @ts-expect-error - accessing private method for testing
            expect(formatter.formatFileSize(1048576)).toBe("1.0 MB");
            // @ts-expect-error - accessing private method for testing
            expect(formatter.formatFileSize(1572864)).toBe("1.5 MB");
        });
    });
});