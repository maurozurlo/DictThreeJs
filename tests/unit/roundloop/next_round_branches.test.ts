/**
 * Story 10-1: nextRound() branch behavior pins (test-first, audit §A1).
 *
 * Written BEFORE the buildGameOverPatch/buildRoundStartPatch extraction to pin
 * per-branch field expectations so the refactor is provably behavior-preserving.
 *
 * One intentional behavior CHANGE is pinned here as the desired state (audit-
 * predicted bug class): the normal branch failed to zero currentRoundBribeCost /
 * currentRoundExpropriateGain / currentRoundShopCost (the periodic and game-over
 * branches did), so DayEnded's recap accumulated across consecutive normal
 * rounds. The unified builder zeroes all five counters on every branch.
 *
 * ADR-0002 (atomic set), ADR-0012 (dwelling/dayEnded reset invariants).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { seedRng } from '../../../src/Utils/Math';
import { Tabs } from '../../../src/types/Tabs';
import { GAMESTATE } from '../../../src/Constants/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

function resetStore(): void {
    useGameStore.getState().gameManagement.setPhase('start');
    seedRng(42);
}

/** Seed the three recap counters so we can assert they reset. */
function dirtyRoundCounters(): void {
    useGameStore.setState((s) => ({
        gameManagement: {
            ...s.gameManagement,
            currentRoundExtraIncome: 11,
            currentRoundExtraExpenses: 12,
            currentRoundExpropriateGain: 20,
            currentRoundBribeCost: 50,
            currentRoundShopCost: 30,
        },
    }));
}

function expectAllCountersZero(): void {
    const gm = useGameStore.getState().gameManagement;
    expect(gm.currentRoundExtraIncome).toBe(0);
    expect(gm.currentRoundExtraExpenses).toBe(0);
    expect(gm.currentRoundExpropriateGain).toBe(0);
    expect(gm.currentRoundBribeCost).toBe(0);
    expect(gm.currentRoundShopCost).toBe(0);
}

describe('nextRound() — normal branch', () => {
    beforeEach(resetStore);

    it('test_nextround_normal_advances_round_and_reopens_work_day', () => {
        // Arrange
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.gameManagement.round).toBe(GAMESTATE.ROUNDS.START + 1);
        expect(s.gameManagement.phase).toBe('start');
        expect(s.gameManagement.dayEnded).toBe(false);
        expect(s.gameManagement.dwelling).toBe(false);
        expect(s.gameManagement.timerStartedAt).not.toBeNull();
        expect(s.tabs.activeTab).toBe(Tabs.Log);
        expect(s.tabs.tabsLocked).toBe(false);
    });

    it('test_nextround_normal_clears_pending_log_and_appends_round_log', () => {
        // Arrange
        const logBefore = useGameStore.getState().log.length;
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.gameManagement.pendingLog).toEqual([]);
        expect(s.log.length).toBe(logBefore + 1);
    });

    it('test_nextround_normal_resets_decision_slices_and_frozen_factions', () => {
        // Arrange
        useGameStore.setState((st) => ({
            shop: { ...st.shop, frozenFactions: new Set(['people'] as const) },
        }));
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.shop.frozenFactions.size).toBe(0);
        expect(s.law.lawDecided).toBe(false);
        expect(s.deals.dealDecided).toBe(false);
        expect(s.meet.actionTaken.taken).toBe(false);
        expect(s.periodicEvent.current).toBeNull(); // no periodic event at round 2
    });

    it('test_nextround_normal_zeroes_all_five_round_counters', () => {
        // Arrange — regression pin for the audit §A1 counter bug
        dirtyRoundCounters();
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        expectAllCountersZero();
    });
});

describe('nextRound() — periodic-event branch', () => {
    beforeEach(resetStore);

    it('test_nextround_periodic_round_presents_event_and_zeroes_counters', () => {
        // Arrange — periodic events exist at rounds 3, 6, 9
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, round: 2 },
        }));
        dirtyRoundCounters();
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.gameManagement.round).toBe(3);
        expect(s.periodicEvent.current).not.toBeNull();
        expect(s.periodicEvent.decided).toBe(false);
        expect(s.miniChallenge.current).toBeNull();
        expect(s.gameManagement.dwelling).toBe(false);
        expect(s.tabs.activeTab).toBe(Tabs.Log);
        expectAllCountersZero();
    });
});

describe('nextRound() — bankruptcy branch', () => {
    beforeEach(resetStore);

    function forceBankruptcy(): void {
        useGameStore.setState((s) => ({
            budget: {
                ...s.budget,
                treasury: 1,
                taxes: { peopleTaxes: 0, businessTaxes: 0 },
            },
        }));
    }

    it('test_nextround_bankruptcy_sets_lose_phase_and_cause', () => {
        // Arrange
        forceBankruptcy();
        dirtyRoundCounters();
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.gameManagement.phase).toBe('lose');
        expect(s.gameManagement.endCause).toBe('bankruptcy');
        expect(s.gameManagement.endReason).toBe('endscreen.end_reason.bankruptcy');
        expect(s.gameManagement.round).toBe(GAMESTATE.ROUNDS.START + 1);
        expect(s.gameManagement.dayEnded).toBe(false);
        expect(s.gameManagement.dwelling).toBe(false);
        expect(s.gameManagement.coupArmedLastRound).toBe(false);
        expect(s.gameManagement.coupWarningFaction).toBeNull();
        expectAllCountersZero();
    });

    it('test_nextround_bankruptcy_leaves_tabs_and_decision_slices_untouched', () => {
        // Arrange — game-over branches must not reset play-slices; the hinge
        // left us on Street and there it stays (EndScreen overlays by phase).
        forceBankruptcy();
        useGameStore.getState().gameManagement.expireTimer();
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Street);
        const lawBefore = useGameStore.getState().law.current;

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.tabs.activeTab).toBe(Tabs.Street);
        expect(s.law.current).toBe(lawBefore);
    });
});

describe('nextRound() — overthrown branch', () => {
    beforeEach(resetStore);

    it('test_nextround_overthrown_sets_lose_phase_with_faction_cause', () => {
        // Arrange — people at floor; effective relation <= MIN triggers overthrow
        useGameStore.setState((s) => ({
            relations: {
                ...s.relations,
                current: { ...s.relations.current, people: GAMESTATE.RELATIONS.MIN },
            },
        }));
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.gameManagement.phase).toBe('lose');
        expect(s.gameManagement.endCause).toBe('people');
        expect(s.gameManagement.endReason).toBe('endscreen.end_reason.overthrown_people');
        expect(s.gameManagement.dwelling).toBe(false);
    });
});

describe('nextRound() — victory branch', () => {
    beforeEach(resetStore);

    it('test_nextround_victory_sets_phase_with_null_end_fields', () => {
        // Arrange
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, round: GAMESTATE.ROUNDS.MAX },
        }));
        dirtyRoundCounters();
        useGameStore.getState().gameManagement.expireTimer();

        // Act
        useGameStore.getState().gameManagement.nextRound();

        // Assert
        const s = useGameStore.getState();
        expect(s.gameManagement.phase).toBe('victory');
        expect(s.gameManagement.endReason).toBeNull();
        expect(s.gameManagement.endCause).toBeNull();
        expect(s.gameManagement.round).toBe(GAMESTATE.ROUNDS.MAX + 1);
        expect(s.gameManagement.dwelling).toBe(false);
        expectAllCountersZero();
    });
});
