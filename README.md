# DEX
Context extraction and codebase analysis tool. Generate precise, token-efficient context for any AI agent or workflow.

<p align="center">
  <img src="https://img.shields.io/badge/Token_Efficiency-90%25_Reduction-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/AI_Agents-All_Major_LLMs-cyan?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Context-Surgically_Precise-cyan?style=for-the-badge" />
</p>

```bash

# Extract - analyze recent changes
dex HEAD~5..HEAD --format markdown

# Distill - compress entire codebase
dex distill .

# Visual API tree of your codebase structure
dex tree src/ --show-types --show-params

# Extract and track changes with snapshots
dex snapshot create "pre-refactor"
dex HEAD~3..HEAD --format xml --clipboard

# Distill entire codebase into token-efficient format
dex distill . --ai-action audit
```

**Result**: Precise context extraction with 90% token reduction, AI-powered file selection, and comprehensive codebase analysis.

## Why DEX?

DEX transforms how you work with AI agents by solving the context engineering problem:

- **🎯 Surgical Precision**: Extract exactly what matters, not everything
- **📊 Token Efficiency**: 90% reduction in token usage through smart compression
- **🌳 Visual Understanding**: Beautiful API trees and codebase structure visualization
- **⚡ Multi-Format**: Output optimized for any AI agent or workflow

## Quick Start

```bash
# Install
npm install -g dex

# Initialize in your project
cd your-project
dex init
dex -c
```

## Core Commands

### 🔍 Change Extraction

**Git-Based Extraction**
```bash
dex                          # Current uncommitted changes
dex -s                       # Staged changes only
dex HEAD~5..HEAD            # Last 5 commits
dex --since "2 hours ago"    # Time-based extraction
dex -p "src/api/**" -t ts    # Filter by path and type
```

**Interactive Selection**
```bash
dex --select                 # Visual file picker
dex --select --format json   # Interactive + custom format
```

### 🌳 Codebase Visualization

**API Trees**
```bash
dex tree src/                          # Visual API structure
dex tree src/ --show-types             # Include function signatures
dex tree src/ --format outline         # Different view format
dex tree . --group-by type --show-types # Organized by type with details
```

**Example Output:**
```
🌳 Generating API tree...

📦 Project API Structure
├── 📁 src/
│   ├── 📄 main.ts
│   │   └── 🚀 startServer() → Promise<Server>
│   ├── 📁 core/
│   │   ├── 📄 context-engine.ts
│   │   │   ├── 🏭 class ContextEngine
│   │   │   ├── ├── 🔧 constructor(options: EngineOptions)
│   │   │   ├── ├── 📤 extract(path: string) → Promise<Context>
│   │   │   └── └── 🔒 validateInput(input: any) → boolean
│   │   └── 📄 git-extractor.ts
│   │       ├── 🏭 class GitExtractor
│   │       ├── ├── 📤 getDiff(range: string) → Promise<GitDiff[]>
│   │       └── └── 📤 getCurrentBranch() → Promise<string>
│   ├── 📁 routes/
│   │   ├── 📄 auth.ts
│   │   │   ├── 📤 POST /auth/login
│   │   │   ├── 📤 POST /auth/logout
│   │   │   └── 📤 GET /auth/profile
│   │   └── 📄 api.ts
│   │       ├── 📤 GET /api/health
│   │       └── 📤 POST /api/extract
│   └── 📁 types/
│       └── 📄 index.ts
│           ├── 🔷 interface EngineOptions
│           ├── 🔷 interface GitDiff
│           └── 🔷 type OutputFormat = 'xml' | 'json' | 'markdown'

📊 Summary: 15 files, 23 exports, 8 classes, 12 functions, 5 interfaces
```

### 🗜️ Codebase Distillation

**Distillation**
```bash
dex distill .                         # Compress entire codebase
dex distill src/                      # Distill specific directory
dex distill . --since HEAD~10         # Only recent changes
```

**Example Output:**
```
🗜️ Distilling codebase...
📊 Processing 89 files...
⚡ Parallel extraction: 4 workers
🎯 Depth: public APIs only

# Codebase Distillation: MyApp

## Architecture Overview
- **Type**: Node.js/TypeScript web application
- **Structure**: Modular with core engine + plugin system
- **Entry Point**: src/main.ts → Express server on port 3000
- **Key Dependencies**: Express, TypeScript, simple-git

## Core Modules

### Context Engine (src/core/)
```typescript
// Primary extraction engine
class ContextEngine {
  extract(path: string): Promise<ExtractedContext>
  applyFilters(files: string[]): string[]
}

// Git operations wrapper
class GitExtractor {
  getDiff(range: string): Promise<GitDiff[]>
  getFileContents(path: string): Promise<string>
}
```

## Token Efficiency
- **Original size**: 847 files, ~2.1M characters
- **Distilled size**: 89 key files, ~180k characters
- **Compression ratio**: 91.4% reduction
- **Estimated tokens**: 45k → 4.2k (90% savings)

✅ Distillation saved to .dex/dex.distill.myapp.md
```

### 📋 File Combination

**Multi-File Context**
```bash
dex combine src/auth/ src/api/         # Combine directories
dex combine file1.ts file2.ts          # Combine specific files
dex combine . -t "*.config.*"          # Combine by pattern
dex combine -s                         # Combine all staged files (full content)
dex combine -s -c                      # Copy staged files to clipboard
```

**Staged Files Integration**
The `-s, --staged` flag provides full file content of all staged files (not just diffs like `dex -s`), making it perfect for comprehensive code review or sharing complete staged changes with AI agents. Use `-c` to copy directly to clipboard.

### 🎯 Session Tracking

**Work Session Management**
```bash
dex session start "feature-auth"      # Start tracking work
dex session status                    # Check current session
dex session end                       # End and summarize
```

## Advanced Features

### AI Configuration

**Provider Setup**
```bash
# Set your preferred AI provider
export ANTHROPIC_API_KEY=your-key    # For Claude
export OPENAI_API_KEY=your-key       # For GPT models
export GROQ_API_KEY=your-key         # For Groq models

# Configure in .dexrc
dex config set ai.provider anthropic
dex config set ai.model claude-3-sonnet
```

### Prompt Templates

**Built-in Templates**
```bash
dex --prompt-template security       # Security-focused analysis
dex --prompt-template performance    # Performance optimization
dex --prompt-template refactor       # Refactoring guidance
dex --prompt-template testing        # Test coverage analysis
```

**Custom Prompts**
```bash
dex prompts list                     # View available templates
dex --prompt "Custom analysis text"  # Direct prompt text
```

### Output Control

**Format Options**
```bash
dex --format xml                     # Structured XML (default)
dex --format markdown                # Clean markdown
dex --format json                    # Structured JSON
dex --format text                    # Plain text
```

**Output Destinations**
```bash
dex --clipboard                      # Copy to clipboard
dex --output custom.md               # Save to specific file
dex distill . --stdout               # Print to console
```

### Filtering & Selection

**Path & Type Filters**
```bash
dex -p "src/components/**"           # Specific paths
dex -t ts,tsx,js                     # File types
dex --full "*.config.*"              # Include full files matching pattern
dex --exclude "*.test.*" "*.spec.*"  # Exclude patterns
```

**Smart Filtering**
```bash
dex --include-untracked              # Include untracked files
dex --staged                         # Only staged files
dex --since HEAD~10                  # Only recent changes
```

## Configuration

### Project Configuration

Create `.dexrc` in your project root:


### Global Configuration

```bash
dex config set ai.provider openai
dex config set ai.model gpt-4
dex config set defaults.format markdown
dex config list                      # View all settings
```

## Output Files

DEX automatically saves outputs to `.dex/` with descriptive filenames:

```
.dex/
├── dex.extract.current.txt          # Current changes
├── dex.extract.staged.txt           # Staged changes
├── dex.distill.src.txt              # Distilled codebase
├── dex.tree.src.txt                 # API tree visualization
└── dex.combine.auth-api.txt         # Combined files
```

## Real-World Workflows


### 🔧 Feature Development

```bash
# 2. Analyze existing code
dex tree src/users/ --show-types

# 3. Extract relevant context for implementation
dex generate "implement user profile editing" --max-files 15

# 4. Track progress with snapshots
dex snapshot create "profiles-implemented"

# 5. Generate final context for review
dex session end
```

**Example Session Flow:**
```
$ dex session start "user-profiles"
🚀 Session started
   ID: sess_1704123456
   Branch: feature/user-profiles
   Starting commit: a1b2c3d
   Description: user-profiles

Session now tracking ALL changes (committed and uncommitted)
Use 'dex' to package everything you've worked on

$ dex tree src/users/ --show-types
🌳 Generating API tree...

📦 User System APIs
├── 📄 src/users/
│   ├── 📄 user.model.ts
│   │   ├── 🏭 class User extends BaseModel
│   │   ├── ├── 🔧 constructor(data: UserData)
│   │   ├── ├── 📤 updateProfile(data: ProfileData) → Promise<User>
│   │   ├── ├── 📤 uploadAvatar(file: File) → Promise<string>
│   │   └── └── 🔒 validateProfile(data: any) → ValidationResult
│   └── 📄 user.service.ts
│       ├── 📤 getUserById(id: string) → Promise<User>
│       ├── 📤 updateUserProfile(id: string, data: ProfileData) → Promise<User>
│       └── 📤 deleteUser(id: string) → Promise<void>

$ dex session end
⏹️  Session ended
   Duration: 2h 34m
   Description: user-profiles

📊 Session Summary:
   🟢 Added: 4 files
   🟡 Modified: 7 files
   📈 Total: +156 lines, -23 lines

✅ Full session context saved to .dex/dex.session.user-profiles.xml
```

### 🛡️ Security Audit

```bash

# 2. Focus on authentication components
dex -p "src/auth/**" --prompt-template security

# 3. Get visual overview of API surface
dex tree src/ --include-private --show-params
```

### 📊 Performance Analysis

```bash
# 1. Extract recent changes
dex HEAD~20..HEAD --prompt-template performance

# 2. Focus on hot paths
dex combine src/api/ src/db/ --prompt-template performance

# 3. Generate comprehensive performance review
dex distill . --ai-action analyze
```

## Token Efficiency

DEX is built for token efficiency:

- **Smart Extraction**: Only relevant changes and context
- **AI Selection**: Intelligent file prioritization
- **Compression**: Advanced distillation algorithms
- **Caching**: Avoid redundant AI calls
- **Snapshots**: Track only deltas between states

**Typical Results**:
- Full codebase: ~150K tokens → ~15K tokens (90% reduction)
- Change extraction: ~50K tokens → ~5K tokens (90% reduction)
- AI file selection: Perfect relevance with minimal tokens

## Requirements

- **Node.js**: 16.0.0 or higher
- **Git**: For change tracking and extraction
- **AI API Keys**: For AI-powered features (optional)

## Supported Languages

DEX works with any text-based language, with enhanced support for:
- TypeScript/JavaScript
- Python
- Go
- Java
- Rust
- C/C++
- And more via tree-sitter parsing

## Contributing

DEX is open source and contributions are welcome:

- ⭐ [Star us on GitHub](https://github.com/scottbaggett/dex)
- 🐛 [Report bugs](https://github.com/scottbaggett/dex/issues)
- 💡 [Request features](https://github.com/scottbaggett/dex/discussions)
- 🔧 [Submit pull requests](https://github.com/scottbaggett/dex/pulls)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Transform your AI workflow with precision context extraction</strong><br/>
  <code>npm install -g dex</code>
</p>

<p align="center">
  Context engineering for the AI age
</p>
