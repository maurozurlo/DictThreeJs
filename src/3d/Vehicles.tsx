import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { STREET_PATHS } from '../assets/data/street-paths';
import type { WaypointPath, VehicleConfig } from '../types/StreetLayout';
import { lightPhase } from '../Utils/TrafficLight';
import { pathTotalLength, positionAtPathDistance } from '../Utils/PathUtils';

// ---------------------------------------------------------------------------
// Asset catalogue
// ---------------------------------------------------------------------------

const CAR_MODEL_URL = '/models/vehicles/car_junker.glb';

const TEX_BASE = '/textures/vehicles';
type CarTexKind = 'body' | 'lights' | 'wheels';
const CAR_TEXTURE_KINDS: readonly CarTexKind[] = ['body', 'lights', 'wheels'];
const CAR_TEXTURE_URLS: Record<CarTexKind, string> = {
    body: `${TEX_BASE}/car_junker_body.png`,
    lights: `${TEX_BASE}/car_lights.png`,
    wheels: `${TEX_BASE}/car_wheels.png`,
};

/**
 * Material names inside the junker GLB → external texture, matched by image
 * dimensions (the exporter's material names carry no meaning). `fallback
 * Material` is the UV-less back-wheel slot; its geometry is swapped for the
 * front wheels' UV-mapped copy at prep time so the wheel texture applies.
 */
const CAR_MATERIAL_TEXTURE: Record<string, CarTexKind> = {
    'Material__1627': 'body',
    'Material__1628': 'lights',
    'Material__1629': 'wheels',
    'Material__1630': 'wheels',
    'fallback Material': 'wheels',
};

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/**
 * World units per metre for vehicles — the same 3.7× factor as the citizens'
 * PED_WORLD_SCALE: the street layout is metric (1 unit = 1 m) but the env GLBs
 * are drawn oversized, so cars are scaled to match the environment.
 */
const VEHICLE_WORLD_SCALE = 3.7;

/**
 * Junker length in metres (× VEHICLE_WORLD_SCALE at render). Tuned to ~65% of
 * the real 4.5 m — full metric size read too big against the street layout.
 */
const CAR_LENGTH_M = 2.9;

/** Car ground speed in m/s (metric) — city-crawl pace, ~2.5× ped walk speed. */
const CAR_SPEED_MPS = 3.5;

/** Target centre-to-centre spacing (world units) between spawned cars on a loop. */
const CAR_TARGET_SPACING = 100;

/**
 * Junker footprint in world units, used by the collision-avoidance OBB check
 * below — not just a proximity radius, the actual rectangle a real car AI
 * would test (see GTA's `CCarCtrl::TestCollisionBetween2MovingRects`, which
 * projects each car's oriented bounding box rather than using a distance +
 * angle heuristic; a plain "ahead cone" is blind to width, so cars offset
 * onto adjacent lanes only a little apart still read as clear when their
 * bodies actually overlap).
 */
const CAR_HALF_LENGTH = (CAR_LENGTH_M * VEHICLE_WORLD_SCALE) / 2;
/** Real-world car width in metres — same ~65% stylised shrink as CAR_LENGTH_M. */
const CAR_WIDTH_M = 1.1;
const CAR_HALF_WIDTH = (CAR_WIDTH_M * VEHICLE_WORLD_SCALE) / 2;

/**
 * Seconds of travel used to extend a car's front sensor rectangle ahead of
 * its nose — the braking/reaction buffer. Only the FRONT half-length grows;
 * the rear edge stays at the car's real bumper (see rectsOverlap callers).
 */
const CAR_BRAKE_LOOKAHEAD_S = 1.0;
const CAR_BRAKE_LOOKAHEAD = CAR_SPEED_MPS * VEHICLE_WORLD_SCALE * CAR_BRAKE_LOOKAHEAD_S;

/**
 * Seconds a proximity hold may last before the car pushes through anyway.
 * Mirrors the citizen walker's pause timeout (CitizenModels.tsx): symmetric
 * holds deadlock without this — two cars approaching head-on (opposite lanes
 * of the same street) would otherwise each see the other as permanently
 * "ahead" and freeze forever.
 */
const CAR_PAUSE_TIMEOUT_S = 3.0;

/**
 * Extra clearance behind the baked `stopFor` node (world units), on top of
 * whatever back-off convert_paths.mjs already baked in. The bake only knows
 * the path centreline, not vehicle footprint, so without this the car's
 * centre (its render pivot) stops at the node while the nose — half the
 * car's length further forward — overshoots onto the crossing. The rest is a
 * pedestrian buffer roughly 3 peds wide (matches CitizenModels' PED_LANE_WIDTH
 * of 1.4) so crossing peds clear the stopped nose instead of clipping through it.
 */
const CAR_STOP_PED_BUFFER = 3 * 1.4;
const CAR_STOP_SETBACK = CAR_HALF_LENGTH + CAR_STOP_PED_BUFFER;

/**
 * True if two oriented rectangles in the XZ plane overlap (separating axis
 * theorem — the standard OBB-vs-OBB test). `fwd`/`right` are unit vectors;
 * `halfLen`/`halfWidth` are half-extents along each. This is the geometric
 * core of GTA's car-vs-car avoidance, simplified from the 4-corner swept test
 * in `CCarCtrl::TestCollisionBetween2MovingRects` to a single static overlap
 * check against a forward-extended sensor box (see CAR_BRAKE_LOOKAHEAD).
 */
function rectsOverlap(
    ax: number, az: number, afx: number, afz: number, ahl: number, ahw: number,
    bx: number, bz: number, bfx: number, bfz: number, bhl: number, bhw: number,
): boolean {
    const dx = bx - ax, dz = bz - az;
    const arx = -afz, arz = afx;
    const brx = -bfz, brz = bfx;
    const axes: Array<readonly [number, number]> = [[afx, afz], [arx, arz], [bfx, bfz], [brx, brz]];
    for (const [lx, lz] of axes) {
        const dist = Math.abs(dx * lx + dz * lz);
        const extentA = ahl * Math.abs(afx * lx + afz * lz) + ahw * Math.abs(arx * lx + arz * lz);
        const extentB = bhl * Math.abs(bfx * lx + bfz * lz) + bhw * Math.abs(brx * lx + brz * lz);
        if (dist > extentA + extentB) return false; // separating axis found — no overlap
    }
    return true;
}

/**
 * Perpendicular offset (world units) applied to every car, biased to one
 * consistent side of its current direction of travel. Some block loops share
 * a boundary street with the neighbouring block's loop at an almost-identical
 * centreline (opposite direction, ~0.1-0.2 units apart in the exported data)
 * — without an offset that reads as two cars parked nose-to-nose in the same
 * lane. Offsetting by direction of travel rather than a fixed world axis means
 * opposite-direction traffic always lands on opposite sides of the shared
 * line, same principle as CitizenModels' ped lane shift.
 */
const CAR_LANE_OFFSET = 2.5;

// Body tint pool — car_junker_body.png is grayscale so material.color
// multiplies through as the paint colour. Cosmetic only: deliberately NOT the
// seeded gameplay RNG (would desync rolls, ADR-0010).
const CAR_BODY_TINTS = ['#c8c8c8', '#9a4a3a', '#5a7a9a', '#6a7a4a', '#a08a5a', '#606060', '#7a5a8a', '#9a8a3a'];

function randomFrom<T>(pool: readonly T[]): T {
    return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Asset bundle prepared once per session
// ---------------------------------------------------------------------------

interface CarAssets {
    /** Prepared template — textured, wheels re-pivoted; clone per instance. */
    template: THREE.Group;
    /** Uniform scale bringing the GLB to CAR_LENGTH_M × VEHICLE_WORLD_SCALE. */
    modelScale: number;
    /** World-Y lift (already scaled) so the tyre bottoms sit on the road plane. */
    yOffset: number;
    /** Tyre radius in world units (already scaled) — drives wheel spin rate. */
    wheelRadius: number;
}

/** Loads and prepares the junker model + textures. Suspends. */
function useCarAssets(): CarAssets {
    const gltf = useLoader(GLTFLoader, CAR_MODEL_URL);
    const loaded = useLoader(THREE.TextureLoader, CAR_TEXTURE_KINDS.map((k) => CAR_TEXTURE_URLS[k]));

    return useMemo((): CarAssets => {
        const textures = {} as Record<CarTexKind, THREE.Texture>;
        CAR_TEXTURE_KINDS.forEach((kind, i) => {
            const tex = loaded[i];
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false; // glTF UV convention
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.needsUpdate = true;
            textures[kind] = tex;
        });

        // useLoader caches gltf.scene, so every mutation below must stay
        // idempotent — StrictMode remounts re-run this memo on the same object.
        const scene = gltf.scene as THREE.Group;
        const front = scene.getObjectByName('wheels_front') as THREE.Mesh | undefined;
        const back = scene.getObjectByName('wheels_back') as THREE.Mesh | undefined;

        // The back-wheel mesh shipped without UVs; the front mesh is
        // geometrically identical, so share its UV-mapped geometry.
        if (front && back) back.geometry = front.geometry;

        // Re-pivot: the wheel geometry is offset from its node origin along the
        // car's length axis, so rotating the node as exported would orbit the
        // wheels around the car centre instead of spinning them. Centre each
        // distinct geometry on its origin and push the offset onto the node
        // position — axle rotation then spins the wheels in place.
        const centers = new Map<THREE.BufferGeometry, THREE.Vector3>();
        [front, back].forEach((wheel) => {
            if (!wheel) return;
            let center = centers.get(wheel.geometry);
            if (!center) {
                wheel.geometry.computeBoundingBox();
                center = wheel.geometry.boundingBox!.getCenter(new THREE.Vector3());
                wheel.geometry.translate(-center.x, -center.y, -center.z);
                centers.set(wheel.geometry, center);
            }
            wheel.position.add(center.clone().multiply(wheel.scale));
        });

        scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const prep = (mat: THREE.Material): THREE.Material => {
                const kind = CAR_MATERIAL_TEXTURE[mat.name] ?? 'body';
                const out = new THREE.MeshStandardMaterial({ map: textures[kind], roughness: 0.9, metalness: 0 });
                out.name = mat.name; // keep the export name — re-runs and the tint pass key on it
                out.userData.kind = kind;
                return out;
            };
            mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prep) : prep(mesh.material);
        });

        scene.updateMatrixWorld(true);
        const carBox = new THREE.Box3().setFromObject(scene);
        // The GLB nose points +X, so the car length is the X span
        const rawLength = Math.max(carBox.max.x - carBox.min.x, 1e-6);
        const modelScale = (CAR_LENGTH_M * VEHICLE_WORLD_SCALE) / rawLength;
        const yOffset = -carBox.min.y * modelScale;

        const wheelBox = front ? new THREE.Box3().setFromObject(front) : carBox;
        const wheelRadius = Math.max(((wheelBox.max.y - wheelBox.min.y) / 2) * modelScale, 1e-6);

        return { template: scene, modelScale, yOffset, wheelRadius };
    }, [gltf, loaded]);
}

// ---------------------------------------------------------------------------
// Model construction per vehicle instance
// ---------------------------------------------------------------------------

interface CarParts {
    model: THREE.Group;
    /** Wheel nodes of this clone — rotation.x spins them around the axle. */
    wheels: THREE.Object3D[];
}

/** Clone the template and give the body panels a per-car paint material. */
function buildCarModel(template: THREE.Group, tint: string): CarParts {
    const model = template.clone(true);
    model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const applyTint = (mat: THREE.Material): THREE.Material => {
            if (mat.userData.kind !== 'body') return mat;
            const painted = (mat as THREE.MeshStandardMaterial).clone();
            painted.color.set(tint);
            return painted;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(applyTint) : applyTint(mesh.material);
    });
    const wheels = ['wheels_front', 'wheels_back']
        .map((name) => model.getObjectByName(name))
        .filter((w): w is THREE.Object3D => w !== undefined);
    return { model, wheels };
}

// ---------------------------------------------------------------------------
// Shared per-frame position registry for collision avoidance
// ---------------------------------------------------------------------------

interface CarRegistryEntry {
    pos: THREE.Vector3;
    /** Unit heading (XZ) — the car's current segment direction, used to build its OBB. */
    fwdX: number;
    fwdZ: number;
}
const carPositions = new Map<string, CarRegistryEntry>();

const CAR_PATHS_BY_ID = new Map(STREET_PATHS.carPaths.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// JunkerCar — one vehicle following a car path
// ---------------------------------------------------------------------------

interface JunkerCarProps {
    assets: CarAssets;
    vehicle: VehicleConfig;
    path: WaypointPath;
    /** Spawn point along the path (see positionAtPathDistance). */
    startPos: THREE.Vector3;
    startNextIdx: number;
}

function JunkerCar({ assets, vehicle, path, startPos, startNextIdx }: JunkerCarProps) {
    const groupRef = useRef<THREE.Group>(null);
    const pos = useRef(startPos.clone());
    const nextIdx = useRef(startNextIdx);
    // Non-loop paths carry an `endLink` to the nearest node on another car
    // path (baked by convert_paths.mjs) — the car hops onto it on arrival, so
    // the active path lives in a ref rather than the static `path` prop.
    const pathRef = useRef(path);
    /** clock time the current proximity hold started; null while unblocked. */
    const pausedSince = useRef<number | null>(null);

    const { model, wheels } = useMemo(
        () => buildCarModel(assets.template, randomFrom(CAR_BODY_TINTS)),
        [assets],
    );

    useEffect(() => {
        return () => { carPositions.delete(vehicle.id); };
    }, [vehicle.id]);

    useFrame((state, delta) => {
        const elapsed = state.clock.elapsedTime;
        const curPath = pathRef.current;

        const target = curPath.waypoints[nextIdx.current];
        const prev = curPath.waypoints[(nextIdx.current - 1 + curPath.waypoints.length) % curPath.waypoints.length];
        const segX = target.x - prev.x, segZ = target.z - prev.z;
        const segLen = Math.hypot(segX, segZ);
        // Current heading — stable even mid-hold (unlike moveDir, which needs
        // a nonzero remaining distance), so it's what other cars see as our
        // OBB orientation and what we register into the shared map below.
        const fwdX = segLen > 1e-6 ? segX / segLen : 0;
        const fwdZ = segLen > 1e-6 ? segZ / segLen : 1;

        // Register current position + heading so other cars can build an OBB
        // check against us
        let entry = carPositions.get(vehicle.id);
        if (!entry) { entry = { pos: new THREE.Vector3(), fwdX, fwdZ }; carPositions.set(vehicle.id, entry); }
        entry.pos.copy(pos.current);
        entry.fwdX = fwdX;
        entry.fwdZ = fwdZ;

        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        if (segLen > 1e-6) {
            // Lane offset: keep to one consistent side of the direction of
            // travel (see CAR_LANE_OFFSET) so coincident opposite-direction
            // boundary streets separate instead of overlapping.
            targetPos.x += (segZ / segLen) * CAR_LANE_OFFSET;
            targetPos.z += (-segX / segLen) * CAR_LANE_OFFSET;
            if (target.stopFor) {
                // Shift the halt point back along the incoming segment (see
                // CAR_STOP_SETBACK) so the nose clears the crossing with room
                // for crossing peds, instead of stopping with the pivot at
                // the baked node. Clamped to the segment's own length — some
                // intersections chain short segments (kerb inserts, tight
                // corners) shorter than the ideal setback; applying the full
                // distance there would place the point behind the previous
                // waypoint, i.e. behind the car's already-arrived position,
                // which reads as the car reversing mid-crossing.
                const setback = Math.min(CAR_STOP_SETBACK, segLen * 0.9);
                targetPos.x -= (segX / segLen) * setback;
                targetPos.z -= (segZ / segLen) * setback;
            }
        }
        const toTarget = targetPos.clone().sub(pos.current);
        const dist = toTarget.length();
        const step = vehicle.speed * delta;
        const moveDir = dist > 1e-6 ? toTarget.clone().divideScalar(dist) : null;

        // Collision avoidance: an oriented-bounding-box overlap test (see
        // rectsOverlap) between our own front sensor rectangle — our real
        // footprint extended ahead by the braking buffer — and every other
        // car's actual footprint. Width-aware, unlike a distance+angle cone:
        // two cars in adjacent, only-slightly-offset lanes correctly read as
        // clear once their bodies don't actually overlap, and correctly read
        // as blocked when they do, however they're angled.
        const sensorCenterX = pos.current.x + fwdX * (CAR_BRAKE_LOOKAHEAD / 2);
        const sensorCenterZ = pos.current.z + fwdZ * (CAR_BRAKE_LOOKAHEAD / 2);
        const sensorHalfLen = CAR_HALF_LENGTH + CAR_BRAKE_LOOKAHEAD / 2;
        let blocked = false;
        for (const [otherId, other] of carPositions) {
            if (otherId === vehicle.id) continue;
            if (rectsOverlap(
                sensorCenterX, sensorCenterZ, fwdX, fwdZ, sensorHalfLen, CAR_HALF_WIDTH,
                other.pos.x, other.pos.z, other.fwdX, other.fwdZ, CAR_HALF_LENGTH, CAR_HALF_WIDTH,
            )) {
                blocked = true;
                break;
            }
        }
        if (blocked && pausedSince.current === null) pausedSince.current = elapsed;
        if (!blocked) pausedSince.current = null;
        // While blocked past the timeout, pausedSince keeps its old timestamp so
        // the car doesn't re-pause every other frame until the jam clears.
        const softHold = blocked && elapsed - pausedSince.current! < CAR_PAUSE_TIMEOUT_S;

        // Hard safety net, never overridden by the timeout above: a car
        // legitimately waiting out a full stopFor gate (up to PED_PHASE_SECONDS)
        // reads as "blocked" for far longer than CAR_PAUSE_TIMEOUT_S, so a
        // following car timing out and pushing through drove straight into
        // its stopped body — the push-through was meant to break head-on
        // deadlocks, not license ramming a car that's correctly still there.
        // Test only the real footprints over this frame's actual travel
        // distance: if executing the move would overlap another car's real
        // body, refuse regardless of how long we've been blocked.
        const stepHalfLen = CAR_HALF_LENGTH + step / 2;
        const stepCenterX = pos.current.x + fwdX * (step / 2);
        const stepCenterZ = pos.current.z + fwdZ * (step / 2);
        let bodyBlocked = false;
        for (const [otherId, other] of carPositions) {
            if (otherId === vehicle.id) continue;
            if (rectsOverlap(
                stepCenterX, stepCenterZ, fwdX, fwdZ, stepHalfLen, CAR_HALF_WIDTH,
                other.pos.x, other.pos.z, other.fwdX, other.fwdZ, CAR_HALF_LENGTH, CAR_HALF_WIDTH,
            )) {
                bodyBlocked = true;
                break;
            }
        }
        if (softHold || bodyBlocked) {
            return; // hold: no movement, no wheel spin
        }

        let moved = step;
        if (dist <= step) {
            pos.current.copy(targetPos);
            moved = dist;
            // stopFor gate: hold at the (setback) stop point while peds have the light
            if (!(target.stopFor && lightPhase(elapsed) === 'peds')) {
                const atPathEnd = !curPath.loop && nextIdx.current === curPath.waypoints.length - 1;
                if (!atPathEnd) {
                    nextIdx.current = curPath.loop
                        ? (nextIdx.current + 1) % curPath.waypoints.length
                        : nextIdx.current + 1;
                } else {
                    // End of an open path: hop onto the linked path/node found at
                    // conversion time (same idea as a ped crossing hop), or hold
                    // in place if nothing was close enough to link (dead end).
                    const link = target.endLink;
                    const dest = link ? CAR_PATHS_BY_ID.get(link.pathId) : undefined;
                    if (link && dest) {
                        pathRef.current = dest;
                        nextIdx.current = (link.waypointIdx + 1) % dest.waypoints.length;
                    }
                }
            }
        } else {
            pos.current.addScaledVector(moveDir!, step);
        }

        // Roll the wheels by the arc length the car covered this frame
        const spin = moved / assets.wheelRadius;
        for (const wheel of wheels) wheel.rotation.x += spin;

        if (groupRef.current) {
            groupRef.current.position.copy(pos.current);
            const activePath = pathRef.current;
            const fromIdx = (nextIdx.current - 1 + activePath.waypoints.length) % activePath.waypoints.length;
            groupRef.current.rotation.y = activePath.waypoints[fromIdx].ry ?? 0;
        }
    });

    const startRy = path.waypoints[(startNextIdx - 1 + path.waypoints.length) % path.waypoints.length].ry ?? 0;

    return (
        <group ref={groupRef} position={[startPos.x, startPos.y, startPos.z]} rotation={[0, startRy, 0]}>
            {/* GLB nose points +X; the ry convention faces −Z at 0 — yaw the model into line */}
            <group rotation={[0, Math.PI / 2, 0]} scale={assets.modelScale} position={[0, assets.yOffset, 0]}>
                <primitive object={model} />
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Vehicles — junkers spread along every exported car loop
// ---------------------------------------------------------------------------

interface CarSpawn {
    id: string;
    path: WaypointPath;
    startPos: THREE.Vector3;
    startNextIdx: number;
}

/**
 * Renders every street vehicle: junkers spawned along each exported car loop
 * (one per ~CAR_TARGET_SPACING units, evenly spaced), painted from the cosmetic
 * tint pool, wheels rolling with ground speed. Baked `stopFor` waypoints gate
 * cars a few metres before crossings during the ped light phase; an
 * oriented-bounding-box collision check (rectsOverlap) queues cars behind a
 * stopped leader and holds cross traffic at merges/intersections. Must render
 * inside a <Suspense> boundary (GLB + texture loads suspend).
 */
function Vehicles() {
    const assets = useCarAssets();

    const spawns = useMemo((): CarSpawn[] =>
        STREET_PATHS.carPaths.flatMap((path) => {
            const total = pathTotalLength(path);
            const count = Math.max(1, Math.round(total / CAR_TARGET_SPACING));
            return Array.from({ length: count }, (_, rank): CarSpawn => {
                const { pos, nextIdx } = positionAtPathDistance(path, (rank * total) / count);
                return { id: `car-${path.id}-${rank}`, path, startPos: pos, startNextIdx: nextIdx };
            });
        }), []);

    return (
        <>
            {spawns.map((s) => (
                <JunkerCar
                    key={s.id}
                    assets={assets}
                    vehicle={{ id: s.id, pathId: s.path.id, speed: CAR_SPEED_MPS * VEHICLE_WORLD_SCALE }}
                    path={s.path}
                    startPos={s.startPos}
                    startNextIdx={s.startNextIdx}
                />
            ))}
        </>
    );
}

export default Vehicles;
