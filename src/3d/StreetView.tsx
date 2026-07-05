import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { STREET_LAYOUT } from '../assets/streetLayout';
import { useStreetLayout, STREET_TEXTURE_SLOTS, STREET_TEXTURE_URLS } from '../Hooks/useStreetLayout';
import type { ResolvedPlacement } from '../types/WorldLayout';
import type { WaypointPath, PedestrianConfig, VehicleConfig } from '../types/StreetLayout';
import type { CitizenState } from '../types/Citizen';
import type { Citizen } from '../types/Citizen';
import { computeBodyType } from '../Stores/CitizenHandler';
import { pathTotalLength, positionAtPathDistance } from '../Utils/PathUtils';
import FbxCitizens from './FbxCitizens';

const BUILDING_COLOR = '#7a6e62';
const PLAZA_COLOR = '#b8a98a';
const ROAD_COLOR = '#4a4a4a';
const PEDESTRIAN_COLOR = '#4a90d9';
const VEHICLE_COLOR = '#d94a4a';

// Metric scale: 1 unit = 1 metre (see art-bible §10.0)
const CAR_HALF_HEIGHT = 0.7;
const DEBUG_ARROW_Y = 2.0;
/** Citizens pause when another ped is within this distance ahead of them (metres). */
const MIN_PED_SEPARATION = 1.5;

// ---------------------------------------------------------------------------
// Shared citizen position registry — updated every frame by CitizenWalker,
// read by neighbours for proximity checks. Module-level so all instances share it.
// ---------------------------------------------------------------------------
const citizenPedPositions = new Map<number, THREE.Vector3>();

// ---------------------------------------------------------------------------
// Outfit / body helpers
// ---------------------------------------------------------------------------

/** Outfit precedence chain — first matching rule wins (GDD §3.2). Returns a hex color. */
function getOutfit(
    role: CitizenState['role'],
    employed: boolean,
    faction: Citizen['faction'],
): string {
    if (role === 'thief') return '#444444';
    // TODO: swap to ped_special_man_protestor when asset is created
    if (role === 'protestor') return '#c0392b';
    if (employed && faction === 'military') return '#3d6b3d';
    if (employed && faction === 'business') return '#1e3a5f';
    return '#c8a882';
}

/** Box geometry dimensions [width, height, depth] by body type. */
function getPedDimensions(bodyType: 'slim' | 'fit' | 'fat'): [number, number, number] {
    switch (bodyType) {
        case 'fat': return [0.8, 1.5, 0.8];
        case 'slim': return [0.4, 1.6, 0.4];
        case 'fit': return [0.6, 1.8, 0.6];
    }
}

/** Protestors cluster statically at these plaza positions (cycles if > 8). */
const PROTESTOR_POSITIONS: readonly [number, number, number][] = [
    [-2, 0, -7], [-1, 0, -8], [0, 0, -7], [1, 0, -8], [2, 0, -7],
    [-2, 0, -10], [0, 0, -10], [2, 0, -10],
];

// ---------------------------------------------------------------------------
// PedWalker
// ---------------------------------------------------------------------------

interface PedWalkerProps {
    ped: PedestrianConfig;
    path: WaypointPath;
    debugEnabled: boolean;
    /** Override mesh color — defaults to PEDESTRIAN_COLOR for atmospheric peds. */
    color?: string;
    /** Override box dimensions [w, h, d] — defaults to [0.6, 1.8, 0.6]. */
    dimensions?: [number, number, number];
    /** Exact world start position (arc-length computed). Atmospheric peds omit this. */
    startPos?: THREE.Vector3;
    /** Waypoint index after startPos. */
    startNextIdx?: number;
    /** Citizen ID for the shared position registry and proximity checks. Omit for atmospheric peds. */
    citizenId?: number;
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

function PedWalker({
    ped, path, debugEnabled,
    color, dimensions,
    startPos, startNextIdx,
    citizenId, onClick,
}: PedWalkerProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    const initPos = startPos ?? new THREE.Vector3(path.waypoints[0].x, path.waypoints[0].y, path.waypoints[0].z);
    const initNextIdx = startNextIdx ?? 1;

    const pos = useRef(initPos.clone());
    const nextIdx = useRef(initNextIdx);

    const meshColor = color ?? PEDESTRIAN_COLOR;
    const [w, h, d] = dimensions ?? [0.6, 1.8, 0.6];
    const halfH = h / 2;

    // Remove this citizen from the registry on unmount (death, role → protestor, etc.)
    useEffect(() => {
        return () => { if (citizenId !== undefined) citizenPedPositions.delete(citizenId); };
    }, [citizenId]);

    useFrame((_, delta) => {
        // Register current position so neighbours can read it
        if (citizenId !== undefined) {
            let entry = citizenPedPositions.get(citizenId);
            if (!entry) { entry = new THREE.Vector3(); citizenPedPositions.set(citizenId, entry); }
            entry.copy(pos.current);
        }

        const target = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget = targetPos.clone().sub(pos.current);
        const dist = toTarget.length();
        const moveDir = toTarget.clone().normalize();

        // Proximity pause: if another citizen ped is close AND ahead, wait this frame
        if (citizenId !== undefined) {
            for (const [otherId, otherPos] of citizenPedPositions) {
                if (otherId === citizenId) continue;
                const diff = otherPos.clone().sub(pos.current);
                if (diff.length() < MIN_PED_SEPARATION && diff.dot(moveDir) > 0) return;
            }
        }

        const step = ped.speed * delta;
        if (dist <= step) {
            pos.current.copy(targetPos);
            nextIdx.current = (nextIdx.current + 1) % path.waypoints.length;
        } else {
            pos.current.addScaledVector(moveDir, step);
        }

        if (meshRef.current) {
            meshRef.current.position.set(pos.current.x, pos.current.y + halfH, pos.current.z);
            const fromIdx = (nextIdx.current - 1 + path.waypoints.length) % path.waypoints.length;
            meshRef.current.rotation.y = path.waypoints[fromIdx].ry ?? 0;
        }
    });

    const initRenderPos: [number, number, number] = [initPos.x, initPos.y + halfH, initPos.z];

    return (
        <>
            <mesh ref={meshRef} position={initRenderPos} onClick={onClick}>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={meshColor} />
            </mesh>

            {debugEnabled && path.waypoints.map((wp, i) => (
                <group key={i} position={[wp.x, wp.y + DEBUG_ARROW_Y, wp.z]} rotation={[0, wp.ry ?? 0, 0]}>
                    <mesh position={[0, 0, -1.5]}>
                        <boxGeometry args={[0.15, 0.15, 3.0]} />
                        <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={0.8} />
                    </mesh>
                    <mesh position={[0, 0, -3.3]} rotation={[Math.PI / 2, 0, 0]}>
                        <coneGeometry args={[0.3, 0.6, 6]} />
                        <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={0.8} />
                    </mesh>
                </group>
            ))}
        </>
    );
}

// ---------------------------------------------------------------------------
// CarWalker (unchanged)
// ---------------------------------------------------------------------------

interface CarWalkerProps {
    vehicle: VehicleConfig;
    path: WaypointPath;
    debugEnabled: boolean;
}

function CarWalker({ vehicle, path, debugEnabled }: CarWalkerProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const pos = useRef(new THREE.Vector3(path.waypoints[0].x, path.waypoints[0].y, path.waypoints[0].z));
    const nextIdx = useRef(1 % path.waypoints.length);

    useFrame((_, delta) => {
        const target = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget = targetPos.clone().sub(pos.current);
        const dist = toTarget.length();
        const step = vehicle.speed * delta;

        if (dist <= step) {
            pos.current.copy(targetPos);
            nextIdx.current = (nextIdx.current + 1) % path.waypoints.length;
        } else {
            toTarget.normalize();
            pos.current.addScaledVector(toTarget, step);
        }

        if (meshRef.current) {
            meshRef.current.position.set(pos.current.x, pos.current.y + CAR_HALF_HEIGHT, pos.current.z);
            const fromIdx = (nextIdx.current - 1 + path.waypoints.length) % path.waypoints.length;
            meshRef.current.rotation.y = path.waypoints[fromIdx].ry ?? 0;
        }
    });

    const start = path.waypoints[0];

    return (
        <>
            <mesh ref={meshRef} position={[start.x, start.y + CAR_HALF_HEIGHT, start.z]}>
                <boxGeometry args={[2.0, 1.4, 4.5]} />
                <meshStandardMaterial color={VEHICLE_COLOR} />
            </mesh>

            {debugEnabled && path.waypoints.map((wp, i) => (
                <group key={i} position={[wp.x, wp.y + DEBUG_ARROW_Y, wp.z]} rotation={[0, wp.ry ?? 0, 0]}>
                    <mesh position={[0, 0, -1.5]}>
                        <boxGeometry args={[0.15, 0.15, 3.0]} />
                        <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={0.8} />
                    </mesh>
                    <mesh position={[0, 0, -3.3]} rotation={[Math.PI / 2, 0, 0]}>
                        <coneGeometry args={[0.3, 0.6, 6]} />
                        <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={0.8} />
                    </mesh>
                </group>
            ))}
        </>
    );
}

// ---------------------------------------------------------------------------
// PlacedObject — renders one IDE/IPL instance from the world layout system
// ---------------------------------------------------------------------------

/**
 * Readable solid colour per model, keyed on name fragments. Used until the GLB
 * re-export carries UVs and the IDE references an external texture (see below).
 */
function paletteFor(modelName: string): string {
    const n = modelName;
    if (n.includes('road') || n.includes('pothole')) return ROAD_COLOR;
    if (n.includes('plaza')) return PLAZA_COLOR;
    if (n.includes('tree')) return '#4a7a3a';
    if (n.includes('skybox') || n.includes('skyline')) return '#8fa6c4';
    if (n.includes('flag')) return '#9a3a3a';
    if (n.includes('graffiti') || n.includes('billboard')) return '#b07a3a';
    if (n.includes('bld') || n.includes('building') || n.includes('scaffolding')) return BUILDING_COLOR;
    if (n.includes('tank') || n.includes('cannon') || n.includes('gunnest') || n.includes('guard') ||
        n.includes('barricade') || n.includes('searchlight') || n.includes('camera_pole')) return '#5a5e4a';
    return '#9a9088';
}

function placementQuaternion(rot: ResolvedPlacement['rot']): THREE.Quaternion {
    return new THREE.Quaternion(rot[0], rot[1], rot[2], rot[3]);
}

/** "textures/Road_01.PNG" -> "road_01" — basename without extension, lower-cased. */
function normalizeTexName(path: string): string {
    const base = path.split('/').pop() ?? path;
    let name = base.replace(/\.[^.]+$/, '').toLowerCase();
    return name.replace(/_(png|jpg|jpeg|bmp|tga|gif)$/, '');
}

/**
 * The GLBs already render Y-up (the Max exporter adds a root −90° X node, matching
 * convert_maxdump.mjs), so no extra rotation is applied here. But the Max scene is
 * in millimetres, so every GLB carries a 0.001 mm→m mesh-node scale, rendering 1000×
 * too small. We multiply the placement scale by 1000 to undo it (net 1000 × 0.001 = 1).
 * Proper source fix: set Max System Units to metres and re-export, then drop GLB_UNIT_FIX.
 */
const GLB_UNIT_FIX = 1000;

function fixedScale(scale: ResolvedPlacement['scale']): [number, number, number] {
    return [scale[0] * GLB_UNIT_FIX, scale[1] * GLB_UNIT_FIX, scale[2] * GLB_UNIT_FIX];
}

/** Texture entry keyed by normalized basename — carries the loaded texture and its per-slot transparency flag. */
type TextureEntry = { tex: THREE.Texture; transparent: boolean };
type TextureMap = Map<string, TextureEntry>;

/**
 * Renders one IPL placement. Each mesh part keeps its own material slot; we apply the
 * external texture whose basename matches that part's material NAME (set at export time).
 * Transparency is per-slot — decals/foliage slots get alphaTest cutout independently.
 * Parts with no matching texture but an embedded map keep it; otherwise palette fallback.
 */
function PlacedObject({ placement, textures }: { placement: ResolvedPlacement; textures: TextureMap }) {
    const gltf = useLoader(GLTFLoader, `/${placement.asset}`);

    const object = useMemo(() => {
        const fallback = paletteFor(placement.modelName);
        const pickMaterial = (mat: THREE.Material): THREE.Material => {
            const entry = textures.get(normalizeTexName(mat.name ?? ''));
            if (entry) {
                const { tex, transparent } = entry;
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tex.needsUpdate = true;
                const alphaProps = transparent
                    ? { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }
                    : {};
                return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, ...alphaProps });
            }
            if ((mat as THREE.MeshStandardMaterial).map) return mat; // keep embedded texture
            return new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.9, metalness: 0 });
        };
        const g = (gltf.scene as THREE.Group).clone(true);
        g.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(pickMaterial)
                : pickMaterial(mesh.material);
        });
        return g;
    }, [gltf, textures, placement.modelName]);

    const quaternion = useMemo(() => placementQuaternion(placement.rot), [placement.rot]);
    const scale = useMemo(() => fixedScale(placement.scale), [placement.scale]);
    return <primitive object={object} position={placement.pos} quaternion={quaternion} scale={scale} />;
}

/**
 * Preloads every external street texture once, then renders all placements. Lives inside
 * the StreetView <Suspense> so the texture and GLB loads suspend together.
 */
function PlacedObjects({ placements }: { placements: ResolvedPlacement[] }) {
    const loaded = useLoader(THREE.TextureLoader, STREET_TEXTURE_URLS.map((u) => `/${u}`));

    const textures = useMemo((): TextureMap => {
        const map: TextureMap = new Map();
        STREET_TEXTURE_SLOTS.forEach((slot, i) => {
            const tex = loaded[i];
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false; // glTF UV convention
            map.set(normalizeTexName(slot.texture), { tex, transparent: slot.transparent });
        });
        return map;
    }, [loaded]);

    return (
        <>
            {placements.map((p) =>
                p.asset !== null
                    ? <PlacedObject key={p.instanceId} placement={p} textures={textures} />
                    : null,
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// StreetView
// ---------------------------------------------------------------------------

interface CitizenPathAssignment {
    startPos: THREE.Vector3;
    startNextIdx: number;
    speed: number;
}

function StreetView() {
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const debugEnabled = useGameStore((s) => s.debug.enabled);
    const placements = useStreetLayout();
    const citizens = useGameStore((s) => s.citizens);
    const citizenStates = useGameStore((s) => s.citizenStates);
    const health = useGameStore((s) => s.budget.expenditures.health);
    const selectPed = useGameStore((s) => s.scene.selectPed);

    // Pre-compute stable path assignments for all 25 citizens. Depends only on
    // the citizens array (set once at game start) so assignments never shift mid-run.
    // Each citizen gets a fixed slot evenly distributed along their path loop,
    // with a speed that varies across the group so they naturally spread further.
    const citizenPathAssignments = useMemo((): Map<number, CitizenPathAssignment> => {
        const map = new Map<number, CitizenPathAssignment>();
        if (citizens.length === 0) return map;

        const { pedestrianPaths } = STREET_LAYOUT;
        const pathGroups: number[][] = pedestrianPaths.map(() => []);
        citizens.forEach((c) => pathGroups[c.id % pedestrianPaths.length].push(c.id));

        pathGroups.forEach((ids, pathIdx) => {
            if (ids.length === 0) return;
            const path = pedestrianPaths[pathIdx];
            const total = pathTotalLength(path.waypoints);
            const gap = total / ids.length;

            ids.forEach((citizenId, rank) => {
                const { pos, nextIdx } = positionAtPathDistance(path.waypoints, rank * gap);
                // Spread speeds evenly across [0.9, 1.4] within each path group
                const speed = 0.9 + (rank / ids.length) * 0.5;
                map.set(citizenId, { startPos: pos, startNextIdx: nextIdx, speed });
            });
        });

        return map;
    }, [citizens]);

    if (activeTab !== Tabs.Street) return null;

    const { pedestrians, pedestrianPaths, vehicles, vehiclePaths } = STREET_LAYOUT;

    return (
        <group position={[0, 0, 0]}>
            {/* Ground — clicking deselects any selected citizen */}
            <mesh position={[0, -0.05, -8]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => selectPed(null)}>
                <planeGeometry args={[42, 28]} />
                <meshStandardMaterial transparent opacity={0} />
            </mesh>


            {/* IDE/IPL placed objects — GLBs textured from public/textures by material name */}
            <Suspense fallback={null}>
                <PlacedObjects placements={placements} />
            </Suspense>

            {/* Experimental: animated FBX fit-man crowd on the sidewalk loops */}
            <Suspense fallback={null}>
                <FbxCitizens paths={pedestrianPaths} />
            </Suspense>

            {/* Atmospheric pedestrians */}
            {pedestrians.map((ped) => {
                const path = pedestrianPaths.find((p) => p.id === ped.pathId);
                if (!path) return null;
                return <PedWalker key={ped.id} ped={ped} path={path} debugEnabled={debugEnabled} />;
            })}

            {/* Vehicles */}
            {vehicles.map((v) => {
                const path = vehiclePaths.find((p) => p.id === v.pathId);
                if (!path) return null;
                return <CarWalker key={v.id} vehicle={v} path={path} debugEnabled={debugEnabled} />;
            })}

            {/* Citizens — simulation entities by role/outfit/bodyType (Story 7-4/7-5) */}
            {citizens.length > 0 && (() => {
                let protestorSlot = 0;

                return citizenStates.map((cs, i) => {
                    if (!cs.alive) return null;

                    const citizen = citizens[i];
                    if (!citizen) return null;

                    const bodyType = computeBodyType(citizen.bodySeed, health);
                    const outfitColor = getOutfit(cs.role, cs.employed, citizen.faction);
                    const dims = getPedDimensions(bodyType);
                    const handleClick = (e: ThreeEvent<MouseEvent>) => {
                        e.stopPropagation();
                        selectPed(citizen.id);
                    };

                    // Protestors stand at the plaza — not walking
                    if (cs.role === 'protestor') {
                        const pos = PROTESTOR_POSITIONS[protestorSlot % PROTESTOR_POSITIONS.length];
                        protestorSlot++;
                        const [w, h, d] = dims;
                        return (
                            <mesh key={citizen.id} position={[pos[0], pos[1] + h / 2, pos[2]]} onClick={handleClick}>
                                <boxGeometry args={[w, h, d]} />
                                <meshStandardMaterial color={outfitColor} />
                            </mesh>
                        );
                    }

                    // content / neutral / thief — walk their assigned path slot
                    const assignment = citizenPathAssignments.get(citizen.id);
                    if (!assignment) return null;

                    const path = pedestrianPaths[citizen.id % pedestrianPaths.length];
                    const fakePed: PedestrianConfig = { id: `citizen-${citizen.id}`, pathId: path.id, speed: assignment.speed };

                    return (
                        <PedWalker
                            key={citizen.id}
                            ped={fakePed}
                            path={path}
                            debugEnabled={false}
                            color={outfitColor}
                            dimensions={dims}
                            startPos={assignment.startPos}
                            startNextIdx={assignment.startNextIdx}
                            citizenId={citizen.id}
                            onClick={handleClick}
                        />
                    );
                });
            })()}

        </group>
    );
}

export default StreetView;
