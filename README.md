# dex

Context engineering for code changes - Extract and format code changes with surgical precision for LLM consumption.

## Installation

```bash
npm install -g dex
```

## Quick Start

```bash
# Extract current unstaged changes
dex

# Extract staged changes
dex --staged

# Extract changes since main branch
dex --since=main

# Extract with full file context
dex --context=extended

# Copy to clipboard for AI tools
dex --clipboard

# Format for Claude
dex --format=claude

# Bootstrap mode for new AI sessions
dex --bootstrap --task="Implement user authentication"
```

## Features

- **Precise Context Extraction**: Extract only what's needed for AI consumption
- **Multiple Output Formats**: Markdown, JSON, Claude-optimized, GPT-optimized
- **Flexible Context Levels**: From minimal diffs to full file dumps
- **Task Integration**: Embed task descriptions and GitHub issues
- **Smart Filtering**: Filter by paths, file types, or specific symbols
- **LLM Optimization**: Reduce token usage while maintaining context quality

## CLI Options

```
Usage: dex [options] [range]

Arguments:
  range                    Git commit range (e.g., HEAD~5..HEAD)

Options:
  -V, --version            output the version number
  -s, --staged             Include only staged changes
  --since <commit>         Show changes since a specific commit
  -c, --context <level>    Context level: minimal, focused, full, extended (default: "focused")
  --full-files <pattern>   Include full files matching pattern
  --bootstrap              Bootstrap mode for new AI sessions
  -p, --path <pattern>     Filter by file path pattern
  -t, --type <types>       Filter by file types (comma-separated)
  --extract <mode>         Extraction mode: changes, functions, symbols
  --symbols                Include symbol references
  -f, --format <format>    Output format: markdown, json, claude, gpt (default: "markdown")
  --json                   Output as JSON (alias for --format json)
  --clipboard              Copy output to clipboard
  --github-pr              Format for GitHub PR description
  --task <description>     Task description for context
  --issue <url>            GitHub issue URL or number
  -i, --interactive        Interactive mode for task input
  --compress <type>        Compression type: aid
  --map <type>             Mapping type: symbols
  --aid                    Enable AI Distiller integration
  -h, --help               display help for command
```

## Context Levels

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
# Get current changes in markdown
dex

# Get staged changes as JSON
dex --staged --json
```

### Advanced Filtering
```bash
# Only TypeScript files in src/
dex --path="src/**/*.ts" --type=ts,tsx

# Changes since main branch, full context
dex --since=main --context=full
```

### AI Workflow Integration
```bash
# Bootstrap a new AI session with task context
dex --bootstrap --task="Refactor authentication system" --format=claude

# Quick copy for chat
dex --clipboard --context=minimal

# PR review context
dex HEAD~3..HEAD --github-pr
```

## API Usage

```typescript
import { ContextEngine, MarkdownFormatter } from 'dex';

const engine = new ContextEngine();
const context = await engine.extract({
  since: 'main',
  context: 'focused',
  task: 'Fix authentication bug'
});

const formatter = new MarkdownFormatter();
const output = formatter.format({ context, options: {} });
console.log(output);
```

## License

MIT © Scott Baggett