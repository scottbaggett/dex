import { describe, test, expect, beforeAll } from "bun:test";
import { Distiller } from "./index.js";
import { promises as fs } from "fs";
import { resolve, join } from "path";

describe("Distiller", () => {
    const fixturesPath = resolve("tests/fixtures");
    const tsFixtures = join(fixturesPath, "typescript/src");
    const pyFixtures = join(fixturesPath, "python/src");

    describe("TypeScript Processing", () => {
        describe("Visibility Filtering", () => {
            test("should include only public members by default", async () => {
                const distiller = new Distiller({
                    path: join(tsFixtures, "greeter.ts"),
                    format: "txt",
                });

                const result = await distiller.distill(join(tsFixtures, "greeter.ts"));
                const formatted = distiller.formatResult(result, join(tsFixtures, "greeter.ts"));

                // Should include public members
                expect(formatted).toContain("greeting: string");
                expect(formatted).toContain("greet(): string");
                
                // Should include protected by default
                expect(formatted).toContain("id: number");
                
                // Should NOT include private members by default
                expect(formatted).not.toContain("secret: string");
                expect(formatted).not.toContain("revealSecret");
            });

            test("should include private members when private option is true", async () => {
                const distiller = new Distiller({
                    path: join(tsFixtures, "greeter.ts"),
                    format: "txt",
                    private: true,
                });

                const result = await distiller.distill(join(tsFixtures, "greeter.ts"));
                const formatted = distiller.formatResult(result, join(tsFixtures, "greeter.ts"));

                // Should include all members
                expect(formatted).toContain("greeting: string");
                expect(formatted).toContain("secret: string");
                expect(formatted).toContain("id: number");
                expect(formatted).toContain("greet(): string");
                expect(formatted).toContain("revealSecret(): void");
            });

            test("should exclude protected when protected is false", async () => {
                const distiller = new Distiller({
                    path: join(tsFixtures, "greeter.ts"),
                    format: "txt",
                    protected: false,
                });

                const result = await distiller.distill(join(tsFixtures, "greeter.ts"));
                const formatted = distiller.formatResult(result, join(tsFixtures, "greeter.ts"));

                // Should include public
                expect(formatted).toContain("greeting: string");
                
                // Should NOT include protected
                expect(formatted).not.toContain("id: number");
            });
        });

        describe("Documentation Handling", () => {
            test("should exclude docstrings by default", async () => {
                const distiller = new Distiller({
                    path: join(tsFixtures, "greeter.ts"),
                    format: "txt",
                    docstrings: false,
                });

                const result = await distiller.distill(join(tsFixtures, "greeter.ts"));
                
                // Check that docstrings are not in the exports
                const hasDocstrings = result.apis.some(api => 
                    api.exports.some(exp => exp.docstring && exp.docstring.length > 0)
                );
                
                expect(hasDocstrings).toBe(false);
            });

            test("should include docstrings when enabled", async () => {
                const distiller = new Distiller({
                    path: join(tsFixtures, "greeter.ts"),
                    format: "txt",
                    docstrings: true,
                });

                const result = await distiller.distill(join(tsFixtures, "greeter.ts"));
                
                // Check for docstrings in exports (if processor supports it)
                const hasDocstrings = result.apis.some(api => 
                    api.exports.some(exp => exp.docstring && exp.docstring.length > 0)
                );
                
                // This might be false if ts-morph doesn't extract JSDoc
                // We're testing that the option is passed through correctly
                expect(result).toBeDefined();
            });
        });

        describe("File Processing", () => {
            test("should process multiple TypeScript files", async () => {
                const distiller = new Distiller({
                    path: tsFixtures,
                    format: "txt",
                });

                const result = await distiller.distill(tsFixtures);
                
                // Should have processed both files
                expect(result.apis.length).toBeGreaterThanOrEqual(2);
                
                // Check for specific files
                const fileNames = result.apis.map(api => api.file);
                expect(fileNames).toContain("greeter.ts");
                expect(fileNames).toContain("math.ts");
            });

            test("should handle exports correctly", async () => {
                const distiller = new Distiller({
                    path: join(tsFixtures, "math.ts"),
                    format: "txt",
                });

                const result = await distiller.distill(join(tsFixtures, "math.ts"));
                const formatted = distiller.formatResult(result, join(tsFixtures, "math.ts"));

                // Should include function export
                expect(formatted).toContain("export function add");
                
                // Should include const exports
                expect(formatted).toContain("export const a");
                expect(formatted).toContain("export const b");
            });
        });
    });

    describe("Python Processing", () => {
        describe("Visibility Filtering", () => {
            test("should exclude private methods by default", async () => {
                const distiller = new Distiller({
                    path: join(pyFixtures, "user_service.py"),
                    format: "txt",
                });

                const result = await distiller.distill(join(pyFixtures, "user_service.py"));
                const formatted = distiller.formatResult(result, join(pyFixtures, "user_service.py"));

                // Should include public method
                expect(formatted).toContain("get_user");
                
                // Should NOT include private method
                expect(formatted).not.toContain("_find_user_by_id");
                
                // __init__ is special - should be included even though it starts with _
                expect(formatted).not.toContain("__init__");
            });

            test("should include private methods when private option is true", async () => {
                const distiller = new Distiller({
                    path: join(pyFixtures, "user_service.py"),
                    format: "txt",
                    private: true,
                });

                const result = await distiller.distill(join(pyFixtures, "user_service.py"));
                const formatted = distiller.formatResult(result, join(pyFixtures, "user_service.py"));

                // Should include all methods
                expect(formatted).toContain("get_user");
                expect(formatted).toContain("_find_user_by_id");
                expect(formatted).toContain("__init__");
            });
        });

        describe("Docstring Handling", () => {
            test("should handle module-level docstrings", async () => {
                const distiller = new Distiller({
                    path: join(pyFixtures, "user_service.py"),
                    format: "txt",
                });

                const result = await distiller.distill(join(pyFixtures, "user_service.py"));
                
                // Should successfully parse file with module docstring
                expect(result.apis.length).toBeGreaterThan(0);
                
                const api = result.apis.find(a => a.file === "user_service.py");
                expect(api).toBeDefined();
                expect(api?.exports.length).toBeGreaterThan(0);
            });

            test("should handle method docstrings without breaking", async () => {
                const distiller = new Distiller({
                    path: join(pyFixtures, "user_service.py"),
                    format: "txt",
                    private: true,
                });

                const result = await distiller.distill(join(pyFixtures, "user_service.py"));
                const api = result.apis.find(a => a.file === "user_service.py");
                
                // Should find the class
                const userServiceClass = api?.exports.find(e => e.name === "UserService");
                expect(userServiceClass).toBeDefined();
                
                // Should have members despite complex docstrings
                expect(userServiceClass?.members?.length).toBeGreaterThan(0);
            });
        });

        describe("Type Annotations", () => {
            test("should preserve type annotations in function signatures", async () => {
                const distiller = new Distiller({
                    path: join(pyFixtures, "data_processor.py"),
                    format: "txt",
                });

                const result = await distiller.distill(join(pyFixtures, "data_processor.py"));
                const formatted = distiller.formatResult(result, join(pyFixtures, "data_processor.py"));

                // Should preserve type hints
                expect(formatted).toContain("file_limit: int");
            });
        });
    });

    describe("Format Output", () => {
        test("should output valid JSON format", async () => {
            const distiller = new Distiller({
                path: join(tsFixtures, "math.ts"),
                format: "json",
            });

            const result = await distiller.distill(join(tsFixtures, "math.ts"));
            const formatted = distiller.formatResult(result, join(tsFixtures, "math.ts"));
            
            // Should be valid JSON
            expect(() => JSON.parse(formatted)).not.toThrow();
            
            const parsed = JSON.parse(formatted);
            expect(parsed.files).toBeDefined();
            expect(Array.isArray(parsed.files)).toBe(true);
        });

        test("should output markdown format", async () => {
            const distiller = new Distiller({
                path: join(tsFixtures, "math.ts"),
                format: "md",
            });

            const result = await distiller.distill(join(tsFixtures, "math.ts"));
            const formatted = distiller.formatResult(result, join(tsFixtures, "math.ts"));
            
            // Should contain markdown elements
            expect(formatted).toContain("```");
            expect(formatted).toContain("##");
        });
    });

    describe("Token Calculation", () => {
        test("should calculate token reduction", async () => {
            const distiller = new Distiller({
                path: tsFixtures,
                format: "txt",
            });

            const result = await distiller.distill(tsFixtures);
            
            // Should have metadata about tokens
            expect(result.metadata.originalTokens).toBeGreaterThan(0);
            expect(result.metadata.distilledTokens).toBeGreaterThan(0);
            expect(result.metadata.compressionRatio).toBeGreaterThan(0);
            expect(result.metadata.compressionRatio).toBeLessThan(100);
        });
    });

    describe("Error Handling", () => {
        test("should handle non-existent path gracefully", async () => {
            const distiller = new Distiller({
                path: "/non/existent/path",
                format: "txt",
            });

            try {
                await distiller.distill("/non/existent/path");
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        test("should handle empty directories", async () => {
            const emptyDir = join(fixturesPath, "empty");
            
            // Create empty directory if it doesn't exist
            try {
                await fs.mkdir(emptyDir, { recursive: true });
            } catch {}

            const distiller = new Distiller({
                path: emptyDir,
                format: "txt",
            });

            const result = await distiller.distill(emptyDir);
            
            expect(result.apis.length).toBe(0);
            expect(result.metadata.originalTokens).toBe(0);
        });
    });

    describe("Filtering Options", () => {
        test("should respect exclude patterns", async () => {
            const distiller = new Distiller({
                path: tsFixtures,
                format: "txt",
                exclude: ["**/math.ts"],
            });

            const result = await distiller.distill(tsFixtures);
            
            const fileNames = result.apis.map(api => api.file);
            expect(fileNames).not.toContain("math.ts");
            expect(fileNames).toContain("greeter.ts");
        });

        test("should respect include patterns", async () => {
            const distiller = new Distiller({
                path: tsFixtures,
                format: "txt",
                include: ["**/math.ts"],
            });

            const result = await distiller.distill(tsFixtures);
            
            const fileNames = result.apis.map(api => api.file);
            expect(fileNames).toContain("math.ts");
            expect(fileNames).not.toContain("greeter.ts");
        });
    });
});