// store.ts
import { create } from "zustand";
import { Vector3 } from "three";
import { Tabs } from "../types/Tabs";
import type { Expenditures, Taxes } from "../types/Budget";
import { GAMESTATE, DIFFICULTY_TREASURY } from "../Constants/GameState";
import type { Difficulty } from "../Constants/GameState";
import { Clamp, getRandomFromList, getRandomUniqueItem, rollChance, rollFloat } from "../Utils/Math";
import { DEALS } from "../assets/deals";
import type { EndCause, GameState, GameStats, ShopItemId } from "../types/GameState";
import { LAWS } from "../assets/laws";
import { WEIRD_LAWS } from "../assets/weirdLaws";
import { handleDecision, handleRelations, applyBudgetEffects } from "./EffectHandler";
import { handleActionOutcome } from "./ActionHandler";
import { handleBudgetChange, calculateRoundFinancials } from "./BudgetHandler";
import { PERIODIC_EVENTS } from "../assets/periodicEvents";
import { MINI_CHALLENGES } from "../assets/miniChallenges";
import i18n from '../i18n';
import type { Power, MeetActionType } from "../types/Power";
import { getRandomDailyEvent } from "./DailyEventHandler";
import { getRandomUniqueItemForPower } from "../Utils/Laws";
import { Power as PowerList } from "../Constants/Power";
import { getGameDate } from "../Utils/GameDate";
import { filterLawPool, getRepealTier } from "./RecurringHandler";
import { checkCoup } from "./CoupHandler";
import { educationToDumbScore } from "../Utils/String";
import { exportSave } from "../Utils/SaveLoad";
import { SECRET_ROOMS } from "../assets/secretRooms";


export const INITIAL_STATE = ({ set, get }: {
    set: {
        (partial: GameState | Partial<GameState> | ((state: GameState) => GameState | Partial<GameState>), replace?: false): void;
        (state: GameState | ((state: GameState) => GameState), replace: true): void;
    };
    get: () => GameState
}): GameState => ({
    debug: {
        enabled: false,
        fov: 34,
        selectorOpen: false,
        setDebugMode: (enabled: boolean) => set((state) => ({
            debug: { ...state.debug, enabled },
        })),
        setFov: (fov: number) => set((state) => ({
            debug: { ...state.debug, fov },
        })),
        toggleSelector: () => set((state) => ({
            debug: { ...state.debug, selectorOpen: !state.debug.selectorOpen },
        })),
    },
    scene: {
        camera: {
            cameraPos: [-1.336, 0.63, 0.302],
            cameraFov: 34,
            cameraRotation: [0, 0] as [number, number],
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
        secretRoomIndex: 0,
        setActiveTab: (tab: Tabs) => {
            // Menu, Secret and Shop tabs bypass lock; all others respect it
            if (get().tabs.tabsLocked && tab !== Tabs.Secret && tab !== Tabs.Shop && tab !== Tabs.Menu) return;

            const cameraPositions = get().scene.camera.cameraPositions;
            let newCameraPos: Vector3 | undefined;
            let newCameraFov = 34;
            let newCameraRotation: [number, number] = [0, 0];
            let newSecretRoomIndex = get().tabs.secretRoomIndex;

            if (tab === Tabs.Meet) {
                newCameraPos = cameraPositions[0];
            } else if (tab === Tabs.Laws) {
                newCameraPos = cameraPositions[1];
            } else if (tab === Tabs.Street) {
                newCameraPos = new Vector3(0.312, 0.641, 0.046);
                newCameraFov = 59;
                newCameraRotation = [-0.256, 0.024];
            } else if (tab === Tabs.Secret) {
                const s = get();
                // When a special ending is active, show the triggering faction's room;
                // otherwise cycle through rooms for exploration.
                if (s.specialEnding.available && s.specialEnding.faction) {
                    newSecretRoomIndex = GAMESTATE.FACTION_ROOM_INDEX[s.specialEnding.faction];
                } else {
                    newSecretRoomIndex = (s.tabs.secretRoomIndex + 1) % SECRET_ROOMS.length;
                }
                const room = SECRET_ROOMS[newSecretRoomIndex];
                newCameraPos = new Vector3(...room.pos);
                newCameraFov = room.fov;
                newCameraRotation = room.rotation;
            }

            set((s) => {
                const now = Date.now();
                let { timerStartedAt, timerPausedAt } = s.gameManagement;
                const isInGame = s.gameManagement.phase === 'start';

                if (tab === Tabs.Menu && isInGame && timerPausedAt === null) {
                    timerPausedAt = now;
                } else if (s.tabs.activeTab === Tabs.Menu && isInGame && timerPausedAt !== null) {
                    timerStartedAt = timerStartedAt !== null ? timerStartedAt + (now - timerPausedAt) : null;
                    timerPausedAt = null;
                }

                return {
                    tabs: { ...s.tabs, activeTab: tab, secretRoomIndex: newSecretRoomIndex },
                    scene: {
                        ...s.scene,
                        camera: {
                            ...s.scene.camera,
                            cameraFov: newCameraFov,
                            cameraRotation: newCameraRotation,
                            ...(newCameraPos && {
                                cameraPos: [newCameraPos.x, newCameraPos.y, newCameraPos.z],
                            }),
                        },
                    },
                    meet: { ...s.meet, selectedPower: 'none' },
                    gameManagement: { ...s.gameManagement, timerStartedAt, timerPausedAt },
                };
            });
        },
    },
    law: {
        current: getRandomFromList(LAWS),
        interactedWithLaws: new Set(),
        lawDecided: false,
        lastLawOutcome: null,
        swapLaw: () => {
            set((state) => {
                const updatedLaws = new Set(state.law.interactedWithLaws);
                const pickNextLaw = (usedLaws: Set<typeof LAWS[number]>) => {
                    const lawPool = filterLawPool(LAWS, state.gameManagement.activeRecurringEffects);
                    if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
                        return getRandomUniqueItemForPower(lawPool, usedLaws, 'people') ?? getRandomUniqueItem(lawPool, usedLaws);
                    }
                    if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
                        return getRandomUniqueItemForPower(lawPool, usedLaws, 'business') ?? getRandomUniqueItem(lawPool, usedLaws);
                    }
                    return getRandomUniqueItem(lawPool, usedLaws);
                };
                const nextLaw = pickNextLaw(updatedLaws);
                if (!nextLaw) {
                    console.warn('⚠️ Law pool empty — income cap filter may have exhausted all candidates.');
                    return {};
                }
                updatedLaws.add(nextLaw);
                return { law: { ...state.law, current: nextLaw, interactedWithLaws: updatedLaws, lawDecided: false, lastLawOutcome: null } };
            });
        },
        actUponLaw: (hasAccepted: boolean) => {
            const state = get();
            const current = state.law.current;
            if (!current) return;

            // Weird law path — one-time effects, no faction penalty on reject, slot tracking
            if (current.type === 'weird') {
                if (hasAccepted) {
                    const effect = current.acceptEffect;
                    const newTreasury = state.budget.treasury + (effect.treasury ?? 0);
                    const newRelations = { ...state.relations.current };
                    const round = state.gameManagement.round;
                    PowerList.forEach((key) => {
                        const delta = effect[key];
                        if (typeof delta === 'number') {
                            newRelations[key] = handleRelations({
                                power: key,
                                amount: delta,
                                current: newRelations[key],
                                round,
                            });
                        }
                    });
                    const charismaDelta = current.charismaEffect ?? 0;
                    const newCharisma = Clamp(
                        state.gameManagement.charisma.current + charismaDelta,
                        GAMESTATE.CHARISMA.MIN,
                        GAMESTATE.CHARISMA.MAX
                    );
                    const weirdEntry = {
                        sourceId: `weird-law-${current.id}`,
                        sourceType: 'weird-law' as const,
                        sourceFaction: 'people' as const,
                        label: `laws.labels.${current.id}.label`,
                        incomeBonus: 0,
                        expenseBonus: 0,
                        roundActivated: round,
                    };
                    set((s) => ({
                        budget: { ...s.budget, treasury: newTreasury },
                        relations: { ...s.relations, current: newRelations },
                        gameManagement: {
                            ...s.gameManagement,
                            charisma: { ...s.gameManagement.charisma, current: newCharisma },
                            activeRecurringEffects: [...s.gameManagement.activeRecurringEffects, weirdEntry],
                        },
                        law: {
                            ...s.law,
                            lastLawOutcome: true,
                            lawDecided: true,
                            interactedWithLaws: new Set(s.law.interactedWithLaws).add(current),
                        },
                        stats: {
                            ...s.stats,
                            lawsPassed: s.stats.lawsPassed + 1,
                        },
                    }));
                } else {
                    set((s) => ({
                        law: {
                            ...s.law,
                            lastLawOutcome: false,
                            lawDecided: true,
                            interactedWithLaws: new Set(s.law.interactedWithLaws).add(current),
                        },
                        stats: {
                            ...s.stats,
                            lawsRejected: s.stats.lawsRejected + 1,
                        },
                    }));
                }
                return;
            }

            // Normal law path
            handleDecision({ type: "law", item: current, hasAccepted, get, set });
            set((s) => ({
                stats: {
                    ...s.stats,
                    lawsPassed: hasAccepted ? s.stats.lawsPassed + 1 : s.stats.lawsPassed,
                    lawsRejected: !hasAccepted ? s.stats.lawsRejected + 1 : s.stats.lawsRejected,
                },
            }));
        },
    },
    deals: {
        current: getRandomFromList(DEALS),
        dealDecided: false,
        interactedWithDeals: new Set(),
        lastDealOutcome: null,
        lastDealAccepted: null,

        actUponDeal: (hasAccepted: boolean) => {
            const state = get();
            const current = state.deals.current;
            if (!current) return;
            const effect = hasAccepted ? current.acceptEffect : current.rejectEffect;
            const delta = effect.treasury ?? 0;
            handleDecision({ type: "deal", item: current, hasAccepted, get, set });
            set((s) => ({
                stats: {
                    ...s.stats,
                    dealsAccepted: hasAccepted ? s.stats.dealsAccepted + 1 : s.stats.dealsAccepted,
                    dealsRejected: !hasAccepted ? s.stats.dealsRejected + 1 : s.stats.dealsRejected,
                },
                gameManagement: {
                    ...s.gameManagement,
                    currentRoundExtraIncome: delta > 0 ? s.gameManagement.currentRoundExtraIncome + delta : s.gameManagement.currentRoundExtraIncome,
                    currentRoundExtraExpenses: delta < 0 ? s.gameManagement.currentRoundExtraExpenses + Math.abs(delta) : s.gameManagement.currentRoundExtraExpenses,
                },
            }));
        },
        swapDeal: () => {
            set((state) => {
                const updatedDeals = new Set(state.deals.interactedWithDeals);
                const dealPool = updatedDeals.size >= DEALS.length
                    ? new Set<typeof DEALS[number]>()
                    : updatedDeals;
                const nextDeal = getRandomUniqueItem(DEALS, dealPool);
                if (!nextDeal) {
                    console.warn('⚠️ Deal pool empty — all deals have been shown.');
                    return {};
                }
                updatedDeals.add(nextDeal);
                return { deals: { ...state.deals, current: nextDeal, interactedWithDeals: updatedDeals, dealDecided: false, lastDealOutcome: null, lastDealAccepted: null } };
            });
        },
    },
    periodicEvent: {
        current: null,
        decided: false,
        resultKey: null,
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

            const periodicDelta = effect.treasury ?? 0;
            set((s) => ({
                periodicEvent: {
                    ...s.periodicEvent,
                    decided: true,
                    resultKey: `${event.id}.options.${option.id}.result`,
                },
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                tabs: { ...s.tabs, tabsLocked: false },
                gameManagement: {
                    ...s.gameManagement,
                    currentRoundExtraIncome: periodicDelta > 0 ? s.gameManagement.currentRoundExtraIncome + periodicDelta : s.gameManagement.currentRoundExtraIncome,
                    currentRoundExtraExpenses: periodicDelta < 0 ? s.gameManagement.currentRoundExtraExpenses + Math.abs(periodicDelta) : s.gameManagement.currentRoundExtraExpenses,
                },
            }));
        },
    },
    miniChallenge: {
        current: null,
        decided: false,
        resultKey: null,
        riskTriggered: false,
        resolve: (accepted: boolean) => {
            const state = get();
            const challenge = state.miniChallenge.current;
            if (!challenge || state.miniChallenge.decided) return;

            const effect = accepted ? challenge.acceptEffect : challenge.rejectEffect;
            const resultKey = `${challenge.id}.${accepted ? 'accept' : 'reject'}`;

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
            let riskTriggered = false;
            if (effect.risk && rollChance(effect.risk)) {
                riskTriggered = true;
                // Risk penalty: random power loses 2 on rejection
                if (!accepted) {
                    const powers: Power[] = ['military', 'business', 'people'];
                    const angryPower = getRandomFromList(powers);
                    newRelations[angryPower] = Clamp(
                        newRelations[angryPower] - 2,
                        GAMESTATE.RELATIONS.MIN,
                        GAMESTATE.RELATIONS.MAX
                    );
                }
            }

            const challengeDelta = effect.treasury ?? 0;
            set((s) => ({
                miniChallenge: {
                    ...s.miniChallenge,
                    decided: true,
                    resultKey,
                    riskTriggered,
                },
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                tabs: { ...s.tabs, tabsLocked: false },
                gameManagement: {
                    ...s.gameManagement,
                    currentRoundExtraIncome: challengeDelta > 0 ? s.gameManagement.currentRoundExtraIncome + challengeDelta : s.gameManagement.currentRoundExtraIncome,
                    currentRoundExtraExpenses: challengeDelta < 0 ? s.gameManagement.currentRoundExtraExpenses + Math.abs(challengeDelta) : s.gameManagement.currentRoundExtraExpenses,
                },
            }));
        },
    },
    shop: {
        frozenFactions: new Set<Power>(),
        statueCount: 0,
        advisorLevel: 0 as 0 | 1 | 2 | 3,
        buy: (item: ShopItemId) => {
            const state = get();
            const FREEZE_COST = 80;
            const STATUE_COSTS = [100, 150, 200];
            const FREEZE_MAP: Record<string, Power> = {
                media_coverage: 'people',
                media_shielding: 'military',
                media_blackout: 'business',
            };
            if (item === 'advisor_1' || item === 'advisor_2' || item === 'advisor_3') {
                const ADVISOR_COSTS: Record<typeof item, number> = { advisor_1: 100, advisor_2: 150, advisor_3: 200 };
                const ADVISOR_LEVELS: Record<typeof item, 1 | 2 | 3> = { advisor_1: 1, advisor_2: 2, advisor_3: 3 };
                const targetLevel = ADVISOR_LEVELS[item];
                if (state.shop.advisorLevel >= targetLevel) return;
                const cost = ADVISOR_COSTS[item];
                if (state.budget.treasury < cost) return;
                set((s) => ({
                    budget: { ...s.budget, treasury: s.budget.treasury - cost },
                    shop: { ...s.shop, advisorLevel: targetLevel },
                }));
            } else if (item === 'statue') {
                const { statueCount } = state.shop;
                if (statueCount >= 3) return;
                const cost = STATUE_COSTS[statueCount];
                if (state.budget.treasury < cost) return;
                set((s) => {
                    const newCharisma = Clamp(s.gameManagement.charisma.current + 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                    return {
                        budget: { ...s.budget, treasury: s.budget.treasury - cost },
                        shop: { ...s.shop, statueCount: s.shop.statueCount + 1 },
                        gameManagement: { ...s.gameManagement, charisma: { ...s.gameManagement.charisma, current: newCharisma } },
                    };
                });
            } else {
                const faction = FREEZE_MAP[item];
                if (!faction || state.shop.frozenFactions.has(faction)) return;
                if (state.budget.treasury < FREEZE_COST) return;
                const newFrozen = new Set(state.shop.frozenFactions);
                newFrozen.add(faction);
                set((s) => ({
                    budget: { ...s.budget, treasury: s.budget.treasury - FREEZE_COST },
                    shop: { ...s.shop, frozenFactions: newFrozen },
                }));
            }
        },
    },
    specialEnding: {
        available: false,
        faction: null,
        used: false,
        outcome: null,
        use: () => {
            const state = get();
            if (state.specialEnding.used || !state.specialEnding.faction) return;
            const charisma = state.gameManagement.charisma.current;
            const goodChance = 0.5 + (charisma / 10) * 0.25;
            const isGood = rollChance(goodChance);
            // Outcome narrative is rendered via i18n key `secret.{faction}.outcome_{good|bad}`
            set((s) => ({
                specialEnding: { ...s.specialEnding, used: true, outcome: isGood ? 'good' : 'bad' },
                gameManagement: { ...s.gameManagement, phase: 'special_ending', endReason: null },
            }));
        }
    },
    stats: {
        lawsPassed: 0,
        lawsRejected: 0,
        dealsAccepted: 0,
        dealsRejected: 0,
        totalIncomeEarned: 0,
        totalExpensesSpent: 0,
        totalExtrasEarned: 0,
        totalExtrasSpent: 0,
        peakTreasury: GAMESTATE.BUDGET.TREASURY,
        lowestTreasury: GAMESTATE.BUDGET.TREASURY,
        relationsHistory: [],
        coupGraceFired: false,
        totalRecurringIncomeEarned: 0,
        totalRecurringExpensesSpent: 0,
        repealCount: 0,
    },
    gameManagement: {
        round: GAMESTATE.ROUNDS.START,
        phase: 'idle',
        difficulty: 'medium' as Difficulty,
        endReason: null,
        endCause: null,
        dayEnded: false,
        lastRoundIncome: 0,
        lastRoundExpenses: 0,
        lastRoundRecurringIncome: 0,
        lastRoundRecurringExpenses: 0,
        currentRoundExtraIncome: 0,
        currentRoundExtraExpenses: 0,
        timerStartedAt: null,
        timerPausedAt: null,
        activeRecurringEffects: [],
        repealTakenThisRound: false,
        coupArmedLastRound: false,
        coupWarningFaction: null,
        meetCounts: { military: 0, business: 0, people: 0 },
        representativeStatuses: { military: 'active', business: 'active', people: 'active' },
        dumbScore: educationToDumbScore(GAMESTATE.BUDGET.EXPENDITURES.education),
        setPhase: (phase, difficulty) => {
            if (phase === 'start') {
                const chosenDifficulty: Difficulty = difficulty ?? 'medium';
                const startingTreasury = DIFFICULTY_TREASURY[chosenDifficulty];
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
                        stats: {
                            lawsPassed: 0, lawsRejected: 0,
                            dealsAccepted: 0, dealsRejected: 0,
                            totalIncomeEarned: 0, totalExpensesSpent: 0,
                            totalExtrasEarned: 0, totalExtrasSpent: 0,
                            peakTreasury: startingTreasury,
                            lowestTreasury: startingTreasury,
                            relationsHistory: [],
                            coupGraceFired: false,
                            totalRecurringIncomeEarned: 0,
                            totalRecurringExpensesSpent: 0,
                            repealCount: 0,
                        },
                        gameManagement: {
                            ...state.gameManagement,
                            phase,
                            difficulty: chosenDifficulty,
                            round: GAMESTATE.ROUNDS.START,
                            dayEnded: false,
                            endReason: null,
                            endCause: null,
                            currentRoundExtraIncome: 0,
                            currentRoundExtraExpenses: 0,
                            lastRoundRecurringIncome: 0,
                            lastRoundRecurringExpenses: 0,
                            activeRecurringEffects: [],
                            repealTakenThisRound: false,
                            coupArmedLastRound: false,
                            coupWarningFaction: null,
                            timerStartedAt: Date.now(),
                            timerPausedAt: null,
                            charisma: { ...state.gameManagement.charisma, current: GAMESTATE.CHARISMA.INITIAL },
                            meetCounts: { military: 0, business: 0, people: 0 },
                            representativeStatuses: { military: 'active', business: 'active', people: 'active' },
                            dumbScore: educationToDumbScore(GAMESTATE.BUDGET.EXPENDITURES.education),
                        },
                        specialEnding: {
                            ...state.specialEnding,
                            available: false,
                            faction: null,
                            used: false,
                            outcome: null,
                        },
                        shop: {
                            ...state.shop,
                            frozenFactions: new Set<Power>(),
                            statueCount: 0,
                            advisorLevel: 0 as 0 | 1 | 2 | 3,
                        },
                        relations: {
                            ...state.relations,
                            current: { ...GAMESTATE.RELATIONS.INITIAL },
                        },
                        budget: {
                            ...state.budget,
                            treasury: startingTreasury,
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
                        periodicEvent: { ...state.periodicEvent, current: null, decided: false, resultKey: null },
                        miniChallenge: { ...state.miniChallenge, current: null, decided: false, resultKey: null, riskTriggered: false },
                        deals: {
                            ...state.deals,
                            current: randomDeal,
                            dealDecided: false,
                            interactedWithDeals: freshDeals,
                            lastDealOutcome: null,
                            lastDealAccepted: null,
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
            adjustCharisma: (amount: number) => {
                set((s) => {
                    const prevValue = s.gameManagement.charisma.current
                    const newValue = Clamp(prevValue + amount, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                    return {
                        gameManagement: {
                            ...s.gameManagement,
                            charisma: {
                                ...s.gameManagement.charisma,
                                current: newValue
                            }
                        }
                    };
                })
            }
        },
        expireTimer: () => {
            const state = get();
            const financials = calculateRoundFinancials(state.budget, state.gameManagement.activeRecurringEffects);

            // Apply relation/charisma penalty only when meet action was skipped
            if (!state.meet.actionTaken.taken) {
                const round = state.gameManagement.round;
                const penalty = Math.min(round, 3);
                const frozenFactions = state.shop.frozenFactions;
                const newRelations = { ...state.relations.current };
                const toPenalise = [...PowerList]
                    .sort((a, b) => newRelations[a] - newRelations[b])
                    .slice(0, 2)
                    .filter(p => !frozenFactions.has(p));
                toPenalise.forEach((p) => {
                    newRelations[p] = Clamp(newRelations[p] - penalty, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
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
                        dayEnded: true,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        lastRoundRecurringIncome: financials.recurringIncome,
                        lastRoundRecurringExpenses: financials.recurringExpenses,
                    },
                }));
            } else {
                set((s) => ({
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: true,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        lastRoundRecurringIncome: financials.recurringIncome,
                        lastRoundRecurringExpenses: financials.recurringExpenses,
                    },
                }));
            }
            // Brief overlay is now visible — its Continue button calls nextRound()
        },
        pauseTimer: () => {
            if (get().gameManagement.timerPausedAt !== null) return
            set((s) => ({ gameManagement: { ...s.gameManagement, timerPausedAt: Date.now() } }))
        },
        resumeTimer: () => {
            const { timerStartedAt, timerPausedAt } = get().gameManagement
            if (timerPausedAt === null) return
            const now = Date.now()
            const newStartedAt = timerStartedAt !== null ? timerStartedAt + (now - timerPausedAt) : null
            set((s) => ({ gameManagement: { ...s.gameManagement, timerStartedAt: newStartedAt, timerPausedAt: null } }))
        },
        advanceRoundRequested: false,
        requestAdvanceRound: () => set((s) => ({
            gameManagement: { ...s.gameManagement, advanceRoundRequested: true },
        })),
        clearAdvanceRoundRequest: () => set((s) => ({
            gameManagement: { ...s.gameManagement, advanceRoundRequested: false },
        })),
        nextRound: () => {
            const state = get();

            // --- 0. Coup check (fires before financial resolution — ADR-0006 ordering) ---
            const coupResult = checkCoup(
                state.relations.current,
                state.gameManagement.charisma.current,
                rollFloat(),
                state.gameManagement.coupArmedLastRound ?? false,
                state.budget.expenditures.security
            );

            if (coupResult.outcome === 'coup') {
                set((s) => ({
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: i18n.t(`endscreen.coup_narrative.${coupResult.faction}`, { ns: 'endscreen' }),
                        endCause: coupResult.cause,
                        phase: 'lose',
                        coupArmedLastRound: false,
                        coupWarningFaction: null,
                    },
                }));
                return;
            }

            // Coup warning state to carry into this round's final state
            const newCoupArmedLastRound = coupResult.outcome === 'grace';
            const newCoupWarningFaction: Power | null =
                coupResult.outcome === 'grace' || coupResult.outcome === 'yellow-warning'
                    ? coupResult.faction
                    : null;

            // --- 1. Financial resolution (includes active recurring effects) ---
            const financials = calculateRoundFinancials(state.budget, state.gameManagement.activeRecurringEffects);
            let newTreasury = state.budget.treasury + financials.netChange;

            // Shared gameManagement fields written by every end-of-round branch below
            const recurringGmFields = {
                lastRoundRecurringIncome: financials.recurringIncome,
                lastRoundRecurringExpenses: financials.recurringExpenses,
                repealTakenThisRound: false,
            };

            // --- 2. Budget → relation effects ---
            const { newRelations, logMessages } = applyBudgetEffects(state.budget, state.relations.current);

            // --- 3. Tax penalty + charisma corrosion (Plan G) ---
            const taxMessages: string[] = [];
            let newCharisma = state.gameManagement.charisma.current;
            if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
                newRelations.people = Clamp(newRelations.people - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                taxMessages.push(i18n.t('log.tax_penalty_people'));
            }
            if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
                newRelations.business = Clamp(newRelations.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                taxMessages.push(i18n.t('log.tax_penalty_business'));
            }

            // --- 4. Representative status for next round ---
            const prevStatuses = state.gameManagement.representativeStatuses;
            const newRepStatuses: Record<Power, 'active' | 'sick' | 'eliminated'> = {
                military: prevStatuses.military === 'eliminated' ? 'eliminated' : 'active',
                business: prevStatuses.business === 'eliminated' ? 'eliminated' : 'active',
                people:   prevStatuses.people   === 'eliminated' ? 'eliminated' : 'active',
            };
            if (state.budget.expenditures.health < GAMESTATE.BUDGET_EFFECTS.HEALTH.LOW) {
                (['military', 'business', 'people'] as Power[])
                    .filter(p => newRepStatuses[p] === 'active')
                    .forEach(p => { if (rollChance(0.5)) newRepStatuses[p] = 'sick'; });
            }
            // Reset selectedPower if their representative will be unavailable next round
            const newSelectedPower: Power | 'none' =
                state.meet.selectedPower !== 'none' &&
                newRepStatuses[state.meet.selectedPower] === 'active'
                    ? state.meet.selectedPower
                    : 'none';
            const newDumbScore = educationToDumbScore(state.budget.expenditures.education);

            // --- 5. Build log entry ---
            const logLines: string[] = [];
            if (state.law.lawDecided && state.law.current) {
                const verbKey = state.law.lastLawOutcome ? 'log.passed_law' : 'log.rejected_law';
                const lawLabelKey = state.law.current.type === 'weird'
                    ? `laws.labels.${state.law.current.id}.label`
                    : `laws.labels.${state.law.current.id}`;
                logLines.push(i18n.t(verbKey, { label: i18n.t(lawLabelKey, { ns: 'laws' }) }));
            }
            if (state.deals.dealDecided && state.deals.current) {
                logLines.push(i18n.t(state.deals.lastDealAccepted ? 'log.accepted_deal' : 'log.declined_deal'));
            }
            if (state.meet.actionTaken.taken && state.meet.actionTaken.power && state.meet.actionTaken.type) {
                logLines.push(i18n.t('log.met_with', {
                    power: i18n.t(`power.${state.meet.actionTaken.power}`),
                    action: i18n.t(`meet.${state.meet.actionTaken.type}`),
                }));
            }
            logLines.push(i18n.t('log.financials', { income: financials.totalIncome, expenses: financials.expenses }));
            logLines.push(...logMessages, ...taxMessages);
            if (newCharisma > state.gameManagement.charisma.current) logLines.push(i18n.t('log.charisma_up'));
            else if (newCharisma < state.gameManagement.charisma.current) logLines.push(i18n.t('log.charisma_down'));
            // Coup warning log lines (appended after financial summary)
            if (coupResult.outcome === 'yellow-warning') {
                logLines.push(i18n.t('log.coup_yellow_warning', { faction: i18n.t(`power.${coupResult.faction}`) }));
            }
            if (coupResult.outcome === 'grace') {
                logLines.push(i18n.t('log.coup_red_warning', { faction: i18n.t(`power.${coupResult.faction}`) }));
            }
            const newLog = [...state.log, { date: getGameDate(state.gameManagement.round), lines: logLines }];

            // --- 6. Increment round, draw next daily event ---
            const newRound = state.gameManagement.round + 1;
            const buildStatsUpdate = (s: GameState): GameStats => ({
                ...s.stats,
                totalIncomeEarned: s.stats.totalIncomeEarned + financials.totalIncome,
                totalExpensesSpent: s.stats.totalExpensesSpent + financials.expenses,
                totalExtrasEarned: s.stats.totalExtrasEarned + s.gameManagement.currentRoundExtraIncome,
                totalExtrasSpent: s.stats.totalExtrasSpent + s.gameManagement.currentRoundExtraExpenses,
                peakTreasury: Math.max(s.stats.peakTreasury, newTreasury),
                lowestTreasury: Math.min(s.stats.lowestTreasury, newTreasury),
                relationsHistory: [...s.stats.relationsHistory, {
                    round: state.gameManagement.round,
                    military: newRelations.military,
                    business: newRelations.business,
                    people: newRelations.people,
                }],
                coupGraceFired: s.stats.coupGraceFired || coupResult.outcome === 'grace',
                totalRecurringIncomeEarned: s.stats.totalRecurringIncomeEarned + financials.recurringIncome,
                totalRecurringExpensesSpent: s.stats.totalRecurringExpensesSpent + financials.recurringExpenses,
            });
            const nextDailyEvent = getRandomDailyEvent();

            // --- 7. Biased law selection (Plan G) + weird law trigger (Story 5-2) ---
            const hasActiveWeirdLaw = state.gameManagement.activeRecurringEffects.some(
                e => e.sourceType === 'weird-law'
            );
            const pickNextLaw = (usedLaws: Set<typeof LAWS[number]>): typeof LAWS[number] | null => {
                // 10% chance of a weird law when the slot is empty (weird laws are faction-neutral)
                if (!hasActiveWeirdLaw && rollChance(0.10)) {
                    return getRandomFromList(WEIRD_LAWS);
                }
                const lawPool = filterLawPool(LAWS, state.gameManagement.activeRecurringEffects);
                // Exclude laws from sick or eliminated factions; fall back to full pool if none remain
                const unavailablePowers = (['military', 'business', 'people'] as Power[])
                    .filter(p => newRepStatuses[p] !== 'active');
                const effectiveLawPool = unavailablePowers.length > 0
                    ? (lawPool.filter(l => !unavailablePowers.includes(l.power)).length > 0
                        ? lawPool.filter(l => !unavailablePowers.includes(l.power))
                        : lawPool)
                    : lawPool;
                if (state.budget.taxes.peopleTaxes > GAMESTATE.INCOME.TAX_PENALTY_PEOPLE_THRESHOLD) {
                    return getRandomUniqueItemForPower(effectiveLawPool, usedLaws, 'people') ?? getRandomUniqueItem(effectiveLawPool, usedLaws);
                }
                if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
                    return getRandomUniqueItemForPower(effectiveLawPool, usedLaws, 'business') ?? getRandomUniqueItem(effectiveLawPool, usedLaws);
                }
                return getRandomUniqueItem(effectiveLawPool, usedLaws);
            };

            // --- 8. Check game-over / victory ---
            const bankruptcy = newTreasury <= 0;
            const overthrown = (Object.keys(newRelations) as Power[]).find(p => newRelations[p] <= GAMESTATE.RELATIONS.MIN);

            if (bankruptcy) {
                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    stats: buildStatsUpdate(s),
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: i18n.t('endscreen.end_reason.bankruptcy', { ns: 'endscreen' }),
                        endCause: 'bankruptcy' as EndCause,
                        phase: 'lose',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        ...recurringGmFields,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
                        coupArmedLastRound: false,
                        coupWarningFaction: null,
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
                    stats: buildStatsUpdate(s),
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: i18n.t(`endscreen.end_reason.overthrown_${overthrown}`, { ns: 'endscreen' }),
                        endCause: overthrown as EndCause,
                        phase: 'lose',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        ...recurringGmFields,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
                        coupArmedLastRound: false,
                        coupWarningFaction: null,
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
                    stats: buildStatsUpdate(s),
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: null,
                        endCause: null,
                        phase: 'victory',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        ...recurringGmFields,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
                        coupArmedLastRound: false,
                        coupWarningFaction: null,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    }
                }));
                return;
            }

            // --- 8.4. Restore frozen factions (all-change freeze powerup) ---
            state.shop.frozenFactions.forEach(faction => {
                newRelations[faction] = state.relations.current[faction];
            });

            // --- 8.5. Unlock special ending at round 9 if any faction meets threshold ---
            const factionsAtThreshold = (Object.keys(newRelations) as Power[]).filter(
                p => newRelations[p] >= GAMESTATE.SPECIAL_ENDING_THRESHOLD
            );
            let specialEndingFaction: Power | null = null;
            if (newRound === 9 && factionsAtThreshold.length > 0 && !state.specialEnding.used) {
                const counts = state.gameManagement.meetCounts;
                specialEndingFaction = factionsAtThreshold.reduce((best, p) =>
                    counts[p] >= counts[best] ? p : best
                );
            }
            const specialRoomIndex = specialEndingFaction !== null
                ? GAMESTATE.FACTION_ROOM_INDEX[specialEndingFaction]
                : undefined;

            // --- 9. Check for periodic event ---
            const periodicEvent = PERIODIC_EVENTS.find(e => e.round === newRound) ?? null;
            if (periodicEvent) {
                const periodicDealPool = state.deals.interactedWithDeals.size >= DEALS.length
                    ? new Set<typeof DEALS[number]>()
                    : state.deals.interactedWithDeals;
                const randomDeal = getRandomUniqueItem(DEALS, periodicDealPool);
                const updatedDeals = new Set(periodicDealPool);
                if (randomDeal) updatedDeals.add(randomDeal);
                const updatedLaws = new Set(state.law.interactedWithLaws);
                const randomLaw = pickNextLaw(updatedLaws);
                if (!randomLaw) console.warn('⚠️ Law pool empty — income cap filter may have exhausted all candidates.');
                if (randomLaw) updatedLaws.add(randomLaw);

                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    stats: buildStatsUpdate(s),
                    dailyEvent: { current: nextDailyEvent },
                    periodicEvent: { ...s.periodicEvent, current: periodicEvent, decided: false, resultKey: null },
                    miniChallenge: { ...s.miniChallenge, current: null, decided: false, resultKey: null, riskTriggered: false },
                    meet: { ...s.meet, actionTaken: { type: undefined, taken: false, power: undefined }, actionOutcomeText: null, selectedPower: newSelectedPower },
                    law: { ...s.law, current: randomLaw, lawDecided: false, interactedWithLaws: updatedLaws, lastLawOutcome: null },
                    deals: { ...s.deals, current: randomDeal, dealDecided: false, interactedWithDeals: updatedDeals, lastDealAccepted: null },
                    tabs: {
                        ...s.tabs,
                        activeTab: Tabs.Log,
                        tabsLocked: false,
                        ...(specialRoomIndex !== undefined ? { secretRoomIndex: specialRoomIndex } : {}),
                    },
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        round: newRound,
                        timerStartedAt: Date.now(),
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        ...recurringGmFields,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
                        coupArmedLastRound: newCoupArmedLastRound,
                        coupWarningFaction: newCoupWarningFaction,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                        representativeStatuses: newRepStatuses,
                        dumbScore: newDumbScore,
                    },
                    shop: { ...s.shop, frozenFactions: new Set<Power>() },
                    ...(specialEndingFaction ? {
                        specialEnding: { ...s.specialEnding, available: true, faction: specialEndingFaction },
                    } : {}),
                }));
                return;
            }

            // --- 10. 40% chance for mini-challenge ---
            const hasMiniChallenge = rollChance(0.4);
            const miniChallengeToShow = hasMiniChallenge
                ? getRandomFromList(MINI_CHALLENGES)
                : null;

            const normalDealPool = state.deals.interactedWithDeals.size >= DEALS.length
                ? new Set<typeof DEALS[number]>()
                : state.deals.interactedWithDeals;
            const randomDeal = getRandomUniqueItem(DEALS, normalDealPool);
            const updatedDeals = new Set(normalDealPool);
            if (randomDeal) updatedDeals.add(randomDeal);
            const updatedLaws = new Set(state.law.interactedWithLaws);
            const randomLaw = pickNextLaw(updatedLaws);
            if (!randomLaw) console.warn('⚠️ Law pool empty — income cap filter may have exhausted all candidates.');
            if (randomLaw) updatedLaws.add(randomLaw);

            set((s) => ({
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                log: newLog,
                stats: buildStatsUpdate(s),
                dailyEvent: { current: nextDailyEvent },
                periodicEvent: { ...s.periodicEvent, current: null, decided: false, resultKey: null },
                miniChallenge: { ...s.miniChallenge, current: miniChallengeToShow, decided: false, resultKey: null, riskTriggered: false },
                meet: { ...s.meet, actionTaken: { type: undefined, taken: false, power: undefined }, actionOutcomeText: null, selectedPower: newSelectedPower },
                law: { ...s.law, current: randomLaw, lawDecided: false, interactedWithLaws: updatedLaws, lastLawOutcome: null },
                deals: { ...s.deals, current: randomDeal, dealDecided: false, interactedWithDeals: updatedDeals, lastDealAccepted: null },
                gameManagement: {
                    ...s.gameManagement,
                    dayEnded: false,
                    round: newRound,
                    timerStartedAt: Date.now(),
                    lastRoundIncome: financials.totalIncome,
                    lastRoundExpenses: financials.expenses,
                    ...recurringGmFields,
                    currentRoundExtraIncome: 0,
                    currentRoundExtraExpenses: 0,
                    coupArmedLastRound: newCoupArmedLastRound,
                    coupWarningFaction: newCoupWarningFaction,
                    charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    representativeStatuses: newRepStatuses,
                    dumbScore: newDumbScore,
                },
                shop: { ...s.shop, frozenFactions: new Set<Power>() },
                tabs: {
                    ...s.tabs,
                    activeTab: Tabs.Log,
                    tabsLocked: false,
                    ...(specialRoomIndex !== undefined ? { secretRoomIndex: specialRoomIndex } : {}),
                },
                ...(specialEndingFaction ? {
                    specialEnding: { ...s.specialEnding, available: true, faction: specialEndingFaction },
                } : {}),
            }));
        },
        repeal: (sourceId: string) => {
            const state = get();
            const gm = state.gameManagement;
            if (gm.repealTakenThisRound) return;
            const entry = gm.activeRecurringEffects.find(e => e.sourceId === sourceId);
            if (!entry) return;
            const tier = getRepealTier(entry);
            const cost = GAMESTATE.REPEAL_COST[tier].treasury;
            if (state.budget.treasury < cost) return;
            // Weird-law entries have no proposing faction — skip the relation penalty.
            const isWeirdLaw = entry.sourceType === 'weird-law';
            const relationPenalty = isWeirdLaw ? 0 : GAMESTATE.REPEAL_COST[tier].relation;
            const newRelation = isWeirdLaw
                ? state.relations.current[entry.sourceFaction]
                : handleRelations({
                    power: entry.sourceFaction,
                    amount: relationPenalty,
                    current: state.relations.current[entry.sourceFaction],
                    round: state.gameManagement.round,
                });
            // Bankruptcy check folded into the same set() — single atomic
            // multi-slice update per ADR-0002 (no mid-update render of a
            // zero-treasury state without the lose phase).
            const newTreasury = state.budget.treasury - cost;
            const bankrupt = newTreasury <= 0;
            set((s) => ({
                budget: { ...s.budget, treasury: newTreasury },
                relations: {
                    ...s.relations,
                    current: { ...s.relations.current, [entry.sourceFaction]: newRelation },
                },
                stats: {
                    ...s.stats,
                    repealCount: s.stats.repealCount + 1,
                },
                gameManagement: {
                    ...s.gameManagement,
                    activeRecurringEffects: s.gameManagement.activeRecurringEffects.filter(e => e.sourceId !== sourceId),
                    repealTakenThisRound: true,
                    ...(bankrupt ? {
                        phase: 'lose' as const,
                        endCause: 'bankruptcy' as EndCause,
                        endReason: i18n.t('endscreen.end_reason.bankruptcy', { ns: 'endscreen' }),
                    } : {}),
                },
            }));
        },
        saveGame: () => {
            exportSave(get());
        },
        loadGame: (data: Record<string, unknown>) => {
            const gm = data.gameManagement as Record<string, unknown> ?? {};
            const savedBudget = data.budget as Record<string, unknown> ?? {};
            const savedRelations = data.relations as Record<string, unknown> ?? {};
            const savedLaw = data.law as Record<string, unknown> ?? {};
            const savedDeals = data.deals as Record<string, unknown> ?? {};
            const savedMeet = data.meet as Record<string, unknown> ?? {};
            const savedStats = data.stats as Record<string, unknown> ?? {};

            // Restore current law/deal by id so undecided rounds resume correctly
            const savedLawId = (savedLaw.current as Record<string, unknown> | null)?.id;
            const restoredLaw = typeof savedLawId === 'number' ? (LAWS.find(l => l.id === savedLawId) ?? null) : null;
            const savedDealId = (savedDeals.current as Record<string, unknown> | null)?.id;
            const restoredDeal = typeof savedDealId === 'number' ? (DEALS.find(d => d.id === savedDealId) ?? null) : null;

            set((s) => ({
                gameManagement: {
                    ...s.gameManagement,
                    round: (gm.round as number) ?? s.gameManagement.round,
                    phase: (gm.phase as GameState['gameManagement']['phase']) ?? s.gameManagement.phase,
                    difficulty: (gm.difficulty as Difficulty) ?? 'medium',
                    endReason: (gm.endReason as string | null) ?? null,
                    dayEnded: (gm.dayEnded as boolean) ?? false,
                    lastRoundIncome: (gm.lastRoundIncome as number) ?? 0,
                    lastRoundExpenses: (gm.lastRoundExpenses as number) ?? 0,
                    // Recurring effect fields — default to empty/0 for saves predating sprint 2
                    lastRoundRecurringIncome: (gm.lastRoundRecurringIncome as number) ?? 0,
                    lastRoundRecurringExpenses: (gm.lastRoundRecurringExpenses as number) ?? 0,
                    activeRecurringEffects: (gm.activeRecurringEffects as GameState['gameManagement']['activeRecurringEffects']) ?? [],
                    repealTakenThisRound: (gm.repealTakenThisRound as boolean) ?? false,
                    // Coup fields — default to safe state for saves predating story 2-7
                    coupArmedLastRound: (gm.coupArmedLastRound as boolean) ?? false,
                    coupWarningFaction: (gm.coupWarningFaction as Power | null) ?? null,
                    // Representative statuses — default all active for saves predating story 3-5
                    representativeStatuses: (gm.representativeStatuses as Record<Power, 'active' | 'sick' | 'eliminated'>) ?? { military: 'active', business: 'active', people: 'active' },
                    // dumbScore — recompute from saved education for saves predating this feature
                    dumbScore: typeof gm.dumbScore === 'number' ? gm.dumbScore : educationToDumbScore(GAMESTATE.BUDGET.EXPENDITURES.education),
                    timerStartedAt: Date.now(),
                    timerPausedAt: null,
                    charisma: {
                        ...s.gameManagement.charisma,
                        current: ((gm.charisma as Record<string, unknown>)?.current as number) ?? s.gameManagement.charisma.current,
                    },
                },
                budget: {
                    ...s.budget,
                    treasury: (savedBudget.treasury as number) ?? s.budget.treasury,
                    expenditures: (savedBudget.expenditures as typeof s.budget.expenditures) ?? s.budget.expenditures,
                    taxes: (savedBudget.taxes as typeof s.budget.taxes) ?? s.budget.taxes,
                },
                relations: {
                    ...s.relations,
                    current: (savedRelations.current as typeof s.relations.current) ?? s.relations.current,
                },
                log: (data.log as GameState['log']) ?? [],
                dailyEvent: { current: (data.dailyEvent as Record<string, unknown>)?.current as GameState['dailyEvent']['current'] ?? null },
                law: {
                    ...s.law,
                    current: restoredLaw,
                    lawDecided: (savedLaw.lawDecided as boolean) ?? false,
                    lastLawOutcome: (savedLaw.lastLawOutcome as boolean | null) ?? null,
                    interactedWithLaws: new Set(),
                },
                deals: {
                    ...s.deals,
                    current: restoredDeal,
                    dealDecided: (savedDeals.dealDecided as boolean) ?? false,
                    lastDealOutcome: (savedDeals.lastDealOutcome as string[] | null) ?? null,
                    lastDealAccepted: (savedDeals.lastDealAccepted as boolean | null) ?? null,
                    interactedWithDeals: new Set(),
                },
                meet: {
                    ...s.meet,
                    actionTaken: (savedMeet.actionTaken as typeof s.meet.actionTaken) ?? { type: undefined, taken: false, power: undefined },
                    actionOutcomeText: (savedMeet.actionOutcomeText as typeof s.meet.actionOutcomeText) ?? null,
                    selectedPower: 'none',
                },
                periodicEvent: { ...s.periodicEvent, current: null, decided: false, resultKey: null },
                miniChallenge: { ...s.miniChallenge, current: null, decided: false, resultKey: null },
                tabs: { ...s.tabs, activeTab: (data.tabs as Record<string, unknown>)?.activeTab as Tabs ?? Tabs.Log, tabsLocked: false },
                shop: {
                    ...s.shop,
                    statueCount: ((data.shop as Record<string, unknown>)?.statueCount as number) ?? 0,
                    frozenFactions: new Set((data.shop as Record<string, unknown>)?.frozenFactions as Power[] ?? []),
                    advisorLevel: ((data.shop as Record<string, unknown>)?.advisorLevel as 0 | 1 | 2 | 3) ?? 0,
                },
                stats: {
                    ...s.stats,
                    // Safe defaults for fields added in story 3-4 (saves predating this story lack them)
                    coupGraceFired: (savedStats.coupGraceFired as boolean) ?? false,
                    totalRecurringIncomeEarned: (savedStats.totalRecurringIncomeEarned as number) ?? 0,
                    totalRecurringExpensesSpent: (savedStats.totalRecurringExpensesSpent as number) ?? 0,
                    repealCount: (savedStats.repealCount as number) ?? 0,
                },
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
        takeAction: (power: Power, action: MeetActionType) => set((state) => {
            const { actionTaken, newRelations, resultText, treasuryUpdate, charismaDelta } = handleActionOutcome(power, action, state);
            const newCharisma = Clamp(
                state.gameManagement.charisma.current + charismaDelta,
                GAMESTATE.CHARISMA.MIN,
                GAMESTATE.CHARISMA.MAX
            );
            const newRepStatuses = action === 'eliminate'
                ? { ...state.gameManagement.representativeStatuses, [power]: 'eliminated' as const }
                : state.gameManagement.representativeStatuses;
            return {
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
                    meetCounts: actionTaken ? {
                        ...state.gameManagement.meetCounts,
                        [power]: state.gameManagement.meetCounts[power] + 1,
                    } : state.gameManagement.meetCounts,
                    representativeStatuses: newRepStatuses,
                },
            };
        })
    },
    budget: {
        treasury: GAMESTATE.BUDGET.TREASURY,
        expenditures: GAMESTATE.BUDGET.EXPENDITURES,
        taxes: GAMESTATE.BUDGET.TAXES,
        adjustTreasury: (amount: number) => {
            set((state) => ({
                budget: {
                    ...state.budget,
                    treasury: state.budget.treasury + amount
                }
            }))
        },
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
    tutorial: {
        active: false,
        activate: () => set((s) => ({ tutorial: { ...s.tutorial, active: true } })),
        deactivate: () => set((s) => ({ tutorial: { ...s.tutorial, active: false } })),
    },
    log: [],
    dailyEvent: {
        current: null,
    },
    relations: {
        current: GAMESTATE.RELATIONS.INITIAL,
        adjustRelations: (power: Power, amount: number) => {
            set((state) => {
                const newValue = handleRelations({
                    power,
                    amount,
                    current: state.relations.current[power as keyof typeof state.relations.current],
                    round: state.gameManagement.round,
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
