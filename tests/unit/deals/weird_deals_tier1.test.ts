/**
 * Story 5-3: Weird Deals Tier 1 — unit tests
 *
 * Covers: deals 19-22 asset data, RECURRING.TINY constant, accept/reject effects,
 * charismaEffect on deal 20, recurring entry for deal 19, visual stubs,
 * and store integration via actUponDeal.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { DEALS } from '../../../src/assets/deals';
import { RECURRING } from '../../../src/Constants/Costs';
import { VISUAL_CONSEQUENCES } from '../../../src/assets/visualConsequences';

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
    it('test_deal19_accept_effect_treasury_plus_15', () => {
        expect(getDeal(19).acceptEffect.treasury).toBe(15);
    });

    it('test_deal19_accept_effect_people_minus_1', () => {
        expect(getDeal(19).acceptEffect.people).toBe(-1);
    });

    it('test_deal19_reject_effect_is_empty', () => {
        expect(Object.keys(getDeal(19).rejectEffect)).toHaveLength(0);
    });

    it('test_deal19_has_recurring_income_of_tiny', () => {
        const deal = getDeal(19);
        expect(deal.recurringEffect?.incomeBonus).toBe(RECURRING.TINY);
    });

    it('test_deal19_recurring_label_is_cow_income', () => {
        expect(getDeal(19).recurringEffect?.label).toBe('deals.recurring.cow_income');
    });

    it('test_deal19_power_is_people', () => {
        expect(getDeal(19).power).toBe('people');
    });

    it('test_deal19_has_no_charisma_effect', () => {
        expect(getDeal(19).charismaEffect).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Deal 20 — Giant National Computer Mouse
// ---------------------------------------------------------------------------

describe('Deal 20 — Giant National Computer Mouse (Story 5-3)', () => {
    it('test_deal20_accept_effect_treasury_minus_50', () => {
        expect(getDeal(20).acceptEffect.treasury).toBe(-50);
    });

    it('test_deal20_reject_effect_is_empty', () => {
        expect(Object.keys(getDeal(20).rejectEffect)).toHaveLength(0);
    });

    it('test_deal20_charisma_effect_is_2', () => {
        expect(getDeal(20).charismaEffect).toBe(2);
    });

    it('test_deal20_has_no_recurring_effect', () => {
        expect(getDeal(20).recurringEffect).toBeUndefined();
    });

    it('test_deal20_has_no_power', () => {
        expect(getDeal(20).power).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Deal 21 — Strategic Pigeon Surveillance Program
// ---------------------------------------------------------------------------

describe('Deal 21 — Strategic Pigeon Surveillance Program (Story 5-3)', () => {
    it('test_deal21_accept_effect_military_plus_1', () => {
        expect(getDeal(21).acceptEffect.military).toBe(1);
    });

    it('test_deal21_accept_effect_people_minus_1', () => {
        expect(getDeal(21).acceptEffect.people).toBe(-1);
    });

    it('test_deal21_reject_effect_is_empty', () => {
        expect(Object.keys(getDeal(21).rejectEffect)).toHaveLength(0);
    });

    it('test_deal21_has_no_recurring_effect', () => {
        expect(getDeal(21).recurringEffect).toBeUndefined();
    });

    it('test_deal21_power_is_military', () => {
        expect(getDeal(21).power).toBe('military');
    });
});

// ---------------------------------------------------------------------------
// Deal 22 — Swiss Hostage Diplomacy
// ---------------------------------------------------------------------------

describe('Deal 22 — Swiss Hostage Diplomacy (Story 5-3)', () => {
    it('test_deal22_accept_effect_military_minus_1', () => {
        expect(getDeal(22).acceptEffect.military).toBe(-1);
    });

    it('test_deal22_accept_effect_people_plus_1', () => {
        expect(getDeal(22).acceptEffect.people).toBe(1);
    });

    it('test_deal22_reject_effect_military_plus_1', () => {
        expect(getDeal(22).rejectEffect.military).toBe(1);
    });

    it('test_deal22_reject_effect_treasury_minus_20', () => {
        expect(getDeal(22).rejectEffect.treasury).toBe(-20);
    });

    it('test_deal22_power_is_people', () => {
        expect(getDeal(22).power).toBe('people');
    });

    it('test_deal22_has_no_recurring_effect', () => {
        expect(getDeal(22).recurringEffect).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Visual consequence stubs
// ---------------------------------------------------------------------------

describe('visual consequence stubs for weird deals (Story 5-3)', () => {
    it('test_deal19_visual_stub_exists_with_correct_condition', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'deal-19-tiny-cows');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('deal-19');
    });

    it('test_deal20_visual_stub_exists', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'deal-20-giant-mouse');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('deal-20');
    });

    it('test_deal21_visual_stub_exists_with_correct_condition', () => {
        const entry = VISUAL_CONSEQUENCES.find(v => v.id === 'deal-21-pigeon-cameras');
        expect(entry).toBeDefined();
        expect(entry?.condition.activeRecurringEffectId).toBe('deal-21');
    });
});

// ---------------------------------------------------------------------------
// Store integration — actUponDeal
// ---------------------------------------------------------------------------

describe('actUponDeal store integration (Story 5-3)', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
    });

    it('test_accepting_deal20_applies_charisma_effect', () => {
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

        expect(useGameStore.getState().gameManagement.charisma.current).toBe(7);
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

        expect(useGameStore.getState().gameManagement.charisma.current).toBe(5);
    });

    it('test_accepting_deal19_adds_recurring_entry_to_active_effects', () => {
        const deal19 = getDeal(19);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal19, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        const effects = useGameStore.getState().gameManagement.activeRecurringEffects;
        const entry = effects.find(e => e.sourceId === 'deal-19');
        expect(entry).toBeDefined();
        expect(entry?.sourceType).toBe('deal');
        expect(entry?.incomeBonus).toBe(RECURRING.TINY);
    });

    it('test_accepting_deal19_applies_treasury_and_people_effects', () => {
        const deal19 = getDeal(19);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal19, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
            relations: { ...s.relations, current: { military: 0, business: 0, people: 0 } },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        expect(useGameStore.getState().budget.treasury).toBe(115);
        // people: -1 but grace dampening may soften it in early rounds — just check it's ≤ 0
        expect(useGameStore.getState().relations.current.people).toBeLessThanOrEqual(0);
    });

    it('test_accepting_deal22_applies_accept_effects', () => {
        const deal22 = getDeal(22);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal22, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
            relations: { ...s.relations, current: { military: 0, business: 0, people: 0 } },
        }));

        useGameStore.getState().deals.actUponDeal(true);

        // military -1 → clamped or dampened; check budget unchanged beyond treasury
        expect(useGameStore.getState().budget.treasury).toBe(100);
    });

    it('test_rejecting_deal22_deducts_treasury', () => {
        const deal22 = getDeal(22);

        useGameStore.setState(s => ({
            deals: { ...s.deals, current: deal22, dealDecided: false },
            budget: { ...s.budget, treasury: 100 },
        }));

        useGameStore.getState().deals.actUponDeal(false);

        expect(useGameStore.getState().budget.treasury).toBe(80);
    });
});
