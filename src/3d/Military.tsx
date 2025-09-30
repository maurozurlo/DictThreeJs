import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { Group, MathUtils } from "three";
import { useHoverGlow } from "../Hooks/useHoverGlow";
import { useGameStore } from "../Stores/GameState";

const TYPE = 'military';
function Police() {
    const fbx = useLoader(FBXLoader, "/assets/3d/chars/police.FBX") as Group;
    const selectedPower = useGameStore((s) => s.gameManagement.selectedPower);
    const setSelectedPower = useGameStore((s) => s.gameManagement.setSelectedPower);
    const handlers = useHoverGlow(fbx, { onClick: () => setSelectedPower(TYPE), isSelected: selectedPower === TYPE });

    return (
        <primitive
            object={fbx}
            scale={1.15}
            position={[-1.335, 0.642, -0.19]}
            rotation={[0, MathUtils.degToRad(10), 0]} // 120 deg in radians
            {...handlers}
        />
    );
}

export default Police;
