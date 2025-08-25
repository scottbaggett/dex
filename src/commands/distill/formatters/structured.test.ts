import { describe, test, expect } from "bun:test";
import { StructuredFormatter } from "./structured";
import { DistillationResult, CompressionResult } from "../../../types";

describe("StructuredFormatter", () => {
    const formatter = new StructuredFormatter();

    describe("formatDistillation", () => {
        const mockDistillationResult: DistillationResult = {
            apis: [
                {
                    file: "src/test.ts",
                    imports: ["react", "lodash"],
                    exports: [
                        {
                            name: "TestInterface",
                            type: "interface",
                            signature: "interface TestInterface",
                            visibility: "public",
                            location: { startLine: 5, endLine: 10 },
                            members: [
                                {
                                    name: "id",
                                    type: "property",
                                    signature: "id: string"
                                },
                                {
                                    name: "name",
                                    type: "property",
                                    signature: "name?: string"
                                }
                            ]
                        },
                        {
                            name: "TestClass",
                            type: "class",
                            signature: "class TestClass implements TestInterface",
                            visibility: "public",
                            location: { startLine: 15, endLine: 50 },
                            members: [
                                {
                                    name: "constructor",
                                    type: "method",
                                    signature: "constructor(id: string)"
                                },
                                {
                                    name: "id",
                                    type: "property",
                                    signature: "id: string"
                                },
                                {
                                    name: "_privateMethod",
                                    type: "method",
                                    signature: "_privateMethod(): void"
                                },
                                {
                                    name: "publicMethod",
                                    type: "method",
                                    signature: "publicMethod(): string"
                                }
                            ]
                        },
                        {
                            name: "_privateFunction",
                            type: "function",
                            signature: "function _privateFunction(): void",
                            visibility: "private",
                            location: { startLine: 55, endLine: 60 }
                        },
                        {
                            name: "publicFunction",
                            type: "function",
                            signature: "function publicFunction(): string",
                            visibility: "public",
                            location: { startLine: 65, endLine: 70 },
                            docstring: "This is a public function"
                        },
                        {
                            name: "MyType",
                            type: "type",
                            signature: "type MyType = string | number",
                            visibility: "public",
                            location: { startLine: 75, endLine: 75 }
                        },
                        {
                            name: "MyEnum",
                            type: "enum",
                            signature: "enum MyEnum { A, B, C }",
                            visibility: "public",
                            location: { startLine: 80, endLine: 84 }
                        },
                        {
                            name: "CONSTANT",
                            type: "const",
                            signature: "const CONSTANT = 42",
                            visibility: "public",
                            location: { startLine: 90, endLine: 90 }
                        }
                    ]
                },
                {
                    file: "src/utils/helper.js",
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

        test("formats basic distillation result with file tags", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain('<file path="test.ts">');
            expect(result).toContain('</file>');
            expect(result).toContain('<file path="utils/helper.js">');
        });

        test("groups exports by type when groupByType is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                groupByType: true
            });
            
            // Check order: interfaces come before classes, classes before functions, etc.
            const interfaceIndex = result.indexOf("export interface TestInterface");
            const classIndex = result.indexOf("export class TestClass");
            const functionIndex = result.indexOf("export function publicFunction");
            const typeIndex = result.indexOf("export type MyType");
            const constIndex = result.indexOf("export const CONSTANT");
            const enumIndex = result.indexOf("export enum MyEnum");
            
            expect(interfaceIndex).toBeLessThan(classIndex);
            expect(classIndex).toBeLessThan(functionIndex);
            expect(functionIndex).toBeLessThan(typeIndex);
            expect(typeIndex).toBeLessThan(constIndex);
            expect(constIndex).toBeLessThan(enumIndex);
        });

        test("maintains original order when groupByType is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                groupByType: false
            });
            
            // Items should appear in the order they were provided
            const interfaceIndex = result.indexOf("export interface TestInterface");
            const classIndex = result.indexOf("export class TestClass");
            const functionIndex = result.indexOf("export function publicFunction");
            const typeIndex = result.indexOf("export type MyType");
            
            expect(interfaceIndex).toBeLessThan(classIndex);
            expect(classIndex).toBeLessThan(functionIndex);
            expect(functionIndex).toBeLessThan(typeIndex);
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
            
            expect(result).toContain("export function _privateFunction");
        });

        test("excludes private members when includePrivate is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includePrivate: false
            });
            
            expect(result).not.toContain("export function _privateFunction");
        });

        test("includes docstrings when includeDocstrings is true", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeDocstrings: true
            });
            
            expect(result).toContain("/**");
            expect(result).toContain("* This is a public function");
            expect(result).toContain("*/");
        });

        test("excludes docstrings when includeDocstrings is false", () => {
            const result = formatter.formatDistillation(mockDistillationResult, {
                includeDocstrings: false
            });
            
            expect(result).not.toContain("/**");
            expect(result).not.toContain("This is a public function");
        });

        test("formats interfaces with members", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("export interface TestInterface {");
            expect(result).toContain("    id: string;");
            expect(result).toContain("    name?: string;");
            expect(result).toContain("}");
        });

        test("formats classes with members", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("export class TestClass implements TestInterface {");
            expect(result).toContain("    constructor(id: string)");
            expect(result).toContain("    id: string;");
            expect(result).toContain("    publicMethod(): string");
            expect(result).toContain("}");
        });

        test("formats functions correctly", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("export function publicFunction(): string");
        });

        test("formats types correctly", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("export type MyType = string | number");
        });

        test("formats enums correctly", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("export enum MyEnum { A, B, C }");
        });

        test("formats constants correctly", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            expect(result).toContain("export const CONSTANT = 42");
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

        test("cleans file paths removing common prefixes", () => {
            const result = formatter.formatDistillation(mockDistillationResult);
            
            // Should remove "src/" prefix
            expect(result).toContain('<file path="test.ts">');
            expect(result).toContain('<file path="utils/helper.js">');
            expect(result).not.toContain('<file path="src/test.ts">');
        });

        test("handles extends and implements in class signatures", () => {
            const resultWithExtends: DistillationResult = {
                ...mockDistillationResult,
                apis: [{
                    file: "test.ts",
                    imports: [],
                    exports: [{
                        name: "Child",
                        type: "class",
                        signature: "class Child extends Parent implements IChild",
                        visibility: "public",
                        location: { startLine: 1, endLine: 10 }
                    }]
                }]
            };
            
            const result = formatter.formatDistillation(resultWithExtends);
            
            expect(result).toContain("export class Child extends Parent implements IChild {");
        });

        test("handles interface extends", () => {
            const resultWithExtends: DistillationResult = {
                ...mockDistillationResult,
                apis: [{
                    file: "test.ts",
                    imports: [],
                    exports: [{
                        name: "ExtendedInterface",
                        type: "interface",
                        signature: "interface ExtendedInterface extends BaseInterface",
                        visibility: "public",
                        location: { startLine: 1, endLine: 5 }
                    }]
                }]
            };
            
            const result = formatter.formatDistillation(resultWithExtends);
            
            expect(result).toContain("export interface ExtendedInterface extends BaseInterface {");
        });
    });

    describe("formatCompression", () => {
        const mockCompressionResult: CompressionResult = {
            files: [
                {
                    path: "test.ts",
                    size: 1024,
                    hash: "abc123",
                    content: "const x = 1;\nconst y = 2;",
                    language: "typescript"
                },
                {
                    path: "utils.js",
                    size: 512,
                    hash: "def456",
                    content: "function helper() {\n  return true;\n}",
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

        test("formats compression result with file tags", () => {
            const result = formatter.formatCompression(mockCompressionResult);
            
            expect(result).toContain('<file path="test.ts" language="typescript">');
            expect(result).toContain("const x = 1;\nconst y = 2;");
            expect(result).toContain('</file>');
            expect(result).toContain('<file path="utils.js" language="javascript">');
            expect(result).toContain("function helper() {\n  return true;\n}");
        });

        test("handles files without language", () => {
            const resultWithoutLang: CompressionResult = {
                files: [
                    {
                        path: "test.txt",
                        size: 100,
                        hash: "xyz789",
                        content: "Hello world"
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
            
            expect(result).toContain('<file path="test.txt">');
            expect(result).not.toContain('language=');
            expect(result).toContain("Hello world");
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
            
            expect(result).toContain('<file path="test.ts" language="typescript">');
            expect(result).toContain("const x = 1;");
            expect(result).toContain("---");
            expect(result).toContain("export const x: number");
        });
    });

    describe("edge cases", () => {
        test("handles exports with no type gracefully", () => {
            const result: DistillationResult = {
                apis: [{
                    file: "test.ts",
                    imports: [],
                    exports: [{
                        name: "unknown",
                        // @ts-ignore - testing edge case
                        type: undefined,
                        signature: "export const unknown",
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
            
            const formatted = formatter.formatDistillation(result);
            expect(formatted).toContain("export const unknown");
        });

        test("handles malformed signatures gracefully", () => {
            const result: DistillationResult = {
                apis: [{
                    file: "test.ts",
                    imports: [],
                    exports: [{
                        name: "Test",
                        type: "class",
                        signature: "class Test extends", // Incomplete signature
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
            
            const formatted = formatter.formatDistillation(result);
            expect(formatted).toContain("export class Test");
        });
    });
});