# DEX Interactive File Selector - Enhanced UI Demo

## Overview

The DEX interactive file selector has been significantly improved with a cleaner, more organized interface featuring built-in sorting and filtering capabilities.

## Key Improvements

### 1. **Cleaner Interface**
- Reduced command clutter - only showing essential commands
- Contextual help that changes based on current mode
- Simplified keyboard shortcuts

### 2. **Built-in Sorting**
Press `s` to open the sort menu:
- **name** - Alphabetical order (default)
- **updated** - Most recently modified first
- **size** - Largest files first (by token count)
- **status** - Group by git status (added/modified/deleted)

### 3. **Built-in Filtering**
Press `f` to open the filter menu:
- **all** - Show all files (default)
- **staged** - Only staged files
- **unstaged** - Only unstaged changes
- **untracked** - Only untracked files
- **modified** - Only modified files
- **added** - Only added files
- **deleted** - Only deleted files

## Usage Examples

### Basic File Selection
```bash
# Launch interactive mode
dex extract --select

# Navigate with arrow keys or j/k
# Press SPACE to select/deselect files
# Press ENTER to confirm selection
```

### Sorting Files
```bash
# In interactive mode:
# 1. Press 's' to open sort menu
# 2. Use arrow keys to select sort option
# 3. Press ENTER to apply
# 4. Files are instantly re-sorted
```

### Filtering Files
```bash
# In interactive mode:
# 1. Press 'f' to open filter menu
# 2. Select filter option (e.g., "staged")
# 3. Press ENTER to apply
# 4. Only matching files are shown
```

### Combined Workflow
```bash
# Example: Select only staged files, sorted by size
dex extract --select
# Press 'f' → select "staged" → ENTER
# Press 's' → select "size" → ENTER
# Now viewing only staged files, largest first
```

## Keyboard Shortcuts

### File Selection Mode
- `↑↓` or `j/k` - Navigate files
- `SPACE` - Toggle selection
- `a` - Select all
- `n` - Select none
- `s` - Open sort menu
- `f` - Open filter menu
- `c` - Copy to clipboard on confirm
- `ENTER` - Confirm selection
- `ESC` - Cancel

### Menu Mode (Sort/Filter)
- `↑↓` - Navigate options
- `ENTER` - Apply selection
- `ESC` - Cancel and return

## UI Elements

### Header
Shows current mode, file count, and active filters/sorting:
```
┌─────────────────────────────────────────┐
│ DEX Interactive Mode - 42 files [staged] [sorted by size] │
└─────────────────────────────────────────┘
```

### File Display
Streamlined display with essential information:
```
  [✓]  src/index.ts      M +10-5   2h ago   1.2K tok
> [ ]  src/utils.ts      A +45-0   5m ago   2.1K tok
  [✓]  src/config.ts     M +3-12   1d ago   0.8K tok
```

### Status Bar
Shows selection summary and token estimates:
```
┌─────────────────────────────────────────┐
│ Selected: 2 files | 13 additions | 17 deletions | ~2.0K tokens │
└─────────────────────────────────────────┘
```

## CLI Integration

The enhanced UI works seamlessly with CLI options:

```bash
# Pre-sort files by modification time
dex extract --select --sort-by updated --sort-order desc

# Pre-filter to show only staged files
dex extract --select --filter-by staged

# Combine CLI and interactive options
dex extract --select --filter-by staged --sort-by size
```

## Tips

1. **Quick Review**: Use `f` → "modified" to see only changed files
2. **Large Projects**: Use `f` → "staged" to focus on ready changes
3. **Token Budget**: Sort by size to prioritize smaller files
4. **Recent Work**: Sort by "updated" to see latest changes first

## Implementation Details

The enhanced UI is implemented in:
- `/src/interactive/FileSelector.tsx` - Main UI component
- `/src/utils/file-selector.ts` - File selection logic
- `/src/cli.ts` - CLI option integration

The UI maintains all original functionality while providing a cleaner, more efficient workflow for file selection.