import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { useGameStore } from "../Stores/GameState";

export function CameraController() {
    const ref = useRef<any>(null);
    const cameraPos = useGameStore((s) => s.scene.camera.cameraPos);

    useFrame(() => {
        if (!ref.current) return;
        ref.current.position.set(...cameraPos);
    });

    return (
        <PerspectiveCamera
            makeDefault
            position={cameraPos}
            fov={34}
            near={0.1}
            far={1000}
            ref={ref}
        />
    );
}