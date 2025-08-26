// TODO: Refactor 'depth' and implement proper flags from config.
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Distiller } from "./index.js";
import { DistillationResult, CompressionResult } from "../../types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Distiller integration tests", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), "distiller-test-"));

        // Create test file structure
        fs.writeFileSync(
            path.join(testDir, "index.ts"),
            `
export interface User {
    id: string;
    name: string;
    email?: string;
}

export class UserService {
    private users: Map<string, User> = new Map();

    public getUser(id: string): User | undefined {
        return this.users.get(id);
    }

    private validateUser(user: User): boolean {
        return !!user.id && !!user.name;
    }

    protected logAccess(id: string): void {
        console.log('Access:', id);
    }
}

export function createUser(name: string): User {
    return { id: Math.random().toString(), name };
}

export const DEFAULT_USER: User = { id: '0', name: 'Default' };

export type UserRole = 'admin' | 'user' | 'guest';

export enum UserStatus {
    Active = 'ACTIVE',
    Inactive = 'INACTIVE'
}

class InternalHelper {
    helper() {}
}
        `.trim(),
        );

        fs.writeFileSync(
            path.join(testDir, "utils.py"),
            `
def public_util():
    """A public utility function"""
    return True

def _private_util():
    """A private utility function"""
    return False

class UtilClass:
    def __init__(self):
        self.value = 0

    def public_method(self):
        return self.value

    def _private_method(self):
        return -1

MAX_RETRIES = 3
_INTERNAL_FLAG = False
        `.trim(),
        );

        // Create subdirectory
        fs.mkdirSync(path.join(testDir, "lib"));
        fs.writeFileSync(
            path.join(testDir, "lib", "helper.ts"),
            `
export function helperFunction(): void {
    console.log('helper');
}

export interface HelperConfig {
    enabled: boolean;
    timeout?: number;
}
        `.trim(),
        );

        // Create a file to be excluded
        fs.writeFileSync(
            path.join(testDir, "test.spec.ts"),
            `
describe('test', () => {
    it('should work', () => {
        expect(true).toBe(true);
    });
});
        `.trim(),
        );
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    function isDistillationResult(result: any): result is DistillationResult {
        return result && "apis" in result;
    }

    function isCompressionResult(result: any): result is CompressionResult {
        return result && "files" in result;
    }

    function isCombinedResult(
        result: any,
    ): result is {
        compression: CompressionResult;
        distillation: DistillationResult;
    } {
        return result && "compression" in result && "distillation" in result;
    }

    describe("basic distillation", () => {
        test("should distill all files with default options", async () => {
            const distiller = new Distiller({});
            const result = await distiller.distill(testDir);

            expect(result).toBeDefined();
            expect(isDistillationResult(result)).toBe(true);

            if (isDistillationResult(result)) {
                expect(result.apis).toBeDefined();
                expect(result.apis.length).toBeGreaterThan(0);

                // Should include exports from TypeScript files
                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                expect(tsFile).toBeDefined();
                expect(
                    tsFile?.exports.some((e) => e.name === "UserService"),
                ).toBe(true);
                expect(
                    tsFile?.exports.some((e) => e.name === "createUser"),
                ).toBe(true);

                // Should include exports from Python files
                const pyFile = result.apis.find((api) =>
                    api.file.includes("utils.py"),
                );
                expect(pyFile).toBeDefined();
                expect(
                    pyFile?.exports.some((e) => e.name === "public_util"),
                ).toBe(true);
                expect(
                    pyFile?.exports.some((e) => e.name === "UtilClass"),
                ).toBe(true);
            }
        });

        test("should respect includePrivate option", async () => {
            const distiller = new Distiller({ includePrivate: true });
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                const pyFile = result.apis.find((api) =>
                    api.file.includes("utils.py"),
                );
                expect(
                    pyFile?.exports.some((e) => e.name === "_private_util"),
                ).toBe(true);
                expect(
                    pyFile?.exports.some((e) => e.name === "_INTERNAL_FLAG"),
                ).toBe(true);

                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                const userService = tsFile?.exports.find(
                    (e) => e.name === "UserService",
                );
                expect(
                    userService?.members?.some(
                        (m) => m.name === "validateUser",
                    ),
                ).toBe(true);
            }
        });

        test("should respect depth option", async () => {
            // Test depth: public
            let distiller = new Distiller({ depth: "public" });
            let result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                const userService = tsFile?.exports.find(
                    (e) => e.name === "UserService",
                );
                expect(
                    userService?.members?.some((m) => m.name === "getUser"),
                ).toBe(true);
                expect(
                    userService?.members?.some((m) => m.name === "logAccess"),
                ).toBe(false);
                expect(
                    userService?.members?.some(
                        (m) => m.name === "validateUser",
                    ),
                ).toBe(false);
            }

            // Test depth: protected
            distiller = new Distiller({ depth: "protected" });
            result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                const userService = tsFile?.exports.find(
                    (e) => e.name === "UserService",
                );
                expect(
                    userService?.members?.some((m) => m.name === "getUser"),
                ).toBe(true);
                expect(
                    userService?.members?.some((m) => m.name === "logAccess"),
                ).toBe(true);
                expect(
                    userService?.members?.some(
                        (m) => m.name === "validateUser",
                    ),
                ).toBe(false);
            }

            // Test depth: all
            distiller = new Distiller({ depth: "all" });
            result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                const userService = tsFile?.exports.find(
                    (e) => e.name === "UserService",
                );
                expect(
                    userService?.members?.some((m) => m.name === "getUser"),
                ).toBe(true);
                expect(
                    userService?.members?.some((m) => m.name === "logAccess"),
                ).toBe(true);
                expect(
                    userService?.members?.some(
                        (m) => m.name === "validateUser",
                    ),
                ).toBe(true);
            }
        });
    });

    describe("file filtering", () => {
        test("should respect includePatterns", async () => {
            const distiller = new Distiller({
                includePatterns: ["**/*.ts"],
            });
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                expect(
                    result.apis.every((api) => api.file.endsWith(".ts")),
                ).toBe(true);
                expect(
                    result.apis.some((api) => api.file.endsWith(".py")),
                ).toBe(false);
            }
        });

        test("should respect excludePatterns", async () => {
            const distiller = new Distiller({
                excludePatterns: ["**/*.spec.ts", "**/lib/**"],
            });
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                expect(
                    result.apis.some((api) =>
                        api.file.includes("test.spec.ts"),
                    ),
                ).toBe(false);
                expect(
                    result.apis.some((api) =>
                        api.file.includes("lib/helper.ts"),
                    ),
                ).toBe(false);
                expect(
                    result.apis.some((api) => api.file.includes("index.ts")),
                ).toBe(true);
            }
        });

        test("should combine include and exclude patterns", async () => {
            const distiller = new Distiller({
                includePatterns: ["**/*.ts"],
                excludePatterns: ["**/lib/**"],
            });
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                expect(
                    result.apis.some((api) => api.file.includes("index.ts")),
                ).toBe(true);
                expect(
                    result.apis.some((api) =>
                        api.file.includes("lib/helper.ts"),
                    ),
                ).toBe(false);
                expect(
                    result.apis.some((api) => api.file.includes("utils.py")),
                ).toBe(false);
            }
        });
    });

    describe("name filtering", () => {
        test("should respect excludeNames pattern", async () => {
            const distiller = new Distiller({
                excludeNames: ["*Helper*", "DEFAULT_*"],
            });
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                expect(
                    tsFile?.exports.some((e) => e.name === "DEFAULT_USER"),
                ).toBe(false);
                expect(
                    tsFile?.exports.some((e) => e.name === "UserService"),
                ).toBe(true);

                // InternalHelper should not be exported anyway (not exported)
                expect(
                    tsFile?.exports.some((e) => e.name === "InternalHelper"),
                ).toBe(false);
            }
        });
    });

    describe("output formats", () => {
        test("should produce compressed format", async () => {
            const distiller = new Distiller({ format: "compressed" });
            const result = await distiller.distill(testDir);

            expect(result).toBeDefined();
            expect(isCompressionResult(result)).toBe(true);

            if (isCompressionResult(result)) {
                expect(result.files).toBeDefined();
                expect(result.files.length).toBeGreaterThan(0);
                // Check that index.ts is included with the correct content
                const indexFile = result.files.find((f) =>
                    f.path.includes("index.ts"),
                );
                expect(indexFile).toBeDefined();
                expect(indexFile?.content).toContain("export interface User");
            }
        });

        test("should produce distilled format", async () => {
            const distiller = new Distiller({ format: "distilled" });
            const result = await distiller.distill(testDir);

            expect(result).toBeDefined();
            expect(isDistillationResult(result)).toBe(true);

            if (isDistillationResult(result)) {
                expect(result.apis).toBeDefined();
                expect(result.structure).toBeDefined();
                expect(result.metadata).toBeDefined();
            }
        });

        test("should produce both formats", async () => {
            const distiller = new Distiller({ format: "both" });
            const result = await distiller.distill(testDir);

            expect(result).toBeDefined();
            expect(isCombinedResult(result)).toBe(true);

            if (isCombinedResult(result)) {
                expect(result.compression).toBeDefined();
                expect(result.distillation).toBeDefined();
                expect(result.compression.files).toBeDefined();
                expect(result.distillation.apis).toBeDefined();
            }
        });
    });

    describe("compact mode", () => {
        test("should produce compact output", async () => {
            const distiller = new Distiller({ compact: true });
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                const tsFile = result.apis.find((api) =>
                    api.file.includes("index.ts"),
                );
                const userService = tsFile?.exports.find(
                    (e) => e.name === "UserService",
                );

                // In compact mode, members might be omitted or simplified
                // The exact behavior depends on implementation
                expect(userService).toBeDefined();
            }
        });
    });

    describe("metadata", () => {
        test("should include metadata", async () => {
            const distiller = new Distiller({});
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                expect(result.metadata).toBeDefined();
                expect(result.metadata.originalTokens).toBeGreaterThan(0);
                expect(result.metadata.distilledTokens).toBeGreaterThan(0);
                expect(result.metadata.compressionRatio).toBeGreaterThan(0);
                expect(result.metadata.compressionRatio).toBeLessThan(1);
            }
        });

        test("should track skipped items", async () => {
            const distiller = new Distiller({
                includePrivate: false,
                excludeNames: ["DEFAULT_*"],
            });
            const result = await distiller.distill(testDir);

            // Check if skipped items are tracked in metadata
            // This depends on implementation details
            expect(result).toBeDefined();
            if (isDistillationResult(result)) {
                expect(result.metadata).toBeDefined();
            }
        });
    });

    describe("structure information", () => {
        test("should include structure data", async () => {
            const distiller = new Distiller({});
            const result = await distiller.distill(testDir);

            if (isDistillationResult(result)) {
                expect(result.structure).toBeDefined();
                expect(result.structure.fileCount).toBeGreaterThan(0);
                expect(result.structure.languages).toBeDefined();
                expect(
                    result.structure.languages["typescript"],
                ).toBeGreaterThan(0);
                expect(result.structure.languages["python"]).toBeGreaterThan(0);
                expect(result.structure.directories).toContain("lib");
            }
        });
    });

    describe("formatResult method", () => {
        test("should format distillation result", async () => {
            const distiller = new Distiller({});
            const result = await distiller.distill(testDir);
            const formatted = distiller.formatResult(result, testDir);

            expect(formatted).toContain("UserService");
            expect(formatted).toContain("export");
        });

        test("should format compression result", async () => {
            const distiller = new Distiller({ format: "compressed" });
            const result = await distiller.distill(testDir);
            const formatted = distiller.formatResult(result, testDir);

            expect(formatted).toContain("<file");
            expect(formatted).toContain("</file>");
        });

        test("should format both results", async () => {
            const distiller = new Distiller({ format: "both" });
            const result = await distiller.distill(testDir);
            const formatted = distiller.formatResult(result, testDir);

            expect(formatted).toContain("---"); // Separator
            expect(formatted).toContain("<file"); // Compression part
            expect(formatted).toContain("export"); // Distillation part
        });
    });

    describe("error handling", () => {
        test("should handle non-existent directory", async () => {
            const distiller = new Distiller({});
            await expect(
                distiller.distill("/non/existent/path"),
            ).rejects.toThrow();
        });

        test("should handle empty directory", async () => {
            const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-"));
            const distiller = new Distiller({});
            const result = await distiller.distill(emptyDir);

            if (isDistillationResult(result)) {
                expect(result.apis).toHaveLength(0);
            }
            fs.rmSync(emptyDir, { recursive: true });
        });

        test("should handle malformed files gracefully", async () => {
            fs.writeFileSync(
                path.join(testDir, "broken.ts"),
                "export class { broken syntax",
            );

            const distiller = new Distiller({});
            const result = await distiller.distill(testDir);

            // Should still process other files
            if (isDistillationResult(result)) {
                expect(result.apis.length).toBeGreaterThan(0);

                // Broken file might be skipped or parsed partially
                const brokenFile = result.apis.find((api) =>
                    api.file.includes("broken.ts"),
                );
                // Behavior depends on parser implementation
            }
        });
    });
});
