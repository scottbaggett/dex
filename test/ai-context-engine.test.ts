import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIContextEngine } from '../src/core/ai-context-engine';
import { FilePrioritizer } from '../src/core/file-prioritizer';
import { TokenEstimator } from '../src/core/token-estimator';
import { FileScanner } from '../src/utils/file-scanner';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('../src/utils/file-scanner');
vi.mock('../src/core/file-prioritizer');
vi.mock('../src/core/token-estimator');
vi.mock('../src/core/config', () => ({
    loadConfig: () => ({
        ai: {
            provider: 'anthropic',
            model: 'claude-3-opus',
            interactive: {
                preSelectHigh: true,
                preSelectMedium: false,
                preSelectLow: false
            }
        }
    })
}));
vi.mock('fs/promises');

describe('AIContextEngine', () => {
    let aiContextEngine: AIContextEngine;

    beforeEach(() => {
        vi.resetAllMocks();
        aiContextEngine = new AIContextEngine();

        // Mock FileScanner
        (FileScanner.prototype.scan as any).mockResolvedValue([
            {
                path: '/repo/src/index.ts',
                relativePath: 'src/index.ts',
                size: 1000,
                lastModified: new Date(),
                isDirectory: false
            },
            {
                path: '/repo/README.md',
                relativePath: 'README.md',
                size: 500,
                lastModified: new Date(),
                isDirectory: false
            }
        ]);

        // Mock FilePrioritizer
        (FilePrioritizer.prototype.prioritize as any).mockResolvedValue([
            {
                path: '/repo/README.md',
                relativePath: 'README.md',
                size: 500,
                lastModified: new Date(),
                isDirectory: false,
                priority: 'high',
                reason: 'Core documentation'
            },
            {
                path: '/repo/src/index.ts',
                relativePath: 'src/index.ts',
                size: 1000,
                lastModified: new Date(),
                isDirectory: false,
                priority: 'medium',
                reason: 'Main entry point'
            }
        ]);

        // Mock TokenEstimator
        (TokenEstimator.prototype.estimateTokens as any).mockResolvedValue(100);
        (TokenEstimator.prototype.estimateCost as any).mockReturnValue(0.05);

        // Mock fs.readFile
        (fs.readFile as any).mockImplementation((path: string) => {
            if (path.includes('README.md')) {
                return Promise.resolve('# README\nThis is a test repository.');
            }
            if (path.includes('index.ts')) {
                return Promise.resolve('console.log("Hello, world!");');
            }
            return Promise.reject(new Error('File not found'));
        });
    });

    it('should analyze codebase and return prioritized files', async () => {
        const result = await aiContextEngine.analyze({
            prompt: 'Understand the codebase structure',
            codebasePath: '/repo'
        });

        // Verify FileScanner was called
        expect(FileScanner.prototype.scan).toHaveBeenCalledWith('/repo', expect.any(Object));

        // Verify FilePrioritizer was called
        expect(FilePrioritizer.prototype.prioritize).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Understand the codebase structure'
        }));

        // Verify TokenEstimator was called
        expect(TokenEstimator.prototype.estimateTokens).toHaveBeenCalledTimes(2);
        expect(TokenEstimator.prototype.estimateCost).toHaveBeenCalledWith(200, 'anthropic', 'claude-3-opus');

        // Verify result structure
        expect(result).toMatchObject({
            selections: [
                {
                    file: 'README.md',
                    priority: 'high',
                    preSelected: true,
                    tokenEstimate: 100
                },
                {
                    file: 'src/index.ts',
                    priority: 'medium',
                    preSelected: false,
                    tokenEstimate: 100
                }
            ],
            summary: {
                totalFiles: 2,
                selectedFiles: 2,
                highPriorityCount: 1,
                mediumPriorityCount: 1,
                lowPriorityCount: 0,
                totalTokens: 200,
                estimatedCost: 0.05
            },
            prompt: 'Understand the codebase structure'
        });
    });

    it('should use bootstrap prompt when bootstrapping', async () => {
        await aiContextEngine.bootstrap('/repo');

        // Verify analyze was called with bootstrap prompt
        expect(FilePrioritizer.prototype.prioritize).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "I am a new agent and want to understand this codebase so I can effectively contribute."
            })
        );
    });
});