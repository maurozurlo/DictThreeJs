/**
 * Headless traffic soak: node tools/roadplan/soak.ts [seconds=600] [seed=7] [variantId ...]
 */
import { buildRoadNetwork } from '../../src/Traffic/RoadBuilder.ts';
import { StreetSim } from '../../src/Traffic/StreetSim.ts';
import { soak } from '../../src/Traffic/SoakProbe.ts';
import { AVENIDA } from '../../src/assets/data/road-plans/avenida.ts';
import { ROTONDA } from '../../src/assets/data/road-plans/rotonda.ts';
import { EXPLANADA } from '../../src/assets/data/road-plans/explanada.ts';

const [secArg, seedArg, ...only] = process.argv.slice(2);
const seconds = Number(secArg ?? 600);
const seed = Number(seedArg ?? 7);
const SPECS = [
    { model: 'sedan', halfLen: 5.35, halfWidth: 2.2 },
    { model: 'junker', halfLen: 5.37, halfWidth: 2.04 },
    { model: 'limo', halfLen: 8.0, halfWidth: 2.4 },
];

for (const plan of [AVENIDA, ROTONDA, EXPLANADA]) {
    if (only.length && !only.includes(plan.id)) continue;
    const net = buildRoadNetwork(plan);
    const sim = new StreetSim(net, { seed, pickCar: (n) => SPECS[n % SPECS.length] });
    for (let i = 0; i < 25; i++) sim.addPed(i);
    const t0 = performance.now();
    const rep = soak(sim, seconds);
    const ms = performance.now() - t0;
    console.log(`\n== ${plan.id}: ${sim.conflicts.carZones.length} car zones, ${sim.conflicts.crossZones.length} zebra zones`);
    console.log(JSON.stringify(rep, (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
    console.log(`   ${(ms / (seconds * 30)).toFixed(3)} ms/tick`);
}
