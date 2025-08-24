# Task 08: Resolve Package Name Conflict

## Problem
Package name "dex" is likely taken on npm. Need to use a scoped package name or find alternative.

## Current State
- package.json name: "dex"
- Binary name: "dex"
- No npm scope defined
- Potential conflict with existing packages

## Requirements
- Unique package name for npm
- Maintain "dex" as CLI command
- Clear, memorable package name
- Proper scoping if needed

## Implementation Plan

### Phase 1: Package Name Availability Check
1. Check npm for "dex" availability
2. Decide on naming strategy:
   - Scoped: `@scottbaggett/dex` or `@dexcli/dex`
   - Alternative: `dex-cli`, `dexcode`, `dextract`
3. Update package.json
4. Ensure binary name remains "dex"
5. Update documentation
6. Update repository references

## Detailed Implementation Steps

### 1. Commands to Check npm Availability

```bash
# Check if "dex" is available on npm
npm view dex

# Check multiple package names
npm view dex-cli
npm view dexcode
npm view codedex
npm view dextract

# Check scoped package availability
npm view @scottbaggett/dex
npm view @dexcli/dex
npm view @vibecoder/dex

# Alternative search command
npm search dex --searchopts=limit:20
```

**Expected Results:**
- If package exists: Shows package info
- If package doesn't exist: `npm ERR! code E404`

### 2. Step-by-Step package.json Updates

#### Option A: Scoped Package (@scottbaggett/dex)
```bash
# Current package.json name field
grep -n '"name"' package.json

# Update package.json with scoped name
```

**File Changes Required:**
```json
{
  "name": "@scottbaggett/dex",
  "bin": {
    "dex": "./dist/cli.js"
  }
}
```

#### Option B: Alternative Name (dex-cli)
```json
{
  "name": "dex-cli",
  "bin": {
    "dex": "./dist/cli.js"
  }
}
```

**Commands to Update:**
```bash
# Backup current package.json
cp package.json package.json.backup

# Update name field (replace with chosen name)
sed -i.bak 's/"name": "dex"/"name": "@scottbaggett\/dex"/' package.json

# Verify changes
cat package.json | grep -A 5 -B 5 "name"
```

### 3. Documentation Update Checklist

**Files to Update:**

#### README.md
```bash
# Current installation command
grep -n "npm install" README.md

# Update installation instructions
# FROM: npm install -g dex
# TO:   npm install -g @scottbaggett/dex
```

**Required Changes:**
- [ ] Installation command in README.md
- [ ] Package name references
- [ ] GitHub repository description
- [ ] Package keywords in package.json

#### Other Documentation Files
```bash
# Find all files mentioning package installation
rg -l "npm install.*dex" --type md

# Find package name references
rg -l '"dex"' --type json
rg -l "dex" docs/

# Update each file found
```

**Specific Updates Needed:**
```bash
# In README.md
sed -i.bak 's/npm install -g dex/npm install -g @scottbaggett\/dex/g' README.md
sed -i.bak 's/npm i -g dex/npm i -g @scottbaggett\/dex/g' README.md

# In docs/ files (if any)
find docs/ -name "*.md" -exec sed -i.bak 's/npm install -g dex/npm install -g @scottbaggett\/dex/g' {} \;
```

### 4. Testing the Scoped Package Installation

**Pre-Publication Testing:**
```bash
# Build the package
bun run build

# Pack the package locally
npm pack

# Test local installation
npm install -g ./scottbaggett-dex-*.tgz

# Verify dex command works
dex --version
dex --help

# Test core functionality
dex distill . --stdout

# Uninstall test package
npm uninstall -g @scottbaggett/dex
```

**Post-Package Update Testing:**
```bash
# Verify package.json is valid
npm pkg fix
bun install

# Run existing tests
bun test

# Type check
bun run typecheck

# Lint check
bun run lint
```

### 5. Publishing Dry-Run Commands

**Pre-Publication Checklist:**
```bash
# Verify npm authentication
npm whoami

# Check package contents
npm pack --dry-run

# Validate package.json
npm pkg validate

# Check for sensitive files
npm publish --dry-run
```

**Publishing Dry-Run:**
```bash
# Complete dry-run (shows what would be published)
npm publish --dry-run

# Check package size and contents
npm pack
tar -tzf scottbaggett-dex-*.tgz

# Verify all required files are included
echo "Expected files:"
echo "- dist/ (compiled code)"
echo "- package.json"
echo "- README.md"
echo "- LICENSE (if exists)"

# Clean up test files
rm *.tgz
```

**Final Publication Commands (run after approval):**
```bash
# Publish to npm (when ready)
npm publish

# Verify publication
npm view @scottbaggett/dex

# Test installation from npm
npm install -g @scottbaggett/dex
```

### 6. Rollback Plan (if needed)

```bash
# Restore original package.json
cp package.json.backup package.json

# Restore README.md
cp README.md.bak README.md

# Commit rollback
git add .
git commit -m "rollback: revert package name changes"
```

## Acceptance Criteria
- [ ] Package name is available on npm
- [ ] CLI command remains "dex"
- [ ] Package.json updated
- [ ] Documentation reflects new name
- [ ] Installation instructions updated
- [ ] No breaking changes for users

## Naming Options
1. **Scoped Package** (Recommended)
   - `@scottbaggett/dex` - personal scope
   - `@dexcli/dex` - organization scope
   - `@vibecoder/dex` - branded scope

2. **Alternative Names**
   - `dex-cli` - descriptive
   - `dexcode` - unique
   - `codedex` - memorable
   - `dextract` - function-based

## Files to Modify
- `package.json` - name field
- `README.md` - installation instructions
- Documentation files
- GitHub repository description

## Testing Requirements
- Verify npm publish dry-run
- Test installation with new name
- Ensure dex command works post-install
- Check for conflicts