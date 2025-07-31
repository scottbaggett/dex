# DEX - Diff Context for LLMs

## Common Development Commands

### Build and Development
```bash
# Install dependencies
bun install

# Build the project
bun run build

# Watch mode for development
bun run dev

# Type checking
bun run typecheck
```

### Testing
```bash
# Run all tests
bun test

# Watch mode for tests
bun run test:watch

# Test UI
bun run test:ui
```

### Code Quality
```bash
# Format code with Prettier
bun run format
```

### Publishing
```bash
# This runs build, tests, and lint before publishing
bun publish
```

## Project Architecture

### Overview
`dex` is a CLI tool and library for extracting and formatting code changes for LLM consumption. It's built with TypeScript and designed to be modular and extensible.

### Core Components

1. **Git Extraction** (`src/core/git.ts`):
   - Interfaces with git using `simple-git`
   - Extracts diffs, file contents, and repository information
   - Handles various git operations (staged, ranges, since)

2. **Context Engine** (`src/core/context.ts`):
   - Orchestrates the extraction process
   - Applies filters (path, file type)
   - Manages context levels (minimal, focused, full, extended)
   - Integrates task/issue context

3. **Formatters** (`src/templates/`):
   - Base formatter class for common functionality
   - Specific formatters: Markdown, JSON, Claude, GPT
   - Each formatter tailors output for its target LLM/use case

4. **CLI** (`src/cli.ts`):
   - Commander-based CLI interface
   - Handles user input and options
   - Manages output (console, clipboard)
   - Provides user feedback with ora spinner

### Key Design Patterns

- **Strategy Pattern**: Formatters are interchangeable strategies
- **Builder Pattern**: Context extraction builds up the result incrementally
- **Factory Pattern**: Formatter selection based on output format

### Extension Points

1. **New Formatters**: Extend `Formatter` class in `src/templates/`
2. **New Extractors**: Add to `src/core/` for new extraction methods
3. **Language Support**: Future AST parsing will use tree-sitter
4. **Integrations**: Add to `src/integrations/` (e.g., AI Distiller, GitHub)

## Development Workflow

1. Make changes in `src/`
2. Run `bun run dev` to watch and compile
3. Test CLI locally with `node ./dist/cli.js` or `bun link`
4. Write tests in `test/` using Vitest
5. Ensure `bun run typecheck` and `bun run lint` pass before committing

## Testing Guidelines

Maintain high test coverage (>80%) using Vitest to ensure dex's reliability across edge cases:

- **Unit Tests:** Focus on core components like `git.ts` (mock git responses) and `context.ts` (test context levels with fixture diffs).
- **Integration Tests:** Simulate CLI runs in `test/cli.test.ts`, verifying outputs for different formats and flags (e.g., --task integration).
- **Edge Cases:** Cover non-git environments, empty diffs, large files, and invalid flags. For task/issue features, mock GitHub API responses.
- **TDD Approach:** Write tests before implementing features, especially for future enhancements like tree-sitter parsing.
- **Mocking:** Use Vitest's vi.mock for dependencies like simple-git or clipboardy to isolate tests.
- **CI Alignment:** Ensure tests pass in GitHub Actions; add snapshots for formatter outputs to catch regressions.

## Important Notes

- The project uses ESLint flat config (`eslint.config.mjs`)
- Vitest is used for testing, not Jest
- The CLI binary is in `bin/dex` and points to `dist/cli.js`
- All formatters should escape content appropriately for their format
- The tool should fail gracefully when not in a git repository
- Context levels are cumulative: extended > full > focused > minimal

## Best Practices for Code Generation

When generating or modifying code for dex, adhere to these principles to ensure alignment with the project's modular architecture and context engineering goals:

- **TypeScript Strictness:** Always use explicit types and interfaces from `src/types.ts`. Avoid `any` types; leverage generics for flexible extractors and formatters (e.g., in `context.ts` for handling different context levels).
- **Modularity and Reusability:** Break down logic into small, single-responsibility functions. For example, in extractors, separate diff parsing from filtering to allow easy extension (e.g., for future tree-sitter integration).
- **Error Handling:** Implement robust, user-friendly errors using custom Error classes. Catch git-related failures gracefully (e.g., non-git repo) and provide actionable messages via console or CLI feedback. Use try-catch in async operations like git fetches.
- **Performance Optimization:** For large repos, prioritize efficient operations (e.g., lazy loading in `git.ts`). Include token estimation in formatters to warn on high-volume outputs, aligning with "precision over volume."
- **LLM-Friendly Outputs:** When implementing formatters, ensure outputs are structured for easy parsing (e.g., fenced code blocks in markdown). Test generated contexts by simulating LLM inputs—e.g., verify that a Claude-formatted output fits within typical token limits (~128k).
- **Documentation:** Add JSDoc comments to all public functions and classes. Inline comments for complex logic, explaining how it supports context levels or integrations.
- **Security Considerations:** Sanitize user inputs (e.g., paths in CLI flags) to prevent injection. When adding integrations like GitHub issue fetching, handle API tokens securely via environment variables.


## Architectural Guardrails

As dex evolves, maintain these invariants to uphold its role as a precision tool for agentic developers:

- **Philosophy Alignment:** All features must support "precision over volume"—e.g., default to minimal contexts, with opts-in for more.
- **Extensibility First:** Design for plugins (e.g., new integrations as modules); avoid tight coupling.
- **User-Centric UX:** CLI should be intuitive—short flags, clear help, and progressive disclosure (e.g., suggest --bootstrap for new users).
- **Scalability:** Prepare for large-scale use; e.g., async/parallel ops in extractions, configurable limits.
- **Feedback Loop:** When generating code, include comments on how it impacts LLM efficiency or agent workflows. Simulate usage in tests.
