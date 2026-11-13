import { describe, it, expect } from 'vitest';
import {
    arcPolyline, fillet, insetRounded, offsetPolyline, pointAt, rect, rightOf, signedArea, slice, windInteriorRight,
} from '../../../src/Traffic/Geometry';
import { SpatialGrid } from '../../../src/Traffic/SpatialGrid';
import { classifyTurn } from '../../../src/Traffic/RoadBuilder';

const bounds = (pts: [number, number][]) => ({
    x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])),
    z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])),
});

describe('Traffic geometry', () => {
    it('test_rightOf_is_the_drivers_right_in_a_y_up_world', () => {
        // heading +X: the driver's right is +Z (toward the Street camera)
        expect(rightOf([1, 0])).toEqual([-0, 1]);
        // heading +Z: right is -X
        expect(rightOf([0, 1])).toEqual([-1, 0]);
    });

    it('test_turn_classification_signs', () => {
        expect(classifyTurn([1, 0], [0, 1]).turn).toBe('right');
        expect(classifyTurn([1, 0], [0, -1]).turn).toBe('left');
        expect(classifyTurn([1, 0], [1, 0.1]).turn).toBe('straight');
    });

    it('test_wind_interior_right_gives_positive_area', () => {
        const sq = rect(0, 0, 10, 10);
        expect(signedArea(windInteriorRight(sq))).toBeGreaterThan(0);
        expect(signedArea(windInteriorRight([...sq].reverse()))).toBeGreaterThan(0);
    });

    it('test_fillet_keeps_true_arc_radius', () => {
        // Arrange: 90° corner at the origin, travelling +Z then +X; radius-10 arc centred at (10, -10)
        const corner: [number, number][] = [[0, -50], [0, 0], [50, 0]];
        // Act
        const pts = fillet(corner, 10, false);
        // Assert: every point of the rounded corner lies exactly on the circle
        const arcPts = pts.filter((p) => p[0] > 1e-6 && p[1] < -1e-6 && p[0] < 10 && p[1] > -10);
        expect(arcPts.length).toBeGreaterThan(3);
        for (const p of arcPts) expect(Math.hypot(p[0] - 10, p[1] + 10)).toBeCloseTo(10, 6);
    });

    it('test_inset_rounded_matches_sharp_inner_rectangle_when_sidewalk_exceeds_radius', () => {
        const inner = insetRounded(rect(-44.75, -37.65, 53.05, 30.77), 8, 6);
        const b = bounds(inner);
        expect(b.x0).toBeCloseTo(-36.75, 2);
        expect(b.x1).toBeCloseTo(45.05, 2);
        expect(b.z0).toBeCloseTo(-29.65, 2);
        expect(b.z1).toBeCloseTo(22.77, 2);
    });

    it('test_offset_moves_to_the_right_of_travel', () => {
        const off = offsetPolyline([[0, 0], [10, 0]], 2, false);
        expect(off[0][1]).toBeCloseTo(2);
        expect(off[1][1]).toBeCloseTo(2);
    });

    it('test_slice_wraps_across_closed_line_start', () => {
        const line = arcPolyline(rect(0, 0, 10, 10), true); // length 40, starts at (0,0)
        const part = slice(line, 35, 45); // last 5 u of the left edge + first 5 u of the top edge
        expect(part[0]).toEqual(pointAt(line, 35));
        expect(part[part.length - 1][0]).toBeCloseTo(5);
        expect(part.some((p) => p[0] === 0 && p[1] === 0)).toBe(true);
    });
});

describe('SpatialGrid', () => {
    it('test_query_finds_neighbours_and_skips_far_entities', () => {
        const grid = new SpatialGrid(-100, -100, 100, 100, 8, 16);
        const xs = [0, 3, 50, -90], zs = [0, 1, 50, -90];
        grid.rebuild(4, xs, zs);
        const out = new Int32Array(16);
        const n = grid.query(0, 0, 5, out);
        const ids = Array.from(out.slice(0, n)).sort();
        expect(ids).toContain(0);
        expect(ids).toContain(1);
        expect(ids).not.toContain(2);
        expect(ids).not.toContain(3);
    });

    it('test_inactive_entities_are_not_bucketed', () => {
        const grid = new SpatialGrid(-10, -10, 10, 10, 4, 4);
        grid.rebuild(2, [0, 0], [0, 0], [1, 0]);
        const out = new Int32Array(4);
        expect(Array.from(out.slice(0, grid.query(0, 0, 2, out)))).toEqual([0]);
    });
});
