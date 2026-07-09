/**
 * Story 9-1: `dwelling` state — work/hinge phase split (ADR-0012)
 *
 * Tests verify:
 *   - expireTimer() sets dwelling: true and force-navigates to Tabs.Street
 *   - nextRound() resets dwelling: false across representative end-condition
 *     branches (normal continue, coup, victory) — all branches share the same
 *     object-spread pattern, so these three cover the risk surface.
 *   - buildLoadedState defaults dwelling to false regardless of save payload
 *     (the hinge is never persisted mid-flight).
 *
 * Design doc: ROUND_LOOP_STREET_REVEAL_0_1.md
 * ADR: docs/architecture/adr-0012-round-loop-phase-split.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { buildLoadedState } from '../../../src/Stores/StateFactory';
import { Tabs } from '../../../src/types/Tabs';
import { GAMESTATE } from '../../../src/Constants/GameState';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

function resetStore(): void {
    useGameStore.getState().gameManagement.setPhase('start');
}

describe('expireTimer() — opens the hinge', () => {
    beforeEach(resetStore);

    it('test_expireTimer_sets_dwelling_true', () => {
        useGameStore.getState().gameManagement.expireTimer();
        expect(useGameStore.getState().gameManagement.dwelling).toBe(true);
    });

    it('test_expireTimer_forces_active_tab_to_street', () => {
        useGameStore.getState().tabs.setActiveTab(Tabs.Log);
        useGameStore.getState().gameManagement.expireTimer();
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Street);
    });

    it('test_expireTimer_sets_dayEnded_true_alongside_dwelling', () => {
        useGameStore.getState().gameManagement.expireTimer();
        expect(useGameStore.getState().gameManagement.dayEnded).toBe(true);
    });
});

describe('nextRound() — closes the hinge (normal branch)', () => {
    beforeEach(resetStore);

    it('test_nextRound_normal_branch_resets_dwelling_false', () => {
        useGameStore.getState().gameManagement.expireTimer();
        expect(useGameStore.getState().gameManagement.dwelling).toBe(true);

        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().gameManagement.dwelling).toBe(false);
    });
});

describe('nextRound() — closes the hinge (coup branch)', () => {
    beforeEach(resetStore);

    it('test_nextRound_coup_branch_resets_dwelling_false', () => {
        // Arm the coup: relation at threshold + charisma at threshold, already
        // survived one grace round — the next nextRound() fires the coup.
        vi.spyOn(Math, 'random').mockReturnValue(0.3);
        useGameStore.setState((s) => ({
            relations: { ...s.relations, current: { ...s.relations.current, military: 8 } },
            gameManagement: {
                ...s.gameManagement,
                charisma: { ...s.gameManagement.charisma, current: -3 },
                coupArmedLastRound: false,
                dwelling: true,
            },
        }));
        useGameStore.getState().gameManagement.nextRound(); // round 1: grace fires (deterministic)
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));

        useGameStore.getState().gameManagement.nextRound(); // round 2: coup fires
        expect(useGameStore.getState().gameManagement.phase).toBe('lose');
        expect(useGameStore.getState().gameManagement.dwelling).toBe(false);
        vi.restoreAllMocks();
    });
});

describe('nextRound() — closes the hinge (victory branch)', () => {
    beforeEach(resetStore);

    it('test_nextRound_victory_branch_resets_dwelling_false', () => {
        useGameStore.setState((s) => ({
            gameManagement: { ...s.gameManagement, round: GAMESTATE.ROUNDS.MAX, dwelling: true },
        }));

        useGameStore.getState().gameManagement.nextRound();
        expect(useGameStore.getState().gameManagement.phase).toBe('victory');
        expect(useGameStore.getState().gameManagement.dwelling).toBe(false);
    });
});

describe('buildLoadedState — dwelling always restores false', () => {
    it('test_buildLoadedState_defaults_dwelling_false_when_absent', () => {
        const state = useGameStore.getState();
        const loaded = buildLoadedState(state, { gameManagement: {} });
        expect(loaded.gameManagement.dwelling).toBe(false);
    });

    it('test_buildLoadedState_ignores_persisted_dwelling_true', () => {
        const state = useGameStore.getState();
        const loaded = buildLoadedState(state, { gameManagement: { dwelling: true } });
        expect(loaded.gameManagement.dwelling).toBe(false);
    });
});
