import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useHoverGlow } from "../Hooks/useHoverGlow";
import { Group } from "three";
import { useGameStore } from "../Stores/GameState";

const TYPE = 'people';
function People() {
    const fbx = useLoader(FBXLoader, "/assets/3d/chars/people.FBX") as Group;
    const selectedPower = useGameStore((s) => s.gameManagement.selectedPower);
    const setSelectedPower = useGameStore((s) => s.gameManagement.setSelectedPower);
    const handlers = useHoverGlow(fbx, { onClick: () => setSelectedPower(TYPE), isSelected: selectedPower === TYPE });

    return (
        <primitive
            object={fbx}
            scale={1}
            position={[-1.242, 0.629, -0.15]}
            receiveShadow
            {...handlers}
        />
    );
}

export default People