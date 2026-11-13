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
}

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
    };
    const carStop = new Map<number, number>();
    const pedStop = new Map<number, number>();
    const wasOnRoad = new Map<number, boolean>();
    const seen = new Set<number>();
    let ticks = 0, speedSum = 0, speedN = 0;
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
    return r;
}
