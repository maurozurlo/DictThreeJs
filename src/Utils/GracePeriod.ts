/**
 * Dampens negative relation deltas in early rounds so new players can
 * experiment without immediately losing. Positive deltas are never dampened.
 *
 * Story: 4-5 | GDD: design/gdd/early-game-grace-period.md
 *
 * JavaScript Math.round(-0.5) = 0 (rounds toward +∞).
 * This is intentional: round 1 is the exploration round.
 */
export function applyGraceDampening(delta: number, round: number): number {
    if (delta >= 0) return delta;
    const multiplier = round === 1 ? 0.25 : round === 2 ? 0.5 : 1.0;
    // || 0 normalizes IEEE 754 negative zero to +0 (Math.round(-0.5) returns -0 in V8)
    return Math.round(delta * multiplier) || 0;
}

/** Returns the timer duration in ms for the given round. */
export function getRoundTimerMs(round: number): number {
    if (round === 1) return 180_000;
    if (round === 2) return 150_000;
    return 120_000;
}
