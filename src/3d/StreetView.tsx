import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { STREET_LAYOUT } from '../assets/streetLayout';
import type { WaypointPath, PedestrianConfig, VehicleConfig } from '../types/StreetLayout';
import { getVisibleModifiers } from '../Utils/Modifiers';

const BUILDING_COLOR   = '#7a6e62';
const PLAZA_COLOR      = '#b8a98a';
const GROUND_COLOR     = '#5a6b4a';
const ROAD_COLOR       = '#4a4a4a';
const PEDESTRIAN_COLOR = '#4a90d9';
const VEHICLE_COLOR    = '#d94a4a';

// Metric scale: 1 unit = 1 metre (see art-bible §10.0)
const PED_HALF_HEIGHT   = 0.9;  // half of 1.8 m person
const CAR_HALF_HEIGHT   = 0.7;  // half of 1.4 m car
const DEBUG_ARROW_Y     = 2.0;  // height above ground for debug waypoint arrows

interface PedWalkerProps {
    ped: PedestrianConfig;
    path: WaypointPath;
    debugEnabled: boolean;
}

function PedWalker({ ped, path, debugEnabled }: PedWalkerProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const pos     = useRef(new THREE.Vector3(path.waypoints[0].x, path.waypoints[0].y, path.waypoints[0].z));
    const nextIdx = useRef(1 % path.waypoints.length);

    useFrame((_, delta) => {
        const target    = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget  = targetPos.clone().sub(pos.current);
        const dist      = toTarget.length();
        const step      = ped.speed * delta;

        if (dist <= step) {
            pos.current.copy(targetPos);
            nextIdx.current = (nextIdx.current + 1) % path.waypoints.length;
        } else {
            toTarget.normalize();
            pos.current.addScaledVector(toTarget, step);
        }

        if (meshRef.current) {
            meshRef.current.position.set(pos.current.x, pos.current.y + PED_HALF_HEIGHT, pos.current.z);
            const fromIdx  = (nextIdx.current - 1 + path.waypoints.length) % path.waypoints.length;
            meshRef.current.rotation.y = path.waypoints[fromIdx].ry ?? 0;
        }
    });

    const start = path.waypoints[0];

    return (
        <>
            <mesh ref={meshRef} position={[start.x, start.y + PED_HALF_HEIGHT, start.z]}>
                <boxGeometry args={[0.6, 1.8, 0.6]} />
                <meshStandardMaterial color={PEDESTRIAN_COLOR} />
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

interface DebugSelection {
    id: string;
    worldPos: [number, number, number];
    size: [number, number, number];
}

function StreetView() {
    const activeTab       = useGameStore((s) => s.tabs.activeTab);
    const debugEnabled    = useGameStore((s) => s.debug.enabled);
    const modifiers = useGameStore((s) => s.gameManagement.modifiers);
    const round = useGameStore((s) => s.gameManagement.round);
    // Active-effect projection (ADR-0008 §8 / TR-street-001). Stable primitive selectors
    // avoid allocating a new array on every store update; useMemo recomputes only when
    // modifiers ref or round number actually changes.
    const visibleModifiers = useMemo(() => getVisibleModifiers(modifiers, round), [modifiers, round]);
    const [selection, setSelection] = useState<DebugSelection | null>(null);

    if (activeTab !== Tabs.Street) return null;

    const { buildings, plaza, pedestrians, pedestrianPaths, vehicles, vehiclePaths } = STREET_LAYOUT;

    const fmt = (n: number) => n.toFixed(1);

    return (
        <group position={[0, 0, 0]}>
            {/* Ground */}
            <mesh position={[0, -0.05, -8]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[42, 28]} />
                <meshStandardMaterial color={GROUND_COLOR} />
            </mesh>

            {/* Road strip */}
            <mesh position={[0, -0.04, -8]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[7, 28]} />
                <meshStandardMaterial color={ROAD_COLOR} />
            </mesh>

            {/* Buildings */}
            {buildings.map((b) => {
                const wp: [number, number, number] = [b.position.x, b.scale.y / 2, b.position.z];
                return (
                    <mesh
                        key={b.id}
                        position={wp}
                        onClick={debugEnabled ? () => setSelection({ id: b.id, worldPos: wp, size: [b.scale.x, b.scale.y, b.scale.z] }) : undefined}
                    >
                        <boxGeometry args={[b.scale.x, b.scale.y, b.scale.z]} />
                        <meshStandardMaterial color={BUILDING_COLOR} />
                    </mesh>
                );
            })}

            {/* Plaza slab */}
            <mesh position={[plaza.position.x, plaza.scale.y / 2, plaza.position.z]}>
                <boxGeometry args={[plaza.scale.x, plaza.scale.y, plaza.scale.z]} />
                <meshStandardMaterial color={PLAZA_COLOR} />
            </mesh>

            {/* Pedestrians */}
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
