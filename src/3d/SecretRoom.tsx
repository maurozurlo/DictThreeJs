import { Suspense } from "react";
import { useGameStore } from "../Stores/GameState";
import { GAMESTATE } from "../Constants/GameState";
import { Tabs } from "../types/Tabs";
import { Bunker } from "./Bunker";

const FACTION_COLORS: Record<string, string> = {
    military: '#8b0000',
    business: '#b8860b',
    people: '#2e7d32',
};

/**
 * Secret-ending rooms. The Bunker (military) is a real model shown while the
 * Secret tab is on its room; the Vault and Zen Garden are still a faction-coloured
 * placeholder cube.
 */
function SecretRoom() {
    const available = useGameStore(s => s.specialEnding.available);
    const faction = useGameStore(s => s.specialEnding.faction);
    const showBunker = useGameStore(s =>
        s.tabs.activeTab === Tabs.Secret && s.tabs.secretRoomIndex === GAMESTATE.FACTION_ROOM_INDEX.military);

    const color = faction ? FACTION_COLORS[faction] ?? '#444444' : null;

    return (
        <>
            {available && color ? (
                <mesh position={[1.5, 0.3, -0.2]}>
                    <boxGeometry args={[0.4, 0.4, 0.4]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
                </mesh>
            ) : null}
            {showBunker ? (
                <Suspense fallback={null}>
                    <Bunker />
                </Suspense>
            ) : null}
        </>
    );
}

export default SecretRoom;
