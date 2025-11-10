import type { Vector3 } from "three";
import type { Tabs } from "./Tabs";
import type { Deal } from "./Deal";
import type { MeetActionType, Power } from "./Power";
import type { Expenditures, Taxes } from "./Budget";
import type { Law } from "./Law";

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
    };
    gameManagement: {
        phase: 'idle' | 'start' | 'event' | 'gameover';
        setPhase: (phase: 'idle' | 'start' | 'event' | 'gameover') => void;
        round: number,
        charisma: {
            current: number,
            adjustCharisma: (amount: number) => void;
        }
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
    log: string[][],
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
    }
};