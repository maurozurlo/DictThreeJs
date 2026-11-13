/**
 * Debug placement editor — pure helpers (no React, no three).
 *
 * In debug mode the street's placed objects can be dragged / turned with a gizmo. Each edit is
 * keyed by the placement's SOURCE entry (an IPL line, a road-plan building, a road-plan prop spot)
 * rather than its instance id, so every tier variant standing at one prop spot moves together and
 * the exported JSON maps straight back onto the data file that has to change.
 */
import type { ResolvedPlacement } from '../types/WorldLayout';

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

/**
 * Where a street placement is defined in source data. IPL tier variants (poor / normal / rich
 * bench, lamp, planter…) are separate lines at the same pos + rot: they form one 'ipl' spot,
 * keyed by its lowest id, so they move together.
 */
export type PlacementSource =
    | { kind: 'ipl'; key: string; id: number; ids: number[]; models: string[]; pos: Vec3; rot: Quat }
    | { kind: 'plan.building'; key: string; index: number; models: string[]; pos: Vec3; rot: Quat }
    | { kind: 'plan.prop'; key: string; index: number; models: string[]; pos: Vec3; rot: Quat };

/** An edited placement — absolute world transform that replaces the source pos/rot. */
export interface PlacementEdit {
    pos: Vec3;
    rot: Quat;
}

/** Edit key for an IPL instance. */
export const iplKey = (id: number): string => `ipl:${id}`;
/** Edit key for a road-plan building slot. */
export const buildingKey = (index: number): string => `building:${index}`;
/** Edit key for a road-plan prop spot (all its tier models share it). */
export const propKey = (index: number): string => `prop:${index}`;

/**
 * Overrides pos/rot of every placement whose source has an edit.
 *
 * @param placements resolved, visible placements
 * @param edits      edits keyed by source key
 * @param sourceOf   instance id -> source (undefined = not editable / unknown)
 * @returns the same array when there are no edits, otherwise a new array
 */
export function applyPlacementEdits(
    placements: ResolvedPlacement[],
    edits: Readonly<Record<string, PlacementEdit>>,
    sourceOf: (instanceId: number) => PlacementSource | undefined,
): ResolvedPlacement[] {
    if (Object.keys(edits).length === 0) return placements;
    return placements.map((p) => {
        const src = sourceOf(p.instanceId);
        const e = src ? edits[src.key] : undefined;
        return e ? { ...p, pos: e.pos, rot: e.rot } : p;
    });
}

/** Yaw (rotation about +Y) of a quaternion, in degrees. */
export function yawDegOf(q: Quat): number {
    const [x, y, z, w] = q;
    return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI;
}

const round = (v: number, places: number): number => {
    const f = 10 ** places;
    const r = Math.round(v * f) / f;
    return Object.is(r, -0) ? 0 : r;
};
const roundVec = <T extends number[]>(v: T, places: number): T => v.map((n) => round(n, places)) as T;

/** Signed smallest angle difference b - a in degrees, in (-180, 180]. */
function deltaDeg(a: number, b: number): number {
    let d = (b - a) % 360;
    if (d <= -180) d += 360;
    if (d > 180) d -= 360;
    return d;
}

/** True when an edit differs from its source by more than rounding noise. */
export function isEffectiveEdit(src: PlacementSource, e: PlacementEdit): boolean {
    const moved = e.pos.some((v, i) => Math.abs(v - src.pos[i]) > 5e-4);
    const turned = e.rot.some((v, i) => Math.abs(v - src.rot[i]) > 5e-5);
    return moved || turned;
}

/** One exported edit — the source reference plus before / after transforms. */
export interface PlacementEditRecord {
    key: string;
    source: PlacementSource['kind'];
    /** Lowest IPL instance id of the spot (source 'ipl'). */
    id?: number;
    /** Every IPL line at the spot — all need the new pos / rot (source 'ipl'). */
    ids?: number[];
    /** Index into the road plan's `buildings` / `props` array (source 'plan.*'). */
    index?: number;
    models: string[];
    from: { pos: Vec3; rot: Quat; yawDeg: number };
    to: { pos: Vec3; rot: Quat; yawDeg: number };
    delta: { pos: Vec3; yawDeg: number };
}

/** The file the debug editor downloads (D key). */
export interface PlacementEditExport {
    kind: 'dict-three/street-placement-edits';
    version: 1;
    savedAt: string;
    plan: string;
    edits: PlacementEditRecord[];
}

/**
 * Builds the shareable JSON payload. Edits that ended back on the source transform are dropped.
 *
 * @param edits     edits keyed by source key
 * @param sourceFor source key -> source entry
 * @param planId    active road plan id
 * @param savedAt   ISO timestamp (injected for deterministic tests)
 */
export function buildPlacementEditExport(
    edits: Readonly<Record<string, PlacementEdit>>,
    sourceFor: (key: string) => PlacementSource | undefined,
    planId: string,
    savedAt: string,
): PlacementEditExport {
    const records: PlacementEditRecord[] = [];
    for (const [key, e] of Object.entries(edits)) {
        const src = sourceFor(key);
        if (!src || !isEffectiveEdit(src, e)) continue;
        const fromYaw = yawDegOf(src.rot);
        const toYaw = yawDegOf(e.rot);
        records.push({
            key,
            source: src.kind,
            ...(src.kind === 'ipl' ? { id: src.id, ids: src.ids } : { index: src.index }),
            models: src.models,
            from: { pos: roundVec(src.pos, 4), rot: roundVec(src.rot, 6), yawDeg: round(fromYaw, 2) },
            to: { pos: roundVec(e.pos, 4), rot: roundVec(e.rot, 6), yawDeg: round(toYaw, 2) },
            delta: {
                pos: roundVec([e.pos[0] - src.pos[0], e.pos[1] - src.pos[1], e.pos[2] - src.pos[2]], 4),
                yawDeg: round(deltaDeg(fromYaw, toYaw), 2),
            },
        });
    }
    records.sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
    return { kind: 'dict-three/street-placement-edits', version: 1, savedAt, plan: planId, edits: records };
}

/** `street-edits-20261113-142501.json` for a given date. */
export function placementEditFileName(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `street-edits-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}
