// store.ts
import { create } from "zustand";
import { Vector3 } from "three";
import { Tabs } from "../types/Tabs";
import type { Expenditures, Taxes } from "../types/Budget";
import { GAMESTATE } from "../Constants/GameState";
import { Clamp, getRandomFromList, getRandomUniqueItem } from "../Utils/Math";
import { DEALS } from "../assets/deals";
import type { GameState } from "../types/GameState";
import { LAWS } from "../assets/laws";
import { handleDecision, handleRelations, applyBudgetEffects } from "./EffectHandler";
import { handleActionOutcome } from "./ActionHandler";
import { handleBudgetChange, calculateRoundFinancials } from "./BudgetHandler";
import { PERIODIC_EVENTS } from "../assets/periodicEvents";
import { MINI_CHALLENGES } from "../assets/miniChallenges";
import type { Power } from "../types/Power";
import { getRandomDailyEvent } from "./DailyEventHandler";
import { getRandomUniqueItemForPower } from "../Utils/Laws";
import { Power as PowerList } from "../Constants/Power";

/** Helper: check all day-end conditions and return whether the day is finished */
function isDayComplete(state: GameState): boolean {
    const lawDone = state.law.lawDecided;
    const dealDone = state.deals.dealDecided;
    const meetDone = state.meet.actionTaken.taken;
    const periodicDone = state.periodicEvent.current === null || state.periodicEvent.decided;
    const challengeDone = state.miniChallenge.current === null || state.miniChallenge.decided;
    return lawDone && dealDone && meetDone && periodicDone && challengeDone;
}

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
        tabsLocked: false,
        setActiveTab: (tab: Tabs) => {
            // Don't allow tab switching when tabs are locked
            if (get().tabs.tabsLocked) return;

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
                meet: {
                    ...state.meet,
                    selectedPower: 'none',
                }
            }));
        },
    },
    law: {
        current: getRandomFromList(LAWS),
        interactedWithLaws: new Set(),
        lawDecided: false,
        lastLawOutcome: null,
        actUponLaw: (hasAccepted: boolean) => {
            const state = get();
            const current = state.law.current;
            if (!current) return;
            handleDecision({ type: "law", item: current, hasAccepted, get, set });
            // After this decision, check if all day actions are complete
            setTimeout(() => {
                const s = get();
                if (isDayComplete(s)) {
                    set((st) => ({ gameManagement: { ...st.gameManagement, dayEnded: true } }));
                }
            }, 0);
        },
    },
    deals: {
        current: getRandomFromList(DEALS),
        dealDecided: false,
        interactedWithDeals: new Set(),
        lastDealOutcome: null,

        actUponDeal: (hasAccepted: boolean) => {
            const state = get();
            const current = state.deals.current;
            if (!current) return;
            handleDecision({ type: "deal", item: current, hasAccepted, get, set });
            setTimeout(() => {
                const s = get();
                if (isDayComplete(s)) {
                    set((st) => ({ gameManagement: { ...st.gameManagement, dayEnded: true } }));
                }
            }, 0);
        },
    },
    periodicEvent: {
        current: null,
        decided: false,
        resultText: null,
        resolve: (optionIndex: number) => {
            const state = get();
            const event = state.periodicEvent.current;
            if (!event || state.periodicEvent.decided) return;

            const option = event.options[optionIndex];
            const effect = option.effect;

            // Apply treasury change
            const newTreasury = state.budget.treasury + (effect.treasury ?? 0);

            // Apply relation changes
            const newRelations = { ...state.relations.current };
            (Object.keys(newRelations) as Power[]).forEach((power) => {
                const delta = effect[power];
                if (typeof delta === 'number') {
                    newRelations[power] = Clamp(
                        newRelations[power] + delta,
                        GAMESTATE.RELATIONS.MIN,
                        GAMESTATE.RELATIONS.MAX
                    );
                }
            });

            set((s) => ({
                periodicEvent: {
                    ...s.periodicEvent,
                    decided: true,
                    resultText: option.result,
                },
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                tabs: { ...s.tabs, tabsLocked: false },
            }));

            setTimeout(() => {
                const s = get();
                if (isDayComplete(s)) {
                    set((st) => ({ gameManagement: { ...st.gameManagement, dayEnded: true } }));
                }
            }, 0);
        },
    },
    miniChallenge: {
        current: null,
        decided: false,
        resultText: null,
        resolve: (accepted: boolean) => {
            const state = get();
            const challenge = state.miniChallenge.current;
            if (!challenge || state.miniChallenge.decided) return;

            const effect = accepted ? challenge.acceptEffect : challenge.rejectEffect;
            let resultText = accepted ? challenge.acceptText : challenge.rejectText;

            // Apply treasury change
            let newTreasury = state.budget.treasury + (effect.treasury ?? 0);

            // Apply relation changes
            const newRelations = { ...state.relations.current };
            (Object.keys(newRelations) as Power[]).forEach((power) => {
                const delta = effect[power];
                if (typeof delta === 'number') {
                    newRelations[power] = Clamp(
                        newRelations[power] + delta,
                        GAMESTATE.RELATIONS.MIN,
                        GAMESTATE.RELATIONS.MAX
                    );
                }
            });

            // Handle risk
            if (effect.risk && Math.random() < effect.risk) {
                resultText += " " + (challenge.riskText ?? "");
                // Risk penalty: random power loses 2 on rejection
                if (!accepted) {
                    const powers: Power[] = ['military', 'business', 'people'];
                    const angryPower = powers[Math.floor(Math.random() * powers.length)];
                    newRelations[angryPower] = Clamp(
                        newRelations[angryPower] - 2,
                        GAMESTATE.RELATIONS.MIN,
                        GAMESTATE.RELATIONS.MAX
                    );
                }
            }

            set((s) => ({
                miniChallenge: {
                    ...s.miniChallenge,
                    decided: true,
                    resultText,
                },
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                tabs: { ...s.tabs, tabsLocked: false },
            }));

            setTimeout(() => {
                const s = get();
                if (isDayComplete(s)) {
                    set((st) => ({ gameManagement: { ...st.gameManagement, dayEnded: true } }));
                }
            }, 0);
        },
    },
    gameManagement: {
        round: GAMESTATE.ROUNDS.START,
        phase: 'idle',
        endReason: null,
        dayEnded: false,
        lastRoundIncome: 0,
        lastRoundExpenses: 0,
        timerStartedAt: null,
        setPhase: (phase) => {
            if (phase === 'start') {
                return set((state) => {
                    const freshLaws = new Set<typeof LAWS[number]>();
                    const freshDeals = new Set<typeof DEALS[number]>();
                    const randomLaw = getRandomUniqueItem(LAWS, freshLaws);
                    const randomDeal = getRandomUniqueItem(DEALS, freshDeals);
                    if (randomLaw) freshLaws.add(randomLaw);
                    if (randomDeal) freshDeals.add(randomDeal);

                    return {
                        tabs: {
                            ...state.tabs,
                            activeTab: Tabs.Log,
                            tabsLocked: false,
                        },
                        gameManagement: {
                            ...state.gameManagement,
                            phase,
                            round: GAMESTATE.ROUNDS.START,
                            dayEnded: false,
                            endReason: null,
                            timerStartedAt: Date.now(),
                            charisma: { ...state.gameManagement.charisma, current: GAMESTATE.CHARISMA.INITIAL },
                        },
                        relations: {
                            ...state.relations,
                            current: { ...GAMESTATE.RELATIONS.INITIAL },
                        },
                        budget: {
                            ...state.budget,
                            treasury: GAMESTATE.BUDGET.TREASURY,
                            expenditures: { ...GAMESTATE.BUDGET.EXPENDITURES },
                            taxes: { ...GAMESTATE.BUDGET.TAXES },
                        },
                        log: [],
                        dailyEvent: { current: getRandomDailyEvent() },
                        meet: {
                            ...state.meet,
                            actionTaken: { type: undefined, taken: false, power: undefined },
                            actionOutcomeText: null,
                            selectedPower: 'none',
                        },
                        periodicEvent: { ...state.periodicEvent, current: null, decided: false, resultText: null },
                        miniChallenge: { ...state.miniChallenge, current: null, decided: false, resultText: null },
                        deals: {
                            ...state.deals,
                            current: randomDeal,
                            dealDecided: false,
                            interactedWithDeals: freshDeals,
                            lastDealOutcome: null,
                        },
                        law: {
                            ...state.law,
                            current: randomLaw,
                            lawDecided: false,
                            interactedWithLaws: freshLaws,
                            lastLawOutcome: null,
                        },
                    };
                });
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
        },
        expireTimer: () => {
            const state = get();
            // Only penalise if the player didn't take a Meet action this round
            if (!state.meet.actionTaken.taken) {
                const round = state.gameManagement.round;
                const newRelations = { ...state.relations.current };
                PowerList.forEach((p) => {
                    newRelations[p] = Clamp(newRelations[p] - round, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                });
                const newCharisma = Clamp(
                    state.gameManagement.charisma.current - 1,
                    GAMESTATE.CHARISMA.MIN,
                    GAMESTATE.CHARISMA.MAX
                );
                set((s) => ({
                    relations: { ...s.relations, current: newRelations },
                    gameManagement: {
                        ...s.gameManagement,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    },
                }));
            }
            get().gameManagement.nextRound();
        },
        nextRound: () => {
            const state = get();

            // --- 1. Financial resolution ---
            const financials = calculateRoundFinancials(state.budget);
            let newTreasury = state.budget.treasury + financials.netChange;

            // --- 2. Budget → relation effects ---
            const { newRelations, logMessages } = applyBudgetEffects(state.budget, state.relations.current);

            // --- 3. Tax penalty + charisma corrosion (Plan G) ---
            const taxMessages: string[] = [];
            let newCharisma = state.gameManagement.charisma.current;
            if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
                newRelations.people = Clamp(newRelations.people - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                taxMessages.push("High people taxes causing unrest! People relation -1");
            }
            if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
                newRelations.business = Clamp(newRelations.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                taxMessages.push("High business taxes angering elites! Business relation -1");
            }

            // --- 4. Daily event effect (Plan D) ---
            const currentEvent = state.dailyEvent?.current ?? null;
            const eventMessages: string[] = [];
            if (currentEvent) {
                newRelations[currentEvent.power] = Clamp(
                    newRelations[currentEvent.power] + currentEvent.mod,
                    GAMESTATE.RELATIONS.MIN,
                    GAMESTATE.RELATIONS.MAX
                );
                eventMessages.push(currentEvent.headline);
            }

            // --- 5. Build log entries ---
            const roundSummary = `Day ${state.gameManagement.round} — Collected $${financials.totalIncome}M, Paid $${financials.expenses}M`;
            const allMessages = [roundSummary, ...logMessages, ...taxMessages, ...eventMessages];
            const newLog = [...state.log, allMessages];

            // --- 6. Increment round, draw next daily event ---
            const newRound = state.gameManagement.round + 1;
            const nextDailyEvent = getRandomDailyEvent();

            // --- 7. Biased law selection (Plan G) ---
            const pickNextLaw = (usedLaws: Set<typeof LAWS[number]>) => {
                if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
                    return getRandomUniqueItemForPower(LAWS, usedLaws, 'people') ?? getRandomUniqueItem(LAWS, usedLaws);
                }
                if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
                    return getRandomUniqueItemForPower(LAWS, usedLaws, 'business') ?? getRandomUniqueItem(LAWS, usedLaws);
                }
                return getRandomUniqueItem(LAWS, usedLaws);
            };

            // --- 8. Check game-over / victory ---
            const bankruptcy = newTreasury <= 0;
            const overthrown = (Object.keys(newRelations) as Power[]).find(p => newRelations[p] <= GAMESTATE.RELATIONS.MIN);

            if (bankruptcy) {
                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: "Economic collapse! Your treasury has run out of funds.",
                        phase: 'lose',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    }
                }));
                return;
            }

            if (overthrown) {
                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: `The ${overthrown} has overthrown your government! Relations dropped to -10.`,
                        phase: 'lose',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    }
                }));
                return;
            }

            if (newRound > GAMESTATE.ROUNDS.MAX) {
                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: null,
                        phase: 'victory',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    }
                }));
                return;
            }

            // --- 9. Check for periodic event ---
            const periodicEvent = PERIODIC_EVENTS.find(e => e.round === newRound) ?? null;
            if (periodicEvent) {
                const randomDeal = getRandomUniqueItem(DEALS, state.deals.interactedWithDeals);
                const updatedDeals = new Set(state.deals.interactedWithDeals);
                if (randomDeal) updatedDeals.add(randomDeal);
                const updatedLaws = new Set(state.law.interactedWithLaws);
                const randomLaw = pickNextLaw(updatedLaws);
                if (randomLaw) updatedLaws.add(randomLaw);

                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    dailyEvent: { current: nextDailyEvent },
                    periodicEvent: { ...s.periodicEvent, current: periodicEvent, decided: false, resultText: null },
                    miniChallenge: { ...s.miniChallenge, current: null, decided: false, resultText: null },
                    meet: { ...s.meet, actionTaken: { type: undefined, taken: false, power: undefined }, actionOutcomeText: null },
                    law: { ...s.law, current: randomLaw, lawDecided: false, interactedWithLaws: updatedLaws },
                    deals: { ...s.deals, current: randomDeal, dealDecided: false, interactedWithDeals: updatedDeals },
                    tabs: { ...s.tabs, activeTab: Tabs.Log, tabsLocked: true },
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        round: newRound,
                        timerStartedAt: Date.now(),
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    }
                }));
                return;
            }

            // --- 10. 40% chance for mini-challenge ---
            const hasMiniChallenge = Math.random() < 0.4;
            const miniChallengeToShow = hasMiniChallenge
                ? MINI_CHALLENGES[Math.floor(Math.random() * MINI_CHALLENGES.length)]
                : null;

            const randomDeal = getRandomUniqueItem(DEALS, state.deals.interactedWithDeals);
            const updatedDeals = new Set(state.deals.interactedWithDeals);
            if (randomDeal) updatedDeals.add(randomDeal);
            const updatedLaws = new Set(state.law.interactedWithLaws);
            const randomLaw = pickNextLaw(updatedLaws);
            if (randomLaw) updatedLaws.add(randomLaw);

            set((s) => ({
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                log: newLog,
                dailyEvent: { current: nextDailyEvent },
                periodicEvent: { ...s.periodicEvent, current: null, decided: false, resultText: null },
                miniChallenge: { ...s.miniChallenge, current: miniChallengeToShow, decided: false, resultText: null },
                meet: { ...s.meet, actionTaken: { type: undefined, taken: false, power: undefined }, actionOutcomeText: null },
                law: { ...s.law, current: randomLaw, lawDecided: false, interactedWithLaws: updatedLaws },
                deals: { ...s.deals, current: randomDeal, dealDecided: false, interactedWithDeals: updatedDeals },
                tabs: { ...s.tabs, activeTab: Tabs.Log, tabsLocked: hasMiniChallenge },
                gameManagement: {
                    ...s.gameManagement,
                    dayEnded: false,
                    round: newRound,
                    timerStartedAt: Date.now(),
                    lastRoundIncome: financials.totalIncome,
                    lastRoundExpenses: financials.expenses,
                    charisma: { ...s.gameManagement.charisma, current: newCharisma },
                }
            }));
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
        actionOutcomeText: null,
        actionTaken: { type: undefined, taken: false, power: undefined },
        takeAction: (power, action) => set((state) => {
            const { actionTaken, newRelations, resultText, treasuryUpdate, charismaDelta } = handleActionOutcome(power, action, state);
            const newCharisma = Clamp(
                state.gameManagement.charisma.current + charismaDelta,
                GAMESTATE.CHARISMA.MIN,
                GAMESTATE.CHARISMA.MAX
            );
            const nextState = {
                ...state,
                meet: {
                    ...state.meet,
                    actionTaken: { type: action, taken: actionTaken, power },
                    actionOutcomeText: resultText,
                },
                budget: {
                    ...state.budget,
                    treasury: state.budget.treasury + treasuryUpdate,
                },
                relations: {
                    ...state.relations,
                    current: newRelations,
                },
                gameManagement: {
                    ...state.gameManagement,
                    charisma: { ...state.gameManagement.charisma, current: newCharisma },
                },
            };
            // Check if day is complete after action
            if (isDayComplete(nextState as GameState)) {
                return {
                    ...nextState,
                    gameManagement: { ...nextState.gameManagement, dayEnded: true }
                };
            }
            return nextState;
        })
    },
    budget: {
        treasury: GAMESTATE.BUDGET.TREASURY,
        expenditures: GAMESTATE.BUDGET.EXPENDITURES,
        taxes: GAMESTATE.BUDGET.TAXES,
        adjustBudgetItem: (id: Expenditures | Taxes, amount: number) => {
            set((state: GameState) => {
                const { budget } = state;
                const { taxes, expenditures } = handleBudgetChange({ budget, id, amount });

                return {
                    ...state,
                    budget: {
                        ...state.budget,
                        taxes,
                        expenditures
                    }
                }
            })
        },
    },
    log: [],
    dailyEvent: {
        current: null,
    },
    relations: {
        current: GAMESTATE.RELATIONS.INITIAL,
        adjustRelations: (power, amount) => {
            set((state) => {
                const newValue = handleRelations({
                    power,
                    amount,
                    current: state.relations.current[power],
                });
                return {
                    relations: {
                        ...state.relations,
                        current: { ...state.relations.current, [power]: newValue },
                    },
                }
            })
        }
    }
})

export const useGameStore = create<GameState>((set, get) => INITIAL_STATE({ set, get }));
