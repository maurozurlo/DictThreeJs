import { describe, it, expect } from 'vitest';
import { calculateRoundFinancials, computeRoundsLeft } from '../../Stores/BudgetHandler';
import type { GameState, Modifier, ResolvedStatMod } from '../../types/GameState';

/**
 * Budget forecast includes recurring effects (TR-lasting-006, formerly Story 2-6).
 *
 * Verifies that `calculateRoundFinancials(budget, modifiers, round)` produces a
 * `netChange` that correctly shifts rounds-left when recurring laws/deals are active.
 * Budget.tsx passes the modifiers array + current round so its net/roundsLeft display
 * is recurring-aware (ADR-0008 P2).
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

let seq = 0;
/** Factory: a permanent recurring-income/expense modifier (active from round 1). */
function makeMod(opts: { income?: number; expense?: number } = {}): Modifier {
    const window = { startRound: 1, endRound: null };
    const mods: ResolvedStatMod[] = [];
    if (opts.income) mods.push({ stat: 'roundIncome', amount: opts.income, window });
    if (opts.expense) mods.push({ stat: 'roundExpense', amount: opts.expense, window });
    return { id: `laws.${500 + seq++}`, type: 'law-recurring', state: 'active', acquiredRound: 1, mods };
}

const TREASURY = 1000;
const BASE_NET = -106; // 94 income − 200 expenses
const ROUND = 4;

describe('Budget forecast — rounds-left with active recurring modifiers', () => {
    it('baseline: no effects produces expected base net and rounds-left (AC-1 reference)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [], ROUND);

        expect(netChange).toBe(BASE_NET);
        expect(computeRoundsLeft(TREASURY, netChange)).toBe(Math.floor(TREASURY / 106)); // 9
    });

    it('income law active: net improves and rounds-left increases (AC-1)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [makeMod({ income: 25 })], ROUND);

        // net = −106 + 25 = −81; roundsLeft = floor(1000/81) = 12
        expect(netChange).toBe(BASE_NET + 25); // −81
        const roundsLeft = computeRoundsLeft(TREASURY, netChange);
        expect(roundsLeft).toBe(12);
        expect(roundsLeft).toBeGreaterThan(9); // strictly more than baseline
    });

    it('expense law active: net worsens and rounds-left decreases (AC-2)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [makeMod({ expense: 15 })], ROUND);

        // net = −106 − 15 = −121; roundsLeft = floor(1000/121) = 8
        expect(netChange).toBe(BASE_NET - 15); // −121
        const roundsLeft = computeRoundsLeft(TREASURY, netChange);
        expect(roundsLeft).toBe(8);
        expect(roundsLeft).toBeLessThan(9); // strictly fewer than baseline
    });

    it('mixed effects: income and expense both applied, net is their difference (AC-3)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [
            makeMod({ income: 25 }),
            makeMod({ expense: 15 }),
        ], ROUND);

        // net = −106 + 25 − 15 = −96; roundsLeft = floor(1000/96) = 10
        expect(netChange).toBe(BASE_NET + 25 - 15); // −96
        expect(computeRoundsLeft(TREASURY, netChange)).toBe(10);
    });

    it('edge case: income law makes net positive → rounds-left is null (infinite)', () => {
        const budget = makeBudget(TREASURY);
        const { netChange } = calculateRoundFinancials(budget, [makeMod({ income: 200 })], ROUND);

        // net = −106 + 200 = +94
        expect(netChange).toBeGreaterThan(0);
        expect(computeRoundsLeft(TREASURY, netChange)).toBeNull();
    });
});
