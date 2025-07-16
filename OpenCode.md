## Common Development Commands

### Build and Development
`pnpm install`
`pnpm run build`
`pnpm run dev`

### Testing
`npm test` - Run all tests
`npm test <test_file_name>` - Run a single test
`npm run test:watch` - Watch mode for tests

### Code Quality
`npm run lint`
`npm run format`

## Code Style Guidelines
- **TypeScript:** Use strict types from `src/types.ts`. Avoid `any`.
- **Modularity:** Create small, single-responsibility functions.
- **Error Handling:** Use custom Error classes and handle git failures gracefully.
- **Imports:** Use full imports from other files in the project.
- **Formatting:** Use Prettier for code formatting.
- **Naming Conventions:** Use camelCase for variables and functions, and PascalCase for classes and types.
- **Comments:** Add JSDoc comments to all public functions and classes.
- **Security:** Sanitize user inputs and handle API tokens securely.
