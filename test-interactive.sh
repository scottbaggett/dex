#!/bin/bash

# Create a temporary directory for testing
TEST_DIR="/tmp/dex-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize git repo
git init
git config user.email "test@example.com"
git config user.name "Test User"

# Create some files
echo "Initial content" > file1.txt
echo "Another file" > file2.js
echo "Third file" > file3.ts
mkdir src
echo "Source file" > src/app.ts

# Initial commit
git add .
git commit -m "Initial commit"

# Make some changes
echo "Modified content" > file1.txt
echo "New line" >> file2.js
rm file3.ts
echo "New file" > newfile.md
echo "Another source" > src/component.tsx

# Show what changed
echo "=== Git Status ==="
git status --short

# Run dex with interactive mode
echo -e "\n=== Running DEX Interactive Mode ===\n"
"$DEX_PATH" --select

# Cleanup
cd -
rm -rf "$TEST_DIR"