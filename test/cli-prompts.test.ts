import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import * as os from 'os';

describe('CLI Prompts Commands', () => {
  let testDir: string;
  const dexBin = join(__dirname, '..', 'bin', 'dex');

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(os.tmpdir(), `dex-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'prompts'), { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const runCommand = (args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
    return new Promise((resolve) => {
      const proc = spawn('node', [dexBin, ...args], {
        cwd: testDir,
        env: { ...process.env, NO_COLOR: '1' } // Disable colors for testing
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
    });
  };

  describe('prompts list', () => {
    it('should list available prompts', async () => {
      const { stdout, code } = await runCommand(['prompts', 'list']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Available Prompt Templates');
      expect(stdout).toContain('security');
      expect(stdout).toContain('performance');
      expect(stdout).toContain('Use: dex --prompt-template <id>');
    });

    it.skip('should filter prompts by tags', async () => {
      const { stdout, code } = await runCommand(['prompts', 'list', '-t', 'security']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('security');
      expect(stdout).not.toContain('performance'); // Performance shouldn't show when filtering by security tag
      expect(stdout).not.toContain('refactor'); // Refactor shouldn't show either
    });

    it('should show verbose information with -v flag', async () => {
      const { stdout, code } = await runCommand(['prompts', 'list', '-v']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Recommended for:'); // Only shown in verbose mode
    });

    it.skip('should handle empty results gracefully', async () => {
      const { stdout, code } = await runCommand(['prompts', 'list', '-t', 'nonexistent-tag-xyz123']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('No prompt templates found matching criteria');
    });
  });

  describe('prompts show', () => {
    it('should show prompt details', async () => {
      const { stdout, code } = await runCommand(['prompts', 'show', 'security']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Prompt Template: Security Audit');
      expect(stdout).toContain('ID:');
      expect(stdout).toContain('Description:');
      expect(stdout).toContain('Prompt Instructions:');
    });

    it('should show example with -e flag', async () => {
      const { stdout, code } = await runCommand(['prompts', 'show', 'security', '-e']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Example with sample context:');
    });

    it('should handle non-existent prompt', async () => {
      const { stdout, stderr, code } = await runCommand(['prompts', 'show', 'nonexistent']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('Prompt template \'nonexistent\' not found');
      expect(stdout).toContain('Run "dex prompts list" to see available templates.');
    });

    it('should show inherited properties', async () => {
      // Create a custom prompt that extends base-review
      const customPrompt = `
name: Custom Review
extends: base-review
tags:
  - custom
instructions: |
  Custom instructions here
`;
      writeFileSync(join(testDir, 'prompts', 'custom.yml'), customPrompt);
      
      const { stdout, code } = await runCommand(['prompts', 'show', 'feature']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Extends:');
      expect(stdout).toContain('base-review');
    });
  });

  describe('prompts init', () => {
    it('should create a new prompt template', async () => {
      const { stdout, code } = await runCommand(['prompts', 'init', 'My Custom Template']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Prompt Template for \'My Custom Template\'');
      expect(stdout).toContain('# my-custom-template.yml');
      expect(stdout).toContain('name: My Custom Template');
      expect(stdout).toContain('instructions: |');
    });

    it('should support extending existing prompt', async () => {
      const { stdout, code } = await runCommand(['prompts', 'init', 'Extended Security', '-e', 'security']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('extends: security');
    });

    it('should handle invalid base prompt', async () => {
      const { stderr, code } = await runCommand(['prompts', 'init', 'Test', '-e', 'nonexistent']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('Base prompt template \'nonexistent\' not found');
    });

    it('should write to file with -o flag', async () => {
      const outputPath = join(testDir, 'my-prompt.json');
      const { stdout, code } = await runCommand(['prompts', 'init', 'Test Prompt', '-o', outputPath]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Created prompt template at:');
      expect(existsSync(outputPath)).toBe(true);
    });

    it('should handle directory output path', async () => {
      const outputDir = join(testDir, 'templates');
      mkdirSync(outputDir);
      
      const { stdout, code } = await runCommand(['prompts', 'init', 'Test', '-o', outputDir]);
      
      expect(code).toBe(0);
      expect(existsSync(join(outputDir, 'test.json'))).toBe(true);
    });
  });

  describe('--prompt-template flag integration', () => {
    it.skip('should use specified prompt template', async () => {
      // Create a test git repo with a change
      await runCommand(['git', 'init']);
      writeFileSync(join(testDir, 'test.js'), 'console.log("test");');
      await runCommand(['git', 'add', '.']);
      await runCommand(['git', 'commit', '-m', 'Initial commit']);
      
      // Make a change
      writeFileSync(join(testDir, 'test.js'), 'console.log("modified");');
      
      const { stdout, code } = await runCommand(['--prompt-template', 'security']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Perform a thorough security audit');
    });

    it.skip('should handle non-existent template gracefully', async () => {
      // Create a test git repo
      await runCommand(['git', 'init']);
      writeFileSync(join(testDir, 'test.js'), 'console.log("test");');
      
      const { stdout, code } = await runCommand(['--prompt-template', 'nonexistent']);
      
      expect(code).toBe(0);
      // Should fall back to default prompt generation
      expect(stdout).toContain('Review');
    });
  });

  describe('Custom prompts from .dexrc', () => {
    it('should load prompts from .dexrc', async () => {
      const dexrc = {
        prompts: {
          'team-review': {
            name: 'Team Review',
            description: 'Our team review process',
            instructions: 'Follow team guidelines'
          }
        }
      };
      
      writeFileSync(join(testDir, '.dexrc'), JSON.stringify(dexrc, null, 2));
      
      const { stdout, code } = await runCommand(['prompts', 'list']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('team-review');
      expect(stdout).toContain('Team Review');
    });

    it('should override built-in prompts', async () => {
      const dexrc = {
        prompts: {
          'security': {
            name: 'Custom Security Override',
            description: 'Overridden security template',
            instructions: 'Custom security checks'
          }
        }
      };
      
      writeFileSync(join(testDir, '.dexrc'), JSON.stringify(dexrc, null, 2));
      
      const { stdout, code } = await runCommand(['prompts', 'show', 'security']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Custom Security Override');
    });
  });

  describe('YAML file loading', () => {
    it.skip('should load custom YAML prompts from project', async () => {
      const customYaml = `
name: Project Specific Review
description: Custom prompt for this project
tags:
  - project
  - custom
instructions: |
  This is a project-specific review template
  with multi-line instructions
  that should be preserved exactly
`;
      
      writeFileSync(join(testDir, 'prompts', 'project-review.yml'), customYaml);
      
      const { stdout, code } = await runCommand(['prompts', 'show', 'project-review']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Project Specific Review');
      expect(stdout).toContain('with multi-line instructions');
      expect(stdout).toContain('that should be preserved exactly');
    });
  });
});