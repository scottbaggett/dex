// @ts-expect-error - bun:test types not available in this environment
import { test, expect, describe } from "bun:test";
import { createExtractCommand } from "./index.js";

describe("extract command", () => {
    test("should create extract command with correct name and description", () => {
        const command = createExtractCommand();

        expect(command.name()).toBe("extract");
        expect(command.description()).toContain(
            "Extract git-aware change analysis",
        );
    });

    test("should expose expected core options", () => {
        const command = createExtractCommand();
        const options = command.options.map((option) => option.long);

        expect(options).toContain("--staged");
        expect(options).toContain("--all");
        expect(options).toContain("--path");
        expect(options).toContain("--type");
        expect(options).toContain("--format");
        expect(options).toContain("--clipboard");
        expect(options).toContain("--include-untracked");
        expect(options).toContain("--optimize");
        expect(options).toContain("--include-sensitive");
        expect(options).toContain("--target");
        expect(options).toContain("--yes");
        expect(options).toContain("--select");
    });

    test("should configure format option choices", () => {
        const command = createExtractCommand();
        const formatOption = command.options.find(
            (option) => option.long === "--format",
        );

        expect(formatOption).toBeDefined();
        expect(formatOption?.defaultValue).toBe("txt");
        expect(formatOption?.argChoices).toEqual(["txt", "md", "json"]);
    });

    test("should register optimize option as variadic", () => {
        const command = createExtractCommand();
        const optimizeOption = command.options.find(
            (option) => option.long === "--optimize",
        );

        expect(optimizeOption).toBeDefined();
        expect(optimizeOption?.variadic).toBe(true);
    });

    test("should configure target option choices", () => {
        const command = createExtractCommand();
        const targetOption = command.options.find(
            (option) => option.long === "--target",
        );

        expect(targetOption).toBeDefined();
        expect(targetOption?.argChoices).toEqual([
            "claude",
            "gpt",
            "local",
            "custom",
        ]);
    });

    test("should include sorting and filtering options", () => {
        const command = createExtractCommand();
        const options = command.options.map((option) => option.long);

        expect(options).toContain("--sort-by");
        expect(options).toContain("--sort-order");
        expect(options).toContain("--filter-by");
    });

    test("should create independent command instances", () => {
        const commandA = createExtractCommand();
        const commandB = createExtractCommand();

        expect(commandA).not.toBe(commandB);
        expect(commandA.options.length).toBe(commandB.options.length);
    });
});
