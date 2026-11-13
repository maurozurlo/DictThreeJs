/**
 * Budget bands that swap street props between tiers. They mirror the IDE `visibleIf`
 * ranges in src/assets/data/street-objects.ide.ts ([1,3] / [4,7] / [8,10]) for both
 * infrastructure and security; tests/unit/street/street_inspect.test.ts keeps them in sync.
 */

/** Highest budget value (inclusive) of the low band — poor furniture, street barricades. */
export const STREET_BAND_LOW_MAX = 3;

/** Lowest budget value (inclusive) of the high band — luxury furniture, heavy military. */
export const STREET_BAND_HIGH_MIN = 8;

/** Emissive tint on the street object the inspector is showing. */
export const INSPECT_SELECTED_EMISSIVE = 0x9a7a3a;

/** Emissive tint on an inspectable street object under the pointer. */
export const INSPECT_HOVER_EMISSIVE = 0x4a3e22;
