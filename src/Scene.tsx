// Scene.tsx
import { Canvas } from "@react-three/fiber";
import { useGameStore } from "./Stores/GameState";
import { useKeyboardControls } from "./Hooks/useKeyboardControls";

import { PerspectiveCamera } from "@react-three/drei";

function CameraController() {
    const cameraPos = useGameStore((s) => s.cameraPos);
    return (
        <PerspectiveCamera
            makeDefault
            position={cameraPos}
            fov={75}
            near={0.1}
            far={1000}
        />
    );
}

function Box() {
    return (
        <mesh position={[0, 0.5, 0]}>
            <boxGeometry />
            <meshStandardMaterial color="hotpink" />
        </mesh>
    );
}

function Ground() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="lightblue" />
        </mesh>
    );
}

export function Scene() {
    useKeyboardControls();

    return (
        <Canvas>
            <ambientLight />
            <pointLight position={[10, 10, 10]} />
            <CameraController />
            <Box />
            <Ground />
        </Canvas>
    );
}
