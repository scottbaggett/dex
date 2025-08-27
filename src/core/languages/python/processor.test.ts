import { test, expect, describe, beforeEach } from "bun:test";
import { PythonProcessor } from "./processor.js";
import { ProcessingOptions } from "../types.js";

describe("PythonProcessor", () => {
    let processor: PythonProcessor;

    beforeEach(async () => {
        processor = new PythonProcessor();
        await processor.initialize();
    });

    test("should initialize processor", async () => {
        expect(processor).toBeDefined();
    });

    describe("with default options", () => {
        test("should extract public classes and functions", async () => {
            const source = `
class PublicClass:
    def __init__(self):
        pass

class _PrivateClass:
    def method(self):
        pass

def public_function():
    pass

def _private_function():
    pass
`;

            const result = await processor.process(source, "test.py", {});

            // Debug: log what was actually found
            const exportNames = result.exports.map((e) => e.name);

            expect(result.exports).toHaveLength(2);
            expect(exportNames).toContain("PublicClass");
            expect(exportNames).toContain("public_function");
            expect(exportNames).not.toContain("_PrivateClass");
            expect(exportNames).not.toContain("_private_function");
        });

        test("should not include private members by default", async () => {
            const source = `
class TestClass:
    def __init__(self):
        self.public_prop = 1
        self._private_prop = 2

    def public_method(self):
        pass

    def _private_method(self):
        pass

    def __special_method__(self):
        pass
`;

            const result = await processor.process(source, "test.py", {});

            expect(result.exports).toHaveLength(1);
            const classExport = result.exports[0];
            expect(classExport.name).toBe("TestClass");

            // Should include __init__ and public_method, but not _private_method
            if (classExport.members) {
                const memberNames = classExport.members.map((m) => m.name);
                expect(memberNames).toContain("__init__");
                expect(memberNames).toContain("public_method");
                expect(memberNames).toContain("__special_method__");
                expect(memberNames).not.toContain("_private_method");
            }
        });
    });

    describe("with includePrivate option", () => {
        test("should include private members when requested", async () => {
            const source = `
class TestClass:
    def public_method(self):
        pass

    def _private_method(self):
        pass

def _private_function():
    pass
`;

            const options: ProcessingOptions = {
                private: true,
            };

            const result = await processor.process(source, "test.py", options);

            const classExport = result.exports.find(
                (e) => e.name === "TestClass",
            );
            if (classExport?.members) {
                const memberNames = classExport.members.map((m) => m.name);
                expect(memberNames).toContain("public_method");
                expect(memberNames).toContain("_private_method");
            }

            // Should also include private function
            const functionNames = result.exports.map((e) => e.name);
            expect(functionNames).toContain("_private_function");
        });
    });

    describe("with pattern filtering", () => {
        test("should respect include", async () => {
            const source = `
class UserModel:
    pass

class AdminModel:
    pass

def get_user_data():
    pass

def set_user_data():
    pass

def delete_admin():
    pass
`;

            const options: ProcessingOptions = {
                include: ["User*", "get_*"],
            };

            const result = await processor.process(source, "test.py", options);

            const names = result.exports.map((e) => e.name);
            expect(names).toContain("UserModel");
            expect(names).toContain("get_user_data");
            expect(names).not.toContain("AdminModel");
            expect(names).not.toContain("set_user_data");
            expect(names).not.toContain("delete_admin");
        });

        test("should respect exclude", async () => {
            const source = `
class UserModel:
    pass

class AdminModel:
    pass

def get_user_data():
    pass

def get_admin_data():
    pass

TEST_CONSTANT = 123
`;

            const options: ProcessingOptions = {
                exclude: ["*admin*", "*Admin*", "TEST_*"],
            };

            const result = await processor.process(source, "test.py", options);

            const names = result.exports.map((e) => e.name);
            expect(names).toContain("UserModel");
            expect(names).toContain("get_user_data");
            expect(names).not.toContain("AdminModel");
            expect(names).not.toContain("get_admin_data");
            expect(names).not.toContain("TEST_CONSTANT");
        });
    });

    describe("with import options", () => {
        test("should include imports by default", async () => {
            const source = `
import os
import sys
from typing import List, Dict
from pathlib import Path
import numpy as np

class MyClass:
    pass
`;

            const result = await processor.process(source, "test.py", {});

            expect(result.imports.length).toBeGreaterThanOrEqual(4);
            const sources = result.imports.map((i) => i.source);
            expect(sources).toContain("os");
            expect(sources).toContain("sys");
            expect(sources).toContain("typing");
            expect(sources).toContain("pathlib");
        });
    });

    describe("with metadata tracking", () => {
        test("should track skipped items", async () => {
            const source = `
class PublicClass:
    pass

class _PrivateClass:
    pass

def _private_function():
    pass

def public_function():
    pass
`;

            const options: ProcessingOptions = {
                private: false,
            };

            const result = await processor.process(source, "test.py", options);

            expect(result.metadata?.skipped).toBeDefined();
            if (result.metadata?.skipped) {
                const skippedNames = result.metadata.skipped.map((s) => s.name);
                expect(skippedNames).toContain("_PrivateClass");
                expect(skippedNames).toContain("_private_function");
            }
        });
    });

    describe("Python-specific features", () => {
        test("should handle async functions", async () => {
            const source = `
async def async_function():
    pass

class MyClass:
    async def async_method(self):
        pass
`;

            const result = await processor.process(source, "test.py", {});

            const asyncFunc = result.exports.find(
                (e) => e.name === "async_function",
            );
            expect(asyncFunc?.signature).toContain("async def");

            const classExport = result.exports.find(
                (e) => e.name === "MyClass",
            );
            const asyncMethod = classExport?.members?.find(
                (m) => m.name === "async_method",
            );
            expect(asyncMethod?.signature).toContain("async def");
        });

        test("should handle class inheritance", async () => {
            const source = `
class DerivedClass(BaseClass, Mixin1, Mixin2):
    pass
`;

            const result = await processor.process(source, "test.py", {});

            const classExport = result.exports[0];
            expect(classExport.signature).toContain("BaseClass");
            expect(classExport.signature).toContain("Mixin1");
            expect(classExport.signature).toContain("Mixin2");
        });

        test("should detect constants", async () => {
            const source = `
MAX_SIZE = 1000
MIN_SIZE = 10
DEFAULT_CONFIG = {"key": "value"}

regular_variable = 123  # Should not be detected as constant
`;

            const result = await processor.process(source, "test.py", {});

            const constants = result.exports.filter((e) => e.kind === "const");
            const constantNames = constants.map((c) => c.name);

            expect(constantNames).toContain("MAX_SIZE");
            expect(constantNames).toContain("MIN_SIZE");
            expect(constantNames).toContain("DEFAULT_CONFIG");
            expect(constantNames).not.toContain("regular_variable");
        });

        test("should handle nested classes", async () => {
            const source = `
class OuterClass:
    def outer_method(self):
        pass

    class InnerClass:
        def inner_method(self):
            pass

def top_level_function():
    pass
`;

            const result = await processor.process(source, "test.py", {});

            // Should detect OuterClass with its method
            const outerClass = result.exports.find(
                (e) => e.name === "OuterClass",
            );
            expect(outerClass).toBeDefined();
            if (outerClass?.members) {
                const memberNames = outerClass.members.map((m) => m.name);
                expect(memberNames).toContain("outer_method");
            }

            // Should also detect top-level function
            const topFunc = result.exports.find(
                (e) => e.name === "top_level_function",
            );
            expect(topFunc).toBeDefined();
        });

        test("should handle special methods correctly", async () => {
            const source = `
class MyClass:
    def __init__(self):
        pass

    def __str__(self):
        pass

    def __repr__(self):
        pass

    def _private_method(self):
        pass
`;

            const result = await processor.process(source, "test.py", {});

            const classExport = result.exports[0];
            if (classExport.members) {
                const memberNames = classExport.members.map((m) => m.name);

                // Special methods should be included even though they start with __
                expect(memberNames).toContain("__init__");
                expect(memberNames).toContain("__str__");
                expect(memberNames).toContain("__repr__");

                // Private method should not be included by default
                expect(memberNames).not.toContain("_private_method");
            }
        });
    });

    describe("import parsing", () => {
        test("should parse various import styles", async () => {
            const source = `
import os
import sys as system
from typing import List, Dict, Optional
from pathlib import Path as PathLib
from . import local_module
from ..parent import something
import package.submodule
`;

            const result = await processor.process(source, "test.py", {});

            const sources = result.imports.map((i) => i.source);
            expect(sources).toContain("os");
            expect(sources).toContain("sys");
            expect(sources).toContain("typing");
            expect(sources).toContain("pathlib");
            expect(sources).toContain(".");
            expect(sources).toContain("..parent");
            expect(sources).toContain("package.submodule");
        });
    });
});
