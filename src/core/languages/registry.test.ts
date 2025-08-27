import { test, expect, describe, beforeEach } from "bun:test";
import { LanguageRegistry } from "./registry.js";
import { TypeScriptModule } from "./typescript/index.js";
import { PythonModule } from "./python/index.js";

describe("LanguageRegistry", () => {
    let registry: LanguageRegistry;

    beforeEach(() => {
        registry = new LanguageRegistry();
    });

    test("should register language modules", () => {
        const tsModule = new TypeScriptModule();
        const pyModule = new PythonModule();

        registry.register(tsModule);
        registry.register(pyModule);

        expect(registry.getAllLanguages()).toHaveLength(2);
        expect(registry.getLanguageByName("typescript")).toBe(tsModule);
        expect(registry.getLanguageByName("python")).toBe(pyModule);
    });

    test("should map file extensions to languages", () => {
        registry.register(new TypeScriptModule());
        registry.register(new PythonModule());

        expect(registry.getLanguageForFile("test.ts")).not.toBeNull();
        expect(registry.getLanguageForFile("test.tsx")).not.toBeNull();
        expect(registry.getLanguageForFile("test.js")).not.toBeNull();
        expect(registry.getLanguageForFile("test.py")).not.toBeNull();
        expect(registry.getLanguageForFile("test.rb")).toBeNull();
    });

    test("should check if file is supported", () => {
        registry.register(new TypeScriptModule());
        registry.register(new PythonModule());

        expect(registry.isFileSupported("test.ts")).toBe(true);
        expect(registry.isFileSupported("test.py")).toBe(true);
        expect(registry.isFileSupported("test.rb")).toBe(false);
    });

    test("should process TypeScript file", async () => {
        registry.register(new TypeScriptModule());

        const source = `
            export class TestClass {
                publicMethod() {}
                private privateMethod() {}
            }
            
            export function testFunction() {}
        `;

        const result = await registry.processFile("test.ts", source, {});

        expect(result.exports).toHaveLength(2);
        expect(result.exports[0].name).toBe("TestClass");
        expect(result.exports[1].name).toBe("testFunction");
    });

    test("should process Python file", async () => {
        registry.register(new PythonModule());

        const source = `
class TestClass:
    def public_method(self):
        pass
    
    def _private_method(self):
        pass

def test_function():
    pass
`;

        const result = await registry.processFile("test.py", source, {});

        expect(result.exports).toHaveLength(2);
        const exportNames = result.exports.map((e) => e.name);
        expect(exportNames).toContain("TestClass");
        expect(exportNames).toContain("test_function");
    });

    test("should respect processing options", async () => {
        registry.register(new TypeScriptModule());

        const source = `
            export class TestClass {
                publicMethod() {}
                private privateMethod() {}
            }
        `;

        // Without includePrivate
        const result1 = await registry.processFile("test.ts", source, {
            includePrivate: false,
        });

        const classExport1 = result1.exports[0];
        if (classExport1.members) {
            expect(classExport1.members.map((m) => m.name)).not.toContain(
                "privateMethod",
            );
        }

        // With includePrivate
        const result2 = await registry.processFile("test.ts", source, {
            includePrivate: true,
        });

        const classExport2 = result2.exports[0];
        if (classExport2.members) {
            expect(classExport2.members.map((m) => m.name)).toContain(
                "privateMethod",
            );
        }
    });

    test("should unregister language modules", () => {
        const tsModule = new TypeScriptModule();

        registry.register(tsModule);
        expect(registry.getAllLanguages()).toHaveLength(1);

        registry.unregister("typescript");
        expect(registry.getAllLanguages()).toHaveLength(0);
        expect(registry.getLanguageByName("typescript")).toBeNull();
    });
});
