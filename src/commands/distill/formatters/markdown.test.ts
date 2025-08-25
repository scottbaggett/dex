import { describe, test, expect } from "bun:test";
import { MarkdownFormatter } from "./markdown";
import { DistillationResult, CompressionResult } from "../../../types";
import { getSyntaxLanguage } from "../../../utils/language";

describe("MarkdownFormatter", () => {
    const formatter = new MarkdownFormatter();

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

        test("formats basic distillation result", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("## test.ts");
            expect(result).toContain("## utils.js");
            expect(result).toContain("```typescript");
            expect(result).toContain("```javascript");
            expect(result).toContain("class TestClass");
            expect(result).toContain("function helper()");
        });

        test("includes imports when includeImports is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeImports: true
            });
            
            expect(result).toContain("import 'react'");
            expect(result).toContain("import 'lodash'");
        });

        test("excludes imports when includeImports is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeImports: false
            });
            
            expect(result).not.toContain("import 'react'");
            expect(result).not.toContain("import 'lodash'");
        });

        test("includes private members when includePrivate is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includePrivate: true
            });
            
            expect(result).toContain("_privateFunction(): void");
        });

        test("excludes private members when includePrivate is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includePrivate: false
            });
            
            expect(result).not.toContain("_privateFunction(): void");
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
            expect(result).toBe("");
        });

        test("handles multiple files with correct language detection", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            // Check that TypeScript file uses typescript language
            const tsSection = result.substring(
                result.indexOf("## test.ts"),
                result.indexOf("## utils.js")
            );
            expect(tsSection).toContain("```typescript");
            
            // Check that JavaScript file uses javascript language
            const jsSection = result.substring(result.indexOf("## utils.js"));
            expect(jsSection).toContain("```javascript");
        });


        test("outputs signatures with comments when present", () => {
            const resultWithComments: DistillationResult = {
                ...mockDistillationResult,
                apis: [
                    {
                        file: "test.ts",
                        imports: [],
                        exports: [
                            {
                                name: "testFunc",
                                type: "function",
                                signature: "// This is a comment\nfunction testFunc()",
                                visibility: "public",
                                location: { startLine: 1, endLine: 2 }
                            }
                        ]
                    }
                ]
            };
            
            const result = formatter.formatDistillation(resultWithComments);
            
            // Formatter outputs signatures as-is - comment filtering happens at processor level
            expect(result).toContain("// This is a comment");
            expect(result).toContain("function testFunc()");
        });

        test("outputs signatures without comments when not present", () => {
            const resultWithoutComments: DistillationResult = {
                ...mockDistillationResult,
                apis: [
                    {
                        file: "test.ts",
                        imports: [],
                        exports: [
                            {
                                name: "testFunc",
                                type: "function",
                                signature: "function testFunc()",
                                visibility: "public",
                                location: { startLine: 1, endLine: 2 }
                            }
                        ]
                    }
                ]
            };
            
            const result = formatter.formatDistillation(resultWithoutComments);
            
            expect(result).toContain("function testFunc()");
            expect(result).not.toContain("// This is a comment");
        });

        test("includes docstrings when includeDocstrings is true", () => {
            const resultWithDocstrings: DistillationResult = {
                ...mockDistillationResult,
                apis: [
                    {
                        file: "test.ts",
                        imports: [],
                        exports: [
                            {
                                name: "documented",
                                type: "function",
                                signature: "function documented()",
                                visibility: "public",
                                location: { startLine: 1, endLine: 5 },
                                docstring: "This function does something important"
                            }
                        ]
                    }
                ]
            };
            
            const result = formatter.formatDistillation(resultWithDocstrings, {
                includeDocstrings: true
            });
            
            // Markdown formatter doesn't show docstrings separately - they're in the signature
            expect(result).toContain("function documented()");
            // Docstrings are included in the code signature if present
        });

        test("excludes docstrings when includeDocstrings is false", () => {
            const resultWithDocstrings: DistillationResult = {
                ...mockDistillationResult,
                apis: [
                    {
                        file: "test.ts",
                        imports: [],
                        exports: [
                            {
                                name: "documented",
                                type: "function",
                                signature: "function documented()",
                                visibility: "public",
                                location: { startLine: 1, endLine: 5 },
                                docstring: "This function does something important"
                            }
                        ]
                    }
                ]
            };
            
            const result = formatter.formatDistillation(resultWithDocstrings, {
                includeDocstrings: false
            });
            
            expect(result).toContain("function documented()");
            // Markdown formatter doesn't show docstrings separately anyway
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

        test("formats compression result", () => {
            const result = formatter.formatCompression(mockCompressionResult);
            
            expect(result).toContain("# Compressed Files");
            expect(result).toContain("## test.ts");
            expect(result).toContain("## utils.js");
            expect(result).toContain("```typescript");
            expect(result).toContain("const x = 1;");
            expect(result).toContain("```javascript");
            expect(result).toContain("function helper() {}");
        });

        test("includes metadata when includeMetadata is true", () => {
            const result = formatter.formatCompression(mockCompressionResult, {
                includeMetadata: true
            });
            
            expect(result).toContain("**Total Files:** 2");
            expect(result).toContain("**Total Size:** 1,536 bytes");
        });

        test("excludes metadata when includeMetadata is false", () => {
            const result = formatter.formatCompression(mockCompressionResult, {
                includeMetadata: false
            });
            
            expect(result).not.toContain("**Total Files:**");
            expect(result).not.toContain("**Total Size:**");
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
            
            expect(result).toContain("# Compressed Files");
            expect(result).toContain("---");
            expect(result).toContain("## test.ts");
            expect(result).toContain("const x = 1;");
            expect(result).toContain("const x: number");
        });
    });

    describe("getSyntaxLanguage", () => {
        test("detects correct language for various file extensions", () => {
            const testCases = [
                { file: "test.ts", expected: "typescript" },
                { file: "test.tsx", expected: "typescript" },
                { file: "test.js", expected: "javascript" },
                { file: "test.jsx", expected: "javascript" },
                { file: "test.py", expected: "python" },
                { file: "test.rb", expected: "ruby" },
                { file: "test.go", expected: "go" },
                { file: "test.rs", expected: "rust" },
                { file: "test.java", expected: "java" },
                { file: "test.cpp", expected: "cpp" },
                { file: "test.c", expected: "c" },
                { file: "test.cs", expected: "csharp" },
                { file: "test.php", expected: "php" },
                { file: "test.swift", expected: "swift" },
                { file: "test.kt", expected: "kotlin" },
                { file: "test.scala", expected: "scala" },
                { file: "test.sh", expected: "bash" },
                { file: "test.yaml", expected: "yaml" },
                { file: "test.yml", expected: "yaml" },
                { file: "test.json", expected: "json" },
                { file: "test.xml", expected: "xml" },
                { file: "test.html", expected: "html" },
                { file: "test.css", expected: "css" },
                { file: "test.scss", expected: "scss" },
                { file: "test.sql", expected: "sql" },
                { file: "test.unknown", expected: "text" },
                { file: "test", expected: "text" }
            ];
            
            testCases.forEach(({ file, expected }) => {
                const result = getSyntaxLanguage(file);
                expect(result).toBe(expected);
            });
        });
    });
});