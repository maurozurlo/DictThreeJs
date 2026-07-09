/**
 * Story 10-3: Handler extraction + set() atomicity (ADR-0002).
 *
 * actUponLaw / actUponDeal previously called handleDecision (which set()) and
 * then set() again for stats — a render could observe the intermediate state.
 * The handlers now RETURN patches and each action issues exactly ONE set().
 * Zustand notifies subscribers once per set(), so the subscription count IS the
 * atomicity assertion.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { seedRng } from '../../../src/Utils/Math';
import type { Law } from '../../../src/types/Law';
import type { Deal } from '../../../src/types/Deal';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

function countSetsDuring(fn: () => void): number {
    let count = 0;
    const unsub = useGameStore.subscribe(() => { count++; });
    fn();
    unsub();
    return count;
}

const NORMAL_LAW: Law = {
    id: 9001,
    power: 'military',
    acceptMods: [{ stat: 'military', amount: 2, time: 0 }],
    rejectMods: [{ stat: 'military', amount: -1, time: 1 }],
};

const WEIRD_LAW: Law = {
    id: 9002,
    type: 'weird',
    power: 'people',
    acceptMods: [{ stat: 'treasury', amount: -20, time: 1 }, { stat: 'charisma', amount: 1, time: 0 }],
    rejectMods: [],
};

const DEAL: Deal = {
    id: 9003,
    text: 'Synthetic deal',
    acceptText: 'ok',
    rejectText: 'no',
    acceptMods: [{ stat: 'treasury', amount: 50, time: 1 }],
    rejectMods: [{ stat: 'treasury', amount: -10, time: 1 }],
} as Deal;

beforeEach(() => {
    useGameStore.getState().gameManagement.setPhase('start');
    seedRng(21);
});

describe('actUponLaw — one atomic set()', () => {
    it('test_law_accept_single_set_and_stats_in_same_patch', () => {
        // Arrange
        useGameStore.setState((s) => ({ law: { ...s.law, current: NORMAL_LAW, lawDecided: false } }));

        // Act
        const sets = countSetsDuring(() => useGameStore.getState().law.actUponLaw(true));

        // Assert
        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.stats.lawsPassed).toBe(1);
        expect(s.law.lawDecided).toBe(true);
        expect(s.gameManagement.modifiers.some(m => m.id === 'laws.9001')).toBe(true);
    });

    it('test_weird_law_accept_single_set_applies_base_effects', () => {
        // Arrange
        useGameStore.setState((s) => ({ law: { ...s.law, current: WEIRD_LAW, lawDecided: false } }));
        const treasuryBefore = useGameStore.getState().budget.treasury;

        // Act
        const sets = countSetsDuring(() => useGameStore.getState().law.actUponLaw(true));

        // Assert — treasury base-mutated, weird slot modifier added, stats counted
        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.budget.treasury).toBe(treasuryBefore - 20);
        expect(s.gameManagement.charisma.current).toBe(1);
        expect(s.gameManagement.modifiers.some(m => m.type === 'weird-law' && m.state === 'active')).toBe(true);
        expect(s.stats.lawsPassed).toBe(1);
    });

    it('test_weird_law_reject_single_set_no_penalty', () => {
        useGameStore.setState((s) => ({ law: { ...s.law, current: WEIRD_LAW, lawDecided: false } }));
        const relBefore = { ...useGameStore.getState().relations.current };

        const sets = countSetsDuring(() => useGameStore.getState().law.actUponLaw(false));

        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.relations.current).toEqual(relBefore);
        expect(s.stats.lawsRejected).toBe(1);
    });
});

describe('actUponDeal — one atomic set()', () => {
    it('test_deal_accept_single_set_updates_stats_and_extras', () => {
        // Arrange
        useGameStore.setState((s) => ({ deals: { ...s.deals, current: DEAL, dealDecided: false } }));

        // Act
        const sets = countSetsDuring(() => useGameStore.getState().deals.actUponDeal(true));

        // Assert — accept treasury (+50) lands in the extras recap, stats counted
        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.stats.dealsAccepted).toBe(1);
        expect(s.gameManagement.currentRoundExtraIncome).toBe(50);
        expect(s.deals.dealDecided).toBe(true);
    });

    it('test_deal_reject_single_set_counts_extra_expenses', () => {
        useGameStore.setState((s) => ({ deals: { ...s.deals, current: DEAL, dealDecided: false } }));

        const sets = countSetsDuring(() => useGameStore.getState().deals.actUponDeal(false));

        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.stats.dealsRejected).toBe(1);
        expect(s.gameManagement.currentRoundExtraExpenses).toBe(10);
    });
});

describe('shop.buy — handlePurchase patch or silent no-op', () => {
    it('test_buy_advisor_single_set_deducts_and_logs', () => {
        const treasuryBefore = useGameStore.getState().budget.treasury;

        const sets = countSetsDuring(() => useGameStore.getState().shop.buy('advisor_1'));

        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.shop.advisorLevel).toBe(1);
        expect(s.budget.treasury).toBe(treasuryBefore - 100);
        expect(s.gameManagement.currentRoundShopCost).toBe(100);
    });

    it('test_buy_rejected_purchase_fires_no_set', () => {
        // Arrange — drain the treasury so the advisor is unaffordable
        useGameStore.setState((s) => ({ budget: { ...s.budget, treasury: 5 } }));

        const sets = countSetsDuring(() => useGameStore.getState().shop.buy('advisor_1'));

        expect(sets).toBe(0);
        expect(useGameStore.getState().shop.advisorLevel).toBe(0);
    });
});

describe('event resolvers — shared applyEventEffect core', () => {
    it('test_periodic_resolve_single_set_applies_effect_and_unlocks_tabs', () => {
        // Arrange — synthetic periodic event with a treasury+relation outcome
        const event = {
            id: 'evt_synth',
            round: 3,
            options: [
                { id: 'a', effect: { treasury: -30, people: 2 } },
            ],
        };
        useGameStore.setState((s) => ({
            periodicEvent: { ...s.periodicEvent, current: event as never, decided: false, resultKey: null },
            tabs: { ...s.tabs, tabsLocked: true },
        }));
        const treasuryBefore = useGameStore.getState().budget.treasury;
        const peopleBefore = useGameStore.getState().relations.current.people;

        // Act
        const sets = countSetsDuring(() => useGameStore.getState().periodicEvent.resolve(0));

        // Assert
        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.budget.treasury).toBe(treasuryBefore - 30);
        expect(s.relations.current.people).toBe(peopleBefore + 2);
        expect(s.tabs.tabsLocked).toBe(false);
        expect(s.periodicEvent.decided).toBe(true);
        expect(s.gameManagement.currentRoundExtraExpenses).toBe(30);
    });

    it('test_mini_challenge_resolve_single_set_with_effect', () => {
        // Arrange — synthetic challenge, no risk so the outcome is deterministic
        const challenge = {
            id: 'mini_synth',
            acceptOutcome: { treasury: 25 },
            rejectOutcome: { treasury: 0 },
        };
        useGameStore.setState((s) => ({
            miniChallenge: { ...s.miniChallenge, current: challenge as never, decided: false, resultKey: null, riskTriggered: false },
        }));
        const treasuryBefore = useGameStore.getState().budget.treasury;

        // Act
        const sets = countSetsDuring(() => useGameStore.getState().miniChallenge.resolve(true));

        // Assert
        const s = useGameStore.getState();
        expect(sets).toBe(1);
        expect(s.budget.treasury).toBe(treasuryBefore + 25);
        expect(s.miniChallenge.decided).toBe(true);
        expect(s.gameManagement.currentRoundExtraIncome).toBe(25);
    });
});
