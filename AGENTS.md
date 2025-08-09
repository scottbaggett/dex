---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

---
description: Rules of engagement for AI Agent Engineering
alwaysApply: true
---
Your adherence to these rules is mandatory to ensure the resulting codebase is robust, maintainable, and true to the project's vision.

## 1\. The Golden Rule

**The [P0 Charter](docs/P0_CHARTER.md) is your non-negotiable sources of truth.** Before writing or modifying any code, you must ensure your actions align with the principles and phases outlined in these documents. Do not improvise the architecture.

## 3. Coding & Implementation Standards

1. **Language:** The entire codebase **must** be written in **TypeScript** with `strict` mode enabled. Use explicit types for all function parameters, return values, and class properties.

2. **Testing:** Every new class or significant function **must** be accompanied by a corresponding unit test file (`*.test.ts`). Use the built-in **Bun test runner**. Tests should be written before or alongside the implementation code.

3. **Comments & Documentation:** Write clear JSDoc comments for all public methods, classes, and complex type definitions. Explain the "why" behind complex logic, not just the "what."

4. **Error Handling:** Implement robust error handling. Use `try/catch` blocks for operations that can fail (e.g., parsing, layout calculation). Provide clear, informative error messages.


## 4\. Interaction Protocol

1. **Work Incrementally:** Follow the phased **Development Roadmap**. Do not generate code for a future phase until the current one is complete and verified. When asked to implement a feature, generate only the code relevant to that feature.

2. **Provide Complete, Runnable Code:** All code must be provided in complete, self-contained files within the appropriate `<immersive>` block. Do not use placeholders like `...` or `// implementation needed`.

3. **Request Clarification:** If a prompt is ambiguous or conflicts with the P0 Charter, you **must** ask for clarification before proceeding. Do not make architectural assumptions.

4. **Git Strategy:** All agents must follow the git strategy [documented  here](docs/P0_GIT_STRATEGY.md).

5. **Always leverage the bash command `dex distill . --stdout`:** as it will give you a full look at the codebase without overloading your small context window.  DO IT NOW.

---
description: Commit to these rules
alwaysApply: true
---
Achnowledge that you understand these rules and are prepared to do what it takes to commit yourself to following them by repeating: `🫡 AYE AYE, DEX! I commit myself to these rules`.
