import { describe, it, expect } from 'vitest';
import { calculateRoundFinancials, computeRoundsLeft } from '../../Stores/BudgetHandler';
import type { ActiveRecurringEffect, GameState } from '../../types/GameState';

/**
 * Story 2-6: Budget forecast includes recurring effects (TR-lasting-006).
 *
 * Verifies that `calculateRoundFinancials(budget, activeRecurringEffects)`
 * produces a `netChange` that, when used as the Budget tab forecast source,
 * correctly shifts rounds-left when recurring laws/deals are active.
 *
 * Budget.tsx passes `activeRecurringEffects` to `calculateRoundFinancials`
 * so the net and roundsLeft it displays are recurring-aware.
 */

/** Factory: budget with known base financials.
 * peopleTaxes=20 → peopleIncome = floor(200 × 0.20) = 40
 * businessTaxes=30 → businessIncome = floor(180 × 0.30) = 54 (infra/edu ≥ 3, no penalty)
 * totalIncome = 94; expenses = (5+5+5+5) × 10 = 200; base net = −106 */
function makeBudget(treasuryOverride = 1000): GameState['budget'] {
    return {
        treasury: treasuryOverride,
        expenditures: { health: 5, infrastructure: 5, security: 5, education: 5 },
        taxes: { peopleTaxes: 20, businessTaxes: 30 },
    } as unknown as GameState['budget'];
}

/** Factory: a minimal recurring effect with sensible defaults. */
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

const TREASURY = 1000;
const BASE_NET = -106; // 94 income − 200 expenses

describe('Budget forecast — rounds-left with active recurring effects', () => {
    it('baseline: no effects produces expected base net and rounds-left (AC-1 reference)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, []);

        expect(netChange).toBe(BASE_NET);
        expect(computeRoundsLeft(TREASURY, netChange)).toBe(Math.floor(TREASURY / 106)); // 9
    });

    it('income law active: net improves and rounds-left increases (AC-1)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [
            makeEffect({ incomeBonus: 25 }),
        ]);

        // net = −106 + 25 = −81; roundsLeft = floor(1000/81) = 12
        expect(netChange).toBe(BASE_NET + 25); // −81
        const roundsLeft = computeRoundsLeft(TREASURY, netChange);
        expect(roundsLeft).toBe(12);
        expect(roundsLeft).toBeGreaterThan(9); // strictly more than baseline
    });

    it('expense law active: net worsens and rounds-left decreases (AC-2)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [
            makeEffect({ sourceId: 'deal-test', sourceType: 'deal', expenseBonus: 15 }),
        ]);

        // net = −106 − 15 = −121; roundsLeft = floor(1000/121) = 8
        expect(netChange).toBe(BASE_NET - 15); // −121
        const roundsLeft = computeRoundsLeft(TREASURY, netChange);
        expect(roundsLeft).toBe(8);
        expect(roundsLeft).toBeLessThan(9); // strictly fewer than baseline
    });

    it('mixed effects: income and expense both applied, net is their difference (AC-3)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [
            makeEffect({ incomeBonus: 25 }),
            makeEffect({ sourceId: 'law-2', expenseBonus: 15 }),
        ]);

        // net = −106 + 25 − 15 = −96; roundsLeft = floor(1000/96) = 10
        expect(netChange).toBe(BASE_NET + 25 - 15); // −96
        expect(computeRoundsLeft(TREASURY, netChange)).toBe(10);
    });

    it('edge case: income law makes net positive → rounds-left is null (infinite)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [
            makeEffect({ incomeBonus: 200 }),
        ]);

        // net = −106 + 200 = +94
        expect(netChange).toBeGreaterThan(0);
        expect(computeRoundsLeft(TREASURY, netChange)).toBeNull();
    });
});
