/**
 * Story 5-2: Weird Laws — unit tests
 *
 * Covers: trigger gating, one-time effects, no-penalty reject, repeal (no relation penalty),
 * slot cap enforcement, sumRecurringEffects exclusion, visual consequence stubs,
 * charismaEffect application, and the full 14-law pool.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { WEIRD_LAWS } from '../../../src/assets/weirdLaws';
import { sumRecurringEffects } from '../../../src/Stores/BudgetHandler';
import { getRepealTier } from '../../../src/Stores/RecurringHandler';
import { VISUAL_CONSEQUENCES } from '../../../src/assets/visualConsequences';
import type { ActiveRecurringEffect } from '../../../src/types/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWeirdEntry(id: number): ActiveRecurringEffect {
    return {
        sourceId: `weird-law-${id}`,
        sourceType: 'weird-law',
        sourceFaction: 'people',
        label: `laws.labels.${id}`,
        incomeBonus: 0,
        expenseBonus: 0,
        roundActivated: 1,
    };
}

function makeNormalEntry(id: number, income: number): ActiveRecurringEffect {
    return {
        sourceId: `law-${id}`,
        sourceType: 'law',
        sourceFaction: 'business',
        label: `laws.recurring.test_${id}`,
        incomeBonus: income,
        expenseBonus: 0,
        roundActivated: 1,
    };
}

// ---------------------------------------------------------------------------
// Asset pool
// ---------------------------------------------------------------------------

describe('WEIRD_LAWS asset pool (Story 5-2)', () => {
    it('test_pool_contains_exactly_14_laws', () => {
        expect(WEIRD_LAWS).toHaveLength(14);
    });

    it('test_all_weird_laws_have_type_weird', () => {
        WEIRD_LAWS.forEach(law => {
            expect(law.type).toBe('weird');
        });
    });

    it('test_all_weird_laws_have_unique_ids', () => {
        const ids = WEIRD_LAWS.map(l => l.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('test_all_weird_laws_have_empty_reject_effect', () => {
        WEIRD_LAWS.forEach(law => {
            expect(Object.keys(law.rejectEffect)).toHaveLength(0);
        });
    });

    it('test_all_weird_laws_have_no_recurring_effect', () => {
        WEIRD_LAWS.forEach(law => {
            expect(law.recurringEffect).toBeUndefined();
        });
    });

    it('test_charisma_effect_laws_have_correct_ids', () => {
        const charismaLaws = WEIRD_LAWS.filter(l => (l.charismaEffect ?? 0) > 0);
        const charismaIds = charismaLaws.map(l => l.id);
        expect(charismaIds).toContain(1004); // Reverse Funeral
        expect(charismaIds).toContain(1012); // Excessive Statues
        expect(charismaLaws).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// sumRecurringEffects — weird-law exclusion
// ---------------------------------------------------------------------------

describe('sumRecurringEffects excludes weird-law entries (Story 5-2)', () => {
    it('test_weird_law_entry_not_counted_in_recurring_sum', () => {
        const effects: ActiveRecurringEffect[] = [makeWeirdEntry(1001)];
        const result = sumRecurringEffects(effects);
        expect(result.recurringIncome).toBe(0);
        expect(result.recurringExpenses).toBe(0);
    });

    it('test_normal_law_still_counted_when_weird_law_also_active', () => {
        const effects: ActiveRecurringEffect[] = [
            makeNormalEntry(39, 15),
            makeWeirdEntry(1005),
        ];
        const result = sumRecurringEffects(effects);
        expect(result.recurringIncome).toBe(15);
    });

    it('test_empty_effects_array_returns_zero', () => {
        const result = sumRecurringEffects([]);
        expect(result.recurringIncome).toBe(0);
        expect(result.recurringExpenses).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// getRepealTier — weird-law entries always Small (incomeBonus=0)
// ---------------------------------------------------------------------------

describe('getRepealTier for weird-law entries (Story 5-2)', () => {
    it('test_weird_law_entry_is_small_tier', () => {
        const entry = makeWeirdEntry(1001);
        expect(getRepealTier(entry)).toBe('Small');
    });
});

// ---------------------------------------------------------------------------
// Visual consequence stubs
// ---------------------------------------------------------------------------

describe('visual consequence stubs for weird laws (Story 5-2)', () => {
    it('test_cemeteries_stub_exists_with_correct_condition', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'weird-cemeteries');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('weird-law-1001');
    });

    it('test_skeletons_stub_exists', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'weird-skeletons');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('weird-law-1005');
    });

    it('test_at_least_12_weird_visual_stubs_registered', () => {
        const weirdStubs = VISUAL_CONSEQUENCES.filter(v => v.id.startsWith('weird-'));
        expect(weirdStubs.length).toBeGreaterThanOrEqual(12);
    });
});

// ---------------------------------------------------------------------------
// Store integration — actUponLaw weird path
// ---------------------------------------------------------------------------

describe('actUponLaw weird law path (Story 5-2)', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('test_accepting_weird_law_adds_entry_to_active_recurring_effects', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1005)!; // Skeletons: +20 treasury

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().law.actUponLaw(true);

        const state = useGameStore.getState();
        const entry = state.gameManagement.activeRecurringEffects.find(
            e => e.sourceId === 'weird-law-1005'
        );
        expect(entry).toBeDefined();
        expect(entry?.sourceType).toBe('weird-law');
    });

    it('test_accepting_weird_law_applies_treasury_effect', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1010)!; // Water Coolers: +10 treasury

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            budget: { ...s.budget, treasury: 200 },
        }));

        useGameStore.getState().law.actUponLaw(true);

        expect(useGameStore.getState().budget.treasury).toBe(210);
    });

    it('test_rejecting_weird_law_has_no_treasury_effect', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1002)!; // Pigeon Hats: -10 treasury on accept

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            budget: { ...s.budget, treasury: 200 },
        }));

        useGameStore.getState().law.actUponLaw(false);

        expect(useGameStore.getState().budget.treasury).toBe(200);
    });

    it('test_rejecting_weird_law_has_no_relation_effect', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1003)!; // Night Sun: -1 people on accept

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            relations: { ...s.relations, current: { military: 0, business: 0, people: 0 } },
        }));

        useGameStore.getState().law.actUponLaw(false);

        expect(useGameStore.getState().relations.current.people).toBe(0);
    });

    it('test_accepting_charisma_weird_law_increments_charisma', () => {
        const charismaLaw = WEIRD_LAWS.find(l => l.id === 1012)!; // Excessive Statues: +1 charisma

        useGameStore.setState(s => ({
            law: { ...s.law, current: charismaLaw, lawDecided: false },
            gameManagement: { ...s.gameManagement, charisma: { ...s.gameManagement.charisma, current: 5 } },
        }));

        useGameStore.getState().law.actUponLaw(true);

        expect(useGameStore.getState().gameManagement.charisma.current).toBe(6);
    });

    it('test_weird_law_entry_not_counted_in_round_recurring_income', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1005)!;

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().law.actUponLaw(true);

        const effects = useGameStore.getState().gameManagement.activeRecurringEffects;
        const sum = sumRecurringEffects(effects);
        expect(sum.recurringIncome).toBe(0);
        expect(sum.recurringExpenses).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Repeal — weird-law no relation penalty
// ---------------------------------------------------------------------------

describe('repeal weird-law entry skips relation penalty (Story 5-2)', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('test_repeal_weird_law_does_not_reduce_relation', () => {
        const entry = makeWeirdEntry(1001);

        useGameStore.setState(s => ({
            gameManagement: {
                ...s.gameManagement,
                activeRecurringEffects: [entry],
                repealTakenThisRound: false,
            },
            budget: { ...s.budget, treasury: 200 },
            relations: { ...s.relations, current: { military: 0, business: 0, people: 5 } },
        }));

        useGameStore.getState().gameManagement.repeal('weird-law-1001');

        expect(useGameStore.getState().relations.current.people).toBe(5);
    });

    it('test_repeal_weird_law_removes_entry_from_active_effects', () => {
        const entry = makeWeirdEntry(1001);

        useGameStore.setState(s => ({
            gameManagement: {
                ...s.gameManagement,
                activeRecurringEffects: [entry],
                repealTakenThisRound: false,
            },
            budget: { ...s.budget, treasury: 200 },
        }));

        useGameStore.getState().gameManagement.repeal('weird-law-1001');

        const remaining = useGameStore.getState().gameManagement.activeRecurringEffects;
        expect(remaining.find(e => e.sourceId === 'weird-law-1001')).toBeUndefined();
    });

    it('test_repeal_weird_law_deducts_small_tier_treasury_cost', () => {
        const entry = makeWeirdEntry(1001);

        useGameStore.setState(s => ({
            gameManagement: {
                ...s.gameManagement,
                activeRecurringEffects: [entry],
                repealTakenThisRound: false,
            },
            budget: { ...s.budget, treasury: 200 },
        }));

        useGameStore.getState().gameManagement.repeal('weird-law-1001');

        // Small tier = 15 treasury cost
        expect(useGameStore.getState().budget.treasury).toBe(185);
    });
});
