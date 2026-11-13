/**
 * Road plan — the single authored source for the street's road layout (ADR-0014).
 *
 * A plan names roads (centrelines + lane counts), blocks (kerb outlines + sidewalk width), zebra
 * crossings and optional pedestrian walkways. Everything else — lanes, junction connectors, conflict
 * zones, sidewalk loops, kerb/road meshes, markings — is DERIVED by RoadBuilder, so the drawn roads
 * and the traffic simulation can never disagree.
 *
 * Coordinates are game world units on the ground plane, `[x, z]` (see Geometry.ts).
 */
import type { V2 } from './Geometry.ts';

/** What a block's interior is, for meshing and ped routing. `median` = boulevard refuge island. */
export type BlockKind = 'plaza' | 'urban' | 'park' | 'esplanade' | 'median';

export interface RoadDef {
    id: string;
    /** Centreline, in the FORWARD direction of travel. Corners are filleted by `cornerRadius`. */
    points: V2[];
    closed?: boolean;
    cornerRadius?: number;
    /** [forward, backward] lane counts; backward 0 = one-way (lanes centred on the line). */
    lanes: [number, number];
    /** Central refuge width between the two directions (boulevards). */
    median?: number;
    /** Carriageway width override (default: lanes × laneWidth + median). */
    width?: number;
    /** Right-of-way rank at junctions — higher wins. Default 1. */
    rank?: number;
    /** Speed limit in world units/s. Default {@link DEFAULT_ROAD_SPEED}. */
    speed?: number;
}

export interface BlockDef {
    id: string;
    kind: BlockKind;
    /** Kerb line (outer edge of the sidewalk), any winding. */
    outline: V2[];
    cornerRadius: number;
    /** Sidewalk band width, measured inward from the kerb. */
    sidewalk: number;
    /** Relative share of walking citizens placed on this block's sidewalk loop. Default 1. */
    pedWeight?: number;
}

/** Named axis-aligned ground area (XZ), e.g. the protest square. */
export interface ZoneDef {
    id: string;
    min: V2;
    max: V2;
}

export interface CrossingDef {
    id: string;
    road: string;
    /** A point near the road centreline; the crossing runs perpendicular to the road there. */
    at: V2;
    /** Stripe band width along the road. Default 6. */
    width?: number;
}

/** Pedestrian-only path across open paving; both ends link to the nearest sidewalk loop. */
export interface WalkwayDef {
    id: string;
    points: V2[];
}

/** A building slot: the NORMAL-tier model name; poor/rich variants follow conditionStage. */
export interface BuildingDef {
    model: string;
    pos: V2;
    /** Placement Y (GLB pivots are bbox centres). */
    y?: number;
}

/**
 * A street-prop spot. Every model listed gets an instance here; each one's IDE visibleIf picks
 * which shows (e.g. the poor / medium / rich tree at one spot).
 */
export interface PropDef {
    models: string[];
    pos: V2;
    y: number;
    /** Quaternion [x, y, z, w]; identity when omitted. */
    rot?: [number, number, number, number];
}

export interface RoadPlan {
    id: string;
    name: string;
    summary: string;
    /** Lanes reaching these bounds are traffic sources / sinks (off-camera spawn and despawn). */
    bounds: { min: V2; max: V2 };
    laneWidth: number;
    roads: RoadDef[];
    blocks: BlockDef[];
    crossings: CrossingDef[];
    walkways?: WalkwayDef[];
    buildings?: BuildingDef[];
    props?: PropDef[];
    zones?: ZoneDef[];
    /** IPL instance ids this plan supersedes (old roads, buildings, props moved for this layout). */
    replacesIpl?: number[];
}

/** City-crawl car speed (world u/s) — the old CAR_SPEED_MPS 3.5 × VEHICLE_WORLD_SCALE 3.7. */
export const DEFAULT_ROAD_SPEED = 13;
