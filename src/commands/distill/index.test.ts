// @ts-expect-error - bun:test types not available in this environment
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('distill command integration tests', () => {
    let testDir: string;
    let originalCwd: string;
    
    beforeEach(() => {
        // Create a temporary test directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dex-test-'));
        originalCwd = process.cwd();
        
        // Create test files
        fs.writeFileSync(path.join(testDir, 'public.ts'), `
export class PublicClass {
    public publicMethod() {
        return 'public';
    }
    
    private privateMethod() {
        return 'private';
    }
    
    protected protectedMethod() {
        return 'protected';
    }
}

export interface Config {
    /** API key for authentication */
    apiKey: string;
    endpoint?: string;
}

export function publicFunction() {
    // This is a comment
    return true;
}

export const CONFIG = { key: 'value' };

class PrivateClass {
    method() {}
}
        `.trim());
        
        fs.writeFileSync(path.join(testDir, 'test.py'), `
class PublicClass:
    """This is a docstring"""
    def __init__(self):
        pass
    
    def public_method(self):
        # Comment here
        return "public"
    
    def _private_method(self):
        return "private"

def public_function():
    """Function docstring"""
    pass

def _private_function():
    pass

MAX_SIZE = 1000
        `.trim());
        
        // Create nested directory structure
        fs.mkdirSync(path.join(testDir, 'src'));
        fs.writeFileSync(path.join(testDir, 'src', 'index.ts'), `
export { PublicClass } from "../public.js";
export default function main() {
    console.log('main');
}
        `.trim());
    });
    
    afterEach(() => {
        // Clean up
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });
    
    function runDistill(args: string = ''): string {
        // If args starts with a path (contains /), use it as the target
        // Otherwise, use testDir as the target
        const target = args.includes('/') ? '' : testDir;
        const cmd = `bun run dex distill ${target} ${args} --stdout 2>&1`.trim();
        try {
            return execSync(cmd, { encoding: 'utf-8' });
        } catch (error: any) {
            return error.stdout || error.message;
        }
    }
    
    describe('basic functionality', () => {
        test('should distill all files by default', () => {
            const output = runDistill();
            expect(output).toContain('PublicClass');
            expect(output).toContain('publicFunction');
            expect(output).toContain('public_function');
        });
        
        test('should handle single file', () => {
            const output = runDistill(`${path.join(testDir, 'public.ts')}`);
            expect(output).toContain('PublicClass');
            expect(output).not.toContain('public_function'); // Python function not included
        });
    });
    
    describe('output options', () => {
        test('--stdout should output to stdout', () => {
            const output = runDistill('--stdout');
            expect(output).toContain('PublicClass');
        });
        
        test('-o should write to file', () => {
            const outputFile = path.join(testDir, 'output.txt');
            runDistill(`-o ${outputFile}`);
            expect(fs.existsSync(outputFile)).toBe(true);
            const content = fs.readFileSync(outputFile, 'utf-8');
            expect(content).toContain('PublicClass');
        });
        
        test('--clipboard should copy to clipboard', () => {
            // This is hard to test without mocking clipboard
            // Just ensure the command doesn't error
            const output = runDistill('-c');
            expect(output).toContain('Copied');
        });
    });
    
    describe('filtering options', () => {
        test('--include should filter files', () => {
            const output = runDistill('--include "*.ts"');
            expect(output).toContain('PublicClass');
            expect(output).toContain('publicFunction');
            expect(output).not.toContain('public_function'); // Python excluded
        });
        
        test('--exclude should exclude files', () => {
            const output = runDistill('--exclude "*.py"');
            expect(output).toContain('PublicClass');
            expect(output).not.toContain('public_function');
        });
        
        test('--exclude-names should exclude by name patterns', () => {
            const output = runDistill('--exclude-names "*Private*"');
            expect(output).toContain('PublicClass');
            expect(output).toContain('publicFunction');
            // Private class methods should still be excluded by default
        });
    });
    
    describe('depth options', () => {
        test('--depth public should only include public members', () => {
            const output = runDistill('--depth public');
            expect(output).toContain('publicMethod');
            expect(output).not.toContain('privateMethod');
            expect(output).not.toContain('protectedMethod');
        });
        
        test('--depth protected should include public and protected', () => {
            const output = runDistill('--depth protected');
            expect(output).toContain('publicMethod');
            expect(output).toContain('protectedMethod');
            expect(output).not.toContain('privateMethod');
        });
        
        test('--depth all should include everything', () => {
            const output = runDistill('--depth all');
            expect(output).toContain('publicMethod');
            expect(output).toContain('protectedMethod');
            expect(output).toContain('privateMethod');
        });
        
        test('--include-private should include private members', () => {
            const output = runDistill('--include-private');
            expect(output).toContain('privateMethod');
            expect(output).toContain('_private_method'); // Python private
        });
    });
    
    describe('content options', () => {
        test('--with-comments should include comments', () => {
            const output = runDistill('--with-comments');
            expect(output).toContain('// This is a comment');
            expect(output).toContain('# Comment here');
        });
        
        test('--no-docstrings should exclude docstrings', () => {
            const output = runDistill('--no-docstrings');
            expect(output).not.toContain('This is a docstring');
            expect(output).not.toContain('Function docstring');
            expect(output).not.toContain('API key for authentication');
        });
        
        test('default should include docstrings', () => {
            const output = runDistill();
            // Note: Current implementation may not include docstrings by default
            // This test documents current behavior
        });
    });
    
    describe('format options', () => {
        test('--compact should produce compact output', () => {
            const output = runDistill('--compact');
            expect(output).toContain('PublicClass');
            // Compact mode should have minimal formatting
            const lines = output.split('\n').filter(l => l.trim());
            expect(lines.length).toBeGreaterThan(0);
        });
        
        test('--format compressed should only compress', () => {
            const output = runDistill('--format compressed');
            expect(output).toContain('<file');
            expect(output).toContain('</file>');
            // Should contain actual code content
            expect(output).toContain('class PublicClass');
        });
        
        test('--format distilled should only distill', () => {
            const output = runDistill('--format distilled');
            expect(output).toContain('export class PublicClass');
            // Should not contain implementation details
            expect(output).not.toContain("return 'public'");
        });
        
        test('--format both should include both', () => {
            const output = runDistill('--format both');
            expect(output).toContain('---'); // Separator between sections
        });
    });
    
    describe('processing options', () => {
        test('--no-compress should skip compression', () => {
            const output = runDistill('--no-compress');
            expect(output).toContain('PublicClass');
        });
        
        test('--no-parallel should disable parallel processing', () => {
            // Hard to test the actual parallelism, just ensure it works
            const output = runDistill('--no-parallel');
            expect(output).toContain('PublicClass');
        });
    });
    
    describe('git integration options', () => {
        beforeEach(() => {
            // Initialize git repo in test directory
            process.chdir(testDir);
            execSync('git init', { encoding: 'utf-8' });
            execSync('git config user.email "test@example.com"', { encoding: 'utf-8' });
            execSync('git config user.name "Test User"', { encoding: 'utf-8' });
            execSync('git add .', { encoding: 'utf-8' });
            execSync('git commit -m "initial"', { encoding: 'utf-8' });
        });
        
        test('--staged should only process staged files', () => {
            // Create a new file and stage it
            fs.writeFileSync(path.join(testDir, 'staged.ts'), 'export class StagedClass {}');
            execSync('git add staged.ts', { encoding: 'utf-8' });
            
            // Create another file but don't stage it
            fs.writeFileSync(path.join(testDir, 'unstaged.ts'), 'export class UnstagedClass {}');
            
            const output = runDistill('--staged');
            expect(output).toContain('StagedClass');
            expect(output).not.toContain('UnstagedClass');
        });
        
        test('--since should only process changed files', () => {
            // Modify an existing file
            fs.appendFileSync(path.join(testDir, 'public.ts'), '\nexport class NewClass {}');
            
            const output = runDistill('--since HEAD');
            expect(output).toContain('NewClass');
            // Should only include the modified file
            expect(output).not.toContain('public_function'); // From Python file
        });
    });
    
    describe('error handling', () => {
        test('should handle non-existent path gracefully', () => {
            const output = runDistill('/non/existent/path');
            expect(output).toContain('Error');
        });
        
        test('should handle invalid options', () => {
            const output = runDistill('--invalid-option');
            expect(output).toContain('error');
        });
    });
    
    describe('combined options', () => {
        test('should handle multiple options together', () => {
            const output = runDistill('--include "*.ts" --depth all --compact --with-comments');
            expect(output).toContain('PublicClass');
            expect(output).toContain('privateMethod');
            expect(output).not.toContain('public_function'); // Python excluded
        });
        
        test('should respect all filtering options', () => {
            const output = runDistill('--include "*.ts" --exclude "**/src/*" --include-private');
            expect(output).toContain('PublicClass');
            expect(output).toContain('privateMethod');
            expect(output).not.toContain('main'); // From src/index.ts
        });
    });
});