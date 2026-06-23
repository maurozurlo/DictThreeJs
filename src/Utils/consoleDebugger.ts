import { useGameStore } from '../Stores/GameState';

/** Set to false to silence all debug output. Flip before shipping. */
const DEBUG = true;

/** Guarded console.log — no-ops when DEBUG is false. */
export function debugLog(label: string, ...args: unknown[]): void {
    if (!DEBUG) return;
    console.log(`[DEBUG | ${label}]`, ...args);
}

/**
 * Subscribe to every treasury mutation and log it with context.
 *
 * Round advance: grouped breakdown of income / expenses / recurring / treasury-mod
 * contributions so you can see exactly what nextRound() applied vs. what the
 * Budget tab was showing before the player hit Advance.
 *
 * Other mutations (law accept, shop purchase, etc.): single-line delta log.
 *
 * Call once at app startup. Returns the Zustand unsubscribe function.
 */
export function initBudgetDebugger(): () => void {
    if (!DEBUG) return () => {};

    return useGameStore.subscribe((state, prev) => {
        const treasury    = state.budget.treasury;
        const prevTreasury = prev.budget.treasury;
        const round       = state.gameManagement.round;
        const prevRound   = prev.gameManagement.round;

        if (round !== prevRound) {
            const gm = state.gameManagement;
            // What nextRound() applied from regular income/expense channels:
            const baseNet         = gm.lastRoundIncome - gm.lastRoundExpenses;
            const recurringNet    = gm.lastRoundRecurringIncome - gm.lastRoundRecurringExpenses;
            // Any leftover delta comes from treasury-stat modifiers (law/deal time:1 specs).
            const treasuryModDelta = (treasury - prevTreasury) - baseNet - recurringNet;

            console.group(`[BUDGET] Round ${prevRound} → ${round}`);
            console.log('  base income   :', `+${gm.lastRoundIncome}`);
            console.log('  base expenses :', `-${gm.lastRoundExpenses}`);
            console.log('  recurring in  :', `+${gm.lastRoundRecurringIncome}`);
            console.log('  recurring out :', `-${gm.lastRoundRecurringExpenses}`);
            if (treasuryModDelta !== 0)
                console.log('  treasury mods :', treasuryModDelta >= 0 ? `+${treasuryModDelta}` : treasuryModDelta);
            console.log('  ─────────────────────────────────');
            console.log('  net change    :', treasury - prevTreasury >= 0 ? `+${treasury - prevTreasury}` : treasury - prevTreasury);
            console.log('  treasury now  :', treasury, `(was ${prevTreasury})`);
            console.groupEnd();
            return;
        }

        if (treasury !== prevTreasury) {
            const delta = treasury - prevTreasury;
            console.log(
                `[BUDGET] Round ${round} | ${prevTreasury} → ${treasury}`,
                delta >= 0 ? `(+${delta})` : `(${delta})`,
            );
        }
    });
}
