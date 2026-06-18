import { COSTS, GAINS, RECURRING } from "../Constants/Costs";
import type { Law } from "../types/Law";

// All effects are ModifierSpec[] (ADR-0008 Amendment 2026-06-18). Convention:
//   accept relation/budget-slider specs → time:0 (permanent modifier, removed on repeal)
//   accept treasury spec                → time:1 (applied in the accepting round's nextRound())
//   accept recurring income/expense     → roundIncome/roundExpense, time:0 (permanent)
//   reject specs                        → time:1 (one-round; applied as base mutation by actUponLaw)
export const LAWS: Law[] = [
    // --- Military ---
    {
        id: 0,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'securitySpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 1,
        power: "military",
        acceptMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.MEDIUM, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 2,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'securitySpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 3,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 4,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
            { stat: 'securitySpend', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.MEDIUM, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 5,
        power: "military",
        acceptMods: [
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'educationSpend', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 6,
        power: "military",
        acceptMods: [
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 7,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 8,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'securitySpend', amount: GAINS.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 9,
        power: "military",
        acceptMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 10,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 11,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 12,
        power: "military",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.SMALL, time: 1 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
        ],
    },

    // --- Business ---
    {
        id: 13,
        power: "business",
        acceptMods: [
            { stat: 'businessTaxes', amount: -GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 14,
        power: "business",
        acceptMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'businessTaxes', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 15,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 16,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.LARGE, time: 1 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 17,
        power: "business",
        acceptMods: [
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 18,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'business', amount: GAINS.MEDIUM, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 19,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 20,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: COSTS.LARGE, time: 1 },
            { stat: 'business', amount: GAINS.MEDIUM, time: 0 },
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'military', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 21,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'military', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 22,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'businessTaxes', amount: -GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 23,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.SMALL, time: 0 },
            { stat: 'military', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 24,
        power: "business",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'military', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 25,
        power: "business",
        acceptMods: [
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
    },

    // --- People ---
    {
        id: 26,
        power: "people",
        acceptMods: [
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'treasury', amount: -COSTS.LARGE, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 27,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'healthSpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 28,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'educationSpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
            { stat: 'military', amount: -GAINS.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 29,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: GAINS.SMALL, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'securitySpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 30,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.LARGE, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 31,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 32,
        power: "people",
        acceptMods: [
            { stat: 'business', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'businessTaxes', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 33,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 34,
        power: "people",
        acceptMods: [
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'military', amount: -GAINS.SMALL, time: 0 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 35,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 36,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'healthSpend', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 37,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },
    {
        id: 38,
        power: "people",
        acceptMods: [
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'business', amount: -GAINS.SMALL, time: 0 },
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'infrastructureSpend', amount: GAINS.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
    },

    // --- Lasting-effect laws (TR-lasting-004, PRD Feature 1 content) ---
    // Income laws (L-A, L-D, L-E) carry people -GAINS.MEDIUM on accept — the
    // no-cap mitigation requires -2 to the opposing faction, not the default -1.
    {
        // L-A: Legalize Gambling
        id: 39,
        power: "business",
        acceptMods: [
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'roundIncome', amount: RECURRING.LARGE, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
        label: 'laws.recurring.gambling_income',
    },
    {
        // L-B: Free Housing Program
        // treasury: -30 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 40,
        power: "people",
        acceptMods: [
            { stat: 'people', amount: GAINS.MEDIUM, time: 0 },
            { stat: 'treasury', amount: -30, time: 1 },
            { stat: 'roundExpense', amount: RECURRING.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
        label: 'laws.recurring.housing_cost',
    },
    {
        // L-C: Military Contractor Deal
        id: 41,
        power: "military",
        acceptMods: [
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'treasury', amount: -COSTS.MEDIUM, time: 1 },
            { stat: 'roundExpense', amount: RECURRING.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'business', amount: GAINS.SMALL, time: 1 },
        ],
        label: 'laws.recurring.contractor_cost',
    },
    {
        // L-D: State Media Monopoly
        id: 42,
        power: "military",
        acceptMods: [
            { stat: 'military', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'roundIncome', amount: RECURRING.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
        label: 'laws.recurring.media_income',
    },
    {
        // L-E: Export Tariff Reform
        id: 43,
        power: "business",
        acceptMods: [
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'people', amount: -GAINS.MEDIUM, time: 0 },
            { stat: 'roundIncome', amount: RECURRING.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -GAINS.SMALL, time: 1 },
            { stat: 'people', amount: GAINS.SMALL, time: 1 },
        ],
        label: 'laws.recurring.tariff_income',
    },
    {
        // L-F: Public Works Program
        // treasury: -30 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 44,
        power: "people",
        acceptMods: [
            { stat: 'people', amount: GAINS.SMALL, time: 0 },
            { stat: 'business', amount: GAINS.SMALL, time: 0 },
            { stat: 'treasury', amount: -30, time: 1 },
            { stat: 'roundExpense', amount: RECURRING.LARGE, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -GAINS.SMALL, time: 1 },
            { stat: 'military', amount: GAINS.SMALL, time: 1 },
        ],
        label: 'laws.recurring.public_works_cost',
    },
];
