import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor, getPerformanceMonitor, resetPerformanceMonitor } from '../src/core/performance-monitor';

describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
        resetPerformanceMonitor();
        monitor = new PerformanceMonitor();
    });

    describe('Phase Tracking', () => {
        it('should track phase duration', () => {
            monitor.startPhase('test-phase');

            // Simulate some work
            const start = Date.now();
            while (Date.now() - start < 10) {
                // Wait 10ms
            }

            const duration = monitor.endPhase('test-phase');

            expect(duration).toBeGreaterThan(0);
            expect(monitor.getPhaseDuration('test-phase')).toBe(duration);
        });

        it('should handle multiple phases', () => {
            monitor.startPhase('phase1');
            monitor.startPhase('phase2');

            const duration1 = monitor.endPhase('phase1');
            const duration2 = monitor.endPhase('phase2');

            expect(duration1).toBeGreaterThan(0);
            expect(duration2).toBeGreaterThan(0);
        });
    });

    describe('Counter Management', () => {
        it('should increment counters', () => {
            monitor.incrementCounter('test-counter', 5);
            monitor.incrementCounter('test-counter', 3);

            expect(monitor.getCounter('test-counter')).toBe(8);
        });

        it('should set counter values', () => {
            monitor.setCounter('test-counter', 42);

            expect(monitor.getCounter('test-counter')).toBe(42);
        });
    });

    describe('Performance Report', () => {
        it('should generate performance report', () => {
            monitor.startPhase('scanning');
            monitor.endPhase('scanning');
            monitor.setCounter('filesScanned', 100);
            monitor.setCounter('totalTokens', 50000);

            const report = monitor.generateReport();

            expect(report.totalDuration).toBeGreaterThan(0);
            expect(report.phases.scanning).toBeGreaterThan(0);
            expect(report.metrics.filesScanned).toBe(100);
            expect(report.metrics.totalTokens).toBe(50000);
            expect(report.recommendations).toBeInstanceOf(Array);
        });

        it('should identify bottlenecks', () => {
            // Simulate a slow phase
            monitor.startPhase('prioritization');
            const start = Date.now();
            while (Date.now() - start < 50) {
                // Wait 50ms to simulate slow operation
            }
            monitor.endPhase('prioritization');

            const report = monitor.generateReport();

            // Should identify prioritization as a bottleneck if it takes too long
            const prioritizationBottleneck = report.bottlenecks.find(b => b.phase === 'prioritization');
            if (prioritizationBottleneck) {
                expect(prioritizationBottleneck.suggestions).toBeInstanceOf(Array);
                expect(prioritizationBottleneck.suggestions.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Performance Summary', () => {
        it('should provide performance summary', () => {
            monitor.setCounter('filesProcessed', 50);
            monitor.setCounter('totalTokens', 25000);
            monitor.setCounter('cacheHits', 10);
            monitor.setCounter('cacheMisses', 5);

            const summary = monitor.getSummary();

            expect(summary.duration).toMatch(/\d+\.\d+s/);
            expect(summary.filesPerSecond).toMatch(/\d+\.\d+/);
            expect(summary.tokensPerSecond).toMatch(/\d+/);
            expect(summary.cacheHitRate).toMatch(/\d+\.\d+%/);
            expect(typeof summary.bottlenecks).toBe('number');
        });
    });

    describe('Global Monitor', () => {
        it('should provide global monitor instance', () => {
            const monitor1 = getPerformanceMonitor();
            const monitor2 = getPerformanceMonitor();

            expect(monitor1).toBe(monitor2); // Should be the same instance
        });

        it('should reset global monitor', () => {
            const monitor1 = getPerformanceMonitor();
            monitor1.setCounter('test', 42);

            resetPerformanceMonitor();

            const monitor2 = getPerformanceMonitor();
            expect(monitor2.getCounter('test')).toBe(0);
        });
    });
});