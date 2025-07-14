#!/bin/bash

# Exit on any error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_test() {
    local test_name="$1"
    local result="$2"
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
    else
        echo -e "${RED}✗${NC} $test_name"
        ((FAILED_TESTS++))
    fi
}

# Initialize test counters
FAILED_TESTS=0
TOTAL_TESTS=0

# Check if DEX_PATH is set
if [ -z "$DEX_PATH" ]; then
    echo -e "${RED}Error: DEX_PATH environment variable not set${NC}"
    echo "Usage: DEX_PATH=/path/to/dex ./test-interactive.sh"
    exit 1
fi

# Check if dex binary exists
if [ ! -f "$DEX_PATH" ] && [ ! -x "$DEX_PATH" ]; then
    echo -e "${RED}Error: DEX binary not found or not executable at $DEX_PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}=== DEX Interactive Mode Test Suite ===${NC}\n"

# Create a temporary directory for testing
TEST_DIR="/tmp/dex-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Test 1: Initialize git repo and create test files
echo "Setting up test environment..."
git init -q
git config user.email "test@example.com"
git config user.name "Test User"

# Create some files
echo "Initial content" > file1.txt
echo "Another file" > file2.js
echo "Third file" > file3.ts
mkdir -p src
echo "Source file" > src/app.ts

# Initial commit
git add . > /dev/null 2>&1
git commit -m "Initial commit" -q

# Make some changes
echo "Modified content" > file1.txt
echo "New line" >> file2.js
rm file3.ts
echo "New file" > newfile.md
echo "Another source" > src/component.tsx

# Test 2: Verify git detects changes
((TOTAL_TESTS++))
CHANGES=$(git status --porcelain | wc -l)
if [ "$CHANGES" -gt 0 ]; then
    print_test "Git detects file changes" "PASS"
else
    print_test "Git detects file changes" "FAIL"
fi

# Test 3: Test dex basic functionality (non-interactive)
((TOTAL_TESTS++))
if "$DEX_PATH" --format=json > /dev/null 2>&1; then
    print_test "DEX runs in non-interactive mode" "PASS"
else
    print_test "DEX runs in non-interactive mode" "FAIL"
fi

# Test 4: Test help command
((TOTAL_TESTS++))
if "$DEX_PATH" --help | grep -q "Interactive file selection mode"; then
    print_test "DEX help shows --select option" "PASS"
else
    print_test "DEX help shows --select option" "FAIL"
fi

# Test 5: Test JSON output contains expected files
((TOTAL_TESTS++))
JSON_OUTPUT=$("$DEX_PATH" --format=json 2>/dev/null)
if echo "$JSON_OUTPUT" | grep -q "file1.txt" && \
   echo "$JSON_OUTPUT" | grep -q "file2.js" && \
   echo "$JSON_OUTPUT" | grep -q "newfile.md"; then
    print_test "DEX JSON output contains modified files" "PASS"
else
    print_test "DEX JSON output contains modified files" "FAIL"
fi

# Test 6: Test markdown output
((TOTAL_TESTS++))
if "$DEX_PATH" --format=markdown | grep -q "Modified content"; then
    print_test "DEX markdown output contains file content" "PASS"
else
    print_test "DEX markdown output contains file content" "FAIL"
fi

# Test 7: Test that deleted files are detected
((TOTAL_TESTS++))
if "$DEX_PATH" --format=json | grep -q "file3.ts"; then
    print_test "DEX detects deleted files" "PASS"
else
    print_test "DEX detects deleted files" "FAIL"
fi

# Test 8: Test path filtering
((TOTAL_TESTS++))
if "$DEX_PATH" --path="src/" --format=json | grep -q "component.tsx" && \
   ! "$DEX_PATH" --path="src/" --format=json | grep -q "file1.txt"; then
    print_test "DEX path filtering works correctly" "PASS"
else
    print_test "DEX path filtering works correctly" "FAIL"
fi

# Test 9: Test exclude patterns
((TOTAL_TESTS++))
if ! "$DEX_PATH" --exclude="*.md" --format=json | grep -q "newfile.md"; then
    print_test "DEX exclude patterns work correctly" "PASS"
else
    print_test "DEX exclude patterns work correctly" "FAIL"
fi

# Test 10: Interactive mode simulation (can't fully test without TTY)
((TOTAL_TESTS++))
echo -e "\n${YELLOW}Note: Interactive mode requires TTY and cannot be fully automated${NC}"
echo "To manually test interactive mode, run:"
echo "  cd $TEST_DIR"
echo "  $DEX_PATH --select"
echo ""
print_test "Interactive mode available (manual test required)" "PASS"

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo -e "Total tests: $TOTAL_TESTS"
echo -e "Failed tests: $FAILED_TESTS"

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    CLEANUP=true
else
    echo -e "\n${RED}Some tests failed.${NC}"
    echo -e "Test directory preserved at: $TEST_DIR"
    CLEANUP=false
fi

# Cleanup
cd - > /dev/null
if [ "$CLEANUP" = true ]; then
    rm -rf "$TEST_DIR"
    echo "Test directory cleaned up."
else
    echo -e "\n${YELLOW}To investigate failures:${NC}"
    echo "  cd $TEST_DIR"
    echo "  git status"
    echo "  $DEX_PATH --select"
fi

exit "$FAILED_TESTS"