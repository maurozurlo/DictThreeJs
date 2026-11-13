/**
 * Street traffic simulation tuning (ADR-0014). World units: the street is drawn ~3.7× oversized,
 * so 1 m (metric) ≈ 3.7 u. Cosmetic only — no gameplay reads these.
 */

/** Fixed simulation step (s). The renderer accumulates frame time and steps in these quanta. */
export const SIM_DT = 1 / 30;
/** Longest frame delta the driver will try to catch up on (tab switches, hitches). */
export const SIM_MAX_CATCHUP_S = 0.25;
/** Seconds simulated (fast) before the street is first shown, so traffic is already flowing. */
export const SIM_WARMUP_S = 30;

// ---- cars ------------------------------------------------------------------------------------

/** IDM maximum acceleration (u/s²). */
export const CAR_ACCEL = 6;
/** IDM comfortable braking (u/s²); also sets how early a car must claim a conflict zone. */
export const CAR_COMFORT_DECEL = 8;
/** Hard braking cap (u/s²). */
export const CAR_MAX_DECEL = 30;
/** Bumper-to-bumper gap at standstill (u). */
export const CAR_JAM_GAP = 3;
/** Desired time headway to the leader (s). */
export const CAR_HEADWAY_S = 1.1;
/** A car claims a zone this far (u) beyond its comfortable stopping distance. */
export const CAR_CLAIM_MARGIN = 5;
/** Yield to a higher-priority car that will reach the same zone within this many seconds. */
export const CAR_GAP_ACCEPT_S = 2.0;
/** Priority weight of one road rank level; waiting time (CAR_AGING_PER_S) trades against it. */
export const CAR_RANK_WEIGHT = 5;
/** Priority gained per second spent waiting — stops side roads starving. */
export const CAR_AGING_PER_S = 0.8;
/** After waiting this long a car stops yielding to peds who are only WAITING at a zebra. */
export const CAR_ZEBRA_PATIENCE_S = 7;
/** A car holding a zone it has not entered yet gives it back after standing this long. */
export const CAR_IDLE_RELEASE_S = 1.0;
/** Mean seconds between spawns on each source lane. */
export const CAR_SPAWN_MEAN_S = 7;
/** Cap on simultaneous cars. */
export const CAR_MAX = 16;
/** Route choice weights at a junction, by turn type. */
export const CAR_TURN_WEIGHT = { straight: 0.5, right: 0.3, left: 0.2 } as const;
/** Lateral acceleration a car accepts on curves (u/s²) — lane speed envelopes. */
export const CAR_LATERAL_ACCEL = 5;
/** Axle position as a fraction of half-length — heading follows the rear→front axle chord. */
export const CAR_AXLE_FRACTION = 0.7;
/** Cars brake for any ped inside this box ahead of the bumper (safety net, u). */
export const CAR_PED_SENSOR = 5;

// ---- peds ------------------------------------------------------------------------------------

/** Ped body radius (u) — ~0.3 m. */
export const PED_RADIUS = 1.1;
/** Lateral clearance peds want when passing each other (u). */
export const PED_PERSONAL = 2.6;
/** How far ahead peds react to others (u). */
export const PED_LOOKAHEAD = 7;
/** Max sidestep speed (u/s). */
export const PED_LATERAL_SPEED = 2.2;
/** Walking acceleration (u/s²). */
export const PED_ACCEL = 4;
/** Preferred walking speed range (u/s): 0.9–1.4 m/s. */
export const PED_SPEED_MIN = 0.9 * 3.7;
export const PED_SPEED_MAX = 1.4 * 3.7;
/** Chance to take a zebra / walkway when passing its loop link. */
export const PED_CROSS_CHANCE = 0.35;
export const PED_WALKWAY_CHANCE = 0.5;
/** Where a ped stops before the kerb while waiting for the zebra (u back from the kerb). */
export const PED_KERB_WAIT_BACK = 1.4;
/** Oncoming peds never slow below this fraction of their walk speed while sidestepping. */
export const PED_ONCOMING_MIN_SPEED = 0.35;
/** A ped boxed in on a sidewalk this long turns around. */
export const PED_STUCK_TURN_S = 2.5;
/** Max heading turn rate (rad/s) — keeps turns smooth. */
export const PED_TURN_RATE = 7;

// ---- street surface ------------------------------------------------------------------------

/** Sidewalk top (game Y) — flush with the env_plaza top (IPL y -0.1285), so the plaza is untouched. */
export const STREET_SIDEWALK_Y = -0.125;
/** Kerb drop from sidewalk to asphalt. */
export const STREET_KERB_HEIGHT = 0.25;
export const STREET_ASPHALT_Y = STREET_SIDEWALK_Y - STREET_KERB_HEIGHT;
/** World units per texture tile, matched to the old env_roads texel density. */
export const STREET_TILE = { asphalt: 10, sidewalk: 6.5, kerb: 6.5, lot: 10, park: 65, ground: 6.5 } as const;

/**
 * Props that stand ON the road, by model-name prefix: footprint half extents in the model's own
 * frame (ground-level vertices of the GLBs). Lanes bend around them — cars slow and weave.
 */
export const ROAD_OBSTACLE_FOOTPRINT: ReadonlyArray<{ prefix: string; hx: number; hz: number }> = [
    { prefix: 'env_streetbarricade', hx: 2.05, hz: 5.72 },
    { prefix: 'env_searchlight', hx: 7.13, hz: 7.13 },
];

/**
 * Street furniture peds steer around, by model-name prefix: the BASE's offset from the model pivot
 * (pivots are bbox centres; lamp and pole bases sit at one end) and its radius, measured from the
 * GLBs' lowest vertices. Overhead arms and crossbars don't count.
 */
export const PED_OBSTACLE_FOOTPRINT: ReadonlyArray<{ prefix: string; dx: number; dz: number; r: number }> = [
    { prefix: 'env_streetlight', dx: -2.18, dz: 0, r: 0.7 },
    { prefix: 'env_electricpole', dx: -10.02, dz: 0, r: 0.6 },
    { prefix: 'env_camera_pole', dx: 0, dz: 0, r: 0.8 },
    { prefix: 'env_tree', dx: 0.3, dz: 0.3, r: 1.7 },
    { prefix: 'env_bush', dx: 0, dz: 0, r: 1.5 },
    { prefix: 'env_planter', dx: 0, dz: 0, r: 2.0 },
    { prefix: 'env_parkbench', dx: 0, dz: 0.13, r: 1.6 },
    { prefix: 'env_trashcan', dx: 0, dz: 0, r: 1.0 },
    { prefix: 'env_guard_post', dx: 0, dz: -2.4, r: 4.5 },
    { prefix: 'env_searchlight', dx: 0, dz: 0, r: 7.2 },
];
