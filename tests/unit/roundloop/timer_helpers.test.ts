/**
 * Story 10-2: shared timer pause/resume arithmetic (ADR-0006) + merged
 * expireTimer() penalty behavior.
 *
 * pausedTimerFields/resumedTimerFields are the single implementation behind
 * pauseTimer, resumeTimer, and setActiveTab's Menu auto-pause. expireTimer()
 * collapsed from two near-identical set() branches into one — the penalty
 * (relations/charisma/timeout log) must still apply ONLY when the meeting
 * was skipped.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pausedTimerFields, resumedTimerFields } from '../../../src/Utils/Timer';
import { useGameStore } from '../../../src/Stores/GameState';
import { Tabs } from '../../../src/types/Tabs';
import { seedRng } from '../../../src/Utils/Math';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

describe('Timer field helpers (pure)', () => {
    it('test_timer_pause_sets_pausedAt_when_running', () => {
        // Arrange
        const t = { timerStartedAt: 1000, timerPausedAt: null };
        // Act
        const patch = pausedTimerFields(t, 5000);
        // Assert
        expect(patch).toEqual({ timerPausedAt: 5000 });
    });

    it('test_timer_pause_noops_when_already_paused', () => {
        const t = { timerStartedAt: 1000, timerPausedAt: 3000 };
        expect(pausedTimerFields(t, 5000)).toBeNull();
    });

    it('test_timer_resume_credits_paused_span', () => {
        // Paused from 3000 to 5000 → startedAt shifts forward by 2000
        const t = { timerStartedAt: 1000, timerPausedAt: 3000 };
        const patch = resumedTimerFields(t, 5000);
        expect(patch).toEqual({ timerStartedAt: 3000, timerPausedAt: null });
    });

    it('test_timer_resume_noops_when_not_paused', () => {
        const t = { timerStartedAt: 1000, timerPausedAt: null };
        expect(resumedTimerFields(t, 5000)).toBeNull();
    });

    it('test_timer_resume_keeps_null_startedAt_null', () => {
        // Round-1 intro state: timer never started, then paused via Menu
        const t = { timerStartedAt: null, timerPausedAt: 3000 };
        const patch = resumedTimerFields(t, 5000);
        expect(patch).toEqual({ timerStartedAt: null, timerPausedAt: null });
    });
});

describe('Store timer actions share the helpers', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
        seedRng(7);
    });

    it('test_store_pause_then_resume_restores_running_state', () => {
        // Arrange
        useGameStore.getState().gameManagement.beginFirstWorkDay();
        const startedBefore = useGameStore.getState().gameManagement.timerStartedAt;

        // Act
        useGameStore.getState().gameManagement.pauseTimer();
        const paused = useGameStore.getState().gameManagement.timerPausedAt;
        useGameStore.getState().gameManagement.resumeTimer();

        // Assert
        const gm = useGameStore.getState().gameManagement;
        expect(paused).not.toBeNull();
        expect(gm.timerPausedAt).toBeNull();
        expect(gm.timerStartedAt).toBeGreaterThanOrEqual(startedBefore!);
    });

    it('test_menu_tab_pauses_and_leaving_resumes', () => {
        // Arrange
        useGameStore.getState().gameManagement.beginFirstWorkDay();

        // Act — enter Menu (pauses), leave to Log (resumes)
        useGameStore.getState().tabs.setActiveTab(Tabs.Menu);
        const pausedAt = useGameStore.getState().gameManagement.timerPausedAt;
        useGameStore.getState().tabs.setActiveTab(Tabs.Log);

        // Assert
        expect(pausedAt).not.toBeNull();
        expect(useGameStore.getState().gameManagement.timerPausedAt).toBeNull();
    });
});

describe('expireTimer() merged penalty branch', () => {
    beforeEach(() => {
        useGameStore.getState().gameManagement.setPhase('start');
        seedRng(7);
    });

    it('test_expiretimer_skipped_meeting_applies_penalty_and_timeout_event', () => {
        // Arrange — no meet action taken
        const relBefore = { ...useGameStore.getState().relations.current };

        // Act
        useGameStore.getState().gameManagement.expireTimer();

        // Assert — charisma -1, two factions penalised, timeout event logged
        const s = useGameStore.getState();
        expect(s.gameManagement.charisma.current).toBe(-1);
        const drops = (['military', 'business', 'people'] as const)
            .filter(p => s.relations.current[p] < relBefore[p]);
        expect(drops.length).toBe(2);
        expect(s.gameManagement.pendingLog.some(e => e.key === 'log.event.timeout')).toBe(true);
        expect(s.gameManagement.dwelling).toBe(true);
    });

    it('test_expiretimer_meeting_taken_applies_no_penalty', () => {
        // Arrange — mark the meet action as taken
        useGameStore.setState((st) => ({
            meet: { ...st.meet, actionTaken: { type: 'dialogue', taken: true, power: 'people' } },
        }));
        const relBefore = { ...useGameStore.getState().relations.current };
        const charismaBefore = useGameStore.getState().gameManagement.charisma.current;

        // Act
        useGameStore.getState().gameManagement.expireTimer();

        // Assert — no penalty, no timeout event, hinge still opens
        const s = useGameStore.getState();
        expect(s.relations.current).toEqual(relBefore);
        expect(s.gameManagement.charisma.current).toBe(charismaBefore);
        expect(s.gameManagement.pendingLog.some(e => e.key === 'log.event.timeout')).toBe(false);
        expect(s.gameManagement.dwelling).toBe(true);
        expect(s.tabs.activeTab).toBe(Tabs.Street);
    });
});
