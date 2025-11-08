// store.ts
import { create } from "zustand";
import { Vector3 } from "three";
import { Tabs } from "../types/Tabs";
import type { Expenditures, Taxes } from "../types/Budget";
import { GAMESTATE } from "../Constants/GameState";
import { Clamp, getRandomUniqueItem } from "../Utils/Math";
import { DEALS } from "../assets/deals";
import type { GameState } from "../types/GameState";
import { LAWS } from "../assets/laws";
import { handleDecision } from "./EffectHandler";

export const INITIAL_STATE = ({ set, get }: {
    set: {
        (partial: GameState | Partial<GameState> | ((state: GameState) => GameState | Partial<GameState>), replace?: false): void;
        (state: GameState | ((state: GameState) => GameState), replace: true): void;
    };
    get: () => GameState
}): GameState => ({
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
        activeTab: GAMESTATE.TABS.START_TAB,
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
        current: null,
        interactedWithLaws: new Set(),
        lawDecided: false,
        lastLawOutcome: null,
        actUponLaw: (hasAccepted: boolean) => {
            const state = get();
            const current = state.law.current;
            if (!current) return;
            handleDecision({ type: "law", item: current, hasAccepted, get, set });
        },
    },
    deals: {
        current: null,
        dealDecided: false,
        interactedWithDeals: new Set(),
        lastDealOutcome: null,

        actUponDeal: (hasAccepted: boolean) => {
            const state = get();
            const current = state.deals.current;
            if (!current) return;
            handleDecision({ type: "deal", item: current, hasAccepted, get, set });
        },
    },
    gameManagement: {
        round: GAMESTATE.ROUNDS.START,
        phase: 'idle',
        setPhase: (phase) => {
            if (phase === 'start') {

                return set((state) => {
                    // DEAL
                    const randomDeal = getRandomUniqueItem(DEALS, state.deals.interactedWithDeals)
                    const updatedDeals = new Set(state.deals.interactedWithDeals);
                    if (randomDeal) updatedDeals.add(randomDeal);
                    // LAW
                    const randomLaw = getRandomUniqueItem(LAWS, state.law.interactedWithLaws)
                    const updatedLaws = new Set(state.law.interactedWithLaws)
                    if (randomLaw) updatedLaws.add(randomLaw)

                    return {
                        tabs: {
                            ...state.tabs,
                            shouldDisplayTabs: true,
                            activeTab: Tabs.Log,
                        },
                        gameManagement: {
                            ...state.gameManagement,
                            phase,
                            round: GAMESTATE.ROUNDS.START
                        },
                        deals: {
                            ...state.deals,
                            current: randomDeal,
                            interactedWithDeals: updatedDeals,
                        },
                        law: {
                            ...state.law,
                            current: randomLaw,
                            passedLaws: updatedLaws
                        }
                    }
                }
                )
            }

            return set((state) => ({
                gameManagement: {
                    ...state.gameManagement,
                    phase,
                }
            }))
        },
        charisma: {
            current: GAMESTATE.CHARISMA.INITIAL,
            adjustCharisma: (amount) => {
                set((s) => {
                    const prevValue = s.gameManagement.charisma.current
                    const newValue = Clamp(prevValue + amount, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                    return {
                        ...s,
                        gameManagement: {
                            ...s.gameManagement,
                            charisma: {
                                ...s.gameManagement.charisma,
                                current: newValue
                            }
                        }
                    }
                })
            }
        }
    },
    meet: {
        selectedPower: 'none',
        setSelectedPower: (power) => set((state) => ({
            meet: {
                ...state.meet,
                selectedPower: power,
            }
        })),
        actionTaken: false
    },
    budget: {
        treasury: GAMESTATE.BUDGET.TREASURY,
        expenditures: GAMESTATE.BUDGET.EXPENDITURES,
        taxes: GAMESTATE.BUDGET.TAXES,
        adjustBudgetItem: (id: string, amount: number) => {
            set((state: GameState) => {
                const { budget } = state;

                if (Object.keys(budget.expenditures).includes(id)) {
                    const key = id as Expenditures;
                    const current = budget.expenditures[key] || 0;
                    const newValue = Clamp(current + amount, GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MIN, GAMESTATE.BUDGET.BOUNDS.EXPENDITURE.MAX);
                    return {
                        budget: {
                            ...budget,
                            expenditures: { ...budget.expenditures, [key]: newValue },
                        },
                    };
                }

                if (Object.keys(budget.taxes).includes(id)) {
                    const key = id as Taxes;
                    const current = budget.taxes[key] || 0;
                    const newValue = Clamp(current + amount, GAMESTATE.BUDGET.BOUNDS.TAX.MIN, GAMESTATE.BUDGET.BOUNDS.TAX.MAX);
                    return {
                        budget: {
                            ...budget,
                            taxes: { ...budget.taxes, [key]: newValue },
                        },
                    };
                }

                console.error('Unknown id for budget', id);
                return state;
            });
        },
    },
    log: [],
    relations: {
        current: GAMESTATE.RELATIONS.INITIAL,
        adjustRelations: (power, amount) => {

        },
    }
})

export const useGameStore = create<GameState>((set, get) => INITIAL_STATE({ set, get }));
