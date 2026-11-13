/**
 * Variant B — "Rotonda": the plaza is a rounded island; traffic orbits it on a one-way ring.
 *
 * - Ring road (one lane, 14 u wide) circulates counter-clockwise seen from above (right-hand
 *   traffic): entries are right-turn merges, exits right-turn diverges — no crossing conflicts.
 * - Four two-way radials leave at the plaza mid-sides; the north radial ends at a far cross road
 *   in front of the ministry, which terminates the vista behind the plaza.
 * - Zebras across every radial and across the ring at its four corners (island access).
 */
import { arc, type V2 } from '../../../Traffic/Geometry.ts';
import type { RoadPlan } from '../../../Traffic/RoadPlan.ts';
import { DETAIL, LANE, PLAN_BOUNDS, PLAZA_CENTRE, SIDEWALK } from './common.ts';

const [CX, CZ] = PLAZA_CENTRE;
/** Island kerb: plaza + 12 u promenade, corners rounded wide enough to read as a roundabout. */
const ISLAND = { x0: -48.75, x1: 57.05, z0: -41.65, z1: 34.77, r: 26 };
const RING_HALF = 7;
const RING = { x0: ISLAND.x0 - RING_HALF, x1: ISLAND.x1 + RING_HALF, z0: ISLAND.z0 - RING_HALF, z1: ISLAND.z1 + RING_HALF, r: ISLAND.r + RING_HALF };
const OUTER = { x0: RING.x0 - RING_HALF, x1: RING.x1 + RING_HALF, z0: RING.z0 - RING_HALF, z1: RING.z1 + RING_HALF, r: RING.r + RING_HALF };
const RADIAL_HALF = LANE; // 1+1 lanes
const BACK_Z = -90;
const [X0] = PLAN_BOUNDS.min;
const [X1, Z1] = PLAN_BOUNDS.max;

// Corner arc centres shared by island, ring and the outer kerb (concentric).
const C_NW: V2 = [OUTER.x0 + OUTER.r, OUTER.z0 + OUTER.r];
const C_NE: V2 = [OUTER.x1 - OUTER.r, OUTER.z0 + OUTER.r];
const C_SE: V2 = [OUTER.x1 - OUTER.r, OUTER.z1 - OUTER.r];
const C_SW: V2 = [OUTER.x0 + OUTER.r, OUTER.z1 - OUTER.r];
const STEP = 3;
const D = Math.PI / 180;

/** Ring centreline point at the middle of a corner (for corner crossings). */
const cornerMid = (c: V2, deg: number): V2 => [c[0] + Math.cos(deg * D) * RING.r, c[1] + Math.sin(deg * D) * RING.r];

export const ROTONDA: RoadPlan = {
    id: 'rotonda',
    name: 'Rotonda',
    summary: 'Plaza as a roundabout island; one-way ring with four radials; merges and diverges only, no crossing turns.',
    bounds: PLAN_BOUNDS,
    laneWidth: LANE,
    roads: [
        {
            // SE -> NE -> NW -> SW: north (-z) on the east side = counter-clockwise from above
            id: 'ring', closed: true, cornerRadius: RING.r, lanes: [1, 0], width: 2 * RING_HALF, rank: 2, speed: 11,
            points: [[RING.x1, RING.z1], [RING.x1, RING.z0], [RING.x0, RING.z0], [RING.x0, RING.z1]],
        },
        { id: 'south', points: [[CX, RING.z1], [CX, Z1]], lanes: [1, 1], rank: 1 },
        { id: 'north', points: [[CX, RING.z0], [CX, BACK_Z]], lanes: [1, 1], rank: 1 },
        { id: 'west', points: [[RING.x0, CZ], [X0, CZ]], lanes: [1, 1], rank: 1 },
        { id: 'east', points: [[RING.x1, CZ], [X1, CZ]], lanes: [1, 1], rank: 1 },
        { id: 'backRoad', points: [[X0, BACK_Z], [X1, BACK_Z]], lanes: [1, 1], rank: 2 },
    ],
    blocks: [
        {
            id: 'island', kind: 'plaza', cornerRadius: ISLAND.r, sidewalk: 12,
            outline: [[ISLAND.x0, ISLAND.z0], [ISLAND.x1, ISLAND.z0], [ISLAND.x1, ISLAND.z1], [ISLAND.x0, ISLAND.z1]],
        },
        {
            id: 'nw', kind: 'urban', cornerRadius: 6, sidewalk: SIDEWALK,
            outline: [
                [DETAIL.x0, BACK_Z + LANE], [CX - RADIAL_HALF, BACK_Z + LANE], [CX - RADIAL_HALF, OUTER.z0],
                ...arc(C_NW, OUTER.r, -90 * D, -180 * D, STEP),
                [OUTER.x0, CZ - RADIAL_HALF], [DETAIL.x0, CZ - RADIAL_HALF],
            ],
        },
        {
            id: 'ne', kind: 'urban', cornerRadius: 6, sidewalk: SIDEWALK,
            outline: [
                [CX + RADIAL_HALF, BACK_Z + LANE], [DETAIL.x1, BACK_Z + LANE], [DETAIL.x1, CZ - RADIAL_HALF],
                [OUTER.x1, CZ - RADIAL_HALF], ...arc(C_NE, OUTER.r, 0, -90 * D, STEP), [CX + RADIAL_HALF, OUTER.z0],
            ],
        },
        {
            id: 'se', kind: 'urban', cornerRadius: 6, sidewalk: SIDEWALK,
            outline: [
                [CX + RADIAL_HALF, OUTER.z1], ...arc(C_SE, OUTER.r, 90 * D, 0, STEP), [OUTER.x1, CZ + RADIAL_HALF],
                [DETAIL.x1, CZ + RADIAL_HALF], [DETAIL.x1, DETAIL.z1], [CX + RADIAL_HALF, DETAIL.z1],
            ],
        },
        {
            id: 'sw', kind: 'urban', cornerRadius: 6, sidewalk: SIDEWALK,
            outline: [
                [DETAIL.x0, CZ + RADIAL_HALF], [OUTER.x0, CZ + RADIAL_HALF], ...arc(C_SW, OUTER.r, 180 * D, 90 * D, STEP),
                [CX - RADIAL_HALF, OUTER.z1], [CX - RADIAL_HALF, DETAIL.z1], [DETAIL.x0, DETAIL.z1],
            ],
        },
        {
            id: 'back', kind: 'urban', cornerRadius: 6, sidewalk: SIDEWALK,
            outline: [[DETAIL.x0, -170], [DETAIL.x1, -170], [DETAIL.x1, BACK_Z - LANE], [DETAIL.x0, BACK_Z - LANE]],
        },
    ],
    crossings: [
        { id: 'south', road: 'south', at: [CX, OUTER.z1 + 24] },
        { id: 'west', road: 'west', at: [OUTER.x0 - 24, CZ] },
        { id: 'east', road: 'east', at: [OUTER.x1 + 24, CZ] },
        { id: 'ring-nw', road: 'ring', at: cornerMid(C_NW, -135) },
        { id: 'ring-ne', road: 'ring', at: cornerMid(C_NE, -45) },
        { id: 'ring-se', road: 'ring', at: cornerMid(C_SE, 45) },
        { id: 'ring-sw', road: 'ring', at: cornerMid(C_SW, 135) },
    ],
    buildings: [
        { model: 'env_bld_civic_normal', pos: [CX, -121.5] },
        { model: 'env_bld_commercial_normal', pos: [85, -115] },
        { model: 'env_bld_apartment_normal', pos: [-100, -45] },
        { model: 'env_bld_mixeduse_normal', pos: [95, -35] },
        { model: 'env_bld_residential_normal', pos: [110, -60] },
        { model: 'env_scaffolding_large', pos: [85, 25] },
    ],
};
