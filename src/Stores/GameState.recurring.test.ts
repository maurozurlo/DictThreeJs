import { describe, it, expect } from 'vitest';
import type { Law } from '../types/Law';
import type { Deal } from '../types/Deal';
import { buildRecurringModifier, buildWeirdLawModifier } from '../assets/modifierContent';

/**
 * Recurring-effect data model (ADR-0008 P2 — formerly Story 2-1's ActiveRecurringEffect).
 *
 * Verifies:
 *  - recurring law/deal effects build correctly shaped roundIncome/roundExpense modifiers
 *  - Law and Deal types accept an optional recurringEffect field
 *  - weird-law modifiers are ledger/slot markers (no economic mods)
 */

describe('buildRecurringModifier — modifier shape', () => {
    it('income law → permanent roundIncome modifier with namespaced id', () => {
        const law: Law = {
            id: 39,
            power: 'business',
            acceptEffect: {},
            rejectEffect: {},
            recurringEffect: { incomeBonus: 25, label: 'laws.recurring.gambling_income' },
        };
        const mod = buildRecurringModifier(law, 'law', 4)!;

        expect(mod.id).toBe('laws.39');
        expect(mod.type).toBe('law-recurring');
        expect(mod.state).toBe('active');
        expect(mod.acquiredRound).toBe(4);
        expect(mod.mods).toEqual([
            { stat: 'roundIncome', amount: 25, window: { startRound: 4, endRound: null } },
        ]);
    });

    it('expense deal → permanent roundExpense modifier under the deals namespace', () => {
        const deal: Deal = {
            id: 17,
            text: 'x', acceptText: 'x', rejectText: 'x',
            acceptEffect: {}, rejectEffect: {},
            power: 'military',
            recurringEffect: { expenseBonus: 15, label: 'deals.recurring.arms_cost' },
        };
        const mod = buildRecurringModifier(deal, 'deal', 2)!;

        expect(mod.id).toBe('deals.17');
        expect(mod.type).toBe('deal');
        expect(mod.mods).toEqual([
            { stat: 'roundExpense', amount: 15, window: { startRound: 2, endRound: null } },
        ]);
    });

    it('returns null when the item carries no recurringEffect', () => {
        const law: Law = { id: 1, power: 'military', acceptEffect: {}, rejectEffect: {} };
        expect(buildRecurringModifier(law, 'law', 1)).toBeNull();
    });
});

describe('buildWeirdLawModifier — ledger/slot marker', () => {
    it('carries no economic mods (effects applied as base mutations on accept)', () => {
        const mod = buildWeirdLawModifier(1001, 5);
        expect(mod.id).toBe('weird.1001');
        expect(mod.type).toBe('weird-law');
        expect(mod.state).toBe('active');
        expect(mod.acquiredRound).toBe(5);
        expect(mod.mods).toEqual([]);
    });
});

describe('Law type — recurringEffect field (AC-1)', () => {
    it('accepts a law without recurringEffect (optional field)', () => {
        const law: Law = {
            id: 1,
            power: 'military',
            acceptEffect: { military: 1 },
            rejectEffect: { military: -1 },
        };
        expect(law.recurringEffect).toBeUndefined();
    });

    it('accepts a law with recurringEffect — income', () => {
        const law: Law = {
            id: 15,
            power: 'business',
            acceptEffect: { business: 1, people: -2 },
            rejectEffect: {},
            recurringEffect: { incomeBonus: 25, label: 'laws.recurring.gambling_income' },
        };
        expect(law.recurringEffect?.incomeBonus).toBe(25);
        expect(law.recurringEffect?.expenseBonus).toBeUndefined();
    });
});

describe('Deal type — recurringEffect field (AC-1)', () => {
    it('accepts a deal with recurringEffect', () => {
        const deal: Deal = {
            id: 9,
            text: 'deal.text',
            acceptText: 'deal.accept',
            rejectText: 'deal.reject',
            acceptEffect: { treasury: 40, business: 1 },
            rejectEffect: {},
            power: 'business',
            recurringEffect: { incomeBonus: 15, label: 'deals.recurring.foreign_investment' },
        };
        expect(deal.recurringEffect?.incomeBonus).toBe(15);
        expect(deal.recurringEffect?.label).toBe('deals.recurring.foreign_investment');
    });
});
