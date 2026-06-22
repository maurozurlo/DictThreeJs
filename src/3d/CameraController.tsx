import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { useGameStore } from "../Stores/GameState";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function CameraController() {
    const ref = useRef<any>(null);
    const cameraPos = useGameStore((s) => s.scene.camera.cameraPos);
    const cameraFov = useGameStore((s) => s.scene.camera.cameraFov);
    const cameraHFov = useGameStore((s) => s.scene.camera.cameraHFov);
    const cameraRotation = useGameStore((s) => s.scene.camera.cameraRotation);
    const { size } = useThree();

    // When a horizontal FOV is provided (Street tab / Max PhysCamera), derive the
    // vertical FOV from the live canvas aspect so framing matches Max exactly.
    const effectiveFov = cameraHFov != null
        ? 2 * Math.atan(Math.tan((cameraHFov / 2) * DEG2RAD) / (size.width / size.height)) * RAD2DEG
        : cameraFov;

    useFrame(() => {
        if (!ref.current) return;
        ref.current.position.set(...cameraPos);
        ref.current.rotation.x = cameraRotation[0];
        ref.current.rotation.y = cameraRotation[1];
        if (ref.current.fov !== effectiveFov) {
            ref.current.fov = effectiveFov;
            ref.current.updateProjectionMatrix();
        }
    });

    return (
        <PerspectiveCamera
            makeDefault
            position={cameraPos}
            fov={effectiveFov}
            near={0.1}
            far={1000}
            ref={ref}
        />
    );
}