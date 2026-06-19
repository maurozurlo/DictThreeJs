/**
 * Story 7-8: Modifier Unification P4b — engine wiring integration tests.
 *
 * Pins the ADR-0008 Amendment 2026-06-18 application semantics:
 *  - AC-8:  accept-path treasury is banked in nextRound(), not at decision time
 *  - AC-10: getEffectiveBudgetStat adds tax modifiers to the base (clamped 0–100)
 *  - AC-11: getEffectiveBudgetStat / applyBudgetEffects read effective expenditures
 *  - AC-12: Advisor verdict/trigger read acceptMods/rejectMods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { applyBudgetEffects } from '../../../src/Stores/EffectHandler';
import { buildContentModifier } from '../../../src/assets/modifierContent';
import { getEffectiveBudgetStat } from '../../../src/Utils/Modifiers';
import { computeLawVerdict, computeLawTrigger } from '../../../src/Utils/Advisor';
import { GAMESTATE } from '../../../src/Constants/GameState';
import type { GameState } from '../../../src/types/GameState';
import type { Law } from '../../../src/types/Law';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

const makeBudget = (
    over: Partial<{ businessTaxes: number; peopleTaxes: number; security: number; health: number; infrastructure: number; education: number }> = {},
): GameState['budget'] => ({
    treasury: 0,
    taxes: { businessTaxes: over.businessTaxes ?? 30, peopleTaxes: over.peopleTaxes ?? 20 },
    expenditures: {
        security: over.security ?? 5,
        health: over.health ?? 5,
        infrastructure: over.infrastructure ?? 5,
        education: over.education ?? 5,
    },
} as unknown as GameState['budget']);

// ---------------------------------------------------------------------------
// AC-8 — treasury timing
// ---------------------------------------------------------------------------

describe('AC-8 — accept-path treasury is applied in nextRound(), not at decision time', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
        // Isolate from citizen feedback (thief skim / protest) so the treasury delta is deterministic.
        useGameStore.setState(() => ({ citizens: [], citizenStates: [] }));
    });

    it('treasury is unchanged at actUponLaw time, then banked once on nextRound', () => {
        const law: Law = {
            id: 9100,
            power: 'people',
            acceptMods: [{ stat: 'treasury', amount: 50, time: 1 }],
            rejectMods: [],
        };

        const beforeAccept = useGameStore.getState().budget.treasury;
        useGameStore.setState((s) => ({ law: { ...s.law, current: law, lawDecided: false } }));
        useGameStore.getState().law.actUponLaw(true);

        // Not applied immediately.
        expect(useGameStore.getState().budget.treasury).toBe(beforeAccept);

        const afterAccept = useGameStore.getState().budget.treasury;
        useGameStore.getState().gameManagement.nextRound();

        const gm = useGameStore.getState().gameManagement;
        const net = gm.lastRoundIncome + gm.lastRoundRecurringIncome - gm.lastRoundExpenses - gm.lastRoundRecurringExpenses;
        expect(useGameStore.getState().budget.treasury).toBe(afterAccept + net + 50);
    });

    it('the one-shot treasury modifier does not re-apply on the following round', () => {
        const law: Law = {
            id: 9101,
            power: 'people',
            acceptMods: [{ stat: 'treasury', amount: 50, time: 1 }],
            rejectMods: [],
        };
        useGameStore.setState((s) => ({ law: { ...s.law, current: law, lawDecided: false } }));
        useGameStore.getState().law.actUponLaw(true);

        useGameStore.getState().gameManagement.nextRound();
        const afterFirst = useGameStore.getState().budget.treasury;
        useGameStore.getState().gameManagement.nextRound();
        const afterSecond = useGameStore.getState().budget.treasury;

        const gm = useGameStore.getState().gameManagement;
        const net = gm.lastRoundIncome + gm.lastRoundRecurringIncome - gm.lastRoundExpenses - gm.lastRoundRecurringExpenses;
        // Second round's delta is just the base net — no second +50.
        expect(afterSecond).toBe(afterFirst + net);
    });
});

// ---------------------------------------------------------------------------
// AC-10 — effective tax
// ---------------------------------------------------------------------------

describe('AC-10 — getEffectiveBudgetStat applies tax modifiers', () => {
    it('adds a businessTaxes modifier to the base', () => {
        const budget = makeBudget({ businessTaxes: 30 });
        const mods = [buildContentModifier('laws.1', 'law-recurring', [{ stat: 'businessTaxes', amount: 20, time: 0 }], 1)];
        expect(getEffectiveBudgetStat(budget, mods, 'businessTaxes', 1)).toBe(50);
    });

    it('clamps the effective tax rate to the 0–100 range', () => {
        const budget = makeBudget({ businessTaxes: 90 });
        const mods = [buildContentModifier('laws.1', 'law-recurring', [{ stat: 'businessTaxes', amount: 40, time: 0 }], 1)];
        expect(getEffectiveBudgetStat(budget, mods, 'businessTaxes', 1)).toBe(GAMESTATE.BUDGET.BOUNDS.TAX.MAX);
    });

    it('ignores out-of-window modifier contributions', () => {
        const budget = makeBudget({ peopleTaxes: 20 });
        // one-round window at round 1 → not active at round 2
        const mods = [buildContentModifier('laws.2', 'law-recurring', [{ stat: 'peopleTaxes', amount: 10, time: 1 }], 1)];
        expect(getEffectiveBudgetStat(budget, mods, 'peopleTaxes', 1)).toBe(30);
        expect(getEffectiveBudgetStat(budget, mods, 'peopleTaxes', 2)).toBe(20);
    });
});

// ---------------------------------------------------------------------------
// AC-11 — effective expenditures
// ---------------------------------------------------------------------------

describe('AC-11 — gameplay sites read effective expenditures', () => {
    it('getEffectiveBudgetStat adds a securitySpend modifier (clamped 0–10)', () => {
        const budget = makeBudget({ security: 5 });
        const mods = [buildContentModifier('laws.1', 'law-recurring', [{ stat: 'securitySpend', amount: 3, time: 0 }], 1)];
        expect(getEffectiveBudgetStat(budget, mods, 'securitySpend', 1)).toBe(8);
    });

    it('applyBudgetEffects rewards the military when EFFECTIVE security exceeds the high threshold', () => {
        const budget = makeBudget({ security: 5 }); // base alone is below HIGH
        const baseline = applyBudgetEffects(budget, { military: 0, business: 0, people: 0 });
        expect(baseline.newRelations.military).toBe(0);

        const mods = [buildContentModifier('laws.1', 'law-recurring', [{ stat: 'securitySpend', amount: 5, time: 0 }], 1)];
        const boosted = applyBudgetEffects(budget, { military: 0, business: 0, people: 0 }, mods, 1);
        expect(boosted.newRelations.military).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// AC-12 — Advisor reads acceptMods/rejectMods
// ---------------------------------------------------------------------------

describe('AC-12 — Advisor verdict/trigger read mods', () => {
    it('recommends accept when the accept relation impact beats reject', () => {
        const verdict = computeLawVerdict({
            acceptMods: [{ stat: 'military', amount: 2, time: 0 }],
            rejectMods: [{ stat: 'military', amount: -1, time: 1 }],
        });
        expect(verdict).toBe('approve');
    });

    it('flags a recurring-income law via the trigger', () => {
        const trigger = computeLawTrigger({ acceptMods: [{ stat: 'roundIncome', amount: 25, time: 0 }] });
        expect(trigger).toBe('law_recurring_income');
    });

    it('treats recurring expense as a cost in the verdict', () => {
        const verdict = computeLawVerdict({
            acceptMods: [{ stat: 'roundExpense', amount: 20, time: 0 }],
            rejectMods: [],
        });
        expect(verdict).toBe('reject');
    });
});
