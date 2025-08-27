# DEX Project Standards

Essential development standards for consistent, maintainable code in our CLI tool.

## Schema-First Architecture

**All types come from Zod schemas in `schemas.ts`**

```typescript
// ✅ Correct: Define schema first, infer type
export const OptionsSchema = z.object({
  format: z.enum(["md", "json", "xml"]),
  output: z.string().optional(),
});
export type Options = z.infer<typeof OptionsSchema>;

// ❌ Wrong: Define interface directly
export interface Options {
  format: "md" | "json" | "xml";
  output?: string;
}
```

**Always validate external inputs**

```typescript
function parseOptions(raw: unknown): Options {
  return OptionsSchema.parse(raw); // Throws on invalid input
}
```

## TypeScript Standards

- **Strict mode required** - All code must compile with `strict: true`
- **Explicit types** - No `any`, use proper types from schemas
- **Import order**: Node built-ins → external libs → schemas → internal modules

```typescript
import { promises as fs } from "fs";
import chalk from "chalk";
import { OptionsSchema, type Options } from "./schemas";
import { Processor } from "./core/processor";
```

## Command Structure

All CLI commands follow the same pattern:

```typescript
export function createMyCommand(): Command {
  return new Command("my-command")
    .description("Brief description")
    .option("-f, --format <type>", "Output format", "md")
    .action(async (args, options) => {
      const validated = OptionsSchema.parse(options);
      await executeCommand(args, validated);
    });
}
```

## Error Handling

**Custom error classes for different failure types**

```typescript
export class GitError extends Error {
  constructor(message: string) {
    super(`Git error: ${message}`);
    this.name = "GitError";
  }
}
```

**Graceful user-facing errors**

```typescript
try {
  return schema.parse(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new Error(`Invalid options: ${error.issues[0].message}`);
  }
  throw error;
}
```

## File Operations

**Always use git-aware project root**

```typescript
async function getProjectRoot(): Promise<string> {
  try {
    const git = simpleGit();
    return (await git.revparse(["--show-toplevel"])).trim();
  } catch {
    return process.cwd();
  }
}
```

## Testing Requirements

**Every new feature needs tests**

```typescript
import { test, expect } from "bun:test";

test("validates options correctly", () => {
  const valid = { format: "md", output: "file.md" };
  expect(() => OptionsSchema.parse(valid)).not.toThrow();
  
  const invalid = { format: "bad" };
  expect(() => OptionsSchema.parse(invalid)).toThrow();
});
```

## Documentation

**JSDoc for all public APIs**

```typescript
/**
 * Process files according to options
 * 
 * @param files - Files to process
 * @param options - Validated options from schema
 * @returns Processing results
 * @throws {ProcessingError} When file processing fails
 */
async function processFiles(files: string[], options: Options): Promise<Result> {
  // Implementation
}
```

## Bun-First

- Use `bun test` instead of Jest/Vitest
- Use `bun run` instead of npm/yarn scripts  
- Use `bun install` for dependencies
- Use `bun build` for bundling

That's it. Follow these patterns consistently and the codebase stays maintainable.