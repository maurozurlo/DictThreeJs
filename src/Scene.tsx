// Scene.tsx
import { Canvas } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { MainModel, type RepRigs } from "./3d/MainModel";
import { useCameraSwitcher } from "./Hooks/useCameraSwitcher";
import { CameraController } from "./3d/CameraController";
import { useFreeCameraControls } from "./Hooks/useFreeCameraControls";
import { Representative } from "./3d/Representative";
import SecretRoom from "./3d/SecretRoom";
import StreetView from "./3d/StreetView";
import { useGameStore } from "./Stores/GameState";
import { Tabs } from "./types/Tabs";
import { Power as POWERS } from "./Constants/Power";
import type { Power } from "./types/Power";
import { useRepExecutions } from "./Hooks/useRepExecutions";

function CameraControllerFree() {
    console.log("Free camera mode enabled");
    useFreeCameraControls(0.3, 0.002, 0.3);
    return null;
}


export function Scene() {
    const tab = useGameStore((s) => s.tabs.activeTab);
    const debug = useGameStore((s) => s.debug.enabled);
    const freeCam = useGameStore((s) => s.debug.freeCam);
    const repStatuses = useGameStore((s) => s.gameManagement.representativeStatuses);
    useCameraSwitcher(debug);

    // The palace rooms; representatives eliminated here get their execution
    // (MainModel drives it) before leaving the scene.
    const roomVisible = tab === Tabs.Laws || tab === Tabs.Meet;
    const { runs, finishExecution } = useRepExecutions(repStatuses, roomVisible);
    const repRigs = useRef<RepRigs>({ people: null, business: null, military: null });
    const rigRefs = useMemo(
        () => Object.fromEntries(POWERS.map((p) => [p, (g: Group | null) => { repRigs.current[p] = g; }])) as Record<Power, (g: Group | null) => void>,
        [],
    );
    const repOnStage = (p: Power) => repStatuses[p] === 'active' || runs[p] !== undefined;

    return (
        <Canvas shadows dpr={[1, 2]} >
            <ambientLight intensity={3.4} color={"#e2d8be"} />

            <pointLight position={[-1.335, 0.642, -0.09]} intensity={.2} />
            <pointLight position={[-0.769, 0.734, -0.393]} intensity={.3} />
            {debug && freeCam ? <CameraControllerFree /> : <CameraController />}
            {roomVisible ? <MainModel executions={runs} onExecutionDone={finishExecution} repRigs={repRigs} /> : null}
            {(['business', 'people', 'military'] as const).map((p) => repOnStage(p) && (
                <Representative key={p} power={p} rigRef={rigRefs[p]} interactive={repStatuses[p] === 'active'} />
            ))}
            <SecretRoom />
            {tab === Tabs.Street ? <StreetView /> : null}
        </Canvas>
    );
}