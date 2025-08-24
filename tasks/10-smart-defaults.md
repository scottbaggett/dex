# Task 10: Complete Smart Defaults

## Problem
Smart defaults not fully implemented. Charter requires the tool to work immediately on any repo without configuration.

## Current State
- Some defaults exist
- Config file optional but some features need it
- Not all commands have sensible defaults
- Auto-detection incomplete

## Requirements (P0 Charter)
- Works immediately on any repo without config
- Sensible defaults for all options
- Smart auto-detection of context
- Zero configuration for common use cases

## Implementation Plan
1. Audit all commands for required options
2. Implement smart detection algorithms
3. Add repository type detection
4. Implement language auto-detection
5. Create context-aware defaults
6. Add heuristics for common patterns

## Acceptance Criteria
- [ ] All commands work with zero flags
- [ ] Smart detection of repository type
- [ ] Automatic language detection
- [ ] Context-aware file filtering
- [ ] Intelligent format selection
- [ ] No configuration file required
- [ ] Common workflows need no options

## Smart Defaults to Implement

### Repository Detection
- Detect monorepo vs single project
- Identify framework (React, Vue, Django, etc.)
- Recognize project type (library, app, service)

### Context Detection
- Detect if on feature branch
- Identify staged changes automatically
- Recognize merge/rebase in progress
- Detect CI/CD environment

### Output Defaults
- Format based on terminal capabilities
- Clipboard on small outputs
- File on large outputs
- Automatic compression thresholds

### Filter Defaults
- Ignore common build directories
- Respect .gitignore automatically
- Filter test files intelligently
- Exclude vendor/dependencies

## Files to Create/Modify
- `src/core/defaults/` - default detection logic
- `src/core/detection/` - auto-detection algorithms
- Update all commands with smart defaults
- `src/utils/heuristics.ts` - pattern detection

## Testing Requirements
- Test with various repo types
- Zero-config workflow tests
- Detection algorithm tests
- Default override tests

## Implementation Details

### 1. Repository Type Detection

```typescript
// src/core/detection/repo-detector.ts
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { GitExtractor } from '../git';

interface RepoInfo {
    type: 'monorepo' | 'library' | 'app' | 'service' | 'unknown';
    framework?: string;
    language: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
    hasTests: boolean;
    hasCi: boolean;
}

export class RepoDetector {
    private repoRoot: string;
    
    constructor(repoRoot: string) {
        this.repoRoot = repoRoot;
    }
    
    public async detect(): Promise<RepoInfo> {
        const info: RepoInfo = {
            type: 'unknown',
            language: 'unknown',
            hasTests: false,
            hasCi: false
        };
        
        // Detect monorepo
        if (this.isMonorepo()) {
            info.type = 'monorepo';
        }
        
        // Detect framework
        info.framework = this.detectFramework();
        
        // Detect language
        info.language = this.detectPrimaryLanguage();
        
        // Detect package manager
        info.packageManager = this.detectPackageManager();
        
        // Detect project type based on package.json
        if (existsSync(join(this.repoRoot, 'package.json'))) {
            const pkg = JSON.parse(
                readFileSync(join(this.repoRoot, 'package.json'), 'utf-8')
            );
            
            if (pkg.main || pkg.module || pkg.types) {
                info.type = 'library';
            } else if (pkg.scripts?.start || pkg.scripts?.dev) {
                info.type = 'app';
            }
        }
        
        // Check for tests
        info.hasTests = existsSync(join(this.repoRoot, 'test')) ||
                       existsSync(join(this.repoRoot, 'tests')) ||
                       existsSync(join(this.repoRoot, '__tests__'));
        
        // Check for CI
        info.hasCi = existsSync(join(this.repoRoot, '.github/workflows')) ||
                     existsSync(join(this.repoRoot, '.circleci')) ||
                     existsSync(join(this.repoRoot, '.gitlab-ci.yml'));
        
        return info;
    }
    
    private isMonorepo(): boolean {
        return existsSync(join(this.repoRoot, 'lerna.json')) ||
               existsSync(join(this.repoRoot, 'pnpm-workspace.yaml')) ||
               existsSync(join(this.repoRoot, 'rush.json')) ||
               (existsSync(join(this.repoRoot, 'package.json')) && 
                existsSync(join(this.repoRoot, 'packages')));
    }
    
    private detectFramework(): string | undefined {
        const checks = [
            { file: 'next.config.js', framework: 'nextjs' },
            { file: 'gatsby-config.js', framework: 'gatsby' },
            { file: 'nuxt.config.js', framework: 'nuxt' },
            { file: 'vue.config.js', framework: 'vue' },
            { file: 'angular.json', framework: 'angular' },
            { file: 'svelte.config.js', framework: 'svelte' },
        ];
        
        for (const check of checks) {
            if (existsSync(join(this.repoRoot, check.file))) {
                return check.framework;
            }
        }
        
        // Check package.json dependencies
        if (existsSync(join(this.repoRoot, 'package.json'))) {
            const pkg = JSON.parse(
                readFileSync(join(this.repoRoot, 'package.json'), 'utf-8')
            );
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            
            if (deps.react) return 'react';
            if (deps.vue) return 'vue';
            if (deps['@angular/core']) return 'angular';
            if (deps.svelte) return 'svelte';
            if (deps.express) return 'express';
            if (deps.fastify) return 'fastify';
            if (deps.nestjs) return 'nestjs';
        }
        
        return undefined;
    }
    
    private detectPrimaryLanguage(): string {
        const extensions = new Map<string, number>();
        
        // Count file extensions (simplified)
        const files = this.getAllFiles(this.repoRoot);
        for (const file of files) {
            const ext = file.split('.').pop();
            if (ext) {
                extensions.set(ext, (extensions.get(ext) || 0) + 1);
            }
        }
        
        // Determine primary language
        if (extensions.get('ts') || extensions.get('tsx')) return 'typescript';
        if (extensions.get('js') || extensions.get('jsx')) return 'javascript';
        if (extensions.get('py')) return 'python';
        if (extensions.get('go')) return 'go';
        if (extensions.get('rs')) return 'rust';
        if (extensions.get('java')) return 'java';
        if (extensions.get('rb')) return 'ruby';
        if (extensions.get('php')) return 'php';
        
        return 'unknown';
    }
    
    private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' | undefined {
        if (existsSync(join(this.repoRoot, 'bun.lockb'))) return 'bun';
        if (existsSync(join(this.repoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
        if (existsSync(join(this.repoRoot, 'yarn.lock'))) return 'yarn';
        if (existsSync(join(this.repoRoot, 'package-lock.json'))) return 'npm';
        return undefined;
    }
}
```

### 2. Smart Context Detection

```typescript
// src/core/defaults/context-detector.ts
import { GitExtractor } from '../git';

export class ContextDetector {
    private git: GitExtractor;
    
    constructor() {
        this.git = new GitExtractor();
    }
    
    public async detectContext(): Promise<{
        isFeatureBranch: boolean;
        hasStaged: boolean;
        hasUnstaged: boolean;
        isMergeInProgress: boolean;
        isRebaseInProgress: boolean;
        isCi: boolean;
        defaultRange?: string;
    }> {
        const [branch, hasStaged, hasUnstaged] = await Promise.all([
            this.git.getCurrentBranch(),
            this.git.hasStagedChanges(),
            this.git.hasUnstagedChanges()
        ]);
        
        const isFeatureBranch = !['main', 'master', 'develop'].includes(branch);
        const isMergeInProgress = existsSync('.git/MERGE_HEAD');
        const isRebaseInProgress = existsSync('.git/rebase-merge') || 
                                   existsSync('.git/rebase-apply');
        const isCi = !!process.env.CI || !!process.env.GITHUB_ACTIONS;
        
        let defaultRange: string | undefined;
        if (isFeatureBranch) {
            const mainBranch = await this.git.findMainBranch();
            if (mainBranch) {
                defaultRange = `${mainBranch}..HEAD`;
            }
        }
        
        return {
            isFeatureBranch,
            hasStaged,
            hasUnstaged,
            isMergeInProgress,
            isRebaseInProgress,
            isCi,
            defaultRange
        };
    }
}
```

### 3. Smart Defaults Integration

```typescript
// src/core/defaults/smart-defaults.ts
import { DexOptions } from '../../types';
import { RepoDetector } from '../detection/repo-detector';
import { ContextDetector } from './context-detector';

export class SmartDefaults {
    public static async apply(options: Partial<DexOptions>): Promise<DexOptions> {
        const repoDetector = new RepoDetector(process.cwd());
        const contextDetector = new ContextDetector();
        
        const [repoInfo, context] = await Promise.all([
            repoDetector.detect(),
            contextDetector.detectContext()
        ]);
        
        const defaults: DexOptions = {
            // Smart range detection
            range: options.range || context.defaultRange || '',
            
            // Smart staging detection
            staged: options.staged ?? (context.hasStaged && !context.hasUnstaged),
            all: options.all ?? (context.hasStaged && context.hasUnstaged),
            
            // Smart format selection
            format: options.format || (context.isCi ? 'json' : 'xml'),
            
            // Smart output selection
            clipboard: options.clipboard ?? (!context.isCi && !options.format),
            
            // Smart file type filtering
            type: options.type || this.getDefaultTypes(repoInfo),
            
            // Include untracked for new projects
            includeUntracked: options.includeUntracked ?? 
                             (context.isFeatureBranch && !context.hasStaged),
            
            ...options
        };
        
        return defaults;
    }
    
    private static getDefaultTypes(repoInfo: RepoInfo): string[] | undefined {
        switch (repoInfo.language) {
            case 'typescript':
                return ['ts', 'tsx', 'js', 'jsx'];
            case 'javascript':
                return ['js', 'jsx', 'ts', 'tsx'];
            case 'python':
                return ['py'];
            case 'go':
                return ['go'];
            case 'rust':
                return ['rs'];
            default:
                return undefined;
        }
    }
}
```