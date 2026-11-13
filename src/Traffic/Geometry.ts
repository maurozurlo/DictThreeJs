/**
 * 2D geometry on the ground (XZ) plane for the street traffic system.
 *
 * Convention: a point is `[x, z]`. Seen from above in the Y-up world, +X runs right and +Z runs
 * toward the Street camera, so the plane is MIRRORED against textbook math axes. The helpers below
 * speak in world terms to keep that out of callers: {@link rightOf} is the driver's right-hand side
 * of a heading, and a polygon with positive {@link signedArea} has its interior on the right of its
 * direction of travel.
 *
 * Build-time code (road network construction) — allocation-friendly arrays, not for per-frame use.
 */

export type V2 = [number, number];

export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
export const dot = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1];
/** z-component of the 3D cross product; > 0 means `b` turns RIGHT of `a` in world terms. */
export const cross = (a: V2, b: V2): number => a[0] * b[1] - a[1] * b[0];
export const len = (a: V2): number => Math.hypot(a[0], a[1]);
export const dist = (a: V2, b: V2): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function norm(a: V2): V2 {
    const l = Math.hypot(a[0], a[1]);
    return l > 1e-12 ? [a[0] / l, a[1] / l] : [0, 0];
}

/** Driver's right-hand side of heading `d` (Y-up world, seen from above). */
export const rightOf = (d: V2): V2 => [-d[1], d[0]];

/** Shoelace area; positive = interior on the right of travel (see module doc). */
export function signedArea(poly: readonly V2[]): number {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
}

/** Copy of `poly` wound so its interior is on the right of travel (positive area). */
export function windInteriorRight(poly: readonly V2[]): V2[] {
    const out = poly.map((p) => [p[0], p[1]] as V2);
    return signedArea(out) < 0 ? out.reverse() : out;
}

export function pointInPolygon(p: V2, poly: readonly V2[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}

/** Closest point on segment ab to p, with its parameter t in [0, 1]. */
export function closestOnSegment(p: V2, a: V2, b: V2): { point: V2; t: number; d: number } {
    const ab = sub(b, a);
    const l2 = dot(ab, ab);
    const t = l2 > 1e-12 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
    const point = lerp(a, b, t);
    return { point, t, d: dist(p, point) };
}

/** Proper intersection of segments ab and cd (parameters on each), or null. */
export function segmentIntersection(a: V2, b: V2, c: V2, d: V2): { t: number; u: number; point: V2 } | null {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < 1e-12) return null;
    const ca = sub(c, a);
    const t = cross(ca, s) / den;
    const u = cross(ca, r) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u, point: add(a, scale(r, t)) };
}

// ---------------------------------------------------------------------------
// Polylines with arc length
// ---------------------------------------------------------------------------

/** A sampled polyline with cumulative arc length. Closed polylines do NOT repeat the first point. */
export interface ArcPolyline {
    pts: V2[];
    /** cum[i] = arc length from pts[0] to pts[i]; for closed lines cum has pts.length + 1 entries. */
    cum: number[];
    length: number;
    closed: boolean;
}

export function arcPolyline(pts: readonly V2[], closed = false): ArcPolyline {
    const p = pts.map((q) => [q[0], q[1]] as V2);
    const n = closed ? p.length + 1 : p.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(p[i - 1], p[i % p.length]));
    return { pts: p, cum, length: cum[cum.length - 1], closed };
}

/** Segment index containing arc length s (clamped / wrapped). */
function segAt(line: ArcPolyline, s: number): { i: number; t: number } {
    const { cum, length, closed } = line;
    let d = closed ? ((s % length) + length) % length : Math.max(0, Math.min(length, s));
    let lo = 0, hi = cum.length - 2;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= d) lo = mid; else hi = mid - 1;
    }
    const segLen = cum[lo + 1] - cum[lo];
    d -= cum[lo];
    return { i: lo, t: segLen > 1e-12 ? d / segLen : 0 };
}

export function pointAt(line: ArcPolyline, s: number): V2 {
    const { i, t } = segAt(line, s);
    const p = line.pts;
    return lerp(p[i], p[(i + 1) % p.length], t);
}

export function tangentAt(line: ArcPolyline, s: number): V2 {
    const { i } = segAt(line, s);
    const p = line.pts;
    return norm(sub(p[(i + 1) % p.length], p[i]));
}

/** Arc length of the point on `line` closest to `p`, with the distance to it. */
export function projectOnto(line: ArcPolyline, p: V2): { s: number; d: number; point: V2 } {
    const n = line.closed ? line.pts.length : line.pts.length - 1;
    let best = { s: 0, d: Infinity, point: line.pts[0] };
    for (let i = 0; i < n; i++) {
        const a = line.pts[i], b = line.pts[(i + 1) % line.pts.length];
        const c = closestOnSegment(p, a, b);
        if (c.d < best.d) best = { s: line.cum[i] + c.t * (line.cum[i + 1] - line.cum[i]), d: c.d, point: c.point };
    }
    return best;
}

/**
 * Sub-polyline between arc lengths s0 < s1. On closed lines pass s0 in [0, length) and
 * s1 in (s0, s0 + length] — the slice may run across the start point.
 */
export function slice(line: ArcPolyline, s0: number, s1: number): V2[] {
    const { cum, length, closed, pts } = line;
    if (closed && (s0 < 0 || s0 >= length)) {
        const shift = Math.floor(s0 / length) * length;
        s0 -= shift;
        s1 -= shift;
    }
    const out: V2[] = [pointAt(line, s0)];
    // Interior vertices strictly between s0 and s1, over two unrolled laps on closed lines —
    // vertex arc positions ascend within a lap and laps ascend, so order is preserved.
    for (let lap = 0; lap < (closed ? 2 : 1); lap++) {
        for (let i = 0; i < pts.length; i++) {
            const s = cum[i] + lap * length;
            if (s > s0 + 1e-6 && s < s1 - 1e-6) out.push([pts[i][0], pts[i][1]]);
        }
    }
    out.push(pointAt(line, s1));
    return dedupe(out);
}

function dedupe(pts: V2[]): V2[] {
    const out: V2[] = [];
    for (const p of pts) if (out.length === 0 || dist(out[out.length - 1], p) > 1e-6) out.push(p);
    return out;
}

/** Re-sample a polyline at roughly `step` spacing (keeps the end points). */
export function resample(pts: readonly V2[], step: number, closed = false): V2[] {
    const line = arcPolyline(pts, closed);
    const n = Math.max(closed ? 3 : 1, Math.round(line.length / step));
    const out: V2[] = [];
    for (let k = 0; k < (closed ? n : n + 1); k++) out.push(pointAt(line, (k / n) * line.length));
    return out;
}

// ---------------------------------------------------------------------------
// Fillets and offsets
// ---------------------------------------------------------------------------

/**
 * Rounds every corner of a polyline with a true circular arc of `radius`, tangent to both edges.
 * The radius shrinks where adjacent edges are too short to hold it. `radius` may be per-vertex.
 */
export function fillet(pts: readonly V2[], radius: number | readonly number[], closed: boolean, segPer90 = 8): V2[] {
    const n = pts.length;
    const out: V2[] = [];
    for (let i = 0; i < n; i++) {
        const r = typeof radius === 'number' ? radius : radius[i];
        const isEnd = !closed && (i === 0 || i === n - 1);
        if (isEnd || r <= 0) { out.push([pts[i][0], pts[i][1]]); continue; }
        const A = pts[(i - 1 + n) % n], B = pts[i], C = pts[(i + 1) % n];
        const d1 = norm(sub(B, A)), d2 = norm(sub(C, B));
        const turn = Math.acos(Math.max(-1, Math.min(1, dot(d1, d2))));
        if (turn < 1e-3) { out.push([B[0], B[1]]); continue; }
        const half = Math.tan(turn / 2);
        const t = Math.min(r * half, dist(A, B) / 2, dist(B, C) / 2);
        const rEff = t / half;
        const P1 = sub(B, scale(d1, t)), P2 = add(B, scale(d2, t));
        // centre sits on the inside of the turn, rEff from P1 along the edge normal
        const side = cross(d1, d2) > 0 ? 1 : -1;
        const O = add(P1, scale(rightOf(d1), side * rEff));
        const v1 = sub(P1, O), v2 = sub(P2, O);
        const sweep = Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], dot(v1, v2));
        const segs = Math.max(2, Math.ceil((Math.abs(sweep) / (Math.PI / 2)) * segPer90));
        for (let k = 0; k <= segs; k++) {
            const a = (sweep * k) / segs, c = Math.cos(a), s = Math.sin(a);
            out.push([O[0] + v1[0] * c - v1[1] * s, O[1] + v1[0] * s + v1[1] * c]);
        }
    }
    return dedupe(out);
}

/**
 * Offsets a polyline sideways by `d` toward the driver's RIGHT of its direction of travel
 * (negative = left). Miter joins, clamped to 4|d| so sharp corners cannot spike.
 */
export function offsetPolyline(pts: readonly V2[], d: number, closed: boolean): V2[] {
    const n = pts.length;
    const out: V2[] = [];
    for (let i = 0; i < n; i++) {
        const hasPrev = closed || i > 0, hasNext = closed || i < n - 1;
        const nPrev = hasPrev ? rightOf(norm(sub(pts[i], pts[(i - 1 + n) % n]))) : null;
        const nNext = hasNext ? rightOf(norm(sub(pts[(i + 1) % n], pts[i]))) : null;
        let m: V2;
        if (nPrev && nNext) {
            const sum = norm(add(nPrev, nNext));
            const c = Math.max(0.25, dot(sum, nNext));
            m = scale(sum, Math.min(1 / c, 4));
        } else {
            m = (nPrev ?? nNext)!;
        }
        out.push(add(pts[i], scale(m, d)));
    }
    return out;
}

/** Shrinks a closed polygon by `d` (grows when negative), whatever its input winding. */
export function insetPolygon(poly: readonly V2[], d: number): V2[] {
    return offsetPolyline(windInteriorRight(poly), d, true);
}

/**
 * Inset of a ROUNDED polygon without folds: offsets the sharp outline by `d`, then fillets it
 * concentrically with the original `radius` — convex corners shrink to radius − d (sharp once
 * d ≥ radius, instead of looping back on themselves), concave corners grow to radius + d.
 */
export function insetRounded(outline: readonly V2[], d: number, radius: number, segPer90 = 8): V2[] {
    const raw = windInteriorRight(outline);
    const off = offsetPolyline(raw, d, true);
    const n = raw.length;
    const radii = raw.map((B, i) => {
        const A = raw[(i - 1 + n) % n], C = raw[(i + 1) % n];
        const convex = cross(sub(B, A), sub(C, B)) > 0; // interior on the right: right turns are convex
        return convex ? Math.max(0, radius - d) : radius + d;
    });
    return fillet(off, radii, true, segPer90);
}

/** Samples a cubic Bezier at roughly `step` spacing. */
export function bezier(p0: V2, p1: V2, p2: V2, p3: V2, step: number): V2[] {
    const approx = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
    const n = Math.max(2, Math.ceil(approx / step));
    const out: V2[] = [];
    for (let k = 0; k <= n; k++) {
        const t = k / n, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        out.push([a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]]);
    }
    return out;
}

/** Points along a circular arc around `c` from angle a0 to a1 (radians, atan2(z, x) sense). */
export function arc(c: V2, r: number, a0: number, a1: number, step: number): V2[] {
    const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step));
    const out: V2[] = [];
    for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
    }
    return out;
}

/** Axis-aligned rectangle as a closed polygon. */
export function rect(x0: number, z0: number, x1: number, z1: number): V2[] {
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}
