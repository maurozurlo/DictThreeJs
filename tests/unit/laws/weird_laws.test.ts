/**
 * Story 5-2: Weird Laws — unit tests (updated for the modifier engine, ADR-0008 P2)
 *
 * Covers: trigger gating, one-time effects, no-penalty reject, repeal (no relation penalty),
 * modifier economic exclusion, visual consequence stubs, charismaEffect application, and the
 * full 14-law pool.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { WEIRD_LAWS } from '../../../src/assets/weirdLaws';
import { sumModifiers, computeRepealTier } from '../../../src/Utils/Modifiers';
import { buildWeirdLawModifier } from '../../../src/assets/modifierContent';
import { VISUAL_CONSEQUENCES } from '../../../src/assets/visualConsequences';
import type { Modifier, ResolvedStatMod } from '../../../src/types/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERMANENT = { startRound: 1, endRound: null };

/** Weird-law modifier: ledger/slot marker with no economic mods. */
function makeWeirdMod(id: number): Modifier {
    return buildWeirdLawModifier(id, 1);
}

/** Normal recurring-income law modifier. */
function makeNormalMod(id: number, income: number): Modifier {
    const mods: ResolvedStatMod[] = [{ stat: 'roundIncome', amount: income, window: PERMANENT }];
    return { id: `laws.${id}`, type: 'law-recurring', state: 'active', acquiredRound: 1, mods };
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
// Modifier economics — weird-law modifiers contribute nothing
// ---------------------------------------------------------------------------

describe('weird-law modifiers carry no recurring economics (Story 5-2)', () => {
    it('test_weird_law_entry_not_counted_in_recurring_sum', () => {
        const mods = [makeWeirdMod(1001)];
        expect(sumModifiers(mods, 'roundIncome', 5)).toBe(0);
        expect(sumModifiers(mods, 'roundExpense', 5)).toBe(0);
    });

    it('test_normal_law_still_counted_when_weird_law_also_active', () => {
        const mods = [makeNormalMod(39, 15), makeWeirdMod(1005)];
        expect(sumModifiers(mods, 'roundIncome', 5)).toBe(15);
    });

    it('test_empty_effects_array_returns_zero', () => {
        expect(sumModifiers([], 'roundIncome', 5)).toBe(0);
        expect(sumModifiers([], 'roundExpense', 5)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// computeRepealTier — weird-law modifiers always Small (no economic mods)
// ---------------------------------------------------------------------------

describe('computeRepealTier for weird-law modifiers (Story 5-2)', () => {
    it('test_weird_law_entry_is_small_tier', () => {
        expect(computeRepealTier(makeWeirdMod(1001).mods)).toBe('Small');
    });
});

// ---------------------------------------------------------------------------
// Visual consequence stubs
// ---------------------------------------------------------------------------

describe('visual consequence stubs for weird laws (Story 5-2)', () => {
    it('test_cemeteries_stub_exists_with_correct_condition', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'weird-cemeteries');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('weird.1001');
    });

    it('test_skeletons_stub_exists', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'weird-skeletons');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('weird.1005');
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

    it('test_accepting_weird_law_adds_modifier', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1005)!; // Skeletons: +20 treasury

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().law.actUponLaw(true);

        const mod = useGameStore.getState().gameManagement.modifiers.find(m => m.id === 'weird.1005');
        expect(mod).toBeDefined();
        expect(mod?.type).toBe('weird-law');
        expect(mod?.state).toBe('active');
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

    it('test_weird_law_modifier_not_counted_in_round_recurring_income', () => {
        const weirdLaw = WEIRD_LAWS.find(l => l.id === 1005)!;

        useGameStore.setState(s => ({
            law: { ...s.law, current: weirdLaw, lawDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().law.actUponLaw(true);

        const { modifiers, round } = useGameStore.getState().gameManagement;
        expect(sumModifiers(modifiers, 'roundIncome', round)).toBe(0);
        expect(sumModifiers(modifiers, 'roundExpense', round)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Repeal — weird-law no relation penalty
// ---------------------------------------------------------------------------

describe('repeal weird-law modifier skips relation penalty (Story 5-2)', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    function seedWeird(extra: Partial<{ treasury: number; people: number }> = {}) {
        useGameStore.setState(s => ({
            gameManagement: {
                ...s.gameManagement,
                modifiers: [makeWeirdMod(1001)],
                repealTakenThisRound: false,
            },
            budget: { ...s.budget, treasury: extra.treasury ?? 200 },
            relations: { ...s.relations, current: { military: 0, business: 0, people: extra.people ?? 0 } },
        }));
    }

    it('test_repeal_weird_law_does_not_reduce_relation', () => {
        seedWeird({ people: 5 });
        useGameStore.getState().gameManagement.repeal('weird.1001');
        expect(useGameStore.getState().relations.current.people).toBe(5);
    });

    it('test_repeal_weird_law_flips_modifier_to_rejected', () => {
        seedWeird();
        useGameStore.getState().gameManagement.repeal('weird.1001');
        const mod = useGameStore.getState().gameManagement.modifiers.find(m => m.id === 'weird.1001');
        expect(mod?.state).toBe('rejected');
    });

    it('test_repeal_weird_law_deducts_small_tier_treasury_cost', () => {
        seedWeird({ treasury: 200 });
        useGameStore.getState().gameManagement.repeal('weird.1001');
        // Small tier = 15 treasury cost
        expect(useGameStore.getState().budget.treasury).toBe(185);
    });
});
