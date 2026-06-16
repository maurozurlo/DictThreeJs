import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './GameState';
import { computeRepealTier } from '../Utils/Modifiers';
import type { Modifier, ResolvedStatMod } from '../types/GameState';

/**
 * repeal() store action + computeRepealTier() pure helper (ADR-0008 P2).
 *
 * Repeal flips the modifier's state to 'rejected' (retained as ledger), applies the
 * tier relation penalty to the proposing faction's base relation (looked up from the
 * content pool by id), and deducts the treasury cost. Exercises the REAL store.
 */

// i18n uses an http backend — return keys verbatim in node
vi.mock('../i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PERMANENT = { startRound: 1, endRound: null };

/**
 * Builds a recurring law modifier. `id` must map to a real law (faction lookup);
 * the mods drive the repeal tier. Recurring law factions:
 *   laws.40 housing → people, laws.42 media → military, laws.44 public works → people.
 */
function makeMod(id: string, opts: { income?: number; expense?: number } = {}): Modifier {
    const mods: ResolvedStatMod[] = [];
    if (opts.income) mods.push({ stat: 'roundIncome', amount: opts.income, window: PERMANENT });
    if (opts.expense) mods.push({ stat: 'roundExpense', amount: opts.expense, window: PERMANENT });
    return { id, type: 'law-recurring', state: 'active', acquiredRound: 1, mods };
}

/** Seeds the store with the given treasury, relations, and modifiers. */
function seedStore({
    treasury,
    relations = {},
    modifiers,
    repealTakenThisRound = false,
}: {
    treasury: number;
    relations?: Partial<Record<'military' | 'business' | 'people', number>>;
    modifiers: Modifier[];
    repealTakenThisRound?: boolean;
}) {
    useGameStore.setState((s) => ({
        budget: { ...s.budget, treasury },
        relations: { ...s.relations, current: { ...s.relations.current, ...relations } },
        gameManagement: {
            ...s.gameManagement,
            modifiers,
            repealTakenThisRound,
            round: 3, // bypass grace dampening — repeal tests cover repeal mechanics, not the grace period
        },
    }));
}

const activeCount = () =>
    useGameStore.getState().gameManagement.modifiers.filter(m => m.state === 'active').length;

// ---------------------------------------------------------------------------
// repeal() store action tests
// ---------------------------------------------------------------------------

describe('repeal() store action', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('successful repeal: deducts treasury, adjusts faction relation, flips to rejected, sets flag', () => {
        // laws.40 (people, expense 15 → Medium): cost 25 treasury, −2 relation
        seedStore({ treasury: 100, relations: { people: 3 }, modifiers: [makeMod('laws.40', { expense: 15 })] });

        useGameStore.getState().gameManagement.repeal('laws.40');

        const state = useGameStore.getState();
        expect(state.budget.treasury).toBe(75);
        expect(state.relations.current.people).toBe(1);
        expect(activeCount()).toBe(0);
        // Entry retained as ledger history, flipped to rejected
        expect(state.gameManagement.modifiers).toHaveLength(1);
        expect(state.gameManagement.modifiers[0].state).toBe('rejected');
        expect(state.gameManagement.repealTakenThisRound).toBe(true);
    });

    it('second repeal same round is a no-op (guarded by repealTakenThisRound)', () => {
        seedStore({ treasury: 100, relations: { people: 3 }, modifiers: [makeMod('laws.40', { expense: 15 })] });

        useGameStore.getState().gameManagement.repeal('laws.40');
        const afterFirst = useGameStore.getState();

        // Seed a second active modifier; flag is already true from the first repeal
        useGameStore.setState((s) => ({
            gameManagement: {
                ...s.gameManagement,
                modifiers: [...s.gameManagement.modifiers, makeMod('laws.42', { income: 15 })],
            },
        }));

        useGameStore.getState().gameManagement.repeal('laws.42');

        expect(useGameStore.getState().budget.treasury).toBe(afterFirst.budget.treasury);
        expect(activeCount()).toBe(1); // the second modifier is still active (repeal blocked)
    });

    it('insufficient treasury → no-op', () => {
        // Medium-tier costs 25; give only 24
        seedStore({ treasury: 24, relations: { people: 3 }, modifiers: [makeMod('laws.40', { expense: 15 })] });

        useGameStore.getState().gameManagement.repeal('laws.40');

        const state = useGameStore.getState();
        expect(state.budget.treasury).toBe(24);
        expect(activeCount()).toBe(1);
        expect(state.gameManagement.repealTakenThisRound).toBe(false);
    });

    it('repeal of a non-existent id is a no-op', () => {
        seedStore({ treasury: 100, relations: { people: 3 }, modifiers: [] });

        useGameStore.getState().gameManagement.repeal('laws.999');

        expect(useGameStore.getState().budget.treasury).toBe(100);
        expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(false);
    });

    it('bankruptcy trigger: treasury exactly equal to cost causes phase lose', () => {
        // Medium-tier costs 25; treasury = 25 → new treasury = 0 → bankruptcy
        seedStore({ treasury: 25, relations: { people: 3 }, modifiers: [makeMod('laws.40', { expense: 15 })] });

        useGameStore.getState().gameManagement.repeal('laws.40');

        const state = useGameStore.getState();
        expect(state.budget.treasury).toBe(0);
        expect(state.gameManagement.phase).toBe('lose');
        expect(state.gameManagement.endCause).toBe('bankruptcy');
    });

    it('repeal updates the correct faction (military) looked up from the content pool', () => {
        // laws.42 (media) → military, income 15 → Medium (−2)
        seedStore({ treasury: 100, relations: { military: 5, people: 3 }, modifiers: [makeMod('laws.42', { income: 15 })] });

        useGameStore.getState().gameManagement.repeal('laws.42');

        expect(useGameStore.getState().relations.current.military).toBe(3);
        expect(useGameStore.getState().relations.current.people).toBe(3); // untouched
    });

    it('repeal clamps relation at the minimum (−10)', () => {
        // laws.44 (public works) → people, expense 25 → Large (−3); −8 − 3 → clamps to −10
        seedStore({ treasury: 100, relations: { people: -8 }, modifiers: [makeMod('laws.44', { expense: 25 })] });

        useGameStore.getState().gameManagement.repeal('laws.44');

        expect(useGameStore.getState().relations.current.people).toBe(-10);
    });

    it('repeal is re-enabled after nextRound() resets repealTakenThisRound', () => {
        seedStore({ treasury: 200, relations: { people: 3 }, modifiers: [makeMod('laws.40', { expense: 15 })] });

        useGameStore.getState().gameManagement.repeal('laws.40');
        expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(true);

        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().gameManagement.repealTakenThisRound).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// computeRepealTier() pure helper — tier boundary tests (Σ|amount| magnitude)
// ---------------------------------------------------------------------------

function mods(income = 0, expense = 0): ResolvedStatMod[] {
    const out: ResolvedStatMod[] = [];
    if (income) out.push({ stat: 'roundIncome', amount: income, window: PERMANENT });
    if (expense) out.push({ stat: 'roundExpense', amount: expense, window: PERMANENT });
    return out;
}

describe('computeRepealTier()', () => {
    it('magnitude 8 → Small (boundary)', () => {
        expect(computeRepealTier(mods(8))).toBe('Small');
    });

    it('magnitude 9 → Medium (one above Small boundary)', () => {
        expect(computeRepealTier(mods(9))).toBe('Medium');
    });

    it('magnitude 15 → Medium (boundary)', () => {
        expect(computeRepealTier(mods(15))).toBe('Medium');
    });

    it('magnitude 16 → Large (one above Medium boundary)', () => {
        expect(computeRepealTier(mods(16))).toBe('Large');
    });

    it('expense drives tier', () => {
        expect(computeRepealTier(mods(0, 20))).toBe('Large');
    });

    it('no economic mods (magnitude 0) → Small (minimum; matches weird-law behaviour)', () => {
        expect(computeRepealTier([])).toBe('Small');
    });
});
