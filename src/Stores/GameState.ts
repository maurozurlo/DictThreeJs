// store.ts
import { create } from "zustand";
import { Vector3 } from "three";
import { Tabs } from "../types/Tabs";

type CameraState = {
    cameraPos: [number, number, number];
    cameraTarget?: Vector3;
    cameraPositions: Vector3[];
    cameraTargets: Vector3[];
    currentCameraIndex: number;
    moveCameraTo: (pos: [number, number, number], target?: Vector3) => void;
    cycleCamera: () => void;
    setCameraPositions: (positions: Vector3[], targets?: Vector3[]) => void;
};

type GameState = {
    debug: {
        enabled: boolean;
        setDebugMode: (enabled: boolean) => void;
    },
    scene: {
        camera: CameraState;
    };
    tabs: {
        shouldDisplayTabs: boolean;
        setShouldDisplayTabs: (display: boolean) => void;
        activeTab: Tabs;
        setActiveTab: (tab: Tabs) => void;
    };
    gameManagement: {
        phase: 'idle' | 'start' | 'event' | 'gameover';
        setPhase: (phase: 'idle' | 'start' | 'event' | 'gameover') => void;
        selectedPower: 'none' | 'people' | 'company' | 'military';
        setSelectedPower: (power: 'none' | 'people' | 'company' | 'military') => void;
    }
};

export const useGameStore = create<GameState>((set, get) => ({
    debug: {
        enabled: false,
        setDebugMode: (enabled: boolean) => set((state) => ({
            debug: {
                ...state.debug,
                enabled,
            }
        }))
    },
    scene: {
        camera: {
            cameraPos: [-1.336, 0.63, 0.302],
            cameraTarget: undefined,
            cameraPositions: [],
            cameraTargets: [],
            currentCameraIndex: 0,

            moveCameraTo: (pos, target) =>
                set((state) => ({
                    scene: {
                        ...state.scene,
                        camera: {
                            ...state.scene.camera,
                            cameraPos: pos,
                            cameraTarget: target,
                        },
                    },
                })),

            setCameraPositions: (positions, targets) =>
                set((state) => ({
                    scene: {
                        ...state.scene,
                        camera: {
                            ...state.scene.camera,
                            cameraPositions: positions,
                            cameraTargets: targets || positions,
                        },
                    },
                })),

            cycleCamera: () => {
                const {
                    scene: {
                        camera: { cameraPositions, cameraTargets, currentCameraIndex },
                    },
                } = get();

                if (cameraPositions.length === 0) return;

                const nextIndex = (currentCameraIndex + 1) % cameraPositions.length;

                set((state) => ({
                    scene: {
                        ...state.scene,
                        camera: {
                            ...state.scene.camera,
                            currentCameraIndex: nextIndex,
                            cameraPos: [
                                cameraPositions[nextIndex].x,
                                cameraPositions[nextIndex].y,
                                cameraPositions[nextIndex].z,
                            ],
                            cameraTarget: cameraTargets[nextIndex]?.clone(),
                        },
                    },
                }));
            },
        },
    },

    tabs: {
        activeTab: Tabs.Meet,
        shouldDisplayTabs: true,
        setShouldDisplayTabs(display) {
            set((state) => ({
                tabs: {
                    ...state.tabs,
                    shouldDisplayTabs: display,
                },
            }));
        },

        setActiveTab: (tab: Tabs) => {
            const cameraPositions = get().scene.camera.cameraPositions;
            let newCameraPos: Vector3 | undefined;

            if (tab === Tabs.Meet) {
                newCameraPos = cameraPositions[0];
            } else if (tab === Tabs.Laws) {
                newCameraPos = cameraPositions[1];
            } else if (tab === Tabs.Street) {
                newCameraPos = cameraPositions[2];
            }

            set((state) => ({
                tabs: {
                    ...state.tabs,
                    activeTab: tab,
                },
                scene: {
                    ...state.scene,
                    camera: {
                        ...state.scene.camera,
                        ...(newCameraPos && {
                            cameraPos: [newCameraPos.x, newCameraPos.y, newCameraPos.z],
                        }),
                    },
                },
                gameManagement: {
                    ...state.gameManagement,
                    selectedPower: 'none',
                }
            }));
        },
    },

    gameManagement: {
        phase: 'idle',
        setPhase: (phase) => {
            if (phase === 'start') {
                return set((state) => ({
                    tabs: {
                        ...state.tabs,
                        shouldDisplayTabs: true,
                        activeTab: Tabs.Log,
                    },
                    gameManagement: {
                        ...state.gameManagement,
                        phase,
                    }
                }))
            }

            return set((state) => ({
                gameManagement: {
                    ...state.gameManagement,
                    phase,
                }
            }))
        },
        selectedPower: 'none',
        setSelectedPower: (power) => set((state) => ({
            gameManagement: {
                ...state.gameManagement,
                selectedPower: power,
            }
        }))
    }
}));
