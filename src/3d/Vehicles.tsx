import { useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { AMBULANCE_HEALTH_MIN, JEEP_SECURITY_MIN, VEHICLE_FOOTPRINT, type VehicleModelId } from '../Constants/Vehicles';
import { CAR_MAX, STREET_ASPHALT_Y } from '../Constants/Traffic';
import { vehicleModelForSpawn, vehicleTierFor } from '../Utils/VehiclePool';
import { setCarPicker, streetSim } from '../Traffic/streetWorld';
import type { StreetSim } from '../Traffic/StreetSim';

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

/**
 * World units per metre for vehicles — the same 3.7× factor as the citizens'
 * PED_WORLD_SCALE: the env GLBs are drawn oversized, so cars are scaled to match.
 */
const VEHICLE_WORLD_SCALE = 3.7;

/**
 * Junker length in metres (× VEHICLE_WORLD_SCALE at render). Tuned to ~65% of
 * the real 4.5 m — full metric size read too big against the street.
 */
const CAR_LENGTH_M = 2.9;

/**
 * The procedural POC cars (tools/blender/vehicles.py) are modelled at game size under a root
 * carrying the street GLBs' stray 0.001 scale (cf. StreetView's GLB_UNIT_FIX), with a +90° Y turn
 * so the root's local X is the axle; nose +X in scene space like the junker. Wheels are separate
 * nodes pivoted on their hubs.
 */
const VEHICLE_GLB_UNIT_FIX = 1000;
const POC_WHEEL_NODES = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] as const;

/** Per-model asset spec. `tinted` cars get a paint colour from CAR_BODY_TINTS on their `*_body` material. */
interface CarModelSpec {
    url: string;
    tinted: boolean;
}

const POC_CAR_MODELS: Record<Exclude<VehicleModelId, 'junker'>, CarModelSpec> = {
    sedan:     { url: '/models/vehicles/car_sedan.glb',         tinted: true },
    limo:      { url: '/models/vehicles/car_limo.glb',          tinted: false },
    jeep:      { url: '/models/vehicles/car_jeep_military.glb', tinted: false },
    ambulance: { url: '/models/vehicles/car_ambulance.glb',     tinted: false },
};
const POC_CAR_IDS = Object.keys(POC_CAR_MODELS) as Exclude<VehicleModelId, 'junker'>[];

// Body tint pool — car_junker_body.png is grayscale so material.color multiplies through as the
// paint colour. Picked by spawn serial: cosmetic only, never the seeded gameplay RNG (ADR-0010).
const CAR_BODY_TINTS = ['#c8c8c8', '#9a4a3a', '#5a7a9a', '#6a7a4a', '#a08a5a', '#606060', '#7a5a8a', '#9a8a3a'];

// ---------------------------------------------------------------------------
// Asset bundle prepared once per session
// ---------------------------------------------------------------------------

interface CarAssets {
    /** Prepared template — textured, wheels re-pivoted; clone per pool slot. */
    template: THREE.Group;
    /** Uniform scale bringing the GLB to its world size. */
    modelScale: number;
    /** World-Y lift (already scaled) so the tyre bottoms sit on the road plane. */
    yOffset: number;
    /** Tyre radius in world units (already scaled) — drives wheel spin rate. */
    wheelRadius: number;
    /** Names of the wheel nodes spun by rotation.x. */
    wheelNodes: readonly string[];
}

/** Loads and prepares every street vehicle model. Suspends. */
function useVehicleAssets(): Record<VehicleModelId, CarAssets> {
    const junker = useJunkerAssets();
    const gltfs = useLoader(GLTFLoader, POC_CAR_IDS.map((id) => POC_CAR_MODELS[id].url));
    const poc = useMemo(
        () => Object.fromEntries(POC_CAR_IDS.map((id, i) => [id, preparePocCar(gltfs[i].scene as THREE.Group, POC_CAR_MODELS[id])])),
        [gltfs],
    ) as Record<Exclude<VehicleModelId, 'junker'>, CarAssets>;
    return useMemo(() => ({ junker, ...poc }), [junker, poc]);
}

/**
 * Prepares a POC car (see VEHICLE_GLB_UNIT_FIX): keeps each material's embedded albedo, sampled
 * nearest like the street, on a plain MeshStandardMaterial. Idempotent — useLoader caches the
 * scene and StrictMode re-runs the memo on the same object.
 */
function preparePocCar(scene: THREE.Group, spec: CarModelSpec): CarAssets {
    scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const prep = (mat: THREE.Material): THREE.Material => {
            const map = (mat as THREE.MeshStandardMaterial).map ?? null;
            if (map) {
                // Set before the first GPU upload, so no needsUpdate is required.
                map.magFilter = THREE.NearestFilter;
                map.minFilter = THREE.NearestFilter;
            }
            const out = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
            out.name = mat.name;
            out.userData.kind = spec.tinted && mat.name.endsWith('_body') ? 'body' : 'fixed';
            return out;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prep) : prep(mesh.material);
    });
    scene.updateMatrixWorld(true);
    const modelScale = VEHICLE_GLB_UNIT_FIX;
    const carBox = new THREE.Box3().setFromObject(scene);
    const yOffset = -carBox.min.y * modelScale;
    const wheel = scene.getObjectByName(POC_WHEEL_NODES[0]);
    const wheelBox = wheel ? new THREE.Box3().setFromObject(wheel) : carBox;
    const wheelRadius = Math.max(((wheelBox.max.y - wheelBox.min.y) / 2) * modelScale, 1e-6);
    return { template: scene, modelScale, yOffset, wheelRadius, wheelNodes: POC_WHEEL_NODES };
}

/** Loads and prepares the junker model + textures. Suspends. */
function useJunkerAssets(): CarAssets {
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

        return { template: scene, modelScale, yOffset, wheelRadius, wheelNodes: ['wheels_front', 'wheels_back'] };
    }, [gltf, loaded]);
}

// ---------------------------------------------------------------------------
// Model construction per pool slot
// ---------------------------------------------------------------------------

interface CarParts {
    /** Positioned model wrapper (nose yaw, scale, ground lift) — child of a pool slot. */
    root: THREE.Group;
    /** Wheel nodes of this clone — rotation.x spins them around the axle. */
    wheels: THREE.Object3D[];
    /** This clone's own paint materials, re-tinted whenever the slot gets a new car. */
    paint: THREE.MeshStandardMaterial[];
    wheelRadius: number;
}

/** Clones a model once for a pool slot; body panels get their own paint material. */
function buildCarModel(assets: CarAssets): CarParts {
    const model = assets.template.clone(true);
    const paint: THREE.MeshStandardMaterial[] = [];
    model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const own = (mat: THREE.Material): THREE.Material => {
            if (mat.userData.kind !== 'body') return mat;
            const painted = (mat as THREE.MeshStandardMaterial).clone();
            paint.push(painted);
            return painted;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    });
    const wheels = assets.wheelNodes
        .map((name) => model.getObjectByName(name))
        .filter((w): w is THREE.Object3D => w !== undefined);
    // GLB nose points +X; the sim's yaw faces +Z at 0 — turn the model into line, scale, lift
    const root = new THREE.Group();
    root.rotation.y = -Math.PI / 2;
    root.scale.setScalar(assets.modelScale);
    root.position.y = assets.yOffset;
    root.add(model);
    return { root, wheels, paint, wheelRadius: assets.wheelRadius };
}

// ---------------------------------------------------------------------------
// Car pool — fixed slots driven by the traffic simulation
// ---------------------------------------------------------------------------

interface Slot {
    group: THREE.Group;
    /** Sim car serial shown in this slot, -1 when idle. */
    serial: number;
    model: VehicleModelId | null;
    parts: Map<VehicleModelId, CarParts>;
    lastOdo: number;
}

/**
 * Renders the street traffic simulation's cars (src/Traffic/StreetSim.ts, ADR-0014). A fixed pool
 * of CAR_MAX slots is reused as cars spawn off-camera and despawn: each slot lazily caches one
 * clone per model, so spawning costs no React work and no allocation once warm. The model per
 * spawn follows the traffic mix (Constants/Vehicles.ts via vehicleModelForSpawn): junkers / sedans
 * / sedans + limos by infrastructure tier, plus military jeeps while security is Militarised and
 * ambulances while health is funded high. Must render inside a <Suspense> boundary.
 */
function Vehicles() {
    const assets = useVehicleAssets();
    // Primitive selectors only (an object-returning selector re-renders forever).
    const infrastructure = useGameStore((s) => s.budget.expenditures.infrastructure);
    const security = useGameStore((s) => s.budget.expenditures.security);
    const health = useGameStore((s) => s.budget.expenditures.health);
    const tier = vehicleTierFor(infrastructure);
    const jeepOn = security >= JEEP_SECURITY_MIN;
    const ambulanceOn = health >= AMBULANCE_HEALTH_MIN;

    // The sim asks for a model per spawn; keep its answer in step with the budget. Set during
    // render (idempotent) so it is in place before the sim's first warm-up spawns.
    useMemo(() => setCarPicker((serial) => {
        const model = vehicleModelForSpawn(serial, tier, jeepOn, ambulanceOn);
        const fp = VEHICLE_FOOTPRINT[model];
        return { model, halfLen: fp.halfLength, halfWidth: fp.halfWidth };
    }), [tier, jeepOn, ambulanceOn]);

    const pool = useMemo(() => {
        const root = new THREE.Group();
        const slots: Slot[] = Array.from({ length: CAR_MAX }, () => {
            const group = new THREE.Group();
            group.visible = false;
            root.add(group);
            return { group, serial: -1, model: null, parts: new Map(), lastOdo: 0 };
        });
        // a fresh pool per asset bundle: slot clones are built from these templates
        return { root, slots, assets, bySerial: new Map<number, Slot>(), alive: new Set<number>(), sim: null as StreetSim | null };
    }, [assets]);

    useFrame(() => {
        const sim = streetSim();
        const { slots, bySerial, alive } = pool;
        if (pool.sim !== sim) {
            // the sim was rebuilt (road props changed): serials restart, so drop every assignment
            for (const slot of slots) { slot.serial = -1; slot.group.visible = false; }
            bySerial.clear();
            pool.sim = sim;
        }
        const models = pool.assets;
        alive.clear();
        for (const car of sim.cars) alive.add(car.serial);
        // free slots whose car despawned
        for (const slot of slots) {
            if (slot.serial >= 0 && !alive.has(slot.serial)) {
                bySerial.delete(slot.serial);
                slot.serial = -1;
                slot.group.visible = false;
            }
        }
        for (const car of sim.cars) {
            let slot = bySerial.get(car.serial);
            if (!slot) {
                slot = slots.find((s) => s.serial < 0);
                if (!slot) continue; // more cars than slots (cannot happen at CAR_MAX) — skip drawing
                const model = car.spec.model as VehicleModelId;
                let parts = slot.parts.get(model);
                if (!parts) { parts = buildCarModel(models[model]); slot.parts.set(model, parts); }
                if (slot.model !== model) {
                    const prev = slot.model ? slot.parts.get(slot.model) : undefined;
                    if (prev) slot.group.remove(prev.root);
                    slot.group.add(parts.root);
                    slot.model = model;
                }
                const tint = CAR_BODY_TINTS[car.serial % CAR_BODY_TINTS.length];
                for (const m of parts.paint) m.color.set(tint);
                slot.serial = car.serial;
                slot.lastOdo = car.odo;
                slot.group.visible = true;
                bySerial.set(car.serial, slot);
            }
            slot.group.position.set(car.x, STREET_ASPHALT_Y, car.z);
            slot.group.rotation.y = car.yaw;
            // roll the wheels by the distance driven since the last frame
            const parts = slot.parts.get(slot.model!)!;
            const spin = (car.odo - slot.lastOdo) / parts.wheelRadius;
            slot.lastOdo = car.odo;
            for (const w of parts.wheels) w.rotation.x += spin;
        }
    });

    return <primitive object={pool.root} />;
}

export default Vehicles;
