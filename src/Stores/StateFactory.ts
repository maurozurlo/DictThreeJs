// State factory — pure builders for the two largest state-construction blocks
// (new-game reset and save load), extracted from GameState.ts to keep the store
// readable. Each takes the current state (for spreads) plus inputs and returns a
// Partial<GameState> patch; the store action just wraps it in set().

import { Tabs } from "../types/Tabs";
import { GAMESTATE, DIFFICULTY_TREASURY } from "../Constants/GameState";
import type { Difficulty } from "../Constants/GameState";
import { getRandomUniqueItem, seedRng, setRngState } from "../Utils/Math";
import { LAWS } from "../assets/laws";
import { DEALS } from "../assets/deals";
import type { GameState } from "../types/GameState";
import type { Power } from "../types/Power";
import { getRandomDailyEvent } from "./DailyEventHandler";
import { educationToDumbScore } from "../Utils/String";
import { normalizeModifier } from "../Utils/Modifiers";
import { migrateLegacyEffect } from "../assets/modifierContent";

/** Full new-game reset patch (setPhase('start')). Draws the first law/deal. */
export function buildStartState(state: GameState, difficulty?: Difficulty): Partial<GameState> {
    const chosenDifficulty: Difficulty = difficulty ?? 'medium';
    const startingTreasury = DIFFICULTY_TREASURY[chosenDifficulty];

    // Seed the run's PRNG from fresh entropy BEFORE any draw below, so the first
    // law/deal/event and every later roll come from one reproducible stream
    // (ADR-0010). The cursor is then saved/restored by SaveLoad — a reload resumes
    // the exact stream, which makes risky outcomes un-save-scummable.
    const rngSeed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    seedRng(rngSeed);

    const freshLaws = new Set<typeof LAWS[number]>();
    const freshDeals = new Set<typeof DEALS[number]>();
    const randomLaw = getRandomUniqueItem(LAWS, freshLaws);
    const randomDeal = getRandomUniqueItem(DEALS, freshDeals);
    if (randomLaw) freshLaws.add(randomLaw);
    if (randomDeal) freshDeals.add(randomDeal);

    return {
        tabs: { ...state.tabs, activeTab: Tabs.Log, tabsLocked: false },
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
            phase: 'start',
            difficulty: chosenDifficulty,
            round: GAMESTATE.ROUNDS.START,
            dayEnded: false,
            endReason: null,
            endCause: null,
            currentRoundExtraIncome: 0,
            currentRoundExtraExpenses: 0,
            lastRoundRecurringIncome: 0,
            lastRoundRecurringExpenses: 0,
            modifiers: [],
            repealTakenThisRound: false,
            coupArmedLastRound: false,
            coupWarningFaction: null,
            timerStartedAt: Date.now(),
            timerPausedAt: null,
            charisma: { ...state.gameManagement.charisma, current: GAMESTATE.CHARISMA.INITIAL },
            meetCounts: { military: 0, business: 0, people: 0 },
            representativeStatuses: { military: 'active', business: 'active', people: 'active' },
            dumbScore: educationToDumbScore(GAMESTATE.BUDGET.EXPENDITURES.education),
            rngSeed,
        },
        specialEnding: { ...state.specialEnding, available: false, faction: null, used: false, outcome: null },
        shop: { ...state.shop, frozenFactions: new Set<Power>(), advisorLevel: 0 as 0 | 1 | 2 | 3 },
        relations: { ...state.relations, current: { ...GAMESTATE.RELATIONS.INITIAL } },
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
}

/** Deserialize a save payload into a state patch (loadGame). */
export function buildLoadedState(state: GameState, data: Record<string, unknown>): Partial<GameState> {
    const gm = data.gameManagement as Record<string, unknown> ?? {};

    // Restore the PRNG cursor so rolls resume exactly where the save left off
    // (ADR-0010). Pre-RNG saves omit `rngState` — leave the live cursor untouched.
    if (typeof data.rngState === 'number') {
        setRngState(data.rngState);
    }

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

    // Modifiers are the source of truth. One-way migration (ADR-0008 P2): a pre-P2
    // save carries `activeRecurringEffects` and no/empty `modifiers` — convert each
    // legacy entry into a permanent roundIncome/roundExpense modifier so income,
    // the weird-law slot, and repeal keep working identically.
    const savedModifiers = ((gm.modifiers as unknown[]) ?? []).map(normalizeModifier);
    const legacyEffects = (gm.activeRecurringEffects as Parameters<typeof migrateLegacyEffect>[0][]) ?? [];
    const migratedModifiers = savedModifiers.length === 0 && legacyEffects.length > 0
        ? legacyEffects.map(migrateLegacyEffect)
        : [];
    if (migratedModifiers.length > 0) {
        console.info(`Migrated ${migratedModifiers.length} legacy recurring effect(s) to modifiers (ADR-0008 P2).`);
    }
    const loadedModifiers = [...savedModifiers, ...migratedModifiers];

    return {
        gameManagement: {
            ...state.gameManagement,
            round: (gm.round as number) ?? state.gameManagement.round,
            phase: (gm.phase as GameState['gameManagement']['phase']) ?? state.gameManagement.phase,
            difficulty: (gm.difficulty as Difficulty) ?? 'medium',
            endReason: (gm.endReason as string | null) ?? null,
            dayEnded: (gm.dayEnded as boolean) ?? false,
            lastRoundIncome: (gm.lastRoundIncome as number) ?? 0,
            lastRoundExpenses: (gm.lastRoundExpenses as number) ?? 0,
            lastRoundRecurringIncome: (gm.lastRoundRecurringIncome as number) ?? 0,
            lastRoundRecurringExpenses: (gm.lastRoundRecurringExpenses as number) ?? 0,
            modifiers: loadedModifiers,
            repealTakenThisRound: (gm.repealTakenThisRound as boolean) ?? false,
            coupArmedLastRound: (gm.coupArmedLastRound as boolean) ?? false,
            coupWarningFaction: (gm.coupWarningFaction as Power | null) ?? null,
            representativeStatuses: (gm.representativeStatuses as Record<Power, 'active' | 'sick' | 'eliminated'>) ?? { military: 'active', business: 'active', people: 'active' },
            dumbScore: typeof gm.dumbScore === 'number' ? gm.dumbScore : educationToDumbScore(GAMESTATE.BUDGET.EXPENDITURES.education),
            rngSeed: typeof gm.rngSeed === 'number' ? gm.rngSeed : state.gameManagement.rngSeed,
            timerStartedAt: Date.now(),
            timerPausedAt: null,
            charisma: {
                ...state.gameManagement.charisma,
                current: ((gm.charisma as Record<string, unknown>)?.current as number) ?? state.gameManagement.charisma.current,
            },
        },
        budget: {
            ...state.budget,
            treasury: (savedBudget.treasury as number) ?? state.budget.treasury,
            expenditures: (savedBudget.expenditures as typeof state.budget.expenditures) ?? state.budget.expenditures,
            taxes: (savedBudget.taxes as typeof state.budget.taxes) ?? state.budget.taxes,
        },
        relations: {
            ...state.relations,
            current: (savedRelations.current as typeof state.relations.current) ?? state.relations.current,
        },
        log: (data.log as GameState['log']) ?? [],
        dailyEvent: { current: (data.dailyEvent as Record<string, unknown>)?.current as GameState['dailyEvent']['current'] ?? null },
        law: {
            ...state.law,
            current: restoredLaw,
            lawDecided: (savedLaw.lawDecided as boolean) ?? false,
            lastLawOutcome: (savedLaw.lastLawOutcome as boolean | null) ?? null,
            interactedWithLaws: new Set(),
        },
        deals: {
            ...state.deals,
            current: restoredDeal,
            dealDecided: (savedDeals.dealDecided as boolean) ?? false,
            lastDealOutcome: (savedDeals.lastDealOutcome as string[] | null) ?? null,
            lastDealAccepted: (savedDeals.lastDealAccepted as boolean | null) ?? null,
            interactedWithDeals: new Set(),
        },
        meet: {
            ...state.meet,
            actionTaken: (savedMeet.actionTaken as typeof state.meet.actionTaken) ?? { type: undefined, taken: false, power: undefined },
            actionOutcomeText: (savedMeet.actionOutcomeText as typeof state.meet.actionOutcomeText) ?? null,
            selectedPower: 'none',
        },
        periodicEvent: { ...state.periodicEvent, current: null, decided: false, resultKey: null },
        miniChallenge: { ...state.miniChallenge, current: null, decided: false, resultKey: null },
        tabs: { ...state.tabs, activeTab: (data.tabs as Record<string, unknown>)?.activeTab as Tabs ?? Tabs.Log, tabsLocked: false },
        shop: {
            ...state.shop,
            frozenFactions: new Set((data.shop as Record<string, unknown>)?.frozenFactions as Power[] ?? []),
            advisorLevel: ((data.shop as Record<string, unknown>)?.advisorLevel as 0 | 1 | 2 | 3) ?? 0,
        },
        stats: {
            ...state.stats,
            coupGraceFired: (savedStats.coupGraceFired as boolean) ?? false,
            totalRecurringIncomeEarned: (savedStats.totalRecurringIncomeEarned as number) ?? 0,
            totalRecurringExpensesSpent: (savedStats.totalRecurringExpensesSpent as number) ?? 0,
            repealCount: (savedStats.repealCount as number) ?? 0,
        },
    };
}
