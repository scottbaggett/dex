import { Command } from 'commander';
import chalk from 'chalk';
import { getConfigSummary, isAIConfigured, getAPIKey } from '../core/ai-config';
import { validateConfig, loadAIConfig } from '../core/config';

export function createConfigCommand(): Command {
  const command = new Command('config');
  
  command
    .description('Manage DEX configuration')
    .action(() => {
      // Default action shows help
      command.outputHelp();
    });
  
  // Show current configuration
  command
    .command('show')
    .description('Show current configuration')
    .option('--ai', 'Show AI configuration details')
    .action(async (options) => {
      await showConfigCommand(options);
    });
  
  // Validate configuration
  command
    .command('validate')
    .description('Validate current configuration')
    .action(async () => {
      await validateConfigCommand();
    });
  
  // Test AI connection
  command
    .command('test-ai')
    .description('Test AI provider connection')
    .action(async () => {
      await testAICommand();
    });
  
  return command;
}

async function showConfigCommand(options: { ai?: boolean }): Promise<void> {
  console.log(chalk.cyan.bold('\n📋 DEX Configuration\n'));
  
  if (options.ai) {
    // Show detailed AI configuration
    const aiConfig = loadAIConfig();
    const summary = getConfigSummary(aiConfig);
    
    console.log(chalk.white('🤖 AI Configuration:'));
    console.log(chalk.white('─'.repeat(40)));
    console.log(chalk.white(`Provider: ${summary.provider}`));
    console.log(chalk.white(`Model: ${summary.model}`));
    console.log(chalk.white(`Configured: ${summary.configured ? chalk.green('✓ Yes') : chalk.red('✗ No')}`));
    
    if (summary.apiKeySource) {
      console.log(chalk.white(`API Key Source: ${summary.apiKeySource}`));
    } else if (summary.provider !== 'ollama') {
      console.log(chalk.yellow(`API Key: Not configured`));
      console.log(chalk.dim(`  Set ${aiConfig.providers[aiConfig.provider]?.apiKeyEnvVar} environment variable`));
    }
    
    if (summary.modelInfo) {
      console.log(chalk.white(`Model Info:`));
      console.log(chalk.dim(`  Name: ${summary.modelInfo.name}`));
      console.log(chalk.dim(`  Context Window: ${summary.modelInfo.contextWindow.toLocaleString()} tokens`));
      console.log(chalk.dim(`  Input Cost: $${summary.modelInfo.inputCost}/1M tokens`));
      if (summary.modelInfo.outputCost) {
        console.log(chalk.dim(`  Output Cost: $${summary.modelInfo.outputCost}/1M tokens`));
      }
    }
    
    console.log(chalk.white('\n🎯 Bootstrap Settings:'));
    console.log(chalk.white('─'.repeat(40)));
    console.log(chalk.white(`Max Files: ${aiConfig.bootstrap.maxFiles}`));
    console.log(chalk.white(`Include Priority: ${aiConfig.bootstrap.includePriority.join(', ')}`));
    console.log(chalk.white(`Prompt: ${aiConfig.bootstrap.prompt.substring(0, 100)}...`));
    
    console.log(chalk.white('\n⚡ Performance Settings:'));
    console.log(chalk.white('─'.repeat(40)));
    console.log(chalk.white(`Caching: ${aiConfig.performance.enableCaching ? 'Enabled' : 'Disabled'}`));
    console.log(chalk.white(`Cache TTL: ${aiConfig.performance.cacheTtl}s`));
    console.log(chalk.white(`Max Concurrent Requests: ${aiConfig.performance.maxConcurrentRequests}`));
    console.log(chalk.white(`Request Timeout: ${aiConfig.performance.requestTimeout}ms`));
    
  } else {
    // Show basic configuration
    const aiConfig = loadAIConfig();
    const summary = getConfigSummary(aiConfig);
    
    console.log(chalk.white('🤖 AI Provider:'));
    console.log(chalk.white(`  ${summary.provider}/${summary.model} ${summary.configured ? chalk.green('(configured)') : chalk.red('(not configured)')}`));
    
    console.log(chalk.white('\n💡 Use --ai flag for detailed AI configuration'));
    console.log(chalk.white('💡 Use "dex config validate" to check for issues'));
    console.log(chalk.white('💡 Use "dex config test-ai" to test AI connection'));
  }
  
  console.log('');
}

async function validateConfigCommand(): Promise<void> {
  console.log(chalk.cyan.bold('\n🔍 Validating Configuration\n'));
  
  const validation = validateConfig();
  
  if (validation.valid) {
    console.log(chalk.green('✅ Configuration is valid'));
  } else {
    console.log(chalk.red('❌ Configuration has issues:'));
    validation.errors.forEach(error => {
      console.log(chalk.red(`  • ${error}`));
    });
  }
  
  // Check AI configuration specifically
  const aiConfig = loadAIConfig();
  const isConfigured = isAIConfigured(aiConfig);
  
  if (isConfigured) {
    console.log(chalk.green('✅ AI provider is properly configured'));
  } else {
    console.log(chalk.yellow('⚠️  AI provider is not configured'));
    const providerConfig = aiConfig.providers[aiConfig.provider];
    if (providerConfig?.apiKeyEnvVar) {
      console.log(chalk.dim(`  Set the ${providerConfig.apiKeyEnvVar} environment variable`));
    }
  }
  
  console.log('');
}

async function testAICommand(): Promise<void> {
  console.log(chalk.cyan.bold('\n🧪 Testing AI Connection\n'));
  
  const aiConfig = loadAIConfig();
  const isConfigured = isAIConfigured(aiConfig);
  
  if (!isConfigured) {
    console.log(chalk.red('❌ AI provider is not configured'));
    const providerConfig = aiConfig.providers[aiConfig.provider];
    if (providerConfig?.apiKeyEnvVar) {
      console.log(chalk.dim(`Set the ${providerConfig.apiKeyEnvVar} environment variable and try again`));
    }
    return;
  }
  
  const apiKey = getAPIKey(aiConfig);
  const summary = getConfigSummary(aiConfig);
  
  console.log(chalk.white(`Testing ${summary.provider}/${summary.model}...`));
  
  if (apiKey) {
    console.log(chalk.green('✅ API key found'));
    console.log(chalk.dim(`Source: ${summary.apiKeySource}`));
  } else if (aiConfig.provider === 'ollama') {
    console.log(chalk.green('✅ Ollama (local deployment, no API key needed)'));
  } else {
    console.log(chalk.red('❌ No API key found'));
  }
  
  // TODO: Add actual API connection test when real AI integration is implemented
  console.log(chalk.yellow('⏳ Actual API connection testing will be available when AI integration is complete'));
  
  console.log('');
}