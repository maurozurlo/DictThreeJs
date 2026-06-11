import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { useGameStore } from "../Stores/GameState";

export function CameraController() {
    const ref = useRef<any>(null);
    const cameraPos = useGameStore((s) => s.scene.camera.cameraPos);
    const cameraFov = useGameStore((s) => s.scene.camera.cameraFov);
    const cameraRotation = useGameStore((s) => s.scene.camera.cameraRotation);

    useFrame(() => {
        if (!ref.current) return;
        ref.current.position.set(...cameraPos);
        ref.current.rotation.x = cameraRotation[0];
        ref.current.rotation.y = cameraRotation[1];
        if (ref.current.fov !== cameraFov) {
            ref.current.fov = cameraFov;
            ref.current.updateProjectionMatrix();
        }
    });

    return (
        <PerspectiveCamera
            makeDefault
            position={cameraPos}
            fov={cameraFov}
            near={0.1}
            far={1000}
            ref={ref}
        />
    );
}