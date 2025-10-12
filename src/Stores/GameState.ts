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
        passedLaws: new Set(),
        lawDecided: false,
        actUponLaw: (hasAccepted: boolean) => {
            alert(hasAccepted)

        }
    },
    deals: {
        current: null,
        dealDecided: false,
        interactedWithDeals: new Set(),
        lastDealOutcome: null,

        actUponDeal: (hasAccepted: boolean) => {
            const state = get();
            const { current } = state.deals;
            if (!current) return;

            const resultText = hasAccepted ? current.acceptText : current.rejectText;
            const effect = hasAccepted ? current.acceptEffect : current.rejectEffect;

            // Clone the current game state (so we can safely modify)
            const newTreasury = (state.budget.treasury ?? 0) + (effect.treasury ?? 0);
            const newRelations = { ...state.relations.current };

            // Apply power effects (clamped to [-10, 10])
            for (const key of ['military', 'business', 'people'] as const) {
                if (effect[key] !== undefined) {
                    newRelations[key] = Math.max(-10, Math.min(10, newRelations[key] + effect[key]));
                }
            }

            let finalText = resultText;

            // Handle risk
            if (effect.risk && Math.random() < effect.risk) {
                finalText += " " + (current.riskText ?? '');
                if (hasAccepted && current.acceptEffect.military) {
                    newRelations.military = Math.max(-10, newRelations.military - 2);
                } else if (!hasAccepted) {
                    const powers = ['military', 'business', 'people'] as const;
                    const angryPower = powers[Math.floor(Math.random() * powers.length)];
                    newRelations[angryPower] = Math.max(-10, newRelations[angryPower] - 1);
                }
            }

            // Update Zustand store properly
            set({
                budget: {
                    ...state.budget,
                    treasury: newTreasury,
                },
                relations: {
                    ...state.relations,
                    current: newRelations
                },
                deals: {
                    ...state.deals,
                    dealDecided: true,
                    lastDealOutcome: finalText,
                    interactedWithDeals: new Set(state.deals.interactedWithDeals).add(current),
                },
            });
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
                    const randomLaw = getRandomUniqueItem(LAWS, state.law.passedLaws)
                    const updatedLaws = new Set(state.law.passedLaws)
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
    log: [],
    relations: {
        current: GAMESTATE.RELATIONS.INITIAL,
        adjustRelations: (power, amount) => {
            set((state: GameState) => {
                const {
                    relations: { current },
                } = state;

                const prevValue = current[power];
                const newValue = Clamp(prevValue + amount, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                // Check for special side effects
                if (newValue <= GAMESTATE.RELATIONS.MIN) {
                    console.warn(`Relation with ${power} reached minimum (${GAMESTATE.RELATIONS.MIN}).`);
                    // You could add side effects here:
                    // e.g., trigger game over, change phase, log event, etc.
                    // setTimeout(() => get().gameManagement.setPhase("gameover"), 0);
                }

                return {
                    ...state,
                    relations: {
                        ...state.relations,
                        current: {
                            ...current,
                            [power]: newValue,
                        },
                    },
                };
            });
        },
    }
}));
