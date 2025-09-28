// store.ts
import { create } from "zustand";
//import { Vector3 } from "three";

type GameState = {
    cameraPos: [number, number, number];
    move: (dx: number, dy: number, dz: number) => void;
};

export const useGameStore = create<GameState>((set) => ({
    cameraPos: [0, 2, 5],
    move: (dx, dy, dz) =>
        set((state) => ({
            cameraPos: [
                state.cameraPos[0] + dx,
                state.cameraPos[1] + dy,
                state.cameraPos[2] + dz,
            ],
        })),
}));