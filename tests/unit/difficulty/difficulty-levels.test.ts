/**
 * Story 4-4: Difficulty Levels — pre-game treasury selection
 *
 * Tests verify:
 *   - DIFFICULTY_TREASURY has the correct values (Easy=1000, Medium=500, Hard=150)
 *   - setPhase('start', difficulty) sets the correct starting treasury
 *   - setPhase('start') with no difficulty defaults to medium (500)
 *   - difficulty is stored in gameManagement.difficulty
 *   - loadGame restores difficulty from save; defaults to 'medium' for old saves
 *   - stats.peakTreasury and stats.lowestTreasury reflect the starting treasury
 *
 * Design doc: production/stories/4-4-difficulty-levels.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DIFFICULTY_TREASURY } from '../../../src/Constants/GameState';
import type { Difficulty } from '../../../src/Constants/GameState';
import { useGameStore } from '../../../src/Stores/GameState';

// i18n uses an http backend — return keys verbatim in node
import { vi } from 'vitest';
vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startGame(difficulty?: Difficulty): void {
    useGameStore.getState().gameManagement.setPhase('start', difficulty);
}

function getState() {
    return useGameStore.getState();
}

beforeEach(() => {
    // Reset to idle before each test
    useGameStore.getState().gameManagement.setPhase('idle' as Parameters<typeof useGameStore.getState>['0'] extends never ? never : 'idle');
});

// ---------------------------------------------------------------------------
// DIFFICULTY_TREASURY constant values
// ---------------------------------------------------------------------------

describe('DIFFICULTY_TREASURY constant', () => {
    it('test_easy_treasury_is_1000', () => {
        expect(DIFFICULTY_TREASURY.easy).toBe(1000);
    });

    it('test_medium_treasury_is_500', () => {
        expect(DIFFICULTY_TREASURY.medium).toBe(500);
    });

    it('test_hard_treasury_is_150', () => {
        expect(DIFFICULTY_TREASURY.hard).toBe(150);
    });

    it('test_difficulty_keys_are_easy_medium_hard', () => {
        const keys = Object.keys(DIFFICULTY_TREASURY).sort();
        expect(keys).toEqual(['easy', 'hard', 'medium']);
    });
});

// ---------------------------------------------------------------------------
// setPhase('start', difficulty) — starting treasury
// ---------------------------------------------------------------------------

describe('difficulty levels — starting treasury', () => {
    it('test_easy_start_sets_treasury_1000', () => {
        startGame('easy');
        expect(getState().budget.treasury).toBe(1000);
    });

    it('test_medium_start_sets_treasury_500', () => {
        startGame('medium');
        expect(getState().budget.treasury).toBe(500);
    });

    it('test_hard_start_sets_treasury_150', () => {
        startGame('hard');
        expect(getState().budget.treasury).toBe(150);
    });

    it('test_no_difficulty_defaults_to_medium_500', () => {
        startGame();
        expect(getState().budget.treasury).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// difficulty stored in gameManagement
// ---------------------------------------------------------------------------

describe('difficulty stored in gameManagement', () => {
    it('test_easy_stored_in_gamemanagement', () => {
        startGame('easy');
        expect(getState().gameManagement.difficulty).toBe('easy');
    });

    it('test_hard_stored_in_gamemanagement', () => {
        startGame('hard');
        expect(getState().gameManagement.difficulty).toBe('hard');
    });

    it('test_default_difficulty_is_medium', () => {
        startGame();
        expect(getState().gameManagement.difficulty).toBe('medium');
    });
});

// ---------------------------------------------------------------------------
// stats peak/lowest treasury reflect starting treasury
// ---------------------------------------------------------------------------

describe('stats reflect starting treasury', () => {
    it('test_easy_peak_treasury_is_1000', () => {
        startGame('easy');
        expect(getState().stats.peakTreasury).toBe(1000);
    });

    it('test_hard_lowest_treasury_is_150', () => {
        startGame('hard');
        expect(getState().stats.lowestTreasury).toBe(150);
    });
});

// ---------------------------------------------------------------------------
// loadGame backward compatibility
// ---------------------------------------------------------------------------

describe('loadGame backward compatibility', () => {
    it('test_old_save_without_difficulty_defaults_to_medium', () => {
        // Simulate a save that predates story 4-4 (no difficulty field)
        const oldSavePayload = {
            gameManagement: { phase: 'start', round: 3 },
            budget: { treasury: 350 },
        };
        useGameStore.getState().gameManagement.loadGame(oldSavePayload);
        expect(getState().gameManagement.difficulty).toBe('medium');
    });

    it('test_save_with_hard_difficulty_restores_hard', () => {
        const savePayload = {
            gameManagement: { phase: 'start', round: 2, difficulty: 'hard' },
            budget: { treasury: 100 },
        };
        useGameStore.getState().gameManagement.loadGame(savePayload);
        expect(getState().gameManagement.difficulty).toBe('hard');
    });
});
