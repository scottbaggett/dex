# Dex User Guide: Unified Context Extraction

Dex provides a single, elegant interface for extracting code changes from any source - whether it's your working directory, git history, or snapshots. This guide will walk you through real-world use cases and show you how dex's unified design makes your workflow seamless.

## The Core Philosophy: One Command, Many Sources

At its heart, dex has one job: **extract code changes**. The beauty is in its simplicity:

```bash
dex [source]
```

That's it. The `source` can be:
- Nothing (current changes)
- A git reference (HEAD~3, main..feature)
- A time-based reference (@2h - files changed in last 2 hours)
- A snapshot reference (@-1, snapshot-id)
- A snapshot name ("baseline", "before-refactor")

## Understanding References

Dex uses the `@` symbol for special references that aren't git commits:

### Why @ Symbol?

The `@` symbol was chosen to:
1. **Distinguish from git** - Git uses `~` and `^` for relative commits (HEAD~1, HEAD^)
2. **Suggest "at" time** - @2h reads naturally as "at 2 hours ago"
3. **Avoid conflicts** - @ isn't used in git revision syntax

### Types of References

1. **Snapshot Relative Position**: `@-N`
   - `@-1` = Most recent snapshot
   - `@-2` = Second most recent snapshot
   - Like `HEAD~1` but for snapshots

2. **Time-Based File Changes**: `@<number><unit>`
   - `@5m` = All files changed in the last 5 minutes
   - `@2h` = All files changed in the last 2 hours
   - `@1d` = All files changed in the last day
   - Shows files modified within that time period based on filesystem timestamps

3. **Snapshot Direct ID**: The snapshot ID itself
   - `md26jujdhvdoj` = Specific snapshot by ID

4. **Snapshot Name Match**: Partial description match
   - `baseline` = Finds snapshot with "baseline" in description

### Git vs Snapshot References - Quick Comparison

```bash
# Git references
dex HEAD~1            # 1 commit ago
dex main..feature     # Changes between branches
dex abc123            # Specific commit

# Time-based references
dex @2h               # Files changed in last 2 hours
dex @30m              # Files changed in last 30 minutes

# Snapshot references  
dex @-1               # Last snapshot
dex baseline          # Named snapshot
```

The key insight: **both work identically with the `dex` command**. This unified interface is what makes dex elegant.

## Real-World Workflows

### 1. The Active Development Flow

You're actively coding and want to check your progress:

```bash
# What have I changed?
dex

# What did I stage?
dex -s

# Everything (staged + unstaged)
dex -a
```

**Why it's elegant**: No flags or subcommands needed. Just `dex` for your current state.

### 2. The Quick Save Flow

You're about to make risky changes and want a safety net without committing:

```bash
# Save current state
dex snapshot create -m "Before attempting OAuth refactor"

# Try your refactor...
# If it goes wrong, see what you changed:
dex @-1

# Or revert specific files by seeing the diff
dex @-1 | less
```

**Why it's elegant**: Snapshots integrate seamlessly. `@-1` works just like `HEAD~1` would for git.

### 3. The Time-Based Review Flow

"What have I been working on?"

```bash
# All files changed in the last 30 minutes
dex @30m

# All files changed in the last 2 hours  
dex @2h

# All files changed since yesterday
dex @1d
```

**Why it's elegant**: Natural time expressions show actual file changes based on modification times, not just snapshots. Perfect for "what did I just change?" without needing commits or snapshots.

### 4. The Checkpoint Flow

Working on a feature with multiple logical checkpoints:

```bash
# Start feature
dex snapshot create -m "Feature: Auth - Starting point" -t auth,baseline

# After implementing login
dex snapshot create -m "Feature: Auth - Login complete" -t auth,checkpoint

# After implementing OAuth  
dex snapshot create -m "Feature: Auth - OAuth complete" -t auth,checkpoint

# Review progress since baseline
dex baseline

# Review just the OAuth changes
dex "Login complete"

# Compare checkpoints
dex snapshot diff "Login complete" "OAuth complete"
```

**Why it's elegant**: Named snapshots work like lightweight branches without the git complexity.

### 5. The AI Pair Programming Flow

Working with AI assistants requires sending context efficiently:

```bash
# Initial context for AI
dex --full "*.ts" -f claude -c

# Quick iteration - only send changes since last AI interaction
dex @-1 -f claude -c

# Time-boxed context - "Here's what I've done in the last hour"
dex @1h -f claude -c
```

**Why it's elegant**: The same `dex` command adapts to your context needs. Add `-c` to copy, `-f` to format.

### 6. The Code Review Flow

Reviewing changes at different granularities:

```bash
# Review your branch
dex main..HEAD

# Review since morning standup
dex @8h

# Review a specific problematic commit
dex abc123^..abc123

# Review between snapshots
dex snapshot diff "pre-review" "post-review"
```

**Why it's elegant**: Git refs and snapshot refs work interchangeably.

### 7. The Debug Investigation Flow

Something broke and you need to find when:

```bash
# Create snapshots as you debug
dex snapshot create -m "Reproduction state" -t bug

# Make investigative changes...
dex @-1  # What did I change while investigating?

# Compare working vs broken states
dex snapshot diff "last-working" "Reproduction state"
```

**Why it's elegant**: Snapshots don't pollute git history with WIP commits.

## The Power of Unified References

The magic of dex is that these all work the same way:

```bash
dex                    # Current changes
dex HEAD~3             # Git: 3 commits ago
dex @-1                # Snapshot: Most recent
dex @2h                # Time: Files changed in last 2 hours
dex baseline           # Snapshot: Named
dex main..feature      # Git: Branch comparison
```

You don't need to remember different commands for different sources.

## Advanced Patterns

### Filtering Across Any Source

These options work regardless of your change source:

```bash
# Only TypeScript files from 2 hours ago
dex @2h -t ts,tsx

# Full file context for config files changed in last 3 commits  
dex HEAD~3 --full "*.config.*"

# Only changes in src/ since last snapshot
dex @-1 -p "src/**"
```

### Consistent Output Formats

Every source can output to any format:

```bash
# Current changes for Claude
dex -f claude

# Last snapshot for GPT
dex @-1 -f gpt  

# Git range for Gemini
dex main..HEAD -f gemini
```

### Universal Task Context

Add task context to any extraction:

```bash
# Current changes with task context
dex --task "Implementing user authentication"

# Snapshot with issue URL
dex @-1 --task https://github.com/org/repo/issues/123

# Git range with interactive task input
dex HEAD~5 -i
```

## Why This Design Matters

1. **Cognitive Simplicity**: One command to remember: `dex`
2. **Flexible Workflows**: Snapshots for quick saves, git for permanent history
3. **Time Awareness**: Natural time-based references (@30m, @2h, @1d)
4. **No Mode Switching**: Don't think about "am I in git mode or snapshot mode?"
5. **Compositional**: Options compose naturally regardless of source

## Quick Reference

### Change Sources
- `dex` - Current changes
- `dex -s` - Staged only
- `dex -a` - All (staged + unstaged)
- `dex HEAD~N` - Last N commits
- `dex @-N` - Nth most recent snapshot
- `dex @Xt` - Files changed in last X time (m/h/d/w/M)
- `dex <name>` - Snapshot by name/description
- `dex A..B` - Git range

### Universal Options
- `-f <format>` - Output format (claude, gpt, etc.)
- `-c` - Copy to clipboard
- `-p <pattern>` - Filter paths
- `-t <types>` - Filter file types
- `-d <depth>` - Context depth
- `--full <pattern>` - Include full files
- `--task <context>` - Add task context

### Snapshot Management
- `dex snapshot create -m "message"` - Create snapshot
- `dex snapshot list` - List snapshots
- `dex snapshot diff A B` - Compare snapshots
- `dex snapshot clean --older-than 7d` - Cleanup

## The Elegance in Practice

The beauty of dex is that it gets out of your way. You don't need to think about:
- "Should I commit this?"
- "Which command extracts from snapshots vs git?"
- "How do I format this for my AI?"

Instead, you just think:
- "What changes do I want to see?"
- "From when?"

And dex handles the rest with a single, consistent interface.