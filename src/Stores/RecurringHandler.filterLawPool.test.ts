import { describe, it, expect } from 'vitest';
import { filterLawPool } from './RecurringHandler';
import { RECURRING } from '../Constants/Costs';
import type { ActiveRecurringEffect } from '../types/GameState';
import type { Law } from '../types/Law';

/**
 * Story 2-4: pool weighting — at most RECURRING.MAX_INCOME_LAWS_PER_RUN
 * lasting-income laws may appear in a single run (PRD no-cap mitigation 2).
 */

/** Factory: a plain law with overridable fields. */
function makeLaw(overrides: Partial<Law> = {}): Law {
    return {
        id: 0,
        power: 'business',
        acceptEffect: {},
        rejectEffect: {},
        ...overrides,
    };
}

/** Factory: an active recurring effect entry with overridable fields. */
function makeEffect(overrides: Partial<ActiveRecurringEffect> = {}): ActiveRecurringEffect {
    return {
        sourceId: 'law-test',
        sourceType: 'law',
        sourceFaction: 'business',
        label: 'laws.recurring.test',
        incomeBonus: 0,
        expenseBonus: 0,
        roundActivated: 1,
        ...overrides,
    };
}

const plainLaw = makeLaw({ id: 1 });
const incomeLaw = makeLaw({ id: 2, recurringEffect: { incomeBonus: 15, label: 'laws.recurring.a' } });
const expenseLaw = makeLaw({ id: 3, recurringEffect: { expenseBonus: 15, label: 'laws.recurring.b' } });
const pool = [plainLaw, incomeLaw, expenseLaw];

/** N active lasting-income law effects with unique sourceIds. */
function incomeEffects(n: number): ActiveRecurringEffect[] {
    return Array.from({ length: n }, (_, i) =>
        makeEffect({ sourceId: `law-${100 + i}`, incomeBonus: 15 }));
}

describe('filterLawPool', () => {
    it('returns the pool unchanged while under the cap', () => {
        const result = filterLawPool(pool, incomeEffects(RECURRING.MAX_INCOME_LAWS_PER_RUN - 1));
        expect(result).toBe(pool);
    });

    it('returns the pool unchanged with no active effects', () => {
        expect(filterLawPool(pool, [])).toBe(pool);
    });

    it('excludes lasting-income laws once the cap is reached', () => {
        const result = filterLawPool(pool, incomeEffects(RECURRING.MAX_INCOME_LAWS_PER_RUN));
        expect(result).toEqual([plainLaw, expenseLaw]);
    });

    it('keeps expense-recurring and plain laws when filtering', () => {
        const result = filterLawPool(pool, incomeEffects(RECURRING.MAX_INCOME_LAWS_PER_RUN + 2));
        expect(result).toContain(expenseLaw);
        expect(result).toContain(plainLaw);
        expect(result).not.toContain(incomeLaw);
    });

    it('does not count income-recurring deals toward the law cap', () => {
        const dealEffects = Array.from({ length: RECURRING.MAX_INCOME_LAWS_PER_RUN }, (_, i) =>
            makeEffect({ sourceId: `deal-${i}`, sourceType: 'deal', incomeBonus: 15 }));
        expect(filterLawPool(pool, dealEffects)).toBe(pool);
    });

    it('does not count expense-recurring laws toward the cap', () => {
        const expenseEffects = Array.from({ length: RECURRING.MAX_INCOME_LAWS_PER_RUN }, (_, i) =>
            makeEffect({ sourceId: `law-${i}`, expenseBonus: 15 }));
        expect(filterLawPool(pool, expenseEffects)).toBe(pool);
    });

    it('respects a custom max parameter', () => {
        const result = filterLawPool(pool, incomeEffects(1), 1);
        expect(result).toEqual([plainLaw, expenseLaw]);
    });
});
