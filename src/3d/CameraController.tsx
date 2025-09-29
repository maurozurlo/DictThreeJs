import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { PerspectiveCamera } from "@react-three/drei";
import { useGameStore } from "../Stores/GameState";

export function CameraController() {
    const ref = useRef<any>(null);
    const { scene: { camera: { cameraPos } } } = useGameStore();

    const currentPos = useRef(new Vector3(...cameraPos));

    useFrame(() => {
        if (!ref.current) return;

        currentPos.current.lerp(new Vector3(...cameraPos), 0.1);
        ref.current.position.copy(currentPos.current);
    });


    return (
        <PerspectiveCamera
            makeDefault
            position={cameraPos}
            fov={38}
            near={0.1}
            far={1000}
            ref={ref}
        />
    );
}