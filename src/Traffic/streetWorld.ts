/**
 * The street's single road network and traffic simulation (ADR-0014).
 *
 * Module singletons: the network is pure data derived once from the active plan; the sim lives
 * for the session so traffic continues where it left off when the player returns to the Street
 * tab (StreetView unmounts while hidden, which simply stops stepping it).
 */
import { PED_OBSTACLE_FOOTPRINT, ROAD_OBSTACLE_FOOTPRINT, SIM_WARMUP_S, STREET_ASPHALT_Y, STREET_SIDEWALK_Y } from '../Constants/Traffic.ts';
import { STREET_PLAN } from '../assets/data/road-plans/index.ts';
import { buildRoadNetwork, type RoadNetwork, type RoadObstacle } from './RoadBuilder.ts';
import { StreetSim, type CarSpec } from './StreetSim.ts';

let network: RoadNetwork | null = null;
let sim: StreetSim | null = null;
/** Props currently standing on the road (security-tier dependent) and their identity key. */
let roadObstacles: RoadObstacle[] = [];
let roadObstacleKey = '[]';

/** Car picker used for every spawn — Vehicles.tsx keeps it in sync with the traffic mix. */
let picker: (serial: number) => CarSpec = () => ({ model: 'sedan', halfLen: 5.35, halfWidth: 2.2 });

export function streetNetwork(): RoadNetwork {
    network ??= buildRoadNetwork(STREET_PLAN, { roadObstacles });
    return network;
}

export function setCarPicker(fn: (serial: number) => CarSpec): void {
    picker = fn;
}

/** The street sim, created (and pre-warmed so traffic is already flowing) on first use. */
export function streetSim(): StreetSim {
    if (!sim) {
        sim = new StreetSim(streetNetwork(), {
            // cosmetic entropy only — never the gameplay RNG cursor (ADR-0010)
            seed: Math.floor(Math.random() * 2 ** 31),
            pickCar: (n) => picker(n),
            sidewalkY: STREET_SIDEWALK_Y,
            asphaltY: STREET_ASPHALT_Y,
        });
        sim.warmUp(SIM_WARMUP_S);
    }
    return sim;
}

/** A placed street object, as far as obstacle extraction cares. */
export interface PlacedThing {
    modelName: string;
    pos: readonly [number, number, number];
    rot: readonly [number, number, number, number];
}

/**
 * Ground circles peds steer around, from the visible street placements: each furniture base
 * (PED_OBSTACLE_FOOTPRINT), offset from its pivot by the placement's yaw.
 */
export function pedObstaclesFrom(things: readonly PlacedThing[]): Array<{ x: number; z: number; r: number }> {
    const out: Array<{ x: number; z: number; r: number }> = [];
    for (const t of things) {
        const fp = PED_OBSTACLE_FOOTPRINT.find((f) => t.modelName.startsWith(f.prefix));
        if (!fp) continue;
        const yaw = yawOf(t.rot); // street furniture only ever turns about Y
        const c = Math.cos(yaw), s = Math.sin(yaw);
        out.push({ x: t.pos[0] + fp.dx * c + fp.dz * s, z: t.pos[2] - fp.dx * s + fp.dz * c, r: fp.r });
    }
    return out;
}

const yawOf = (q: readonly [number, number, number, number]) => {
    const [qx, qy, qz, qw] = q;
    return Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qx * qx));
};

/** Road-standing props (barricades, checkpoints) among the visible placements. */
export function roadObstaclesFrom(things: readonly PlacedThing[]): RoadObstacle[] {
    const out: RoadObstacle[] = [];
    for (const t of things) {
        const fp = ROAD_OBSTACLE_FOOTPRINT.find((f) => t.modelName.startsWith(f.prefix));
        if (fp) out.push({ x: t.pos[0], z: t.pos[2], hx: fp.hx, hz: fp.hz, yaw: yawOf(t.rot) });
    }
    return out;
}

/**
 * Feeds the visible street placements to the simulation: furniture for ped steering, and road
 * props for car swerves. A change in road props (a security tier flip — rare, between rounds)
 * rebuilds the lane geometry and restarts the traffic; walking citizens carry over.
 */
export function applyStreetPlacements(things: readonly PlacedThing[]): void {
    const ro = roadObstaclesFrom(things);
    const key = JSON.stringify(ro);
    if (key !== roadObstacleKey) {
        roadObstacleKey = key;
        roadObstacles = ro;
        network = null;
        if (sim) {
            const walkers = sim.peds.map((p) => p.id);
            sim = null;
            const fresh = streetSim();
            for (const id of walkers) fresh.addPed(id);
        }
    }
    streetSim().setObstacles(pedObstaclesFrom(things));
}
