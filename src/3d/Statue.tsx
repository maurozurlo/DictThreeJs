import { useGameStore } from "../Stores/GameState";
import { countModifiersByType } from "../Utils/Modifiers";

const POSITIONS: [number, number, number][] = [
    [0.969, 0.079, -1.643],
    [1.219, 0.079, -1.644],
    [1.523, 0.079, -1.634],
];

const STATUE_HALF_HEIGHT = 0.175; // half of box height 0.35

function Statue() {
    const statueCount  = useGameStore(s => countModifiersByType(s.gameManagement.modifiers, 'statue'));
    const debugEnabled = useGameStore(s => s.debug.enabled);
    const visibleCount = debugEnabled ? POSITIONS.length : statueCount;
    if (visibleCount === 0) return null;

    return (
        <>
            {POSITIONS.slice(0, visibleCount).map((pos, i) => (
                <mesh key={i} position={[pos[0], pos[1] + STATUE_HALF_HEIGHT, pos[2]]}>
                    <boxGeometry args={[0.05, 0.35, 0.05]} />
                    <meshStandardMaterial color="#d4af37" emissive="#d4af37" emissiveIntensity={0.25} />
                </mesh>
            ))}
        </>
    );
}

export default Statue;
