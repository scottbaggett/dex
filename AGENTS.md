# AGENTS.md - Development Guide for Agentic Coding

## Build/Test Commands
- `pnpm run build` - Build TypeScript to dist/
- `pnpm run dev` - Watch mode for development
- `pnpm run typecheck` - Type checking without emit
- `pnpm run test` - Run all tests with Vitest
- `pnpm run test:watch` - Watch mode for tests
- `vitest run test/specific-file.test.ts` - Run single test file
- `pnpm run lint` - ESLint check
- `pnpm run lint:fix` - Auto-fix linting issues
- `pnpm run format` - Format with Prettier

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, explicit types preferred, avoid `any` (warn level)
- **Imports**: Use ES6 imports, group by: node modules, local modules, types
- **Formatting**: Prettier config - 2 spaces, single quotes, 100 char width, semicolons
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces, kebab-case for files
- **Error Handling**: Use custom Error classes, graceful failures with user-friendly messages
- **Functions**: Prefer explicit return types for public APIs, use JSDoc for complex logic
- **Files**: One main export per file, co-locate types with implementation when small

## Testing
- Use Vitest with globals enabled, prefer unit tests with mocked dependencies
- Test files in `test/` directory with `.test.ts` extension
- Mock external dependencies like `simple-git` and `clipboardy` for isolation