# Task 06: Cross-Platform Validation

## Problem
No cross-platform testing or validation. Charter requires identical behavior on macOS, Linux, and Windows.

## Current State
- Developed primarily on macOS
- Uses Unix-style paths
- No Windows-specific handling
- No cross-platform CI/CD
- Path separators not normalized

## Requirements (P0 Charter)
- Identical behavior on macOS, Linux, Windows
- Cross-platform file path handling
- Platform-specific features abstracted
- CI/CD testing on all platforms

## Implementation Plan
1. Audit code for platform-specific issues
2. Normalize all path operations
3. Abstract platform-specific features
4. Set up cross-platform CI/CD
5. Create platform compatibility layer
6. Test on all target platforms

## Acceptance Criteria
- [ ] All tests pass on macOS
- [ ] All tests pass on Linux
- [ ] All tests pass on Windows
- [ ] Path operations work correctly on all platforms
- [ ] Git operations work on all platforms
- [ ] File permissions handled correctly
- [ ] Line endings handled correctly
- [ ] CI/CD runs on all platforms

## Platform-Specific Concerns
- Path separators (/ vs \)
- Line endings (LF vs CRLF)
- File permissions (Unix vs Windows)
- Shell commands (bash vs cmd/PowerShell)
- Symbolic links
- Case sensitivity
- Git executable location
- Temp directory locations

## 1. Platform Abstraction Layer Implementation

### OS Detection Utilities (`src/utils/platform.ts`)

```typescript
import { platform, arch, type } from 'os';
import { join, resolve, sep } from 'path';

export enum Platform {
    WINDOWS = 'win32',
    MACOS = 'darwin',
    LINUX = 'linux'
}

export enum Architecture {
    X64 = 'x64',
    ARM64 = 'arm64',
    X32 = 'x32',
    ARM = 'arm'
}

export interface PlatformInfo {
    platform: Platform;
    architecture: Architecture;
    isWindows: boolean;
    isMacOS: boolean;
    isLinux: boolean;
    isUnix: boolean;
    pathSeparator: string;
    lineEnding: string;
    executableExtension: string;
    tempDirectory: string;
}

export class PlatformDetector {
    private static _info: PlatformInfo | null = null;

    static getPlatformInfo(): PlatformInfo {
        if (this._info) return this._info;

        const currentPlatform = platform() as Platform;
        const currentArch = arch() as Architecture;
        
        this._info = {
            platform: currentPlatform,
            architecture: currentArch,
            isWindows: currentPlatform === Platform.WINDOWS,
            isMacOS: currentPlatform === Platform.MACOS,
            isLinux: currentPlatform === Platform.LINUX,
            isUnix: currentPlatform !== Platform.WINDOWS,
            pathSeparator: currentPlatform === Platform.WINDOWS ? '\\' : '/',
            lineEnding: currentPlatform === Platform.WINDOWS ? '\r\n' : '\n',
            executableExtension: currentPlatform === Platform.WINDOWS ? '.exe' : '',
            tempDirectory: this.getTempDirectory(currentPlatform)
        };

        return this._info;
    }

    private static getTempDirectory(platform: Platform): string {
        switch (platform) {
            case Platform.WINDOWS:
                return process.env.TEMP || process.env.TMP || 'C:\\temp';
            case Platform.MACOS:
            case Platform.LINUX:
            default:
                return process.env.TMPDIR || '/tmp';
        }
    }

    static isWindows(): boolean {
        return this.getPlatformInfo().isWindows;
    }

    static isMacOS(): boolean {
        return this.getPlatformInfo().isMacOS;
    }

    static isLinux(): boolean {
        return this.getPlatformInfo().isLinux;
    }

    static isUnix(): boolean {
        return this.getPlatformInfo().isUnix;
    }
}

// Environment-specific utilities
export class EnvironmentUtils {
    static getGitExecutable(): string {
        const info = PlatformDetector.getPlatformInfo();
        const baseName = 'git';
        return baseName + info.executableExtension;
    }

    static getShellCommand(): { shell: string; args: string[] } {
        if (PlatformDetector.isWindows()) {
            // Prefer PowerShell over cmd
            return {
                shell: 'powershell.exe',
                args: ['-NoProfile', '-NonInteractive', '-Command']
            };
        } else {
            return {
                shell: '/bin/bash',
                args: ['-c']
            };
        }
    }

    static getHomeDirectory(): string {
        if (PlatformDetector.isWindows()) {
            return process.env.USERPROFILE || process.env.HOMEPATH || 'C:\\';
        } else {
            return process.env.HOME || '/';
        }
    }

    static normalizeLineEndings(content: string, targetPlatform?: Platform): string {
        const info = PlatformDetector.getPlatformInfo();
        const target = targetPlatform || info.platform;
        
        // First normalize all line endings to \n
        const normalized = content.replace(/\r\n|\r/g, '\n');
        
        // Then convert to target format
        if (target === Platform.WINDOWS) {
            return normalized.replace(/\n/g, '\r\n');
        }
        
        return normalized;
    }
}
```

## 2. Path Normalization Utilities

### Cross-Platform Path Operations (`src/utils/paths.ts`)

```typescript
import { resolve, join, relative, dirname, basename, extname, sep, posix, win32 } from 'path';
import { promises as fs, constants } from 'fs';
import { PlatformDetector } from './platform';

export class PathUtils {
    /**
     * Normalizes path separators to forward slashes for consistent internal representation
     */
    static normalize(path: string): string {
        return path.replace(/\\/g, '/');
    }

    /**
     * Converts path to platform-specific format
     */
    static toPlatformPath(path: string): string {
        const info = PlatformDetector.getPlatformInfo();
        if (info.isWindows) {
            return path.replace(/\//g, '\\');
        }
        return path;
    }

    /**
     * Converts path to POSIX format (forward slashes)
     */
    static toPosixPath(path: string): string {
        return path.replace(/\\/g, '/');
    }

    /**
     * Safe path joining that works across platforms
     */
    static join(...paths: string[]): string {
        const joined = join(...paths);
        return this.normalize(joined);
    }

    /**
     * Safe path resolution that works across platforms
     */
    static resolve(...paths: string[]): string {
        const resolved = resolve(...paths);
        return this.normalize(resolved);
    }

    /**
     * Get relative path with normalized separators
     */
    static relative(from: string, to: string): string {
        const rel = relative(from, to);
        return this.normalize(rel);
    }

    /**
     * Check if path is absolute
     */
    static isAbsolute(path: string): boolean {
        if (PlatformDetector.isWindows()) {
            return win32.isAbsolute(path);
        }
        return posix.isAbsolute(path);
    }

    /**
     * Safely check if file exists with proper error handling
     */
    static async exists(path: string): Promise<boolean> {
        try {
            await fs.access(path, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file stats with error handling
     */
    static async getStats(path: string): Promise<import('fs').Stats | null> {
        try {
            return await fs.stat(path);
        } catch {
            return null;
        }
    }

    /**
     * Check if path is a directory
     */
    static async isDirectory(path: string): Promise<boolean> {
        const stats = await this.getStats(path);
        return stats?.isDirectory() ?? false;
    }

    /**
     * Check if path is a file
     */
    static async isFile(path: string): Promise<boolean> {
        const stats = await this.getStats(path);
        return stats?.isFile() ?? false;
    }

    /**
     * Ensure directory exists, creating it if necessary
     */
    static async ensureDirectory(path: string): Promise<void> {
        try {
            await fs.mkdir(path, { recursive: true });
        } catch (error: any) {
            // Only throw if it's not an EEXIST error
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Get temporary file path
     */
    static getTempPath(filename: string): string {
        const info = PlatformDetector.getPlatformInfo();
        return this.join(info.tempDirectory, filename);
    }

    /**
     * Match patterns across platforms (handles case sensitivity)
     */
    static matchesPattern(filePath: string, pattern: string): boolean {
        const info = PlatformDetector.getPlatformInfo();
        
        // On Windows, do case-insensitive matching
        if (info.isWindows) {
            return filePath.toLowerCase().includes(pattern.toLowerCase());
        }
        
        return filePath.includes(pattern);
    }

    /**
     * Get file extension consistently
     */
    static getExtension(path: string): string {
        return extname(path).toLowerCase();
    }

    /**
     * Get basename consistently
     */
    static getBasename(path: string, ext?: string): string {
        return basename(path, ext);
    }

    /**
     * Get dirname consistently
     */
    static getDirname(path: string): string {
        return this.normalize(dirname(path));
    }
}

// Git-specific path utilities
export class GitPathUtils extends PathUtils {
    /**
     * Convert file path to git-compatible format (always forward slashes)
     */
    static toGitPath(path: string): string {
        return this.toPosixPath(path);
    }

    /**
     * Convert git path to platform-specific format
     */
    static fromGitPath(gitPath: string): string {
        return this.toPlatformPath(gitPath);
    }

    /**
     * Check if path should be ignored by git (respects .gitignore patterns)
     */
    static async shouldIgnore(path: string, gitRoot: string): Promise<boolean> {
        // This is a simplified implementation
        // In production, use a library like 'ignore' for proper .gitignore parsing
        const ignorePaths = [
            'node_modules',
            '.git',
            '.dex',
            '*.log',
            '.DS_Store',
            'thumbs.db'
        ];

        const relativePath = this.relative(gitRoot, path);
        
        return ignorePaths.some(pattern => {
            return this.matchesPattern(relativePath, pattern);
        });
    }
}
```

## 3. Platform-Specific Implementations

### Windows-Specific Handling (`src/utils/platform/windows.ts`)

```typescript
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { PathUtils } from '../paths';

const execAsync = promisify(exec);

export class WindowsPlatformHandler {
    /**
     * Execute git command with Windows-specific handling
     */
    static async executeGitCommand(args: string[], cwd: string): Promise<string> {
        try {
            // Use git.exe explicitly on Windows
            const gitPath = 'git.exe';
            const { stdout } = await execAsync(`${gitPath} ${args.join(' ')}`, {
                cwd,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    // Ensure git uses UTF-8 encoding
                    LC_ALL: 'C.UTF-8',
                    GIT_CONFIG_NOSYSTEM: '1'
                }
            });
            
            return stdout.trim();
        } catch (error: any) {
            throw new Error(`Git command failed on Windows: ${error.message}`);
        }
    }

    /**
     * Handle Windows file permissions
     */
    static async checkFilePermissions(filePath: string): Promise<{
        readable: boolean;
        writable: boolean;
        executable: boolean;
    }> {
        try {
            const { stdout } = await execAsync(`powershell -Command "(Get-Acl '${filePath}').Access | ConvertTo-Json"`);
            
            // Simplified permission check - in production, parse ACL properly
            return {
                readable: true, // Windows handles this differently
                writable: !filePath.includes('Program Files'),
                executable: PathUtils.getExtension(filePath) === '.exe'
            };
        } catch {
            return { readable: false, writable: false, executable: false };
        }
    }

    /**
     * Handle Windows symbolic links
     */
    static async isSymbolicLink(path: string): Promise<boolean> {
        try {
            const stats = await PathUtils.getStats(path);
            return stats?.isSymbolicLink() ?? false;
        } catch {
            return false;
        }
    }

    /**
     * Handle Windows case sensitivity
     */
    static normalizeForFileSystem(path: string): string {
        // Windows file system is case-insensitive
        return path.toLowerCase();
    }

    /**
     * Get Windows-specific temp directory
     */
    static getTempDirectory(): string {
        return process.env.TEMP || process.env.TMP || 'C:\\temp';
    }
}
```

### Unix-Specific Handling (`src/utils/platform/unix.ts`)

```typescript
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { PathUtils } from '../paths';
import { constants } from 'fs';

const execAsync = promisify(exec);

export class UnixPlatformHandler {
    /**
     * Execute git command with Unix-specific handling
     */
    static async executeGitCommand(args: string[], cwd: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`git ${args.join(' ')}`, {
                cwd,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    LC_ALL: 'C.UTF-8'
                }
            });
            
            return stdout.trim();
        } catch (error: any) {
            throw new Error(`Git command failed on Unix: ${error.message}`);
        }
    }

    /**
     * Check Unix file permissions
     */
    static async checkFilePermissions(filePath: string): Promise<{
        readable: boolean;
        writable: boolean;
        executable: boolean;
    }> {
        try {
            const stats = await PathUtils.getStats(filePath);
            if (!stats) return { readable: false, writable: false, executable: false };

            const mode = stats.mode;
            
            return {
                readable: !!(mode & constants.S_IRUSR),
                writable: !!(mode & constants.S_IWUSR),
                executable: !!(mode & constants.S_IXUSR)
            };
        } catch {
            return { readable: false, writable: false, executable: false };
        }
    }

    /**
     * Handle Unix symbolic links
     */
    static async isSymbolicLink(path: string): Promise<boolean> {
        try {
            const stats = await PathUtils.getStats(path);
            return stats?.isSymbolicLink() ?? false;
        } catch {
            return false;
        }
    }

    /**
     * Unix file systems are case-sensitive (usually)
     */
    static normalizeForFileSystem(path: string): string {
        return path; // Keep original case
    }

    /**
     * Get Unix-specific temp directory
     */
    static getTempDirectory(): string {
        return process.env.TMPDIR || '/tmp';
    }
}
```

## 4. CI/CD Matrix Configuration

### GitHub Actions Cross-Platform Testing (`.github/workflows/cross-platform.yml`)

```yaml
name: Cross-Platform Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18.x, 20.x]
        include:
          # Test additional Windows configurations
          - os: windows-2019
            node-version: 18.x
          # Test ARM64 on macOS when available
          - os: macos-13-xlarge # ARM64
            node-version: 20.x

    runs-on: ${{ matrix.os }}

    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Full history for git operations

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest

    # Platform-specific git configuration
    - name: Configure git (Windows)
      if: runner.os == 'Windows'
      run: |
        git config --global core.autocrlf false
        git config --global core.eol lf
        git config --global user.name "Test User"
        git config --global user.email "test@example.com"

    - name: Configure git (Unix)
      if: runner.os != 'Windows'
      run: |
        git config --global core.autocrlf input
        git config --global user.name "Test User"
        git config --global user.email "test@example.com"

    - name: Install dependencies
      run: bun install

    - name: Run type checking
      run: bun run type-check

    - name: Run linting
      run: bun run lint

    - name: Run unit tests
      run: bun test

    - name: Run platform-specific tests
      run: bun test test/platform/

    - name: Test CLI commands (Unix)
      if: runner.os != 'Windows'
      run: |
        # Test basic commands work
        ./bin/dex --help
        ./bin/dex distill --help
        ./bin/dex extract --help
        
        # Test with sample repository
        mkdir -p test-repo && cd test-repo
        git init
        echo "console.log('test')" > test.js
        git add test.js
        git commit -m "Initial commit"
        
        # Test extract command
        ../bin/dex extract --staged
        
        # Test distill command
        ../bin/dex distill . --format json

    - name: Test CLI commands (Windows)
      if: runner.os == 'Windows'
      shell: powershell
      run: |
        # Test basic commands work
        node bin/dex --help
        node bin/dex distill --help
        node bin/dex extract --help
        
        # Test with sample repository
        New-Item -ItemType Directory -Path test-repo
        Set-Location test-repo
        git init
        Set-Content -Path "test.js" -Value "console.log('test')"
        git add test.js
        git commit -m "Initial commit"
        
        # Test extract command
        node ../bin/dex extract --staged
        
        # Test distill command
        node ../bin/dex distill . --format json

    # Test different line ending scenarios
    - name: Test line ending handling
      run: bun test test/platform/line-endings.test.ts

    # Test path separator handling
    - name: Test path handling
      run: bun test test/platform/paths.test.ts

    - name: Upload test artifacts
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: test-artifacts-${{ matrix.os }}-node${{ matrix.node-version }}
        path: |
          .dex/
          test-results/
          logs/

  integration-tests:
    needs: test
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: bun install
      
    - name: Build package
      run: bun run build
      
    - name: Test against real repositories
      run: |
        # Clone a few small public repos for integration testing
        git clone --depth 1 https://github.com/microsoft/TypeScript.git test-repos/typescript
        git clone --depth 1 https://github.com/facebook/react.git test-repos/react
        
        # Test distill on TypeScript repo
        ./bin/dex distill test-repos/typescript --format json --output typescript-distill.json
        
        # Test extract on React repo  
        cd test-repos/react && ../../bin/dex extract --since HEAD~5
        
    - name: Validate output consistency
      run: bun test test/integration/consistency.test.ts
```

## 5. Cross-Platform Test Suite

### Platform Detection Tests (`test/platform/detection.test.ts`)

```typescript
import { test, expect, describe } from 'bun:test';
import { PlatformDetector, Platform, EnvironmentUtils } from '../../src/utils/platform';

describe('PlatformDetector', () => {
    test('should detect current platform correctly', () => {
        const info = PlatformDetector.getPlatformInfo();
        
        expect(info.platform).toBeDefined();
        expect(Object.values(Platform)).toContain(info.platform);
        
        // Exactly one platform should be true
        const platformFlags = [info.isWindows, info.isMacOS, info.isLinux];
        expect(platformFlags.filter(Boolean)).toHaveLength(1);
    });

    test('should provide correct path separator', () => {
        const info = PlatformDetector.getPlatformInfo();
        
        if (info.isWindows) {
            expect(info.pathSeparator).toBe('\\');
        } else {
            expect(info.pathSeparator).toBe('/');
        }
    });

    test('should provide correct line endings', () => {
        const info = PlatformDetector.getPlatformInfo();
        
        if (info.isWindows) {
            expect(info.lineEnding).toBe('\r\n');
        } else {
            expect(info.lineEnding).toBe('\n');
        }
    });

    test('should provide correct executable extension', () => {
        const info = PlatformDetector.getPlatformInfo();
        
        if (info.isWindows) {
            expect(info.executableExtension).toBe('.exe');
        } else {
            expect(info.executableExtension).toBe('');
        }
    });
});

describe('EnvironmentUtils', () => {
    test('should provide correct git executable name', () => {
        const gitExe = EnvironmentUtils.getGitExecutable();
        
        if (PlatformDetector.isWindows()) {
            expect(gitExe).toBe('git.exe');
        } else {
            expect(gitExe).toBe('git');
        }
    });

    test('should provide appropriate shell command', () => {
        const shellCmd = EnvironmentUtils.getShellCommand();
        
        expect(shellCmd.shell).toBeDefined();
        expect(shellCmd.args).toBeDefined();
        expect(Array.isArray(shellCmd.args)).toBe(true);
    });

    test('should normalize line endings correctly', () => {
        const testContent = 'line1\r\nline2\rline3\nline4';
        
        const windowsNormalized = EnvironmentUtils.normalizeLineEndings(testContent, Platform.WINDOWS);
        expect(windowsNormalized).toBe('line1\r\nline2\r\nline3\r\nline4');
        
        const unixNormalized = EnvironmentUtils.normalizeLineEndings(testContent, Platform.LINUX);
        expect(unixNormalized).toBe('line1\nline2\nline3\nline4');
    });
});
```

### Path Handling Tests (`test/platform/paths.test.ts`)

```typescript
import { test, expect, describe } from 'bun:test';
import { PathUtils, GitPathUtils } from '../../src/utils/paths';
import { PlatformDetector } from '../../src/utils/platform';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PathUtils', () => {
    test('should normalize path separators consistently', () => {
        const windowsPath = 'C:\\Users\\test\\file.txt';
        const unixPath = '/home/test/file.txt';
        
        expect(PathUtils.normalize(windowsPath)).toBe('C:/Users/test/file.txt');
        expect(PathUtils.normalize(unixPath)).toBe('/home/test/file.txt');
    });

    test('should convert to platform-specific paths', () => {
        const normalizedPath = 'home/user/project/file.js';
        const platformPath = PathUtils.toPlatformPath(normalizedPath);
        
        if (PlatformDetector.isWindows()) {
            expect(platformPath).toBe('home\\user\\project\\file.js');
        } else {
            expect(platformPath).toBe('home/user/project/file.js');
        }
    });

    test('should convert to POSIX paths', () => {
        const windowsPath = 'src\\utils\\test.ts';
        const posixPath = PathUtils.toPosixPath(windowsPath);
        
        expect(posixPath).toBe('src/utils/test.ts');
    });

    test('should safely join paths', () => {
        const joined = PathUtils.join('src', 'utils', 'test.ts');
        
        // Should always use forward slashes internally
        expect(joined).toBe('src/utils/test.ts');
    });

    test('should detect absolute paths correctly', () => {
        if (PlatformDetector.isWindows()) {
            expect(PathUtils.isAbsolute('C:\\test')).toBe(true);
            expect(PathUtils.isAbsolute('\\test')).toBe(false);
            expect(PathUtils.isAbsolute('test')).toBe(false);
        } else {
            expect(PathUtils.isAbsolute('/test')).toBe(true);
            expect(PathUtils.isAbsolute('./test')).toBe(false);
            expect(PathUtils.isAbsolute('test')).toBe(false);
        }
    });

    test('should handle file existence checks', async () => {
        // Create a temporary file
        const tempDir = await mkdtemp(join(tmpdir(), 'path-test-'));
        const testFile = join(tempDir, 'test.txt');
        
        // File shouldn't exist initially
        expect(await PathUtils.exists(testFile)).toBe(false);
        
        // Create the file
        await writeFile(testFile, 'test content');
        
        // Now it should exist
        expect(await PathUtils.exists(testFile)).toBe(true);
        
        // Should be a file, not a directory
        expect(await PathUtils.isFile(testFile)).toBe(true);
        expect(await PathUtils.isDirectory(testFile)).toBe(false);
    });

    test('should handle directory operations', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'dir-test-'));
        const testDir = join(tempDir, 'subdir');
        
        // Directory shouldn't exist initially
        expect(await PathUtils.exists(testDir)).toBe(false);
        
        // Create the directory
        await PathUtils.ensureDirectory(testDir);
        
        // Now it should exist and be a directory
        expect(await PathUtils.exists(testDir)).toBe(true);
        expect(await PathUtils.isDirectory(testDir)).toBe(true);
        expect(await PathUtils.isFile(testDir)).toBe(false);
    });
});

describe('GitPathUtils', () => {
    test('should convert paths to git format', () => {
        const windowsPath = 'src\\components\\Button.tsx';
        const gitPath = GitPathUtils.toGitPath(windowsPath);
        
        expect(gitPath).toBe('src/components/Button.tsx');
    });

    test('should convert git paths to platform format', () => {
        const gitPath = 'src/components/Button.tsx';
        const platformPath = GitPathUtils.fromGitPath(gitPath);
        
        if (PlatformDetector.isWindows()) {
            expect(platformPath).toBe('src\\components\\Button.tsx');
        } else {
            expect(platformPath).toBe('src/components/Button.tsx');
        }
    });
});
```

### Line Ending Tests (`test/platform/line-endings.test.ts`)

```typescript
import { test, expect, describe } from 'bun:test';
import { EnvironmentUtils, Platform } from '../../src/utils/platform';
import { writeFile, readFile, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Line Ending Handling', () => {
    test('should normalize mixed line endings', () => {
        const mixedContent = 'line1\r\nline2\rline3\nline4';
        
        const windowsResult = EnvironmentUtils.normalizeLineEndings(mixedContent, Platform.WINDOWS);
        expect(windowsResult).toBe('line1\r\nline2\r\nline3\r\nline4');
        
        const unixResult = EnvironmentUtils.normalizeLineEndings(mixedContent, Platform.LINUX);
        expect(unixResult).toBe('line1\nline2\nline3\nline4');
        
        const macResult = EnvironmentUtils.normalizeLineEndings(mixedContent, Platform.MACOS);
        expect(macResult).toBe('line1\nline2\nline3\nline4');
    });

    test('should preserve existing correct line endings', () => {
        const windowsContent = 'line1\r\nline2\r\nline3';
        const windowsResult = EnvironmentUtils.normalizeLineEndings(windowsContent, Platform.WINDOWS);
        expect(windowsResult).toBe(windowsContent);
        
        const unixContent = 'line1\nline2\nline3';
        const unixResult = EnvironmentUtils.normalizeLineEndings(unixContent, Platform.LINUX);
        expect(unixResult).toBe(unixContent);
    });

    test('should handle file operations with correct line endings', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'line-ending-test-'));
        const testFile = join(tempDir, 'test.txt');
        
        const originalContent = 'line1\nline2\nline3';
        await writeFile(testFile, originalContent, 'utf8');
        
        const readContent = await readFile(testFile, 'utf8');
        
        // Content should be preserved correctly regardless of platform
        const normalizedRead = EnvironmentUtils.normalizeLineEndings(readContent);
        const normalizedOriginal = EnvironmentUtils.normalizeLineEndings(originalContent);
        
        expect(normalizedRead).toBe(normalizedOriginal);
    });
});
```

### Integration Consistency Tests (`test/integration/consistency.test.ts`)

```typescript
import { test, expect, describe } from 'bun:test';
import { GitExtractor } from '../../src/core/git';
import { ContextEngine } from '../../src/core/context';
import { Distiller } from '../../src/core/distiller';
import { PathUtils } from '../../src/utils/paths';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

describe('Cross-Platform Consistency', () => {
    async function createTestRepository(): Promise<string> {
        const tempDir = await mkdtemp(join(tmpdir(), 'dex-consistency-test-'));
        
        // Initialize git repo
        execSync('git init', { cwd: tempDir });
        execSync('git config user.name "Test User"', { cwd: tempDir });
        execSync('git config user.email "test@example.com"', { cwd: tempDir });
        
        // Create test files with various content
        await mkdir(join(tempDir, 'src'), { recursive: true });
        await mkdir(join(tempDir, 'test'), { recursive: true });
        
        await writeFile(join(tempDir, 'src', 'index.ts'), `
export function hello(name: string): string {
    return \`Hello, \${name}!\`;
}

export class Greeter {
    constructor(private name: string) {}
    
    greet(): string {
        return hello(this.name);
    }
}
        `.trim());
        
        await writeFile(join(tempDir, 'src', 'utils.ts'), `
export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
        `.trim());
        
        await writeFile(join(tempDir, 'test', 'index.test.ts'), `
import { test, expect } from 'bun:test';
import { hello, Greeter } from '../src/index';

test('hello function', () => {
    expect(hello('world')).toBe('Hello, world!');
});

test('Greeter class', () => {
    const greeter = new Greeter('TypeScript');
    expect(greeter.greet()).toBe('Hello, TypeScript!');
});
        `.trim());
        
        await writeFile(join(tempDir, 'package.json'), JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            scripts: {
                test: 'bun test'
            },
            devDependencies: {
                'bun-types': '^1.0.0'
            }
        }, null, 2));
        
        // Add and commit files
        execSync('git add .', { cwd: tempDir });
        execSync('git commit -m "Initial commit"', { cwd: tempDir });
        
        // Create some changes for testing extract
        await writeFile(join(tempDir, 'src', 'index.ts'), `
export function hello(name: string): string {
    return \`Hello, \${name}! Welcome to our app.\`;
}

export class Greeter {
    constructor(private name: string) {}
    
    greet(): string {
        return hello(this.name);
    }
    
    farewell(): string {
        return \`Goodbye, \${this.name}!\`;
    }
}
        `.trim());
        
        return tempDir;
    }

    test('git operations should work consistently across platforms', async () => {
        const repoPath = await createTestRepository();
        const gitExtractor = new GitExtractor(repoPath);
        
        // Test basic git operations
        expect(await gitExtractor.isGitRepository()).toBe(true);
        
        const currentBranch = await gitExtractor.getCurrentBranch();
        expect(currentBranch).toBe('main');
        
        const changes = await gitExtractor.getCurrentChanges(false);
        expect(changes).toBeDefined();
        expect(changes.length).toBeGreaterThan(0);
        
        // Verify file paths are normalized
        for (const change of changes) {
            expect(change.file).not.toContain('\\');
            expect(change.file).toContain('/');
        }
    });

    test('distiller should produce consistent output across platforms', async () => {
        const repoPath = await createTestRepository();
        const distiller = new Distiller({
            path: repoPath,
            format: 'distilled'
        });
        
        const result = await distiller.process(repoPath);
        
        expect(result).toBeDefined();
        expect('apis' in result).toBe(true);
        
        if ('apis' in result) {
            // Verify file paths are normalized in output
            for (const api of result.apis) {
                expect(api.file).not.toContain('\\');
                const normalizedPath = PathUtils.normalize(api.file);
                expect(api.file).toBe(normalizedPath);
            }
        }
    });

    test('context extraction should handle paths consistently', async () => {
        const repoPath = await createTestRepository();
        const gitExtractor = new GitExtractor(repoPath);
        const contextEngine = new ContextEngine(gitExtractor);
        
        const context = await contextEngine.extract({
            since: 'HEAD~1'
        });
        
        expect(context).toBeDefined();
        expect(context.changes).toBeDefined();
        
        // Verify all paths are normalized
        for (const change of context.changes) {
            expect(change.file).not.toContain('\\');
            const normalizedPath = PathUtils.normalize(change.file);
            expect(change.file).toBe(normalizedPath);
        }
    });

    test('file operations should work with various path formats', async () => {
        const repoPath = await createTestRepository();
        
        // Test different path representations
        const testPaths = [
            'src/index.ts',
            'src\\index.ts', // Windows-style
            './src/index.ts',
            PathUtils.join(repoPath, 'src', 'index.ts')
        ];
        
        for (const testPath of testPaths) {
            const resolvedPath = PathUtils.isAbsolute(testPath) 
                ? testPath 
                : PathUtils.join(repoPath, testPath);
            
            const exists = await PathUtils.exists(resolvedPath);
            expect(exists).toBe(true);
            
            const isFile = await PathUtils.isFile(resolvedPath);
            expect(isFile).toBe(true);
        }
    });
});
```

## 6. Common Pitfalls and Solutions

### Path Separator Issues

**Problem**: Hard-coded path separators break on different platforms
```typescript
// ❌ Bad - hard-coded separator
const filePath = 'src\\components\\Button.tsx';

// ✅ Good - use path utilities
const filePath = PathUtils.join('src', 'components', 'Button.tsx');
```

**Problem**: Git paths vs. file system paths
```typescript
// ❌ Bad - mixing formats
const gitDiff = await git.diff(['HEAD~1']);
const filePath = 'src\\file.ts'; // Windows format in git operations

// ✅ Good - separate concerns  
const gitPath = GitPathUtils.toGitPath(filePath);
const gitDiff = await git.diff(['HEAD~1']);
const systemPath = GitPathUtils.fromGitPath(gitPath);
```

### Line Ending Issues

**Problem**: Mixed line endings cause git and diff issues
```typescript
// ❌ Bad - no normalization
await fs.writeFile(path, content);

// ✅ Good - normalize before writing
const normalizedContent = EnvironmentUtils.normalizeLineEndings(content);
await fs.writeFile(path, normalizedContent);
```

### Case Sensitivity Issues

**Problem**: File matching fails on case-insensitive file systems
```typescript
// ❌ Bad - assumes case sensitivity
const matches = files.filter(f => f.includes('Component.tsx'));

// ✅ Good - platform-aware matching
const matches = files.filter(f => 
    PathUtils.matchesPattern(f, 'Component.tsx')
);
```

### Permission and Execution Issues

**Problem**: Executable detection and permissions vary by platform
```typescript
// ❌ Bad - Unix-only approach
const isExecutable = (await fs.stat(file)).mode & 0o111;

// ✅ Good - platform-specific handling
const permissions = PlatformDetector.isWindows()
    ? await WindowsPlatformHandler.checkFilePermissions(file)
    : await UnixPlatformHandler.checkFilePermissions(file);
```

### Git Command Execution

**Problem**: Git executable location and command format differ
```typescript
// ❌ Bad - assumes git is in PATH
const result = await exec('git status');

// ✅ Good - platform-aware execution
const gitExecutable = EnvironmentUtils.getGitExecutable();
const result = PlatformDetector.isWindows()
    ? await WindowsPlatformHandler.executeGitCommand(['status'], cwd)
    : await UnixPlatformHandler.executeGitCommand(['status'], cwd);
```

### Temporary File Handling

**Problem**: Hard-coded temp directories
```typescript
// ❌ Bad - assumes Unix temp location
const tempFile = '/tmp/dex-temp.json';

// ✅ Good - use platform temp directory
const tempFile = PathUtils.getTempPath('dex-temp.json');
```

## Files to Create/Modify
- `src/utils/platform.ts` - platform abstraction layer with OS detection
- `src/utils/paths.ts` - normalized path operations and utilities  
- `src/utils/platform/windows.ts` - Windows-specific implementations
- `src/utils/platform/unix.ts` - Unix-specific implementations (macOS/Linux)
- Update `src/core/git.ts` - use platform abstractions for git operations
- Update `src/core/distiller/index.ts` - normalize paths in output
- Update all file operations throughout codebase to use abstractions
- `.github/workflows/cross-platform.yml` - comprehensive CI/CD matrix
- `test/platform/detection.test.ts` - platform detection tests
- `test/platform/paths.test.ts` - path handling tests  
- `test/platform/line-endings.test.ts` - line ending normalization tests
- `test/integration/consistency.test.ts` - cross-platform integration tests

## Testing Requirements
- GitHub Actions matrix testing on Ubuntu, Windows, macOS
- Multiple Node.js versions (18.x, 20.x) 
- Different Windows versions (2019, latest)
- ARM64 testing on macOS when available
- Real repository integration testing
- Line ending scenario testing
- Path separator handling validation
- Git operations verification across platforms
- CLI command execution testing on each platform
- Docker containers for Linux environment testing
- Local testing instructions for manual validation
- Platform-specific edge case coverage