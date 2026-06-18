import type { Law } from '../types/Law';

/**
 * Weird law pool (14 laws, Story 5-2).
 * Proposed by faction "???" — no relation penalty on reject.
 * All effects are one-time (ADR-0008 class A): `actUponLaw`'s weird path applies
 * `acceptMods` as immediate base mutations and records an empty-mods ledger/slot
 * modifier — so the `time` values are nominal (the weird path ignores windows).
 * power: 'people' is a placeholder — never used for repeal penalty.
 */
export const WEIRD_LAWS: Law[] = [
    {
        id: 1001,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'treasury', amount: 10, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1002,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
            { stat: 'treasury', amount: -10, time: 1 },
        ],
        rejectMods: [],
    },
    {
        id: 1003,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'business', amount: 1, time: 0 },
            { stat: 'people', amount: -1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1004,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
            { stat: 'charisma', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1005,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'treasury', amount: 20, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1006,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'business', amount: 1, time: 0 },
            { stat: 'people', amount: -1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1007,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1008,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'military', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1009,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
            { stat: 'business', amount: -1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1010,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'treasury', amount: 10, time: 1 },
        ],
        rejectMods: [],
    },
    {
        id: 1011,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
            { stat: 'business', amount: -1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1012,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'charisma', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1013,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'military', amount: 1, time: 0 },
            { stat: 'people', amount: -1, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 1014,
        type: 'weird',
        power: 'people',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
            { stat: 'business', amount: 1, time: 0 },
        ],
        rejectMods: [],
    },
];
