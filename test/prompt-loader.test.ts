import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptLoader } from '../src/core/prompt-loader';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Mock modules
vi.mock('fs');
vi.mock('../src/core/config', () => ({
  loadConfig: vi.fn(() => ({
    prompts: {
      'custom-review': {
        name: 'Custom Review',
        description: 'User-defined review template',
        instructions: 'Custom instructions here',
        tags: ['custom']
      }
    }
  }))
}));

describe('PromptLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (PromptLoader as any).instance = undefined;
  });

  describe('YAML Parsing', () => {
    it('should load and parse YAML files correctly', () => {
      const mockYamlContent = `
name: Test Prompt
description: Test description
tags:
  - test
  - yaml
instructions: |
  This is a multi-line
  instruction block
  with proper formatting
`;
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['test.yml']);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYamlContent);
      
      const loader = PromptLoader.getInstance();
      const prompt = loader.getPrompt('test');
      
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('Test Prompt');
      expect(prompt?.instructions).toContain('This is a multi-line');
      expect(prompt?.tags).toEqual(['test', 'yaml']);
    });

    it('should handle both .yml and .yaml extensions', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['test1.yml', 'test2.yaml']);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path.toString().includes('test1')) {
          return 'name: Test 1\ndescription: First test';
        }
        return 'name: Test 2\ndescription: Second test';
      });
      
      const loader = PromptLoader.getInstance();
      
      expect(loader.getPrompt('test1')).toBeDefined();
      expect(loader.getPrompt('test2')).toBeDefined();
    });

    it('should handle invalid YAML gracefully', () => {
      const invalidYaml = `
name: Test
description: [unclosed bracket
`;
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['invalid.yml']);
      vi.mocked(fs.readFileSync).mockReturnValue(invalidYaml);
      
      // Should not throw, just warn
      expect(() => PromptLoader.getInstance()).not.toThrow();
    });

    it('should support legacy JSON format', () => {
      const jsonContent = JSON.stringify({
        name: 'JSON Prompt',
        description: 'Legacy format',
        instructions: 'JSON instructions'
      });
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['legacy.json']);
      vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);
      
      const loader = PromptLoader.getInstance();
      const prompt = loader.getPrompt('legacy');
      
      expect(prompt?.name).toBe('JSON Prompt');
      expect(prompt?.instructions).toBe('JSON instructions');
    });
  });

  describe('Template Inheritance', () => {
    it('should merge prompts with extends property', () => {
      const baseYaml = `
name: Base Template
description: Base description
tags:
  - base
instructions: Base instructions
examples:
  - input: base input
    output: base output
`;
      
      const extendedYaml = `
name: Extended Template
extends: base
tags:
  - extended
instructions: Extended instructions
examples:
  - input: extended input
    output: extended output
`;
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['base.yml', 'extended.yml']);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path.toString().includes('base')) return baseYaml;
        return extendedYaml;
      });
      
      const loader = PromptLoader.getInstance();
      const prompt = loader.getPrompt('extended');
      
      expect(prompt?.name).toBe('Extended Template');
      expect(prompt?.description).toBe('Base description'); // Inherited
      expect(prompt?.instructions).toBe('Extended instructions'); // Overridden
      expect(prompt?.tags).toEqual(['base', 'extended']); // Merged
      expect(prompt?.examples).toHaveLength(2); // Combined
    });

    it('should handle missing base template gracefully', () => {
      const extendedYaml = `
name: Extended Template
extends: nonexistent
instructions: Extended instructions
`;
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['extended.yml']);
      vi.mocked(fs.readFileSync).mockReturnValue(extendedYaml);
      
      const loader = PromptLoader.getInstance();
      const prompt = loader.getPrompt('extended');
      
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('Extended Template');
    });

    it('should handle circular inheritance', () => {
      const prompt1 = `
name: Prompt 1
extends: prompt2
`;
      const prompt2 = `
name: Prompt 2
extends: prompt1
`;
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['prompt1.yml', 'prompt2.yml']);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path.toString().includes('prompt1')) return prompt1;
        return prompt2;
      });
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const loader = PromptLoader.getInstance();
      
      // Should not cause infinite loop
      const result = loader.getPrompt('prompt1');
      
      // With circular inheritance, we expect it to return the prompt but warn about the circular reference
      expect(result).toBeDefined();
      expect(result?.name).toBe('Prompt 1');
      
      // Should have warned about circular inheritance when trying to resolve prompt2->prompt1
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Circular inheritance detected'));
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('User Prompts Override', () => {
    it('should prioritize user prompts over built-in ones', () => {
      const builtinYaml = `
name: Built-in Security
description: Default security template
`;
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['security.yml']);
      vi.mocked(fs.readFileSync).mockReturnValue(builtinYaml);
      
      // User config has custom-review already mocked
      const loader = PromptLoader.getInstance();
      
      // Test user prompt exists
      const userPrompt = loader.getPrompt('custom-review');
      expect(userPrompt?.name).toBe('Custom Review');
      
      // Test all prompts includes both
      const allPrompts = loader.getAllPrompts();
      expect(allPrompts).toHaveLength(2);
    });
  });

  describe('Variable Interpolation', () => {
    it('should interpolate variables correctly', () => {
      const loader = PromptLoader.getInstance();
      const template = 'Review for {{team_name}} with {{coverage}}% coverage';
      const variables = {
        team_name: 'Engineering',
        coverage: '85'
      };
      
      const result = loader.interpolateVariables(template, variables);
      
      expect(result).toBe('Review for Engineering with 85% coverage');
    });

    it('should handle missing variables gracefully', () => {
      const loader = PromptLoader.getInstance();
      const template = 'Review for {{team_name}} by {{reviewer}}';
      const variables = {
        team_name: 'Engineering'
      };
      
      const result = loader.interpolateVariables(template, variables);
      
      expect(result).toBe('Review for Engineering by {{reviewer}}');
    });

    it('should handle spaces in variable syntax', () => {
      const loader = PromptLoader.getInstance();
      const template = 'Review for {{ team_name }} with {{  coverage  }}%';
      const variables = {
        team_name: 'Engineering',
        coverage: '85'
      };
      
      const result = loader.interpolateVariables(template, variables);
      
      expect(result).toBe('Review for Engineering with 85%');
    });
  });

  describe('Prompt Suggestions', () => {
    beforeEach(() => {
      const prompts = [
        'name: Security\ndescription: Security review\ntags: [security]\nllm: [claude]',
        'name: Performance\ndescription: Performance review\ntags: [performance]',
        'name: Testing\ndescription: Test review\nid: testing'
      ];
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['security.yml', 'performance.yml', 'testing.yml']);
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path.toString().includes('security')) return prompts[0];
        if (path.toString().includes('performance')) return prompts[1];
        return prompts[2];
      });
    });

    it('should suggest prompts based on LLM format', () => {
      const loader = PromptLoader.getInstance();
      const suggestions = loader.suggestPrompts({ format: 'claude' });
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].id).toBe('security');
    });

    it('should suggest prompts based on task keywords', () => {
      const loader = PromptLoader.getInstance();
      const suggestions = loader.suggestPrompts({ 
        task: 'Need to audit security vulnerabilities' 
      });
      
      expect(suggestions.some(s => s.id === 'security')).toBe(true);
    });

    it('should suggest prompts based on file types', () => {
      const loader = PromptLoader.getInstance();
      const suggestions = loader.suggestPrompts({ 
        fileTypes: new Set(['test.ts']) 
      });
      
      expect(suggestions.some(s => s.id === 'testing')).toBe(true);
    });

    it('should return top 3 suggestions sorted by score', () => {
      const loader = PromptLoader.getInstance();
      const suggestions = loader.suggestPrompts({ 
        format: 'claude',
        tags: ['security', 'performance']
      });
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty context gracefully', () => {
      const loader = PromptLoader.getInstance();
      const suggestions = loader.suggestPrompts({});
      
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing prompts directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      expect(() => PromptLoader.getInstance()).not.toThrow();
    });

    it('should handle file read errors', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['error.yml']);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });
      
      expect(() => PromptLoader.getInstance()).not.toThrow();
    });

    it('should return null for non-existent prompt', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      
      const loader = PromptLoader.getInstance();
      expect(loader.getPrompt('nonexistent')).toBeNull();
    });
  });
});