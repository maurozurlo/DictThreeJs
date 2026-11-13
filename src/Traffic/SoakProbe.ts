/**
 * Soak probe — runs a StreetSim headless and measures what players would notice: overlapping
 * bodies, stuck agents, throughput. Shared by the soak tests and tools/roadplan/soak.ts.
 */
import { PED_RADIUS, SIM_DT } from '../Constants/Traffic.ts';
import type { Car, StreetSim } from './StreetSim.ts';

export interface SoakReport {
    seconds: number;
    spawned: number;
    despawned: number;
    maxCars: number;
    meanCars: number;
    meanCarSpeed: number;
    /** Worst car-vs-car penetration depth seen (u); 0 = never touched. */
    carCarWorst: number;
    carCarFrames: number;
    pedPedWorst: number;
    pedCarWorst: number;
    /** Longest any single car stood still (s). */
    longestCarStop: number;
    /** Longest any single ped stood still (s), waits at kerbs included. */
    longestPedStop: number;
    crossingsStarted: number;
    /**
     * Heading twitches per ped-minute: ticks where a ped's turn rate reverses (left↔right, both
     * faster than PED_WOBBLE_RATE). Smooth walking sits near 0; jittery steering in the tens.
     */
    pedWobblePerMin: number;
    /** Back-steps per ped-minute: ticks where a ped's displacement reverses against the last tick's. */
    pedStepBackPerMin: number;
}

/** Turn rate (rad/s) above which a reversal counts as a visible twitch. */
const PED_WOBBLE_RATE = 0.8;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Per-ped motion history for the twitch metrics. */
interface PedTrace { yaw: number; w: number; x: number; z: number; dx: number; dz: number }

/** SAT penetration depth of two cars' footprints (0 when separated). */
export function carPenetration(a: Car, b: Car): number {
    const axes: Array<[number, number]> = [];
    const fa: [number, number] = [Math.sin(a.yaw), Math.cos(a.yaw)];
    const fb: [number, number] = [Math.sin(b.yaw), Math.cos(b.yaw)];
    axes.push(fa, [-fa[1], fa[0]], fb, [-fb[1], fb[0]]);
    let depth = Infinity;
    const dx = b.x - a.x, dz = b.z - a.z;
    for (const [lx, lz] of axes) {
        const ext = (f: [number, number], hl: number, hw: number) =>
            hl * Math.abs(f[0] * lx + f[1] * lz) + hw * Math.abs(-f[1] * lx + f[0] * lz);
        const overlap = ext(fa, a.spec.halfLen, a.spec.halfWidth) + ext(fb, b.spec.halfLen, b.spec.halfWidth) - Math.abs(dx * lx + dz * lz);
        if (overlap <= 0) return 0;
        depth = Math.min(depth, overlap);
    }
    return depth;
}

/** Penetration of a ped circle into a car footprint (0 when clear). */
export function pedCarPenetration(px: number, pz: number, c: Car): number {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const dx = px - c.x, dz = pz - c.z;
    const a = dx * fx + dz * fz, l = -dx * fz + dz * fx;
    const qa = Math.max(-c.spec.halfLen, Math.min(c.spec.halfLen, a));
    const ql = Math.max(-c.spec.halfWidth, Math.min(c.spec.halfWidth, l));
    const d = Math.hypot(a - qa, l - ql);
    return Math.max(0, PED_RADIUS - d);
}

export function soak(sim: StreetSim, seconds: number): SoakReport {
    const r: SoakReport = {
        seconds, spawned: 0, despawned: 0, maxCars: 0, meanCars: 0, meanCarSpeed: 0, carCarWorst: 0, carCarFrames: 0,
        pedPedWorst: 0, pedCarWorst: 0, longestCarStop: 0, longestPedStop: 0, crossingsStarted: 0,
        pedWobblePerMin: 0, pedStepBackPerMin: 0,
    };
    const carStop = new Map<number, number>();
    const pedStop = new Map<number, number>();
    const wasOnRoad = new Map<number, boolean>();
    const trace = new Map<number, PedTrace>();
    const seen = new Set<number>();
    let ticks = 0, speedSum = 0, speedN = 0, pedTicks = 0, wobbles = 0, stepBacks = 0;
    const steps = Math.round(seconds / SIM_DT);
    for (let k = 0; k < steps; k++) {
        const before = new Set(sim.cars.map((c) => c.serial));
        sim.step(SIM_DT);
        const now = new Set(sim.cars.map((c) => c.serial));
        for (const s of now) if (!seen.has(s)) { seen.add(s); r.spawned++; }
        for (const s of before) if (!now.has(s)) { r.despawned++; carStop.delete(s); }
        ticks++;
        r.maxCars = Math.max(r.maxCars, sim.cars.length);
        r.meanCars += sim.cars.length;
        let touched = false;
        for (let i = 0; i < sim.cars.length; i++) {
            const a = sim.cars[i];
            speedSum += a.v; speedN++;
            const st = a.v < 0.3 ? (carStop.get(a.serial) ?? 0) + SIM_DT : 0;
            carStop.set(a.serial, st);
            r.longestCarStop = Math.max(r.longestCarStop, st);
            for (let j = i + 1; j < sim.cars.length; j++) {
                const d = carPenetration(a, sim.cars[j]);
                if (d > 0.05) touched = true;
                r.carCarWorst = Math.max(r.carCarWorst, d);
            }
        }
        if (touched) r.carCarFrames++;
        for (let i = 0; i < sim.peds.length; i++) {
            const p = sim.peds[i];
            const st = p.v < 0.2 ? (pedStop.get(p.id) ?? 0) + SIM_DT : 0;
            pedStop.set(p.id, st);
            r.longestPedStop = Math.max(r.longestPedStop, st);
            if (p.onRoad && !wasOnRoad.get(p.id)) r.crossingsStarted++;
            wasOnRoad.set(p.id, p.onRoad);
            const tr = trace.get(p.id);
            if (tr) {
                pedTicks++;
                const w = wrapAngle(p.yaw - tr.yaw) / SIM_DT;
                if (Math.abs(w) > PED_WOBBLE_RATE && Math.abs(tr.w) > PED_WOBBLE_RATE && Math.sign(w) !== Math.sign(tr.w)) wobbles++;
                const dx = p.x - tr.x, dz = p.z - tr.z;
                const m = Math.hypot(dx, dz), mPrev = Math.hypot(tr.dx, tr.dz);
                if (m > 0.01 && mPrev > 0.01 && dx * tr.dx + dz * tr.dz < -0.3 * m * mPrev) stepBacks++;
                tr.yaw = p.yaw; tr.w = w; tr.x = p.x; tr.z = p.z; tr.dx = dx; tr.dz = dz;
            } else trace.set(p.id, { yaw: p.yaw, w: 0, x: p.x, z: p.z, dx: 0, dz: 0 });
            for (let j = i + 1; j < sim.peds.length; j++) {
                const q = sim.peds[j];
                r.pedPedWorst = Math.max(r.pedPedWorst, 2 * PED_RADIUS - Math.hypot(q.x - p.x, q.z - p.z));
            }
            for (const c of sim.cars) r.pedCarWorst = Math.max(r.pedCarWorst, pedCarPenetration(p.x, p.z, c));
        }
    }
    r.meanCars /= ticks;
    r.meanCarSpeed = speedN ? speedSum / speedN : 0;
    r.pedPedWorst = Math.max(0, r.pedPedWorst);
    const pedMinutes = (pedTicks * SIM_DT) / 60;
    r.pedWobblePerMin = pedMinutes > 0 ? wobbles / pedMinutes : 0;
    r.pedStepBackPerMin = pedMinutes > 0 ? stepBacks / pedMinutes : 0;
    return r;
}
