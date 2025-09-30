import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { Group } from "three";
import { useHoverGlow } from "../Hooks/useHoverGlow";
import { useGameStore } from "../Stores/GameState";

const TYPE = 'company';
function Elite() {
    const fbx = useLoader(FBXLoader, "/assets/3d/chars/elite.FBX") as Group;
    const selectedPower = useGameStore((s) => s.gameManagement.selectedPower);
    const setSelectedPower = useGameStore((s) => s.gameManagement.setSelectedPower);
    const handlers = useHoverGlow(fbx, { onClick: () => setSelectedPower(TYPE), isSelected: selectedPower === TYPE });

    return (
        <primitive
            object={fbx}
            scale={1.15}
            position={[-1.435, 0.60, -0.19]}
            receiveShadow
            {...handlers}
        />
    );
}

export default Elite;
