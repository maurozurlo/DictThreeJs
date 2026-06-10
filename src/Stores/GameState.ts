// store.ts
import { create } from "zustand";
import { Vector3 } from "three";
import { Tabs } from "../types/Tabs";
import type { Expenditures, Taxes } from "../types/Budget";
import { GAMESTATE } from "../Constants/GameState";
import { Clamp, getRandomFromList, getRandomUniqueItem } from "../Utils/Math";
import { DEALS } from "../assets/deals";
import type { EndCause, GameState, GameStats, ShopItemId } from "../types/GameState";
import { LAWS } from "../assets/laws";
import { handleDecision, handleRelations, applyBudgetEffects } from "./EffectHandler";
import { handleActionOutcome } from "./ActionHandler";
import { handleBudgetChange, calculateRoundFinancials } from "./BudgetHandler";
import { PERIODIC_EVENTS } from "../assets/periodicEvents";
import { MINI_CHALLENGES } from "../assets/miniChallenges";
import i18n from '../i18n';
import type { Power } from "../types/Power";
import { getRandomDailyEvent } from "./DailyEventHandler";
import { getRandomUniqueItemForPower } from "../Utils/Laws";
import { Power as PowerList } from "../Constants/Power";
import { getGameDate } from "../Utils/GameDate";
import { exportSave } from "../Utils/SaveLoad";


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
            // Menu, Secret and Shop tabs bypass lock; all others respect it
            if (get().tabs.tabsLocked && tab !== Tabs.Secret && tab !== Tabs.Shop && tab !== Tabs.Menu) return;

            const cameraPositions = get().scene.camera.cameraPositions;
            let newCameraPos: Vector3 | undefined;

            if (tab === Tabs.Meet) {
                newCameraPos = cameraPositions[0];
            } else if (tab === Tabs.Laws) {
                newCameraPos = cameraPositions[1];
            } else if (tab === Tabs.Street) {
                newCameraPos = cameraPositions[2];
            } else if (tab === Tabs.Secret) {
                newCameraPos = new Vector3(1.5, 0.7, 1.0);
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
                    tabs: { ...s.tabs, activeTab: tab },
                    scene: {
                        ...s.scene,
                        camera: {
                            ...s.scene.camera,
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
        actUponLaw: (hasAccepted: boolean) => {
            const state = get();
            const current = state.law.current;
            if (!current) return;
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
            if (effect.risk && Math.random() < effect.risk) {
                riskTriggered = true;
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
        buy: (item: ShopItemId) => {
            const state = get();
            const FREEZE_COST = 80;
            const STATUE_COSTS = [100, 150, 200];
            const FREEZE_MAP: Record<string, Power> = {
                media_coverage: 'people',
                media_shielding: 'military',
                media_blackout: 'business',
            };
            if (item === 'statue') {
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
            const isGood = Math.random() < goodChance;
            const faction = state.specialEnding.faction;
            const narratives: Record<string, { good: string; bad: string }> = {
                military: {
                    good: "You press the button. A blinding flash illuminates the horizon. Hours later, the reports come in — the entire population has perished. Your enemies, your allies, everyone. You sit alone on a throne of ash. Emperor of the Wasteland.",
                    bad: "You press the button. The missiles fly — but not toward your own people. The neighboring country is annihilated. The military erupts in celebration. You drink with them through the night. You never see the blade that finds your throat."
                },
                business: {
                    good: "You seize the accounts and vanish. The jet is waiting, the beach house keys already in your pocket. You spend your final years in luxury, untouchable and forgotten. It was a good run.",
                    bad: "You reach for the accounts. At the airport, uniformed men step forward. The money is counterfeit — a trap laid by the very people you trusted. You are taken to a cell. The official report says suicide."
                },
                people: {
                    good: "You sit in the garden and, for the first time, let your guard down. Something has changed. You call for free elections. The people flood the streets. You watch from a window, surprised to feel relief. You live quietly for decades, tending your garden, until you die peacefully at ninety-four.",
                    bad: "You close your eyes in the garden, finally at ease. The jasmine is beautiful. You never hear him coming. An anarchist steps from between the flowers. Your last thought is the smell of jasmine."
                }
            };
            const endReason = isGood ? narratives[faction].good : narratives[faction].bad;
            set((s) => ({
                specialEnding: { ...s.specialEnding, used: true, outcome: isGood ? 'good' : 'bad' },
                gameManagement: { ...s.gameManagement, phase: 'special_ending', endReason },
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
    },
    gameManagement: {
        round: GAMESTATE.ROUNDS.START,
        phase: 'idle',
        endReason: null,
        endCause: null,
        dayEnded: false,
        lastRoundIncome: 0,
        lastRoundExpenses: 0,
        currentRoundExtraIncome: 0,
        currentRoundExtraExpenses: 0,
        timerStartedAt: null,
        timerPausedAt: null,
        meetCounts: { military: 0, business: 0, people: 0 },
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
                        stats: {
                            lawsPassed: 0, lawsRejected: 0,
                            dealsAccepted: 0, dealsRejected: 0,
                            totalIncomeEarned: 0, totalExpensesSpent: 0,
                            totalExtrasEarned: 0, totalExtrasSpent: 0,
                            peakTreasury: GAMESTATE.BUDGET.TREASURY,
                            lowestTreasury: GAMESTATE.BUDGET.TREASURY,
                            relationsHistory: [],
                        },
                        gameManagement: {
                            ...state.gameManagement,
                            phase,
                            round: GAMESTATE.ROUNDS.START,
                            dayEnded: false,
                            endReason: null,
                            endCause: null,
                            currentRoundExtraIncome: 0,
                            currentRoundExtraExpenses: 0,
                            timerStartedAt: Date.now(),
                            timerPausedAt: null,
                            charisma: { ...state.gameManagement.charisma, current: GAMESTATE.CHARISMA.INITIAL },
                            meetCounts: { military: 0, business: 0, people: 0 },
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
                taxMessages.push(i18n.t('log.tax_penalty_people'));
            }
            if (state.budget.taxes.businessTaxes > GAMESTATE.INCOME.TAX_PENALTY_BUSINESS_THRESHOLD) {
                newRelations.business = Clamp(newRelations.business - 1, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                taxMessages.push(i18n.t('log.tax_penalty_business'));
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
                eventMessages.push(i18n.t(currentEvent.key, { ns: 'daily_events' }));
            }

            // --- 5. Build log entry ---
            const logLines: string[] = [];
            if (state.law.lawDecided && state.law.current) {
                const verbKey = state.law.lastLawOutcome ? 'log.passed_law' : 'log.rejected_law';
                logLines.push(i18n.t(verbKey, { label: i18n.t(`laws.labels.${state.law.current.id}`, { ns: 'laws' }) }));
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
            logLines.push(...logMessages, ...taxMessages, ...eventMessages);
            if (newCharisma > state.gameManagement.charisma.current) logLines.push(i18n.t('log.charisma_up'));
            else if (newCharisma < state.gameManagement.charisma.current) logLines.push(i18n.t('log.charisma_down'));
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
            });
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
                    stats: buildStatsUpdate(s),
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        endReason: "Economic collapse! Your treasury has run out of funds.",
                        endCause: 'bankruptcy' as EndCause,
                        phase: 'lose',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
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
                        endReason: `The ${overthrown} has overthrown your government! Relations dropped to -10.`,
                        endCause: overthrown as EndCause,
                        phase: 'lose',
                        round: newRound,
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
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
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    }
                }));
                return;
            }

            // --- 8.4. Restore frozen factions (all-change freeze powerup) ---
            state.shop.frozenFactions.forEach(faction => {
                newRelations[faction] = state.relations.current[faction];
            });

            // --- 8.5. Unlock special ending at round 9 if any faction is at max ---
            const factionsAtMax = (Object.keys(newRelations) as Power[]).filter(
                p => newRelations[p] >= GAMESTATE.RELATIONS.MAX
            );
            let specialEndingFaction: Power | null = null;
            if (newRound === 9 && factionsAtMax.length > 0 && !state.specialEnding.used) {
                const counts = state.gameManagement.meetCounts;
                specialEndingFaction = factionsAtMax.reduce((best, p) =>
                    counts[p] >= counts[best] ? p : best
                );
            }

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
                if (randomLaw) updatedLaws.add(randomLaw);

                set((s) => ({
                    budget: { ...s.budget, treasury: newTreasury },
                    relations: { ...s.relations, current: newRelations },
                    log: newLog,
                    stats: buildStatsUpdate(s),
                    dailyEvent: { current: nextDailyEvent },
                    periodicEvent: { ...s.periodicEvent, current: periodicEvent, decided: false, resultKey: null },
                    miniChallenge: { ...s.miniChallenge, current: null, decided: false, resultKey: null, riskTriggered: false },
                    meet: { ...s.meet, actionTaken: { type: undefined, taken: false, power: undefined }, actionOutcomeText: null },
                    law: { ...s.law, current: randomLaw, lawDecided: false, interactedWithLaws: updatedLaws, lastLawOutcome: null },
                    deals: { ...s.deals, current: randomDeal, dealDecided: false, interactedWithDeals: updatedDeals, lastDealAccepted: null },
                    tabs: { ...s.tabs, activeTab: Tabs.Log },
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        round: newRound,
                        timerStartedAt: Date.now(),
                        lastRoundIncome: financials.totalIncome,
                        lastRoundExpenses: financials.expenses,
                        currentRoundExtraIncome: 0,
                        currentRoundExtraExpenses: 0,
                        charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    },
                    shop: { ...s.shop, frozenFactions: new Set<Power>() },
                    ...(specialEndingFaction ? {
                        specialEnding: { ...s.specialEnding, available: true, faction: specialEndingFaction }
                    } : {}),
                }));
                return;
            }

            // --- 10. 40% chance for mini-challenge ---
            const hasMiniChallenge = Math.random() < 0.4;
            const miniChallengeToShow = hasMiniChallenge
                ? MINI_CHALLENGES[Math.floor(Math.random() * MINI_CHALLENGES.length)]
                : null;

            const normalDealPool = state.deals.interactedWithDeals.size >= DEALS.length
                ? new Set<typeof DEALS[number]>()
                : state.deals.interactedWithDeals;
            const randomDeal = getRandomUniqueItem(DEALS, normalDealPool);
            const updatedDeals = new Set(normalDealPool);
            if (randomDeal) updatedDeals.add(randomDeal);
            const updatedLaws = new Set(state.law.interactedWithLaws);
            const randomLaw = pickNextLaw(updatedLaws);
            if (randomLaw) updatedLaws.add(randomLaw);

            set((s) => ({
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: newRelations },
                log: newLog,
                stats: buildStatsUpdate(s),
                dailyEvent: { current: nextDailyEvent },
                periodicEvent: { ...s.periodicEvent, current: null, decided: false, resultKey: null },
                miniChallenge: { ...s.miniChallenge, current: miniChallengeToShow, decided: false, resultKey: null, riskTriggered: false },
                meet: { ...s.meet, actionTaken: { type: undefined, taken: false, power: undefined }, actionOutcomeText: null },
                law: { ...s.law, current: randomLaw, lawDecided: false, interactedWithLaws: updatedLaws, lastLawOutcome: null },
                deals: { ...s.deals, current: randomDeal, dealDecided: false, interactedWithDeals: updatedDeals, lastDealAccepted: null },
                tabs: { ...s.tabs, activeTab: Tabs.Log, tabsLocked: false },
                gameManagement: {
                    ...s.gameManagement,
                    dayEnded: false,
                    round: newRound,
                    timerStartedAt: Date.now(),
                    lastRoundIncome: financials.totalIncome,
                    lastRoundExpenses: financials.expenses,
                    currentRoundExtraIncome: 0,
                    currentRoundExtraExpenses: 0,
                    charisma: { ...s.gameManagement.charisma, current: newCharisma },
                },
                shop: { ...s.shop, frozenFactions: new Set<Power>() },
                ...(specialEndingFaction ? {
                    specialEnding: { ...s.specialEnding, available: true, faction: specialEndingFaction }
                } : {}),
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
                    endReason: (gm.endReason as string | null) ?? null,
                    dayEnded: (gm.dayEnded as boolean) ?? false,
                    lastRoundIncome: (gm.lastRoundIncome as number) ?? 0,
                    lastRoundExpenses: (gm.lastRoundExpenses as number) ?? 0,
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
                    lastDealOutcome: (savedDeals.lastDealOutcome as string | null) ?? null,
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
                    meetCounts: actionTaken ? {
                        ...state.gameManagement.meetCounts,
                        [power]: state.gameManagement.meetCounts[power] + 1,
                    } : state.gameManagement.meetCounts,
                },
            };
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
