// store.ts
import { create } from "zustand";
import { Vector3 } from "three";

type GameState = {
    cameraPos: [number, number, number];
    cameraTarget?: Vector3;
    cameraPositions: Vector3[];
    cameraTargets: Vector3[];  // optional look-at points
    currentCameraIndex: number;
    moveCameraTo: (pos: [number, number, number], target?: Vector3) => void;
    cycleCamera: () => void;
    setCameraPositions: (positions: Vector3[], targets?: Vector3[]) => void;
};

export const useGameStore = create<GameState>((set, get) => ({
    cameraPos: [-1.336, .63, .302],
    cameraTarget: undefined,
    cameraPositions: [],
    cameraTargets: [],
    currentCameraIndex: 0,
    moveCameraTo: (pos, target) => set({ cameraPos: pos, cameraTarget: target }),
    setCameraPositions: (positions, targets) => set({ cameraPositions: positions, cameraTargets: targets || positions }),
    cycleCamera: () => {
        const { cameraPositions, cameraTargets, currentCameraIndex } = get();
        if (cameraPositions.length === 0) return;

        const nextIndex = (currentCameraIndex + 1) % cameraPositions.length;
        set({ currentCameraIndex: nextIndex });
        set({
            cameraPos: [
                cameraPositions[nextIndex].x,
                cameraPositions[nextIndex].y,
                cameraPositions[nextIndex].z,
            ],
            cameraTarget: cameraTargets[nextIndex].clone(),
        });
    },
}));
