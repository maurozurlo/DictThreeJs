import { Clamp } from './Math';
import { GAMESTATE } from '../Constants/GameState';
import { ROAD_PAINT_OPACITY_MAX, ROAD_PAINT_OPACITY_MIN } from '../Constants/RoadPaint';

/**
 * Road paint opacity for an infrastructure budget: linear from ROAD_PAINT_OPACITY_MIN at the
 * slider's minimum to ROAD_PAINT_OPACITY_MAX at its maximum, clamped.
 *
 *   t       = (infrastructure − EXPENDITURE.MIN) / (EXPENDITURE.MAX − EXPENDITURE.MIN)
 *   opacity = MIN + t × (MAX − MIN)
 *
 * @param infrastructure infrastructure slider value (the one the street props' tier bands read)
 */
export function roadPaintOpacity(infrastructure: number): number {
    const { MIN, MAX } = GAMESTATE.BUDGET.BOUNDS.EXPENDITURE;
    const t = Clamp((infrastructure - MIN) / (MAX - MIN), 0, 1);
    return ROAD_PAINT_OPACITY_MIN + t * (ROAD_PAINT_OPACITY_MAX - ROAD_PAINT_OPACITY_MIN);
}
