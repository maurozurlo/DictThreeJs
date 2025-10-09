// store.ts
import { create } from "zustand";
import { Vector3 } from "three";
import { Tabs } from "../types/Tabs";
import type { Expenditures, Taxes } from "../types/Budget";
import { BOUNDS_EXPENDITURE, BOUNDS_TAX } from "../Constants/Budget";
import type { Power } from "../types/Power";
import type { Law } from "../types/Law";

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
    };
    meet: {
        selectedPower: Power;
        setSelectedPower: (power: Power) => void;
    },
    budget: {
        expenditures: Record<Expenditures, number>;
        taxes: Record<Taxes, number>;
        // adjust by amount (positive or negative)
        adjustBudgetItem: (id: Expenditures | Taxes, amount: number) => void;
        // read helpers
        getBudgetItem: (id: Expenditures | Taxes) => number;
    },
    law: {
        current: Law | null
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
        activeTab: Tabs.Laws,
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
    law: {
        current: null
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
    },
    meet: {
        selectedPower: 'none',
        setSelectedPower: (power) => set((state) => ({
            meet: {
                ...state.meet,
                selectedPower: power,
            }
        }))
    },
    budget: {
        expenditures: {
            health: 1,
            infrastructure: 1,
            security: 1,
            education: 1,
        },
        taxes: {
            people: 20,
            business: 30
        },
        adjustBudgetItem: (id: string, amount: number) => {
            set((state: GameState) => {
                const { budget } = state;
                if (Object.keys(budget.expenditures).includes(id)) {
                    const key = id as Expenditures;
                    const current = budget.expenditures[key] || 0;
                    const min = BOUNDS_EXPENDITURE[0];
                    const max = BOUNDS_EXPENDITURE[1];
                    const newValue = Math.min(Math.max(current + amount, min), max);
                    const newEx = { ...budget.expenditures, [key]: newValue };
                    return { budget: { ...budget, expenditures: newEx } };
                }
                if (Object.keys(budget.taxes).includes(id)) {
                    const key = id as Taxes;
                    const current = budget.taxes[key] || 0;
                    const min = BOUNDS_TAX[0];
                    const max = BOUNDS_TAX[1];
                    const newValue = Math.min(Math.max(current + amount, min), max);
                    const newTaxes = { ...budget.taxes, [key]: newValue };
                    return { budget: { ...budget, taxes: newTaxes } };
                }
                console.error('Unknown id for budget', id)
                return state;
            });
        },
        getBudgetItem: (id: string) => {
            const { budget }: GameState = get();
            if (Object.keys(budget.taxes).includes(id)) {
                const key = id as Taxes;
                return budget.taxes[key]
            }
            if (Object.keys(budget.expenditures).includes(id)) {
                {
                    const key = id as Expenditures;
                    return budget.expenditures[key]
                }
            }
            console.error('Unknown id for budget', id)
            return 0;
        },
    },
}));
