/**
 * Variant A — "Avenida": two-way grid around the plaza with a ceremonial boulevard behind it.
 *
 * - Back boulevard (2+2 lanes, planted median) runs left-right between the plaza and the
 *   ministry row — the parade route, fully in frame.
 * - Front street (1+1) between camera and plaza; side streets (1+1) at both plaza flanks, T-ing
 *   into the boulevard and crossing the front street in 4-way junctions.
 * - Through traffic enters/leaves at the frame edges; zebras at every plaza mid-side.
 */
import { rect } from '../../../Traffic/Geometry.ts';
import type { PropDef, RoadPlan } from '../../../Traffic/RoadPlan.ts';
import { STREET_ASPHALT_Y as STREET_ASPHALT } from '../../../Constants/Traffic.ts';
import { DETAIL, LANE, PLAN_BOUNDS, PLAZA_CENTRE, SIDEWALK } from './common.ts';

const [CX, CZ] = PLAZA_CENTRE;
const KERB = { x0: -44.75, x1: 53.05, z0: -37.65, z1: 30.77 }; // plaza + 8 u sidewalk
const FRONT_Z = KERB.z1 + LANE;            // 37.77
const BLVD_HALF = 16;                      // 2+2 lanes + 4 u median
const BLVD_Z = KERB.z0 - BLVD_HALF;        // -53.65
const WEST_X = KERB.x0 - LANE;             // -51.75
const EAST_X = KERB.x1 + LANE;             // 60.05
const [X0] = PLAN_BOUNDS.min;
/** Kerb corner radius — round enough that sidewalk loops turn smoothly (loop radius 5). */
const CORNER = 9;
const [X1, Z1] = PLAN_BOUNDS.max;
const TREE_TIERS = ['env_tree_poor', 'env_tree_medium', 'env_tree_rich'];
const TREE_ROT: [number, number, number, number] = [0, 0.2281, 0, 0.973638];
/** Quarter turn about Y: a barricade's long side along an east-west road. */
const ALONG_ROAD: [number, number, number, number] = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

export const AVENIDA: RoadPlan = {
    id: 'avenida',
    name: 'Avenida',
    summary: 'Two-way grid; a planted boulevard behind the plaza is the parade route; 4-way junctions at the front corners.',
    bounds: PLAN_BOUNDS,
    laneWidth: LANE,
    roads: [
        { id: 'boulevard', points: [[X0, BLVD_Z], [X1, BLVD_Z]], lanes: [2, 2], median: 4, rank: 3, speed: 15 },
        { id: 'front', points: [[X0, FRONT_Z], [X1, FRONT_Z]], lanes: [1, 1], rank: 2 },
        { id: 'west', points: [[WEST_X, BLVD_Z], [WEST_X, Z1]], lanes: [1, 1], rank: 1 },
        { id: 'east', points: [[EAST_X, BLVD_Z], [EAST_X, Z1]], lanes: [1, 1], rank: 1 },
    ],
    blocks: [
        { id: 'plaza', kind: 'plaza', outline: rect(KERB.x0, KERB.z0, KERB.x1, KERB.z1), cornerRadius: CORNER, sidewalk: SIDEWALK, pedWeight: 5 },
        { id: 'westMid', kind: 'urban', outline: rect(DETAIL.x0, KERB.z0, WEST_X - LANE, KERB.z1), cornerRadius: CORNER, sidewalk: SIDEWALK, pedWeight: 2 },
        { id: 'eastMid', kind: 'urban', outline: rect(EAST_X + LANE, KERB.z0, DETAIL.x1, KERB.z1), cornerRadius: CORNER, sidewalk: SIDEWALK, pedWeight: 2 },
        { id: 'back', kind: 'urban', outline: rect(DETAIL.x0, DETAIL.z0, DETAIL.x1, BLVD_Z - BLVD_HALF), cornerRadius: CORNER, sidewalk: SIDEWALK, pedWeight: 2 },
        { id: 'frontW', kind: 'urban', outline: rect(DETAIL.x0, FRONT_Z + LANE, WEST_X - LANE, DETAIL.z1), cornerRadius: CORNER, sidewalk: SIDEWALK, pedWeight: 0.3 },
        { id: 'frontC', kind: 'park', outline: rect(KERB.x0, FRONT_Z + LANE, KERB.x1, DETAIL.z1), cornerRadius: CORNER, sidewalk: SIDEWALK },
        { id: 'frontE', kind: 'urban', outline: rect(EAST_X + LANE, FRONT_Z + LANE, DETAIL.x1, DETAIL.z1), cornerRadius: CORNER, sidewalk: SIDEWALK, pedWeight: 0.3 },
    ],
    crossings: [
        { id: 'west-mid', road: 'west', at: [WEST_X, CZ] },
        { id: 'east-mid', road: 'east', at: [EAST_X, CZ] },
        { id: 'front-mid', road: 'front', at: [CX, FRONT_Z] },
        { id: 'blvd-mid', road: 'boulevard', at: [CX, BLVD_Z] },
        { id: 'blvd-w', road: 'boulevard', at: [-110, BLVD_Z] },
        { id: 'blvd-e', road: 'boulevard', at: [120, BLVD_Z] },
        { id: 'front-w', road: 'front', at: [-110, FRONT_Z] },
        { id: 'front-e', road: 'front', at: [120, FRONT_Z] },
    ],
    // the plaza never moved, so the old zone_protest rectangle still applies
    zones: [{ id: 'protest', min: [-29.34, 4.5], max: [1.38, 17.06] }],
    // Six original slots kept, then the fill pass (2026-11-12): a continuous backdrop behind the
    // boulevard (front rank flush at z ≈ -79, second rank behind) and the side-block frontages.
    buildings: [
        { model: 'env_bld_civic_normal', pos: [CX, -93.85], y: 13.3443 },
        { model: 'env_bld_commercial_normal', pos: [85, -88], y: 7.6798 },
        { model: 'env_bld_apartment_normal', pos: [-84, CZ], y: 12.1701 },
        { model: 'env_scaffolding_large', pos: [-106, CZ], y: 11.0597 },
        { model: 'env_bld_mixeduse_normal', pos: [85, -16], y: 8.5841 },
        { model: 'env_bld_residential_normal', pos: [83, 9], y: 3.8065 },
        { model: 'env_bld_terrace_normal', pos: [-115, -89.65], y: 10.5 },
        { model: 'env_bld_apartment_normal', pos: [-43, -104.7], y: 12.1701 },
        { model: 'env_bld_mixeduse_normal', pos: [44, -90.35], y: 8.5841 },
        { model: 'env_bld_mixeduse_normal', pos: [120.1, -90.35], y: 8.5841 },
        { model: 'env_bld_commercial_normal', pos: [-137, -111.5], y: 7.6798 },
        { model: 'env_bld_civic_normal', pos: [-84.5, -118], y: 13.3443 },
        { model: 'env_bld_commercial_normal', pos: [0, -120], y: 7.6798 },
        { model: 'env_bld_mixeduse_normal', pos: [38, -118], y: 8.5841 },
        { model: 'env_bld_terrace_normal', pos: [126, -114], y: 10.5 },
        { model: 'env_bld_residential_normal', pos: [60, -120], y: 3.8065 },
        { model: 'env_scaffolding_large', pos: [71, -120], y: 11.0597 },
        { model: 'env_bld_commercial_normal', pos: [-139, -19], y: 7.6798 },
        { model: 'env_bld_civic_normal', pos: [-138, 6.5], y: 13.3443 },
        { model: 'env_bld_commercial_normal', pos: [125, -19], y: 7.6798 },
        { model: 'env_bld_civic_normal', pos: [124, 6.5], y: 13.3443 },
        { model: 'env_bld_residential_normal', pos: [160, 8], y: 3.8065 },
        { model: 'env_scaffolding_large', pos: [172, -10], y: 11.0597 },
    ],
    // Props the old layout had on what is now road, re-homed for Avenida.
    props: [
        // boulevard median trees + side-block sidewalk trees (one spot per tier set, as before)
        ...([[-140, BLVD_Z], [-80, BLVD_Z], [30, BLVD_Z], [160, BLVD_Z], [-63, 18], [71, 18], [-20, -73.4]] as const).map(
            ([x, z]): PropDef => ({ models: TREE_TIERS, pos: [x, z], y: 9.1004, rot: TREE_ROT }),
        ),
        // unrest barricades (security 1-3) laid along an outer boulevard lane each: that lane swerves
        // into the inner one (a crosswise 11.4 u barricade would close the whole carriageway)
        { models: ['env_streetbarricade_medium'], pos: [-85, BLVD_Z + 12.5], y: STREET_ASPHALT + 1.632, rot: ALONG_ROAD },
        { models: ['env_streetbarricade_medium'], pos: [95, BLVD_Z - 12.5], y: STREET_ASPHALT + 1.632, rot: ALONG_ROAD },
        // militarised searchlight tower (security 8-10) behind the ministry row — its 43 u mast
        // rises over the rooftops. On the boulevard its 14 u base squeezed both carriageways to one
        // lane next to a junction and jammed the street for minutes.
        { models: ['env_searchlight_large'], pos: [-20, -142], y: 21.3983 },
        // the billboard and graffiti followed the buildings they hang on
        { models: ['env_billboard'], pos: [7.43, -82.67], y: 14.1557, rot: [0, -0.707107, -0.707107, 0] },
        { models: ['env_graffiti_decal'], pos: [85.7, -4.1], y: 10.5084 },
        // potholes (infrastructure 1-3) back down onto the new asphalt
        { models: ['env_pothole_decal'], pos: [56, -9], y: STREET_ASPHALT + 0.01 },
        { models: ['env_pothole_decal'], pos: [27.4, -41], y: STREET_ASPHALT + 0.01 },
        { models: ['env_pothole_decal'], pos: [-47, 2.3], y: STREET_ASPHALT + 0.01 },
    ],
    replacesIpl: [
        8, // env_roads — the road surface is generated from this plan
        1, 2, 5, 6, 11, 32, 59, 60, 61, 62, 63, // buildings (now `buildings` above)
        12, 13, 14, 15, 16, 17, 18, 64, 65, 66, 67, 68, 69, 70, 99, 100, 101, 102, 103, 104, 105, // trees
        22, 27, // electric poles that would stand in the side streets
        31, 39, 40, 41, 42, 43, 44, 53, // billboard, searchlight, graffiti, potholes, barricades
    ],
};
