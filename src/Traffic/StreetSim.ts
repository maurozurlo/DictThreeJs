/**
 * StreetSim — the cosmetic street traffic simulation (ADR-0014).
 *
 * One object steps every car and pedestrian on the street in fixed ticks; React components only
 * read the resulting poses. Pure TypeScript, no Three.js, seeded, so it runs headless in tests.
 *
 * CARS travel 1D along lane paths (RoadBuilder), with the Intelligent Driver Model for smooth
 * car-following — a car can never rear-end its leader. Wherever paths conflict (merges, crossing
 * turns, zebras — see Conflicts.ts) a car must CLAIM the zone before its body enters it:
 *   - claims are made a comfortable braking distance ahead, so a refused car always stops in time;
 *   - a junction connector's zones are claimed all-or-nothing (no hold-and-wait deadlock), and only
 *     if the exit lane has room (never block the box);
 *   - a lower-priority car yields when a higher-priority one will reach the zone within the
 *     gap-acceptance window; priority = road rank + waiting time (no starvation);
 *   - zebras: cars yield to peds on the crossing, and to peds waiting at it while they can still
 *     stop comfortably (until their patience runs out).
 * Heading follows the rear-axle → front-axle chord along the route, so turns are smooth.
 *
 * PEDS walk sidewalk loops (1D arc length + lateral offset inside the sidewalk band). Neighbours
 * come from a uniform spatial grid; peds keep right, sidestep oncoming walkers, overtake slower
 * ones on the left, steer around street furniture and follow when boxed in. A final pass pushes
 * apart any residual overlap, so bodies never interpenetrate. Zebras: walk to the kerb, wait for
 * the crossing to be clear of committed cars, cross while holding it.
 */
import {
    CAR_ACCEL, CAR_AGING_PER_S, CAR_AXLE_FRACTION, CAR_CLAIM_MARGIN, CAR_COMFORT_DECEL, CAR_GAP_ACCEPT_S,
    CAR_HEADWAY_S, CAR_IDLE_RELEASE_S, CAR_JAM_GAP, CAR_LATERAL_ACCEL, CAR_MAX, CAR_MAX_DECEL, CAR_PED_SENSOR, CAR_RANK_WEIGHT,
    CAR_SPAWN_MEAN_S, CAR_TURN_WEIGHT, CAR_ZEBRA_PATIENCE_S, PED_ACCEL, PED_CROSS_CHANCE, PED_HEADING_DEV_MAX, PED_HEADING_EASE_S,
    PED_KERB_WAIT_BACK, PED_LATERAL_ACCEL, PED_LATERAL_GAIN, PED_LATERAL_SPEED, PED_LOOKAHEAD, PED_ONCOMING_SIDE_TIE, PED_PERSONAL,
    PED_RADIUS, PED_STUCK_TURN_S, PED_SPEED_MAX, PED_SPEED_MIN, PED_TURN_RATE, PED_WALKWAY_CHANCE, PED_YIELD_GAP, SIM_DT,
} from '../Constants/Traffic.ts';
import { buildConflicts, REF_HALF_LEN, type Conflicts, type PathZoneRef } from './Conflicts.ts';
import type { RoadNetwork } from './RoadBuilder.ts';
import { mulberry32, type Rng } from './Rng.ts';
import { newSample, sampleRt, sampleRtSmooth, speedEnvelope, toRtPath, vertexAt, type PathSample, type RtPath } from './RtPath.ts';
import { SpatialGrid } from './SpatialGrid.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CarSpec {
    model: string;
    halfLen: number;
    halfWidth: number;
}

export interface Car {
    /** Unique per spawn (never reused). */
    serial: number;
    spec: CarSpec;
    /** route[0] is the current path; further entries are the planned continuation. */
    route: number[];
    /** Path driven before route[0] (rear-axle sampling), -1 if none. */
    prev: number;
    s: number;
    v: number;
    /** Total distance driven — zone release marks and wheel spin. */
    odo: number;
    held: Held[];
    /** Sim time this car started being refused a zone, -1 while not waiting. */
    waitSince: number;
    idleSince: number;
    x: number;
    z: number;
    /** Heading: direction (sin yaw, cos yaw); a model facing +Z at yaw 0. */
    yaw: number;
    score: number;
}

interface Held {
    kind: 'car' | 'cross';
    zone: number;
    side: 0 | 1;
    /** odo at which the car's FRONT reaches the zone (idle release before entering). */
    entryOdo: number;
    /** odo at which the car's REAR leaves the zone. */
    releaseOdo: number;
}

export type PedMode = 'loop' | 'link' | 'wait';

export interface Ped {
    id: number;
    speed0: number;
    mode: PedMode;
    loop: number;
    s: number;
    /** Travel direction along the loop (+1 / -1). */
    dir: 1 | -1;
    /** Lateral offset from the loop/link line, along rightOf(path tangent). */
    u: number;
    /** Sidestep velocity: rate of change of u (u/s) — eased, so it never flips sign in one tick. */
    latV: number;
    /** Where along the kerb (u) a waiting ped shuffles to while the zebra is busy. */
    uWait: number;
    v: number;
    /** Link index: crossings first, then walkways. */
    link: number;
    t: number;
    dirL: 1 | -1;
    /** True while between the kerbs of a zebra (holding it). */
    onRoad: boolean;
    cooldownUntil: number;
    /** Seconds spent boxed in (loop mode, not moving). */
    stuckFor: number;
    x: number;
    z: number;
    yaw: number;
    /** Height above the ground plane (sidewalk vs asphalt). */
    y: number;
}

export interface StreetSimOptions {
    seed?: number;
    /** Car model + footprint for the n-th spawn. */
    pickCar: (serial: number) => CarSpec;
    maxCars?: number;
    /** Street furniture peds steer around. */
    obstacles?: Array<{ x: number; z: number; r: number }>;
    sidewalkY?: number;
    asphaltY?: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface LinkInfo {
    kind: 'crossing' | 'walkway';
    /** Index into net.crossings (crossing kind) — the zebra this link is. */
    crossing: number;
    rt: RtPath;
    /** Kerb arc lengths (crossings): peds wait before kerbA going +1, before kerbB going -1. */
    kerbA: number;
    kerbB: number;
    halfWidth: number;
    ends: [{ loop: number; s: number } | null, { loop: number; s: number } | null];
}

interface LoopLinkPoint {
    s: number;
    link: number;
    end: 0 | 1;
}

const MAX_PEDS = 128;
const NEIGHBOUR_BUF = 64;
/** A car on a sibling branch still counts as a leader while its rear is within this of the fork. */
const SIBLING_REACH = 8;
/** Car zones this close to a junction connector are claimed together with it (u). */
const JUNCTION_WINDOW = 25;
/** A waiting car this close (u) to a zone counts as arriving now for gap acceptance. */
const WAITING_AT_LINE = 10;

function idm(v: number, v0: number, gap: number, vLead: number): number {
    const dv = v - vLead;
    const sStar = CAR_JAM_GAP + Math.max(0, v * CAR_HEADWAY_S + (v * dv) / (2 * Math.sqrt(CAR_ACCEL * CAR_COMFORT_DECEL)));
    const g = Math.max(gap, 0.05);
    return CAR_ACCEL * (1 - (v / Math.max(v0, 0.1)) ** 4 - (sStar / g) ** 2);
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class StreetSim {
    readonly net: RoadNetwork;
    readonly conflicts: Conflicts;
    readonly paths: RtPath[];
    private readonly env: Float64Array[];
    private readonly rng: Rng;
    private readonly opts: Required<Omit<StreetSimOptions, 'seed' | 'obstacles'>>;
    time = 0;
    private acc = 0;

    // ---- cars ----
    readonly cars: Car[] = [];
    private serial = 0;
    private readonly onPath: Car[][];
    private readonly carZoneHold: Int16Array;
    private readonly apprScore: Float64Array;
    private readonly apprEta: Float64Array;
    private readonly spawnLanes: number[];
    private readonly nextSpawn: Float64Array;
    private readonly sampleA: PathSample = newSample();
    private readonly sampleB: PathSample = newSample();

    // ---- crossings (shared by cars and peds) ----
    readonly pedOn: Int16Array;
    readonly pedWait: Int16Array;
    readonly carHold: Int16Array;

    // ---- peds ----
    readonly peds: Ped[] = [];
    private readonly pedById = new Map<number, Ped>();
    readonly loops: RtPath[];
    private readonly loopHalf: Float64Array;
    readonly links: LinkInfo[];
    private readonly loopLinks: LoopLinkPoint[][];
    private readonly pedGrid: SpatialGrid;
    private readonly pedX = new Float64Array(MAX_PEDS);
    private readonly pedZ = new Float64Array(MAX_PEDS);
    private obstacles: Array<{ x: number; z: number; r: number }> = [];
    private obstacleGrid!: SpatialGrid;
    private readonly nbuf = new Int32Array(NEIGHBOUR_BUF);

    constructor(net: RoadNetwork, options: StreetSimOptions) {
        this.net = net;
        this.rng = mulberry32(options.seed ?? 1);
        this.opts = {
            pickCar: options.pickCar,
            maxCars: options.maxCars ?? CAR_MAX,
            sidewalkY: options.sidewalkY ?? 0.25,
            asphaltY: options.asphaltY ?? 0,
        };
        this.conflicts = buildConflicts(net);
        this.paths = net.paths.map((p) => toRtPath(p.line));
        this.env = net.paths.map((p, i) => speedEnvelope(this.paths[i], p.speed, CAR_LATERAL_ACCEL, CAR_COMFORT_DECEL, p.speedCaps));
        this.onPath = net.paths.map(() => []);
        this.carZoneHold = new Int16Array(this.conflicts.carZones.length * 2);
        this.apprScore = new Float64Array(this.conflicts.carZones.length * 2);
        this.apprEta = new Float64Array(this.conflicts.carZones.length * 2);
        this.spawnLanes = net.paths.filter((p) => p.spawn).map((p) => p.id);
        this.nextSpawn = new Float64Array(this.spawnLanes.length).map(() => this.rng() * CAR_SPAWN_MEAN_S);

        const nc = net.crossings.length;
        this.pedOn = new Int16Array(nc);
        this.pedWait = new Int16Array(nc);
        this.carHold = new Int16Array(nc);

        this.loops = net.loops.map((l) => toRtPath(l.line));
        this.loopHalf = Float64Array.from(net.loops.map((l) => l.halfWidth));
        this.links = [
            ...net.crossings.map((c, ci): LinkInfo => {
                const rt = toRtPath(c.line);
                return {
                    kind: 'crossing', crossing: ci, rt, kerbA: rt.cum[1], kerbB: rt.cum[2],
                    halfWidth: Math.max(0.6, c.halfBand - 1.0), ends: [c.links[0], c.links[1]],
                };
            }),
            ...net.walkways.map((w): LinkInfo => ({
                kind: 'walkway', crossing: -1, rt: toRtPath(w.line), kerbA: 0, kerbB: 0, halfWidth: 2.5, ends: [w.links[0], w.links[1]],
            })),
        ];
        this.loopLinks = net.loops.map(() => []);
        this.links.forEach((l, li) => l.ends.forEach((e, end) => {
            if (e) this.loopLinks[e.loop].push({ s: e.s, link: li, end: end as 0 | 1 });
        }));
        for (const list of this.loopLinks) list.sort((a, b) => a.s - b.s);

        const { min, max } = net.plan.bounds;
        this.pedGrid = new SpatialGrid(min[0], min[1], max[0], max[1], 8, MAX_PEDS);
        this.setObstacles(options.obstacles ?? []);

        if (this.spawnLanes.length === 0) this.seedClosedNetwork();
    }

    // =========================================================================
    // Stepping
    // =========================================================================

    /** Accumulates real frame time and runs whole fixed ticks. */
    advance(frameDt: number): void {
        this.acc = Math.min(this.acc + frameDt, 0.25);
        while (this.acc >= SIM_DT) {
            this.step(SIM_DT);
            this.acc -= SIM_DT;
        }
    }

    /** Runs `seconds` of simulation as fast as possible (pre-warm before first view). */
    warmUp(seconds: number): void {
        for (let t = 0; t < seconds; t += SIM_DT) this.step(SIM_DT);
    }

    step(dt: number): void {
        this.time += dt;
        this.rebuildPedGrid();
        this.stepCars(dt);
        this.stepPeds(dt);
    }

    // =========================================================================
    // Cars
    // =========================================================================

    private seedClosedNetwork(): void {
        for (const p of this.net.paths) {
            if (p.kind !== 'lane') continue;
            const n = Math.floor(this.paths[p.id].length / 90);
            for (let k = 0; k < n && this.cars.length < this.opts.maxCars; k++) {
                const spec = this.opts.pickCar(this.serial);
                this.addCar(spec, p.id, (k + 0.5) * (this.paths[p.id].length / n), 0);
            }
        }
    }

    private addCar(spec: CarSpec, path: number, s: number, v: number): Car {
        const car: Car = {
            serial: this.serial++, spec, route: [path], prev: -1, s, v, odo: 0, held: [],
            waitSince: -1, idleSince: -1, x: 0, z: 0, yaw: 0, score: 0,
        };
        this.planRoute(car);
        this.cars.push(car);
        this.pose(car);
        return car;
    }

    private planRoute(car: Car): void {
        while (car.route.length < 5) {
            const last = this.net.paths[car.route[car.route.length - 1]];
            if (last.next.length === 0) return;
            let pick = last.next[0];
            if (last.next.length > 1) {
                let total = 0;
                for (const n of last.next) total += CAR_TURN_WEIGHT[this.net.paths[n].turn ?? 'straight'];
                let r = this.rng() * total;
                for (const n of last.next) {
                    r -= CAR_TURN_WEIGHT[this.net.paths[n].turn ?? 'straight'];
                    if (r <= 0) { pick = n; break; }
                }
            }
            car.route.push(pick);
        }
    }

    private len(path: number): number {
        return this.paths[path].length;
    }

    private holds(car: Car, kind: 'car' | 'cross', zone: number, side: number): boolean {
        for (const h of car.held) if (h.kind === kind && h.zone === zone && h.side === side) return true;
        return false;
    }

    private stepCars(dt: number): void {
        const { cars } = this;
        // ---- occupancy ---------------------------------------------------------------------
        for (const list of this.onPath) list.length = 0;
        for (const c of cars) this.onPath[c.route[0]].push(c);
        for (const list of this.onPath) if (list.length > 1) list.sort((a, b) => a.s - b.s);

        // ---- approach registry (gap acceptance) ---------------------------------------------
        this.apprScore.fill(-Infinity);
        this.apprEta.fill(Infinity);
        for (const c of cars) {
            c.score = this.net.paths[c.route[0]].rank * CAR_RANK_WEIGHT + (c.waitSince >= 0 ? (this.time - c.waitSince) * CAR_AGING_PER_S : 0);
            const look = Math.max(40, (c.v * c.v) / (2 * CAR_COMFORT_DECEL) + 30);
            this.forZonesAhead(c, look, (ref, distFront, k) => {
                if (ref.kind !== 'car' || distFront < 0) return;
                // A car already waiting at the line is "arriving now" — that is what lets its
                // growing priority (aging) make main-road traffic yield to it. Only if it could
                // actually go, though: a car stuck behind a full exit must not hold others back.
                let eta = distFront / Math.max(c.v, 0.5);
                if (c.waitSince >= 0 && distFront < WAITING_AT_LINE) {
                    const kc = this.junctionOf(c, k, ref);
                    if (kc < 0 || this.exitHasRoom(c, c.route[kc])) eta = 0;
                }
                if (eta > CAR_GAP_ACCEPT_S) return;
                const slot = ref.zone * 2 + ref.side;
                if (c.score > this.apprScore[slot] || (c.score === this.apprScore[slot] && eta < this.apprEta[slot])) {
                    this.apprScore[slot] = c.score;
                    this.apprEta[slot] = eta;
                }
            });
        }

        // ---- claims, highest priority first --------------------------------------------------
        const order = cars.slice().sort((a, b) => b.score - a.score || a.serial - b.serial);
        const stopGap = new Map<Car, number>();
        for (const c of order) stopGap.set(c, this.claimZones(c));

        // ---- motion ---------------------------------------------------------------------------
        for (let i = cars.length - 1; i >= 0; i--) {
            const c = cars[i];
            const { gap, vLead } = this.leaderGap(c);
            const stop = stopGap.get(c) ?? Infinity;
            const pedGap = this.pedSensorGap(c);
            const v0 = this.desiredSpeed(c);
            let a = gap < Infinity ? idm(c.v, v0, gap, vLead) : CAR_ACCEL * (1 - (c.v / Math.max(v0, 0.1)) ** 4);
            if (stop < Infinity) a = Math.min(a, idm(c.v, v0, stop, 0));
            if (pedGap < Infinity) a = Math.min(a, idm(c.v, v0, pedGap, 0));
            a = Math.max(a, -CAR_MAX_DECEL);
            const vNew = Math.max(0, c.v + a * dt);
            let ds = (c.v + vNew) * 0.5 * dt;
            // hard limits: never past a refused zone, never into the leader's body
            const hardLimit = Math.min(stop - 0.2, gap - 0.3);
            if (ds > hardLimit) ds = Math.max(0, hardLimit);
            c.v = ds <= 0 && vNew > 0 && hardLimit <= 0 ? 0 : vNew;
            c.s += ds;
            c.odo += ds;
            if (c.v < 0.3) { if (c.idleSince < 0) c.idleSince = this.time; } else c.idleSince = -1;

            // advance along the route
            let despawn = false;
            while (c.s > this.len(c.route[0])) {
                if (c.route.length < 2) {
                    if (this.net.paths[c.route[0]].sink) { despawn = true; break; }
                    c.s = this.len(c.route[0]);
                    c.v = 0;
                    break;
                }
                c.s -= this.len(c.route[0]);
                c.prev = c.route.shift()!;
                this.planRoute(c);
            }
            if (despawn) {
                this.releaseAll(c);
                cars.splice(i, 1);
                continue;
            }
            // releases: rear past the zone, or idle long before entering it
            for (let h = c.held.length - 1; h >= 0; h--) {
                const z = c.held[h];
                const idleOut = c.idleSince >= 0 && this.time - c.idleSince > CAR_IDLE_RELEASE_S && c.odo < z.entryOdo - 0.5;
                if (c.odo >= z.releaseOdo || idleOut) this.release(c, h);
            }
            this.pose(c);
        }

        this.spawnCars();
    }

    /**
     * How far a zone's centre interval reaches beyond [s0, s1] for this car: car zones were found
     * with a reference footprint (grow for longer cars); zebra zones are bare bands (grow by the
     * whole half-length so the body stays off the stripes).
     */
    private ext(c: Car, ref: PathZoneRef): number {
        return ref.kind === 'cross' ? c.spec.halfLen : Math.max(0, c.spec.halfLen - REF_HALF_LEN);
    }

    /**
     * Walks conflict zones along the car's route within `look` units. `dist` is how far the car
     * can still move before its body enters the zone (negative = already inside).
     */
    private forZonesAhead(c: Car, look: number, fn: (ref: PathZoneRef, dist: number, k: number, offset: number) => boolean | void): void {
        const hl = c.spec.halfLen;
        let offset = -c.s; // distance from car centre to the start of route[k]
        for (let k = 0; k < c.route.length; k++) {
            const path = c.route[k];
            if (offset - hl > look) return;
            for (const ref of this.conflicts.byPath[path]) {
                const e = this.ext(c, ref);
                if (k === 0 && ref.s1 + e < c.s) continue; // already through
                const dist = offset + ref.s0 - e;
                if (dist > look) break;
                if (fn(ref, dist, k, offset)) return;
            }
            offset += this.len(path);
        }
    }

    /** Claims zones ahead; returns the front-bumper gap to the first refused zone (or Infinity). */
    private claimZones(c: Car): number {
        const claimDist = (c.v * c.v) / (2 * CAR_COMFORT_DECEL) + CAR_CLAIM_MARGIN;
        let stop = Infinity;
        let refused = false;
        this.forZonesAhead(c, claimDist + 40, (ref, dist, k, offset) => {
            if (this.holds(c, ref.kind, ref.zone, ref.kind === 'car' ? ref.side : 0)) return;
            if (dist > claimDist) return true; // zones are in route order: nothing further is due yet
            if (ref.kind === 'cross') {
                if (this.claimCrossZone(c, ref, offset, dist)) return;
                stop = Math.min(stop, dist);
                refused = true;
                return true;
            }
            const kc = this.junctionOf(c, k, ref);
            const ok = kc >= 0 ? this.claimBatch(c, kc, dist <= 0) : this.claimSingle(c, ref, offset, dist <= 0);
            if (ok) return;
            stop = Math.min(stop, dist, kc >= 0 ? this.offsetTo(c, kc) - c.spec.halfLen : Infinity);
            refused = true;
            return true;
        });
        if (refused) { if (c.waitSince < 0) c.waitSince = this.time; } else c.waitSince = -1;
        return stop;
    }

    /** Distance from the car centre to the start of route[k]. */
    private offsetTo(c: Car, k: number): number {
        let off = -c.s;
        for (let i = 0; i < k; i++) off += this.len(c.route[i]);
        return off;
    }

    /**
     * Route index of the junction connector a car zone belongs to, or -1 for a free-standing
     * zone. Zones on the approach lane's last JUNCTION_WINDOW units, on the connector itself and on
     * the exit lane's first JUNCTION_WINDOW units form one junction batch.
     */
    private junctionOf(c: Car, k: number, ref: PathZoneRef): number {
        const isConn = (i: number) => i >= 0 && i < c.route.length && this.net.paths[c.route[i]].kind === 'connector';
        if (isConn(k)) return k;
        if (isConn(k + 1) && this.len(c.route[k]) - ref.s0 <= JUNCTION_WINDOW) return k + 1;
        if (isConn(k - 1) && ref.s0 <= JUNCTION_WINDOW) return k - 1;
        return -1;
    }

    private otherSideBusy(c: Car, zone: number, side: 0 | 1): boolean {
        const other = (zone * 2 + (1 - side));
        const self = this.holds(c, 'car', zone, 1 - side) ? 1 : 0;
        if (this.carZoneHold[other] - self > 0) return true;
        const sc = this.apprScore[other];
        return sc > c.score || (sc === c.score && sc > -Infinity && this.apprEta[other] < this.etaTo(c, zone, side));
    }

    private etaTo(c: Car, zone: number, side: 0 | 1): number {
        let eta = Infinity;
        this.forZonesAhead(c, 80, (ref, dist) => {
            if (ref.kind === 'car' && ref.zone === zone && ref.side === side) {
                eta = Math.max(0, dist) / Math.max(c.v, 0.5);
                return true;
            }
        });
        return eta;
    }

    private grantCar(c: Car, ref: PathZoneRef, offset: number): void {
        const e = this.ext(c, ref);
        this.carZoneHold[ref.zone * 2 + ref.side]++;
        c.held.push({
            kind: 'car', zone: ref.zone, side: ref.side,
            entryOdo: c.odo + offset + ref.s0 - e,
            releaseOdo: c.odo + offset + ref.s1 + e + 0.3,
        });
    }

    private claimSingle(c: Car, ref: PathZoneRef, offset: number, force: boolean): boolean {
        if (!force && this.otherSideBusy(c, ref.zone, ref.side)) return false;
        this.grantCar(c, ref, offset);
        return true;
    }

    /**
     * All-or-nothing claim of the junction batch around connector route[kc] (see junctionOf), and
     * only if the exit lane has room for the whole car — so a car never holds part of a junction
     * while waiting for the rest (no hold-and-wait, hence no deadlock) and never blocks the box.
     */
    private claimBatch(c: Car, kc: number, force = false): boolean {
        const batch = this.batchScratch;
        batch.length = 0;
        for (let kk = Math.max(0, kc - 1); kk <= Math.min(c.route.length - 1, kc + 1); kk++) {
            const path = c.route[kk];
            const off = this.offsetTo(c, kk);
            for (const ref of this.conflicts.byPath[path]) {
                if (ref.kind !== 'car' || this.holds(c, 'car', ref.zone, ref.side)) continue;
                if (kk === kc - 1 && this.len(path) - ref.s0 > JUNCTION_WINDOW) continue;
                if (kk === kc + 1 && ref.s0 > JUNCTION_WINDOW) continue;
                if (kk === 0 && ref.s1 + this.ext(c, ref) < c.s) continue;
                batch.push({ ref, offset: off });
            }
        }
        if (!force) {
            for (const { ref } of batch) if (this.otherSideBusy(c, ref.zone, ref.side)) return false;
            if (!this.exitHasRoom(c, c.route[kc])) return false;
        }
        for (const { ref, offset } of batch) this.grantCar(c, ref, offset);
        return true;
    }

    private readonly batchScratch: Array<{ ref: PathZoneRef; offset: number }> = [];

    /**
     * Never block the box: the lane after `conn` must have room for the whole car, counting cars
     * already granted onto other connectors that feed the same lane.
     */
    private exitHasRoom(c: Car, conn: number): boolean {
        const exit = this.net.paths[conn].next[0];
        if (exit === undefined || this.len(exit) <= c.spec.halfLen * 2 + CAR_JAM_GAP + 2) return true;
        const need = c.spec.halfLen * 2 + CAR_JAM_GAP;
        let used = need, queued = false;
        for (const o of this.onPath[exit]) {
            if (o === c) continue;
            if (o.s - o.spec.halfLen < need) return false;
            used += o.spec.halfLen * 2 + CAR_JAM_GAP;
            if (o.v < 2) queued = true;
        }
        for (const feeder of this.net.paths[exit].prev) {
            if (feeder === conn) continue;
            for (const o of this.onPath[feeder]) if (o !== c) used += o.spec.halfLen * 2 + CAR_JAM_GAP;
        }
        return !(queued && used > this.len(exit));
    }

    private claimCrossZone(c: Car, ref: PathZoneRef, offset: number, distFront: number): boolean {
        const cr = this.conflicts.crossZones[ref.zone].crossing;
        const hl = c.spec.halfLen;
        if (distFront > 0) {
            if (this.pedOn[cr] > 0) return false;
            const canStop = distFront > (c.v * c.v) / (2 * CAR_COMFORT_DECEL) - 0.5;
            const patient = c.waitSince < 0 || this.time - c.waitSince < CAR_ZEBRA_PATIENCE_S;
            if (this.pedWait[cr] > 0 && canStop && patient) return false;
            // don't stop ON the zebra: there must be room for the whole car past it before the
            // next car or the next junction it still has to queue for
            const travel = offset + ref.s1 + hl; // front movement until the rear clears the band
            if (canStop && this.roomAhead(c) < travel + CAR_JAM_GAP) return false;
        }
        this.carHold[cr]++;
        c.held.push({ kind: 'cross', zone: ref.zone, side: 0, entryOdo: c.odo + offset + ref.s0 - hl, releaseOdo: c.odo + offset + ref.s1 + hl + 0.3 });
        return true;
    }

    /** Front-bumper distance to whatever will stop this car next: its leader or an unclaimed junction. */
    private roomAhead(c: Car): number {
        let room = this.leaderGap(c).gap;
        const hl = c.spec.halfLen;
        let offset = this.len(c.route[0]) - c.s;
        for (let k = 1; k < c.route.length && offset - hl < room; k++) {
            const p = c.route[k];
            if (this.net.paths[p].kind === 'connector') {
                const unclaimed = this.conflicts.byPath[p].some((r) => r.kind === 'car' && !this.holds(c, 'car', r.zone, r.side));
                // A junction right after a zebra: take both together or neither, so the car never
                // has to stop on the stripes while queuing for the junction.
                if (unclaimed && !this.claimBatch(c, k)) { room = Math.min(room, offset - hl); break; }
            }
            offset += this.len(p);
        }
        return room;
    }

    private release(c: Car, h: number): void {
        const z = c.held[h];
        if (z.kind === 'car') this.carZoneHold[z.zone * 2 + z.side]--;
        else this.carHold[this.conflicts.crossZones[z.zone].crossing]--;
        c.held.splice(h, 1);
    }

    private releaseAll(c: Car): void {
        for (let h = c.held.length - 1; h >= 0; h--) this.release(c, h);
    }

    /**
     * Gap from the front bumper to the rear bumper of the next car along the route. Cars that just
     * turned onto a SIBLING branch (another successor of the same path) count too while their rear
     * is still near the branch point — physically they are still in front of us.
     */
    private leaderGap(c: Car): { gap: number; vLead: number } {
        const hl = c.spec.halfLen;
        let offset = -c.s;
        let gap = Infinity, vLead = 0;
        for (let k = 0; k < c.route.length; k++) {
            const path = c.route[k];
            for (const o of this.onPath[path]) {
                if (o === c || offset + o.s <= 0) continue; // self, or behind / level with us
                const g = offset + o.s - o.spec.halfLen - hl;
                if (g < gap) { gap = g; vLead = o.v; }
            }
            if (k > 0) {
                for (const sib of this.net.paths[c.route[k - 1]].next) {
                    if (sib === path) continue;
                    for (const o of this.onPath[sib]) {
                        if (o.s - o.spec.halfLen > SIBLING_REACH) continue;
                        const g = offset + o.s - o.spec.halfLen - hl;
                        if (g < gap) { gap = g; vLead = o.v; }
                    }
                }
            }
            if (gap < Infinity) return { gap, vLead };
            offset += this.len(path);
            if (offset > 120) break;
        }
        return { gap, vLead };
    }

    /** Lane speed envelope at the car plus braking previews of the next paths. */
    private desiredSpeed(c: Car): number {
        const p0 = c.route[0];
        let v0 = this.env[p0][vertexAt(this.paths[p0], c.s)];
        let dist = this.len(p0) - c.s;
        for (let k = 1; k < Math.min(3, c.route.length); k++) {
            const e = this.env[c.route[k]][0];
            v0 = Math.min(v0, Math.sqrt(e * e + 2 * CAR_COMFORT_DECEL * Math.max(0, dist)));
            dist += this.len(c.route[k]);
        }
        return Math.max(v0, 1);
    }

    /** Safety net: front gap to any ped standing in the car's path (normally never triggers). */
    private pedSensorGap(c: Car): number {
        if (this.peds.length === 0) return Infinity;
        const hl = c.spec.halfLen, hw = c.spec.halfWidth;
        const f = this.sampleRoute(c, hl, this.sampleA);
        const reach = CAR_PED_SENSOR + c.v * 0.4;
        const n = this.pedGrid.query(f.x + f.tx * reach * 0.5, f.z + f.tz * reach * 0.5, reach * 0.5 + hw + 2, this.nbuf);
        let gap = Infinity;
        for (let k = 0; k < n; k++) {
            const p = this.peds[this.nbuf[k]];
            if (!p.onRoad) continue;
            const dx = p.x - f.x, dz = p.z - f.z;
            const a = dx * f.tx + dz * f.tz;
            const l = -dx * f.tz + dz * f.tx;
            if (a > -0.5 && a < reach && Math.abs(l) < hw + PED_RADIUS + 0.3) gap = Math.min(gap, Math.max(0, a - PED_RADIUS));
        }
        return gap;
    }

    /** Samples the car's route at `offset` from its centre (negative reaches into the previous path). */
    private sampleRoute(c: Car, offset: number, out: PathSample): PathSample {
        let s = c.s + offset;
        if (s < 0) {
            if (c.prev >= 0) return sampleRt(this.paths[c.prev], this.len(c.prev) + s, out);
            return sampleRt(this.paths[c.route[0]], 0, out);
        }
        let k = 0;
        while (s > this.len(c.route[k]) && k + 1 < c.route.length) { s -= this.len(c.route[k]); k++; }
        return sampleRt(this.paths[c.route[k]], s, out);
    }

    private pose(c: Car): void {
        const ax = c.spec.halfLen * CAR_AXLE_FRACTION;
        const f = this.sampleRoute(c, ax, this.sampleA);
        const fx = f.x, fz = f.z;
        const r = this.sampleRoute(c, -ax, this.sampleB);
        c.x = (fx + r.x) / 2;
        c.z = (fz + r.z) / 2;
        const dx = fx - r.x, dz = fz - r.z;
        if (dx * dx + dz * dz > 1e-6) c.yaw = Math.atan2(dx, dz);
    }

    private spawnCars(): void {
        for (let i = 0; i < this.spawnLanes.length; i++) {
            if (this.time < this.nextSpawn[i]) continue;
            if (this.cars.length >= this.opts.maxCars) { this.nextSpawn[i] = this.time + 1; continue; }
            const lane = this.spawnLanes[i];
            const spec = this.opts.pickCar(this.serial);
            const need = spec.halfLen * 2 + CAR_JAM_GAP + 2;
            let clear = true;
            for (const o of this.onPath[lane]) if (o.s - o.spec.halfLen < need) { clear = false; break; }
            if (!clear) { this.nextSpawn[i] = this.time + 1; continue; }
            this.addCar(spec, lane, spec.halfLen + 0.5, this.env[lane][0] * 0.6);
            this.nextSpawn[i] = this.time - Math.log(1 - this.rng()) * CAR_SPAWN_MEAN_S;
        }
    }

    // =========================================================================
    // Peds
    // =========================================================================

    /** Adds a walker on a loop. `loop` = index into net.loops (random when omitted). */
    addPed(id: number, loop?: number): Ped {
        const L = loop ?? this.pickLoop();
        const rt = this.loops[L];
        const p: Ped = {
            id, speed0: PED_SPEED_MIN + this.rng() * (PED_SPEED_MAX - PED_SPEED_MIN), mode: 'loop', loop: L,
            s: this.rng() * rt.length, dir: this.rng() < 0.5 ? 1 : -1, u: (this.rng() - 0.5) * this.loopHalf[L], latV: 0, uWait: 0,
            v: 0, link: -1, t: 0, dirL: 1, onRoad: false, cooldownUntil: 0, stuckFor: 0, x: 0, z: 0, yaw: 0, y: this.opts.sidewalkY,
        };
        p.v = p.speed0;
        this.removePed(id); // re-adding an id replaces its walker
        this.peds.push(p);
        this.pedById.set(id, p);
        this.pedPose(p, 0);
        return p;
    }

    /** Weighted random sidewalk loop (RoadPlan BlockDef.pedWeight). */
    private pickLoop(): number {
        const loops = this.net.loops;
        const total = loops.reduce((a, l) => a + l.pedWeight, 0);
        let r = this.rng() * total;
        for (const l of loops) { r -= l.pedWeight; if (r <= 0) return l.id; }
        return loops.length - 1;
    }

    /** Replaces the street furniture peds steer around (circles on the ground plane). */
    setObstacles(list: ReadonlyArray<{ x: number; z: number; r: number }>): void {
        this.obstacles = list.slice();
        const { min, max } = this.net.plan.bounds;
        this.obstacleGrid = new SpatialGrid(min[0], min[1], max[0], max[1], 8, Math.max(1, this.obstacles.length));
        this.obstacleGrid.rebuild(this.obstacles.length, this.obstacles.map((o) => o.x), this.obstacles.map((o) => o.z));
    }

    removePed(id: number): void {
        const i = this.peds.findIndex((p) => p.id === id);
        if (i < 0) return;
        const p = this.peds[i];
        if (p.mode === 'wait') this.pedWait[this.links[p.link].crossing]--;
        if (p.onRoad) this.pedOn[this.links[p.link].crossing]--;
        this.peds.splice(i, 1);
        this.pedById.delete(id);
    }

    /** The walker for a citizen id, if it is on the street. */
    getPed(id: number): Ped | undefined {
        return this.pedById.get(id);
    }

    private rebuildPedGrid(): void {
        const n = Math.min(this.peds.length, MAX_PEDS);
        for (let i = 0; i < n; i++) { this.pedX[i] = this.peds[i].x; this.pedZ[i] = this.peds[i].z; }
        this.pedGrid.rebuild(n, this.pedX, this.pedZ);
    }

    /**
     * Path frame of a ped: the sample of its current loop/link and the corridor half-width. The
     * frame turns smoothly through polyline vertices (sampleRtSmooth), so a ped walking off the
     * centre line never jumps at a corner.
     */
    private pedFrame(p: Ped, out: PathSample): number {
        if (p.mode === 'loop') {
            sampleRtSmooth(this.loops[p.loop], p.s, out);
            return this.loopHalf[p.loop];
        }
        const l = this.links[p.link];
        sampleRtSmooth(l.rt, p.t, out);
        return l.halfWidth;
    }

    /**
     * Ped steering, one tick. Each ped ahead (and each furniture base) narrows a band [lo, hi] of
     * lateral offsets the walker may use; the walker eases toward its keep-right line clamped into
     * that band. The bounds sit at absolute offsets (where the other ped IS), not relative to where
     * the walker is now, so once it has stepped aside the constraint is simply satisfied and it
     * stays put — no stepping back into the other ped's way and out again every few ticks.
     * Whoever can't clear a ped ahead in time slows to keep a gap and waits until the way is clear.
     */
    private stepPeds(dt: number): void {
        const { peds } = this;
        const fr = this.sampleA;
        const body = 2 * PED_RADIUS;
        for (let i = 0; i < peds.length; i++) {
            const p = peds[i];
            if (p.mode === 'wait') {
                this.tryStartCrossing(p);
                if (p.mode === 'wait') {
                    // standing at the kerb: shuffle to its spot along it, then wait
                    p.v = 0;
                    this.stepLateral(p, p.uWait, this.pedFrame(p, fr), dt);
                    this.pedPose(p, dt);
                    continue;
                }
            }
            const hw = this.pedFrame(p, fr);
            const dir = p.mode === 'loop' ? p.dir : p.dirL;
            // travel frame
            const tx = fr.tx * dir, tz = fr.tz * dir;
            const rx = -tz, rz = tx;
            const lt = p.u * dir; // lateral in travel frame (+ = travel right)
            let lo = -hw, hi = hw, vCap = p.speed0;
            /** Lateral reach: anything farther to the side than this can't bound the corridor. */
            const reach = 2 * hw + PED_PERSONAL;

            const n = this.pedGrid.query(p.x, p.z, PED_LOOKAHEAD + PED_PERSONAL, this.nbuf);
            for (let k = 0; k < n; k++) {
                const j = this.nbuf[k];
                if (j === i) continue;
                const q = peds[j];
                const dx = q.x - p.x, dz = q.z - p.z;
                const a = dx * tx + dz * tz;
                const l = dx * rx + dz * rz;
                // keep the constraint until it is fully behind (shoulder to shoulder still counts)
                if (a < -PED_RADIUS || a > PED_LOOKAHEAD || Math.abs(l) > reach) continue;
                const qAbs = lt + l; // its lateral offset in my travel frame
                const facing = Math.sin(q.yaw) * tx + Math.cos(q.yaw) * tz;
                if (q.v > 0.3 && facing < -0.3) {
                    // Oncoming. `l` reads the same for both of us (each measures the other on its own
                    // right), so we always choose opposite sides: keep right, unless we are already
                    // clearly offset the other way round — then both pass on the left.
                    if (l < PED_ONCOMING_SIDE_TIE) lo = Math.max(lo, Math.min(hw, qAbs + PED_PERSONAL));
                    else hi = Math.min(hi, Math.max(-hw, qAbs - PED_PERSONAL));
                } else if (q.v < p.speed0 - 0.4 && a > 0) {
                    // Slower or standing: overtake on the left; pass a standing ped on the side it
                    // leaves free. A side "fits" if a body gets by, even short of comfortable room.
                    const leftFits = qAbs + hw >= body + 0.3, rightFits = hw - qAbs >= body + 0.3;
                    const passLeft = leftFits && (q.v > 0.3 || l >= 0 || !rightFits);
                    if (passLeft) hi = Math.min(hi, Math.max(-hw, qAbs - PED_PERSONAL));
                    else if (rightFits) lo = Math.max(lo, Math.min(hw, qAbs + PED_PERSONAL));
                }
                // Yield: still in its way → slow to hold a gap (to a stop if need be) until I've
                // stepped clear or it has moved on.
                if (a > 0 && Math.abs(l) < body + 0.3) {
                    vCap = Math.min(vCap, Math.max(0, q.v * facing) + Math.max(0, a - body - PED_YIELD_GAP) * 1.2);
                }
            }
            const no = this.obstacles.length ? this.obstacleGrid.query(p.x, p.z, PED_LOOKAHEAD + 3, this.nbuf) : 0;
            for (let k = 0; k < no; k++) {
                const o = this.obstacles[this.nbuf[k]];
                const dx = o.x - p.x, dz = o.z - p.z;
                const a = dx * tx + dz * tz;
                const l = dx * rx + dz * rz;
                const need = o.r + PED_RADIUS + 0.4;
                if (a < -o.r || a > PED_LOOKAHEAD || Math.abs(l) > reach + o.r) continue;
                const oAbs = lt + l;
                if (l >= 0) hi = Math.min(hi, Math.max(-hw, oAbs - need));
                else lo = Math.max(lo, Math.min(hw, oAbs + need));
                if (a > -o.r && Math.abs(l) < need - 0.2) vCap = Math.min(vCap, p.speed0 * 0.7);
            }

            const keepRight = hw * 0.35;
            const goal = lo <= hi ? Math.max(lo, Math.min(hi, keepRight)) : (lo + hi) / 2;
            this.stepLateral(p, goal * dir, hw, dt);
            const vt = Math.max(0, Math.min(p.speed0, vCap));
            p.v += Math.max(-PED_ACCEL * 2 * dt, Math.min(PED_ACCEL * dt, vt - p.v));
            // boxed in on a sidewalk for too long: turn around rather than stand there forever
            if (p.mode === 'loop' && p.v < 0.2) {
                p.stuckFor += dt;
                if (p.stuckFor > PED_STUCK_TURN_S) { p.dir = (-p.dir) as 1 | -1; p.stuckFor = 0; }
            } else p.stuckFor = 0;
            const ds = p.v * dt;
            if (p.mode === 'loop') this.moveOnLoop(p, ds);
            else this.moveOnLink(p, ds);
            this.pedPose(p, dt);
        }
        this.separatePeds();
    }

    /**
     * Eases the lateral offset toward `goal` (path frame): sidestep speed proportional to the
     * distance left, capped, and itself acceleration-limited — so a change of plan bends the
     * sidestep instead of reversing it in one tick.
     */
    private stepLateral(p: Ped, goal: number, hw: number, dt: number): void {
        const want = Math.max(-PED_LATERAL_SPEED, Math.min(PED_LATERAL_SPEED, (goal - p.u) * PED_LATERAL_GAIN));
        p.latV += Math.max(-PED_LATERAL_ACCEL * dt, Math.min(PED_LATERAL_ACCEL * dt, want - p.latV));
        const u = p.u + p.latV * dt;
        p.u = Math.max(-hw, Math.min(hw, u));
        if (p.u !== u) p.latV = 0;
    }

    private moveOnLoop(p: Ped, ds: number): void {
        const rt = this.loops[p.loop];
        const s0 = p.s;
        p.s = ((p.s + p.dir * ds) % rt.length + rt.length) % rt.length;
        if (this.time < p.cooldownUntil) return;
        // passed a link point this tick?
        for (const lp of this.loopLinks[p.loop]) {
            const rel = p.dir > 0 ? ((lp.s - s0) % rt.length + rt.length) % rt.length : ((s0 - lp.s) % rt.length + rt.length) % rt.length;
            if (rel <= 0 || rel > ds) continue;
            const link = this.links[lp.link];
            const chance = link.kind === 'crossing' ? PED_CROSS_CHANCE : PED_WALKWAY_CHANCE;
            if (this.rng() >= chance) continue;
            const [ox, oz] = this.pedWorld(p);
            p.mode = 'link';
            p.link = lp.link;
            p.dirL = lp.end === 0 ? 1 : -1;
            p.t = lp.end === 0 ? 0 : link.rt.length;
            p.u = 0;
            this.carryOver(p, ox, oz);
            return;
        }
    }

    /** Where the ped stands right now on its current path (sets p.x/p.z). */
    private pedWorld(p: Ped): [number, number] {
        this.pedPlace(p, this.sampleB);
        return [p.x, p.z];
    }

    /**
     * After switching path (loop ↔ link), re-expresses the ped's old world spot in the new path's
     * frame, so the switch moves nobody — only the frame changes.
     */
    private carryOver(p: Ped, ox: number, oz: number): void {
        this.pedPlace(p, this.sampleB);
        this.nudge(p, ox - p.x, oz - p.z);
        p.latV = 0; // a sidestep on the old path is not one on the new
    }

    private moveOnLink(p: Ped, ds: number): void {
        const l = this.links[p.link];
        const tNew = p.t + p.dirL * ds;
        if (l.kind === 'crossing' && !p.onRoad) {
            // approaching a kerb? stop short of it unless the zebra is ours
            const kerb = p.dirL > 0 ? l.kerbA : l.kerbB;
            const waitAt = kerb - p.dirL * PED_KERB_WAIT_BACK;
            const before = p.dirL > 0 ? p.t <= waitAt + 1e-6 : p.t >= waitAt - 1e-6;
            const reaches = p.dirL > 0 ? tNew >= waitAt : tNew <= waitAt;
            if (before && reaches) {
                p.t = waitAt;
                if (!this.tryStartCrossing(p, true)) return;
            }
        }
        p.t = tNew;
        if (p.onRoad) {
            const leftRoad = p.dirL > 0 ? p.t >= l.kerbB + 0.3 : p.t <= l.kerbA - 0.3;
            if (leftRoad) { p.onRoad = false; this.pedOn[l.crossing]--; }
        }
        if (p.t <= 0 || p.t >= l.rt.length) {
            const end = l.ends[p.t <= 0 ? 0 : 1];
            if (!end) { p.dirL = (p.dirL * -1) as 1 | -1; p.t = Math.max(0, Math.min(l.rt.length, p.t)); return; }
            p.t = Math.max(0, Math.min(l.rt.length, p.t));
            const [ox, oz] = this.pedWorld(p);
            p.mode = 'loop';
            p.loop = end.loop;
            p.s = end.s;
            p.dir = this.rng() < 0.5 ? 1 : -1;
            p.u = 0;
            p.link = -1;
            p.cooldownUntil = this.time + 4;
            this.carryOver(p, ox, oz);
        }
    }

    /** At the kerb: step onto the zebra if no car holds it, else wait. Returns true if crossing. */
    private tryStartCrossing(p: Ped, arriving = false): boolean {
        const cr = this.links[p.link].crossing;
        if (this.carHold[cr] === 0 && !this.carOnCrossing(cr)) {
            if (p.mode === 'wait') this.pedWait[cr]--;
            p.mode = 'link';
            p.onRoad = true;
            this.pedOn[cr]++;
            return true;
        }
        if (arriving || p.mode !== 'wait') {
            p.mode = 'wait';
            this.pedWait[cr]++;
            const hw = this.links[p.link].halfWidth;
            p.uWait = (this.rng() * 2 - 1) * hw; // spread out along the kerb (walked to, not teleported)
        }
        p.v = 0;
        return false;
    }

    /**
     * True if any car body physically overlaps zebra `cr`'s road strip — e.g. a car stopped in a
     * queue with its nose over the stripes. Peds wait for it to move even though it holds no claim.
     */
    private carOnCrossing(cr: number): boolean {
        const c = this.net.crossings[cr];
        const l = this.links[cr];
        const half = (l.kerbB - l.kerbA) / 2, band = c.halfBand + 0.5;
        const [ax, az] = c.along, [cx, cz] = c.across;
        for (const car of this.cars) {
            const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
            const dx = car.x - c.centre[0], dz = car.z - c.centre[1];
            // SAT on the four axes of the crossing strip and the car footprint
            const axes = [ax, az, cx, cz, fx, fz, -fz, fx];
            let separated = false;
            for (let k = 0; k < 8 && !separated; k += 2) {
                const lx = axes[k], lz = axes[k + 1];
                const eCross = band * Math.abs(ax * lx + az * lz) + half * Math.abs(cx * lx + cz * lz);
                const eCar = car.spec.halfLen * Math.abs(fx * lx + fz * lz) + car.spec.halfWidth * Math.abs(-fz * lx + fx * lz);
                if (Math.abs(dx * lx + dz * lz) > eCross + eCar) separated = true;
            }
            if (!separated) return true;
        }
        return false;
    }

    /** Pushes apart any overlapping peds (residual after steering) along their path frames. */
    private separatePeds(): void {
        this.rebuildPedGrid();
        const { peds } = this;
        const minD = 2 * PED_RADIUS;
        for (let i = 0; i < peds.length; i++) {
            const p = peds[i];
            const n = this.pedGrid.query(p.x, p.z, minD, this.nbuf);
            for (let k = 0; k < n; k++) {
                const j = this.nbuf[k];
                if (j <= i) continue;
                const q = peds[j];
                let dx = q.x - p.x, dz = q.z - p.z;
                let d = Math.hypot(dx, dz);
                if (d >= minD) continue;
                if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
                const push = (minD - d) / 2 + 0.01;
                const nx = dx / d, nz = dz / d;
                this.nudge(p, -nx * push, -nz * push);
                this.nudge(q, nx * push, nz * push);
            }
        }
    }

    /** Applies a world displacement to a ped through its path frame (lateral clamped). */
    private nudge(p: Ped, dx: number, dz: number): void {
        const fr = this.sampleB;
        const hw = this.pedFrame(p, fr);
        const along = dx * fr.tx + dz * fr.tz;
        const lat = -dx * fr.tz + dz * fr.tx;
        p.u = Math.max(-hw, Math.min(hw, p.u + lat));
        if (p.mode === 'loop') {
            const L = this.loops[p.loop].length;
            p.s = ((p.s + along) % L + L) % L;
        } else if (p.mode === 'link') {
            p.t = Math.max(0, Math.min(this.links[p.link].rt.length, p.t + along));
        } else {
            // waiting: may step back toward the sidewalk (a queue forms), never toward the road
            const l = this.links[p.link];
            p.t = p.dirL > 0
                ? Math.max(0, Math.min(l.kerbA - PED_KERB_WAIT_BACK, p.t + along))
                : Math.min(l.rt.length, Math.max(l.kerbB + PED_KERB_WAIT_BACK, p.t + along));
        }
        this.pedPlace(p, fr);
    }

    /** World position from the path frame — the only way a ped's x/z is ever set. */
    private pedPlace(p: Ped, fr: PathSample): void {
        this.pedFrame(p, fr);
        p.x = fr.x - fr.tz * p.u;
        p.z = fr.z + fr.tx * p.u;
        p.y = p.onRoad ? this.opts.asphaltY : this.opts.sidewalkY;
    }

    /**
     * Places the ped and eases its body heading toward where it walks: along the path, leaning
     * into a sidestep by at most PED_HEADING_DEV_MAX. Waiting peds face across the road. The turn
     * is exponentially eased and rate-capped, so heading never snaps.
     */
    private pedPose(p: Ped, dt: number): void {
        const fr = this.sampleB;
        this.pedPlace(p, fr);
        const dir = p.mode === 'loop' ? p.dir : p.dirL;
        const base = Math.atan2(fr.tx * dir, fr.tz * dir);
        let target = base;
        if (p.mode !== 'wait') {
            // forward floor: a standing ped shuffling sideways turns a little, not side-on
            const fwd = Math.max(p.v, 0.5 * p.speed0);
            const vx = fr.tx * dir * fwd - fr.tz * p.latV;
            const vz = fr.tz * dir * fwd + fr.tx * p.latV;
            const dev = wrapAngle(Math.atan2(vx, vz) - base);
            target = base + Math.max(-PED_HEADING_DEV_MAX, Math.min(PED_HEADING_DEV_MAX, dev));
        }
        if (dt <= 0) { p.yaw = wrapAngle(target); return; }
        const step = wrapAngle(target - p.yaw) * (1 - Math.exp(-dt / PED_HEADING_EASE_S));
        const max = PED_TURN_RATE * dt;
        p.yaw = wrapAngle(p.yaw + Math.max(-max, Math.min(max, step)));
    }
}
