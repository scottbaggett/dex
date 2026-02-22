# DEX
Context extraction and codebase analysis for AI workflows. Generate precise, token‑efficient context, combine files, distill entire repos, and visualize APIs — all from one CLI.

<p align="center">
  <img src="https://img.shields.io/badge/Token_Efficiency-90%25_Reduction-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/LLM_Ready-Markdown_JSON_txt-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Focus-Surgically_Precise-cyan?style=for-the-badge" />
  <br/>
  <i>Local installation via Bun</i>
  <br/>
  <code>git clone</code>
  ·
  <code>bun link</code>
  ·
  <code>dex --help</code>

</p>

## Quick Start

```bash
# Clone and install locally
git clone https://github.com/scottbaggett/dex.git
cd dex
bun install
bun link

# Now use dex globally
dex --help

# Extract your current changes (txt by default)
dex -s --format md --clipboard
```

## Core Commands

## `Extract` (default command)
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
- -f, --format <fmt>: md | json | txt (default: txt)
- -c, --clipboard: Copy output to clipboard
- -u, --include-untracked: Include untracked files
- --untracked-pattern <glob>: Pattern for untracked files
- --optimize <flags...>: aid, symbols
- --no-metadata: Omit metadata block
- --select: Interactive file selection (TTY)
- --sort-by <opt>: name | updated | size | status
- --sort-order <ord>: asc | desc
- --filter-by <opt>: all | staged | unstaged | untracked | modified | added | deleted

Outputs are saved to `.dex/` by default unless `--clipboard`, `--stdout` (where available), or an explicit `--output` is used.

## Distill
Extract clean API signatures from entire codebases, removing implementation details for token-efficient LLM context.

```bash
dex distill .                          # Distill current project
dex distill packages/api               # Distill a specific directory
dex distill src/index.ts               # Distill a single file
dex distill . --private 1              # Include private members
dex distill . --include "*.ts"         # Only TypeScript files
dex distill . --stdout                 # Print to stdout
```

Key options:
- -f, --format <type>: txt | md | json (default: txt)
- -o, --output <file>: Write to a specific file
- -c, --clipboard: Copy output to clipboard
- --stdout: Print to stdout
- -s, --select: Interactive file selection
- --include <patterns...>: Include file patterns (e.g., "*.ts" "src/**/*.js")
- --exclude <patterns...>: Exclude file patterns
- --comments <0|1>: Include comments (default: 0)
- --docstrings <0|1>: Include docstrings (default: 1)
- --private <0|1>: Include private members (default: 0)
- --protected <0|1>: Include protected members (default: 0)
- --internal <0|1>: Include internal members (default: 0)
- --workers <number>: Number of worker threads (default: 1)
- --dry-run: Preview what would be processed
- --staged: Only process staged files

## `Combine`
Create a single, LLM‑friendly document from many files.

```bash
dex combine src/auth/ src/api/         # Combine directories
dex combine file1.ts file2.ts          # Combine specific files
dex combine -s                         # Pick files interactively (TTY)
dex combine --staged -c                # Use staged files; copy to clipboard
```

**Key options:**
- -f, --format <fmt>: txt | md | json (default: txt)
- --staged: Use all staged files (full contents)
- -c, --clipboard: Copy to clipboard
- -o, --output <file>: Write to file instead of saving to `.dex/`
- --include <patterns...>: Include patterns, e.g. "*.ts" "*.js"
- --exclude <patterns...>: Exclude patterns, e.g. "*.test.*" "*.spec.*"
- --max-files <n>: Limit files processed (default 1000)
- --no-gitignore: Ignore .gitignore
- -s, --select: Interactive picker (TTY)
- --stdout: Print output to stdout
- --since <ref>: Only process files changed since git ref
- --dry-run: Show what files would be processed

### Tree
Generate a beautiful API tree or outline for quick understanding.

```bash
dex tree src/                          # Tree view
dex tree . --outline                   # Outline view
dex tree . --group-by type --show-types --show-params
```

Key options:
- -o, --output <file>: Write to file
- --stdout: Print to stdout
- -c, --clipboard: Copy to clipboard
- --exclude <pattern...>: Exclude patterns
- --include-private: Include private/internal APIs
- --show-types: Show param and return types
- --show-params: Show function parameters
- --group-by <method>: file | type | none (default: file)


## Installation

### Local Installation

```bash
# Clone the repository
git clone https://github.com/scottbaggett/dex.git
cd dex

# Install dependencies and link globally
bun install
bun link

# Verify installation
dex --help
```

### Alternative: Run directly from source

```bash
# With Bun (no build needed, runs TypeScript directly)
cd /path/to/dex
bun run src/cli.ts [command] [options]
```

DEX saves outputs to `.dex/` with descriptive, timestamped filenames. Use `--clipboard`, `--stdout` (where available), or `--output <file>` to override.

## Performance & Parallel Processing

DEX supports worker threads for CPU parallelism during `distill`:

```bash
# Default: sequential worker mode
dex distill .

# Sequential processing for small projects
dex distill . --workers 1

# Parallel processing for larger codebases
dex distill . --workers 4
```

**Performance Notes:**
- **Default safety**: Sequential mode avoids worker startup overhead in small runs
- **Small projects** (<100 files): Keep `--workers 1`
- **Large projects** (1000+ files): Try `--workers 2` to `--workers 8`
- **Memory-intensive**: Each worker has independent parser state

## Requirements

- Bun 1.0+
- Git (for change tracking)

## Tips

- Use `--select` to interactively choose files when you don’t want to depend on Git state.
- Prefer `--format txt` for agents that parse structure, `--format md` for human review, and `--format json` for programmatic pipelines.
- `distill` supports `--dry-run` to preview scope and `--exclude` repeatedly for fine control.

## Contributing

- ⭐ Star the repo: https://github.com/scottbaggett/dex
- 🐛 Issues: https://github.com/scottbaggett/dex/issues
- 🔧 PRs: https://github.com/scottbaggett/dex/pulls

## License

MIT — see [LICENSE](LICENSE)
