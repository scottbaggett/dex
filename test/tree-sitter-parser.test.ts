import { describe, it, expect, beforeEach } from 'vitest';
import { HybridParser } from '../src/core/parser/hybrid-parser';
import { RegexParser } from '../src/core/parser/regex-parser';

describe('RegexParser', () => {
  let parser: RegexParser;

  beforeEach(async () => {
    parser = new RegexParser();
    await parser.initialize();
  });

  it('should support TypeScript language', () => {
    expect(parser.isLanguageSupported('typescript')).toBe(true);
  });

  it('should extract TypeScript exports using regex', async () => {
    const code = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export class User {
  constructor(public name: string) {}
  
  getName(): string {
    return this.name;
  }
}

export interface Config {
  apiUrl: string;
  timeout: number;
}
`;

    const parsed = await parser.parse(code, 'typescript');
    parsed.path = 'test.ts';
    
    const extracted = parser.extract(parsed, 'public');
    
    expect(extracted.file).toBe('test.ts');
    expect(extracted.exports.length).toBeGreaterThan(0);
    
    const functionExport = extracted.exports.find((e: any) => e.name === 'greet');
    expect(functionExport).toBeDefined();
    expect(functionExport?.type).toBe('function');
    expect(functionExport?.visibility).toBe('public');
  });
});

describe('HybridParser', () => {
  let parser: HybridParser;

  beforeEach(async () => {
    parser = new HybridParser();
    await parser.initialize();
  });

  it('should fall back to regex for unsupported languages', async () => {
    const code = `
function test() {
  console.log('test');
}
`;

    // Use a language not supported by Tree-sitter
    const parsed = await parser.parse(code, 'unsupported');
    expect(parsed.ast).toBeNull(); // Regex parser doesn't provide AST
  });

  it('should list supported languages from both parsers', () => {
    const languages = parser.getSupportedLanguages();
    expect(languages).toContain('typescript');
    expect(languages).toContain('javascript');
    expect(languages).toContain('python');
  });

  it('should extract code using regex fallback', async () => {
    const code = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

    const parsed = await parser.parse(code, 'typescript');
    parsed.path = 'test.ts';
    
    const extracted = parser.extract(parsed, 'public');
    
    expect(extracted.file).toBe('test.ts');
    expect(extracted.exports.length).toBeGreaterThan(0);
  });
});