/**
 * Story 5-3: Weird Deals Tier 1 — unit tests (updated for ADR-0008 Amendment 2026-06-18)
 *
 * Covers: deals 19-22 asset data (now ModifierSpec[]), RECURRING.TINY, accept/reject
 * mods, charisma mod on deal 20, recurring entry for deal 19, visual stubs, and store
 * integration via actUponDeal (accept builds a read-through modifier; treasury is
 * banked in nextRound; reject mutates base).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { DEALS } from '../../../src/assets/deals';
import { RECURRING } from '../../../src/Constants/Costs';
import { getEffectiveCharisma } from '../../../src/Utils/Modifiers';
import { VISUAL_CONSEQUENCES } from '../../../src/assets/visualConsequences';
import type { ModifierSpec } from '../../../src/types/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDeal(id: number) {
    const deal = DEALS.find(d => d.id === id);
    if (!deal) throw new Error(`Deal ${id} not found in DEALS`);
    return deal;
}

/** Amount of the first spec matching `stat` (undefined if none). */
const amountOf = (mods: ModifierSpec[], stat: ModifierSpec['stat']): number | undefined =>
    mods.find(m => m.stat === stat)?.amount;

// ---------------------------------------------------------------------------
// Asset pool — deals 19-22 exist
// ---------------------------------------------------------------------------

describe('Weird deals tier 1 asset pool (Story 5-3)', () => {
    it('test_deals_19_through_22_exist_in_pool', () => {
        expect(DEALS.find(d => d.id === 19)).toBeDefined();
        expect(DEALS.find(d => d.id === 20)).toBeDefined();
        expect(DEALS.find(d => d.id === 21)).toBeDefined();
        expect(DEALS.find(d => d.id === 22)).toBeDefined();
    });

    it('test_deals_have_unique_ids', () => {
        const ids = DEALS.map(d => d.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });
});

// ---------------------------------------------------------------------------
// RECURRING.TINY constant
// ---------------------------------------------------------------------------

describe('RECURRING.TINY constant (Story 5-3)', () => {
    it('test_recurring_tiny_is_5', () => {
        expect(RECURRING.TINY).toBe(5);
    });

    it('test_recurring_tiny_is_less_than_small', () => {
        expect(RECURRING.TINY).toBeLessThan(RECURRING.SMALL);
    });
});

// ---------------------------------------------------------------------------
// Deal 19 — Dog-Sized Cow Initiative
// ---------------------------------------------------------------------------

describe('Deal 19 — Dog-Sized Cow Initiative (Story 5-3)', () => {
    it('test_deal19_accept_mod_treasury_plus_15', () => {
        expect(amountOf(getDeal(19).acceptMods, 'treasury')).toBe(15);
    });

    it('test_deal19_accept_mod_people_minus_1', () => {
        expect(amountOf(getDeal(19).acceptMods, 'people')).toBe(-1);
    });

    it('test_deal19_reject_mods_are_empty', () => {
        expect(getDeal(19).rejectMods).toHaveLength(0);
    });

    it('test_deal19_has_recurring_income_of_tiny', () => {
        expect(amountOf(getDeal(19).acceptMods, 'roundIncome')).toBe(RECURRING.TINY);
    });

    it('test_deal19_label_is_cow_income', () => {
        expect(getDeal(19).label).toBe('deals.recurring.cow_income');
    });

    it('test_deal19_power_is_people', () => {
        expect(getDeal(19).power).toBe('people');
    });

    it('test_deal19_has_no_charisma_mod', () => {
        expect(amountOf(getDeal(19).acceptMods, 'charisma')).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Deal 20 — Giant National Computer Mouse
// ---------------------------------------------------------------------------

describe('Deal 20 — Giant National Computer Mouse (Story 5-3)', () => {
    it('test_deal20_accept_mod_treasury_minus_50', () => {
        expect(amountOf(getDeal(20).acceptMods, 'treasury')).toBe(-50);
    });

    it('test_deal20_reject_mods_are_empty', () => {
        expect(getDeal(20).rejectMods).toHaveLength(0);
    });

    it('test_deal20_charisma_mod_is_2', () => {
        expect(amountOf(getDeal(20).acceptMods, 'charisma')).toBe(2);
    });

    it('test_deal20_has_no_recurring_mod', () => {
        expect(amountOf(getDeal(20).acceptMods, 'roundIncome')).toBeUndefined();
        expect(amountOf(getDeal(20).acceptMods, 'roundExpense')).toBeUndefined();
    });

    it('test_deal20_has_no_power', () => {
        expect(getDeal(20).power).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Deal 21 — Strategic Pigeon Surveillance Program
// ---------------------------------------------------------------------------

describe('Deal 21 — Strategic Pigeon Surveillance Program (Story 5-3)', () => {
    it('test_deal21_accept_mod_military_plus_1', () => {
        expect(amountOf(getDeal(21).acceptMods, 'military')).toBe(1);
    });

    it('test_deal21_accept_mod_people_minus_1', () => {
        expect(amountOf(getDeal(21).acceptMods, 'people')).toBe(-1);
    });

    it('test_deal21_reject_mods_are_empty', () => {
        expect(getDeal(21).rejectMods).toHaveLength(0);
    });

    it('test_deal21_has_no_recurring_mod', () => {
        expect(amountOf(getDeal(21).acceptMods, 'roundIncome')).toBeUndefined();
        expect(amountOf(getDeal(21).acceptMods, 'roundExpense')).toBeUndefined();
    });

    it('test_deal21_power_is_military', () => {
        expect(getDeal(21).power).toBe('military');
    });
});

// ---------------------------------------------------------------------------
// Deal 22 — Swiss Hostage Diplomacy
// ---------------------------------------------------------------------------

describe('Deal 22 — Swiss Hostage Diplomacy (Story 5-3)', () => {
    it('test_deal22_accept_mod_military_minus_1', () => {
        expect(amountOf(getDeal(22).acceptMods, 'military')).toBe(-1);
    });

    it('test_deal22_accept_mod_people_plus_1', () => {
        expect(amountOf(getDeal(22).acceptMods, 'people')).toBe(1);
    });

    it('test_deal22_reject_mod_military_plus_1', () => {
        expect(amountOf(getDeal(22).rejectMods, 'military')).toBe(1);
    });

    it('test_deal22_reject_mod_treasury_minus_20', () => {
        expect(amountOf(getDeal(22).rejectMods, 'treasury')).toBe(-20);
    });

    it('test_deal22_power_is_people', () => {
        expect(getDeal(22).power).toBe('people');
    });

    it('test_deal22_has_no_recurring_mod', () => {
        expect(amountOf(getDeal(22).acceptMods, 'roundIncome')).toBeUndefined();
        expect(amountOf(getDeal(22).acceptMods, 'roundExpense')).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Visual consequence stubs
// ---------------------------------------------------------------------------

describe('visual consequence stubs for weird deals (Story 5-3)', () => {
    it('test_deal19_visual_stub_exists_with_correct_condition', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'deal-19-tiny-cows');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('deals.19');
    });

    it('test_deal20_visual_stub_exists', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'deal-20-giant-mouse');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('deals.20');
    });

    it('test_deal21_visual_stub_exists_with_correct_condition', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'deal-21-pigeon-cameras');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('deals.21');
    });
});

// ---------------------------------------------------------------------------
// Store integration — actUponDeal
// ---------------------------------------------------------------------------

describe('actUponDeal store integration (Story 5-3)', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('test_accepting_deal20_applies_charisma_as_effective_modifier', () => {
        const deal20 = getDeal(20);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal20, dealDecided: false },
            budget: { ...s.budget, treasury: 200 },
            gameManagement: {
                ...s.gameManagement,
                charisma: { ...s.gameManagement.charisma, current: 5 },
            },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        // Charisma +2 is now a read-through modifier (base unchanged; effective = 7).
        const { charisma, modifiers, round } = useGameStore.getState().gameManagement;
        expect(charisma.current).toBe(5);
        expect(getEffectiveCharisma(charisma.current, modifiers, round)).toBe(7);
    });

    it('test_rejecting_deal20_does_not_apply_charisma_effect', () => {
        const deal20 = getDeal(20);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal20, dealDecided: false },
            gameManagement: {
                ...s.gameManagement,
                charisma: { ...s.gameManagement.charisma, current: 5 },
            },
        }));

        useGameStore.getState().deals.actUponDeal(false);

        const { charisma, modifiers, round } = useGameStore.getState().gameManagement;
        expect(getEffectiveCharisma(charisma.current, modifiers, round)).toBe(5);
    });

    it('test_accepting_deal19_adds_recurring_modifier', () => {
        const deal19 = getDeal(19);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal19, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        const mod = useGameStore.getState().gameManagement.modifiers.find(m => m.id === 'deals.19');
        expect(mod).toBeDefined();
        expect(mod?.type).toBe('deal');
        expect(mod?.mods).toContainEqual(
            expect.objectContaining({ stat: 'roundIncome', amount: RECURRING.TINY }),
        );
    });

    it('test_accepting_deal19_defers_treasury_and_carries_people_on_the_modifier', () => {
        const deal19 = getDeal(19);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal19, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
            relations: { ...s.relations, current: { military: 0, business: 0, people: 0 } },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        // Treasury is banked in nextRound (time:1) — base treasury unchanged at accept time.
        expect(useGameStore.getState().budget.treasury).toBe(100);
        // Base people relation untouched; the −1 lives on the modifier.
        expect(useGameStore.getState().relations.current.people).toBe(0);
        const mod = useGameStore.getState().gameManagement.modifiers.find(m => m.id === 'deals.19')!;
        expect(mod.mods).toContainEqual(expect.objectContaining({ stat: 'treasury', amount: 15 }));
        expect(mod.mods).toContainEqual(expect.objectContaining({ stat: 'people', amount: -1 }));
    });

    it('test_accepting_deal22_does_not_change_base_treasury', () => {
        const deal22 = getDeal(22);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal22, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
            relations: { ...s.relations, current: { military: 0, business: 0, people: 0 } },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        // Deal 22 accept carries no treasury spec.
        expect(useGameStore.getState().budget.treasury).toBe(100);
    });

    it('test_rejecting_deal22_deducts_treasury_immediately', () => {
        const deal22 = getDeal(22);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal22, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().deals.actUponDeal(false);

        // Reject treasury spec (time:1) is applied as an immediate base mutation.
        expect(useGameStore.getState().budget.treasury).toBe(80);
    });
});
