```
██████   ███████  ██   ██
██   ██  ██        ██ ██
██   ██  █████      ███
██   ██  ██        ██ ██
██████   ███████  ██   ██

```


Context engineering for code changes - Extract and format code changes with surgical precision for LLM consumption. 🚀

## Installation

```bash
npm install -g dex
```

## Quick Start

```bash
# Extract current unstaged changes
dex

# Extract staged changes
dex -s

# Extract all changes (staged + unstaged)
dex -a

# Extract changes since main branch
dex --since main

# Copy to clipboard
dex -c

# Format for Claude
dex -f claude

# Include full files
dex --full "*.ts"

# Add task context
dex --task "Fix auth bug"

# Interactive mode
dex -i
```

## Features

- **Precise Context Extraction**: Extract only what's needed for AI consumption
- **Multiple Output Formats**: Markdown, JSON, Claude-optimized, GPT-optimized
- **Flexible Context Levels**: From minimal diffs to full file dumps
- **Task Integration**: Embed task descriptions and GitHub issues
- **Smart Filtering**: Filter by paths, file types, or specific symbols
- **LLM Optimization**: Reduce token usage while maintaining context quality

## CLI Usage

```
Usage: dex [options] [range]

Arguments:
  range                       Git commit range (e.g., HEAD~5..HEAD)

Options:
  -V, --version               Output version
  -h, --help                  Display help
  -s, --staged                Include only staged changes
  -a, --all                   Include both staged and unstaged changes
  --since <commit>            Show changes since a specific commit
  -d, --depth <level>         Extraction depth: minimal, focused, full, extended (default: "focused")
  --full <pattern>            Include full files matching pattern (use * for all)
  -p, --path <pattern>        Filter by file path pattern
  -t, --type <types>          Filter by file types (comma-separated)
  -f, --format <format>       Output format: markdown, json, claude, gpt, pr (default: "markdown")
  -c, --clipboard             Copy output to clipboard
  --task <source>             Task context (description, file path, URL, or - for stdin)
  -i, --interactive           Interactive mode for task input
  --include-untracked         Include untracked files
  --untracked-pattern <pat>   Pattern for untracked files to include
  --optimize <types...>       Optimizations: aid, symbols
  --no-metadata               Exclude metadata from output

Subcommands:
  extract [range]             Extract and format code changes (default)
  init                        Initialize dex configuration
  help [command]              Display detailed help
```

## Extraction Depth Levels

- **minimal**: Just the changes/diffs
- **focused**: Changes with immediate surrounding code (default)
- **full**: Changes with complete function/class context
- **extended**: Full file dumps for specified paths

## Output Formats

- **markdown**: Human-readable markdown format
- **json**: Structured JSON for tooling integration
- **claude**: XML-like format optimized for Claude
- **gpt**: Prompt-optimized format for GPT models

## Examples

### Basic Usage
```bash
# Current changes
dex

# Staged changes
dex -s

# All changes (staged + unstaged)
dex -a

# Changes from last 3 commits
dex HEAD~3

# Copy to clipboard
dex -c
```

### Filtering & Context
```bash
# Filter by path
dex -p "src/**"

# Filter by file type
dex -t ts,tsx

# Include full files
dex --full "*.config.*"

# Add task context
dex --task "Fix authentication bug"

# Interactive task input
dex -i
```

### AI Workflows
```bash
# Format for Claude
dex -f claude -c

# Format for GPT
dex -f gpt --task "Review this code"

# Maximum context
dex -d extended --full "*"

# Include untracked files
dex --include-untracked
```

## API Usage

```typescript
import { ContextEngine, MarkdownFormatter } from 'dex';

const engine = new ContextEngine();
const context = await engine.extract({
  since: 'main',
  depth: 'focused',
  task: 'Fix authentication bug'
});

const formatter = new MarkdownFormatter();
const output = formatter.format({ context, options: {} });
console.log(output);
```

## License

MIT © Scott Baggett
