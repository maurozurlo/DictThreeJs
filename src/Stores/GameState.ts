// store.ts
import { create } from "zustand";
import { Tabs } from "../types/Tabs";
import type { Expenditures, Taxes } from "../types/Budget";
import { GAMESTATE, STREET_CAMERA, TAB_CAMERA, DEFAULT_TAB_FOV } from "../Constants/GameState";
import { pausedTimerFields, resumedTimerFields } from "../Utils/Timer";
import type { TimerFields } from "../Utils/Timer";
import type { Difficulty } from "../Constants/GameState";
import { Clamp, getRandomFromList, getRandomUniqueItem, rollChance } from "../Utils/Math";
import { DEALS } from "../assets/deals";
import type { EndCause, GameState, LogDeltas, LogEvent, ShopItemId } from "../types/GameState";
import { LAWS } from "../assets/laws";
import { handleDecision, handleRelations } from "./EffectHandler";
import { handleActionOutcome } from "./ActionHandler";
import { handleBudgetChange, calculateRoundFinancials } from "./BudgetHandler";
import i18n from '../i18n';
import type { Power, MeetActionType } from "../types/Power";
import { getRandomUniqueItemForPower } from "../Utils/Laws";
import { Power as PowerList } from "../Constants/Power";
import { filterLawPool } from "./RecurringHandler";
import { educationToDumbScore } from "../Utils/String";
import { exportSave } from "../Utils/SaveLoad";
import { getEffectiveCharisma, countModifiersByType, computeRepealTier } from "../Utils/Modifiers";
import { buildWeirdLawModifier, getModifierContent } from "../assets/modifierContent";
import { STATUES, MEDIA_PACKAGES, buildShopModifier } from "../assets/ShopItems";
import { SECRET_ROOMS } from "../assets/secretRooms";
import { buildStartState, buildLoadedState } from "./StateFactory";
import { resolveRound, buildGameOverPatch, buildRoundStartPatch, prepareRoundStart } from "./RoundResolver";
import { buildDeltas } from "../Utils/RoundLog";

/** Relation before/after → LogDeltas diff bag (ADR-0011). */
const relationDiff = (before: Record<Power, number>, after: Record<Power, number>): LogDeltas => ({
    military: after.military - before.military,
    business: after.business - before.business,
    people: after.people - before.people,
});


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
        freeCam: false,
        setDebugMode: (enabled: boolean) => set((state) => ({
            debug: { ...state.debug, enabled },
        })),
        setFov: (fov: number) => set((state) => ({
            debug: { ...state.debug, fov },
        })),
        toggleSelector: () => set((state) => ({
            debug: { ...state.debug, selectorOpen: !state.debug.selectorOpen },
        })),
        setFreeCam: (freeCam: boolean) => set((state) => ({
            debug: { ...state.debug, freeCam },
        })),
    },
    scene: {
        camera: {
            cameraPos: [-1.336, 0.63, 0.302],
            cameraFov: 34,
            cameraHFov: undefined,
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

            setCameraFov: (fov) =>
                set((state) => ({
                    scene: {
                        ...state.scene,
                        camera: { ...state.scene.camera, cameraFov: fov },
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
        selectedPedId: null,
        selectPed: (id) => set((s) => ({ scene: { ...s.scene, selectedPedId: id } })),
    },
    tabs: {
        activeTab: GAMESTATE.TABS.START_TAB,
        tabsLocked: false,
        secretRoomIndex: 0,
        setActiveTab: (tab: Tabs) => {
            // Menu, Secret and Shop tabs bypass lock; all others respect it
            if (get().tabs.tabsLocked && tab !== Tabs.Secret && tab !== Tabs.Shop && tab !== Tabs.Menu) return;

            // Round Loop Phase Split (ADR-0012): during the after-work hinge
            // (dwelling), decision tabs are locked — nothing to decide until
            // nextRound() fires. During the work day, Street is locked — it is
            // reachable only during the hinge. Debug mode bypasses both.
            const gm = get().gameManagement;
            const debugEnabled = get().debug.enabled;
            if (!debugEnabled) {
                const decisionTabs: Tabs[] = [Tabs.Meet, Tabs.Laws, Tabs.Deals, Tabs.Budget];
                if (gm.dwelling && decisionTabs.includes(tab)) return;
                if (!gm.dwelling && tab === Tabs.Street && gm.phase === 'start') return;
            }

            // Camera routing is data-driven (TAB_CAMERA, Story 10-2); only the
            // secret rooms need live state for room cycling.
            const config = TAB_CAMERA[tab];
            let newCameraPos: [number, number, number] | undefined;
            let newCameraFov: number = DEFAULT_TAB_FOV;
            let newCameraHFov: number | undefined = undefined;
            let newCameraRotation: [number, number] = [0, 0];
            let newSecretRoomIndex = get().tabs.secretRoomIndex;

            if (config.kind === 'scan') {
                const p = get().scene.camera.cameraPositions[config.index];
                if (p) newCameraPos = [p.x, p.y, p.z];
            } else if (config.kind === 'fixed') {
                newCameraPos = config.pos;
                newCameraFov = config.fov;
                newCameraHFov = config.hFov;
                newCameraRotation = config.rotation;
            } else if (config.kind === 'secret') {
                const s = get();
                // When a special ending is active, show the triggering faction's room;
                // otherwise cycle through rooms for exploration.
                if (s.specialEnding.available && s.specialEnding.faction) {
                    newSecretRoomIndex = GAMESTATE.FACTION_ROOM_INDEX[s.specialEnding.faction];
                } else {
                    newSecretRoomIndex = (s.tabs.secretRoomIndex + 1) % SECRET_ROOMS.length;
                }
                const room = SECRET_ROOMS[newSecretRoomIndex];
                newCameraPos = room.pos;
                newCameraFov = room.fov;
                newCameraRotation = room.rotation;
            }

            set((s) => {
                // Entering the Menu mid-game pauses the work-day timer; leaving
                // it resumes. Same arithmetic as pauseTimer/resumeTimer (ADR-0006).
                let timerPatch: Partial<TimerFields> | null = null;
                if (s.gameManagement.phase === 'start') {
                    const now = Date.now();
                    if (tab === Tabs.Menu) {
                        timerPatch = pausedTimerFields(s.gameManagement, now);
                    } else if (s.tabs.activeTab === Tabs.Menu) {
                        timerPatch = resumedTimerFields(s.gameManagement, now);
                    }
                }

                return {
                    tabs: { ...s.tabs, activeTab: tab, secretRoomIndex: newSecretRoomIndex },
                    scene: {
                        ...s.scene,
                        camera: {
                            ...s.scene.camera,
                            cameraFov: newCameraFov,
                            cameraHFov: newCameraHFov,
                            cameraRotation: newCameraRotation,
                            ...(newCameraPos && { cameraPos: newCameraPos }),
                        },
                    },
                    meet: { ...s.meet, selectedPower: 'none' },
                    gameManagement: { ...s.gameManagement, ...(timerPatch ?? {}) },
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
                    const lawPool = filterLawPool(LAWS, state.gameManagement.modifiers);
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
                    const round = state.gameManagement.round;
                    const newRelations = { ...state.relations.current };
                    let newTreasury = state.budget.treasury;
                    let charismaDelta = 0;
                    // Weird-law effects are ADR-0008 class A — applied as immediate base
                    // mutations (the weird modifier below carries no contributions).
                    for (const spec of current.acceptMods) {
                        if (spec.stat === 'treasury') {
                            newTreasury += spec.amount;
                        } else if (spec.stat === 'military' || spec.stat === 'business' || spec.stat === 'people') {
                            newRelations[spec.stat] = handleRelations({
                                power: spec.stat,
                                amount: spec.amount,
                                current: newRelations[spec.stat],
                                round,
                            });
                        } else if (spec.stat === 'charisma') {
                            charismaDelta += spec.amount;
                        }
                    }
                    const newCharisma = Clamp(
                        state.gameManagement.charisma.current + charismaDelta,
                        GAMESTATE.CHARISMA.MIN,
                        GAMESTATE.CHARISMA.MAX
                    );
                    // Weird-law ledger/slot modifier — effects above are immediate base
                    // mutations (ADR-0008 class A); this entry enforces the "one weird law
                    // active" slot, drives Street View, and is a repealable ledger entry.
                    const weirdMod = buildWeirdLawModifier(current.id, round);
                    // Weird-law effects are immediate base mutations — diff them for the log (ADR-0011).
                    const weirdLogEvent: LogEvent = {
                        key: 'log.passed_law',
                        labelKey: `laws.weird.${current.id}.label`, labelNs: 'laws',
                        deltas: buildDeltas({
                            ...relationDiff(state.relations.current, newRelations),
                            treasury: newTreasury - state.budget.treasury,
                            charisma: newCharisma - state.gameManagement.charisma.current,
                        }),
                    };
                    set((s) => ({
                        budget: { ...s.budget, treasury: newTreasury },
                        relations: { ...s.relations, current: newRelations },
                        gameManagement: {
                            ...s.gameManagement,
                            charisma: { ...s.gameManagement.charisma, current: newCharisma },
                            modifiers: s.gameManagement.modifiers.some(m => m.id === weirdMod.id && m.state === 'active')
                                ? s.gameManagement.modifiers
                                : [...s.gameManagement.modifiers, weirdMod],
                            pendingLog: [...s.gameManagement.pendingLog, weirdLogEvent],
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
                        gameManagement: {
                            ...s.gameManagement,
                            pendingLog: [...s.gameManagement.pendingLog, {
                                key: 'log.rejected_law',
                                labelKey: `laws.weird.${current.id}.label`, labelNs: 'laws',
                            } as LogEvent],
                        },
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
            // Treasury delta for the round's extra-income/expense readout (DayEnded +
            // totalExtras stats). The treasury itself is applied via the modifier in
            // nextRound (accept) or as a base mutation in handleDecision (reject).
            const chosenMods = hasAccepted ? current.acceptMods : current.rejectMods;
            const delta = chosenMods.reduce((sum, s) => (s.stat === 'treasury' ? sum + s.amount : sum), 0);
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
            const periodicLogEvent: LogEvent = {
                key: 'log.event.event_resolved',
                labelKey: `${event.id}.title`, labelNs: 'periodic_events',
                deltas: buildDeltas({ ...relationDiff(state.relations.current, newRelations), treasury: periodicDelta }),
            };
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
                    pendingLog: [...s.gameManagement.pendingLog, periodicLogEvent],
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

            const effect = accepted ? challenge.acceptOutcome : challenge.rejectOutcome;
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
            const challengeLogEvent: LogEvent = {
                key: accepted ? 'log.event.opportunity_accepted' : 'log.event.opportunity_rejected',
                deltas: buildDeltas({ ...relationDiff(state.relations.current, newRelations), treasury: challengeDelta }),
            };
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
                    pendingLog: [...s.gameManagement.pendingLog, challengeLogEvent],
                },
            }));
        },
    },
    shop: {
        frozenFactions: new Set<Power>(),
        advisorLevel: 0 as 0 | 1 | 2 | 3,
        buy: (item: ShopItemId) => {
            const state = get();
            if (item === 'advisor_1' || item === 'advisor_2' || item === 'advisor_3') {
                const ADVISOR_COSTS: Record<typeof item, number> = { advisor_1: 100, advisor_2: 150, advisor_3: 200 };
                const ADVISOR_LEVELS: Record<typeof item, 1 | 2 | 3> = { advisor_1: 1, advisor_2: 2, advisor_3: 3 };
                const targetLevel = ADVISOR_LEVELS[item];
                if (state.shop.advisorLevel >= targetLevel) return;
                const cost = ADVISOR_COSTS[item];
                if (state.budget.treasury < cost) return;
                const advisorEvent: LogEvent = {
                    key: 'log.event.hired_advisor',
                    params: { level: targetLevel },
                    deltas: { treasury: -cost },
                };
                set((s) => ({
                    budget: { ...s.budget, treasury: s.budget.treasury - cost },
                    shop: { ...s.shop, advisorLevel: targetLevel },
                    gameManagement: {
                        ...s.gameManagement,
                        pendingLog: [...s.gameManagement.pendingLog, advisorEvent],
                        currentRoundShopCost: s.gameManagement.currentRoundShopCost + cost,
                    },
                }));
            } else if (item === 'statue') {
                // Owned count is derived from the modifiers ledger — single source of truth.
                const statueCount = countModifiersByType(state.gameManagement.modifiers, 'statue');
                const shopItem = STATUES[statueCount];
                if (!shopItem) return; // all tiers owned
                if (state.budget.treasury < shopItem.price) return;
                const statueEvent: LogEvent = {
                    key: 'log.event.bought_statue',
                    deltas: { treasury: -shopItem.price },
                    ongoing: buildDeltas({ charisma: shopItem.mods.reduce((a, m) => m.stat === 'charisma' ? a + m.amount : a, 0) }),
                };
                set((s) => ({
                    budget: { ...s.budget, treasury: s.budget.treasury - shopItem.price },
                    gameManagement: {
                        ...s.gameManagement,
                        modifiers: [
                            ...s.gameManagement.modifiers,
                            buildShopModifier(shopItem, state.gameManagement.round),
                        ],
                        pendingLog: [...s.gameManagement.pendingLog, statueEvent],
                        currentRoundShopCost: s.gameManagement.currentRoundShopCost + shopItem.price,
                    },
                }));
            } else {
                const mediaPackage = MEDIA_PACKAGES.find(p => p.id === item);
                if (!mediaPackage || state.shop.frozenFactions.has(mediaPackage.faction)) return;
                if (state.budget.treasury < mediaPackage.price) return;
                const newFrozen = new Set(state.shop.frozenFactions);
                newFrozen.add(mediaPackage.faction);
                const mediaEvent: LogEvent = {
                    key: 'log.event.bought_media',
                    refParams: { faction: `power.${mediaPackage.faction}` },
                    deltas: { treasury: -mediaPackage.price },
                };
                set((s) => ({
                    budget: { ...s.budget, treasury: s.budget.treasury - mediaPackage.price },
                    shop: { ...s.shop, frozenFactions: newFrozen },
                    gameManagement: {
                        ...s.gameManagement,
                        pendingLog: [...s.gameManagement.pendingLog, mediaEvent],
                        currentRoundShopCost: s.gameManagement.currentRoundShopCost + mediaPackage.price,
                    },
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
            const charisma = getEffectiveCharisma(state.gameManagement.charisma.current, state.gameManagement.modifiers, state.gameManagement.round);
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
        dwelling: false,
        lastRoundIncome: 0,
        lastRoundExpenses: 0,
        lastRoundRecurringIncome: 0,
        lastRoundRecurringExpenses: 0,
        lastRoundLawTreasuryDelta: 0,
        lastRoundDealTreasuryDelta: 0,
        currentRoundExtraIncome: 0,
        currentRoundExtraExpenses: 0,
        currentRoundExpropriateGain: 0,
        currentRoundBribeCost: 0,
        currentRoundShopCost: 0,
        timerStartedAt: null,
        timerPausedAt: null,
        modifiers: [],
        pendingLog: [],
        repealTakenThisRound: false,
        coupArmedLastRound: false,
        coupWarningFaction: null,
        meetCounts: { military: 0, business: 0, people: 0 },
        representativeStatuses: { military: 'active', business: 'active', people: 'active' },
        dumbScore: educationToDumbScore(GAMESTATE.BUDGET.EXPENDITURES.education),
        rngSeed: 0,
        conditionStage: 0,
        setPhase: (phase, difficulty) => {
            if (phase === 'start') {
                return set((state) => buildStartState(state, difficulty));
            }
            return set((state) => ({
                gameManagement: { ...state.gameManagement, phase },
            }));
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
        // Round Loop Phase Split (ADR-0012): dismisses the round-1 opening
        // dwell. No round to resolve yet — just starts the timer and unlocks
        // decision tabs, mirroring nextRound()'s tail without resolveRound().
        beginFirstWorkDay: () => set((s) => ({
            tabs: { ...s.tabs, activeTab: Tabs.Log },
            gameManagement: {
                ...s.gameManagement,
                dwelling: false,
                timerStartedAt: Date.now(),
            },
        })),
        expireTimer: () => {
            const state = get();
            const financials = calculateRoundFinancials(state.budget, state.gameManagement.modifiers, state.gameManagement.round);

            // Skipped-meeting penalty: the two lowest non-frozen factions and
            // charisma take a hit, recorded as a timeout event (ADR-0011).
            const skipped = !state.meet.actionTaken.taken;
            let newRelations = state.relations.current;
            let newCharisma = state.gameManagement.charisma.current;
            const timeoutEvents: LogEvent[] = [];
            if (skipped) {
                const penalty = Math.min(state.gameManagement.round, 3);
                newRelations = { ...state.relations.current };
                [...PowerList]
                    .sort((a, b) => newRelations[a] - newRelations[b])
                    .slice(0, 2)
                    .filter(p => !state.shop.frozenFactions.has(p))
                    .forEach((p) => {
                        newRelations[p] = Clamp(newRelations[p] - penalty, GAMESTATE.RELATIONS.MIN, GAMESTATE.RELATIONS.MAX);
                    });
                newCharisma = Clamp(newCharisma - 1, GAMESTATE.CHARISMA.MIN, GAMESTATE.CHARISMA.MAX);
                timeoutEvents.push({
                    key: 'log.event.timeout',
                    deltas: buildDeltas({
                        ...relationDiff(state.relations.current, newRelations),
                        charisma: newCharisma - state.gameManagement.charisma.current,
                    }),
                });
            }

            // Open the hinge on Street (ADR-0012) — the reveal/dwell UI's advance
            // button calls nextRound(). Camera snaps with the tab in the same set().
            set((s) => ({
                relations: { ...s.relations, current: newRelations },
                tabs: { ...s.tabs, activeTab: Tabs.Street },
                scene: {
                    ...s.scene,
                    camera: {
                        ...s.scene.camera,
                        cameraFov: STREET_CAMERA.fov,
                        cameraHFov: STREET_CAMERA.hFov,
                        cameraRotation: STREET_CAMERA.rotation,
                        cameraPos: STREET_CAMERA.pos,
                    },
                },
                gameManagement: {
                    ...s.gameManagement,
                    charisma: { ...s.gameManagement.charisma, current: newCharisma },
                    dayEnded: true,
                    dwelling: true,
                    lastRoundIncome: financials.totalIncome,
                    lastRoundExpenses: financials.expenses,
                    lastRoundRecurringIncome: financials.recurringIncome,
                    lastRoundRecurringExpenses: financials.recurringExpenses,
                    lastRoundLawTreasuryDelta: financials.lawTreasuryDelta,
                    lastRoundDealTreasuryDelta: financials.dealTreasuryDelta,
                    pendingLog: [...s.gameManagement.pendingLog, ...timeoutEvents],
                },
            }));
        },
        pauseTimer: () => {
            const patch = pausedTimerFields(get().gameManagement, Date.now());
            if (!patch) return;
            set((s) => ({ gameManagement: { ...s.gameManagement, ...patch } }));
        },
        resumeTimer: () => {
            const patch = resumedTimerFields(get().gameManagement, Date.now());
            if (!patch) return;
            set((s) => ({ gameManagement: { ...s.gameManagement, ...patch } }));
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
            const resolution = resolveRound(state);

            // Coup pre-empts round resolution entirely — no financials applied,
            // no round increment (ADR-0009).
            if (resolution.kind === 'coup') {
                set((s) => ({
                    gameManagement: {
                        ...s.gameManagement,
                        dayEnded: false,
                        dwelling: false,
                        endReason: i18n.t(`endscreen.coup_narrative.${resolution.coupResult.faction}`, { ns: 'endscreen' }),
                        endCause: resolution.coupResult.cause,
                        phase: 'lose',
                        coupArmedLastRound: false,
                        coupWarningFaction: null,
                    },
                }));
                return;
            }

            if (resolution.bankruptcy) {
                set((s) => buildGameOverPatch(s, resolution, {
                    phase: 'lose',
                    endReason: i18n.t('endscreen.end_reason.bankruptcy', { ns: 'endscreen' }),
                    endCause: 'bankruptcy' as EndCause,
                }));
                return;
            }

            if (resolution.overthrown) {
                set((s) => buildGameOverPatch(s, resolution, {
                    phase: 'lose',
                    endReason: i18n.t(`endscreen.end_reason.overthrown_${resolution.overthrown}`, { ns: 'endscreen' }),
                    endCause: resolution.overthrown as EndCause,
                }));
                return;
            }

            if (resolution.newRound > GAMESTATE.ROUNDS.MAX) {
                set((s) => buildGameOverPatch(s, resolution, {
                    phase: 'victory',
                    endReason: null,
                    endCause: null,
                }));
                return;
            }

            const drawn = prepareRoundStart(state, resolution);
            set((s) => buildRoundStartPatch(s, resolution, drawn));
        },
        repeal: (modifierId: string) => {
            const state = get();
            const gm = state.gameManagement;
            if (gm.repealTakenThisRound) return;
            const mod = gm.modifiers.find(m => m.id === modifierId && m.state === 'active');
            if (!mod) return;
            // Tier from the modifier's economic magnitude, frozen at acquisition (ADR-0008 §8 / Story 6-4).
            const tier = computeRepealTier(mod.mods);
            const cost = GAMESTATE.REPEAL_COST[tier].treasury;
            if (state.budget.treasury < cost) return;
            // Faction is content (looked up by id from the law/deal pool). Weird laws
            // have no proposing faction → no relation penalty.
            const faction = mod.type === 'weird-law' ? null : getModifierContent(modifierId)?.faction ?? null;
            const repealedRelations = faction
                ? {
                    ...state.relations.current,
                    [faction]: handleRelations({
                        power: faction,
                        amount: GAMESTATE.REPEAL_COST[tier].relation,
                        current: state.relations.current[faction],
                        round: state.gameManagement.round,
                    }),
                }
                : state.relations.current;
            // Bankruptcy check folded into the same set() — single atomic
            // multi-slice update per ADR-0002 (no mid-update render of a
            // zero-treasury state without the lose phase).
            const newTreasury = state.budget.treasury - cost;
            const bankrupt = newTreasury <= 0;
            set((s) => ({
                budget: { ...s.budget, treasury: newTreasury },
                relations: { ...s.relations, current: repealedRelations },
                stats: {
                    ...s.stats,
                    repealCount: s.stats.repealCount + 1,
                },
                gameManagement: {
                    ...s.gameManagement,
                    // Flip to 'rejected' — retained as ledger history, no longer summed (ADR-0008 §4).
                    modifiers: s.gameManagement.modifiers.map(m =>
                        m.id === modifierId && m.state === 'active' ? { ...m, state: 'rejected' as const } : m,
                    ),
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
            set((s) => buildLoadedState(s, data));
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
            // Void the pending law if the elimated faction proposed it and it hasn't been decided yet
            const lawVoided = action === 'eliminate'
                && !state.law.lawDecided
                && state.law.current?.power === power
                && state.law.current?.type !== 'weird';
            // Record the meeting using its result text as the headline (ADR-0011) — it
            // already names the faction, the relation change and any treasury cost, and it
            // explains zero-effect outcomes (e.g. inconclusive dialogue) that a deltas line
            // alone would leave blank. The effects line carries the charisma delta, which
            // the meet result texts omit. Only logged when the action went through (e.g. a
            // bribe with insufficient funds is a no-op).
            const { power: _omitPower, angryPower, ...meetLiteralParams } = resultText.params ?? {};
            const meetRefParams: Record<string, string> = { power: `power.${power}` };
            if (angryPower !== undefined) meetRefParams.angryPower = `power.${angryPower}`;
            const meetEvent: LogEvent = {
                key: resultText.key,
                keyNs: 'meet',
                params: meetLiteralParams,
                refParams: meetRefParams,
                deltas: buildDeltas({
                    charisma: newCharisma - state.gameManagement.charisma.current,
                    treasury: treasuryUpdate,
                }),
            };
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
                    currentRoundBribeCost: action === 'bribe' && actionTaken && treasuryUpdate < 0
                        ? state.gameManagement.currentRoundBribeCost + Math.abs(treasuryUpdate)
                        : state.gameManagement.currentRoundBribeCost,
                    currentRoundExpropriateGain: action === 'expropriate' && actionTaken && treasuryUpdate > 0
                        ? state.gameManagement.currentRoundExpropriateGain + treasuryUpdate
                        : state.gameManagement.currentRoundExpropriateGain,
                    pendingLog: actionTaken
                        ? [...state.gameManagement.pendingLog, meetEvent]
                        : state.gameManagement.pendingLog,
                },
                law: lawVoided
                    ? { ...state.law, lawDecided: true }
                    : state.law,
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
    citizens: [],
    citizenStates: [],
    displayedPopulation: 0,
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
