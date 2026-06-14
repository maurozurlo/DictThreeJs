import type { Law } from '../types/Law';

/**
 * Weird law pool (14 laws, Story 5-2).
 * Proposed by faction "???" — no relation penalty on reject.
 * All effects are one-time (no recurringEffect).
 * power: 'people' is a placeholder — never used for repeal penalty.
 */
export const WEIRD_LAWS: Law[] = [
    {
        id: 1001,
        type: 'weird',
        power: 'people',
        acceptEffect: { treasury: 10, business: 1 },
        rejectEffect: {},
    },
    {
        id: 1002,
        type: 'weird',
        power: 'people',
        acceptEffect: { people: 1, treasury: -10 },
        rejectEffect: {},
    },
    {
        id: 1003,
        type: 'weird',
        power: 'people',
        acceptEffect: { business: 1, people: -1 },
        rejectEffect: {},
    },
    {
        id: 1004,
        type: 'weird',
        power: 'people',
        acceptEffect: { people: 1 },
        rejectEffect: {},
        charismaEffect: 1,
    },
    {
        id: 1005,
        type: 'weird',
        power: 'people',
        acceptEffect: { treasury: 20, business: 1 },
        rejectEffect: {},
    },
    {
        id: 1006,
        type: 'weird',
        power: 'people',
        acceptEffect: { business: 1, people: -1 },
        rejectEffect: {},
    },
    {
        id: 1007,
        type: 'weird',
        power: 'people',
        acceptEffect: { people: 1 },
        rejectEffect: {},
    },
    {
        id: 1008,
        type: 'weird',
        power: 'people',
        acceptEffect: { military: 1 },
        rejectEffect: {},
    },
    {
        id: 1009,
        type: 'weird',
        power: 'people',
        acceptEffect: { people: 1, business: -1 },
        rejectEffect: {},
    },
    {
        id: 1010,
        type: 'weird',
        power: 'people',
        acceptEffect: { treasury: 10 },
        rejectEffect: {},
    },
    {
        id: 1011,
        type: 'weird',
        power: 'people',
        acceptEffect: { people: 1, business: -1 },
        rejectEffect: {},
    },
    {
        id: 1012,
        type: 'weird',
        power: 'people',
        acceptEffect: {},
        rejectEffect: {},
        charismaEffect: 1,
    },
    {
        id: 1013,
        type: 'weird',
        power: 'people',
        acceptEffect: { military: 1, people: -1 },
        rejectEffect: {},
    },
    {
        id: 1014,
        type: 'weird',
        power: 'people',
        acceptEffect: { people: 1, business: 1 },
        rejectEffect: {},
    },
];
