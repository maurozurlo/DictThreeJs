/**
 * RoadBuilder — derives the full street network from a {@link RoadPlan} (ADR-0014).
 *
 * Output feeds both the meshes (kerb outlines, road ribbons, markings) and the traffic simulation
 * (lane graph with junction connectors, sidewalk loops, crossings), so they stay in lock-step.
 *
 * Pipeline:
 *   1. fillet every road centreline and block outline;
 *   2. find junctions — a road END lying on another road (T), or two roads crossing (X);
 *   3. split roads into pieces between junctions, trim each piece back from the junction box,
 *      offset it into lanes (right-hand traffic);
 *   4. connect incoming → outgoing lanes at each junction with Bezier connectors (turn rules);
 *   5. sidewalk loops (kerb inset by half the sidewalk), crossings (kerb-to-kerb, loop-linked),
 *      walkways, medians, markings; validate lanes against kerbs and buildings against blocks.
 *
 * Pure, deterministic, build-time (allocation is fine here — nothing runs per frame).
 */
import {
    type ArcPolyline, type V2,
    add, arcPolyline, bezier, closestOnSegment, cross, dist, dot, fillet, insetRounded, len, norm,
    offsetPolyline, pointAt, pointInPolygon, projectOnto, resample, rightOf, scale, segmentIntersection,
    slice, sub, tangentAt, windInteriorRight,
} from './Geometry.ts';
import { DEFAULT_ROAD_SPEED, type BlockKind, type RoadDef, type RoadPlan } from './RoadPlan.ts';

// ---------------------------------------------------------------------------
// Tuning (build-time geometry)
// ---------------------------------------------------------------------------

/** Lane / connector sample spacing (world units). */
export const PATH_STEP = 1.5;
/** Extra clearance between a junction box edge and where lanes are trimmed. */
const JUNCTION_MARGIN = 1.5;
/** A road end within this distance of another road's centreline forms a T junction. */
const JUNCTION_SNAP = 1.0;
/** Lateral acceleration a turning car accepts (u/s²) — sets connector speed limits from radius. */
const TURN_LATERAL_ACCEL = 5;
/** Default zebra band width along the road. */
const CROSSING_WIDTH = 6;
/** Peds keep this far from a kerb or building line inside their sidewalk band. */
const SIDEWALK_CLEARANCE = 0.9;
/** Car half-width used to validate lanes against kerbs. */
const VALIDATE_CAR_HALF_WIDTH = 2.3;
/** Lateral room a swerving car keeps from an obstacle or a carriageway edge (half-width + margin). */
const WEAVE_CLEAR = 3.0;
/** Length of the ease-in / ease-out of a swerve (u). */
const WEAVE_RAMP = 10;
/** Car half-length used to hold a swerve until the body has passed the obstacle. */
const WEAVE_BODY = 6;
/** Speed cap (u/s) through a swerve — cars slow down to weave. */
export const WEAVE_SPEED = 9;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type Turn = 'left' | 'right' | 'straight';

/** One drivable path: a lane piece between junctions, or a junction connector. */
export interface LanePath {
    id: number;
    key: string;
    kind: 'lane' | 'connector';
    road: string;
    line: ArcPolyline;
    next: number[];
    prev: number[];
    /** Speed limit (u/s) — connectors carry their turn-radius limit. */
    speed: number;
    /** Right of way when this path conflicts with another (higher wins). */
    rank: number;
    /** Starts at the plan bounds (traffic source) / ends there (traffic sink). */
    spawn: boolean;
    sink: boolean;
    /** Junction id for connectors, -1 for lanes. */
    junction: number;
    turn: Turn | null;
    /** [s0, s1, v] stretches where the speed limit drops (swerves around road obstacles). */
    speedCaps?: Array<[number, number, number]>;
}

/** A rectangular obstacle standing on the road (barricade, checkpoint): centre, half extents, yaw. */
export interface RoadObstacle {
    x: number;
    z: number;
    hx: number;
    hz: number;
    yaw: number;
}

export interface BuildOptions {
    /** Lanes bend around these (cars slow and weave); conflict zones then follow the bent lanes. */
    roadObstacles?: readonly RoadObstacle[];
}

export interface Junction {
    id: number;
    pos: V2;
    roads: string[];
}

export interface BuiltBlock {
    id: string;
    kind: BlockKind;
    /** Filleted kerb polygon, interior on the right of travel. */
    kerb: V2[];
    /** Kerb inset by the sidewalk width (building / plaza / paving area). */
    inner: V2[];
    sidewalk: number;
}

/** Closed pedestrian loop along a block's sidewalk. */
export interface SidewalkLoop {
    id: number;
    block: string;
    line: ArcPolyline;
    /** Lateral freedom either side of the loop line. */
    halfWidth: number;
    /** Share of walking citizens placed here (BlockDef.pedWeight). */
    pedWeight: number;
}

export interface PedLink {
    loop: number;
    s: number;
}

/** Zebra crossing: peds walk pts[0] → pts[3] (loop, kerb, kerb, loop). */
export interface BuiltCrossing {
    id: string;
    road: string;
    centre: V2;
    /** Road direction at the crossing (forward travel). */
    along: V2;
    /** Direction peds walk from links[0] to links[1]. */
    across: V2;
    /** Stripe band half-width along the road. */
    halfBand: number;
    line: ArcPolyline;
    links: [PedLink | null, PedLink | null];
}

export interface BuiltWalkway {
    id: string;
    line: ArcPolyline;
    links: [PedLink | null, PedLink | null];
}

export type MarkingKind = 'zebra' | 'centre' | 'divider' | 'stop';

export interface Marking {
    kind: MarkingKind;
    quad: [V2, V2, V2, V2];
}

/** A road's full asphalt strip: left/right edges sampled in step (closed roads loop). */
export interface RoadRibbon {
    road: string;
    left: V2[];
    right: V2[];
    closed: boolean;
}

export interface RoadNetwork {
    plan: RoadPlan;
    paths: LanePath[];
    junctions: Junction[];
    blocks: BuiltBlock[];
    loops: SidewalkLoop[];
    crossings: BuiltCrossing[];
    walkways: BuiltWalkway[];
    ribbons: RoadRibbon[];
    markings: Marking[];
    warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal records
// ---------------------------------------------------------------------------

type NodeRef = { kind: 'junction'; id: number } | { kind: 'edge' } | { kind: 'dead' } | { kind: 'loop' };

interface RoadInfo {
    def: RoadDef;
    centre: ArcPolyline;
    width: number;
    rank: number;
    speed: number;
}

interface LaneRec {
    path: LanePath;
    road: string;
    piece: number;
    dir: 1 | -1;
    /** 0 = leftmost lane for this direction of travel. */
    index: number;
    count: number;
    start: NodeRef;
    end: NodeRef;
    /** Allowed car-centre lateral offset from the lane line (lane's own right-positive frame). */
    latMin: number;
    latMax: number;
}

const roadWidth = (r: RoadDef, laneWidth: number): number =>
    r.width ?? (r.lanes[0] + r.lanes[1]) * laneWidth + (r.median ?? 0);

/** Sideways offsets (toward the forward driver's right) of each lane, leftmost first per direction. */
function laneOffsets(r: RoadDef, laneWidth: number): { fwd: number[]; back: number[] } {
    const [nF, nB] = r.lanes;
    const m = (r.median ?? 0) / 2;
    if (nB === 0) {
        return { fwd: Array.from({ length: nF }, (_, i) => (i + 0.5 - nF / 2) * laneWidth), back: [] };
    }
    return {
        fwd: Array.from({ length: nF }, (_, i) => m + (i + 0.5) * laneWidth),
        // backward travel's leftmost lane is the innermost one, on the forward driver's left
        back: Array.from({ length: nB }, (_, i) => -(m + (i + 0.5) * laneWidth)),
    };
}

function outsideBounds(p: V2, plan: RoadPlan, tol = 1): boolean {
    const { min, max } = plan.bounds;
    return p[0] <= min[0] + tol || p[0] >= max[0] - tol || p[1] <= min[1] + tol || p[1] >= max[1] - tol;
}

function rawSegments(r: RoadDef): Array<[V2, V2]> {
    const segs: Array<[V2, V2]> = [];
    const n = r.points.length;
    for (let i = 0; i < (r.closed ? n : n - 1); i++) segs.push([r.points[i], r.points[(i + 1) % n]]);
    return segs;
}

function closestOnRaw(p: V2, r: RoadDef): { point: V2; d: number } {
    let best = { point: r.points[0], d: Infinity };
    for (const [a, b] of rawSegments(r)) {
        const c = closestOnSegment(p, a, b);
        if (c.d < best.d) best = { point: c.point, d: c.d };
    }
    return best;
}

/** Turn class and signed angle (radians, > 0 = right) from heading `a` to heading `b`. */
export function classifyTurn(a: V2, b: V2): { turn: Turn; angle: number } {
    const angle = Math.atan2(cross(a, b), dot(a, b));
    return { turn: Math.abs(angle) < 0.6 ? 'straight' : angle > 0 ? 'right' : 'left', angle };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildRoadNetwork(plan: RoadPlan, options: BuildOptions = {}): RoadNetwork {
    const warnings: string[] = [];
    const W = plan.laneWidth;

    const roads = new Map<string, RoadInfo>();
    for (const def of plan.roads) {
        const closed = !!def.closed;
        const pts = fillet(def.points, def.cornerRadius ?? 0, closed);
        roads.set(def.id, {
            def,
            centre: arcPolyline(resample(pts, PATH_STEP, closed), closed),
            width: roadWidth(def, W),
            rank: def.rank ?? 1,
            speed: def.speed ?? DEFAULT_ROAD_SPEED,
        });
    }

    // ---- 2. junctions ------------------------------------------------------------------------
    const raw: Array<{ pos: V2; roads: Set<string> }> = [];
    const addJunction = (pos: V2, a: string, b: string) => {
        const hit = raw.find((j) => dist(j.pos, pos) < 3);
        if (hit) { hit.roads.add(a); hit.roads.add(b); return; }
        raw.push({ pos, roads: new Set([a, b]) });
    };
    for (const A of plan.roads) {
        if (A.closed) continue;
        for (const e of [A.points[0], A.points[A.points.length - 1]]) {
            for (const B of plan.roads) {
                if (B === A) continue;
                const c = closestOnRaw(e, B);
                if (c.d < JUNCTION_SNAP) addJunction(c.point, A.id, B.id);
            }
        }
    }
    for (let i = 0; i < plan.roads.length; i++) {
        for (let k = i + 1; k < plan.roads.length; k++) {
            const A = plan.roads[i], B = plan.roads[k];
            for (const [a0, a1] of rawSegments(A)) {
                for (const [b0, b1] of rawSegments(B)) {
                    const x = segmentIntersection(a0, a1, b0, b1);
                    if (x && x.t > 1e-3 && x.t < 1 - 1e-3 && x.u > 1e-3 && x.u < 1 - 1e-3) addJunction(x.point, A.id, B.id);
                }
            }
        }
    }
    const junctions: Junction[] = raw.map((j, id) => ({ id, pos: j.pos, roads: [...j.roads].sort() }));

    /** Trim distance for `road` at junction `j`: clear the widest other carriageway. */
    const trimAt = (j: Junction, road: string): number => {
        let half = 0;
        for (const r of j.roads) if (r !== road) half = Math.max(half, roads.get(r)!.width / 2);
        return half + JUNCTION_MARGIN;
    };

    // ---- 3. pieces and lanes -----------------------------------------------------------------
    const lanes: LaneRec[] = [];
    const paths: LanePath[] = [];
    const newPath = (p: Omit<LanePath, 'id'>): LanePath => {
        const path = { ...p, id: paths.length };
        paths.push(path);
        return path;
    };

    for (const info of roads.values()) {
        const { def, centre } = info;
        const closed = !!def.closed;
        const L = centre.length;
        const onRoad = junctions
            .filter((j) => j.roads.includes(def.id))
            .map((j) => ({ j, s: projectOnto(centre, j.pos).s }))
            .sort((a, b) => a.s - b.s);

        type Boundary = { s: number; node: NodeRef; trim: number };
        const bounds: Boundary[] = [];
        const jNode = (j: Junction): NodeRef => ({ kind: 'junction', id: j.id });
        if (closed) {
            for (const { j, s } of onRoad) bounds.push({ s, node: jNode(j), trim: trimAt(j, def.id) });
        } else {
            const endNode = (s: number, p: V2): Boundary => {
                const at = onRoad.find((o) => Math.abs(o.s - s) < 2);
                if (at) return { s, node: jNode(at.j), trim: trimAt(at.j, def.id) };
                if (outsideBounds(p, plan)) return { s, node: { kind: 'edge' }, trim: 0 };
                warnings.push(`road ${def.id}: dead end at (${p[0].toFixed(1)}, ${p[1].toFixed(1)})`);
                return { s, node: { kind: 'dead' }, trim: 0 };
            };
            bounds.push(endNode(0, centre.pts[0]));
            for (const o of onRoad) if (o.s > 2 && o.s < L - 2) bounds.push({ s: o.s, node: jNode(o.j), trim: trimAt(o.j, def.id) });
            bounds.push(endNode(L, centre.pts[centre.pts.length - 1]));
        }

        const offs = laneOffsets(def, W);
        // carriageway each direction may use, in the forward frame (a median splits it)
        const half = info.width / 2, mHalf = (def.median ?? 0) / 2;
        const fwdLo = def.lanes[1] > 0 && mHalf > 0 ? mHalf : -half, fwdHi = half;
        const backLo = -half, backHi = def.lanes[1] > 0 && mHalf > 0 ? -mHalf : half;
        const makeLanes = (piece: number, centrePts: V2[], loopPiece: boolean, a: Boundary | null, b: Boundary | null) => {
            const groups: Array<[1 | -1, number[]]> = [[1, offs.fwd], [-1, offs.back]];
            for (const [dir, list] of groups) {
                list.forEach((off, index) => {
                    let pts = offsetPolyline(centrePts, off, loopPiece);
                    if (dir < 0) pts = pts.reverse();
                    const line = arcPolyline(resample(pts, PATH_STEP, loopPiece), loopPiece);
                    const start: NodeRef = loopPiece ? { kind: 'loop' } : (dir > 0 ? a! : b!).node;
                    const end: NodeRef = loopPiece ? { kind: 'loop' } : (dir > 0 ? b! : a!).node;
                    const path = newPath({
                        key: `${def.id}.${piece}${dir > 0 ? 'f' : 'b'}${index}`,
                        kind: 'lane', road: def.id, line, next: [], prev: [],
                        speed: info.speed, rank: info.rank,
                        spawn: start.kind === 'edge', sink: end.kind === 'edge',
                        junction: -1, turn: null,
                    });
                    if (loopPiece) { path.next.push(path.id); path.prev.push(path.id); }
                    const [lo, hi] = dir > 0 ? [fwdLo, fwdHi] : [backLo, backHi];
                    const latMin = dir > 0 ? lo + WEAVE_CLEAR - off : -(hi - WEAVE_CLEAR - off);
                    const latMax = dir > 0 ? hi - WEAVE_CLEAR - off : -(lo + WEAVE_CLEAR - off);
                    lanes.push({ path, road: def.id, piece, dir, index, count: list.length, start, end, latMin, latMax });
                });
            }
        };

        if (closed && bounds.length === 0) {
            makeLanes(0, centre.pts, true, null, null);
            continue;
        }
        const pieceCount = closed ? bounds.length : bounds.length - 1;
        for (let p = 0; p < pieceCount; p++) {
            const a = bounds[p];
            const b = bounds[(p + 1) % bounds.length];
            const s0 = a.s + a.trim;
            const s1 = (closed && b.s <= a.s ? b.s + L : b.s) - b.trim;
            if (s1 - s0 < 2) {
                warnings.push(`road ${def.id}: piece ${p} vanishes after junction trimming (${(s1 - s0).toFixed(1)} u)`);
                continue;
            }
            makeLanes(p, slice(centre, s0, s1), false, a, b);
        }
    }

    // ---- 4. connectors ----------------------------------------------------------------------
    for (const j of junctions) {
        const incoming = lanes.filter((l) => l.end.kind === 'junction' && l.end.id === j.id);
        const outgoing = lanes.filter((l) => l.start.kind === 'junction' && l.start.id === j.id);
        for (const inL of incoming) {
            const inLine = inL.path.line;
            const dIn = tangentAt(inLine, inLine.length - 0.01);
            const p0 = inLine.pts[inLine.pts.length - 1];
            for (const outL of outgoing) {
                if (inL.road === outL.road && inL.piece === outL.piece && inL.dir !== outL.dir) continue; // U-turn
                const outLine = outL.path.line;
                const dOut = tangentAt(outLine, 0.01);
                const { turn, angle } = classifyTurn(dIn, dOut);
                const laneOk =
                    turn === 'right' ? inL.index === inL.count - 1 && outL.index === outL.count - 1
                        : turn === 'left' ? inL.index === 0 && outL.index === 0
                            : outL.index === Math.min(inL.index, outL.count - 1);
                if (!laneOk) continue;
                const p3 = outLine.pts[0];
                const chord = dist(p0, p3);
                const theta = Math.abs(angle);
                let h = chord / 3;
                let radius = Infinity;
                if (theta > 0.05) {
                    radius = chord / (2 * Math.sin(theta / 2));
                    h = (4 / 3) * Math.tan(theta / 4) * radius;
                }
                const pts = bezier(p0, add(p0, scale(dIn, h)), sub(p3, scale(dOut, h)), p3, PATH_STEP);
                const conn = newPath({
                    key: `J${j.id}:${inL.path.key}>${outL.path.key}`,
                    kind: 'connector', road: outL.road, line: arcPolyline(pts),
                    next: [outL.path.id], prev: [inL.path.id],
                    speed: Math.min(inL.path.speed, outL.path.speed, Math.sqrt(TURN_LATERAL_ACCEL * radius)),
                    rank: inL.path.rank, spawn: false, sink: false, junction: j.id, turn,
                });
                inL.path.next.push(conn.id);
                outL.path.prev.push(conn.id);
            }
        }
        for (const inL of incoming) if (inL.path.next.length === 0) warnings.push(`lane ${inL.path.key}: no way out of junction ${j.id}`);
    }

    // ---- 5a. blocks, medians, loops ---------------------------------------------------------
    const blocks: BuiltBlock[] = plan.blocks.map((b) => {
        const kerb = fillet(windInteriorRight(b.outline), b.cornerRadius, true);
        const inner = b.sidewalk > 0 ? insetRounded(b.outline, b.sidewalk, b.cornerRadius) : kerb;
        return { id: b.id, kind: b.kind, kerb, inner, sidewalk: b.sidewalk };
    });
    const loopLine = new Map(plan.blocks.map((b) => [b.id, b.sidewalk > 0 ? insetRounded(b.outline, b.sidewalk / 2, b.cornerRadius) : []]));
    for (const info of roads.values()) {
        const m = info.def.median ?? 0;
        if (m <= 0) continue;
        // One median island per lane piece pair — reuse the forward lanes' extents (already trimmed).
        const pieces = new Set(lanes.filter((l) => l.road === info.def.id).map((l) => l.piece));
        for (const piece of pieces) {
            const fwd = lanes.find((l) => l.road === info.def.id && l.piece === piece && l.dir === 1);
            if (!fwd) continue;
            const a = projectOnto(info.centre, fwd.path.line.pts[0]).s + 2;
            let b = projectOnto(info.centre, fwd.path.line.pts[fwd.path.line.pts.length - 1]).s - 2;
            if (info.def.closed && b <= a) b += info.centre.length;
            if (b - a < 3) continue;
            const mid = slice(info.centre, a, b);
            const left = offsetPolyline(mid, -m / 2, false);
            const right = offsetPolyline(mid, m / 2, false);
            const kerb = windInteriorRight([...right, ...left.reverse()]);
            blocks.push({ id: `${info.def.id}.median${piece}`, kind: 'median', kerb, inner: kerb, sidewalk: 0 });
        }
    }

    const loops: SidewalkLoop[] = [];
    for (const b of blocks) {
        if (b.kind === 'median' || b.sidewalk <= 0) continue;
        const pts = resample(loopLine.get(b.id)!, PATH_STEP, true);
        const def = plan.blocks.find((d) => d.id === b.id);
        loops.push({
            id: loops.length, block: b.id, line: arcPolyline(pts, true),
            halfWidth: Math.max(0.8, b.sidewalk / 2 - SIDEWALK_CLEARANCE), pedWeight: def?.pedWeight ?? 1,
        });
    }
    const loopOfBlock = (blockId: string) => loops.find((l) => l.block === blockId) ?? null;

    // ---- 5b. crossings ----------------------------------------------------------------------
    const markings: Marking[] = [];
    const crossings: BuiltCrossing[] = [];
    const kerbBlocks = blocks.filter((b) => b.kind !== 'median');
    for (const def of plan.crossings) {
        const info = roads.get(def.road);
        if (!info) { warnings.push(`crossing ${def.id}: unknown road ${def.road}`); continue; }
        const proj = projectOnto(info.centre, def.at);
        const c = proj.point;
        const along = tangentAt(info.centre, proj.s);
        const across = rightOf(along);
        const hit = (sign: 1 | -1) => {
            const far = add(c, scale(across, sign * (info.width + 60)));
            let best: { d: number; block: BuiltBlock } | null = null;
            for (const b of kerbBlocks) {
                for (let i = 0; i < b.kerb.length; i++) {
                    const x = segmentIntersection(c, far, b.kerb[i], b.kerb[(i + 1) % b.kerb.length]);
                    if (!x) continue;
                    const d = x.t * len(sub(far, c));
                    if (!best || d < best.d) best = { d, block: b };
                }
            }
            return best;
        };
        const hA = hit(-1), hB = hit(1);
        if (!hA || !hB) { warnings.push(`crossing ${def.id}: no kerb on ${hA ? 'right' : 'left'} side`); continue; }
        const side = (h: { d: number; block: BuiltBlock }, sign: number): { kerb: V2; loopPt: V2; link: PedLink | null } => {
            const kerb = add(c, scale(across, sign * h.d));
            const loop = loopOfBlock(h.block.id);
            if (!loop) return { kerb, loopPt: kerb, link: null };
            const pr = projectOnto(loop.line, add(kerb, scale(across, sign * h.block.sidewalk / 2)));
            return { kerb, loopPt: pr.point, link: { loop: loop.id, s: pr.s } };
        };
        const A = side(hA, -1), B = side(hB, 1);
        const halfBand = (def.width ?? CROSSING_WIDTH) / 2;
        crossings.push({
            id: def.id, road: def.road, centre: c, along, across, halfBand,
            line: arcPolyline([A.loopPt, A.kerb, B.kerb, B.loopPt]),
            links: [A.link, B.link],
        });
        // zebra stripes: bars parallel to traffic, spaced across the carriageway (median skipped)
        const half = info.width / 2 - 0.6;
        const mHalf = (info.def.median ?? 0) / 2;
        for (let u = -half + 0.6; u <= half - 0.6 + 1e-6; u += 2.2) {
            if (Math.abs(u) < mHalf + 0.6) continue;
            markings.push({ kind: 'zebra', quad: quadAround(add(c, scale(across, u)), along, halfBand, 0.6) });
        }
    }

    // ---- 5c. walkways -----------------------------------------------------------------------
    const walkways: BuiltWalkway[] = (plan.walkways ?? []).map((w) => {
        const line = arcPolyline(resample(w.points, PATH_STEP));
        const linkFor = (p: V2): PedLink | null => {
            let best: (PedLink & { d: number }) | null = null;
            for (const l of loops) {
                const pr = projectOnto(l.line, p);
                if (!best || pr.d < best.d) best = { loop: l.id, s: pr.s, d: pr.d };
            }
            if (!best || best.d > 6) { warnings.push(`walkway ${w.id}: end (${p[0].toFixed(1)}, ${p[1].toFixed(1)}) far from any loop`); return null; }
            return { loop: best.loop, s: best.s };
        };
        return { id: w.id, line, links: [linkFor(line.pts[0]), linkFor(line.pts[line.pts.length - 1])] };
    });

    // ---- 5d. ribbons and lane markings ------------------------------------------------------
    const ribbons: RoadRibbon[] = [];
    for (const info of roads.values()) {
        const closed = !!info.def.closed;
        const h = info.width / 2;
        ribbons.push({
            road: info.def.id, closed,
            left: offsetPolyline(info.centre.pts, -h, closed),
            right: offsetPolyline(info.centre.pts, h, closed),
        });
    }
    const maxRankAt = new Map<number, number>();
    for (const j of junctions) maxRankAt.set(j.id, Math.max(...j.roads.map((r) => roads.get(r)!.rank)));
    for (const l of lanes) {
        const info = roads.get(l.road)!;
        const line = l.path.line;
        // centre line: drawn once per two-way piece without median, alongside the forward inner lane
        if (l.dir === 1 && l.index === 0 && info.def.lanes[1] > 0 && !(info.def.median ?? 0)) {
            const mid = offsetPolyline(line.pts, -W / 2, false);
            pushStroke(markings, 'centre', mid, 0.35, null);
        }
        // dividers between same-direction lanes: left edge of every lane but the leftmost
        if (l.index > 0) pushStroke(markings, 'divider', offsetPolyline(line.pts, -W / 2, l.end.kind === 'loop'), 0.3, [3, 4]);
        // stop bar where a lower-ranked lane meets a junction
        if (l.end.kind === 'junction' && info.rank < (maxRankAt.get(l.end.id) ?? 0)) {
            const p = line.pts[line.pts.length - 1];
            const d = tangentAt(line, line.length - 0.01);
            markings.push({ kind: 'stop', quad: quadAround(sub(p, scale(d, 0.5)), rightOf(d), W / 2 - 0.4, 0.3) });
        }
    }

    // ---- 6. validation ----------------------------------------------------------------------
    const solid = blocks.filter((b) => b.kind !== 'median');
    for (const p of paths) {
        for (let i = 0; i < p.line.pts.length; i += 2) {
            const pt = p.line.pts[i];
            const t = tangentAt(p.line, p.line.cum[Math.min(i, p.line.cum.length - 1)]);
            const r = rightOf(t);
            for (const probe of [pt, add(pt, scale(r, VALIDATE_CAR_HALF_WIDTH)), sub(pt, scale(r, VALIDATE_CAR_HALF_WIDTH))]) {
                const b = solid.find((bl) => pointInPolygon(probe, bl.kerb));
                if (b) {
                    warnings.push(`path ${p.key}: clips block ${b.id} near (${pt[0].toFixed(1)}, ${pt[1].toFixed(1)})`);
                    i = p.line.pts.length; // one warning per path
                    break;
                }
            }
        }
    }

    // ---- 7. swerves around road obstacles (after markings: paint stays straight) -------------
    for (const ob of options.roadObstacles ?? []) {
        let used = false;
        for (const l of lanes) if (l.start.kind !== 'loop' && bendAround(l, ob, warnings)) used = true;
        if (!used) warnings.push(`road obstacle at (${ob.x.toFixed(1)}, ${ob.z.toFixed(1)}) touches no lane`);
    }

    return { plan, paths, junctions, blocks, loops, crossings, walkways, ribbons, markings, warnings };
}

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

/**
 * Bends one lane smoothly around a road obstacle, to whichever side needs the smaller swerve and
 * still fits the carriageway, holding the offset until the car body has passed it, and caps the
 * speed through the swerve. Lane ends stay put, so junction connectors are unaffected. Returns
 * true if the obstacle intersected this lane.
 */
function bendAround(l: LaneRec, ob: RoadObstacle, warnings: string[]): boolean {
    const line = l.path.line;
    const pr = projectOnto(line, [ob.x, ob.z]);
    if (pr.d > Math.hypot(ob.hx, ob.hz) + WEAVE_CLEAR + 1) return false;
    const t = tangentAt(line, pr.s), r = rightOf(t);
    const c = Math.cos(ob.yaw), s = Math.sin(ob.yaw);
    let aMin = Infinity, aMax = -Infinity, lMin = Infinity, lMax = -Infinity;
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const wx = ob.x + lx * ob.hx * c + lz * ob.hz * s - pr.point[0];
        const wz = ob.z - lx * ob.hx * s + lz * ob.hz * c - pr.point[1];
        const a = wx * t[0] + wz * t[1], lat = wx * r[0] + wz * r[1];
        aMin = Math.min(aMin, a); aMax = Math.max(aMax, a); lMin = Math.min(lMin, lat); lMax = Math.max(lMax, lat);
    }
    if (lMax < -WEAVE_CLEAR || lMin > WEAVE_CLEAR) return false;
    const left = lMin - WEAVE_CLEAR, right = lMax + WEAVE_CLEAR;
    const okL = left >= l.latMin, okR = right <= l.latMax;
    const off = okL && okR ? (Math.abs(left) <= Math.abs(right) ? left : right) : okL ? left : okR ? right : null;
    if (off === null) {
        warnings.push(`lane ${l.path.key}: obstacle at (${ob.x.toFixed(1)}, ${ob.z.toFixed(1)}) closes it — no room to swerve`);
        return true;
    }
    const p0 = pr.s + aMin - WEAVE_BODY, p1 = pr.s + aMax + WEAVE_BODY;
    if (p0 - WEAVE_RAMP < 1 || p1 + WEAVE_RAMP > line.length - 1) {
        warnings.push(`lane ${l.path.key}: obstacle at (${ob.x.toFixed(1)}, ${ob.z.toFixed(1)}) too close to a lane end to swerve`);
        return true;
    }
    const bent = line.pts.map((p, i): V2 => {
        const sv = line.cum[i];
        const w = sv < p0 ? ease((sv - (p0 - WEAVE_RAMP)) / WEAVE_RAMP) : sv > p1 ? ease((p1 + WEAVE_RAMP - sv) / WEAVE_RAMP) : 1;
        if (w <= 0) return p;
        const n = rightOf(tangentAt(line, Math.min(sv, line.length - 0.01)));
        return [p[0] + n[0] * off * w, p[1] + n[1] * off * w];
    });
    l.path.line = arcPolyline(resample(bent, PATH_STEP));
    (l.path.speedCaps ??= []).push([p0 - WEAVE_RAMP, p1 + WEAVE_RAMP, WEAVE_SPEED]);
    return true;
}

/** Rectangle centred on `c`: ±`halfA` along unit `a`, ±`halfB` along a's perpendicular. */
function quadAround(c: V2, a: V2, halfA: number, halfB: number): [V2, V2, V2, V2] {
    const b = rightOf(a);
    const A = scale(a, halfA), B = scale(b, halfB);
    return [add(add(c, A), B), add(sub(c, A), B), sub(sub(c, A), B), sub(add(c, A), B)];
}

/** Stroke a polyline into quads; `dash` = [on, off] lengths or null for solid. */
function pushStroke(out: Marking[], kind: MarkingKind, pts: V2[], width: number, dash: [number, number] | null) {
    const line = arcPolyline(pts);
    const period = dash ? dash[0] + dash[1] : 3;
    const on = dash ? dash[0] : 3;
    for (let s = 0; s < line.length - 0.5; s += period) {
        const s1 = Math.min(line.length, s + on);
        const a = pointAt(line, s), b = pointAt(line, s1);
        const d = norm(sub(b, a));
        out.push({ kind, quad: quadAround(scale(add(a, b), 0.5), d, dist(a, b) / 2, width / 2) });
    }
}
