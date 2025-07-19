import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenEstimator } from '../src/core/token-estimator';

describe('TokenEstimator', () => {
  let tokenEstimator: TokenEstimator;
  
  beforeEach(() => {
    tokenEstimator = new TokenEstimator();
    tokenEstimator.clearCache();
  });
  
  it('should estimate tokens based on text length and language', async () => {
    // Test default language (4 chars per token)
    const englishText = 'This is a test string with 40 characters.';
    const englishTokens = await tokenEstimator.estimateTokens(englishText, 'claude-3-opus');
    expect(englishTokens).toBe(Math.ceil(englishText.length / 4));
    
    // Test JSON (5 chars per token)
    const jsonText = '{"name":"test","value":123}';
    const jsonTokens = await tokenEstimator.estimateTokens(jsonText, 'claude-3-opus', 'json');
    expect(jsonTokens).toBe(Math.ceil(jsonText.length / 5));
    
    // Test Chinese (1.5 chars per token)
    const chineseText = '这是一个测试字符串';
    const chineseTokens = await tokenEstimator.estimateTokens(chineseText, 'claude-3-opus', 'zh');
    expect(chineseTokens).toBe(Math.ceil(chineseText.length / 1.5));
  });
  
  it('should estimate file tokens based on file extension', async () => {
    const jsContent = 'function test() { return "hello world"; }';
    const jsTokens = await tokenEstimator.estimateFileTokens('test.js', jsContent, 'claude-3-opus');
    expect(jsTokens).toBe(Math.ceil(jsContent.length / 4));
    
    const jsonContent = '{"name":"test","value":123}';
    const jsonTokens = await tokenEstimator.estimateFileTokens('config.json', jsonContent, 'claude-3-opus');
    expect(jsonTokens).toBe(Math.ceil(jsonContent.length / 5));
  });
  
  it('should calculate cost based on token count and model', () => {
    // Claude 3 Opus: $15 per 1M input tokens
    const opusCost = tokenEstimator.estimateCost(1000000, 'anthropic', 'claude-3-opus');
    expect(opusCost).toBe(15);
    
    // GPT-4: $10 per 1M input tokens
    const gpt4Cost = tokenEstimator.estimateCost(500000, 'openai', 'gpt-4');
    expect(gpt4Cost).toBe(5); // 500k tokens = $5
    
    // Unknown provider/model
    const unknownCost = tokenEstimator.estimateCost(1000000, 'unknown', 'model');
    expect(unknownCost).toBe(0);
  });
  
  it('should format cost as a string', () => {
    expect(tokenEstimator.formatCost(0.005)).toBe('< $0.01');
    expect(tokenEstimator.formatCost(0.01)).toBe('0.01');
    expect(tokenEstimator.formatCost(1.5)).toBe('1.50');
    expect(tokenEstimator.formatCost(10)).toBe('10.00');
  });
  
  it('should check if token count exceeds model limits', () => {
    // Claude 3 Opus: 200k token limit
    expect(tokenEstimator.exceedsModelLimit(150000, 'anthropic', 'claude-3-opus')).toBe(false);
    expect(tokenEstimator.exceedsModelLimit(250000, 'anthropic', 'claude-3-opus')).toBe(true);
    
    // GPT-4: 8k token limit
    expect(tokenEstimator.exceedsModelLimit(7000, 'openai', 'gpt-4')).toBe(false);
    expect(tokenEstimator.exceedsModelLimit(9000, 'openai', 'gpt-4')).toBe(true);
    
    // Unknown provider/model
    expect(tokenEstimator.exceedsModelLimit(1000000, 'unknown', 'model')).toBe(false);
  });
  
  it('should get model token limits', () => {
    expect(tokenEstimator.getModelTokenLimit('anthropic', 'claude-3-opus')).toBe(200000);
    expect(tokenEstimator.getModelTokenLimit('openai', 'gpt-4')).toBe(8192);
    expect(tokenEstimator.getModelTokenLimit('unknown', 'model')).toBe(0);
  });
  
  it('should calculate token limit percentage', () => {
    // Claude 3 Opus: 200k token limit
    expect(tokenEstimator.calculateTokenLimitPercentage(100000, 'anthropic', 'claude-3-opus')).toBe(50);
    expect(tokenEstimator.calculateTokenLimitPercentage(200000, 'anthropic', 'claude-3-opus')).toBe(100);
    
    // Unknown provider/model
    expect(tokenEstimator.calculateTokenLimitPercentage(1000, 'unknown', 'model')).toBe(0);
  });
  
  it('should format token count as a string', () => {
    expect(tokenEstimator.formatTokenCount(500)).toBe('500');
    expect(tokenEstimator.formatTokenCount(1500)).toBe('1.5k');
    expect(tokenEstimator.formatTokenCount(10000)).toBe('10.0k');
  });
  
  it('should use cache for repeated token estimations', async () => {
    const text = 'This is a test string that will be cached.';
    
    // First call should calculate and cache
    const firstEstimate = await tokenEstimator.estimateTokens(text, 'claude-3-opus');
    expect(firstEstimate).toBe(Math.ceil(text.length / 4));
    
    // Create a spy on the estimateTokens method
    const spy = vi.spyOn(tokenEstimator, 'estimateTokens');
    
    // Reset the spy call count
    spy.mockClear();
    
    // Second call should use cache and not recalculate
    const secondEstimate = await tokenEstimator.estimateTokens(text, 'claude-3-opus');
    expect(secondEstimate).toBe(firstEstimate);
    
    // Different model should calculate again
    const thirdEstimate = await tokenEstimator.estimateTokens(text, 'gpt-4');
    
    // Clear cache and verify recalculation
    tokenEstimator.clearCache();
    spy.mockClear();
    
    const fourthEstimate = await tokenEstimator.estimateTokens(text, 'claude-3-opus');
    expect(fourthEstimate).toBe(firstEstimate);
  });
});