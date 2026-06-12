import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './GameState';
import { getRepealTier } from './RecurringHandler';
import type { ActiveRecurringEffect } from '../types/GameState';

/**
 * Story 2-8: repeal() store action + getRepealTier() pure helper.
 *
 * Exercises the REAL Zustand store. Follows the same seeding/reset
 * pattern established in StoreWiring.recurring.test.ts.
 */

// i18n uses an http backend — return keys verbatim in node
vi.mock('../i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Builds a minimal ActiveRecurringEffect for seeding the store. */
function makeEffect(overrides: Partial<ActiveRecurringEffect> = {}): ActiveRecurringEffect {
    return {
        sourceId: 'law-1',
        sourceType: 'law',
        sourceFaction: 'people',
        label: 'laws.recurring.gambling_income',
        incomeBonus: 25,
        expenseBonus: 0,
        roundActivated: 1,
        ...overrides,
    };
}

/** Seeds the store with the given treasury, relations, and effects. */
function seedStore({
    treasury,
    peopleRelation,
    effects,
    repealTakenThisRound = false,
}: {
    treasury: number;
    peopleRelation: number;
    effects: ActiveRecurringEffect[];
    repealTakenThisRound?: boolean;
}) {
    useGameStore.setState((s) => ({
        budget: { ...s.budget, treasury },
        relations: {
            ...s.relations,
            current: { ...s.relations.current, people: peopleRelation },
        },
        gameManagement: {
            ...s.gameManagement,
            activeRecurringEffects: effects,
            repealTakenThisRound,
        },
    }));
}

// ---------------------------------------------------------------------------
// repeal() store action tests
// ---------------------------------------------------------------------------

describe('repeal() store action', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('successful repeal: deducts treasury, adjusts relation, removes entry, sets flag', () => {
        // Medium-tier effect: incomeBonus 15 (≤15) → cost 25 treasury, −2 relation
        const effect = makeEffect({ incomeBonus: 15 });
        seedStore({ treasury: 100, peopleRelation: 3, effects: [effect] });

        useGameStore.getState().gameManagement.repeal('law-1');

        const state = useGameStore.getState();
        expect(state.budget.treasury).toBe(75);
        expect(state.relations.current.people).toBe(1);
        expect(state.gameManagement.activeRecurringEffects).toHaveLength(0);
        expect(state.gameManagement.repealTakenThisRound).toBe(true);
    });

    it('second repeal same round is a no-op (guarded by repealTakenThisRound)', () => {
        const effect = makeEffect({ incomeBonus: 25 });
        seedStore({ treasury: 100, peopleRelation: 3, effects: [effect] });

        useGameStore.getState().gameManagement.repeal('law-1');
        // Capture state after first repeal
        const afterFirst = useGameStore.getState();

        // Seed a second effect to ensure we don't skip due to empty list
        useGameStore.setState((s) => ({
            gameManagement: {
                ...s.gameManagement,
                activeRecurringEffects: [makeEffect({ sourceId: 'law-2', incomeBonus: 25 })],
                repealTakenThisRound: true,
            },
        }));

        useGameStore.getState().gameManagement.repeal('law-2');

        // Treasury and flag unchanged from first repeal's snapshot
        expect(useGameStore.getState().budget.treasury).toBe(afterFirst.budget.treasury);
        expect(useGameStore.getState().gameManagement.activeRecurringEffects).toHaveLength(1);
    });

    it('insufficient treasury → no-op', () => {
        // Medium-tier costs 25; give only 24
        const effect = makeEffect({ incomeBonus: 15 });
        seedStore({ treasury: 24, peopleRelation: 3, effects: [effect] });

        useGameStore.getState().gameManagement.repeal('law-1');

        const state = useGameStore.getState();
        expect(state.budget.treasury).toBe(24);
        expect(state.gameManagement.activeRecurringEffects).toHaveLength(1);
        expect(state.gameManagement.repealTakenThisRound).toBe(false);
    });

    it('repeal of a non-existent sourceId is a no-op', () => {
        seedStore({ treasury: 100, peopleRelation: 3, effects: [] });

        useGameStore.getState().gameManagement.repeal('law-999');

        expect(useGameStore.getState().budget.treasury).toBe(100);
        expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(false);
    });

    it('bankruptcy trigger: treasury exactly equal to cost causes phase lose', () => {
        // Medium-tier costs 25; treasury = 25 → new treasury = 0 → bankruptcy
        const effect = makeEffect({ incomeBonus: 15 });
        seedStore({ treasury: 25, peopleRelation: 3, effects: [effect] });

        useGameStore.getState().gameManagement.repeal('law-1');

        const state = useGameStore.getState();
        expect(state.budget.treasury).toBe(0);
        expect(state.gameManagement.phase).toBe('lose');
        expect(state.gameManagement.endCause).toBe('bankruptcy');
    });

    it('repeal updates the correct faction (military) when sourceFaction is military', () => {
        const effect = makeEffect({ sourceId: 'law-mil', sourceFaction: 'military', incomeBonus: 15 });
        seedStore({ treasury: 100, peopleRelation: 3, effects: [effect] });
        useGameStore.setState((s) => ({
            relations: { ...s.relations, current: { ...s.relations.current, military: 5 } },
        }));

        useGameStore.getState().gameManagement.repeal('law-mil');

        // Medium-tier: −2 relation; 5 − 2 = 3
        expect(useGameStore.getState().relations.current.military).toBe(3);
        // People relation must be untouched
        expect(useGameStore.getState().relations.current.people).toBe(3);
    });

    it('repeal clamps relation at the minimum (−10)', () => {
        // Large-tier: −3 relation; current −8 → clamps to −10
        const effect = makeEffect({ sourceId: 'law-large', incomeBonus: 20 });
        seedStore({ treasury: 100, peopleRelation: -8, effects: [effect] });

        useGameStore.getState().gameManagement.repeal('law-large');

        expect(useGameStore.getState().relations.current.people).toBe(-10);
    });

    it('repeal is re-enabled after nextRound() resets repealTakenThisRound', () => {
        const effect = makeEffect({ incomeBonus: 25 });
        seedStore({ treasury: 200, peopleRelation: 3, effects: [effect] });

        useGameStore.getState().gameManagement.repeal('law-1');
        expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(true);

        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getRepealTier() pure helper — tier boundary tests
// ---------------------------------------------------------------------------

describe('getRepealTier()', () => {
    it('incomeBonus 8 → Small (boundary)', () => {
        expect(getRepealTier(makeEffect({ incomeBonus: 8 }))).toBe('Small');
    });

    it('incomeBonus 9 → Medium (one above Small boundary)', () => {
        expect(getRepealTier(makeEffect({ incomeBonus: 9 }))).toBe('Medium');
    });

    it('incomeBonus 15 → Medium (boundary)', () => {
        expect(getRepealTier(makeEffect({ incomeBonus: 15 }))).toBe('Medium');
    });

    it('incomeBonus 16 → Large (one above Medium boundary)', () => {
        expect(getRepealTier(makeEffect({ incomeBonus: 16 }))).toBe('Large');
    });

    it('expenseBonus drives tier when larger than incomeBonus', () => {
        // incomeBonus 0, expenseBonus 20 → Large
        expect(getRepealTier(makeEffect({ incomeBonus: 0, expenseBonus: 20 }))).toBe('Large');
    });

    it('incomeBonus 0, expenseBonus 0 → Small (minimum)', () => {
        expect(getRepealTier(makeEffect({ incomeBonus: 0, expenseBonus: 0 }))).toBe('Small');
    });
});
