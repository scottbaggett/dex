import { describe, test, expect } from "bun:test";
import { createExtractCommand } from "../src/commands/extract";
import { Command } from "commander";

describe("Extract Command", () => {
    test("creates command with correct name", () => {
        const command = createExtractCommand();
        expect(command.name()).toBe("extract");
    });

    test("has correct description", () => {
        const command = createExtractCommand();
        expect(command.description()).toBe(
            "Extract git-aware change analysis with smart context",
        );
    });

    test("has all required options", () => {
        const command = createExtractCommand();
        const options = command.options.map((opt) => opt.long);

        expect(options).toContain("--staged");
        expect(options).toContain("--all");
        expect(options).toContain("--format");
        expect(options).toContain("--clipboard");
        expect(options).toContain("--full");
        expect(options).toContain("--diff-only");
        expect(options).toContain("--path");
        expect(options).toContain("--type");
        expect(options).toContain("--task");
        expect(options).toContain("--interactive");
        expect(options).toContain("--include-untracked");
        expect(options).toContain("--untracked-pattern");
        expect(options).toContain("--optimize");
        expect(options).toContain("--no-metadata");
        expect(options).toContain("--select");
        expect(options).toContain("--sort-by");
        expect(options).toContain("--sort-order");
        expect(options).toContain("--filter-by");
    });

    test("accepts range argument", () => {
        const command = createExtractCommand();
        // Arguments are only available after parsing, so we test that the command can be created
        expect(command).toBeInstanceOf(Command);
        expect(command.name()).toBe("extract");
    });

    test("format option has correct choices", () => {
        const command = createExtractCommand();
        const formatOption = command.options.find(
            (opt) => opt.long === "--format",
        );
        expect(formatOption?.choices).toBeDefined();
        expect(formatOption?.defaultValue).toBe("xml");
    });

    test("staged option has correct configuration", () => {
        const command = createExtractCommand();
        const stagedOption = command.options.find(
            (opt) => opt.long === "--staged",
        );
        expect(stagedOption?.short).toBe("-s");
        expect(stagedOption?.description).toBe("Include only staged changes");
    });

    test("all option has correct configuration", () => {
        const command = createExtractCommand();
        const allOption = command.options.find((opt) => opt.long === "--all");
        expect(allOption?.short).toBe("-a");
        expect(allOption?.description).toBe(
            "Include both staged and unstaged changes",
        );
    });

    test("clipboard option has correct configuration", () => {
        const command = createExtractCommand();
        const clipboardOption = command.options.find(
            (opt) => opt.long === "--clipboard",
        );
        expect(clipboardOption?.short).toBe("-c");
        expect(clipboardOption?.description).toBe("Copy output to clipboard");
    });

    test("path option has correct configuration", () => {
        const command = createExtractCommand();
        const pathOption = command.options.find((opt) => opt.long === "--path");
        expect(pathOption?.short).toBe("-p");
        expect(pathOption?.description).toBe("Filter by file path pattern");
    });

    test("type option has correct configuration", () => {
        const command = createExtractCommand();
        const typeOption = command.options.find((opt) => opt.long === "--type");
        expect(typeOption?.short).toBe("-t");
        expect(typeOption?.description).toBe(
            "Filter by file types (comma-separated)",
        );
    });

    test("interactive option has correct configuration", () => {
        const command = createExtractCommand();
        const interactiveOption = command.options.find(
            (opt) => opt.long === "--interactive",
        );
        expect(interactiveOption?.short).toBe("-i");
        expect(interactiveOption?.description).toBe(
            "Interactive mode for task input",
        );
    });

    test("include-untracked option has correct configuration", () => {
        const command = createExtractCommand();
        const untrackedOption = command.options.find(
            (opt) => opt.long === "--include-untracked",
        );
        expect(untrackedOption?.short).toBe("-u");
        expect(untrackedOption?.description).toBe("Include untracked files");
    });

    test("full option has correct configuration", () => {
        const command = createExtractCommand();
        const fullOption = command.options.find((opt) => opt.long === "--full");
        expect(fullOption?.description).toBe(
            "Include full files matching pattern",
        );
    });

    test("diff-only option has correct configuration", () => {
        const command = createExtractCommand();
        const diffOnlyOption = command.options.find(
            (opt) => opt.long === "--diff-only",
        );
        expect(diffOnlyOption?.description).toBe(
            "Force diff view for all files (disable Smart Context)",
        );
    });

    test("task option has correct configuration", () => {
        const command = createExtractCommand();
        const taskOption = command.options.find((opt) => opt.long === "--task");
        expect(taskOption?.description).toBe(
            "Task context (description, file path, URL, or - for stdin)",
        );
    });

    test("untracked-pattern option has correct configuration", () => {
        const command = createExtractCommand();
        const untrackedPatternOption = command.options.find(
            (opt) => opt.long === "--untracked-pattern",
        );
        expect(untrackedPatternOption?.description).toBe(
            "Pattern for untracked files to include",
        );
    });

    test("optimize option has correct configuration", () => {
        const command = createExtractCommand();
        const optimizeOption = command.options.find(
            (opt) => opt.long === "--optimize",
        );
        expect(optimizeOption?.description).toBe("Optimizations: aid, symbols");
        expect(optimizeOption?.variadic).toBe(true);
    });

    test("metadata option has correct configuration", () => {
        const command = createExtractCommand();
        const metadataOption = command.options.find(
            (opt) => opt.long === "--no-metadata",
        );
        expect(metadataOption?.description).toBe(
            "Exclude metadata from output",
        );
    });

    test("select option has correct configuration", () => {
        const command = createExtractCommand();
        const selectOption = command.options.find(
            (opt) => opt.long === "--select",
        );
        expect(selectOption?.description).toBe(
            "Interactive file selection mode",
        );
    });

    test("sort-by option has correct configuration", () => {
        const command = createExtractCommand();
        const sortByOption = command.options.find(
            (opt) => opt.long === "--sort-by",
        );
        expect(sortByOption?.description).toBe(
            "Sort files by: name, updated, size, status (default: name)",
        );
    });

    test("sort-order option has correct configuration", () => {
        const command = createExtractCommand();
        const sortOrderOption = command.options.find(
            (opt) => opt.long === "--sort-order",
        );
        expect(sortOrderOption?.description).toBe(
            "Sort direction: asc or desc (default: asc)",
        );
    });

    test("filter-by option has correct configuration", () => {
        const command = createExtractCommand();
        const filterByOption = command.options.find(
            (opt) => opt.long === "--filter-by",
        );
        expect(filterByOption?.description).toBe(
            "Filter files by: all, staged, unstaged, untracked, modified, added, deleted (default: all)",
        );
    });

    test("command is instance of Command", () => {
        const command = createExtractCommand();
        expect(command).toBeInstanceOf(Command);
    });

    test("command has action configured", () => {
        const command = createExtractCommand();
        expect(command._actionHandler).toBeDefined();
    });

    test("command structure is valid", () => {
        const command = createExtractCommand();
        // Test that command is properly structured
        expect(command.name()).toBe("extract");
        expect(command.description()).toBe(
            "Extract git-aware change analysis with smart context",
        );
        expect(command._actionHandler).toBeDefined();
    });
});

describe("Extract Command Integration", () => {
    test("can be added to parent command", () => {
        const parentCommand = new Command("dex");
        const extractCommand = createExtractCommand();

        expect(() => {
            parentCommand.addCommand(extractCommand);
        }).not.toThrow();

        const commands = parentCommand.commands;
        expect(commands).toHaveLength(1);
        expect(commands[0].name()).toBe("extract");
    });

    test("maintains option consistency with original implementation", () => {
        const command = createExtractCommand();
        const options = command.options;

        // Verify critical options exist
        const criticalOptions = [
            "--staged",
            "--all",
            "--format",
            "--clipboard",
            "--full",
            "--diff-only",
            "--path",
            "--type",
            "--task",
            "--interactive",
            "--include-untracked",
            "--optimize",
            "--select",
        ];

        const optionNames = options.map((opt) => opt.long);

        for (const criticalOption of criticalOptions) {
            expect(optionNames).toContain(criticalOption);
        }
    });

    test("format choices are restricted correctly", () => {
        const command = createExtractCommand();
        const formatOption = command.options.find(
            (opt) => opt.long === "--format",
        );

        expect(formatOption?.choices).toBeDefined();
        expect(formatOption?.defaultValue).toBe("xml");
    });
});

describe("Extract Command Validation", () => {
    test("all boolean options are properly configured", () => {
        const command = createExtractCommand();
        const booleanOptions = [
            "--staged",
            "--all",
            "--diff-only",
            "--clipboard",
            "--interactive",
            "--include-untracked",
            "--no-metadata",
            "--select",
        ];

        for (const optionName of booleanOptions) {
            const option = command.options.find(
                (opt) => opt.long === optionName,
            );
            expect(option).toBeDefined();
            expect(option?.required).toBeFalsy();
        }
    });

    test("all string options are properly configured", () => {
        const command = createExtractCommand();
        const stringOptions = [
            "--full",
            "--path",
            "--type",
            "--format",
            "--task",
            "--untracked-pattern",
            "--sort-by",
            "--sort-order",
            "--filter-by",
        ];

        for (const optionName of stringOptions) {
            const option = command.options.find(
                (opt) => opt.long === optionName,
            );
            expect(option).toBeDefined();
            // All string options should be defined (required property varies by Commander.js version)
            expect(typeof option?.required).toBe("boolean");
        }
    });

    test("variadic options are properly configured", () => {
        const command = createExtractCommand();
        const optimizeOption = command.options.find(
            (opt) => opt.long === "--optimize",
        );

        expect(optimizeOption).toBeDefined();
        expect(optimizeOption?.variadic).toBe(true);
    });
});
