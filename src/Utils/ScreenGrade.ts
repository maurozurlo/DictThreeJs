import type { ScreenGradeParams, ScreenGradeTier } from '../Constants/ScreenGrade';
import { vehicleTierFor } from './VehiclePool';

/**
 * Screen-grade tier for an infrastructure expenditure value (1–10). Same thresholds as the
 * traffic tier (street-view.md §3.1), so cars and colour grade always flip together.
 *
 * @param infrastructure - infrastructure slider value
 */
export function screenGradeTierFor(infrastructure: number): ScreenGradeTier {
    return vehicleTierFor(infrastructure);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerp3 = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Field-wise blend of two grades.
 *
 * @param a - grade at t = 0
 * @param b - grade at t = 1
 * @param t - blend factor, clamped to 0–1
 */
export function lerpScreenGrade(a: ScreenGradeParams, b: ScreenGradeParams, t: number): ScreenGradeParams {
    const k = Math.min(1, Math.max(0, t));
    return {
        saturation: lerp(a.saturation, b.saturation, k),
        contrast: lerp(a.contrast, b.contrast, k),
        brightness: lerp(a.brightness, b.brightness, k),
        tint: lerp3(a.tint, b.tint, k),
        tintAmount: lerp(a.tintAmount, b.tintAmount, k),
        highlightTint: lerp3(a.highlightTint, b.highlightTint, k),
        highlightAmount: lerp(a.highlightAmount, b.highlightAmount, k),
    };
}

/** An in-flight fade between two grades. */
export interface ScreenGradeFade {
    from: ScreenGradeParams;
    to: ScreenGradeParams;
    /** Seconds since the fade started. */
    elapsed: number;
}

/** A fade that is already finished at `grade` (initial mount: no fade-in). */
export function settledFade(grade: ScreenGradeParams): ScreenGradeFade {
    return { from: grade, to: grade, elapsed: 0 };
}

/**
 * Grade shown by a fade at its current elapsed time (smoothstep ease in/out).
 *
 * @param fade     - the fade
 * @param duration - fade length in seconds; ≤ 0 snaps to the target
 */
export function sampleScreenGradeFade(fade: ScreenGradeFade, duration: number): ScreenGradeParams {
    const x = duration > 0 ? Math.min(1, Math.max(0, fade.elapsed / duration)) : 1;
    return lerpScreenGrade(fade.from, fade.to, x * x * (3 - 2 * x));
}

/**
 * Re-target a fade. Starts from whatever is on screen right now, so a tier change mid-fade
 * (slider dragged back and forth) never pops.
 *
 * @param fade     - the current fade
 * @param to       - new target grade
 * @param duration - fade length in seconds (to sample the current grade)
 */
export function retargetScreenGradeFade(fade: ScreenGradeFade, to: ScreenGradeParams, duration: number): ScreenGradeFade {
    return { from: sampleScreenGradeFade(fade, duration), to, elapsed: 0 };
}
