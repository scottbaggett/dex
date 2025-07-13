# Interactive Mode Demo

The interactive mode allows you to input task descriptions directly in the terminal when running dex.

## Usage

```bash
# Start interactive mode
dex -i

# Or combine with other options
dex -i --staged
dex -i --since=main --format=claude
```

## Example Session

```
$ dex -i --staged

📝 Interactive Task Input Mode

Enter your task description (press Enter twice to finish):
Tip: Use multiple lines for detailed descriptions

▸ Fix the authentication bug in the login system
▸ 
▸ The OAuth2 token refresh logic is failing when tokens expire
▸ Need to implement proper retry logic and error handling
▸ 
▸ 

✓ Task description captured

⠋ Analyzing changes...
```

## Features

- **Multi-line Input**: Enter detailed task descriptions across multiple lines
- **Visual Prompts**: Clean blue arrow (▸) indicates input area
- **Easy Completion**: Press Enter twice to finish input
- **Animated Header**: Smooth entrance animation for better UX
- **Graceful Exit**: Press Ctrl+C to cancel at any time
- **Smart Detection**: Skips interactive mode if task is provided via other means

## When to Use

Interactive mode is perfect when:
- You want to provide detailed context without crafting command-line arguments
- You're copying task descriptions from other sources
- You need to format your task description with proper line breaks
- You prefer a more conversational input method

## Integration with Task Sources

Interactive mode works seamlessly with dex's task extraction system:
- Takes precedence when no other task source is provided
- Skips automatically if `--task`, `--task-file`, or `--task=-` is used
- The captured task is processed the same way as other task inputs