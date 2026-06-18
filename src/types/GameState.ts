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
import type { Citizen, CitizenState } from "./Citizen";

export type RoundLogEntry = {
    date: string;
    lines: string[];
};

export type ShopItemId = 'media_coverage' | 'media_shielding' | 'media_blackout' | 'statue' | 'advisor_1' | 'advisor_2' | 'advisor_3';
export type AdvisorLevel = 0 | 1 | 2 | 3;

export type EndCause = 'military' | 'business' | 'people' | 'bankruptcy' | 'military_coup' | 'business_coup' | 'people_coup' | null;

/**
 * Read-through stats a modifier can influence (ADR-0008 §4). Charisma and the
 * three relations sum on read and are re-clamped to ±10; roundIncome/roundExpense
 * feed per-round economics (replaces ActiveRecurringEffect in P2). One-shot
 * treasury/risk/budget deltas are NOT modeled here — they stay base mutations.
 */
export type ModifierStat =
    | 'charisma'
    | 'military' | 'business' | 'people'
    | 'roundIncome' | 'roundExpense';

/**
 * Discriminator for cheap filter/findIndex (ADR-0008 §4). Drives the weird-law
 * "one active" slot, law-pool exclusion, and the repeal list.
 */
export type ModifierType =
    | 'statue' | 'structure' | 'media'
    | 'deal' | 'opportunity' | 'mini-challenge'
    | 'law-recurring' | 'weird-law' | 'unknown';

/**
 * A contribution's active window, resolved to concrete rounds at acquisition
 * from a TimeModifier (ADR-0008 §2). `endRound: null` = permanent. Activity is
 * derived on read via isWindowActive (exclusive upper bound) — never stored.
 */
export interface ResolvedWindow {
    startRound: number;
    endRound: number | null;
}

/**
 * A single stat contribution within a modifier, with its own resolved timing
 * (ADR-0008 §3 — per-StatMod timing lets one deal carry delayed income AND a
 * one-round relation bump together).
 */
export interface ResolvedStatMod {
    stat: ModifierStat;
    amount: number;
    window: ResolvedWindow;
}

/**
 * A run-scoped modifier and decision-ledger entry (ADR-0008 §4). Contributes to
 * derived stats in real time (effective = base + Σ in-window active mods, never
 * eroded). Carries no content/display fields — the label and any narrative
 * headline live on the content asset and are looked up by `id`.
 */
export interface Modifier {
    /** Namespaced id — e.g. 'deals.1', 'laws.5', 'weird.1001', 'statue.0'. Dedup + content-lookup key. */
    id: string;
    type: ModifierType;
    /** Lifecycle/ledger: 'active' contributes; 'rejected' is retained history, never summed. No 'expired'. */
    state: 'active' | 'rejected';
    acquiredRound: number;
    /** Resolved at acquisition — the round the content-defined headline fires (if any). */
    onStartTriggerRound?: number;
    /** Fire-once guard across save/load. */
    onStartFired?: boolean;
    mods: ResolvedStatMod[];
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
        /**
         * Single source of truth for recurring/windowed effects and the decision
         * ledger (ADR-0008): statues, recurring laws/deals, weird-law slots. Feeds
         * derived stats (charisma/relations) and per-round income/expense in real time.
         */
        modifiers: Modifier[];
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
        /** Seed the run's PRNG was initialized with at new-game (ADR-0010). Informational /
         *  shareable; the live cursor is serialized separately by SaveLoad.buildSavePayload. */
        rngSeed: number;
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
        advisorLevel: AdvisorLevel;
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
    /**
     * Immutable citizen identities — generated once at game start via
     * `buildCitizenRoster()` and restored as-is from save payload (Story 7-1).
     * Parallel-indexed with `citizenStates`; never mutated after generation.
     */
    citizens: Citizen[];
    /**
     * Per-round mutable citizen state — recomputed by CitizenHandler P2/P3
     * each round. Parallel-indexed with `citizens`. Updated atomically within
     * the `nextRound()` set() call (ADR-0002).
     */
    citizenStates: CitizenState[];
};