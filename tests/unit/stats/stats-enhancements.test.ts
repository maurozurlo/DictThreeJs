/**
 * Story 3-4: Stats Screen Enhancements
 *
 * Unit/integration tests for the four new GameStats fields:
 *   - coupGraceFired (boolean)
 *   - totalRecurringIncomeEarned (number)
 *   - totalRecurringExpensesSpent (number)
 *   - repealCount (number)
 *
 * Tests exercise the real Zustand store following the pattern from repeal.test.ts
 * and StoreWiring.recurring.test.ts.
 *
 * COUP constants: RELATION_THRESHOLD=8, CHARISMA_THRESHOLD=-3.
 * Coup grace is deterministic (ADR-0009): the first armed round always grace-survives;
 * a second consecutive armed round fires the coup. No RNG in the coup path.
 *
 * Design doc: production/stories/3-4-stats-enhancements.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import type { Modifier, ResolvedStatMod } from '../../../src/types/GameState';

// i18n uses an http backend — return keys verbatim in node
vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resets the store to a clean new-game state before each test. */
function resetStore(): void {
    useGameStore.getState().gameManagement.setPhase('start');
}

const PERMANENT = { startRound: 1, endRound: null };

/** Seeds a single active recurring-income/expense modifier directly into the store. */
function seedEffect({ incomeBonus = 0, expenseBonus = 0 }: { incomeBonus?: number; expenseBonus?: number } = {}): void {
    const mods: ResolvedStatMod[] = [];
    if (incomeBonus) mods.push({ stat: 'roundIncome', amount: incomeBonus, window: PERMANENT });
    if (expenseBonus) mods.push({ stat: 'roundExpense', amount: expenseBonus, window: PERMANENT });
    const mod: Modifier = { id: 'laws.39', type: 'law-recurring', state: 'active', acquiredRound: 1, mods };
    useGameStore.setState((s) => ({
        gameManagement: { ...s.gameManagement, modifiers: [mod] },
    }));
}

/** Seeds the store for a coup-prone state: military at armed threshold, charisma at armed threshold. */
function seedCoupState({ coupArmedLastRound = false }: { coupArmedLastRound?: boolean } = {}): void {
    useGameStore.setState((s) => ({
        relations: {
            ...s.relations,
            current: { ...s.relations.current, military: 8 },
        },
        gameManagement: {
            ...s.gameManagement,
            charisma: { ...s.gameManagement.charisma, current: -3 },
            coupArmedLastRound,
        },
    }));
}

// ---------------------------------------------------------------------------
// Initial values
// ---------------------------------------------------------------------------

describe('GameStats — initial values after new game', () => {
    beforeEach(resetStore);

    it('coupGraceFired starts as false', () => {
        expect(useGameStore.getState().stats.coupGraceFired).toBe(false);
    });

    it('totalRecurringIncomeEarned starts at 0', () => {
        expect(useGameStore.getState().stats.totalRecurringIncomeEarned).toBe(0);
    });

    it('totalRecurringExpensesSpent starts at 0', () => {
        expect(useGameStore.getState().stats.totalRecurringExpensesSpent).toBe(0);
    });

    it('repealCount starts at 0', () => {
        expect(useGameStore.getState().stats.repealCount).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// coupGraceFired tracking
// ---------------------------------------------------------------------------

describe('coupGraceFired tracking', () => {
    beforeEach(resetStore);
    afterEach(() => vi.restoreAllMocks());

    it('coupGraceFired becomes true when grace fires on the first armed round', () => {
        // Arrange: relation 8 + charisma -3 arms the coup; first armed round → grace (deterministic).
        // Spy keeps the rest of nextRound's RNG (sick rolls, mini-challenge) deterministic.
        vi.spyOn(Math, 'random').mockReturnValue(0.3);
        seedCoupState({ coupArmedLastRound: false });

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().stats.coupGraceFired).toBe(true);
    });

    it('coupGraceFired stays true after a subsequent coup ends the game', () => {
        // Round 1: grace fires deterministically → coupGraceFired = true, coupArmedLastRound = true.
        // Spy keeps the rest of nextRound's RNG (sick rolls, mini-challenge) deterministic.
        vi.spyOn(Math, 'random').mockReturnValue(0.3);
        seedCoupState({ coupArmedLastRound: false });
        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().stats.coupGraceFired).toBe(true);

        // Round 2: coupArmedLastRound is now true → coup fires (armed condition still met)
        // Game ends (phase: 'lose') without changing coupGraceFired
        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().stats.coupGraceFired).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Recurring income/expense accumulation
// ---------------------------------------------------------------------------

describe('totalRecurringIncomeEarned / totalRecurringExpensesSpent accumulation', () => {
    beforeEach(resetStore);

    it('income law at +25 for one round → totalRecurringIncomeEarned = 25', () => {
        // Arrange
        seedEffect({ incomeBonus: 25, expenseBonus: 0 });

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().stats.totalRecurringIncomeEarned).toBe(25);
    });

    it('expense law at +15 for one round → totalRecurringExpensesSpent = 15', () => {
        // Arrange
        seedEffect({ incomeBonus: 0, expenseBonus: 15 });

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().stats.totalRecurringExpensesSpent).toBe(15);
    });

    it('no recurring effects → both totals remain 0 after nextRound', () => {
        // Arrange: no effects seeded (store starts clean after resetStore)

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().stats.totalRecurringIncomeEarned).toBe(0);
        expect(useGameStore.getState().stats.totalRecurringExpensesSpent).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// repealCount tracking
// ---------------------------------------------------------------------------

describe('repealCount tracking', () => {
    beforeEach(resetStore);

    function seedRepeal(): void {
        // laws.39 (gambling) → faction business; mods drive Large tier (cost 40).
        const mod: Modifier = {
            id: 'laws.39',
            type: 'law-recurring',
            state: 'active',
            acquiredRound: 1,
            mods: [{ stat: 'roundIncome', amount: 25, window: PERMANENT }],
        };
        useGameStore.setState((s) => ({
            budget: { ...s.budget, treasury: 500 },
            relations: { ...s.relations, current: { ...s.relations.current, business: 3 } },
            gameManagement: {
                ...s.gameManagement,
                modifiers: [mod],
                repealTakenThisRound: false,
            },
        }));
    }

    it('successful repeal increments repealCount to 1', () => {
        // Arrange
        seedRepeal();
        expect(useGameStore.getState().stats.repealCount).toBe(0);

        // Act
        useGameStore.getState().gameManagement.repeal('laws.39');

        // Assert
        expect(useGameStore.getState().stats.repealCount).toBe(1);
    });

    it('repeal blocked by repealTakenThisRound does not increment repealCount', () => {
        // Arrange: mark repeal as already taken this round
        seedRepeal();
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, repealTakenThisRound: true },
        }));

        // Act: repeal attempt — still blocked by repealTakenThisRound
        useGameStore.getState().gameManagement.repeal('laws.39');

        // Assert
        expect(useGameStore.getState().stats.repealCount).toBe(0);
    });
});
