/**
 * Runtime path: an ArcPolyline packed into typed arrays for allocation-free sampling, plus a
 * curvature speed envelope for cars (ADR-0014).
 */
import type { ArcPolyline } from './Geometry.ts';

export interface RtPath {
    xs: Float64Array;
    zs: Float64Array;
    /** cum[i] = arc length at vertex i; closed paths have n + 1 entries (last = length). */
    cum: Float64Array;
    n: number;
    length: number;
    closed: boolean;
}

export function toRtPath(line: ArcPolyline): RtPath {
    const n = line.pts.length;
    const xs = new Float64Array(n), zs = new Float64Array(n);
    line.pts.forEach((p, i) => { xs[i] = p[0]; zs[i] = p[1]; });
    return { xs, zs, cum: Float64Array.from(line.cum), n, length: line.length, closed: line.closed };
}

/** Mutable sample target — reuse one per caller to stay allocation-free. */
export interface PathSample {
    x: number;
    z: number;
    /** unit tangent */
    tx: number;
    tz: number;
}

export const newSample = (): PathSample => ({ x: 0, z: 0, tx: 0, tz: 1 });

/** Samples position + tangent at arc length s (wrapped on closed paths, clamped on open ones). */
export function sampleRt(p: RtPath, s: number, out: PathSample): PathSample {
    const L = p.length;
    let d = p.closed ? ((s % L) + L) % L : s < 0 ? 0 : s > L ? L : s;
    const cum = p.cum;
    let lo = 0, hi = cum.length - 2;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= d) lo = mid; else hi = mid - 1;
    }
    const i = lo, j = (i + 1) % p.n;
    const seg = cum[i + 1] - cum[i];
    d -= cum[i];
    const t = seg > 1e-9 ? d / seg : 0;
    const dx = p.xs[j] - p.xs[i], dz = p.zs[j] - p.zs[i];
    out.x = p.xs[i] + dx * t;
    out.z = p.zs[i] + dz * t;
    const l = Math.hypot(dx, dz);
    if (l > 1e-9) { out.tx = dx / l; out.tz = dz / l; }
    return out;
}

/** Unit direction of segment k → k+1 (wrapping on closed paths) into out[0..1]; false if degenerate. */
function segDir(p: RtPath, k: number, out: Float64Array, o: number): boolean {
    const j = (k + 1) % p.n;
    const dx = p.xs[j] - p.xs[k], dz = p.zs[j] - p.zs[k];
    const l = Math.hypot(dx, dz);
    if (l < 1e-9) return false;
    out[o] = dx / l;
    out[o + 1] = dz / l;
    return true;
}

const tanScratch = new Float64Array(8);

/** Vertex tangent: bisector of the incoming and outgoing segments (one of them at open ends). */
function vertexTangent(p: RtPath, k: number, out: Float64Array, o: number): void {
    const hasIn = (p.closed || k > 0) && segDir(p, (k - 1 + p.n) % p.n, tanScratch, 4);
    const hasOut = (p.closed || k < p.n - 1) && segDir(p, k, tanScratch, 6);
    let x = (hasIn ? tanScratch[4] : 0) + (hasOut ? tanScratch[6] : 0);
    let z = (hasIn ? tanScratch[5] : 0) + (hasOut ? tanScratch[7] : 0);
    let l = Math.hypot(x, z);
    if (l < 1e-9) { x = hasOut ? tanScratch[6] : 0; z = hasOut ? tanScratch[7] : 1; l = 1; } // hairpin: take the outgoing side
    out[o] = x / l;
    out[o + 1] = z / l;
}

/**
 * Like sampleRt, but the tangent blends across each segment from one vertex tangent (the bisector
 * of its two segments) to the next. Position is still on the polyline; only the frame turns
 * continuously. A point offset sideways along rightOf(tangent) — a ped walking off the centre
 * line — then moves smoothly through vertices instead of jumping at each one (on the inside of
 * a turn the old per-segment frame even threw it backwards).
 */
export function sampleRtSmooth(p: RtPath, s: number, out: PathSample): PathSample {
    const L = p.length;
    let d = p.closed ? ((s % L) + L) % L : s < 0 ? 0 : s > L ? L : s;
    const cum = p.cum;
    let lo = 0, hi = cum.length - 2;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= d) lo = mid; else hi = mid - 1;
    }
    const i = lo, j = (i + 1) % p.n;
    const seg = cum[i + 1] - cum[i];
    d -= cum[i];
    const t = seg > 1e-9 ? d / seg : 0;
    out.x = p.xs[i] + (p.xs[j] - p.xs[i]) * t;
    out.z = p.zs[i] + (p.zs[j] - p.zs[i]) * t;
    vertexTangent(p, i, tanScratch, 0);
    vertexTangent(p, j, tanScratch, 2);
    const tx = tanScratch[0] + (tanScratch[2] - tanScratch[0]) * t;
    const tz = tanScratch[1] + (tanScratch[3] - tanScratch[1]) * t;
    const l = Math.hypot(tx, tz);
    if (l > 1e-9) { out.tx = tx / l; out.tz = tz / l; }
    return out;
}

/** Vertex index whose arc length is at or before s (for envelope lookups). */
export function vertexAt(p: RtPath, s: number): number {
    const cum = p.cum;
    const d = p.closed ? ((s % p.length) + p.length) % p.length : Math.max(0, Math.min(p.length, s));
    let lo = 0, hi = p.n - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= d) lo = mid; else hi = mid - 1;
    }
    return lo;
}

/**
 * Per-vertex speed envelope: the curvature limit sqrt(aLat / κ), capped by `limit`, then swept
 * backwards so a car arriving at any vertex can brake (at `decel`) to every limit beyond it on
 * the same path.
 */
export function speedEnvelope(
    p: RtPath, limit: number, aLat: number, decel: number, caps: ReadonlyArray<readonly [number, number, number]> = [],
): Float64Array {
    const env = new Float64Array(p.n).fill(limit);
    for (const [s0, s1, v] of caps) for (let i = 0; i < p.n; i++) if (p.cum[i] >= s0 && p.cum[i] <= s1) env[i] = Math.min(env[i], v);
    const first = p.closed ? 0 : 1, last = p.closed ? p.n - 1 : p.n - 2;
    for (let i = first; i <= last; i++) {
        const a = (i - 1 + p.n) % p.n, c = (i + 1) % p.n;
        const ax = p.xs[i] - p.xs[a], az = p.zs[i] - p.zs[a];
        const bx = p.xs[c] - p.xs[i], bz = p.zs[c] - p.zs[i];
        const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
        if (la < 1e-6 || lb < 1e-6) continue;
        const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb))));
        const kappa = turn / ((la + lb) / 2);
        if (kappa > 1e-4) env[i] = Math.min(env[i], Math.sqrt(aLat / kappa));
    }
    for (let pass = 0; pass < (p.closed ? 2 : 1); pass++) {
        for (let i = p.n - 2; i >= 0; i--) {
            const ds = p.cum[i + 1] - p.cum[i];
            env[i] = Math.min(env[i], Math.sqrt(env[i + 1] ** 2 + 2 * decel * ds));
        }
        if (p.closed) env[p.n - 1] = Math.min(env[p.n - 1], Math.sqrt(env[0] ** 2 + 2 * decel * (p.length - p.cum[p.n - 1])));
    }
    return env;
}
