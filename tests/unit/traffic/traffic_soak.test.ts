import { describe, it, expect } from 'vitest';
import { buildRoadNetwork } from '../../../src/Traffic/RoadBuilder';
import { StreetSim, type CarSpec } from '../../../src/Traffic/StreetSim';
import { soak } from '../../../src/Traffic/SoakProbe';
import { AVENIDA } from '../../../src/assets/data/road-plans/avenida';
import { SIM_DT } from '../../../src/Constants/Traffic';
import { roadObstaclesFrom } from '../../../src/Traffic/streetWorld';

// Footprints of the real street models (sedan, junker, limo) — the limo is the long one.
const SPECS: CarSpec[] = [
    { model: 'sedan', halfLen: 5.35, halfWidth: 2.2 },
    { model: 'junker', halfLen: 5.37, halfWidth: 2.04 },
    { model: 'limo', halfLen: 8.0, halfWidth: 2.4 },
];
const NET = buildRoadNetwork(AVENIDA);

function makeSim(seed: number, peds = 25): StreetSim {
    const sim = new StreetSim(NET, { seed, pickCar: (n) => SPECS[n % SPECS.length] });
    for (let i = 0; i < peds; i++) sim.addPed(i);
    return sim;
}

describe('StreetSim soak (Avenida)', () => {
    for (const seed of [7, 11]) {
        it(`test_four_minutes_no_collisions_no_gridlock_seed_${seed}`, () => {
            const rep = soak(makeSim(seed), 240);
            expect(rep.carCarWorst).toBe(0);
            expect(rep.pedCarWorst).toBe(0);
            expect(rep.pedPedWorst).toBeLessThan(1.0); // a rare shoulder brush at most (bodies 2.2 u wide)
            expect(rep.longestCarStop).toBeLessThan(60);
            expect(rep.longestPedStop).toBeLessThan(30); // zebra waits included
            expect(rep.despawned).toBeGreaterThan(40); // traffic actually flows through
            expect(rep.crossingsStarted).toBeGreaterThan(10);
            expect(rep.meanCarSpeed).toBeGreaterThan(6);
        }, 60_000);
    }

    it('test_same_seed_same_street', () => {
        const a = makeSim(3), b = makeSim(3);
        for (let k = 0; k < 600; k++) { a.step(SIM_DT); b.step(SIM_DT); }
        expect(a.cars.map((c) => [c.serial, c.x, c.z])).toEqual(b.cars.map((c) => [c.serial, c.x, c.z]));
        expect(a.peds.map((p) => [p.x, p.z])).toEqual(b.peds.map((p) => [p.x, p.z]));
    });

    it('test_removed_ped_releases_its_crossing', () => {
        const sim = makeSim(5);
        for (let k = 0; k < 30 * 120; k++) sim.step(SIM_DT);
        for (const p of [...sim.peds]) sim.removePed(p.id);
        expect(Array.from(sim.pedOn).every((n) => n === 0)).toBe(true);
        expect(Array.from(sim.pedWait).every((n) => n === 0)).toBe(true);
    });

    it('test_advance_runs_whole_fixed_steps_only', () => {
        const sim = makeSim(1, 0);
        sim.advance(SIM_DT * 2.5);
        expect(sim.time).toBeCloseTo(SIM_DT * 2, 6);
    });
});

describe('StreetSim with road obstacles (Avenida unrest barricades)', () => {
    // Arrange: the plan's barricades as the game places them (security 1-3)
    const things = (AVENIDA.props ?? [])
        .filter((p) => p.models.some((m) => m.includes('barricade')))
        .map((p) => ({ modelName: p.models[0], pos: [p.pos[0], p.y, p.pos[1]] as [number, number, number], rot: p.rot ?? [0, 0, 0, 1] as [number, number, number, number] }));
    const net = buildRoadNetwork(AVENIDA, { roadObstacles: roadObstaclesFrom(things) });

    it('test_barricades_bend_one_outer_lane_each_without_closing_it', () => {
        expect(things).toHaveLength(2);
        expect(net.warnings).toEqual([]);
        const bent = net.paths.filter((p) => p.speedCaps?.length);
        expect(bent.map((p) => p.key).sort()).toEqual(['boulevard.0f1', 'boulevard.2b1']);
    });

    it('test_weaving_traffic_never_touches_and_never_strands_a_ped_on_a_zebra', () => {
        // Regression: a car queued inside a swerve stood on a zebra without holding it and a ped
        // walked into it (peds now also check the strip is physically clear).
        const sim = new StreetSim(net, { seed: 11, pickCar: (n) => SPECS[n % SPECS.length] });
        for (let i = 0; i < 25; i++) sim.addPed(i);
        const rep = soak(sim, 240);
        expect(rep.carCarWorst).toBe(0);
        expect(rep.pedCarWorst).toBe(0);
        expect(rep.longestCarStop).toBeLessThan(60);
    }, 60_000);
});
