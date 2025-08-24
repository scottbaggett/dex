# Task 09: Central Output Management

## Problem
Output management not fully centralized. Charter requires all generated files in `.dex` at project root with consistent naming.

## Current State
- OutputManager exists but not used consistently
- Some outputs go to `.dex/` directory
- Naming convention partially implemented
- Not all commands use OutputManager

## Requirements (P0 Charter)
- All generated files in `.dex` at project root
- Consistent naming: `dex.<cmd>.<context>.<ext>`
- Central output management
- Automatic directory creation
- Clean command to remove outputs

## Implementation Plan
1. Enhance OutputManager for all commands
2. Enforce `.dex/` directory usage
3. Implement consistent naming convention
4. Add output registry/manifest
5. Create clean command
6. Add output rotation/limits

## Acceptance Criteria
- [ ] All commands use OutputManager
- [ ] All outputs in `.dex/` directory
- [ ] Consistent naming convention enforced
- [ ] `.dex/` created automatically
- [ ] Clean command removes all outputs
- [ ] Output manifest tracks all files
- [ ] Configurable output limits

## Output Structure
```
.dex/
├── dex.extract.staged.xml
├── dex.extract.feature-branch.json
├── dex.distill.all.md
├── dex.tree.public.txt
├── dex.combine.selected.xml
├── manifest.json
└── config.yml
```

## Files to Modify
- `src/utils/output-manager.ts` - enhance functionality
- All command files - use OutputManager
- `src/commands/clean.ts` - new clean command
- Update `.gitignore` templates

## Testing Requirements
- Unit tests for OutputManager
- Integration tests for output flow
- Clean command tests
- Directory creation tests
- Naming convention validation

## Implementation Details

### 1. Enhanced OutputManager Class

```typescript
// src/utils/output-manager.ts
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { GitExtractor } from '../core/git';

interface OutputOptions {
    command: string;
    context: string;
    format: string;
}

interface OutputManifestEntry {
    filename: string;
    command: string;
    context: string;
    format: string;
    timestamp: string;
    size: number;
    path: string;
}

interface OutputManifest {
    version: string;
    entries: OutputManifestEntry[];
    totalSize: number;
    lastUpdated: string;
}

export class OutputManager {
    private outputDir: string;
    private manifestPath: string;
    private maxOutputs: number = 50;
    private maxTotalSize: number = 100 * 1024 * 1024; // 100MB

    constructor() {
        this.outputDir = this.getOutputDirectory();
        this.manifestPath = join(this.outputDir, 'manifest.json');
        this.ensureOutputDirectory();
    }

    private async getOutputDirectory(): Promise<string> {
        const git = new GitExtractor();
        const repoRoot = await git.getRepositoryRoot();
        return join(repoRoot, '.dex');
    }

    private ensureOutputDirectory(): void {
        if (!existsSync(this.outputDir)) {
            mkdirSync(this.outputDir, { recursive: true });
        }
    }

    public generateFilename(options: OutputOptions): string {
        const { command, context, format } = options;
        return `dex.${command}.${context}.${format}`;
    }

    public async saveOutput(content: string, options: OutputOptions): Promise<string> {
        const filename = this.generateFilename(options);
        const filePath = join(this.outputDir, filename);
        
        writeFileSync(filePath, content, 'utf-8');
        
        await this.updateManifest({
            filename,
            command: options.command,
            context: options.context,
            format: options.format,
            timestamp: new Date().toISOString(),
            size: Buffer.byteLength(content, 'utf-8'),
            path: filePath
        });
        
        await this.enforceRotation();
        
        return filePath;
    }

    private async updateManifest(entry: OutputManifestEntry): Promise<void> {
        const manifest = this.loadManifest();
        
        // Remove existing entry with same filename
        manifest.entries = manifest.entries.filter(e => e.filename !== entry.filename);
        
        // Add new entry
        manifest.entries.push(entry);
        manifest.totalSize = manifest.entries.reduce((sum, e) => sum + e.size, 0);
        manifest.lastUpdated = new Date().toISOString();
        
        writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
    }

    private loadManifest(): OutputManifest {
        if (existsSync(this.manifestPath)) {
            const content = readFileSync(this.manifestPath, 'utf-8');
            return JSON.parse(content);
        }
        
        return {
            version: '1.0.0',
            entries: [],
            totalSize: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    private async enforceRotation(): Promise<void> {
        const manifest = this.loadManifest();
        
        // Sort by timestamp (oldest first)
        manifest.entries.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // Remove old files if exceeding limits
        while (manifest.entries.length > this.maxOutputs || 
               manifest.totalSize > this.maxTotalSize) {
            const oldest = manifest.entries.shift();
            if (oldest && existsSync(oldest.path)) {
                unlinkSync(oldest.path);
            }
        }
        
        // Update manifest
        manifest.totalSize = manifest.entries.reduce((sum, e) => sum + e.size, 0);
        writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
    }

    public async cleanAll(): Promise<number> {
        const files = readdirSync(this.outputDir);
        let count = 0;
        
        for (const file of files) {
            if (file !== 'manifest.json' && file !== 'config.yml') {
                const filePath = join(this.outputDir, file);
                unlinkSync(filePath);
                count++;
            }
        }
        
        // Reset manifest
        const manifest: OutputManifest = {
            version: '1.0.0',
            entries: [],
            totalSize: 0,
            lastUpdated: new Date().toISOString()
        };
        writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
        
        return count;
    }
}
```

### 2. Clean Command Implementation

```typescript
// src/commands/clean.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { OutputManager } from '../utils/output-manager';

export function createCleanCommand(): Command {
    const cmd = new Command('clean');
    
    cmd
        .description('Clean all generated output files from .dex directory')
        .option('--dry-run', 'Show what would be deleted without deleting')
        .option('--keep-config', 'Keep configuration files')
        .action(async (options) => {
            const spinner = ora('Cleaning output files...').start();
            
            try {
                const outputManager = new OutputManager();
                
                if (options.dryRun) {
                    const manifest = outputManager.loadManifest();
                    spinner.succeed(
                        chalk.yellow(`Would delete ${manifest.entries.length} files (${(manifest.totalSize / 1024).toFixed(2)} KB)`)
                    );
                    
                    for (const entry of manifest.entries) {
                        console.log(chalk.gray(`  - ${entry.filename}`));
                    }
                } else {
                    const count = await outputManager.cleanAll();
                    spinner.succeed(
                        chalk.green(`Cleaned ${count} output files from .dex directory`)
                    );
                }
            } catch (error) {
                spinner.fail(chalk.red(`Failed to clean: ${error.message}`));
                process.exit(1);
            }
        });
    
    return cmd;
}
```

### 3. Command Integration Pattern

```typescript
// Update each command to use OutputManager
// Example for distill command:

import { OutputManager } from '../utils/output-manager';

// In the command action:
const outputManager = new OutputManager();

if (options.stdout) {
    console.log(output);
} else if (options.clipboard) {
    await clipboardy.write(output);
} else {
    // Use OutputManager for consistent file handling
    const filePath = await outputManager.saveOutput(output, {
        command: 'distill',
        context: options.path || 'all',
        format: options.format || 'md'
    });
    
    console.log(chalk.green(`Saved to ${filePath}`));
}
```