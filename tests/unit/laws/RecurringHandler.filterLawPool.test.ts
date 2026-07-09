import { describe, it, expect } from 'vitest';
import { filterLawPool } from '../../../src/Stores/RecurringHandler';
import { RECURRING } from '../../../src/Constants/Costs';
import type { Modifier, ResolvedStatMod } from '../../../src/types/GameState';
import type { Law } from '../../../src/types/Law';

/**
 * Law-pool filter (ADR-0008 §8): at most RECURRING.MAX_INCOME_LAWS_PER_RUN
 * lasting-income laws may be active at once (PRD no-cap mitigation 2), and a law
 * whose recurring modifier is active is never re-offered.
 */

/** Factory: a plain law with overridable fields. */
function makeLaw(overrides: Partial<Law> = {}): Law {
    return {
        id: 0,
        power: 'business',
        acceptMods: [],
        rejectMods: [],
        ...overrides,
    };
}

const PERMANENT = { startRound: 1, endRound: null };
/** Factory: an active law-recurring modifier carrying income and/or expense. */
function makeMod(id: string, opts: { income?: number; expense?: number; type?: Modifier['type'] } = {}): Modifier {
    const mods: ResolvedStatMod[] = [];
    if (opts.income) mods.push({ stat: 'roundIncome', amount: opts.income, window: PERMANENT });
    if (opts.expense) mods.push({ stat: 'roundExpense', amount: opts.expense, window: PERMANENT });
    return { id, type: opts.type ?? 'law-recurring', state: 'active', acquiredRound: 1, mods };
}

const plainLaw = makeLaw({ id: 1 });
const incomeLaw = makeLaw({ id: 2, acceptMods: [{ stat: 'roundIncome', amount: 15, time: 0 }], label: 'laws.recurring.a' });
const expenseLaw = makeLaw({ id: 3, acceptMods: [{ stat: 'roundExpense', amount: 15, time: 0 }], label: 'laws.recurring.b' });
const pool = [plainLaw, incomeLaw, expenseLaw];

/** N active lasting-income law modifiers with ids that don't collide with the pool. */
function incomeMods(n: number): Modifier[] {
    return Array.from({ length: n }, (_, i) => makeMod(`laws.${100 + i}`, { income: 15 }));
}

describe('filterLawPool', () => {
    it('returns the pool unchanged while under the cap', () => {
        const result = filterLawPool(pool, incomeMods(RECURRING.MAX_INCOME_LAWS_PER_RUN - 1));
        expect(result).toEqual(pool);
    });

    it('returns the pool unchanged with no active modifiers', () => {
        expect(filterLawPool(pool, [])).toEqual(pool);
    });

    it('excludes lasting-income laws once the cap is reached', () => {
        const result = filterLawPool(pool, incomeMods(RECURRING.MAX_INCOME_LAWS_PER_RUN));
        expect(result).toEqual([plainLaw, expenseLaw]);
    });

    it('keeps expense-recurring and plain laws when filtering', () => {
        const result = filterLawPool(pool, incomeMods(RECURRING.MAX_INCOME_LAWS_PER_RUN + 2));
        expect(result).toContain(expenseLaw);
        expect(result).toContain(plainLaw);
        expect(result).not.toContain(incomeLaw);
    });

    it('does not count income-recurring deals toward the law cap', () => {
        const dealMods = Array.from({ length: RECURRING.MAX_INCOME_LAWS_PER_RUN }, (_, i) =>
            makeMod(`deals.${i}`, { income: 15, type: 'deal' }));
        expect(filterLawPool(pool, dealMods)).toEqual(pool);
    });

    it('does not count expense-recurring laws toward the cap', () => {
        const expenseMods = Array.from({ length: RECURRING.MAX_INCOME_LAWS_PER_RUN }, (_, i) =>
            makeMod(`laws.${200 + i}`, { expense: 15 }));
        expect(filterLawPool(pool, expenseMods)).toEqual(pool);
    });

    it('respects a custom max parameter', () => {
        const result = filterLawPool(pool, incomeMods(1), 1);
        expect(result).toEqual([plainLaw, expenseLaw]);
    });

    it('excludes a law whose own recurring modifier is active (re-offer guard)', () => {
        // incomeLaw has id 2 → modifier id 'laws.2'. Active → must not be re-offered.
        const result = filterLawPool(pool, [makeMod('laws.2', { income: 15 })]);
        expect(result).not.toContain(incomeLaw);
        expect(result).toContain(plainLaw);
        expect(result).toContain(expenseLaw);
    });

    it('does not exclude laws whose recurring modifier was repealed (rejected)', () => {
        const repealed: Modifier = { ...makeMod('laws.2', { income: 15 }), state: 'rejected' };
        expect(filterLawPool(pool, [repealed])).toContain(incomeLaw);
    });
});
