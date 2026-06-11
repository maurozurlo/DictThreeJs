import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { STREET_LAYOUT } from '../assets/streetLayout';

const BUILDING_COLOR  = '#7a6e62';
const PLAZA_COLOR     = '#b8a98a';
const GROUND_COLOR    = '#5a6b4a';
const ROAD_COLOR      = '#4a4a4a';
const PEDESTRIAN_COLOR = '#4a90d9';
const VEHICLE_COLOR   = '#d94a4a';

function StreetView() {
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    if (activeTab !== Tabs.Street) return null;

    const { buildings, plaza, pedestrians, vehicles, pedestrianPaths, vehiclePaths } = STREET_LAYOUT;

    return (
        // Group origin = street scene anchor point. Adjust position to align
        // with where CameraStart002 in the FBX is pointing.
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

            {/* Buildings — box centred at y = height/2 so base sits on ground */}
            {buildings.map((b) => (
                <mesh
                    key={b.id}
                    position={[b.position.x, b.scale.y / 2, b.position.z]}
                >
                    <boxGeometry args={[b.scale.x, b.scale.y, b.scale.z]} />
                    <meshStandardMaterial color={BUILDING_COLOR} />
                </mesh>
            ))}

            {/* Plaza slab */}
            <mesh position={[plaza.position.x, plaza.scale.y / 2, plaza.position.z]}>
                <boxGeometry args={[plaza.scale.x, plaza.scale.y, plaza.scale.z]} />
                <meshStandardMaterial color={PLAZA_COLOR} />
            </mesh>

            {/* Pedestrians — small upright boxes at first waypoint */}
            {pedestrians.map((ped) => {
                const path = pedestrianPaths.find((p) => p.id === ped.pathId);
                if (!path) return null;
                const wp = path.waypoints[0];
                return (
                    <mesh key={ped.id} position={[wp.x, 0.04, wp.z]}>
                        <boxGeometry args={[0.03, 0.08, 0.03]} />
                        <meshStandardMaterial color={PEDESTRIAN_COLOR} />
                    </mesh>
                );
            })}

            {/* Vehicles — wider box at first waypoint */}
            {vehicles.map((v) => {
                const path = vehiclePaths.find((p) => p.id === v.pathId);
                if (!path) return null;
                const wp = path.waypoints[0];
                return (
                    <mesh key={v.id} position={[wp.x, 0.03, wp.z]}>
                        <boxGeometry args={[0.10, 0.05, 0.07]} />
                        <meshStandardMaterial color={VEHICLE_COLOR} />
                    </mesh>
                );
            })}
        </group>
    );
}

export default StreetView;
