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
 * COUP constants: RELATION_THRESHOLD=8, CHARISMA_THRESHOLD=-3, GRACE_CHANCE=0.5
 * Math.random is spied on to force deterministic coup roll outcomes.
 *
 * Design doc: production/stories/3-4-stats-enhancements.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import type { ActiveRecurringEffect } from '../../../src/types/GameState';

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

/** Seeds a single active recurring effect directly into the store. */
function seedEffect(overrides: Partial<ActiveRecurringEffect> = {}): void {
    const effect: ActiveRecurringEffect = {
        sourceId: 'law-test-1',
        sourceType: 'law',
        sourceFaction: 'business',
        label: 'laws.recurring.test',
        incomeBonus: 0,
        expenseBonus: 0,
        roundActivated: 1,
        ...overrides,
    };
    useGameStore.setState((s) => ({
        gameManagement: {
            ...s.gameManagement,
            activeRecurringEffects: [effect],
        },
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

    it('coupGraceFired becomes true when a grace roll fires', () => {
        // Arrange: relation 8 + charisma -3 arms the coup; roll 0.3 < 0.5 (GRACE_CHANCE) → grace
        vi.spyOn(Math, 'random').mockReturnValue(0.3);
        seedCoupState({ coupArmedLastRound: false });

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expect(useGameStore.getState().stats.coupGraceFired).toBe(true);
    });

    it('coupGraceFired stays true after a subsequent coup ends the game', () => {
        // Round 1: grace fires → coupGraceFired = true, coupArmedLastRound = true
        vi.spyOn(Math, 'random').mockReturnValue(0.3);
        seedCoupState({ coupArmedLastRound: false });
        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().stats.coupGraceFired).toBe(true);

        // Round 2: coupArmedLastRound is now true → coup fires regardless of roll
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
        const effect: ActiveRecurringEffect = {
            sourceId: 'law-repeal-1',
            sourceType: 'law',
            sourceFaction: 'people',
            label: 'laws.recurring.test',
            incomeBonus: 25,
            expenseBonus: 0,
            roundActivated: 1,
        };
        useGameStore.setState((s) => ({
            budget: { ...s.budget, treasury: 500 },
            relations: { ...s.relations, current: { ...s.relations.current, people: 3 } },
            gameManagement: {
                ...s.gameManagement,
                activeRecurringEffects: [effect],
                repealTakenThisRound: false,
            },
        }));
    }

    it('successful repeal increments repealCount to 1', () => {
        // Arrange
        seedRepeal();
        expect(useGameStore.getState().stats.repealCount).toBe(0);

        // Act
        useGameStore.getState().gameManagement.repeal('law-repeal-1');

        // Assert
        expect(useGameStore.getState().stats.repealCount).toBe(1);
    });

    it('repeal blocked by repealTakenThisRound does not increment repealCount', () => {
        // Arrange: mark repeal as already taken this round
        seedRepeal();
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, repealTakenThisRound: true },
        }));

        // Act: second repeal attempt on a different law — still blocked
        useGameStore.getState().gameManagement.repeal('law-repeal-1');

        // Assert
        expect(useGameStore.getState().stats.repealCount).toBe(0);
    });
});
