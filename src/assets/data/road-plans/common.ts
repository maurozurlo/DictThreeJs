/**
 * Shared anchors for the road-plan variants (road planning, 2026-11-12).
 *
 * The plaza never moves: env_plaza is placed at (4.15, -3.43) and spans ±40.9 × ±26.2, so its
 * interior is fixed and every variant builds its kerbs, roads and blocks around it.
 */
import type { V2 } from '../../../Traffic/Geometry.ts';

/** env_plaza footprint (world XZ) — the immovable centre of every layout. */
export const PLAZA = { x0: -36.75, x1: 45.05, z0: -29.65, z1: 22.77 } as const;
export const PLAZA_CENTRE: V2 = [4.15, -3.44];

/** Lane width: a car is ~4.4 u wide (1.1 m × 3.7 world scale) plus clearance. */
export const LANE = 7;
/** Default sidewalk band — three abreast for 2.2 u-wide citizens. */
export const SIDEWALK = 8;

/** Roads run out to these bounds so cars spawn / despawn well off camera. */
export const PLAN_BOUNDS = { min: [-280, -260] as V2, max: [290, 230] as V2 };

/** Blocks stop here: beyond is background ground, keeping ped loops near the camera. */
export const DETAIL = { x0: -175, x1: 185, z0: -160, z1: 130 } as const;

/** Building footprints at rotation 0 (world units, from the GLB bounds) for plan validation. */
export const BUILDING_FOOTPRINT: Record<string, V2> = {
    env_bld_mixeduse_normal: [17.6, 22.8],
    env_bld_apartment_normal: [31, 51.4],
    env_bld_commercial_normal: [52, 17.4],
    env_bld_civic_normal: [49, 30.4],
    env_bld_residential_normal: [12.4, 27],
    env_scaffolding_large: [6.8, 26.2],
    env_bld_terrace_normal: [100, 22],
};
