import type { Deal } from "../types/Deal";
import { RECURRING } from "../Constants/Costs";

// Effects are ModifierSpec[] (ADR-0008 Amendment 2026-06-18) — same timing
// convention as laws (see laws.ts). `risk` stays a separate per-path probability
// field (acceptRisk / rejectRisk); a former direct charisma delta becomes a
// { stat: 'charisma' } spec inside acceptMods (see deal 20).
export const DEALS: Deal[] = [
    {
        id: 1,
        text: 'deals.1.text',
        acceptText: 'deals.1.acceptText',
        rejectText: 'deals.1.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -50, time: 1 },
            { stat: 'military', amount: 2, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: 1, time: 1 },
        ],
        acceptRisk: 0.3,
        riskText: 'deals.1.riskText',
    },
    {
        id: 2,
        text: 'deals.2.text',
        acceptText: 'deals.2.acceptText',
        rejectText: 'deals.2.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 80, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
            { stat: 'people', amount: -2, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: 1, time: 1 },
            { stat: 'business', amount: -1, time: 1 },
        ],
    },
    {
        id: 3,
        text: 'deals.3.text',
        acceptText: 'deals.3.acceptText',
        rejectText: 'deals.3.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -40, time: 1 },
            { stat: 'military', amount: 1, time: 0 },
        ],
        rejectMods: [],
        rejectRisk: 0.2,
        riskText: 'deals.3.riskText',
    },
    {
        id: 4,
        text: 'deals.4.text',
        acceptText: 'deals.4.acceptText',
        rejectText: 'deals.4.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -30, time: 1 },
            { stat: 'people', amount: 2, time: 0 },
        ],
        rejectMods: [],
    },
    {
        id: 5,
        text: 'deals.5.text',
        acceptText: 'deals.5.acceptText',
        rejectText: 'deals.5.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -60, time: 1 },
            { stat: 'military', amount: 2, time: 0 },
            { stat: 'people', amount: -1, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: 1, time: 1 },
        ],
    },
    {
        id: 6,
        text: 'deals.6.text',
        acceptText: 'deals.6.acceptText',
        rejectText: 'deals.6.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -70, time: 1 },
            { stat: 'military', amount: 3, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -2, time: 1 },
        ],
    },
    {
        id: 7,
        text: 'deals.7.text',
        acceptText: 'deals.7.acceptText',
        rejectText: 'deals.7.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 50, time: 1 },
            { stat: 'military', amount: 2, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: 1, time: 1 },
        ],
        acceptRisk: 0.4,
        riskText: 'deals.7.riskText',
    },
    {
        id: 8,
        text: 'deals.8.text',
        acceptText: 'deals.8.acceptText',
        rejectText: 'deals.8.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -30, time: 1 },
            { stat: 'military', amount: -1, time: 0 },
            { stat: 'business', amount: 2, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: 1, time: 1 },
            { stat: 'business', amount: -2, time: 1 },
        ],
    },
    {
        id: 9,
        text: 'deals.9.text',
        acceptText: 'deals.9.acceptText',
        rejectText: 'deals.9.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 100, time: 1 },
            { stat: 'business', amount: 2, time: 0 },
            { stat: 'people', amount: -2, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -2, time: 1 },
        ],
    },
    {
        id: 10,
        text: 'deals.10.text',
        acceptText: 'deals.10.acceptText',
        rejectText: 'deals.10.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 120, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
            { stat: 'military', amount: -1, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: 1, time: 1 },
        ],
    },
    {
        id: 11,
        text: 'deals.11.text',
        acceptText: 'deals.11.acceptText',
        rejectText: 'deals.11.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 40, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
            { stat: 'people', amount: -1, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: 1, time: 1 },
        ],
    },
    {
        id: 12,
        text: 'deals.12.text',
        acceptText: 'deals.12.acceptText',
        rejectText: 'deals.12.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 80, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -2, time: 1 },
            { stat: 'military', amount: -1, time: 1 },
        ],
        acceptRisk: 0.25,
        riskText: 'deals.12.riskText',
    },
    {
        id: 13,
        text: 'deals.13.text',
        acceptText: 'deals.13.acceptText',
        rejectText: 'deals.13.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -20, time: 1 },
            { stat: 'people', amount: 2, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -2, time: 1 },
        ],
    },
    {
        id: 14,
        text: 'deals.14.text',
        acceptText: 'deals.14.acceptText',
        rejectText: 'deals.14.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -60, time: 1 },
            { stat: 'people', amount: 3, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -2, time: 1 },
            { stat: 'military', amount: 1, time: 1 },
        ],
    },
    {
        id: 15,
        text: 'deals.15.text',
        acceptText: 'deals.15.acceptText',
        rejectText: 'deals.15.rejectText',
        acceptMods: [
            { stat: 'people', amount: 1, time: 0 },
            { stat: 'business', amount: 1, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -2, time: 1 },
            { stat: 'business', amount: -1, time: 1 },
        ],
        acceptRisk: 0.3,
        riskText: 'deals.15.riskText',
    },

    // --- Lasting-effect deals (TR-lasting-004, PRD Feature 1 content) ---
    // power is required on recurring deals — repeal targets the proposing faction.
    {
        // D-A: Foreign Investment Contract
        // treasury: 40 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 16,
        text: 'deals.16.text',
        acceptText: 'deals.16.acceptText',
        rejectText: 'deals.16.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 40, time: 1 },
            { stat: 'business', amount: 1, time: 0 },
            { stat: 'roundIncome', amount: RECURRING.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'business', amount: -1, time: 1 },
        ],
        power: 'business',
        label: 'deals.recurring.investment_income',
    },
    {
        // D-B: Arms Supplier Contract
        // treasury: -30 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 17,
        text: 'deals.17.text',
        acceptText: 'deals.17.acceptText',
        rejectText: 'deals.17.rejectText',
        acceptMods: [
            { stat: 'military', amount: 2, time: 0 },
            { stat: 'treasury', amount: -30, time: 1 },
            { stat: 'roundExpense', amount: RECURRING.MEDIUM, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: -1, time: 1 },
        ],
        power: 'military',
        label: 'deals.recurring.arms_cost',
    },
    {
        // D-C: Humanitarian Aid
        id: 18,
        text: 'deals.18.text',
        acceptText: 'deals.18.acceptText',
        rejectText: 'deals.18.rejectText',
        acceptMods: [
            { stat: 'people', amount: 2, time: 0 },
            { stat: 'business', amount: -1, time: 0 },
            { stat: 'roundExpense', amount: RECURRING.SMALL, time: 0 },
        ],
        rejectMods: [
            { stat: 'people', amount: -2, time: 1 },
        ],
        power: 'people',
        label: 'deals.recurring.aid_cost',
    },

    // --- Weird Deals Tier 1 (Story 5-3) ---

    {
        // Deal 19 — Dog-Sized Cow Initiative
        id: 19,
        text: 'deals.19.text',
        acceptText: 'deals.19.acceptText',
        rejectText: 'deals.19.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: 15, time: 1 },
            { stat: 'people', amount: -1, time: 0 },
            { stat: 'roundIncome', amount: RECURRING.TINY, time: 0 },
        ],
        rejectMods: [],
        power: 'people',
        label: 'deals.recurring.cow_income',
    },
    {
        // Deal 20 — Giant National Computer Mouse (no power = not repealable, no recurring)
        id: 20,
        text: 'deals.20.text',
        acceptText: 'deals.20.acceptText',
        rejectText: 'deals.20.rejectText',
        acceptMods: [
            { stat: 'treasury', amount: -50, time: 1 },
            { stat: 'charisma', amount: 2, time: 0 },
        ],
        rejectMods: [],
    },
    {
        // Deal 21 — Strategic Pigeon Surveillance Program
        id: 21,
        text: 'deals.21.text',
        acceptText: 'deals.21.acceptText',
        rejectText: 'deals.21.rejectText',
        acceptMods: [
            { stat: 'military', amount: 1, time: 0 },
            { stat: 'people', amount: -1, time: 0 },
        ],
        rejectMods: [],
        power: 'military',
    },
    {
        // Deal 22 — Swiss Hostage Diplomacy
        id: 22,
        text: 'deals.22.text',
        acceptText: 'deals.22.acceptText',
        rejectText: 'deals.22.rejectText',
        acceptMods: [
            { stat: 'military', amount: -1, time: 0 },
            { stat: 'people', amount: 1, time: 0 },
        ],
        rejectMods: [
            { stat: 'military', amount: 1, time: 1 },
            { stat: 'treasury', amount: -20, time: 1 },
        ],
        power: 'people',
    },
];
