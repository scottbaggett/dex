# Making `dex` Magic - Implementation Roadmap

## Mission
Make it "dead simple to package up changes" for an AI.

## Philosophy  
Zero config, it just works.

## The Core Loop
When a developer thinks "I need to show this to my AI," they should just type `dex` and get the right thing.

---

## Consolidate the LLM-Specific Formatters

**Why Cut?** The LLM landscape is volatile. Maintaining bespoke formatters for every model is a losing battle. The subtle differences between them provide diminishing returns compared to the maintenance cost. Users care more about the quality of the context than minor formatting tweaks.

**The Plan:** Double down on three robust, universal formats:

- **markdown**: The default, human-readable, and universally compatible format.
- **xml** (Claude-style): The best-in-class format for structured data that LLMs like Claude handle exceptionally well. Keep this as your "pro" format.
- **json**: Essential for interoperability and piping dex output into other tools.

**Result:** You'll have a more future-proof tool that's easier to maintain, and you can guide users to use prompt templates for model-specific instructions, which is a more flexible approach.

---

## Phase 1: Core Intelligence (The Magic Default Command)

### 1.1 Smart Detection Logic
- [ ] Implement session detection (check for `.dex/session` marker)
- [ ] Implement feature branch detection and merge-base finding
- [ ] Implement staged files detection
- [ ] Implement fallback to unstaged changes
- [ ] Add clear feedback messages for each detection case

**The Intelligence Hierarchy:**
1. **Active session?** → Diff from session start
2. **Feature branch?** → Diff from merge-base with main/master
3. **Staged files?** → Package staged only
4. **Else** → Package unstaged changes

### 1.2 Default Format Change
- [ ] Change default format from `markdown` to `xml`
- [ ] Update documentation to reflect new default
- [ ] Add migration note for existing users

### 1.3 Branch Intelligence
- [ ] Auto-detect main/master/develop as base branches
- [ ] Add `--base` flag for custom base branch
- [ ] Cache merge-base calculation for performance

---

## Phase 2: Session Management

### 2.1 Session Commands
- [ ] Implement `dex session start` command
- [ ] Implement `dex session end` command
- [ ] Implement `dex session status` command
- [ ] Store session state in `.dex/session.json`

### 2.2 Session Integration
- [ ] Integrate session detection into main `dex` command
- [ ] Add session info to metadata output
- [ ] Handle edge cases (nested sessions, abandoned sessions)

**The Session Workflow:**
```bash
dex session start    # Creates invisible snapshot, marks session beginning
dex                  # Now always diffs from session start
dex session end      # Cleans up session marker
```

---

## Phase 3: AI-Powered File Suggestions

### 3.1 Basic Suggestion Engine
- [ ] Add `--suggest` flag to main command
- [ ] Implement file relationship analyzer (without LLM first)
- [ ] Detect common patterns (test files, config files, interfaces)
- [ ] Create suggestion prompt interface

### 3.2 LLM Integration for Suggestions
- [ ] Add LLM provider abstraction (OpenAI, Anthropic, local)
- [ ] Implement context-aware prompting for file relationships
- [ ] Add `--suggest-query` for specific suggestion requests
- [ ] Cache suggestions for performance

**The Smart Suggestion Feature:**
```bash
# AI suggests related files
$ dex --suggest
✅ Analyzing changes in auth.js, api.js...
📎 Suggested additions:
   - src/interfaces/auth.interface.ts (implements AuthProvider)
   - src/config/auth.config.js (auth configuration)
   - tests/auth.test.js (test coverage)
   
Include suggested files? [Y/n]: y
✅ Packaged 5 files (2 changed + 3 suggested)
```

---

## Phase 4: Performance & Polish

### 4.1 Performance
- [ ] Optimize merge-base calculation with caching
- [ ] Add progress indicators for AI suggestions
- [ ] Implement suggestion result caching

### 4.2 User Experience
- [ ] Add interactive mode for suggestion selection
- [ ] Add `--yes` flag to auto-accept suggestions
- [ ] Improve error messages and edge case handling

### 4.3 Documentation
- [ ] Update README with new magic command behavior
- [ ] Add session workflow documentation
- [ ] Create suggestion feature guide

---

## The Dream Workflow

```bash
# Developer starts work
$ dex session start
✅ Started working session

# Makes changes, wants AI review
$ dex -c --suggest
✅ Packaged changes since session start (compared against main)
📎 AI suggests including 3 related files (auth.interface.ts, auth.test.js, auth.config.js)
Include? [Y/n]: y
✅ Packaged 8 files total (~3,200 tokens) to clipboard

# Paste into AI and get feedback

# Done with task
$ dex session end
✅ Session ended
```

This transforms dex from a "context extraction tool" into an "AI development companion" that understands developer workflow.