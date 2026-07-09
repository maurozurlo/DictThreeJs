import type { TFunction } from 'i18next';

/** Number of entries in the `hinge.headline.*` i18n pool (menu namespace). */
const HEADLINE_COUNT = 5;

/**
 * Picks a triumphant placeholder newsreel headline for the after-work hinge
 * (ADR-0012). Deterministic by round — cycles through a fixed pool rather
 * than rolling RNG, since the headline is always propaganda-positive
 * regardless of what actually happened that round (the satire is in the
 * contrast with the visible city state, not in randomness).
 */
export function buildRevealHeadline(round: number, t: TFunction): string {
    const index = ((round % HEADLINE_COUNT) + HEADLINE_COUNT) % HEADLINE_COUNT;
    return t(`hinge.headline.${index}`);
}
