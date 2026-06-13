/**
 * Story 4-5: Early-game grace period — dampened early relation deltas
 *
 * Tests verify:
 *   - applyGraceDampening formula per GDD: design/gdd/early-game-grace-period.md
 *   - JS Math.round behavior: Math.floor(x + 0.5), rounds toward +∞ on exact halves
 *     Round 1: -1→0, -2→0, -3→-1, -4→-1
 *     Round 2: -1→0, -2→-1, -3→-1, -4→-2
 *     Round 3+: unchanged
 *   - Positive deltas always unchanged
 *   - getRoundTimerMs returns correct durations per round
 *   - Grace dampening flows through the Zustand store
 *
 * GDD: design/gdd/early-game-grace-period.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { applyGraceDampening, getRoundTimerMs } from '../../../src/Utils/GracePeriod';
import { useGameStore } from '../../../src/Stores/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// applyGraceDampening — pure function tests
// Math.floor(x + 0.5) is the JS algorithm: exact -.5 rounds toward +∞ (i.e. 0)
// ---------------------------------------------------------------------------

describe('applyGraceDampening — round 1 (×0.25)', () => {
    it('test_round1_neg1_dampens_to_0', () => {
        // -1 × 0.25 = -0.25 → Math.round(-0.25) = 0
        expect(applyGraceDampening(-1, 1)).toBe(0);
    });

    it('test_round1_neg2_dampens_to_0', () => {
        // -2 × 0.25 = -0.50 → Math.round(-0.5) = 0 (rounds toward +∞)
        expect(applyGraceDampening(-2, 1)).toBe(0);
    });

    it('test_round1_neg3_dampens_to_neg1', () => {
        // -3 × 0.25 = -0.75 → Math.round(-0.75) = -1
        expect(applyGraceDampening(-3, 1)).toBe(-1);
    });

    it('test_round1_neg4_dampens_to_neg1', () => {
        // -4 × 0.25 = -1.0 → Math.round(-1.0) = -1
        expect(applyGraceDampening(-4, 1)).toBe(-1);
    });
});

describe('applyGraceDampening — round 2 (×0.50)', () => {
    it('test_round2_neg1_dampens_to_0', () => {
        // -1 × 0.5 = -0.5 → Math.round(-0.5) = 0 (rounds toward +∞)
        expect(applyGraceDampening(-1, 2)).toBe(0);
    });

    it('test_round2_neg2_dampens_to_neg1', () => {
        // -2 × 0.5 = -1.0 → Math.round(-1.0) = -1
        expect(applyGraceDampening(-2, 2)).toBe(-1);
    });

    it('test_round2_neg3_dampens_to_neg1', () => {
        // -3 × 0.5 = -1.5 → Math.round(-1.5) = -1 (rounds toward +∞)
        expect(applyGraceDampening(-3, 2)).toBe(-1);
    });

    it('test_round2_neg4_dampens_to_neg2', () => {
        // -4 × 0.5 = -2.0 → Math.round(-2.0) = -2
        expect(applyGraceDampening(-4, 2)).toBe(-2);
    });
});

describe('applyGraceDampening — round 3+ (×1.0, no dampening)', () => {
    it('test_round3_neg1_unchanged', () => {
        expect(applyGraceDampening(-1, 3)).toBe(-1);
    });

    it('test_round3_neg5_unchanged', () => {
        expect(applyGraceDampening(-5, 3)).toBe(-5);
    });

    it('test_round10_neg3_unchanged', () => {
        expect(applyGraceDampening(-3, 10)).toBe(-3);
    });
});

describe('applyGraceDampening — positive deltas always unchanged', () => {
    it('test_positive_1_round1_unchanged', () => {
        expect(applyGraceDampening(1, 1)).toBe(1);
    });

    it('test_positive_3_round2_unchanged', () => {
        expect(applyGraceDampening(3, 2)).toBe(3);
    });

    it('test_zero_round1_unchanged', () => {
        expect(applyGraceDampening(0, 1)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// getRoundTimerMs — timer duration per round
// ---------------------------------------------------------------------------

describe('getRoundTimerMs', () => {
    it('test_round1_timer_180000ms', () => {
        expect(getRoundTimerMs(1)).toBe(180_000);
    });

    it('test_round2_timer_150000ms', () => {
        expect(getRoundTimerMs(2)).toBe(150_000);
    });

    it('test_round3_timer_120000ms', () => {
        expect(getRoundTimerMs(3)).toBe(120_000);
    });

    it('test_round10_timer_120000ms', () => {
        expect(getRoundTimerMs(10)).toBe(120_000);
    });
});

// ---------------------------------------------------------------------------
// Integration: grace dampening flows through store on round 1
// ---------------------------------------------------------------------------

describe('grace dampening — store integration', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('test_round1_negative_delta_dampened_in_store', () => {
        const state = useGameStore.getState();
        expect(state.gameManagement.round).toBe(1);

        // -4 × 0.25 = -1.0 → Math.round(-1.0) = -1
        state.relations.adjustRelations('military', -4);
        expect(useGameStore.getState().relations.current.military).toBe(-1);
    });

    it('test_round1_negative_delta_neg2_dampened_to_0', () => {
        // -2 × 0.25 = -0.5 → Math.round(-0.5) = 0
        useGameStore.getState().relations.adjustRelations('people', -2);
        expect(useGameStore.getState().relations.current.people).toBe(0);
    });

    it('test_round1_positive_delta_full_strength', () => {
        useGameStore.getState().relations.adjustRelations('business', 3);
        expect(useGameStore.getState().relations.current.business).toBe(3);
    });
});
