import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { STREET_LAYOUT } from '../assets/streetLayout';
import type { WaypointPath, PedestrianConfig, VehicleConfig } from '../types/StreetLayout';

const BUILDING_COLOR   = '#7a6e62';
const PLAZA_COLOR      = '#b8a98a';
const GROUND_COLOR     = '#5a6b4a';
const ROAD_COLOR       = '#4a4a4a';
const PEDESTRIAN_COLOR = '#4a90d9';
const VEHICLE_COLOR    = '#d94a4a';

const PED_HALF_HEIGHT = 0.09;  // half of 0.18
const CAR_HALF_HEIGHT = 0.05;  // half of 0.10

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
            // Facing direction: the ry recorded at the waypoint we departed from
            const fromIdx = (nextIdx.current - 1 + path.waypoints.length) % path.waypoints.length;
            const facingRy = path.waypoints[fromIdx].ry ?? 0;
            meshRef.current.rotation.y = facingRy;
        }
    });

    const start = path.waypoints[0];

    return (
        <>
            <mesh
                ref={meshRef}
                position={[start.x, start.y + PED_HALF_HEIGHT, start.z]}
            >
                <boxGeometry args={[0.08, 0.18, 0.08]} />
                <meshStandardMaterial color={PEDESTRIAN_COLOR} />
            </mesh>

            {debugEnabled && path.waypoints.map((wp, i) => (
                // Arrow rotated by ry: box body points in -Z, arrowhead at -Z tip.
                // A cube's "front face" in Three.js is the -Z face, same as camera forward.
                <group key={i} position={[wp.x, wp.y + 0.12, wp.z]} rotation={[0, wp.ry ?? 0, 0]}>
                    <mesh position={[0, 0, -0.15]}>
                        <boxGeometry args={[0.015, 0.015, 0.30]} />
                        <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={0.8} />
                    </mesh>
                    <mesh position={[0, 0, -0.33]} rotation={[Math.PI / 2, 0, 0]}>
                        <coneGeometry args={[0.03, 0.06, 6]} />
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
            const facingRy = path.waypoints[fromIdx].ry ?? 0;
            meshRef.current.rotation.y = facingRy;
        }
    });

    const start = path.waypoints[0];

    return (
        <>
            <mesh
                ref={meshRef}
                position={[start.x, start.y + CAR_HALF_HEIGHT, start.z]}
            >
                <boxGeometry args={[0.15, 0.10, 0.28]} />
                <meshStandardMaterial color={VEHICLE_COLOR} />
            </mesh>

            {debugEnabled && path.waypoints.map((wp, i) => (
                <group key={i} position={[wp.x, wp.y + 0.15, wp.z]} rotation={[0, wp.ry ?? 0, 0]}>
                    <mesh position={[0, 0, -0.15]}>
                        <boxGeometry args={[0.015, 0.015, 0.30]} />
                        <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={0.8} />
                    </mesh>
                    <mesh position={[0, 0, -0.33]} rotation={[Math.PI / 2, 0, 0]}>
                        <coneGeometry args={[0.03, 0.06, 6]} />
                        <meshStandardMaterial color="orange" emissive="orange" emissiveIntensity={0.8} />
                    </mesh>
                </group>
            ))}
        </>
    );
}

function StreetView() {
    const activeTab    = useGameStore((s) => s.tabs.activeTab);
    const debugEnabled = useGameStore((s) => s.debug.enabled);
    if (activeTab !== Tabs.Street) return null;

    const { buildings, plaza, pedestrians, pedestrianPaths, vehicles, vehiclePaths } = STREET_LAYOUT;

    return (
        <group position={[0, 0, 0]}>
            {/* Ground */}
            <mesh position={[0, -0.005, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.9, 0.9]} />
                <meshStandardMaterial color={GROUND_COLOR} />
            </mesh>

            {/* Road strip */}
            <mesh position={[0, -0.004, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.16, 0.80]} />
                <meshStandardMaterial color={ROAD_COLOR} />
            </mesh>

            {/* Buildings */}
            {buildings.map((b) => (
                <mesh key={b.id} position={[b.position.x, b.scale.y / 2, b.position.z]}>
                    <boxGeometry args={[b.scale.x, b.scale.y, b.scale.z]} />
                    <meshStandardMaterial color={BUILDING_COLOR} />
                </mesh>
            ))}

            {/* Plaza slab */}
            <mesh position={[plaza.position.x, plaza.scale.y / 2, plaza.position.z]}>
                <boxGeometry args={[plaza.scale.x, plaza.scale.y, plaza.scale.z]} />
                <meshStandardMaterial color={PLAZA_COLOR} />
            </mesh>

            {/* Pedestrians */}
            {pedestrians.map((ped) => {
                const path = pedestrianPaths.find((p) => p.id === ped.pathId);
                if (!path) return null;
                return (
                    <PedWalker
                        key={ped.id}
                        ped={ped}
                        path={path}
                        debugEnabled={debugEnabled}
                    />
                );
            })}

            {/* Vehicles */}
            {vehicles.map((v) => {
                const path = vehiclePaths.find((p) => p.id === v.pathId);
                if (!path) return null;
                return (
                    <CarWalker
                        key={v.id}
                        vehicle={v}
                        path={path}
                        debugEnabled={debugEnabled}
                    />
                );
            })}
        </group>
    );
}

export default StreetView;
