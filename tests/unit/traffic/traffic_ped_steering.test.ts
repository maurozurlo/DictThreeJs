import { describe, it, expect } from 'vitest';
import { buildRoadNetwork } from '../../../src/Traffic/RoadBuilder';
import { StreetSim, type CarSpec, type Ped } from '../../../src/Traffic/StreetSim';
import { newSample, sampleRt, sampleRtSmooth, toRtPath } from '../../../src/Traffic/RtPath';
import { soak } from '../../../src/Traffic/SoakProbe';
import { AVENIDA } from '../../../src/assets/data/road-plans/avenida';
import { PED_HEADING_DEV_MAX, PED_LOOKAHEAD, PED_RADIUS, SIM_DT } from '../../../src/Constants/Traffic';

const NET = buildRoadNetwork(AVENIDA);
const SEDAN: CarSpec = { model: 'sedan', halfLen: 5.35, halfWidth: 2.2 };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** First sidewalk stretch at least `len` long whose direction doesn't change (loop index, start s). */
function straightStretch(len: number): { loop: number; s0: number } {
    const fr = newSample(), probe = newSample();
    for (const [loop, l] of NET.loops.entries()) {
        const rt = toRtPath(l.line);
        for (let s0 = 0; s0 + len < rt.length; s0 += 1) {
            sampleRt(rt, s0, fr);
            let straight = true;
            for (let d = 1; d <= len && straight; d += 1) {
                sampleRt(rt, s0 + d, probe);
                straight = probe.tx * fr.tx + probe.tz * fr.tz > 0.99999;
            }
            if (straight) return { loop, s0 };
        }
    }
    throw new Error('no straight sidewalk stretch');
}

/** Puts a ped at (s, u) walking `dir`, facing its path, never wandering off onto a zebra. */
function place(sim: StreetSim, p: Ped, s: number, u: number, dir: 1 | -1): void {
    const fr = sampleRt(sim.loops[p.loop], s, newSample());
    Object.assign(p, {
        s, u, dir, latV: 0, speed0: 4, v: 4, cooldownUntil: Infinity,
        x: fr.x - fr.tz * u, z: fr.z + fr.tx * u, yaw: Math.atan2(fr.tx * dir, fr.tz * dir),
    });
}

interface PassLog { minGap: number; minSpeed: number; wobbles: number; maxHeadingDev: number; passedAt: number; sideSwaps: number }

/** Two peds walking at each other on a straight stretch; logs what a viewer would see. */
function headOn(uA: number, uB: number, apart = 30): PassLog {
    // Arrange
    const { loop, s0 } = straightStretch(40);
    const sim = new StreetSim(NET, { seed: 1, pickCar: () => SEDAN, maxCars: 0 });
    const a = sim.addPed(1, loop), b = sim.addPed(2, loop);
    place(sim, a, s0 + 5, uA, 1);
    place(sim, b, s0 + 5 + apart, uB, -1);
    const log: PassLog = { minGap: Infinity, minSpeed: Infinity, wobbles: 0, maxHeadingDev: 0, passedAt: -1, sideSwaps: 0 };
    const w = new Map<Ped, number>([[a, 0], [b, 0]]);
    const fr = newSample();
    const side0 = Math.sign(a.u - b.u);
    // Act
    for (let k = 0; k < 8 / SIM_DT; k++) {
        const yaw0 = new Map([[a, a.yaw], [b, b.yaw]]);
        sim.step(SIM_DT);
        log.minGap = Math.min(log.minGap, Math.hypot(a.x - b.x, a.z - b.z));
        for (const p of [a, b]) {
            log.minSpeed = Math.min(log.minSpeed, p.v);
            const rate = wrap(p.yaw - yaw0.get(p)!) / SIM_DT;
            if (Math.abs(rate) > 0.8 && Math.abs(w.get(p)!) > 0.8 && Math.sign(rate) !== Math.sign(w.get(p)!)) log.wobbles++;
            w.set(p, rate);
            sampleRtSmooth(sim.loops[loop], p.s, fr);
            log.maxHeadingDev = Math.max(log.maxHeadingDev, Math.abs(wrap(p.yaw - Math.atan2(fr.tx * p.dir, fr.tz * p.dir))));
        }
        // B walks -s from the stretch start and may wrap the loop later, so latch the pass
        if (log.passedAt < 0 && a.s > b.s) log.passedAt = sim.time;
        // lateral order may only flip once they are past each other
        if (log.passedAt < 0 && side0 !== 0 && Math.sign(a.u - b.u) === -side0) log.sideSwaps++;
    }
    return log;
}

describe('Ped steering (no twitch)', () => {
    it('test_ped_oncoming_centred_pair_keeps_right_and_passes_smoothly', () => {
        const log = headOn(0, 0);
        expect(log.passedAt).toBeGreaterThan(0);
        expect(log.minGap).toBeGreaterThanOrEqual(2 * PED_RADIUS - 0.05);
        expect(log.wobbles).toBe(0);
        expect(log.maxHeadingDev).toBeLessThanOrEqual(PED_HEADING_DEV_MAX + 1e-6);
    });

    it('test_ped_oncoming_pair_already_offset_wrong_way_passes_left_without_crossing', () => {
        // A walks on its left (u < 0 going +s), B on its own left too (u > 0 going -s), and they
        // meet already inside reaction range: swapping sides would mean walking through each other
        const log = headOn(-1, 1, PED_LOOKAHEAD - 0.5);
        expect(log.passedAt).toBeGreaterThan(0);
        expect(log.sideSwaps).toBe(0);
        expect(log.minGap).toBeGreaterThanOrEqual(2 * PED_RADIUS - 0.05);
        expect(log.wobbles).toBe(0);
    });

    it('test_ped_crowd_walks_without_heading_twitch_or_back_steps', () => {
        // Arrange: a crowded street (45 walkers; the regression had ~28 wobbles per ped-minute here)
        const sim = new StreetSim(NET, { seed: 11, pickCar: () => SEDAN });
        for (let i = 0; i < 45; i++) sim.addPed(i);
        // Act
        const rep = soak(sim, 120);
        // Assert
        expect(rep.pedWobblePerMin).toBeLessThan(0.5);
        expect(rep.pedStepBackPerMin).toBeLessThan(0.5);
        expect(rep.pedPedWorst).toBeLessThan(1.0);
        expect(rep.longestPedStop).toBeLessThan(30);
    }, 60_000);

    it('test_ped_frame_moves_offset_point_continuously_through_corners', () => {
        // Arrange: walk a full loop 3 u off its centre line in small steps
        const rt = toRtPath(NET.loops[0].line);
        const fr = newSample();
        const at = (s: number, u: number): [number, number] => {
            sampleRtSmooth(rt, s, fr);
            return [fr.x - fr.tz * u, fr.z + fr.tx * u];
        };
        // Act / Assert: no jump bigger than the step, never backwards
        for (const u of [-3, 3]) {
            let [px, pz] = at(0, u);
            let worstJump = 0, backSteps = 0, pdx = 0, pdz = 0;
            for (let s = 0.05; s <= rt.length; s += 0.05) {
                const [x, z] = at(s, u);
                const dx = x - px, dz = z - pz;
                worstJump = Math.max(worstJump, Math.hypot(dx, dz));
                if (dx * pdx + dz * pdz < 0) backSteps++;
                px = x; pz = z; pdx = dx; pdz = dz;
            }
            expect(worstJump).toBeLessThan(0.05 * 2.5);
            expect(backSteps).toBe(0);
        }
    });
});
