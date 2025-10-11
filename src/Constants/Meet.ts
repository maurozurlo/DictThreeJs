import type { Power } from "../types/Power";

export const MEET_VALUES: Record<Exclude<Power, 'none'>, {
    bribe: number;
    expropiate: number;
    base_dialogue_success_rate: number
}> = {
    "company": {
        bribe: 80,
        expropiate: 120,
        base_dialogue_success_rate: .2 // 0 - 1
    },
    "people": {
        bribe: 40,
        expropiate: 30,
        base_dialogue_success_rate: .8
    },
    'military': {
        bribe: 60,
        expropiate: 80,
        base_dialogue_success_rate: .4
    }
}