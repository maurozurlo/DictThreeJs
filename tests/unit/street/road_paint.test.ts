import { describe, expect, it } from 'vitest';
import { roadPaintOpacity } from '../../../src/Utils/RoadPaint';
import { ROAD_PAINT_OPACITY_MAX, ROAD_PAINT_OPACITY_MIN } from '../../../src/Constants/RoadPaint';
import { GAMESTATE } from '../../../src/Constants/GameState';

const { MIN, MAX } = GAMESTATE.BUDGET.BOUNDS.EXPENDITURE;

describe('roadPaintOpacity', () => {
    it('test_road_paint_lowest_infrastructure_is_fully_faded', () => {
        expect(roadPaintOpacity(MIN)).toBe(ROAD_PAINT_OPACITY_MIN);
        expect(ROAD_PAINT_OPACITY_MIN).toBe(0);
    });

    it('test_road_paint_highest_infrastructure_is_fresh', () => {
        expect(roadPaintOpacity(MAX)).toBe(ROAD_PAINT_OPACITY_MAX);
        expect(ROAD_PAINT_OPACITY_MAX).toBe(1);
    });

    it('test_road_paint_rises_linearly_with_infrastructure', () => {
        const step = (ROAD_PAINT_OPACITY_MAX - ROAD_PAINT_OPACITY_MIN) / (MAX - MIN);
        for (let v = MIN; v <= MAX; v++) {
            expect(roadPaintOpacity(v)).toBeCloseTo(ROAD_PAINT_OPACITY_MIN + (v - MIN) * step, 10);
        }
    });

    it('test_road_paint_out_of_range_values_clamp', () => {
        expect(roadPaintOpacity(MIN - 5)).toBe(ROAD_PAINT_OPACITY_MIN);
        expect(roadPaintOpacity(MAX + 5)).toBe(ROAD_PAINT_OPACITY_MAX);
    });
});
