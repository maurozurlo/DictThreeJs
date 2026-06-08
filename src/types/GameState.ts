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

export type CameraState = {
    cameraPos: [number, number, number];
    cameraTarget?: Vector3;
    cameraPositions: Vector3[];
    cameraTargets: Vector3[];
    currentCameraIndex: number;
    moveCameraTo: (pos: [number, number, number], target?: Vector3) => void;
    cycleCamera: () => void;
    setCameraPositions: (positions: Vector3[], targets?: Vector3[]) => void;
};

export type GamePhase = 'idle' | 'start' | 'event' | 'victory' | 'lose';

export type GameState = {
    debug: {
        enabled: boolean;
        setDebugMode: (enabled: boolean) => void;
    },
    scene: {
        camera: CameraState;
    };
    tabs: {
        activeTab: Tabs;
        setActiveTab: (tab: Tabs) => void;
        tabsLocked: boolean;
    };
    gameManagement: {
        phase: GamePhase;
        setPhase: (phase: GamePhase) => void;
        round: number,
        endReason: string | null;
        dayEnded: boolean;
        lastRoundIncome: number;
        lastRoundExpenses: number;
        timerStartedAt: number | null;
        charisma: {
            current: number,
            adjustCharisma: (amount: number) => void;
        };
        nextRound: () => void;
        expireTimer: () => void;
        saveGame: () => void;
        loadGame: (data: Record<string, unknown>) => void;
    };
    dailyEvent: {
        current: DailyEvent | null;
    };
    periodicEvent: {
        current: PeriodicEvent | null;
        decided: boolean;
        resultText: string | null;
        resolve: (optionIndex: number) => void;
    };
    miniChallenge: {
        current: MiniChallenge | null;
        decided: boolean;
        resultText: string | null;
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
    deals: {
        current: Deal | null,
        dealDecided: boolean,
        interactedWithDeals: Set<Deal>,
        actUponDeal: (hasAccepted: boolean) => void;
        lastDealOutcome: string | null;
        lastDealAccepted: boolean | null;
    }
};