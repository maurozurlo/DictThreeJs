import type { Power } from "../types/Power";
import { Tabs } from "../types/Tabs";

export interface GAME_STATE_CONSTANTS {
    ROUNDS: Rounds;
    TABS: TabsConfig;
    MEET: Meet;
    BUDGET: Budget;
    CHARISMA: Charisma;
    RELATIONS: Relations;
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
    EXPROPIATE: Expropiate;
    DIALOGUE: Dialogue;
}

export interface Dialogue {
    BASE_SUCCESS_RATE: PowerKeys;
}

export interface Bribe {
    COSTS: PowerKeys;
}

export type PowerKeys = Record<Power, number>

export interface Expropiate {
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
    TIME_LENGHT_MS: number;
}

export interface TabsConfig {
    START_TAB: Tabs;
}

export const GAMESTATE: GAME_STATE_CONSTANTS = {
    ROUNDS: {
        START: 1,
        MAX: 10,
        TIME_LENGHT_MS: 5 * 60 * 1000
    },
    TABS: {
        START_TAB: Tabs.Log
    },
    MEET: {
        ACTIONS: {
            DIALOGUE: {
                BASE_SUCCESS_RATE: {
                    military: 0.4,
                    business: 0.2,
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
            EXPROPIATE: {
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
            health: 1,
            infrastructure: 1,
            security: 1,
            education: 1,
        },
        TAXES: {
            peopleTaxes: 20,
            businessTaxes: 30

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
    }
}