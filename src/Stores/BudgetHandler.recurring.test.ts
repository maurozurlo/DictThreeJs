import { describe, it, expect } from 'vitest';
import { calculateRoundFinancials, sumRecurringEffects } from './BudgetHandler';
import type { ActiveRecurringEffect, GameState } from '../types/GameState';

/**
 * Story 2-2: calculateRoundFinancials — recurring effect summation.
 *
 * Four required cases: zero effects / income-only / expense-only / mixed,
 * plus backwards compatibility (callers without the new parameter).
 */

/** Factory: a neutral budget whose base financials are easy to reason about. */
function makeBudget(): GameState['budget'] {
    return {
        treasury: 500,
        expenditures: {
            health: 5,
            infrastructure: 5,
            security: 5,
            education: 5,
        },
        taxes: {
            peopleTaxes: 20,
            businessTaxes: 30,
        },
    } as unknown as GameState['budget'];
}

/** Factory: a recurring effect entry with overridable fields. */
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

describe('sumRecurringEffects', () => {
    it('returns zeros for an empty array', () => {
        const result = sumRecurringEffects([]);
        expect(result.recurringIncome).toBe(0);
        expect(result.recurringExpenses).toBe(0);
    });

    it('sums multiple mixed entries', () => {
        const result = sumRecurringEffects([
            makeEffect({ incomeBonus: 25 }),
            makeEffect({ sourceId: 'law-2', incomeBonus: 15 }),
            makeEffect({ sourceId: 'law-3', expenseBonus: 8 }),
        ]);
        expect(result.recurringIncome).toBe(40);
        expect(result.recurringExpenses).toBe(8);
    });
});

describe('calculateRoundFinancials — recurring effects', () => {
    it('zero effects: recurring sums are 0 and net is unchanged (AC-1)', () => {
        const budget = makeBudget();
        const withEmpty = calculateRoundFinancials(budget, []);
        const withoutParam = calculateRoundFinancials(budget);

        expect(withEmpty.recurringIncome).toBe(0);
        expect(withEmpty.recurringExpenses).toBe(0);
        // Backwards compatible: omitting the parameter gives identical results
        expect(withoutParam).toEqual(withEmpty);
        // Net is base income minus base expenses only
        expect(withEmpty.netChange).toBe(withEmpty.totalIncome - withEmpty.expenses);
    });

    it('income-only: recurringIncome sums and net increases (AC-2)', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeEffect({ incomeBonus: 25 }),
            makeEffect({ sourceId: 'law-2', incomeBonus: 15 }),
        ]);

        expect(result.recurringIncome).toBe(40);
        expect(result.recurringExpenses).toBe(0);
        expect(result.netChange).toBe(baseline.netChange + 40);
    });

    it('expense-only: recurringExpenses sums and net decreases (AC-3)', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeEffect({ expenseBonus: 15 }),
            makeEffect({ sourceId: 'law-2', expenseBonus: 25 }),
        ]);

        expect(result.recurringIncome).toBe(0);
        expect(result.recurringExpenses).toBe(40);
        expect(result.netChange).toBe(baseline.netChange - 40);
    });

    it('mixed: income and expense effects both apply (AC-4)', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeEffect({ incomeBonus: 25 }),
            makeEffect({ sourceId: 'law-2', expenseBonus: 15 }),
        ]);

        expect(result.recurringIncome).toBe(25);
        expect(result.recurringExpenses).toBe(15);
        expect(result.netChange).toBe(baseline.netChange + 25 - 15);
    });

    it('base fields are unaffected by recurring effects', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeEffect({ incomeBonus: 25, expenseBonus: 15 }),
        ]);

        expect(result.peopleIncome).toBe(baseline.peopleIncome);
        expect(result.businessIncome).toBe(baseline.businessIncome);
        expect(result.totalIncome).toBe(baseline.totalIncome);
        expect(result.expenses).toBe(baseline.expenses);
    });
});
