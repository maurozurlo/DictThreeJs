import type { Power } from "../types/Power";
import { Tabs } from "../types/Tabs";

export interface Coup {
    /** Faction relation value that arms the coup trigger (relation ≥ this). */
    RELATION_THRESHOLD: number;
    /** Player charisma value that enables armed factions to strike (charisma ≤ this). */
    CHARISMA_THRESHOLD: number;
    /** Faction relation threshold for the softer yellow warning (relation ≥ this). */
    WARN_RELATION: number;
    /** Player charisma threshold for the yellow warning (charisma ≤ this). */
    WARN_CHARISMA: number;
}

/** Cost entry for repealing an active recurring law at a given tier. */
export interface RepealCostEntry {
    /** Treasury deducted on repeal. */
    treasury: number;
    /** Relation penalty applied to the law's source faction (always negative). */
    relation: number;
}

/** Tiered repeal costs indexed by tier name. */
export interface RepealCost {
    Small: RepealCostEntry;
    Medium: RepealCostEntry;
    Large: RepealCostEntry;
}

export interface GAME_STATE_CONSTANTS {
    ROUNDS: Rounds;
    TABS: TabsConfig;
    MEET: Meet;
    BUDGET: Budget;
    INCOME: Income;
    CHARISMA: Charisma;
    RELATIONS: Relations;
    BUDGET_EFFECTS: BudgetEffects;
    COUP: Coup;
    REPEAL_COST: RepealCost;
    /** Relation score at or above which a faction qualifies for the special ending at round 9. */
    SPECIAL_ENDING_THRESHOLD: number;
    /** Maps each faction to its deterministic 3D secret room index (0-based). */
    FACTION_ROOM_INDEX: PowerKeys;
}

export interface Budget {
    TREASURY: number;
    BOUNDS: Bounds;
    EXPENDITURES: Expenditures;
    TAXES: Taxes;
}

export interface Bounds {
    EXPENDITURE: Expenditure;
    TAX: Expenditure;
}

export interface Expenditure {
    MIN: number;
    MAX: number;
}

export interface Expenditures {
    health: number;
    infrastructure: number;
    security: number;
    education: number;
}

export interface Taxes {
    peopleTaxes: number;
    businessTaxes: number;
}

export interface Charisma {
    INITIAL: number;
    MIN: number;
    MAX: number;
}

export interface Meet {
    ACTIONS: Actions;
}

export interface Actions {
    BRIBE: Bribe;
    EXPROPRIATE: Expropriate;
    DIALOGUE: Dialogue;
}

export interface Dialogue {
    BASE_SUCCESS_RATE: PowerKeys;
}

export interface Bribe {
    COSTS: PowerKeys;
}

export type PowerKeys = Record<Power, number>

export interface Expropriate {
    GAINS: PowerKeys;
}

export interface Relations {
    INITIAL: PowerKeys;
    MIN: number;
    MAX: number;
}

export interface Rounds {
    START: number;
    MAX: number;
    TIME_LENGTH_MS: number;
    /** Minimum time (ms) the after-work hinge's mandatory reveal stage stays
     *  on screen before the advance button becomes available (ADR-0012). */
    MANDATORY_REVEAL_MS: number;
}

export interface TabsConfig {
    START_TAB: Tabs;
}

export interface Income {
    PEOPLE_BASE: number;
    BUSINESS_BASE: number;
    EXPENDITURE_COST_PER_LEVEL: number;
    TAX_PENALTY_PEOPLE_THRESHOLD: number;
    TAX_PENALTY_BUSINESS_THRESHOLD: number;
}

export interface BudgetEffectThreshold {
    LOW: number;
    HIGH: number;
}

export interface BudgetEffects {
    SECURITY: BudgetEffectThreshold;
    HEALTH: BudgetEffectThreshold;
    INFRASTRUCTURE: BudgetEffectThreshold;
}

export const GAMESTATE: GAME_STATE_CONSTANTS = {
    ROUNDS: {
        START: 1,
        MAX: 10,
        TIME_LENGTH_MS: 2 * 60 * 1000,
        MANDATORY_REVEAL_MS: 3000
    },
    TABS: {
        START_TAB: Tabs.Menu
    },
    INCOME: {
        PEOPLE_BASE: 200,
        BUSINESS_BASE: 180,
        EXPENDITURE_COST_PER_LEVEL: 10,
        TAX_PENALTY_PEOPLE_THRESHOLD: 30,
        TAX_PENALTY_BUSINESS_THRESHOLD: 45,
    },
    BUDGET_EFFECTS: {
        SECURITY: { LOW: 3, HIGH: 7 },
        HEALTH: { LOW: 3, HIGH: 7 },
        INFRASTRUCTURE: { LOW: 3, HIGH: 7 },
    },
    MEET: {
        ACTIONS: {
            DIALOGUE: {
                BASE_SUCCESS_RATE: {
                    military: 0.4,
                    business: 0.3,
                    people: 0.8
                }
            },
            BRIBE: {
                COSTS: {
                    military: 60,
                    business: 80,
                    people: 40
                }
            },
            EXPROPRIATE: {
                GAINS: {
                    military: 80,
                    business: 120,
                    people: 30
                }
            }
        },
    },
    BUDGET: {
        TREASURY: 500,
        BOUNDS: {
            EXPENDITURE: {
                MIN: 1,
                MAX: 10
            },
            TAX: {
                MIN: 0,
                MAX: 50
            },
        },
        EXPENDITURES: {
            health: 5,
            infrastructure: 5,
            security: 5,
            education: 5,
        },
        TAXES: {
            peopleTaxes: 30,
            businessTaxes: 40
        }
    },
    CHARISMA: {
        INITIAL: 0,
        MIN: -10,
        MAX: 10
    },
    RELATIONS: {
        INITIAL: {
            military: 0,
            business: 0,
            people: 0
        },
        MIN: -10,
        MAX: 10
    },
    COUP: {
        RELATION_THRESHOLD: 8,
        CHARISMA_THRESHOLD: -3,
        WARN_RELATION: 6,
        WARN_CHARISMA: -2,
    },
    REPEAL_COST: {
        Small:  { treasury: 15, relation: -2 },
        Medium: { treasury: 25, relation: -2 },
        Large:  { treasury: 40, relation: -3 },
    },
    SPECIAL_ENDING_THRESHOLD: 5,
    FACTION_ROOM_INDEX: { military: 0, business: 1, people: 2 },
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Starting treasury for each difficulty level. */
export const DIFFICULTY_TREASURY: Record<Difficulty, number> = {
    easy: 1000,
    medium: 500,
    hard: 150,
} as const;

/**
 * Street tab camera. Grabbed from the 3ds Max PhysCamera001 (middleground/MaxDump).
 * Position + aim converted Max Z-up → engine Y-up; aimed via the target point (the
 * raw Max camera quaternion doesn't map directly — pitch derived from the look
 * vector). fov 50.3 = vertical FOV of the 25.571mm lens on a 35mm frame (Max reports
 * 60° horizontal). It sits 142 u back, so it's a wide vista — the skybox/skyline
 * GLBs fill the frame behind the street. Tune fov live with the debug free-cam
 * mouse-wheel (press I to read the value back).
 *
 * Shared by setActiveTab (manual Street tab click), expireTimer/nextRound
 * (ADR-0012 force-navigate into the after-work hinge), and buildStartState
 * (ADR-0012 round-1 opening — new games start on Street, not locked into a tab).
 */
export const STREET_CAMERA = {
    pos: [8.116, 60.961, 124.141] as [number, number, number],
    fov: 50.3, // fallback vFOV; actual value derived from hFOV + canvas aspect at runtime
    hFov: 60,  // Max PhysCamera001 "Specify FOV" — horizontal; CameraController derives vFOV
    rotation: [-0.4364, 0] as [number, number],
};

/** Camera fov applied to tabs without a dedicated camera (Story 10-2). */
export const DEFAULT_TAB_FOV = 34;

/**
 * Per-tab camera routing consumed by `setActiveTab` (Story 10-2).
 * - `scan`: index into the palace camera positions scanned from the FBX at load
 *   (see MainModel → setCameraPositions).
 * - `fixed`: full static camera (Street vista).
 * - `secret`: SECRET_ROOMS cycling — room choice needs live state, resolved in the store.
 * - `default`: reset fov/rotation, keep the current position.
 */
export type TabCameraConfig =
    | { kind: 'scan'; index: number }
    | { kind: 'fixed'; pos: [number, number, number]; fov: number; hFov?: number; rotation: [number, number] }
    | { kind: 'secret' }
    | { kind: 'default' };

export const TAB_CAMERA: Record<Tabs, TabCameraConfig> = {
    [Tabs.Menu]: { kind: 'default' },
    [Tabs.Log]: { kind: 'default' },
    [Tabs.Meet]: { kind: 'scan', index: 0 },
    [Tabs.Laws]: { kind: 'scan', index: 1 },
    [Tabs.Deals]: { kind: 'default' },
    [Tabs.Budget]: { kind: 'default' },
    [Tabs.Shop]: { kind: 'default' },
    [Tabs.Street]: { kind: 'fixed', ...STREET_CAMERA },
    [Tabs.Secret]: { kind: 'secret' },
};