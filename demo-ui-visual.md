# DEX Interactive File Selector - Visual Examples

## Enhanced File Display

### Before (Old UI)
```
> [ ]    src/index.ts      M +10-5   2h ago   1.2K tok
  [ ]    src/utils.ts      A +45-0   5m ago   2.1K tok
  [ ]    src/config.ts     M +3-12   1d ago   0.8K tok
```

### After (New UI)
```
> [ ]    src/index.ts      ●M +10 -5   1.2KB   2h ago   1.2Kt
  [ ]    src/utils.ts      ?A +45 -0   2.1KB   5m ago   2.1Kt
  [ ]    src/config.ts     ○M  +3-12   856B    1d ago   0.8Kt
```

**Legend:**
- `●` = Staged file
- `○` = Unstaged file
- `?` = Untracked file
- File size shown in human-readable format (KB, MB, etc.)
- Status letters colored: A=green, M=yellow, D=red

## Directory Headers with Status Summary

### Before
```
> [□] src/ (12 files, 15.2K tokens) ────── all
```

### After
```
> [□] src/ (12 files, 45.3KB, 15.2K tokens) [5● 3○ 4?] ────── all
```

Shows:
- Total file size
- Status breakdown: 5 staged, 3 unstaged, 4 untracked

## Sort Menu (Press 's')

```
┌─────────────────────────────────────────┐
│ DEX Interactive Mode - 42 files         │
└─────────────────────────────────────────┘

Sort Files By:

> name ✓
  updated
  size
  status

Press ENTER to select, ESC to cancel
```

## Filter Menu (Press 'f')

```
┌─────────────────────────────────────────┐
│ DEX Interactive Mode - 42 files         │
└─────────────────────────────────────────┘

Filter Files:

  all ✓
> staged
  unstaged
  untracked
  modified
  added
  deleted

Press ENTER to select, ESC to cancel
```

## Complete UI Example - Sorted by Size, Filtered by Staged

```
┌─────────────────────────────────────────────────────────────────┐
│ DEX Interactive Mode - 12 files [staged] [sorted by size]        │
└─────────────────────────────────────────────────────────────────┘

Select files to include in extraction
[Directories select all files within]

     File Path                          S  +/-    Size   Last    Tokens

> [■] src/core/ (3 files, 125.4KB, 42.1K tokens) [3●] ────── all
  [✓]   src/core/parser.ts             ●M +89-12  89.2KB  1h ago  35.2Kt
  [ ]   src/core/engine.ts             ●M +45-23  32.1KB  3h ago   5.8Kt
  [✓]   src/core/utils.ts              ●A +12 -0   4.1KB  5h ago   1.1Kt

  [□] src/utils/ (2 files, 15.2KB, 4.2K tokens) [2●] ────── all
  [ ]   src/utils/logger.ts            ●M +23 -5   9.8KB  2d ago   2.9Kt
  [ ]   src/utils/config.ts            ●M  +8 -2   5.4KB  3d ago   1.3Kt

  [x] test/ (1 file, 8.5KB, 2.1K tokens) [1●] ────── all
  [✓]   test/parser.test.ts            ●A +156-0   8.5KB  30m ago  2.1Kt

┌──────────────────────────────────────────────────────────────────┐
│ Selected: 3 files | 257 additions | 12 deletions | ~38.4K tokens │
└──────────────────────────────────────────────────────────────────┘

↑↓ move | SPACE select | a/n all/none | s sort | f filter | c copy | ENTER confirm | ESC cancel
```

## Key Improvements Visualized

### 1. Folder Sorting
When sorted by size, folders with larger total file sizes appear first:
```
[■] src/core/ (3 files, 125.4KB, 42.1K tokens) [3●]   <- Largest folder
[□] src/utils/ (2 files, 15.2KB, 4.2K tokens) [2●]
[x] test/ (1 file, 8.5KB, 2.1K tokens) [1●]          <- Smallest folder
```

### 2. Clear Status Visibility
Each file shows its git status with color coding:
```
●M  - Staged Modified (green dot, yellow M)
○M  - Unstaged Modified (white dot, yellow M)
?A  - Untracked Added (gray ?, green A)
●D  - Staged Deleted (green dot, red D)
```

### 3. File Size Display
Actual file sizes help understand why sorting works as it does:
```
src/core/parser.ts    89.2KB  <- Largest file when sorted by size
src/core/engine.ts    32.1KB
src/utils/logger.ts    9.8KB
src/utils/config.ts    5.4KB
src/core/utils.ts      4.1KB  <- Smallest file
```

### 4. Simplified Controls
Only essential commands shown, context-aware:
- File mode: `↑↓ move | SPACE select | a/n all/none | s sort | f filter | c copy | ENTER confirm | ESC cancel`
- Menu mode: `↑↓ select option | ENTER apply | ESC back`
