# DEX
Context extraction and codebase analysis for AI workflows. Generate precise, token‑efficient context, combine files, distill entire repos, and visualize APIs — all from one CLI.

<p align="center">
  <img src="https://img.shields.io/badge/Token_Efficiency-90%25_Reduction-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/LLM_Ready-Markdown_JSON_XML-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Focus-Surgically_Precise-cyan?style=for-the-badge" />
  <br/>
  <i>Fast path recommended: Bun</i>
  <br/>
  <code>bunx dex</code>
  ·
  <code>bun add -g dex</code>
  ·
  <code>dex --help</code>

</p>

## Quick Start

```bash
# Install (recommended)
bun add -g @scottbaggett/dex

# Or run without installing
bunx dex --help

# Initialize project scaffolding
cd your-project
dex init

# Extract your current changes (XML by default)
dex -s --format markdown --clipboard
```

## Core Commands

### `Extract changes` (default command)
Extracts Git changes and formats context for LLMs.

```bash
dex                         # Current unstaged changes
dex -s                      # Staged changes only
dex -a                      # Staged + unstaged
dex HEAD~5..HEAD            # Specific commit range
dex -p "src/**" -t ts,tsx    # Filter by path and types
dex --select                # Interactive file picker (TTY)
```

Key options:
- -s, --staged: Only staged changes
- -a, --all: Staged + unstaged changes
- --full <pattern>: Include full files matching pattern
- --diff-only: Force diffs (disable Smart Context)
- -p, --path <pattern>: Filter by file path
- -t, --type <csv>: Filter by file types (e.g. ts,tsx,js)
- -f, --format <fmt>: markdown | json | xml (default: xml)
- -c, --clipboard: Copy output to clipboard
- --task <source>: Description, file path, URL, or '-' for stdin
- -i, --interactive: Prompt for task description (TTY)
- -u, --include-untracked: Include untracked files
- --untracked-pattern <glob>: Pattern for untracked files
- --optimize <flags...>: aid, symbols
- --no-metadata: Omit metadata block
- --select: Interactive file selection (TTY)
- --sort-by <opt>: name | updated | size | status
- --sort-order <ord>: asc | desc
- --filter-by <opt>: all | staged | unstaged | untracked | modified | added | deleted

Outputs are saved to `.dex/` by default unless `--clipboard`, `--stdout` (where available), or an explicit `--output` is used.

### 🗜️ Distill codebases
Extract clean API signatures from entire codebases, removing implementation details for token-efficient LLM context.

```bash
dex distill .                          # Distill current project
dex distill packages/api               # Distill a specific directory
dex distill src/index.ts               # Distill a single file
dex distill . --depth all              # Include private/protected members
dex distill . --include "*.ts"         # Only TypeScript files
dex distill . --stdout                 # Print to stdout
```

Key options:
- -f, --format <type>: compressed | distilled | both (default: distilled)
- -o, --output <file>: Write to a specific file
- -c, --clipboard: Copy output to clipboard
- --stdout: Print to stdout
- --include <pattern>: Include file patterns (e.g., "*.ts", "src/**/*.js")
- --exclude <pattern>: Exclude file patterns (repeatable)
- --exclude-names <pattern>: Exclude specific export names (e.g., "*Test*", "_*")
- --depth <level>: API surface depth - public | protected | all (default: public)
- --include-private: Include private members
- --with-comments: Include code comments
- --no-docstrings: Exclude docstrings
- --compact: Compact output mode
- --no-compress: Skip compression phase
- --no-parallel: Disable parallel processing
- --since <ref>: Only process files changed since git ref
- --staged: Only process staged files

### `Combine` files and folders
Create a single, LLM‑friendly document from many files.

```bash
dex combine src/auth/ src/api/         # Combine directories
dex combine file1.ts file2.ts          # Combine specific files
dex combine --select                   # Pick files interactively (TTY)
dex combine -s -c                      # Use staged files; copy to clipboard
```

**Key options:**
- --output-format <fmt>: xml | markdown | json (default: xml)
- -s, --staged: Use all staged files (full contents)
- -c, --copy: Copy to clipboard
- --no-metadata: Omit metadata block
- -o, --output <file>: Write to file instead of saving to `.dex/`
- --include <csv>: Include patterns, e.g. "*.ts,*.js"
- --exclude <csv>: Exclude patterns, e.g. "*.test.*,*.spec.*"
- --max-files <n>: Limit files processed (default 1000)
- --max-depth <n>: Directory scan depth (default 10)
- --no-gitignore: Ignore .gitignore
- --select: Interactive picker (TTY)

### 🌳 Visualize APIs and structure
Generate a beautiful API tree or outline for quick understanding.

```bash
dex tree src/                          # Tree view
dex tree . --format outline            # Outline view
dex tree . --group-by type --show-types --show-params
```

Key options:
- -f, --format <type>: tree | outline | json (default: tree)
- -o, --output <file>: Write to file
- --stdout: Print to stdout
- -c, --clipboard: Copy to clipboard
- --exclude <pattern...>: Exclude patterns
- --include-private: Include private/internal APIs
- --show-types: Show param and return types
- --show-params: Show function parameters
- --group-by <method>: file | type | none (default: file)

### Config utilities

```bash
dex config validate           # Validate current config
dex init                      # Scaffold .dex/ with config
```

Configuration is auto‑loaded from, in order:
- `.dex/config.{yml,yaml,json,js}`
- `.dexrc{,.json,.yaml,.yml,.js,.cjs}`
- `dex.config.{js,cjs}` or `package.json` ("dex" key)


## Installation

- Bun (recommended): `bun add -g @scottbaggett/dex` or run via `bunx dex`
- npm: `npm install -g dex`
- pnpm: `pnpm add -g dex`

DEX saves outputs to `.dex/` with descriptive, timestamped filenames. Use `--clipboard`, `--stdout` (where available), or `--output <file>` to override.

## Requirements

- Bun 1.0+ or Node.js 16+
- Git (for change tracking)

## Tips

- Use `--select` to interactively choose files when you don’t want to depend on Git state.
- Prefer `--format xml` for agents that parse structure, `--format markdown` for human review, and `--format json` for programmatic pipelines.
- `distill` supports `--dry-run` to preview scope and `--exclude` repeatedly for fine control.

## Contributing

- ⭐ Star the repo: https://github.com/scottbaggett/dex
- 🐛 Issues: https://github.com/scottbaggett/dex/issues
- 🔧 PRs: https://github.com/scottbaggett/dex/pulls

## License

MIT — see [LICENSE](LICENSE)
