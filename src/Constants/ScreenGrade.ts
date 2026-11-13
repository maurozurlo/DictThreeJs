/**
 * Screen colour grade per infrastructure tier (art-bible §5.4.5).
 *
 * A full-screen pass over every 3D scene (office, meeting room, street, secret rooms) — the
 * HTML UI is never graded. The tier follows the infrastructure slider with the same thresholds
 * as street traffic (street-view.md §3.1: 1–3 poor, 4–7 normal, 8–10 rich). Purely cosmetic.
 */

/** Infrastructure tier the grade follows. */
export type ScreenGradeTier = 'poor' | 'normal' | 'rich';

/**
 * One grade. Applied in display (sRGB) space, in this order:
 * saturation → contrast → brightness → tint → highlight tint.
 */
export interface ScreenGradeParams {
    /** 0 = greyscale, 1 = untouched, > 1 = boosted. */
    saturation: number;
    /** Contrast around mid-grey; 1 = untouched. */
    contrast: number;
    /** Overall multiplier; 1 = untouched. */
    brightness: number;
    /** Tint colour, linear RGB 0–1. Luminance-normalised, so it shifts hue without darkening. */
    tint: readonly [number, number, number];
    /** How much of the tint is applied (0–1). */
    tintAmount: number;
    /** Extra tint weighted towards bright pixels (sunlit surfaces), linear RGB 0–1. */
    highlightTint: readonly [number, number, number];
    /** How much of the highlight tint is applied (0–1). */
    highlightAmount: number;
}

/** Hex `#rrggbb` → RGB triple in 0–1. */
const rgb = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** The grade each tier settles on. */
export const SCREEN_GRADE_BY_TIER: Record<ScreenGradeTier, ScreenGradeParams> = {
    // Civic neglect: colour drained, flat and ashen, a little dimmer.
    poor: {
        saturation: 0.25,
        contrast: 0.85,
        brightness: 0.9,
        tint: rgb('#c7c7cc'),
        tintAmount: 0.5,
        highlightTint: rgb('#ffffff'),
        highlightAmount: 0,
    },
    // Overcast: grey but still colourful, cool light-blue cast.
    normal: {
        saturation: 0.75,
        contrast: 0.93,
        brightness: 1.03,
        tint: rgb('#9ec7f2'),
        tintAmount: 0.55,
        highlightTint: rgb('#ffffff'),
        highlightAmount: 0,
    },
    // Tropical sun: saturated, warm yellow cast, golden highlights.
    rich: {
        saturation: 1.3,
        contrast: 1.05,
        brightness: 1.08,
        tint: rgb('#fff29e'),
        tintAmount: 0.45,
        highlightTint: rgb('#ffd666'),
        highlightAmount: 0.35,
    },
};

/** Seconds a tier change takes to fade from the old grade to the new one. */
export const SCREEN_GRADE_FADE_SECONDS = 2.5;
