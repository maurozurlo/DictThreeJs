import type { Vector3 } from "three";
import type { Tabs } from "./Tabs";
import type { Deal } from "./Deal";
import type { MeetActionType, Power } from "./Power";
import type { Expenditures, Taxes } from "./Budget";
import type { Law } from "./Law";
import type { PeriodicEvent } from "./PeriodicEvent";
import type { MiniChallenge } from "./MiniChallenge";
import type { DailyEvent } from "./DailyEvent";
import type { Difficulty } from "../Constants/GameState";

export type RoundLogEntry = {
    date: string;
    lines: string[];
};

export type ShopItemId = 'media_coverage' | 'media_shielding' | 'media_blackout' | 'statue';

export type EndCause = 'military' | 'business' | 'people' | 'bankruptcy' | 'military_coup' | 'business_coup' | 'people_coup' | null;

/**
 * A law or deal whose recurring effect is currently active.
 * Entries are pushed on accept and removed only via repeal.
 * Plain-object shape ensures JSON save/load round-trips cleanly.
 */
export interface ActiveRecurringEffect {
    /** Unique stable key matching the source law/deal id — used for dedup and repeal lookup. */
    sourceId: string;
    sourceType: 'law' | 'deal' | 'opportunity' | 'weird-law';
    /** Faction that proposed this law/deal — used to apply the repeal relation penalty. */
    sourceFaction: Power;
    /** i18n key shown in DayEnded and Active Legislation list. */
    label: string;
    /** Added to treasury each round. 0 when n/a. */
    incomeBonus: number;
    /** Subtracted from treasury each round. 0 when n/a. */
    expenseBonus: number;
    /** Round the effect was activated — display-only in iteration 1. */
    roundActivated: number;
}

export type RelationSnapshot = {
    round: number;
    military: number;
    business: number;
    people: number;
};

export type GameStats = {
    lawsPassed: number;
    lawsRejected: number;
    dealsAccepted: number;
    dealsRejected: number;
    totalIncomeEarned: number;
    totalExpensesSpent: number;
    totalExtrasEarned: number;
    totalExtrasSpent: number;
    peakTreasury: number;
    lowestTreasury: number;
    relationsHistory: RelationSnapshot[];
    /** True from the first round a grace coup roll fires; stays true for the rest of the run. */
    coupGraceFired: boolean;
    /** Cumulative recurring income from active laws/deals summed across all rounds. */
    totalRecurringIncomeEarned: number;
    /** Cumulative recurring expenses from active laws/deals summed across all rounds. */
    totalRecurringExpensesSpent: number;
    /** Number of successful repeals the player has performed this run. */
    repealCount: number;
};

export type CameraState = {
    cameraPos: [number, number, number];
    cameraFov: number;
    /** Euler pitch (x) and yaw (y) in radians, applied in CameraController */
    cameraRotation: [number, number];
    cameraTarget?: Vector3;
    cameraPositions: Vector3[];
    cameraTargets: Vector3[];
    currentCameraIndex: number;
    moveCameraTo: (pos: [number, number, number], target?: Vector3) => void;
    cycleCamera: () => void;
    setCameraPositions: (positions: Vector3[], targets?: Vector3[]) => void;
};

export type GamePhase = 'idle' | 'start' | 'event' | 'victory' | 'lose' | 'special_ending';

export type GameState = {
    debug: {
        enabled: boolean;
        fov: number;
        selectorOpen: boolean;
        setDebugMode: (enabled: boolean) => void;
        setFov: (fov: number) => void;
        toggleSelector: () => void;
    },
    scene: {
        camera: CameraState;
    };
    tabs: {
        activeTab: Tabs;
        setActiveTab: (tab: Tabs) => void;
        tabsLocked: boolean;
        secretRoomIndex: number;
    };
    gameManagement: {
        phase: GamePhase;
        difficulty: Difficulty;
        setPhase: (phase: GamePhase, difficulty?: Difficulty) => void;
        round: number,
        endReason: string | null;
        endCause: EndCause;
        dayEnded: boolean;
        lastRoundIncome: number;
        lastRoundExpenses: number;
        /** Recurring income total for the round just ended — written by nextRound(). */
        lastRoundRecurringIncome: number;
        /** Recurring expense total for the round just ended — written by nextRound(). */
        lastRoundRecurringExpenses: number;
        currentRoundExtraIncome: number;
        currentRoundExtraExpenses: number;
        timerStartedAt: number | null;
        timerPausedAt: number | null;
        /** All currently active recurring effects from accepted laws and deals. */
        activeRecurringEffects: ActiveRecurringEffect[];
        /** True after a repeal is used this round; reset to false in nextRound(). */
        repealTakenThisRound: boolean;
        /** True when the START of this round yielded a 'grace' coup result (armed but survived).
         *  A second consecutive armed trigger skips the grace roll and fires immediately. */
        coupArmedLastRound: boolean;
        /** Faction whose relation threshold triggered a coup warning this round; null when safe. */
        coupWarningFaction: Power | null;
        charisma: {
            current: number,
            adjustCharisma: (amount: number) => void;
        };
        meetCounts: Record<Power, number>;
        representativeStatuses: Record<Power, 'active' | 'sick' | 'eliminated'>;
        /** Dumbification score [0–100] frozen at the start of each round from the education budget. */
        dumbScore: number;
        nextRound: () => void;
        expireTimer: () => void;
        pauseTimer: () => void;
        resumeTimer: () => void;
        advanceRoundRequested: boolean;
        requestAdvanceRound: () => void;
        clearAdvanceRoundRequest: () => void;
        saveGame: () => void;
        loadGame: (data: Record<string, unknown>) => void;
        /** Repeal an active recurring law by its sourceId.
         *  Guards: repealTakenThisRound, entry exists, treasury >= tier cost.
         *  On success: deducts treasury, applies relation penalty, removes entry,
         *  sets repealTakenThisRound = true, then runs a bankruptcy check. */
        repeal: (sourceId: string) => void;
    };
    stats: GameStats;
    specialEnding: {
        available: boolean;
        faction: Power | null;
        used: boolean;
        outcome: 'good' | 'bad' | null;
        use: () => void;
    };
    dailyEvent: {
        current: DailyEvent | null;
    };
    periodicEvent: {
        current: PeriodicEvent | null;
        decided: boolean;
        resultKey: string | null;
        resolve: (optionIndex: number) => void;
    };
    miniChallenge: {
        current: MiniChallenge | null;
        decided: boolean;
        resultKey: string | null;
        riskTriggered: boolean;
        resolve: (accepted: boolean) => void;
    };
    meet: {
        selectedPower: Power | 'none';
        actionTaken: { type?: MeetActionType, taken: boolean, power?: Power };
        setSelectedPower: (power: Power) => void;
        takeAction: (power: Power, action: MeetActionType) => void;
        actionOutcomeText: { key: string, params?: Record<string, string | number> } | null;
    },
    budget: {
        treasury: number,
        expenditures: Record<Expenditures, number>;
        taxes: Record<Taxes, number>;
        adjustBudgetItem: (id: Expenditures | Taxes, amount: number) => void;
        adjustTreasury: (amount: number) => void;
    },
    law: {
        current: Law | null,
        interactedWithLaws: Set<Law>,
        lawDecided: boolean;
        lastLawOutcome: boolean | null;
        actUponLaw: (hasAccepted: boolean) => void;
        swapLaw: () => void;
    },
    log: RoundLogEntry[],
    relations: {
        current: Record<Power, number>
        adjustRelations: (p: Power, a: number) => void;
    },
    shop: {
        frozenFactions: Set<Power>;
        statueCount: number;
        buy: (item: ShopItemId) => void;
    };
    deals: {
        current: Deal | null,
        dealDecided: boolean,
        interactedWithDeals: Set<Deal>,
        actUponDeal: (hasAccepted: boolean) => void;
        swapDeal: () => void;
        lastDealOutcome: string[] | null;
        lastDealAccepted: boolean | null;
    };
    tutorial: {
        active: boolean;
        activate: () => void;
        deactivate: () => void;
    };
};