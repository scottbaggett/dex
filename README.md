# DEX
A powerful context generator that creates the perfect extraction from your codebase for any AI agent. One source of truth, multiple destinations.

> **Note:** This is the very first version of this tool. We would be very grateful for any feedback in the form of a discussion or by creating an issue on [GitHub](https://github.com/scottbaggett/dex/issues). Thank you\!

<p align="">
  <img src="https://img.shields.io/badge/Token_Savings-70--90%25-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Agents-Claude_|_Gemini_|_GPT_|_Grok_|_THE_REST_-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Context-Perfectly_Preserved-cyan?style=for-the-badge" />
</p>


```bash
# Create a snapshot before starting
dex snapshot create "clean slate"

# Work with Claude on implementation
dex @-1 --format claude

# Get Gemini's architectural review with full context
dex @-1 --format gemini --depth extended

# Have Grok security audit just the auth changes
dex @-1 --path "src/auth/*" --prompt-template security
```

**Result**: Same context, multiple agents, zero waste.

##  Why DEX Exists

DEX was born from a simple insight: **Context is the bridge between AI agents.**

When you're using Claude for implementation, Gemini for system design reviews, and Grok for quick security checks, the challenge isn't the individual agents—it's connecting them. Each conversation happens in isolation, forcing you to manually reconstruct context every time.

DEX solves this by being a single context generation engine that:
- **Captures your code state** at any point in time
- **Formats it perfectly** for each agent's preferences
- **Tracks what changed** between conversations
- **Preserves the narrative** across your entire workflow

Think of DEX as the connective tissue that lets multiple AI agents work on your code as a team, not as isolated tools.

## Core Capabilities

### 1. 📸 **Snapshots** - Context Checkpoints That Save 70-90% Tokens
```bash
# Capture current state
dex snapshot create "working auth"

# After making changes, generate context of just what changed
dex @-1  # Only the delta - typically 90% smaller!
```

Instead of regenerating full context for each agent, capture checkpoints and share just the changes.

### 2. **Universal Context Generation** - One Source, Perfect Format For Each Agent
```bash
dex @-1 --format claude    # XML-structured context for Claude
dex @-1 --format gemini    # Clean markdown for Gemini's large window
dex @-1 --format gpt       # Optimized structure for GPT-4
dex @-1 --format grok      # JSON format for Grok's speed
```

### 3. **Precision Extraction** - Generate Exactly The Right Context
```bash
dex --depth focused   # Just changes - minimal tokens
dex --depth extended  # Changes with surrounding context
dex --depth full      # Complete files when needed
```

### 4. **Context-Aware Prompts** - Guide Each Agent's Focus
```bash
dex --prompt-template security   # Security-focused context
dex --prompt-template perf       # Performance-oriented context
dex prompts create "team-style"  # Your team's context standards
```

### 5. **Coming Soon: Visual Context Selection**
```bash
dex -i  # Interactive mode to visually craft perfect context
```

## Quick Start

```bash
# Install
npm install -g dex

# Initialize in your project
cd your-project
dex init

# Create your first snapshot
dex snapshot create "starting point"

# Make some changes, then extract
dex @-1  # Changes since last snapshot
```

##  Real Workflow: Connecting Your AI Team

Here's how DEX connects different AI agents through shared context:

```bash
# Start your feature - establish baseline context
dex snapshot create "pre-auth"

# Generate context for Claude to implement
dex @-1 --format claude
# ... implement auth with Claude ...

# Generate security-focused context for Gemini's review
dex @-1 --format gemini --prompt-template security
# ... Gemini spots an SQL injection risk using its large context window ...

# Generate focused context for Claude to fix just that issue
dex @-1 --path "src/auth/db.ts" --format claude

# Generate context for Grok's final performance review
dex @-1 --format grok --prompt-template perf

# Generate PR description from full context
dex snapshot diff pre-auth HEAD --format markdown > PR.md
```

Each agent gets the perfect context for its role, maintaining continuity across your entire workflow.

## More Examples

<details>
<summary><strong>Time-Based Snapshots</strong></summary>

```bash
# Reference by time
dex @2h   # Changes from 2 hours ago
dex @1d   # Changes from yesterday

# Reference by name
dex snapshot create "before-refactor"
dex before-refactor  # Use it like a git ref

# Manage snapshots
dex snapshot list
dex snapshot clean --older-than 7d
```
</details>

<details>
<summary><strong>Precise File Selection</strong></summary>

```bash
# Just TypeScript files
dex -t ts,tsx

# Just the API layer
dex -p "src/api/**"

# Exclude tests
dex -x "**/*.test.ts"

# Combine filters
dex @-1 -t ts -p "src/api" -x "*.test.ts" --format claude
```
</details>

<details>
<summary><strong>Custom Review Prompts</strong></summary>

Create `.dex/prompts/architecture.yml`:
```yaml
name: Architecture Review
description: Check architectural decisions
instructions: |
  Review these changes for:
  - Separation of concerns
  - Proper abstraction levels
  - API design consistency
```

Use it:
```bash
dex --prompt-template architecture
```
</details>

## Why Context Generation Matters

- **Token Efficiency**: Generate context once, save 70-90% on every subsequent agent
- **Workflow Continuity**: Maintain narrative thread across different AI conversations
- **Agent Specialization**: Let each AI focus on what it does best with perfect context
- **Time Savings**: No more manual copying or reconstructing conversations
- **Better Outcomes**: Agents build on each other's work instead of starting fresh

## Built for Context Generation

- **Precision Extraction**: Surgical context generation from any codebase
- **Format Agnostic**: Generates optimal context for any AI agent
- **State Tracking**: Maintains context continuity across sessions
- **Local First**: Your code and context never leave your machine
- **Extensible**: Add new formats and context patterns as needed

## Contributing

DEX is open source and we'd love your help:

- ⭐ [Star us on GitHub](https://github.com/scottbaggett/dex)
- 🐛 [Report bugs](https://github.com/scottbaggett/dex/issues)

## Who Needs DEX?

- **Multi-Agent Developers**: Using Claude + Gemini + Grok in your workflow
- **AI Workflow Optimizers**: Tired of losing context between conversations  
- **Token-Conscious Teams**: Spending too much on redundant context
- **Context Craftspeople**: Need precise control over what each agent sees
- **Workflow Automators**: Want to connect AI agents programmatically

---

<p align="center">
  <strong>Ready to connect your AI workflow?</strong><br/>
  <code>npm install -g dex</code>
</p>

<p align="center">
  The context generation engine for multi-agent development
</p>
