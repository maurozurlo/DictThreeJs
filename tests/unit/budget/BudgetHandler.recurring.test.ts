import { describe, it, expect } from 'vitest';
import { calculateRoundFinancials } from '../../../src/Stores/BudgetHandler';
import type { GameState, Modifier, ResolvedStatMod } from '../../../src/types/GameState';

/**
 * calculateRoundFinancials — recurring income/expense from modifiers (ADR-0008 P2,
 * formerly Story 2-2's ActiveRecurringEffect summation).
 *
 * Four required cases: zero effects / income-only / expense-only / mixed, plus
 * parameter back-compat (callers without modifiers / round).
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

let modSeq = 0;
/** Factory: a permanent recurring-income/expense modifier (active from round 1). */
function makeMod(opts: { income?: number; expense?: number; id?: string } = {}): Modifier {
    const window = { startRound: 1, endRound: null };
    const mods: ResolvedStatMod[] = [];
    if (opts.income) mods.push({ stat: 'roundIncome', amount: opts.income, window });
    if (opts.expense) mods.push({ stat: 'roundExpense', amount: opts.expense, window });
    return {
        id: opts.id ?? `laws.${1000 + modSeq++}`,
        type: 'law-recurring',
        state: 'active',
        acquiredRound: 1,
        mods,
    };
}

/** Any round ≥ 1 keeps the permanent windows active. */
const ROUND = 5;

describe('calculateRoundFinancials — recurring modifiers', () => {
    it('zero effects: recurring sums are 0 and net is unchanged (AC-1)', () => {
        const budget = makeBudget();
        const withEmpty = calculateRoundFinancials(budget, [], ROUND);
        const withoutParam = calculateRoundFinancials(budget);

        expect(withEmpty.recurringIncome).toBe(0);
        expect(withEmpty.recurringExpenses).toBe(0);
        // Parameter back-compat: omitting modifiers/round gives identical results
        expect(withoutParam).toEqual(withEmpty);
        // Net is base income minus base expenses only
        expect(withEmpty.netChange).toBe(withEmpty.totalIncome - withEmpty.expenses);
    });

    it('income-only: recurringIncome sums and net increases (AC-2)', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeMod({ income: 25 }),
            makeMod({ income: 15 }),
        ], ROUND);

        expect(result.recurringIncome).toBe(40);
        expect(result.recurringExpenses).toBe(0);
        expect(result.netChange).toBe(baseline.netChange + 40);
    });

    it('expense-only: recurringExpenses sums and net decreases (AC-3)', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeMod({ expense: 15 }),
            makeMod({ expense: 25 }),
        ], ROUND);

        expect(result.recurringIncome).toBe(0);
        expect(result.recurringExpenses).toBe(40);
        expect(result.netChange).toBe(baseline.netChange - 40);
    });

    it('mixed: income and expense effects both apply (AC-4)', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [
            makeMod({ income: 25 }),
            makeMod({ expense: 15 }),
        ], ROUND);

        expect(result.recurringIncome).toBe(25);
        expect(result.recurringExpenses).toBe(15);
        expect(result.netChange).toBe(baseline.netChange + 25 - 15);
    });

    it('rejected modifiers and out-of-window contributions are excluded', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const rejected: Modifier = { ...makeMod({ income: 50 }), state: 'rejected' };
        const future: Modifier = {
            id: 'laws.future', type: 'law-recurring', state: 'active', acquiredRound: 1,
            mods: [{ stat: 'roundIncome', amount: 99, window: { startRound: ROUND + 2, endRound: null } }],
        };
        const result = calculateRoundFinancials(budget, [rejected, future], ROUND);

        expect(result.recurringIncome).toBe(0);
        expect(result.netChange).toBe(baseline.netChange);
    });

    it('base fields are unaffected by recurring effects', () => {
        const budget = makeBudget();
        const baseline = calculateRoundFinancials(budget);
        const result = calculateRoundFinancials(budget, [makeMod({ income: 25, expense: 15 })], ROUND);

        expect(result.peopleIncome).toBe(baseline.peopleIncome);
        expect(result.businessIncome).toBe(baseline.businessIncome);
        expect(result.totalIncome).toBe(baseline.totalIncome);
        expect(result.expenses).toBe(baseline.expenses);
    });
});
