# Task 01: Properly Expose Extract Command

## Problem
The extract functionality exists but is implemented as the default command rather than a named "extract" command as specified in the P0 Charter (lines 57-63).

## Current State
- Extract logic is in `cli.ts` lines 144-618
- Works as default command when no subcommand is specified
- Not properly exposed as `dex extract`

## Requirements (P0 Charter)
- Must be available as explicit `dex extract` command
- Git-aware change analysis
- Supports commit ranges, staged/unstaged, and smart file inclusion
- Should maintain backward compatibility with current default behavior

## Implementation Plan
1. Create `src/commands/extract.ts` following pattern of other commands
2. Move extract logic from cli.ts to new command file
3. Export `createExtractCommand()` function
4. Register in cli.ts with `program.addCommand(createExtractCommand())`
5. Keep default behavior for backward compatibility

## Detailed Code Structure

### Function Signatures

```typescript
// src/commands/extract.ts
export function createExtractCommand(): Command

// Internal helper function
async function executeExtract(
    range: string,
    options: ExtractCommandOptions
): Promise<void>

// Type definitions
interface ExtractCommandOptions {
    staged?: boolean;
    all?: boolean;
    full?: string;
    diffOnly?: boolean;
    path?: string;
    type?: string;
    format?: OutputFormat;
    clipboard?: boolean;
    task?: string;
    interactive?: boolean;
    includeUntracked?: boolean;
    untrackedPattern?: string;
    optimize?: string[];
    metadata?: boolean;
    select?: boolean;
    sortBy?: string;
    sortOrder?: string;
    filterBy?: string;
}
```

### Core Command Structure

```typescript
// Following the pattern from distill.ts
export function createExtractCommand(): Command {
    const command = new Command("extract");
    
    command
        .description("Extract git-aware change analysis with smart context")
        .argument("[range]", "Git commit range (e.g., HEAD~5..HEAD)", "")
        // All existing options from cli.ts lines 44-86
        .action(async (range, options) => {
            await executeExtract(range, options);
        });
    
    return command;
}
```

## Step-by-Step Refactoring Plan

### Step 1: Create Extract Command File

```typescript
// src/commands/extract.ts - New file structure
import { Command, Option } from "commander";
import chalk from "chalk";
import ora from "ora";
import clipboardy from "clipboardy";
import { ContextEngine } from "../core/context";
import { GitExtractor } from "../core/git";
import { MarkdownFormatter } from "../templates/markdown";
import { JsonFormatter } from "../templates/json";
import { XmlFormatter } from "../templates/xml";
import type { DexOptions, OutputFormat } from "../types";
import { OutputManager } from "../utils/output-manager";
import * as readline from "readline";
import { mergeWithConfig } from "../core/config";

// Move extractCommand function (lines 144-618) from cli.ts
// Rename to executeExtract for clarity
async function executeExtract(range: string, options: Record<string, any>): Promise<void> {
    // Exact same implementation as current extractCommand
    // No logic changes - pure move operation
}

// Move generateContextString helper (lines 123-141) from cli.ts
function generateContextString(dexOptions: DexOptions, method: string): string {
    // Exact same implementation
}

export function createExtractCommand(): Command {
    const command = new Command("extract");
    
    command
        .description("Extract git-aware change analysis with smart context")
        .argument("[range]", "Git commit range (e.g., HEAD~5..HEAD)", "")
        // Copy all options from cli.ts lines 44-86
        .option("-s, --staged", "Include only staged changes")
        .option("-a, --all", "Include both staged and unstaged changes")
        .option("--full <pattern>", "Include full files matching pattern")
        .option("--diff-only", "Force diff view for all files (disable Smart Context)")
        .option("-p, --path <pattern>", "Filter by file path pattern")
        .option("-t, --type <types>", "Filter by file types (comma-separated)")
        .addOption(
            new Option("-f, --format <format>", "Output format")
                .default("xml")
                .choices(["markdown", "json", "xml"])
        )
        .option("-c, --clipboard", "Copy output to clipboard")
        .option("--task <source>", "Task context (description, file path, URL, or - for stdin)")
        .option("-i, --interactive", "Interactive mode for task input")
        .option("-u, --include-untracked", "Include untracked files")
        .option("--untracked-pattern <pattern>", "Pattern for untracked files to include")
        .option("--optimize <types...>", "Optimizations: aid, symbols")
        .option("--no-metadata", "Exclude metadata from output")
        .option("--select", "Interactive file selection mode")
        .option("--sort-by <option>", "Sort files by: name, updated, size, status (default: name)")
        .option("--sort-order <order>", "Sort direction: asc or desc (default: asc)")
        .option("--filter-by <option>", "Filter files by: all, staged, unstaged, untracked, modified, added, deleted (default: all)")
        .action(async (range, options) => {
            await executeExtract(range, options);
        });
    
    return command;
}
```

### Step 2: Update CLI.ts

```typescript
// src/cli.ts - Changes needed

// Add import at top with other command imports
import { createExtractCommand } from "./commands/extract";

// Replace the default command setup (lines 43-90) with:
program.addCommand(createExtractCommand());

// Keep default behavior by adding a fallback action:
program.action(async (options, command) => {
    // If no subcommand was called, treat as extract
    if (command.args.length === 0) {
        const { createExtractCommand } = await import("./commands/extract");
        const extractCmd = createExtractCommand();
        // Forward to extract command
        return extractCmd.parseAsync(["extract", ...process.argv.slice(2)], { from: "user" });
    }
});

// Remove extractCommand function (lines 144-618) - moved to extract.ts
// Remove generateContextString function (lines 123-141) - moved to extract.ts
```

### Step 3: Backward Compatibility Strategy

1. **Default Command Behavior**: When `dex` is called without a subcommand, automatically invoke the extract command
2. **Argument Forwarding**: All arguments and options are passed through unchanged
3. **Help Text**: Update default help to mention that extract is the default behavior
4. **Error Handling**: Maintain exact same error messages and exit codes

```typescript
// Backward compatibility implementation in cli.ts
program.hook('preAction', (thisCommand) => {
    // If no subcommand specified and we have arguments, treat as extract
    if (thisCommand.name() === 'dex' && process.argv.length > 2) {
        const hasSubcommand = ['extract', 'distill', 'combine', 'tree', 'config', 'init', 'help-selection'].some(
            cmd => process.argv.includes(cmd)
        );
        
        if (!hasSubcommand) {
            // Inject 'extract' as the command
            process.argv.splice(2, 0, 'extract');
        }
    }
});
```

## Acceptance Criteria

- [ ] `dex extract` command works identically to current default
- [ ] `dex extract --help` shows proper documentation  
- [ ] All existing extract options work with identical behavior
- [ ] Default behavior (`dex --staged`, `dex HEAD~1..HEAD`) still works
- [ ] Tests pass for both default and explicit command usage
- [ ] No breaking changes to existing workflows
- [ ] Performance characteristics unchanged

## Specific Test Cases to Implement

### Unit Tests (`test/extract.test.ts`)

```typescript
import { describe, test, expect } from "bun:test";
import { createExtractCommand } from "../src/commands/extract";
import { Command } from "commander";

describe("Extract Command", () => {
    test("creates command with correct name", () => {
        const command = createExtractCommand();
        expect(command.name()).toBe("extract");
    });
    
    test("has all required options", () => {
        const command = createExtractCommand();
        const options = command.options.map(opt => opt.long);
        
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
        expect(options).toContain("--select");
    });
    
    test("accepts range argument", () => {
        const command = createExtractCommand();
        expect(command.args).toHaveLength(1);
        expect(command.args[0].name()).toBe("range");
    });
    
    test("format option has correct choices", () => {
        const command = createExtractCommand();
        const formatOption = command.options.find(opt => opt.long === "--format");
        expect(formatOption?.choices).toEqual(["markdown", "json", "xml"]);
    });
});
```

### Integration Tests

```typescript
describe("Extract Integration", () => {
    test("extracts staged changes", async () => {
        // Setup git repo with staged changes
        // Run extract command
        // Verify output format and content
    });
    
    test("extracts git range", async () => {
        // Setup git repo with commits
        // Run extract with range
        // Verify correct changes extracted
    });
    
    test("handles file filtering", async () => {
        // Setup repo with multiple file types
        // Run extract with --type and --path filters
        // Verify only matching files included
    });
    
    test("generates different output formats", async () => {
        // Run extract with each format option
        // Verify format-specific output structure
    });
});
```

### Backward Compatibility Tests

```typescript
describe("Backward Compatibility", () => {
    test("default behavior works without extract subcommand", async () => {
        // Run `dex --staged` (no extract subcommand)
        // Verify identical behavior to `dex extract --staged`
    });
    
    test("range argument works as positional", async () => {
        // Run `dex HEAD~1..HEAD`
        // Verify identical to `dex extract HEAD~1..HEAD`
    });
    
    test("all options work in default mode", async () => {
        // Test each option without extract subcommand
        // Verify behavior matches explicit extract command
    });
});
```

## Migration Guide for Existing Users

### No Action Required
Existing workflows continue to work unchanged:
```bash
# These commands continue to work exactly as before
dex --staged
dex HEAD~1..HEAD --format json
dex --all --clipboard
```

### Optional: Use Explicit Command
Users can optionally be more explicit:
```bash
# New explicit syntax (identical behavior)
dex extract --staged
dex extract HEAD~1..HEAD --format json
dex extract --all --clipboard
```

### Help Text Changes
```bash
# Old help shows extract options at top level
dex --help

# New help shows extract as a subcommand
dex --help          # Shows available commands including extract
dex extract --help  # Shows extract-specific options
```

### For CI/CD and Scripts
No changes needed - all existing scripts continue to work:
```bash
#!/bin/bash
# This script works before and after the change
dex --staged --format json --clipboard
```

## Files to Modify
- `src/cli.ts` - refactor extract logic, add backward compatibility
- `src/commands/extract.ts` - new file with moved extract implementation
- `test/extract.test.ts` - new comprehensive test file
- `docs/` - update any documentation to mention extract command

## Performance Considerations

### Code Duplication Elimination
- Move ~475 lines of extract logic from cli.ts to dedicated command file
- Reduce cli.ts complexity and improve maintainability
- Enable better testing isolation

### Memory Usage
- No impact on memory usage - same logic, different organization
- Lazy loading of extract command when used as default

### Bundle Size
- Potential for better tree-shaking with modular command structure
- Extract command only loaded when needed

## Error Handling Strategy

Maintain identical error messages and exit codes:

```typescript
// Error scenarios that must be preserved:
1. "Error: Not in a git repository" (exit code 1)
2. "Error: Cannot use --staged and --all together" (exit code 1)
3. "It looks like you're trying to analyze files in a directory" (helpful redirect)
4. "Error: Interactive mode requires a TTY" (exit code 1)
5. "Error: Invalid format '...'" (exit code 1)
```

## Implementation Checklist

### Phase 1: Command Creation
- [ ] Create `src/commands/extract.ts`
- [ ] Move `extractCommand` function → `executeExtract`
- [ ] Move `generateContextString` helper function
- [ ] Export `createExtractCommand()` function
- [ ] Copy all option definitions from cli.ts

### Phase 2: CLI Integration  
- [ ] Import `createExtractCommand` in cli.ts
- [ ] Add command with `program.addCommand(createExtractCommand())`
- [ ] Implement backward compatibility hook
- [ ] Remove old extract implementation from cli.ts
- [ ] Test basic functionality

### Phase 3: Testing
- [ ] Create comprehensive unit tests
- [ ] Add integration tests for git scenarios
- [ ] Add backward compatibility tests
- [ ] Verify all existing workflows still work
- [ ] Performance regression testing

### Phase 4: Documentation
- [ ] Update help text to mention extract command
- [ ] Document backward compatibility guarantees
- [ ] Add migration guide (optional upgrade path)

## Risk Mitigation

### Breaking Change Prevention
1. **Extensive Testing**: Test matrix covering all option combinations
2. **Gradual Rollout**: Keep both implementations during transition
3. **Rollback Plan**: Git branch strategy allows quick reversion
4. **User Communication**: Clear documentation about backward compatibility

### Common Pitfalls to Avoid
1. **Option Parsing**: Ensure Commander.js option parsing identical
2. **Process Exit Codes**: Maintain exact same exit codes
3. **Error Messages**: Keep identical wording and formatting
4. **File Path Resolution**: Ensure working directory behavior unchanged
5. **Environment Variables**: Preserve any env var dependencies