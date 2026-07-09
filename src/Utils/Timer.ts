/**
 * Work-day timer pause/resume arithmetic (ADR-0006, Story 10-2).
 *
 * Single implementation shared by the store's `pauseTimer`/`resumeTimer` actions
 * and the Menu-tab auto-pause inside `setActiveTab`. The timer is expressed as
 * `timerStartedAt` (epoch ms, shifted forward on resume to credit the paused
 * span) and `timerPausedAt` (epoch ms while paused, else null).
 */

export type TimerFields = {
    timerStartedAt: number | null;
    timerPausedAt: number | null;
};

/** Field patch to pause at `now`. Returns null when already paused (caller no-ops). */
export function pausedTimerFields(t: TimerFields, now: number): Partial<TimerFields> | null {
    if (t.timerPausedAt !== null) return null;
    return { timerPausedAt: now };
}

/**
 * Field patch to resume at `now`, shifting `timerStartedAt` forward by the paused
 * span so elapsed time excludes the pause. Returns null when not paused.
 */
export function resumedTimerFields(t: TimerFields, now: number): Partial<TimerFields> | null {
    if (t.timerPausedAt === null) return null;
    return {
        timerStartedAt: t.timerStartedAt !== null ? t.timerStartedAt + (now - t.timerPausedAt) : null,
        timerPausedAt: null,
    };
}
