import type { Vector3 } from "three";
import type { Tabs } from "./Tabs";
import type { Deal } from "./Deal";
import type { MeetActionType, Power } from "./Power";
import type { Expenditures, Taxes } from "./Budget";
import type { Law } from "./Law";
import type { PeriodicEvent } from "./PeriodicEvent";
import type { MiniChallenge } from "./MiniChallenge";
import type { DailyEvent } from "./DailyEvent";

export type RoundLogEntry = {
    date: string;
    lines: string[];
};

export type ShopItemId = 'media_coverage' | 'media_shielding' | 'media_blackout' | 'statue';

export type EndCause = 'military' | 'business' | 'people' | 'bankruptcy' | null;

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
        setDebugMode: (enabled: boolean) => void;
        setFov: (fov: number) => void;
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
        setPhase: (phase: GamePhase) => void;
        round: number,
        endReason: string | null;
        endCause: EndCause;
        dayEnded: boolean;
        lastRoundIncome: number;
        lastRoundExpenses: number;
        currentRoundExtraIncome: number;
        currentRoundExtraExpenses: number;
        timerStartedAt: number | null;
        timerPausedAt: number | null;
        charisma: {
            current: number,
            adjustCharisma: (amount: number) => void;
        };
        meetCounts: Record<Power, number>;
        nextRound: () => void;
        expireTimer: () => void;
        advanceRoundRequested: boolean;
        requestAdvanceRound: () => void;
        clearAdvanceRoundRequest: () => void;
        saveGame: () => void;
        loadGame: (data: Record<string, unknown>) => void;
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
    },
    law: {
        current: Law | null,
        interactedWithLaws: Set<Law>,
        lawDecided: boolean;
        lastLawOutcome: boolean | null;
        actUponLaw: (hasAccepted: boolean) => void;
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
        lastDealOutcome: string | null;
        lastDealAccepted: boolean | null;
    }
};