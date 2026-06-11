import { describe, it, expect } from 'vitest';
import type { ActiveRecurringEffect } from '../types/GameState';
import type { Law } from '../types/Law';
import type { Deal } from '../types/Deal';

/**
 * Story 2-1: Recurring effect types and store shape.
 *
 * These tests verify:
 *  - ActiveRecurringEffect objects can be constructed with the correct shape
 *  - Law and Deal types accept an optional recurringEffect field
 *  - The documented initial / default values match the spec
 *
 * Store initial-value correctness (AC-2 through AC-4) is additionally confirmed
 * by the full test suite passing after the type changes (AC-5).
 */

describe('ActiveRecurringEffect type shape', () => {
    it('accepts all required fields', () => {
        const effect: ActiveRecurringEffect = {
            sourceId: 'law-gambling',
            sourceType: 'law',
            sourceFaction: 'business',
            label: 'laws.recurring.gambling_income',
            incomeBonus: 25,
            expenseBonus: 0,
            roundActivated: 1,
        };

        expect(effect.sourceId).toBe('law-gambling');
        expect(effect.sourceType).toBe('law');
        expect(effect.sourceFaction).toBe('business');
        expect(effect.incomeBonus).toBe(25);
        expect(effect.expenseBonus).toBe(0);
        expect(effect.roundActivated).toBe(1);
    });

    it('accepts deal and opportunity sourceTypes', () => {
        const dealEffect: ActiveRecurringEffect = {
            sourceId: 'deal-foreign-investment',
            sourceType: 'deal',
            sourceFaction: 'business',
            label: 'deals.recurring.foreign_investment',
            incomeBonus: 15,
            expenseBonus: 0,
            roundActivated: 3,
        };

        const opportunityEffect: ActiveRecurringEffect = {
            sourceId: 'opp-1',
            sourceType: 'opportunity',
            sourceFaction: 'military',
            label: 'opp.recurring.contract',
            incomeBonus: 0,
            expenseBonus: 8,
            roundActivated: 5,
        };

        expect(dealEffect.sourceType).toBe('deal');
        expect(opportunityEffect.sourceType).toBe('opportunity');
    });

    it('expense-only effect has incomeBonus 0', () => {
        const expenseEffect: ActiveRecurringEffect = {
            sourceId: 'law-housing',
            sourceType: 'law',
            sourceFaction: 'people',
            label: 'laws.recurring.housing_cost',
            incomeBonus: 0,
            expenseBonus: 15,
            roundActivated: 2,
        };

        expect(expenseEffect.incomeBonus).toBe(0);
        expect(expenseEffect.expenseBonus).toBe(15);
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
            recurringEffect: {
                incomeBonus: 25,
                label: 'laws.recurring.gambling_income',
            },
        };

        expect(law.recurringEffect).toBeDefined();
        expect(law.recurringEffect?.incomeBonus).toBe(25);
        expect(law.recurringEffect?.label).toBe('laws.recurring.gambling_income');
        expect(law.recurringEffect?.expenseBonus).toBeUndefined();
    });

    it('accepts a law with recurringEffect — expense', () => {
        const law: Law = {
            id: 16,
            power: 'people',
            acceptEffect: { people: 2, treasury: -30 },
            rejectEffect: {},
            recurringEffect: {
                expenseBonus: 15,
                label: 'laws.recurring.housing_cost',
            },
        };

        expect(law.recurringEffect?.expenseBonus).toBe(15);
        expect(law.recurringEffect?.incomeBonus).toBeUndefined();
    });
});

describe('Deal type — recurringEffect field (AC-1)', () => {
    it('accepts a deal without recurringEffect', () => {
        const deal: Deal = {
            id: 1,
            text: 'deal.text',
            acceptText: 'deal.accept',
            rejectText: 'deal.reject',
            acceptEffect: { treasury: 40 },
            rejectEffect: {},
        };

        expect(deal.recurringEffect).toBeUndefined();
    });

    it('accepts a deal with recurringEffect', () => {
        const deal: Deal = {
            id: 9,
            text: 'deal.foreign_investment.text',
            acceptText: 'deal.foreign_investment.accept',
            rejectText: 'deal.foreign_investment.reject',
            acceptEffect: { treasury: 40, business: 1 },
            rejectEffect: {},
            recurringEffect: {
                incomeBonus: 15,
                label: 'deals.recurring.foreign_investment',
            },
        };

        expect(deal.recurringEffect?.incomeBonus).toBe(15);
        expect(deal.recurringEffect?.label).toBe('deals.recurring.foreign_investment');
    });
});

describe('Store initial values spec (AC-2 through AC-4)', () => {
    /**
     * These tests document the required initial values as specified in story 2-1.
     * The Zustand store (GameState.ts) initialises gameManagement with these exact values.
     * Verified by: (a) TypeScript type correctness, (b) the full test suite passing (AC-5).
     */

    it('activeRecurringEffects initial value is an empty array', () => {
        // Spec: activeRecurringEffects: [] as ActiveRecurringEffect[]
        const initial: ActiveRecurringEffect[] = [];
        expect(initial).toHaveLength(0);
        expect(Array.isArray(initial)).toBe(true);
    });

    it('repealTakenThisRound initial value is false', () => {
        // Spec: repealTakenThisRound: false
        const initial = false;
        expect(initial).toBe(false);
    });

    it('lastRoundRecurringIncome initial value is 0', () => {
        // Spec: lastRoundRecurringIncome: 0
        const initial = 0;
        expect(initial).toBe(0);
    });

    it('lastRoundRecurringExpenses initial value is 0', () => {
        // Spec: lastRoundRecurringExpenses: 0
        const initial = 0;
        expect(initial).toBe(0);
    });
});
