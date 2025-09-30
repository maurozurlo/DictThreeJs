// Scene.tsx
import { Canvas } from "@react-three/fiber";
import { MainModel } from "./3d/MainModel";
import { useCameraSwitcher } from "./Hooks/useCameraSwitcher";
import { CameraController } from "./3d/CameraController";
import { useFreeCameraControls } from "./Hooks/useFreeCameraControls";
import People from "./3d/People";
import Elite from "./3d/Elite";
import Military from "./3d/Military";

function CameraControllerFree() {
    useFreeCameraControls(4); // speed = 4
    return null;
}


export function Scene() {
    //    useCameraSwitcher(); // listen for spacebar


    return (
        <Canvas shadows dpr={[1, 2]} >
            <ambientLight intensity={5} color={"#e2d8be"} />

            <directionalLight
                castShadow
                position={[5, 10, 5]}
                intensity={1}
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-camera-near={0.5}
                shadow-camera-far={50}
            />
            <pointLight position={[-1.34, 0.734, -0.393]} intensity={.3} />
            <pointLight position={[-0.769, 0.734, -0.393]} intensity={.3} />
            <CameraController />
            {/*<CameraControllerFree />*/}
            <MainModel />
            <Elite />
            <People />
            <Military />
        </Canvas>
    );
}