import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { STREET_LAYOUT } from '../assets/streetLayout';
import { useStreetLayout } from '../Hooks/useStreetLayout';
import type { ResolvedPlacement } from '../types/WorldLayout';
import type { WaypointPath, PedestrianConfig, VehicleConfig } from '../types/StreetLayout';
import { getVisibleModifiers } from '../Utils/Modifiers';
import type { CitizenState } from '../types/Citizen';
import type { Citizen } from '../types/Citizen';
import { computeBodyType } from '../Stores/CitizenHandler';

const BUILDING_COLOR   = '#7a6e62';
const PLAZA_COLOR      = '#b8a98a';
const GROUND_COLOR     = '#5a6b4a';
const ROAD_COLOR       = '#4a4a4a';
const PEDESTRIAN_COLOR = '#4a90d9';
const VEHICLE_COLOR    = '#d94a4a';

// Metric scale: 1 unit = 1 metre (see art-bible §10.0)
const CAR_HALF_HEIGHT   = 0.7;
const DEBUG_ARROW_Y     = 2.0;
/** Citizens pause when another ped is within this distance ahead of them (metres). */
const MIN_PED_SEPARATION = 1.5;

// ---------------------------------------------------------------------------
// Shared citizen position registry — updated every frame by CitizenWalker,
// read by neighbours for proximity checks. Module-level so all instances share it.
// ---------------------------------------------------------------------------
const citizenPedPositions = new Map<number, THREE.Vector3>();

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Euclidean length of a looping waypoint path (XZ plane only). */
function pathTotalLength(waypoints: WaypointPath['waypoints']): number {
    let total = 0;
    for (let i = 0; i < waypoints.length; i++) {
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        total += Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
    }
    return total;
}

/**
 * World position and next-waypoint index at arc-length `dist` along a looping path.
 * `dist` is wrapped into [0, totalLength) so callers can pass any value.
 */
function positionAtPathDistance(
    waypoints: WaypointPath['waypoints'],
    dist: number,
): { pos: THREE.Vector3; nextIdx: number } {
    const total = pathTotalLength(waypoints);
    let d = ((dist % total) + total) % total;

    for (let i = 0; i < waypoints.length; i++) {
        const a = waypoints[i];
        const b = waypoints[(i + 1) % waypoints.length];
        const segLen = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        if (d <= segLen) {
            const t = segLen > 0 ? d / segLen : 0;
            return {
                pos: new THREE.Vector3(a.x + (b.x - a.x) * t, a.y, a.z + (b.z - a.z) * t),
                nextIdx: (i + 1) % waypoints.length,
            };
        }
        d -= segLen;
    }
    return { pos: new THREE.Vector3(waypoints[0].x, waypoints[0].y, waypoints[0].z), nextIdx: 1 };
}

// ---------------------------------------------------------------------------
// Outfit / body helpers
// ---------------------------------------------------------------------------

/** Outfit precedence chain — first matching rule wins (GDD §3.2). Returns a hex color. */
function getOutfit(
    role: CitizenState['role'],
    employed: boolean,
    faction: Citizen['faction'],
): string {
    if (role === 'thief')     return '#444444';
    // TODO: swap to ped_special_man_protestor when asset is created
    if (role === 'protestor') return '#c0392b';
    if (employed && faction === 'military') return '#3d6b3d';
    if (employed && faction === 'business') return '#1e3a5f';
    return '#c8a882';
}

/** Box geometry dimensions [width, height, depth] by body type. */
function getPedDimensions(bodyType: 'slim' | 'fit' | 'fat'): [number, number, number] {
    switch (bodyType) {
        case 'fat':  return [0.8, 1.5, 0.8];
        case 'slim': return [0.4, 1.6, 0.4];
        case 'fit':  return [0.6, 1.8, 0.6];
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

    const initPos     = startPos ?? new THREE.Vector3(path.waypoints[0].x, path.waypoints[0].y, path.waypoints[0].z);
    const initNextIdx = startNextIdx ?? 1;

    const pos     = useRef(initPos.clone());
    const nextIdx = useRef(initNextIdx);

    const meshColor   = color ?? PEDESTRIAN_COLOR;
    const [w, h, d]   = dimensions ?? [0.6, 1.8, 0.6];
    const halfH       = h / 2;

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

        const target    = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget  = targetPos.clone().sub(pos.current);
        const dist      = toTarget.length();
        const moveDir   = toTarget.clone().normalize();

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
    const pos     = useRef(new THREE.Vector3(path.waypoints[0].x, path.waypoints[0].y, path.waypoints[0].z));
    const nextIdx = useRef(1 % path.waypoints.length);

    useFrame((_, delta) => {
        const target    = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget  = targetPos.clone().sub(pos.current);
        const dist      = toTarget.length();
        const step      = vehicle.speed * delta;

        if (dist <= step) {
            pos.current.copy(targetPos);
            nextIdx.current = (nextIdx.current + 1) % path.waypoints.length;
        } else {
            toTarget.normalize();
            pos.current.addScaledVector(toTarget, step);
        }

        if (meshRef.current) {
            meshRef.current.position.set(pos.current.x, pos.current.y + CAR_HALF_HEIGHT, pos.current.z);
            const fromIdx  = (nextIdx.current - 1 + path.waypoints.length) % path.waypoints.length;
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

/** Apply one shared material to every mesh in a cloned glTF scene + enable shadows. */
function applyMaterial(root: THREE.Object3D, material: THREE.Material): void {
    root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
            mesh.material = material;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
    });
}

function placementQuaternion(rot: ResolvedPlacement['rot']): THREE.Quaternion {
    return new THREE.Quaternion(rot[0], rot[1], rot[2], rot[3]);
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

/** GLB rendered with a flat palette colour (no texture available yet). */
function PlacedObjectSolid({ placement }: { placement: ResolvedPlacement }) {
    const gltf = useLoader(GLTFLoader, `/${placement.asset}`);

    const object = useMemo(() => {
        const g = (gltf.scene as THREE.Group).clone(true);
        applyMaterial(g, new THREE.MeshStandardMaterial({
            color: paletteFor(placement.modelName), roughness: 0.9, metalness: 0,
        }));
        return g;
    }, [gltf, placement.modelName]);

    const quaternion = useMemo(() => placementQuaternion(placement.rot), [placement.rot]);
    const scale = useMemo(() => fixedScale(placement.scale), [placement.scale]);
    return <primitive object={object} position={placement.pos} quaternion={quaternion} scale={scale} />;
}

/** GLB rendered with an EXTERNAL diffuse texture (public/textures/*) over its UVs. */
function PlacedObjectTextured({ placement }: { placement: ResolvedPlacement }) {
    const gltf = useLoader(GLTFLoader, `/${placement.asset}`);
    const texture = useLoader(THREE.TextureLoader, `/${placement.texture}`);

    const object = useMemo(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false; // glTF UV convention
        const g = (gltf.scene as THREE.Group).clone(true);
        applyMaterial(g, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 }));
        return g;
    }, [gltf, texture]);

    const quaternion = useMemo(() => placementQuaternion(placement.rot), [placement.rot]);
    const scale = useMemo(() => fixedScale(placement.scale), [placement.scale]);
    return <primitive object={object} position={placement.pos} quaternion={quaternion} scale={scale} />;
}

function PlacedObject({ placement }: { placement: ResolvedPlacement }) {
    // `texture` is fixed per instance (data-driven), so this branch never flips at runtime.
    return placement.texture
        ? <PlacedObjectTextured placement={placement} />
        : <PlacedObjectSolid placement={placement} />;
}

// ---------------------------------------------------------------------------
// StreetView
// ---------------------------------------------------------------------------

interface DebugSelection {
    id: string;
    worldPos: [number, number, number];
    size: [number, number, number];
}

interface CitizenPathAssignment {
    startPos: THREE.Vector3;
    startNextIdx: number;
    speed: number;
}

function StreetView() {
    const activeTab       = useGameStore((s) => s.tabs.activeTab);
    const debugEnabled    = useGameStore((s) => s.debug.enabled);
    const modifiers       = useGameStore((s) => s.gameManagement.modifiers);
    const round           = useGameStore((s) => s.gameManagement.round);
    const visibleModifiers = useMemo(() => getVisibleModifiers(modifiers, round), [modifiers, round]);
    const placements      = useStreetLayout();
    const citizens        = useGameStore((s) => s.citizens);
    const citizenStates   = useGameStore((s) => s.citizenStates);
    const health          = useGameStore((s) => s.budget.expenditures.health);
    const selectPed       = useGameStore((s) => s.scene.selectPed);
    const [selection, setSelection] = useState<DebugSelection | null>(null);

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
            const path  = pedestrianPaths[pathIdx];
            const total = pathTotalLength(path.waypoints);
            const gap   = total / ids.length;

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

    const { buildings, pedestrians, pedestrianPaths, vehicles, vehiclePaths } = STREET_LAYOUT;
    const fmt = (n: number) => n.toFixed(1);

    return (
        <group position={[0, 0, 0]}>
            {/* Ground — clicking deselects any selected citizen */}
            <mesh position={[0, -0.05, -8]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => selectPed(null)}>
                <planeGeometry args={[42, 28]} />
                <meshStandardMaterial color={GROUND_COLOR} />
            </mesh>

            {/* Road strip + box-building placeholders — debug-only reference now that the
                IPL/IDE GLBs (env_roads, env_bld_*) provide the real geometry. */}
            {debugEnabled && (
                <mesh position={[0, -0.04, -8]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[7, 28]} />
                    <meshStandardMaterial color={ROAD_COLOR} />
                </mesh>
            )}

            {debugEnabled && buildings.map((b) => {
                const wp: [number, number, number] = [b.position.x, b.scale.y / 2, b.position.z];
                return (
                    <mesh
                        key={b.id}
                        position={wp}
                        onClick={() => setSelection({ id: b.id, worldPos: wp, size: [b.scale.x, b.scale.y, b.scale.z] })}
                    >
                        <boxGeometry args={[b.scale.x, b.scale.y, b.scale.z]} />
                        <meshStandardMaterial color={BUILDING_COLOR} />
                    </mesh>
                );
            })}

            {/* IDE/IPL placed objects — OBJ reference meshes rendered as wireframe */}
            <Suspense fallback={null}>
                {placements.map((p) =>
                    p.asset !== null
                        ? <PlacedObject key={p.instanceId} placement={p} />
                        : null
                )}
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

                    const bodyType    = computeBodyType(citizen.bodySeed, health);
                    const outfitColor = getOutfit(cs.role, cs.employed, citizen.faction);
                    const dims        = getPedDimensions(bodyType);
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

            {/* Debug: click-to-inspect building position/size */}
            {debugEnabled && selection && (
                <Html position={[selection.worldPos[0], selection.worldPos[1] + selection.size[1] / 2 + 1, selection.worldPos[2]]}>
                    <div
                        style={{
                            background: 'rgba(0,0,0,0.88)',
                            color: '#fbee32',
                            padding: '5px 8px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            border: '1px solid #fbee32',
                            pointerEvents: 'none',
                        }}
                    >
                        <div style={{ marginBottom: 3 }}><b>{selection.id}</b></div>
                        <div>pos  [{selection.worldPos.map(fmt).join(', ')}]</div>
                        <div>size [{selection.size.map(fmt).join(', ')}] m</div>
                        <div>active effects: {visibleModifiers.length}</div>
                    </div>
                </Html>
            )}
        </group>
    );
}

export default StreetView;
