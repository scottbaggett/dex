import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

describe('Interactive Mode', () => {
  const cliPath = join(__dirname, '../dist/cli.js');
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should prompt for task input in interactive mode', (done) => {
    const dex = spawn('node', [cliPath, '-i', '--staged'], {
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let output = '';
    let errorOutput = '';

    dex.stdout.on('data', (data) => {
      output += data.toString();
      
      // Check if we see the interactive prompt
      if (output.includes('Interactive Task Input Mode')) {
        expect(output).toContain('Interactive Task Input Mode');
        expect(output).toContain('Enter your task description');
        
        // Send task input
        dex.stdin.write('Fix authentication bug\n');
        dex.stdin.write('Handle OAuth2 tokens properly\n');
        dex.stdin.write('\n\n'); // Two enters to finish
      }
      
      // Check if task was captured
      if (output.includes('Task description captured')) {
        expect(output).toContain('Task description captured');
        dex.kill();
        done();
      }
    });

    dex.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    dex.on('close', (code) => {
      if (code !== null && code !== 0 && code !== 137) { // 137 is SIGKILL
        console.error('CLI exited with code:', code);
        console.error('Error output:', errorOutput);
        done(new Error(`CLI exited with code ${code}`));
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      dex.kill();
      done(new Error('Test timed out'));
    }, 5000);
  });

  it('should handle Ctrl+C gracefully', (done) => {
    const dex = spawn('node', [cliPath, '-i', '--staged'], {
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let output = '';

    dex.stdout.on('data', (data) => {
      output += data.toString();
      
      // Once we see the prompt, send SIGINT
      if (output.includes('Interactive Task Input Mode')) {
        dex.kill('SIGINT');
      }
    });

    dex.on('close', (code) => {
      expect(output).toContain('Interactive Task Input Mode');
      done();
    });

    // Timeout after 3 seconds
    setTimeout(() => {
      dex.kill();
      done(new Error('Test timed out'));
    }, 3000);
  });

  it('should skip interactive mode if task is already provided', (done) => {
    const dex = spawn('node', [cliPath, '-i', '--task', 'Test task', '--staged'], {
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let output = '';
    let sawInteractivePrompt = false;

    dex.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Interactive Task Input Mode')) {
        sawInteractivePrompt = true;
      }
    });

    dex.on('close', () => {
      expect(sawInteractivePrompt).toBe(false);
      done();
    });

    // Give it time to run
    setTimeout(() => {
      dex.kill();
    }, 2000);
  });
});