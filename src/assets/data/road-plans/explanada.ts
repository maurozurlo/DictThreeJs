/**
 * Variant C — "Explanada": the plaza opens onto a pedestrian esplanade toward the camera; cars
 * are pushed to the flanks and the back.
 *
 * - No street in front of the plaza: plaza + esplanade are one paved block running under the
 *   camera — the foreground belongs to citizens (and protests).
 * - Two-way back avenue (2+2, narrow refuge median) carries the through traffic left-right.
 * - One-way flank streets (2 lanes each): west southbound toward the camera, east northbound
 *   away from it — a U-shaped circulation around three sides of the plaza.
 */
import { rect } from '../../../Traffic/Geometry.ts';
import type { RoadPlan } from '../../../Traffic/RoadPlan.ts';
import { DETAIL, LANE, PLAN_BOUNDS, PLAZA_CENTRE, SIDEWALK } from './common.ts';

const [CX, CZ] = PLAZA_CENTRE;
const KERB = { x0: -44.75, x1: 53.05, z0: -37.65 };
const BACK_HALF = 15.5;                    // 2+2 lanes + 3 u refuge
const BACK_Z = KERB.z0 - BACK_HALF;        // -53.15
const WEST_X = KERB.x0 - LANE;             // -51.75 (2 one-way lanes = 14 u)
const EAST_X = KERB.x1 + LANE;             // 60.05
const [X0] = PLAN_BOUNDS.min;
const [X1, Z1] = PLAN_BOUNDS.max;
const LOOP_INSET = SIDEWALK / 2;

export const EXPLANADA: RoadPlan = {
    id: 'explanada',
    name: 'Explanada',
    summary: 'Pedestrian esplanade in front of the plaza; through traffic on a back avenue, one-way flank streets.',
    bounds: PLAN_BOUNDS,
    laneWidth: LANE,
    roads: [
        { id: 'back', points: [[X0, BACK_Z], [X1, BACK_Z]], lanes: [2, 2], median: 3, rank: 3, speed: 14 },
        { id: 'west', points: [[WEST_X, BACK_Z], [WEST_X, Z1]], lanes: [2, 0], rank: 1 },
        { id: 'east', points: [[EAST_X, Z1], [EAST_X, BACK_Z]], lanes: [2, 0], rank: 1 },
    ],
    blocks: [
        { id: 'esplanade', kind: 'esplanade', outline: rect(KERB.x0, KERB.z0, KERB.x1, DETAIL.z1), cornerRadius: 6, sidewalk: SIDEWALK },
        { id: 'westBlock', kind: 'urban', outline: rect(DETAIL.x0, KERB.z0, WEST_X - LANE, DETAIL.z1), cornerRadius: 6, sidewalk: SIDEWALK },
        { id: 'eastBlock', kind: 'urban', outline: rect(EAST_X + LANE, KERB.z0, DETAIL.x1, DETAIL.z1), cornerRadius: 6, sidewalk: SIDEWALK },
        { id: 'back', kind: 'urban', outline: rect(DETAIL.x0, DETAIL.z0, DETAIL.x1, BACK_Z - BACK_HALF), cornerRadius: 6, sidewalk: SIDEWALK },
    ],
    crossings: [
        { id: 'west-mid', road: 'west', at: [WEST_X, CZ] },
        { id: 'west-front', road: 'west', at: [WEST_X, 45] },
        { id: 'east-mid', road: 'east', at: [EAST_X, CZ] },
        { id: 'east-front', road: 'east', at: [EAST_X, 45] },
        { id: 'back-mid', road: 'back', at: [CX, BACK_Z] },
        { id: 'back-w', road: 'back', at: [-110, BACK_Z] },
        { id: 'back-e', road: 'back', at: [120, BACK_Z] },
    ],
    walkways: [
        // promenades across the esplanade, loop side to loop side
        { id: 'promenade-near', points: [[KERB.x0 + LOOP_INSET, 30], [KERB.x1 - LOOP_INSET, 30]] },
        { id: 'promenade-far', points: [[KERB.x0 + LOOP_INSET, 55], [KERB.x1 - LOOP_INSET, 55]] },
    ],
    buildings: [
        { model: 'env_bld_civic_normal', pos: [CX, -92] },
        { model: 'env_bld_commercial_normal', pos: [-90, -86] },
        { model: 'env_bld_apartment_normal', pos: [-84, CZ] },
        { model: 'env_scaffolding_large', pos: [-106, CZ] },
        { model: 'env_bld_mixeduse_normal', pos: [85, -16] },
        { model: 'env_bld_residential_normal', pos: [82, 9] },
    ],
};
