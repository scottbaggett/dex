# Quick Start: AI-Assisted Context Generation

Get up and running with DEX's AI-powered features in 5 minutes.

## Step 1: Choose Your AI Provider

DEX supports multiple AI providers. Choose based on your needs:

- **Anthropic Claude** (Recommended): Best quality, good balance of cost/performance
- **OpenAI GPT**: Familiar, widely supported
- **Groq**: Ultra-fast inference, cost-effective
- **Ollama**: Free, runs locally, privacy-focused

## Step 2: Set Up API Key

### For Anthropic Claude
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### For OpenAI
```bash
export OPENAI_API_KEY="your-api-key-here"
```

### For Groq
```bash
export GROQ_API_KEY="your-api-key-here"
```

### For Ollama (Local)
```bash
# Install Ollama first: https://ollama.ai
ollama pull llama3
# No API key needed!
```

## Step 3: Test Your Setup

```bash
# Validate configuration
dex config validate

# Test AI connection
dex config test-ai

# View current settings
dex config show --ai
```

## Step 4: Try AI Features

### Bootstrap Command
Automatically select the most important files for understanding a codebase:

```bash
dex bootstrap
```

### Generate Command
Select files based on a specific task:

```bash
dex generate "help me understand the authentication system"
dex generate "show me the database layer"
dex generate "find the API endpoints"
```

### Smart Flags
Use AI with the main extract command:

```bash
# Enable AI file selection
dex --ai

# AI selection with custom prompt
dex --smart "analyze the testing setup"

# Preview without generating output
dex --smart "security review" --dry-run
```

## Step 5: Customize (Optional)

Create a `.dexrc` file to customize behavior:

```yaml
# .dexrc
ai:
  provider: anthropic
  model: claude-3-sonnet
  bootstrap:
    maxFiles: 25
    prompt: "Custom bootstrap prompt here"
```

## Common Commands

```bash
# Configuration
dex config show              # Show current config
dex config show --ai         # Show detailed AI config
dex config validate          # Check for issues
dex config test-ai           # Test AI connection

# AI-powered analysis
dex bootstrap                # Bootstrap new project
dex bootstrap --dry-run      # Preview file selection
dex bootstrap --clipboard    # Copy to clipboard
dex generate "task here"     # Task-specific analysis

# Integration with main command
dex --ai                     # Enable AI selection
dex --smart "prompt"         # Custom AI prompt
dex --dry-run --smart "..."  # Preview AI selection
```

## Tips

1. **Start with bootstrap**: `dex bootstrap` is the easiest way to get started
2. **Use dry-run**: Add `--dry-run` to preview selections without generating output
3. **Try different models**: Cheaper models (claude-3-haiku, gpt-3.5-turbo) work well for most tasks
4. **Check costs**: Use `dex config show --ai` to see pricing information
5. **Customize prompts**: Edit `.dexrc` to create custom templates

## Troubleshooting

**"AI provider is not configured"**
- Make sure you've set the correct environment variable
- Run `dex config validate` to check

**"No files selected"**
- Try increasing `maxFiles` in your configuration
- Check that your prompt is clear and specific

**"Request timeout"**
- Try a faster model (claude-3-haiku, gpt-3.5-turbo)
- Check your internet connection

**Need help?**
- Run `dex config --help` for configuration commands
- Run `dex bootstrap --help` for bootstrap options
- Check the full documentation in `docs/AI_CONFIGURATION.md`

## What's Next?

- Explore the full [AI Configuration Guide](AI_CONFIGURATION.md)
- Learn about [custom prompt templates](AI_CONFIGURATION.md#custom-templates)
- Set up [team configurations](AI_CONFIGURATION.md#team-configuration)
- Try [local AI with Ollama](AI_CONFIGURATION.md#ollama-local) for privacy