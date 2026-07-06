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
 * A car holds while the same-loop car ahead is closer than this (world units,
 * centre-to-centre; the junker is ~10.7 long) — queues form at stop gates
 * instead of cars stacking on the same stop node.
 */
const MIN_CAR_SEPARATION = 13;
/** cos of the half-angle of the "ahead" cone for the follow-gap check. */
const CAR_BLOCK_CONE_COS = Math.cos((45 * Math.PI) / 180);

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
// Shared per-frame position registry for the follow-gap check
// ---------------------------------------------------------------------------

const carPositions = new Map<string, { pathId: string; pos: THREE.Vector3 }>();

// ---------------------------------------------------------------------------
// JunkerCar — one vehicle following a car loop
// ---------------------------------------------------------------------------

interface JunkerCarProps {
    assets: CarAssets;
    vehicle: VehicleConfig;
    path: WaypointPath;
    /** Spawn point along the loop (see positionAtPathDistance). */
    startPos: THREE.Vector3;
    startNextIdx: number;
}

function JunkerCar({ assets, vehicle, path, startPos, startNextIdx }: JunkerCarProps) {
    const groupRef = useRef<THREE.Group>(null);
    const pos = useRef(startPos.clone());
    const nextIdx = useRef(startNextIdx);

    const { model, wheels } = useMemo(
        () => buildCarModel(assets.template, randomFrom(CAR_BODY_TINTS)),
        [assets],
    );

    useEffect(() => {
        return () => { carPositions.delete(vehicle.id); };
    }, [vehicle.id]);

    useFrame((state, delta) => {
        // Register current position so followers on this loop can read it
        let entry = carPositions.get(vehicle.id);
        if (!entry) { entry = { pathId: vehicle.pathId, pos: new THREE.Vector3() }; carPositions.set(vehicle.id, entry); }
        entry.pos.copy(pos.current);

        const target = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget = targetPos.clone().sub(pos.current);
        const dist = toTarget.length();
        const step = vehicle.speed * delta;
        const moveDir = dist > 1e-6 ? toTarget.clone().divideScalar(dist) : null;

        // Follow gap: hold while the same-loop car ahead is too close. Cars on a
        // loop share one speed and never gain on each other in the open — this
        // only bites behind a car held at a stopFor gate, so no push-through
        // timeout is needed (the leader always clears when the light flips).
        if (moveDir) {
            for (const [otherId, other] of carPositions) {
                if (otherId === vehicle.id || other.pathId !== vehicle.pathId) continue;
                const diff = other.pos.clone().sub(pos.current);
                const d = diff.length();
                if (d < MIN_CAR_SEPARATION && d > 1e-4 && diff.divideScalar(d).dot(moveDir) > CAR_BLOCK_CONE_COS) {
                    return; // hold: no movement, no wheel spin
                }
            }
        }

        let moved = step;
        if (dist <= step) {
            pos.current.copy(targetPos);
            moved = dist;
            // stopFor gate: hold at the baked stop node while peds have the light
            if (!(target.stopFor && lightPhase(state.clock.elapsedTime) === 'peds')) {
                nextIdx.current = (nextIdx.current + 1) % path.waypoints.length;
            }
        } else {
            pos.current.addScaledVector(moveDir!, step);
        }

        // Roll the wheels by the arc length the car covered this frame
        const spin = moved / assets.wheelRadius;
        for (const wheel of wheels) wheel.rotation.x += spin;

        if (groupRef.current) {
            groupRef.current.position.copy(pos.current);
            const fromIdx = (nextIdx.current - 1 + path.waypoints.length) % path.waypoints.length;
            groupRef.current.rotation.y = path.waypoints[fromIdx].ry ?? 0;
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
 * cars at crossings during the ped light phase; the follow gap queues cars
 * behind a gated leader. Must render inside a <Suspense> boundary (GLB +
 * texture loads suspend).
 */
function Vehicles() {
    const assets = useCarAssets();

    const spawns = useMemo((): CarSpawn[] =>
        STREET_PATHS.carPaths.flatMap((path) => {
            const total = pathTotalLength(path.waypoints);
            const count = Math.max(1, Math.round(total / CAR_TARGET_SPACING));
            return Array.from({ length: count }, (_, rank): CarSpawn => {
                const { pos, nextIdx } = positionAtPathDistance(path.waypoints, (rank * total) / count);
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
