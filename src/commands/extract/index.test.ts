// @ts-expect-error - bun:test types not available in this environment
import { test, expect, describe } from "bun:test";
import { createExtractCommand } from "./index.js";
import { Command } from "commander";

describe("extract command", () => {
    test("should create extract command with correct name and description", () => {
        const command = createExtractCommand();

        expect(command.name()).toBe("extract");
        expect(command.description()).toContain(
            "Extract git-aware change analysis",
        );
    });

    test("should accept range argument", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        // This should not throw when parsing with a range argument
        expect(() => {
            program.parse(["extract", "HEAD~1..HEAD"]);
        }).not.toThrow();
    });

    test("should have all required options", () => {
        const command = createExtractCommand();

        // Test that key options exist by trying to parse them
        const program = new Command();
        program.addCommand(command);

        // This should not throw for valid options
        expect(() => {
            program.parse(["extract", "--help"]);
        }).not.toThrow();
    });

    test("should validate format options", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        // Test valid formats
        expect(() => {
            program.parse(["extract", "--format", "txt"]);
        }).not.toThrow();

        expect(() => {
            program.parse(["extract", "--format", "json"]);
        }).not.toThrow();

        expect(() => {
            program.parse(["extract", "--format", "markdown"]);
        }).not.toThrow();
    });

    test("should handle optimize flags parsing", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        // Test optimize flags
        expect(() => {
            program.parse(["extract", "--optimize", "aid", "symbols"]);
        }).not.toThrow();
    });

    test("should handle sort and filter options", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        // Test sort options
        expect(() => {
            program.parse([
                "extract",
                "--sort-by",
                "name",
                "--sort-order",
                "asc",
            ]);
        }).not.toThrow();

        expect(() => {
            program.parse(["extract", "--filter-by", "staged"]);
        }).not.toThrow();
    });

    test("should handle boolean flags", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        // Test boolean flags
        expect(() => {
            program.parse([
                "extract",
                "--staged",
                "--all",
                "--clipboard",
                "--no-metadata",
            ]);
        }).not.toThrow();
    });

    test("should handle interactive selection flag", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        expect(() => {
            program.parse(["extract", "--select"]);
        }).not.toThrow();
    });

    test("should handle path and type filters", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        expect(() => {
            program.parse([
                "extract",
                "--path",
                "*.ts",
                "--type",
                "typescript,javascript",
            ]);
        }).not.toThrow();
    });

    test("should handle untracked files options", () => {
        const command = createExtractCommand();
        const program = new Command();
        program.addCommand(command);

        expect(() => {
            program.parse([
                "extract",
                "--include-untracked",
                "--untracked-pattern",
                "*.test.ts",
            ]);
        }).not.toThrow();
    });
});
