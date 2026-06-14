/**
 * Story 5-1: Performance Baseline — JS Round-Resolution Timing
 *
 * Measures how long a single nextRound() call takes in the Node.js environment.
 * This is a proxy for the ≤5ms JS budget defined in technical-preferences.md.
 *
 * Note: Node.js timing is faster than a browser (no rendering overhead), so
 * a PASS here is necessary but not sufficient — browser measurement is still
 * recommended via Chrome DevTools Performance panel during manual QA.
 *
 * The test runs nextRound() 20 times and asserts the MEDIAN is within budget.
 * Outliers (GC pauses, JIT warmup) are excluded by taking the median.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

describe('round-resolution timing (Story 5-1)', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('nextRound() completes within 5ms median across 20 runs (JS budget)', () => {
        const timings: number[] = [];

        for (let i = 0; i < 20; i++) {
            // Reset to mid-game state (round 5, recurring effects active)
            useGameStore.setState((s) => ({
                gameManagement: {
                    ...s.gameManagement,
                    round: 5,
                    dayEnded: true,
                    phase: 'start',
                    activeRecurringEffects: [
                        { id: 1, label: 'laws.recurring.test_income', incomeBonus: 25, rounds: 3 },
                        { id: 2, label: 'laws.recurring.test_expense', expenseBonus: 15, rounds: 2 },
                    ],
                },
                budget: {
                    ...s.budget,
                    treasury: 400,
                    taxes: { peopleTaxes: 20, businessTaxes: 35 },
                    spending: { health: 5, infrastructure: 5, security: 5, education: 5 },
                },
                relations: {
                    ...s.relations,
                    current: { military: 1, business: 0, people: -1 },
                },
            }));

            const start = performance.now();
            useGameStore.getState().gameManagement.nextRound();
            const end = performance.now();
            timings.push(end - start);

            // Reset for next iteration
            useGameStore.getState().gameManagement.setPhase('start');
        }

        const medianMs = median(timings);
        const maxMs = Math.max(...timings);
        const minMs = Math.min(...timings);

        // Log for the baseline report
        console.log(`[perf] nextRound() timing — median: ${medianMs.toFixed(3)}ms, min: ${minMs.toFixed(3)}ms, max: ${maxMs.toFixed(3)}ms`);

        // Budget: ≤5ms median (Node env — browser may be slightly higher)
        expect(medianMs).toBeLessThan(5);
    });
});
