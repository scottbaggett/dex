# AI Configuration Guide

This guide explains how to configure DEX for AI-assisted context generation.

## Quick Start

1. **Choose an AI Provider**: DEX supports Anthropic Claude, OpenAI GPT, Groq, and Ollama
2. **Set API Key**: Configure your API key via environment variable
3. **Test Configuration**: Use `dex config validate` to verify setup

## Supported AI Providers

### Anthropic Claude (Recommended)
- **Models**: claude-3-opus, claude-3-sonnet, claude-3-haiku
- **Environment Variable**: `ANTHROPIC_API_KEY`
- **Best For**: High-quality code analysis and reasoning

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### OpenAI GPT
- **Models**: gpt-4o, gpt-4, gpt-3.5-turbo
- **Environment Variable**: `OPENAI_API_KEY`
- **Best For**: General-purpose code analysis

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### Groq (Fast Inference)
- **Models**: llama-3-70b, llama-3-8b, mixtral-8x7b
- **Environment Variable**: `GROQ_API_KEY`
- **Best For**: Fast, cost-effective analysis

```bash
export GROQ_API_KEY="your-api-key-here"
```

### Ollama (Local)
- **Models**: llama3, codellama, mistral
- **Environment Variable**: `OLLAMA_API_KEY` (optional)
- **Best For**: Privacy-focused, offline usage

```bash
# No API key needed for local Ollama
# Just ensure Ollama is running on localhost:11434
```

## Configuration File

Create a `.dexrc` file in your project root or home directory:

### Basic Configuration

```yaml
# .dexrc
ai:
  provider: anthropic
  model: claude-3-sonnet
```

### Advanced Configuration

```yaml
# .dexrc
ai:
  # Provider settings
  provider: anthropic
  model: claude-3-sonnet
  
  # Bootstrap settings
  bootstrap:
    prompt: "I am a new agent joining this project. Help me understand the codebase architecture and key components."
    maxFiles: 25
    includePriority: [high, medium]
  
  # Interactive mode settings
  interactive:
    showReasoning: true
    groupByPriority: true
    preSelectHigh: true
    preSelectMedium: false
    autoAcceptThreshold: 0.8
  
  # Performance settings
  performance:
    enableCaching: true
    cacheTtl: 3600
    maxConcurrentRequests: 3
    requestTimeout: 30000
  
  # Custom templates
  templates:
    security: "Perform a comprehensive security review focusing on authentication, authorization, and data validation."
    performance: "Analyze for performance bottlenecks, memory usage, and optimization opportunities."
```

## Configuration Options

### Provider Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | string | `anthropic` | AI provider to use |
| `model` | string | `claude-3-sonnet` | Model to use for analysis |
| `apiKey` | string | - | API key (prefer environment variables) |

### Bootstrap Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prompt` | string | Default bootstrap prompt | Prompt for `dex bootstrap` command |
| `maxFiles` | number | `20` | Maximum files to select |
| `includePriority` | array | `[high, medium]` | Priority levels to include |

### Interactive Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showReasoning` | boolean | `true` | Show AI reasoning for file selection |
| `groupByPriority` | boolean | `true` | Group files by priority level |
| `preSelectHigh` | boolean | `true` | Pre-select high priority files |
| `preSelectMedium` | boolean | `false` | Pre-select medium priority files |
| `preSelectLow` | boolean | `false` | Pre-select low priority files |
| `autoAcceptThreshold` | number | `0.8` | Auto-accept threshold (0-1) |

### Performance Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableCaching` | boolean | `true` | Enable response caching |
| `cacheTtl` | number | `3600` | Cache TTL in seconds |
| `maxConcurrentRequests` | number | `3` | Max concurrent API requests |
| `requestTimeout` | number | `30000` | Request timeout in milliseconds |

## Environment Variables

### Required Environment Variables

| Provider | Environment Variable | Required |
|----------|---------------------|----------|
| Anthropic | `ANTHROPIC_API_KEY` | Yes |
| OpenAI | `OPENAI_API_KEY` | Yes |
| Groq | `GROQ_API_KEY` | Yes |
| Ollama | `OLLAMA_API_KEY` | No |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEX_AI_PROVIDER` | Override configured provider | - |
| `DEX_AI_MODEL` | Override configured model | - |
| `DEX_AI_MAX_FILES` | Override max files for bootstrap | - |

## Commands

### Configuration Management

```bash
# Show current configuration
dex config show

# Show detailed AI configuration
dex config show --ai

# Validate configuration
dex config validate

# Test AI connection
dex config test-ai
```

### AI-Powered Commands

```bash
# Bootstrap with AI file selection
dex bootstrap

# Generate context for specific task
dex generate "help me understand the authentication system"

# Use AI for file selection in main command
dex --ai
dex --smart "analyze the database layer"
```

## Model Comparison

### Anthropic Claude

| Model | Context Window | Input Cost | Output Cost | Best For |
|-------|----------------|------------|-------------|----------|
| claude-3-opus | 200K tokens | $15/1M | $75/1M | Complex analysis, highest quality |
| claude-3-sonnet | 200K tokens | $3/1M | $15/1M | Balanced performance and cost |
| claude-3-haiku | 200K tokens | $0.25/1M | $1.25/1M | Fast, cost-effective analysis |

### OpenAI GPT

| Model | Context Window | Input Cost | Output Cost | Best For |
|-------|----------------|------------|-------------|----------|
| gpt-4o | 128K tokens | $5/1M | $15/1M | Latest GPT-4 with vision |
| gpt-4 | 8K tokens | $30/1M | $60/1M | High-quality analysis |
| gpt-3.5-turbo | 16K tokens | $0.5/1M | $1.5/1M | Fast, affordable |

### Groq (Fast Inference)

| Model | Context Window | Input Cost | Output Cost | Best For |
|-------|----------------|------------|-------------|----------|
| llama-3-70b | 8K tokens | $0.59/1M | $0.79/1M | High quality, fast |
| llama-3-8b | 8K tokens | $0.05/1M | $0.08/1M | Ultra-fast, very cheap |
| mixtral-8x7b | 32K tokens | $0.24/1M | $0.24/1M | Good balance |

### Ollama (Local)

| Model | Context Window | Cost | Best For |
|-------|----------------|------|----------|
| llama3 | 8K tokens | Free | General analysis |
| codellama | 16K tokens | Free | Code-specific tasks |
| mistral | 8K tokens | Free | Lightweight analysis |

## Troubleshooting

### Common Issues

**"AI provider is not configured"**
- Set the appropriate environment variable for your provider
- Run `dex config validate` to check configuration

**"Invalid model for provider"**
- Check that the model is supported by your chosen provider
- Use `dex config show --ai` to see available models

**"Request timeout"**
- Increase `requestTimeout` in configuration
- Check your internet connection
- Try a different model or provider

**"Rate limit exceeded"**
- Reduce `maxConcurrentRequests` in configuration
- Add delays between requests
- Consider upgrading your API plan

### Getting Help

```bash
# Check configuration
dex config show --ai

# Validate setup
dex config validate

# Test connection
dex config test-ai

# View help
dex config --help
dex bootstrap --help
dex generate --help
```

## Examples

### Example 1: Basic Setup

```bash
# Set API key
export ANTHROPIC_API_KEY="your-key-here"

# Test configuration
dex config validate

# Bootstrap your project
dex bootstrap
```

### Example 2: Custom Configuration

```yaml
# .dexrc
ai:
  provider: openai
  model: gpt-4o
  bootstrap:
    maxFiles: 30
    prompt: "I'm a senior developer reviewing this codebase for security issues."
  interactive:
    preSelectMedium: true
    autoAcceptThreshold: 0.9
```

### Example 3: Team Configuration

```yaml
# .dexrc (committed to repo)
ai:
  provider: groq  # Fast and cost-effective for team use
  model: llama-3-70b
  bootstrap:
    maxFiles: 15
    includePriority: [high]
  performance:
    maxConcurrentRequests: 2  # Be nice to shared API limits
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for API keys
3. **Rotate API keys** regularly
4. **Monitor API usage** and costs
5. **Use least-privilege** API keys when possible
6. **Consider local models** (Ollama) for sensitive codebases

## Cost Management

1. **Start with cheaper models** (claude-3-haiku, gpt-3.5-turbo)
2. **Use caching** to avoid repeated requests
3. **Limit max files** for bootstrap operations
4. **Monitor usage** through provider dashboards
5. **Consider Groq** for high-volume, cost-sensitive use cases
6. **Use Ollama** for completely free local inference