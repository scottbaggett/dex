```
██████   ███████  ██   ██
██   ██  ██        ██ ██
██   ██  █████      ███
██   ██  ██        ██ ██
██████   ███████  ██   ██

```

## Installation

```bash
npm install -g dex
```

## Quick Start

```bash
# Initialize dex in your project
dex init

# Extract current unstaged changes
dex

# Extract staged changes
dex -s

# Extract all changes (staged + unstaged)
dex -a

# Extract changes since main branch
dex --since main

# Extract changes since last snapshot
dex @-1

# Extract changes since 2 hours ago
dex @2h

# Copy to clipboard
dex -c

# Use a prompt template
dex --prompt-template security

# Format for Claude with custom prompt
dex -f claude --prompt "Review for security vulnerabilities"

# Interactive mode
dex -i
```

## Features

- **Organized Project Configuration**: Clean `.dex/` directory structure keeps your project root tidy
- **YAML Prompt Templates**: Write natural multi-line prompts without JSON escaping
- **Precise Context Extraction**: Extract only what's needed for AI consumption
- **Multiple Output Formats**: Markdown, JSON, Claude, GPT, Gemini, Grok, Llama, Mistral
- **Smart Prompt System**: Context-aware prompts based on your code changes
- **Template Inheritance**: Extend and customize built-in prompt templates
- **Flexible Context Levels**: From minimal diffs to full file dumps
- **Task Integration**: Embed task descriptions and GitHub issues
- **LLM Optimization**: Reduce token usage while maintaining context quality
- **Snapshot System**: Track changes without git commits for AI workflows

## Project Setup

Run `dex init` to create the `.dex/` directory structure in your project:

```
.dex/
├── config.yml        # Main configuration
├── .dexignore        # Files to exclude
├── prompts/          # Custom prompt templates
│   ├── security.yml
│   ├── performance.yml
│   ├── refactor.yml
│   └── ...
└── snapshots/        # Code snapshots (managed automatically)
    └── objects/      # Compressed file storage
```

### Configuration

Edit `.dex/config.yml` to customize default behavior:

```yaml
defaults:
  format: claude       # Default output format
  depth: focused      # Default extraction depth
  clipboard: true     # Always copy to clipboard

filters:
  ignorePaths:
    - node_modules
    - dist
    - "*.min.js"
```

## Prompt Templates

Dex includes powerful prompt templates for common code review scenarios:

### Built-in Templates

- `security` - Security vulnerability analysis
- `performance` - Performance optimization review
- `refactor` - Code refactoring assessment
- `feature` - Feature implementation review
- `testing` - Test coverage and quality check
- `base-review` - Standard code review template

### Using Templates

```bash
# Security review
dex --prompt-template security

# Performance analysis
dex --prompt-template performance

# Custom one-off prompt
dex --prompt "Check for memory leaks"

# Combine with specific format
dex -f claude --prompt-template security
```

### Creating Custom Templates

Create YAML files in `.dex/prompts/`:

```yaml
# .dex/prompts/team-review.yml
name: Team Code Review
description: Our team's review process
extends: base-review  # Inherit from built-in template
tags:
  - team
  - custom
instructions: |
  Review this code following our team standards:
  
  ## Architecture
  - Does this follow our microservices patterns?
  - Are domain boundaries respected?
  
  ## Code Quality
  - TypeScript strict mode compliance
  - Proper error handling with our custom types
  - Logging using our centralized logger
  
  ## Testing
  - Minimum 80% coverage
  - E2E tests for critical paths
  
  Format feedback as:
  - ✅ Good: What was done well
  - ⚠️ Concern: Issues to address
  - 💡 Suggestion: Improvements
```

### Managing Templates

```bash
# List all available templates
dex prompts list

# Show template details
dex prompts show security

# Create a new template
dex prompts init "Migration Guide"
```

## Snapshot System

Dex includes a powerful snapshot system that allows you to track changes without creating git commits. This is perfect for AI-assisted coding workflows where you want to reference previous states without polluting your git history.

### Why Snapshots?

- **Token Efficiency**: Avoid repeatedly sending full context to AI
- **Clean Git History**: No temporary commits cluttering your repository
- **Fast Comparisons**: Quickly see what changed since any snapshot
- **Flexible References**: Use relative times (@2h) or positions (@-1)
- **Persistent Context**: Maintain conversation continuity across sessions

### Creating Snapshots

```bash
# Create a snapshot with a message
dex snapshot create -m "Before refactoring auth module"

# Create with tags for organization
dex snapshot create -t feature,auth,wip

# Snapshot only specific paths
dex snapshot create -p src/auth -m "Auth module baseline"

# Include untracked files
dex snapshot create --include-untracked
```

### Reference Types

Dex supports multiple ways to reference changes:

**Snapshot References**:
```bash
# Changes since last snapshot
dex @-1

# Changes since 2nd most recent snapshot
dex @-2

# Changes since a specific snapshot
dex snapshot-id
```

**Time-Based File Changes**:
```bash
# All files modified in the last 30 minutes
dex @30m

# All files modified in the last 2 hours
dex @2h

# All files modified in the last day
dex @1d

# All files modified in the last week
dex @1w
```

**Git References** (standard git syntax):
```bash
# Changes in last 3 commits
dex HEAD~3

# Changes between branches
dex main..feature

# Changes since a specific commit
dex abc123
```

### Managing Snapshots

```bash
# List all snapshots
dex snapshot list

# List snapshots with specific tags
dex snapshot list -t wip

# View snapshot details
dex snapshot view <id>

# Compare two snapshots
dex snapshot diff @-2 @-1

# Clean old snapshots
dex snapshot clean --older-than 7d

# Keep snapshots with certain tags
dex snapshot clean --older-than 7d --keep-tags important
```

### Smart Resolution

Dex intelligently resolves references:
- **Exact ID**: `abc123` - Direct snapshot ID
- **Relative Position**: `@-1`, `@-2` - Nth most recent snapshot
- **Time-Based Changes**: `@5m`, `@2h`, `@1d` - Files modified within that time
- **Name Match**: `auth-refactor` - Partial match on snapshot description
- **Git Refs**: Standard git references (HEAD~3, main..feature, etc.)

### Example Workflow

```bash
# Start working on a feature
dex snapshot create -m "Starting auth refactor" -t auth,baseline

# Make some changes, get AI feedback
dex @-1 -f claude --prompt-template refactor

# Continue working...
dex snapshot create -m "Implemented JWT validation"

# See all changes since baseline
dex @baseline -f claude

# Compare progress between snapshots
dex snapshot diff @-2 @-1

# Clean up old work-in-progress snapshots
dex snapshot clean --older-than 3d --keep-tags baseline
```

## CLI Usage

```
Usage: dex [options] [range]

Arguments:
  range                       Git commit range or snapshot reference (e.g., HEAD~5..HEAD, @-1, @2h)

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
  -f, --format <format>       Output format (default: "markdown")
  -c, --clipboard             Copy output to clipboard
  --task <source>             Task context (description, file path, URL, or - for stdin)
  -i, --interactive           Interactive mode for task input
  -u, --include-untracked     Include untracked files
  --untracked-pattern <pat>   Pattern for untracked files to include
  --optimize <types...>       Optimizations: aid, symbols
  --no-metadata               Exclude metadata from output
  --prompt <text>             Custom AI analysis prompt
  --prompt-template <name>    Use a prompt template
  --no-prompt                 Disable AI prompt generation

Subcommands:
  extract [range]             Extract and format code changes (default)
  init                        Initialize dex configuration
  snapshot                    Manage code snapshots
  prompts list                List available prompt templates
  prompts show <id>           Show prompt template details
  prompts init <name>         Create new prompt template
  help [command]              Display detailed help
```

## Output Formats

- **markdown**: Human-readable markdown format (default)
- **json**: Structured JSON for tooling integration
- **claude**: XML-structured format optimized for Claude
- **gpt**: Format optimized for GPT models with CoT prompts
- **gemini**: End-loaded context format for Gemini
- **grok**: JSON schema format for deterministic output
- **llama**: Format using [INST] tags for Llama models
- **mistral**: Concise format optimized for Mistral
- **pr**: GitHub pull request format

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
# Security review with Claude
dex -f claude --prompt-template security -c

# Performance analysis with GPT
dex -f gpt --prompt-template performance

# Custom team review
dex --prompt-template team-review

# Quick one-off analysis
dex --prompt "Check for SQL injection vulnerabilities"

# Maximum context extraction
dex -d extended --full "*"

# Include new untracked files
dex -u
```

### Snapshot Examples
```bash
# Track progress without commits
dex snapshot create -m "Start feature"
# ... work on code ...
dex @-1 -f claude --prompt-template feature

# Time-based file changes (based on modification time)
dex @15m  # All files changed in last 15 minutes
dex @2h   # All files changed in last 2 hours
dex @1d   # All files changed since yesterday
dex @1w   # All files changed in past week
dex @1M   # All files changed in past month

# Compare snapshots
dex snapshot diff @-3 @-1  # What changed between snapshots

# Clean up workspace
dex snapshot clean --older-than 7d --keep-tags baseline,milestone
```

### Advanced Examples
```bash
# Review changes since main with security focus
dex --since main --prompt-template security

# Extract specific commit range with custom prompt
dex HEAD~5..HEAD~2 --prompt "Migration safety check"

# Full TypeScript files with refactoring focus
dex --full "*.ts" --prompt-template refactor

# Interactive mode with performance template
dex -i --prompt-template performance

# Combine snapshots with templates
dex @baseline --prompt-template security -f claude

# Track incremental progress
dex snapshot create -m "Added auth middleware"
dex @-1 --prompt "Review auth implementation for security"
```

## Prompt Template System

### Template Structure
Templates use YAML format with clean multi-line support:

```yaml
name: Template Name
description: What this template does
extends: base-template    # Optional: inherit from another
tags: [tag1, tag2]       # Optional: for filtering
llm: [claude, gpt]       # Optional: recommended LLMs
instructions: |
  Your detailed review instructions here.
  
  Multiple paragraphs with proper formatting.
  No more JSON escaping!
  
variables:               # Optional: for interpolation
  min_coverage: "80"
  
examples:                # Optional: few-shot examples
  - input: "Example code issue"
    output: |
      Formatted review response
```

### Template Inheritance
Templates can extend others to build on existing functionality:

```yaml
# .dex/prompts/security-plus.yml
extends: security
instructions: |
  In addition to standard security checks:
  - Verify OAuth2 implementation
  - Check rate limiting
  - Validate CORS configuration
```

### Context-Aware Prompts
When no template is specified, dex generates smart prompts based on:
- File types changed (frontend, backend, config, tests)
- Size of changes (focused vs. large refactoring)
- Detected patterns (new features, bug fixes, refactoring)
- Language-specific concerns (TypeScript, Python, Go, etc.)

## Configuration

### Config File Location
Dex looks for configuration in this order:
1. `.dex/config.yml` (recommended)
2. `.dexrc` (legacy)
3. `package.json` under "dex" key

### Example Configuration
```yaml
# .dex/config.yml
defaults:
  format: claude
  depth: focused
  clipboard: true
  promptTemplate: team-review

filters:
  ignorePaths:
    - "*.generated.ts"
    - "test/fixtures/**"
    - ".dex"
    
# Define custom prompts inline (or use .dex/prompts/)
prompts:
  quick-review:
    name: Quick Review
    instructions: |
      Brief code review focusing on:
      - Obvious bugs
      - Security issues
      - Performance problems
```

## API Usage

```typescript
import { ContextEngine, MarkdownFormatter } from 'dex';

const engine = new ContextEngine();
const context = await engine.extract({
  since: 'main',
  depth: 'focused',
  task: 'Fix authentication bug',
  promptTemplate: 'security'
});

const formatter = new MarkdownFormatter();
const output = formatter.format({ context, options: {} });
console.log(output);
```

## License

MIT © Scott Baggett
