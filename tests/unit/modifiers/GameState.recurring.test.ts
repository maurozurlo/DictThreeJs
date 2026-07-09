import { describe, it, expect } from 'vitest';
import type { Law } from '../../../src/types/Law';
import type { Deal } from '../../../src/types/Deal';
import { buildContentModifier, buildWeirdLawModifier } from '../../../src/assets/modifierContent';

/**
 * Modifier construction (ADR-0008 Amendment 2026-06-18 — formerly buildRecurringModifier).
 *
 * Verifies:
 *  - buildContentModifier resolves a ModifierSpec[]'s windows correctly per `time`
 *  - Law and Deal types carry acceptMods/rejectMods + an optional `label`
 *  - weird-law modifiers are ledger/slot markers (no economic mods)
 */

describe('buildContentModifier — modifier shape', () => {
    it('income law spec → permanent roundIncome modifier with namespaced id', () => {
        const mod = buildContentModifier(
            'laws.39',
            'law-recurring',
            [{ stat: 'roundIncome', amount: 25, time: 0 }],
            4,
        );

        expect(mod.id).toBe('laws.39');
        expect(mod.type).toBe('law-recurring');
        expect(mod.state).toBe('active');
        expect(mod.acquiredRound).toBe(4);
        expect(mod.mods).toEqual([
            { stat: 'roundIncome', amount: 25, window: { startRound: 4, endRound: null } },
        ]);
    });

    it('one-shot treasury spec (time:1) → single-round window', () => {
        const mod = buildContentModifier(
            'deals.17',
            'deal',
            [{ stat: 'treasury', amount: -30, time: 1 }, { stat: 'roundExpense', amount: 15, time: 0 }],
            2,
        );

        expect(mod.id).toBe('deals.17');
        expect(mod.type).toBe('deal');
        expect(mod.mods).toEqual([
            { stat: 'treasury', amount: -30, window: { startRound: 2, endRound: 3 } },
            { stat: 'roundExpense', amount: 15, window: { startRound: 2, endRound: null } },
        ]);
    });

    it('honours an explicit rejected state', () => {
        const mod = buildContentModifier('laws.1', 'law-recurring', [], 1, 'rejected');
        expect(mod.state).toBe('rejected');
        expect(mod.mods).toEqual([]);
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

describe('Law type — acceptMods/rejectMods + label', () => {
    it('accepts a law without a label (optional field)', () => {
        const law: Law = {
            id: 1,
            power: 'military',
            acceptMods: [{ stat: 'military', amount: 1, time: 0 }],
            rejectMods: [{ stat: 'military', amount: -1, time: 1 }],
        };
        expect(law.label).toBeUndefined();
    });

    it('accepts a law with a recurring income mod + label', () => {
        const law: Law = {
            id: 15,
            power: 'business',
            acceptMods: [
                { stat: 'business', amount: 1, time: 0 },
                { stat: 'people', amount: -2, time: 0 },
                { stat: 'roundIncome', amount: 25, time: 0 },
            ],
            rejectMods: [],
            label: 'laws.recurring.gambling_income',
        };
        expect(law.acceptMods.find(m => m.stat === 'roundIncome')?.amount).toBe(25);
        expect(law.label).toBe('laws.recurring.gambling_income');
    });
});

describe('Deal type — acceptMods/rejectMods + label', () => {
    it('accepts a deal with a recurring mod + label + power', () => {
        const deal: Deal = {
            id: 9,
            text: 'deal.text',
            acceptText: 'deal.accept',
            rejectText: 'deal.reject',
            acceptMods: [
                { stat: 'treasury', amount: 40, time: 1 },
                { stat: 'business', amount: 1, time: 0 },
                { stat: 'roundIncome', amount: 15, time: 0 },
            ],
            rejectMods: [],
            power: 'business',
            label: 'deals.recurring.foreign_investment',
        };
        expect(deal.acceptMods.find(m => m.stat === 'roundIncome')?.amount).toBe(15);
        expect(deal.label).toBe('deals.recurring.foreign_investment');
    });
});
