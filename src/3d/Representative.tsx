import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { MathUtils, type Group } from "three";
import type { Ref } from "react";
import { useHoverGlow } from "../Hooks/useHoverGlow";
import { useGameStore } from "../Stores/GameState";
import { REP_MODELS } from "../Constants/Office";
import type { Power } from "../types/Power";

interface RepresentativeProps {
    power: Power;
    /** Outer group at the figurine's centre; the execution director moves/spins it. */
    rigRef?: Ref<Group>;
    /** False while being executed: no hover/click, no selection glow. */
    interactive?: boolean;
}

/** A faction representative figurine in the Meet room; click to select it. */
export function Representative({ power, rigRef, interactive = true }: RepresentativeProps) {
    const config = REP_MODELS[power];
    const fbx = useLoader(FBXLoader, config.url) as Group;
    const selectedPower = useGameStore((s) => s.meet.selectedPower);
    const setSelectedPower = useGameStore((s) => s.meet.setSelectedPower);
    const handlers = useHoverGlow(fbx, {
        onClick: () => setSelectedPower(power),
        isSelected: interactive && selectedPower === power,
    });

    return (
        <group ref={rigRef} position={config.position}>
            <primitive
                object={fbx}
                scale={config.scale}
                rotation={[0, MathUtils.degToRad(config.rotationY), 0]}
                receiveShadow
                onPointerOver={interactive ? handlers.onPointerOver : undefined}
                onPointerOut={interactive ? handlers.onPointerOut : undefined}
                onClick={interactive ? handlers.onClick : undefined}
            />
        </group>
    );
}
