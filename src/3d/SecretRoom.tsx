import { useGameStore } from "../Stores/GameState";

const FACTION_COLORS: Record<string, string> = {
    military: '#8b0000',
    business: '#b8860b',
    people: '#2e7d32',
};

function SecretRoom() {
    const available = useGameStore(s => s.specialEnding.available);
    const faction = useGameStore(s => s.specialEnding.faction);

    if (!available || !faction) return null;

    const color = FACTION_COLORS[faction] ?? '#444444';

    return (
        <mesh position={[1.5, 0.3, -0.2]}>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
    );
}

export default SecretRoom;
