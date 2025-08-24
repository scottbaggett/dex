# Task 04: Integrate Progress Feedback

## Problem
Progress feedback not consistently integrated across long operations. Charter requires file counts, phase names, and ETA.

## Current State
- `DistillerProgress` class exists
- Basic ora spinners used
- No ETA calculations
- Inconsistent progress reporting
- No standardized progress interface

## Requirements (P0 Charter)
- For long operations, show file counts
- Display phase names
- Calculate and show ETA
- Progress bars for multi-step operations
- Consistent progress UX across commands

## Implementation Plan
1. Create unified `ProgressManager` in `src/core/progress/manager.ts`
2. Implement ETA calculation algorithm
3. Create progress phases system
4. Add file counting and tracking
5. Integrate with all long-running operations
6. Support both TTY and non-TTY environments

## Acceptance Criteria
- [ ] All commands use unified progress system
- [ ] ETA shown for operations >2 seconds
- [ ] File counts displayed during scanning
- [ ] Phase names clearly indicated
- [ ] Progress bars for determinate operations
- [ ] Graceful fallback for non-TTY
- [ ] Progress can be disabled with --quiet flag

## Progress Phases
- Scanning (file discovery)
- Analyzing (parsing/processing)
- Extracting (git operations)
- Formatting (output generation)
- Writing (file I/O)

## Files to Create/Modify
- `src/core/progress/manager.ts` - unified progress manager
- `src/core/progress/eta.ts` - ETA calculation
- `src/core/progress/phases.ts` - phase definitions
- `src/core/progress/indicators.ts` - progress indicators and themes
- `src/core/progress/types.ts` - progress system types
- Update all commands to use progress manager
- Update existing DistillerProgress
- Integrate with performance monitor

## Testing Requirements
- Unit tests for ETA calculations
- Integration tests for progress flow
- TTY and non-TTY environment tests
- Performance impact tests
- Theme and indicator tests
- ETA accuracy validation

---

# Detailed Implementation Guide

## 1. Complete ProgressManager Class Implementation

### Core Types and Interfaces

```typescript
// src/core/progress/types.ts
export interface ProgressPhase {
    name: string;
    displayName: string;
    weight: number; // Relative weight for ETA calculation
    color: string;
    icon: string;
}

export interface ProgressState {
    phase: ProgressPhase;
    current: number;
    total: number;
    startTime: number;
    phaseStartTime: number;
    metadata?: Record<string, any>;
}

export interface ETACalculation {
    estimated: number; // milliseconds
    confidence: 'low' | 'medium' | 'high';
    remainingTime: string; // formatted string
    estimatedCompletion: Date;
}

export interface ProgressOptions {
    quiet?: boolean;
    theme?: 'default' | 'minimal' | 'verbose' | 'compact';
    showETA?: boolean;
    showFileCount?: boolean;
    showPhase?: boolean;
    updateInterval?: number; // milliseconds
    minDisplayTime?: number; // minimum time before showing progress
}

export interface ProgressTheme {
    name: string;
    spinner: string;
    progressBar: {
        filled: string;
        empty: string;
        prefix: string;
        suffix: string;
    };
    colors: {
        primary: string;
        secondary: string;
        success: string;
        warning: string;
        error: string;
    };
    formatting: {
        showPercentage: boolean;
        showFileCount: boolean;
        showETA: boolean;
        showSpeed: boolean;
    };
}
```

### ETA Calculation Engine

```typescript
// src/core/progress/eta.ts
import { ProgressPhase, ProgressState, ETACalculation } from './types';

export class ETACalculator {
    private historyWindow = 10; // Number of samples for moving average
    private history: Array<{ timestamp: number; progress: number }> = [];
    private phaseWeights: Map<string, number> = new Map();

    constructor(phases: ProgressPhase[]) {
        // Initialize phase weights for multi-phase operations
        phases.forEach(phase => {
            this.phaseWeights.set(phase.name, phase.weight);
        });
    }

    calculate(state: ProgressState, allPhases: ProgressPhase[]): ETACalculation {
        const now = Date.now();
        const elapsed = now - state.startTime;
        const phaseElapsed = now - state.phaseStartTime;
        
        // Add current progress to history
        this.addToHistory(now, state.current / state.total);
        
        if (elapsed < 1000) {
            // Not enough data for reliable ETA
            return {
                estimated: 0,
                confidence: 'low',
                remainingTime: 'calculating...',
                estimatedCompletion: new Date(now)
            };
        }

        const eta = this.calculateMultiPhaseETA(state, allPhases);
        const confidence = this.calculateConfidence(elapsed, state.current, state.total);
        
        return {
            estimated: eta,
            confidence,
            remainingTime: this.formatTime(eta),
            estimatedCompletion: new Date(now + eta)
        };
    }

    private calculateMultiPhaseETA(state: ProgressState, allPhases: ProgressPhase[]): number {
        const currentPhaseIndex = allPhases.findIndex(p => p.name === state.phase.name);
        if (currentPhaseIndex === -1) return 0;

        // Calculate remaining time for current phase
        const phaseProgress = state.current / state.total;
        const phaseSpeed = this.calculateSpeed();
        
        if (phaseSpeed <= 0) {
            // Fallback to simple linear estimation
            const elapsed = Date.now() - state.phaseStartTime;
            return elapsed / phaseProgress * (1 - phaseProgress);
        }

        const currentPhaseRemaining = (state.total - state.current) / phaseSpeed;
        
        // Estimate time for remaining phases based on weights
        const totalWeight = allPhases.reduce((sum, p) => sum + p.weight, 0);
        const remainingPhases = allPhases.slice(currentPhaseIndex + 1);
        const remainingWeight = remainingPhases.reduce((sum, p) => sum + p.weight, 0);
        
        const averagePhaseTime = (Date.now() - state.startTime) / (currentPhaseIndex + phaseProgress);
        const remainingPhasesTime = averagePhaseTime * (remainingWeight / state.phase.weight);
        
        return currentPhaseRemaining + remainingPhasesTime;
    }

    private calculateSpeed(): number {
        if (this.history.length < 2) return 0;
        
        // Use moving average of recent speeds
        const recentHistory = this.history.slice(-this.historyWindow);
        let totalSpeed = 0;
        let validSamples = 0;
        
        for (let i = 1; i < recentHistory.length; i++) {
            const timeDelta = recentHistory[i].timestamp - recentHistory[i - 1].timestamp;
            const progressDelta = recentHistory[i].progress - recentHistory[i - 1].progress;
            
            if (timeDelta > 0) {
                totalSpeed += progressDelta / timeDelta;
                validSamples++;
            }
        }
        
        return validSamples > 0 ? totalSpeed / validSamples : 0;
    }

    private calculateConfidence(elapsed: number, current: number, total: number): 'low' | 'medium' | 'high' {
        const progress = current / total;
        const samples = this.history.length;
        
        if (elapsed < 2000 || samples < 3) return 'low';
        if (elapsed > 10000 && progress > 0.1 && samples >= 5) return 'high';
        return 'medium';
    }

    private addToHistory(timestamp: number, progress: number): void {
        this.history.push({ timestamp, progress });
        
        // Keep only recent history
        if (this.history.length > this.historyWindow * 2) {
            this.history = this.history.slice(-this.historyWindow);
        }
    }

    private formatTime(milliseconds: number): string {
        if (milliseconds < 1000) return '<1s';
        if (milliseconds < 60000) return `${Math.round(milliseconds / 1000)}s`;
        if (milliseconds < 3600000) {
            const minutes = Math.floor(milliseconds / 60000);
            const seconds = Math.round((milliseconds % 60000) / 1000);
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.round((milliseconds % 3600000) / 60000);
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    reset(): void {
        this.history = [];
    }
}
```

### Progress Phases System

```typescript
// src/core/progress/phases.ts
import { ProgressPhase } from './types';

export const PROGRESS_PHASES: Record<string, ProgressPhase> = {
    SCANNING: {
        name: 'scanning',
        displayName: 'Scanning',
        weight: 1,
        color: 'cyan',
        icon: '🔍'
    },
    ANALYZING: {
        name: 'analyzing',
        displayName: 'Analyzing',
        weight: 3,
        color: 'yellow',
        icon: '🔬'
    },
    EXTRACTING: {
        name: 'extracting',
        displayName: 'Extracting',
        weight: 2,
        color: 'blue',
        icon: '⚡'
    },
    FORMATTING: {
        name: 'formatting',
        displayName: 'Formatting',
        weight: 1,
        color: 'magenta',
        icon: '✨'
    },
    WRITING: {
        name: 'writing',
        displayName: 'Writing',
        weight: 1,
        color: 'green',
        icon: '💾'
    },
    DISTILLING: {
        name: 'distilling',
        displayName: 'Distilling',
        weight: 4,
        color: 'cyan',
        icon: '🧪'
    },
    COMBINING: {
        name: 'combining',
        displayName: 'Combining',
        weight: 2,
        color: 'blue',
        icon: '🔗'
    },
    COMPRESSING: {
        name: 'compressing',
        displayName: 'Compressing',
        weight: 2,
        color: 'yellow',
        icon: '📦'
    }
};

export class PhaseManager {
    private phases: ProgressPhase[] = [];
    private currentPhaseIndex = 0;
    private phaseStartTimes: Map<string, number> = new Map();
    private phaseEndTimes: Map<string, number> = new Map();

    constructor(phaseNames: string[]) {
        this.phases = phaseNames.map(name => {
            const phase = PROGRESS_PHASES[name.toUpperCase()];
            if (!phase) {
                throw new Error(`Unknown progress phase: ${name}`);
            }
            return phase;
        });
    }

    getCurrentPhase(): ProgressPhase | null {
        return this.phases[this.currentPhaseIndex] || null;
    }

    getAllPhases(): ProgressPhase[] {
        return [...this.phases];
    }

    nextPhase(): ProgressPhase | null {
        if (this.currentPhaseIndex < this.phases.length - 1) {
            const currentPhase = this.phases[this.currentPhaseIndex];
            this.phaseEndTimes.set(currentPhase.name, Date.now());
            
            this.currentPhaseIndex++;
            const nextPhase = this.phases[this.currentPhaseIndex];
            this.phaseStartTimes.set(nextPhase.name, Date.now());
            
            return nextPhase;
        }
        return null;
    }

    startCurrentPhase(): void {
        const currentPhase = this.getCurrentPhase();
        if (currentPhase) {
            this.phaseStartTimes.set(currentPhase.name, Date.now());
        }
    }

    getPhaseMetrics(phaseName: string): { duration: number } | null {
        const startTime = this.phaseStartTimes.get(phaseName);
        const endTime = this.phaseEndTimes.get(phaseName);
        
        if (startTime && endTime) {
            return { duration: endTime - startTime };
        }
        return null;
    }

    getTotalPhases(): number {
        return this.phases.length;
    }

    getCurrentPhaseIndex(): number {
        return this.currentPhaseIndex;
    }

    isLastPhase(): boolean {
        return this.currentPhaseIndex === this.phases.length - 1;
    }

    reset(): void {
        this.currentPhaseIndex = 0;
        this.phaseStartTimes.clear();
        this.phaseEndTimes.clear();
    }
}
```

### Progress Indicators and Themes

```typescript
// src/core/progress/indicators.ts
import chalk from 'chalk';
import { ProgressTheme, ProgressState, ETACalculation } from './types';

export const PROGRESS_THEMES: Record<string, ProgressTheme> = {
    default: {
        name: 'default',
        spinner: 'dots',
        progressBar: {
            filled: '█',
            empty: '░',
            prefix: '[',
            suffix: ']'
        },
        colors: {
            primary: 'cyan',
            secondary: 'gray',
            success: 'green',
            warning: 'yellow',
            error: 'red'
        },
        formatting: {
            showPercentage: true,
            showFileCount: true,
            showETA: true,
            showSpeed: true
        }
    },
    minimal: {
        name: 'minimal',
        spinner: 'line',
        progressBar: {
            filled: '▓',
            empty: '░',
            prefix: '',
            suffix: ''
        },
        colors: {
            primary: 'white',
            secondary: 'gray',
            success: 'green',
            warning: 'yellow',
            error: 'red'
        },
        formatting: {
            showPercentage: false,
            showFileCount: true,
            showETA: false,
            showSpeed: false
        }
    },
    verbose: {
        name: 'verbose',
        spinner: 'bouncingBar',
        progressBar: {
            filled: '█',
            empty: '▒',
            prefix: '【',
            suffix: '】'
        },
        colors: {
            primary: 'cyan',
            secondary: 'gray',
            success: 'green',
            warning: 'yellow',
            error: 'red'
        },
        formatting: {
            showPercentage: true,
            showFileCount: true,
            showETA: true,
            showSpeed: true
        }
    },
    compact: {
        name: 'compact',
        spinner: 'dots2',
        progressBar: {
            filled: '■',
            empty: '□',
            prefix: '',
            suffix: ''
        },
        colors: {
            primary: 'blue',
            secondary: 'gray',
            success: 'green',
            warning: 'yellow',
            error: 'red'
        },
        formatting: {
            showPercentage: true,
            showFileCount: false,
            showETA: true,
            showSpeed: false
        }
    }
};

export class ProgressIndicator {
    constructor(private theme: ProgressTheme) {}

    createProgressBar(percentage: number, width: number = 20): string {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        const { progressBar, colors } = this.theme;
        
        return chalk.hex(colors.primary)(
            progressBar.prefix +
            progressBar.filled.repeat(filled) +
            progressBar.empty.repeat(empty) +
            progressBar.suffix
        );
    }

    formatProgressText(
        state: ProgressState,
        eta: ETACalculation | null,
        additionalInfo?: Record<string, any>
    ): string {
        const { colors, formatting } = this.theme;
        const percentage = Math.round((state.current / state.total) * 100);
        const progressBar = this.createProgressBar(percentage);
        
        let parts: string[] = [];
        
        // Phase and icon
        parts.push(
            chalk.hex(state.phase.color)(`${state.phase.icon} ${state.phase.displayName}`)
        );
        
        // File count
        if (formatting.showFileCount) {
            parts.push(
                chalk.white(`${state.current}/${state.total}`) + ' files'
            );
        }
        
        // Progress bar
        parts.push(progressBar);
        
        // Percentage
        if (formatting.showPercentage) {
            parts.push(chalk.hex(colors.secondary)(`${percentage}%`));
        }
        
        // ETA
        if (formatting.showETA && eta && eta.confidence !== 'low') {
            parts.push(
                chalk.hex(colors.secondary)(`ETA: ${eta.remainingTime}`)
            );
        }
        
        // Speed
        if (formatting.showSpeed && additionalInfo?.speed) {
            parts.push(
                chalk.hex(colors.secondary)(`${additionalInfo.speed} files/s`)
            );
        }
        
        // Additional metrics
        if (additionalInfo) {
            if (additionalInfo.size) {
                parts.push(
                    chalk.hex(colors.secondary)(`${additionalInfo.size}`)
                );
            }
            if (additionalInfo.tokensSaved) {
                parts.push(
                    chalk.hex(colors.success)(`💰 ${additionalInfo.tokensSaved}k saved`)
                );
            }
        }
        
        return parts.join(' ');
    }

    formatCompletionMessage(
        totalFiles: number,
        duration: number,
        additionalInfo?: Record<string, any>
    ): string {
        const { colors } = this.theme;
        const durationStr = duration > 1000 
            ? `${(duration / 1000).toFixed(1)}s`
            : `${duration}ms`;
        
        let parts = [
            chalk.hex(colors.success)('✨ Completed'),
            chalk.white(`${totalFiles} files`),
            this.createProgressBar(100),
            chalk.hex(colors.secondary)(`in ${durationStr}`)
        ];
        
        if (additionalInfo?.compression) {
            parts.push(
                chalk.hex(colors.success)(`${additionalInfo.compression}% compression`)
            );
        }
        
        if (additionalInfo?.tokensSaved) {
            parts.push(
                chalk.hex(colors.success)(`💰 ~${additionalInfo.tokensSaved}k tokens saved`)
            );
        }
        
        return parts.join(' ');
    }

    formatErrorMessage(error: string): string {
        const { colors } = this.theme;
        return chalk.hex(colors.error)(`❌ Error: ${error}`);
    }
}
```

## 2. Unified ProgressManager Implementation

```typescript
// src/core/progress/manager.ts
import ora, { Ora } from 'ora';
import { PerformanceMonitor } from '../performance-monitor';
import { ETACalculator } from './eta';
import { PhaseManager } from './phases';
import { ProgressIndicator, PROGRESS_THEMES } from './indicators';
import { ProgressOptions, ProgressState, ProgressTheme } from './types';

export class ProgressManager {
    private etaCalculator: ETACalculator;
    private phaseManager: PhaseManager;
    private indicator: ProgressIndicator;
    private spinner?: Ora;
    private state?: ProgressState;
    private options: Required<ProgressOptions>;
    private performanceMonitor?: PerformanceMonitor;
    private lastUpdateTime = 0;
    private isCompleted = false;

    constructor(
        phases: string[],
        options: ProgressOptions = {},
        performanceMonitor?: PerformanceMonitor
    ) {
        this.options = {
            quiet: false,
            theme: 'default',
            showETA: true,
            showFileCount: true,
            showPhase: true,
            updateInterval: 100,
            minDisplayTime: 500,
            ...options
        };

        this.phaseManager = new PhaseManager(phases);
        this.etaCalculator = new ETACalculator(this.phaseManager.getAllPhases());
        
        const theme = PROGRESS_THEMES[this.options.theme] || PROGRESS_THEMES.default;
        this.indicator = new ProgressIndicator(theme);
        
        this.performanceMonitor = performanceMonitor;
    }

    start(total: number, metadata?: Record<string, any>): void {
        if (this.options.quiet || this.isCompleted) return;

        const currentPhase = this.phaseManager.getCurrentPhase();
        if (!currentPhase) {
            throw new Error('No phases configured for progress tracking');
        }

        this.phaseManager.startCurrentPhase();
        this.performanceMonitor?.startPhase(currentPhase.name, metadata);

        this.state = {
            phase: currentPhase,
            current: 0,
            total,
            startTime: Date.now(),
            phaseStartTime: Date.now(),
            metadata
        };

        // Only show progress in TTY environments
        if (this.shouldShowProgress()) {
            const theme = PROGRESS_THEMES[this.options.theme];
            this.spinner = ora({
                spinner: theme.spinner as any,
                stream: process.stderr,
                color: theme.colors.primary as any
            });
            
            // Start with initial display after minimum time
            setTimeout(() => {
                if (!this.isCompleted && this.spinner) {
                    this.updateDisplay();
                }
            }, this.options.minDisplayTime);
        }
    }

    update(
        current: number,
        additionalInfo?: Record<string, any>
    ): void {
        if (this.options.quiet || !this.state || this.isCompleted) return;

        this.state.current = Math.min(current, this.state.total);
        this.state.metadata = { ...this.state.metadata, ...additionalInfo };

        // Throttle updates
        const now = Date.now();
        if (now - this.lastUpdateTime < this.options.updateInterval) {
            return;
        }
        this.lastUpdateTime = now;

        if (this.shouldShowProgress()) {
            this.updateDisplay();
        }
    }

    nextPhase(total?: number, metadata?: Record<string, any>): boolean {
        if (this.options.quiet || !this.state || this.isCompleted) return false;

        // End current phase in performance monitor
        this.performanceMonitor?.endPhase(this.state.phase.name);

        const nextPhase = this.phaseManager.nextPhase();
        if (!nextPhase) {
            return false;
        }

        // Start new phase
        this.performanceMonitor?.startPhase(nextPhase.name, metadata);
        
        this.state.phase = nextPhase;
        this.state.current = 0;
        this.state.total = total || this.state.total;
        this.state.phaseStartTime = Date.now();
        this.state.metadata = { ...this.state.metadata, ...metadata };

        // Reset ETA calculator for new phase
        this.etaCalculator.reset();

        if (this.shouldShowProgress()) {
            this.updateDisplay();
        }

        return true;
    }

    complete(result?: Record<string, any>): void {
        if (this.options.quiet || this.isCompleted) return;

        this.isCompleted = true;

        // End current phase in performance monitor
        if (this.state) {
            this.performanceMonitor?.endPhase(this.state.phase.name);
        }

        if (this.spinner) {
            this.spinner.stop();
        }

        // Always show completion message (even in non-TTY)
        if (this.state) {
            const duration = Date.now() - this.state.startTime;
            const completionMessage = this.indicator.formatCompletionMessage(
                this.state.total,
                duration,
                result
            );
            
            console.log(completionMessage);
        }
    }

    fail(error: string | Error): void {
        this.isCompleted = true;

        const errorMsg = error instanceof Error ? error.message : error;
        
        if (this.spinner) {
            this.spinner.stop();
        }

        if (!this.options.quiet) {
            const errorMessage = this.indicator.formatErrorMessage(errorMsg);
            console.error(errorMessage);
        }
    }

    private shouldShowProgress(): boolean {
        return process.stderr.isTTY && !this.options.quiet;
    }

    private updateDisplay(): void {
        if (!this.spinner || !this.state) return;

        const eta = this.etaCalculator.calculate(
            this.state,
            this.phaseManager.getAllPhases()
        );

        // Calculate additional metrics
        const additionalInfo: Record<string, any> = {};
        
        if (this.state.metadata) {
            Object.assign(additionalInfo, this.state.metadata);
        }

        // Calculate speed (files per second)
        const elapsed = Date.now() - this.state.startTime;
        if (elapsed > 1000) {
            additionalInfo.speed = (this.state.current / (elapsed / 1000)).toFixed(1);
        }

        const progressText = this.indicator.formatProgressText(
            this.state,
            eta,
            additionalInfo
        );

        this.spinner.text = progressText;
        
        if (!this.spinner.isSpinning) {
            this.spinner.start();
        }
    }

    // Utility methods for integration
    getCurrentState(): ProgressState | null {
        return this.state ? { ...this.state } : null;
    }

    getCurrentPhase(): string | null {
        return this.state?.phase.name || null;
    }

    getProgress(): number {
        if (!this.state || this.state.total === 0) return 0;
        return this.state.current / this.state.total;
    }

    isInProgress(): boolean {
        return !!this.state && !this.isCompleted;
    }

    setTheme(themeName: string): void {
        const theme = PROGRESS_THEMES[themeName];
        if (theme) {
            this.indicator = new ProgressIndicator(theme);
            this.options.theme = themeName as any;
        }
    }
}
```

## 3. TTY and Non-TTY Implementations

```typescript
// Enhanced ProgressManager with TTY detection
export class AdaptiveProgressManager extends ProgressManager {
    private fallbackReporter?: NonTTYReporter;

    constructor(phases: string[], options: ProgressOptions = {}, performanceMonitor?: PerformanceMonitor) {
        super(phases, options, performanceMonitor);
        
        // Initialize non-TTY fallback if needed
        if (!process.stderr.isTTY && !options.quiet) {
            this.fallbackReporter = new NonTTYReporter(options);
        }
    }

    protected shouldShowProgress(): boolean {
        return !this.options.quiet; // Show progress in both TTY and non-TTY
    }

    protected updateDisplay(): void {
        if (process.stderr.isTTY) {
            super.updateDisplay();
        } else if (this.fallbackReporter && this.state) {
            this.fallbackReporter.update(this.state);
        }
    }
}

class NonTTYReporter {
    private lastReport = 0;
    private reportInterval: number;

    constructor(options: ProgressOptions) {
        this.reportInterval = options.updateInterval ? options.updateInterval * 10 : 1000;
    }

    update(state: ProgressState): void {
        const now = Date.now();
        if (now - this.lastReport < this.reportInterval) {
            return;
        }

        const percentage = Math.round((state.current / state.total) * 100);
        const elapsed = Math.round((now - state.startTime) / 1000);
        
        console.log(
            `[${state.phase.displayName}] ${state.current}/${state.total} files (${percentage}%) - ${elapsed}s elapsed`
        );
        
        this.lastReport = now;
    }
}
```

## 4. Integration Patterns for All Commands

### Command Integration Example

```typescript
// Example integration in distill command
export function createDistillCommand(): Command {
    return program
        .command('distill')
        .option('--quiet', 'suppress progress output')
        .option('--progress-theme <theme>', 'progress theme (default|minimal|verbose|compact)', 'default')
        .action(async (options) => {
            const performanceMonitor = getPerformanceMonitor();
            
            const progress = new ProgressManager(
                ['scanning', 'analyzing', 'distilling', 'formatting', 'writing'],
                {
                    quiet: options.quiet,
                    theme: options.progressTheme,
                    showETA: true,
                    showFileCount: true
                },
                performanceMonitor
            );

            try {
                // Phase 1: Scanning
                progress.start(0, { phase: 'File Discovery' });
                const files = await scanFiles(options.path, (count) => {
                    progress.update(count);
                });
                
                // Phase 2: Analyzing
                progress.nextPhase(files.length, { phase: 'Code Analysis' });
                const analyzed = await analyzeFiles(files, (current) => {
                    progress.update(current, { 
                        size: `${(getTotalSize(files.slice(0, current)) / 1024).toFixed(1)}KB`
                    });
                });
                
                // Phase 3: Distilling
                progress.nextPhase(analyzed.length);
                const result = await distillFiles(analyzed, (current, originalTokens, distilledTokens) => {
                    const tokensSaved = Math.round((originalTokens - distilledTokens) / 1000);
                    progress.update(current, { tokensSaved });
                });
                
                progress.complete({
                    compression: result.compressionRatio,
                    tokensSaved: Math.round((result.originalTokens - result.distilledTokens) / 1000)
                });
                
            } catch (error) {
                progress.fail(error as Error);
                throw error;
            }
        });
}
```

### Legacy DistillerProgress Migration

```typescript
// Updated DistillerProgress to use new system
import { ProgressManager } from '../progress/manager';
import { PerformanceMonitor } from '../performance-monitor';

export class DistillerProgress {
    private progressManager: ProgressManager;
    
    constructor(options: { quiet?: boolean; theme?: string } = {}) {
        const performanceMonitor = getPerformanceMonitor();
        
        this.progressManager = new ProgressManager(
            ['distilling'],
            {
                quiet: options.quiet,
                theme: options.theme || 'default',
                showETA: true,
                showFileCount: true
            },
            performanceMonitor
        );
    }

    start(totalFiles: number): void {
        this.progressManager.start(totalFiles, { operation: 'distillation' });
    }

    update(filesProcessed: number, originalBytes: number, distilledBytes: number): void {
        const tokensSaved = Math.round((originalBytes - distilledBytes) / 4 / 1000);
        const size = `${Math.round(distilledBytes / 1024)}KB`;
        
        this.progressManager.update(filesProcessed, { tokensSaved, size });
    }

    complete(result: { originalTokens: number; distilledTokens: number; fileCount: number }): void {
        const compressionRatio = result.originalTokens > 0 
            ? Math.round((1 - result.distilledTokens / result.originalTokens) * 100)
            : 0;
        const tokensSaved = Math.round((result.originalTokens - result.distilledTokens) / 1000);
        
        this.progressManager.complete({ compression: compressionRatio, tokensSaved });
    }

    fail(error: string): void {
        this.progressManager.fail(error);
    }

    // Legacy compatibility
    get isSpinning(): boolean {
        return this.progressManager.isInProgress();
    }
}
```

## 5. Performance-Aware Progress Updates

```typescript
// Integration with existing performance monitor
export class PerformanceAwareProgressManager extends ProgressManager {
    private performanceThresholds = {
        updateFrequency: 100, // Base update frequency
        adaptiveThrottling: true,
        maxUpdatesPerSecond: 20
    };
    
    private adaptiveUpdateInterval = 100;
    private lastPerformanceCheck = 0;
    
    protected updateDisplay(): void {
        // Adaptive throttling based on system performance
        if (this.performanceThresholds.adaptiveThrottling) {
            this.adjustUpdateFrequency();
        }
        
        super.updateDisplay();
    }
    
    private adjustUpdateFrequency(): void {
        const now = Date.now();
        if (now - this.lastPerformanceCheck < 1000) return; // Check every second
        
        const performanceReport = this.performanceMonitor?.generateReport();
        if (performanceReport) {
            const { bottlenecks, metrics } = performanceReport;
            
            // Slow down updates if there are performance bottlenecks
            if (bottlenecks.length > 0) {
                this.adaptiveUpdateInterval = Math.min(this.adaptiveUpdateInterval * 1.5, 500);
            } else if (metrics.filesProcessed > 100) {
                // Speed up for large operations
                this.adaptiveUpdateInterval = Math.max(this.adaptiveUpdateInterval * 0.8, 50);
            }
            
            this.options.updateInterval = this.adaptiveUpdateInterval;
        }
        
        this.lastPerformanceCheck = now;
    }
}
```

## 6. Testing Implementation

```typescript
// src/core/progress/__tests__/eta-calculator.test.ts
import { test, expect } from 'bun:test';
import { ETACalculator } from '../eta';
import { PROGRESS_PHASES } from '../phases';

test('ETACalculator - basic calculation', () => {
    const phases = [PROGRESS_PHASES.SCANNING, PROGRESS_PHASES.ANALYZING];
    const calculator = new ETACalculator(phases);
    
    const state = {
        phase: PROGRESS_PHASES.SCANNING,
        current: 50,
        total: 100,
        startTime: Date.now() - 10000, // 10 seconds ago
        phaseStartTime: Date.now() - 10000
    };
    
    const eta = calculator.calculate(state, phases);
    
    expect(eta.estimated).toBeGreaterThan(0);
    expect(eta.confidence).toBe('medium');
    expect(eta.remainingTime).toContain('s');
});

test('ProgressManager - complete workflow', async () => {
    const progress = new ProgressManager(['scanning', 'analyzing'], {
        quiet: true // Prevent TTY output during tests
    });
    
    progress.start(100);
    expect(progress.getCurrentPhase()).toBe('scanning');
    
    progress.update(50);
    expect(progress.getProgress()).toBe(0.5);
    
    const phaseChanged = progress.nextPhase();
    expect(phaseChanged).toBe(true);
    expect(progress.getCurrentPhase()).toBe('analyzing');
    
    progress.complete({ fileCount: 100 });
    expect(progress.isInProgress()).toBe(false);
});
```