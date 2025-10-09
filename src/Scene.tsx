// Scene.tsx
import { Canvas } from "@react-three/fiber";
import { MainModel } from "./3d/MainModel";
import { useCameraSwitcher } from "./Hooks/useCameraSwitcher";
import { CameraController } from "./3d/CameraController";
import { useFreeCameraControls } from "./Hooks/useFreeCameraControls";
import People from "./3d/People";
import Elite from "./3d/Elite";
import Military from "./3d/Military";
import { useGameStore } from "./Stores/GameState";

function CameraControllerFree() {
    console.log("Free camera mode enabled");
    useFreeCameraControls(4); // speed = 4
    return null;
}


export function Scene() {
    const debug = useGameStore((s) => s.debug.enabled);
    useCameraSwitcher(debug);

    return (
        <Canvas shadows dpr={[1, 2]} >
            <ambientLight intensity={3.4} color={"#e2d8be"} />

            <pointLight position={[-1.335, 0.642, -0.09]} intensity={.2} />
            <pointLight position={[-0.769, 0.734, -0.393]} intensity={.3} />
            {debug ? <CameraControllerFree /> : <CameraController />}
            <MainModel />
            <Elite />
            <People />
            <Military />
        </Canvas>
    );
}