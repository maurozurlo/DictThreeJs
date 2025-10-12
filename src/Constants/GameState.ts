import { Tabs } from "../types/Tabs";

export const GAMESTATE = {
    ROUNDS: {
        START: 1,
        MAX: 10,
        TIME_LENGHT_MS: 5 * 60 * 1000
    },
    TABS: {
        START_TAB: Tabs.Menu
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
            people: 20,
            business: 30

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