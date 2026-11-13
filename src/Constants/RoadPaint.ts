/**
 * Road paint wear (lane dividers, centre lines, stop lines, zebras): opacity follows the
 * infrastructure budget linearly between the slider's bounds — see src/Utils/RoadPaint.ts.
 */

/** Paint opacity at the lowest infrastructure budget: worn off completely. */
export const ROAD_PAINT_OPACITY_MIN = 0;

/** Paint opacity at the highest infrastructure budget: fresh paint. */
export const ROAD_PAINT_OPACITY_MAX = 1;
