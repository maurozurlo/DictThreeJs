/**
 * Conflict zones — where two drivable paths come close enough for cars to touch, and where car
 * paths run through a zebra crossing (ADR-0014).
 *
 * Found geometrically (sample-vs-sample distance < car width + margin), so merges, diverges,
 * crossing turns and swerves around road props are all handled by one mechanism. At runtime a car
 * must hold its side of a zone before its body may enter it; holders on the other side exclude it.
 *
 * Build-time; pure.
 */
import type { RoadNetwork, LanePath } from './RoadBuilder.ts';

/**
 * Reference car footprint used to find zones (a sedan). A zone side is the interval of CENTRE
 * positions on a path at which a reference car would overlap a reference car somewhere on the
 * other side; longer cars extend it at runtime by (halfLen - REF_HALF_LEN) at both ends.
 */
export const REF_HALF_LEN = 5.4;
export const REF_HALF_WIDTH = 2.5;
/** Clearance added around both footprints when testing for conflict. */
const FOOTPRINT_MARGIN = 0.5;
/** Extra margin (u) a car body keeps from a zebra band. */
const CROSSING_CLEAR = 1.0;
/** Sample index gap that splits one path pair into two separate zones. */
const CLUSTER_GAP = 4;

/** SAT test: do two oriented rectangles (centre, unit heading, half extents) overlap? */
function obbOverlap(
    ax: number, az: number, afx: number, afz: number,
    bx: number, bz: number, bfx: number, bfz: number,
    hl: number, hw: number,
): boolean {
    const dx = bx - ax, dz = bz - az;
    const axes = [afx, afz, -afz, afx, bfx, bfz, -bfz, bfx];
    for (let k = 0; k < 8; k += 2) {
        const lx = axes[k], lz = axes[k + 1];
        const ea = hl * Math.abs(afx * lx + afz * lz) + hw * Math.abs(-afz * lx + afx * lz);
        const eb = hl * Math.abs(bfx * lx + bfz * lz) + hw * Math.abs(-bfz * lx + bfx * lz);
        if (Math.abs(dx * lx + dz * lz) > ea + eb) return false;
    }
    return true;
}

/** Unit tangent of a path at sample i. */
function tangent(p: LanePath, i: number): [number, number] {
    const pts = p.line.pts;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

/** One side of a car-car zone: an arc-length interval of centre positions on a path. */
export interface ZoneSide {
    path: number;
    s0: number;
    s1: number;
}

export interface CarZone {
    id: number;
    sides: [ZoneSide, ZoneSide];
}

/** A car path's pass through a zebra; peds on that crossing exclude cars from [s0, s1]. */
export interface CrossZone {
    id: number;
    crossing: number;
    path: number;
    s0: number;
    s1: number;
}

/** Zone entry on a path, sorted by s0 in {@link Conflicts.byPath}. */
export interface PathZoneRef {
    kind: 'car' | 'cross';
    zone: number;
    /** Which side of a car zone this path is (always 0 for cross zones). */
    side: 0 | 1;
    s0: number;
    s1: number;
}

export interface Conflicts {
    carZones: CarZone[];
    crossZones: CrossZone[];
    byPath: PathZoneRef[][];
}

/**
 * Paths within two hops of each other along the graph (lane → connector → lane) are ordered by
 * car-following on a shared route; footprints meeting there are not crossing conflicts.
 */
function nearInGraph(paths: LanePath[], a: LanePath, b: LanePath): boolean {
    const within = (x: LanePath, y: LanePath) => x.next.includes(y.id) || x.next.some((n) => paths[n].next.includes(y.id));
    return within(a, b) || within(b, a);
}

export function buildConflicts(net: RoadNetwork): Conflicts {
    const { paths } = net;
    const byPath: PathZoneRef[][] = paths.map(() => []);
    const tangents = paths.map((p) => p.line.pts.map((_, i) => tangent(p, i)));
    const hl = REF_HALF_LEN + FOOTPRINT_MARGIN / 2, hw = REF_HALF_WIDTH + FOOTPRINT_MARGIN / 2;
    const reach = 2 * Math.hypot(hl, hw);

    // ---- car vs car: hash every sample, SAT-test footprints of nearby samples ---------------
    const cell = reach;
    const grid = new Map<string, Array<[number, number]>>();
    const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    for (const p of paths) {
        p.line.pts.forEach(([x, z], i) => {
            const k = key(x, z);
            const list = grid.get(k);
            if (list) list.push([p.id, i]); else grid.set(k, [[p.id, i]]);
        });
    }
    const pairs = new Map<string, Array<[number, number]>>(); // "P,Q" -> [iP, jQ]
    const d2 = reach * reach;
    const near = new Map<string, boolean>();
    for (const p of paths) {
        p.line.pts.forEach(([x, z], i) => {
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            const [fx, fz] = tangents[p.id][i];
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
                for (let gz = cz - 1; gz <= cz + 1; gz++) {
                    for (const [qId, j] of grid.get(`${gx},${gz}`) ?? []) {
                        if (qId <= p.id) continue;
                        const q = paths[qId];
                        const nk = `${p.id},${qId}`;
                        let skip = near.get(nk);
                        if (skip === undefined) { skip = nearInGraph(paths, p, q); near.set(nk, skip); }
                        if (skip) continue;
                        const [qx, qz] = q.line.pts[j];
                        if ((qx - x) ** 2 + (qz - z) ** 2 >= d2) continue;
                        const [gfx, gfz] = tangents[qId][j];
                        if (!obbOverlap(x, z, fx, fz, qx, qz, gfx, gfz, hl, hw)) continue;
                        const k = `${p.id},${qId}`;
                        const list = pairs.get(k);
                        if (list) list.push([i, j]); else pairs.set(k, [[i, j]]);
                    }
                }
            }
        });
    }

    const carZones: CarZone[] = [];
    for (const [k, hits] of pairs) {
        const [pId, qId] = k.split(',').map(Number);
        const P = paths[pId], Q = paths[qId];
        hits.sort((a, b) => a[0] - b[0]);
        let cluster: Array<[number, number]> = [];
        const flush = () => {
            if (cluster.length === 0) return;
            const is = cluster.map((c) => c[0]), js = cluster.map((c) => c[1]);
            const id = carZones.length;
            const side = (path: LanePath, idx: number[]): ZoneSide => ({
                path: path.id,
                s0: Math.max(0, path.line.cum[Math.min(...idx)] - 0.75),
                s1: Math.min(path.line.length, path.line.cum[Math.max(...idx)] + 0.75),
            });
            const a = side(P, is), b = side(Q, js);
            carZones.push({ id, sides: [a, b] });
            byPath[P.id].push({ kind: 'car', zone: id, side: 0, s0: a.s0, s1: a.s1 });
            byPath[Q.id].push({ kind: 'car', zone: id, side: 1, s0: b.s0, s1: b.s1 });
            cluster = [];
        };
        for (const h of hits) {
            if (cluster.length && h[0] - cluster[cluster.length - 1][0] > CLUSTER_GAP) flush();
            cluster.push(h);
        }
        flush();
    }

    // ---- car vs zebra ------------------------------------------------------------------------
    const crossZones: CrossZone[] = [];
    net.crossings.forEach((c, ci) => {
        const kerbHalf = Math.hypot(c.line.pts[2][0] - c.line.pts[1][0], c.line.pts[2][1] - c.line.pts[1][1]) / 2;
        for (const p of paths) {
            let s0 = Infinity, s1 = -Infinity;
            p.line.pts.forEach(([x, z], i) => {
                const dx = x - c.centre[0], dz = z - c.centre[1];
                const a = dx * c.along[0] + dz * c.along[1];
                const w = dx * c.across[0] + dz * c.across[1];
                if (Math.abs(a) < c.halfBand + CROSSING_CLEAR && Math.abs(w) < kerbHalf) {
                    s0 = Math.min(s0, p.line.cum[i]);
                    s1 = Math.max(s1, p.line.cum[i]);
                }
            });
            if (s0 > s1) continue;
            const id = crossZones.length;
            const z = { id, crossing: ci, path: p.id, s0: Math.max(0, s0 - 0.75), s1: Math.min(p.line.length, s1 + 0.75) };
            crossZones.push(z);
            byPath[p.id].push({ kind: 'cross', zone: id, side: 0, s0: z.s0, s1: z.s1 });
        }
    });

    for (const list of byPath) list.sort((a, b) => a.s0 - b.s0);
    return { carZones, crossZones, byPath };
}
