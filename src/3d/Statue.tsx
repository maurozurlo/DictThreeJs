import { useGameStore } from "../Stores/GameState";

const POSITIONS: [number, number, number][] = [
    [0.15, 0.2, 0.7],
    [0.30, 0.2, 0.7],
    [0.45, 0.2, 0.7],
];

function Statue() {
    const statueCount = useGameStore(s => s.shop.statueCount);
    if (statueCount === 0) return null;

    return (
        <>
            {POSITIONS.slice(0, statueCount).map((pos, i) => (
                <mesh key={i} position={pos}>
                    <boxGeometry args={[0.05, 0.35, 0.05]} />
                    <meshStandardMaterial color="#d4af37" emissive="#d4af37" emissiveIntensity={0.25} />
                </mesh>
            ))}
        </>
    );
}

export default Statue;
