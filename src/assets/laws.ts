import { COSTS, GAINS, RECURRING } from "../Constants/Costs";
import type { Law } from "../types/Law";

export const LAWS: Law[] = [
    // --- Military ---
    {
        id: 0,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, security: GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 1,
        power: "military",
        acceptEffect: { people: -GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.MEDIUM, business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 2,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, security: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 3,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 4,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, business: -GAINS.SMALL, security: GAINS.SMALL },
        rejectEffect: { military: -GAINS.MEDIUM, people: GAINS.SMALL }
    },
    {
        id: 5,
        power: "military",
        acceptEffect: { military: GAINS.SMALL, people: -GAINS.MEDIUM, education: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 6,
        power: "military",
        acceptEffect: { military: GAINS.SMALL, business: -GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 7,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },
    {
        id: 8,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, security: GAINS.MEDIUM },
        rejectEffect: { military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 9,
        power: "military",
        acceptEffect: { people: -GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },
    {
        id: 10,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: -GAINS.SMALL }
    },
    {
        id: 11,
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },
    {
        id: 12,
        power: "military",
        acceptEffect: { treasury: -COSTS.SMALL, people: -GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },

    // --- Business ---
    {
        id: 13,
        power: "business",
        acceptEffect: { businessTaxes: -GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 14,
        power: "business",
        acceptEffect: { people: -GAINS.SMALL, business: GAINS.SMALL, businessTaxes: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 15,
        power: "business",
        acceptEffect: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: -GAINS.SMALL }
    },
    {
        id: 16,
        power: "business",
        acceptEffect: { treasury: -COSTS.LARGE, people: -GAINS.SMALL, business: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 17,
        power: "business",
        acceptEffect: { people: -GAINS.MEDIUM, business: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 18,
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, business: GAINS.MEDIUM, people: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 19,
        power: "business",
        acceptEffect: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 20,
        power: "business",
        acceptEffect: { treasury: COSTS.LARGE, business: GAINS.MEDIUM, people: -GAINS.MEDIUM, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 21,
        power: "business",
        acceptEffect: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 22,
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, businessTaxes: -GAINS.SMALL, people: -GAINS.SMALL, business: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 23,
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, business: GAINS.SMALL, people: -GAINS.SMALL, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 24,
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, business: GAINS.SMALL, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 25,
        power: "business",
        acceptEffect: { business: GAINS.SMALL, people: -GAINS.MEDIUM, military: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: -GAINS.SMALL, people: GAINS.SMALL }
    },

    // --- People ---
    {
        id: 26,
        power: "people",
        acceptEffect: { people: GAINS.SMALL, treasury: -COSTS.LARGE, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 27,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, health: GAINS.SMALL, people: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 28,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, education: GAINS.SMALL, people: GAINS.SMALL, business: -GAINS.SMALL, military: -GAINS.MEDIUM },
        rejectEffect: { people: -GAINS.SMALL, business: -GAINS.SMALL, military: -GAINS.SMALL }
    },
    {
        id: 29,
        power: "people",
        acceptEffect: { treasury: GAINS.SMALL, business: -GAINS.SMALL, people: GAINS.SMALL, security: GAINS.SMALL, infrastructure: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 30,
        power: "people",
        acceptEffect: { treasury: -COSTS.LARGE, people: GAINS.SMALL, military: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 31,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, infrastructure: GAINS.SMALL, military: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 32,
        power: "people",
        acceptEffect: { business: -GAINS.MEDIUM, people: GAINS.SMALL, businessTaxes: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 33,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, infrastructure: GAINS.SMALL, people: GAINS.SMALL, business: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: -GAINS.SMALL }
    },
    {
        id: 34,
        power: "people",
        acceptEffect: { people: GAINS.SMALL, business: GAINS.SMALL, military: -GAINS.SMALL, infrastructure: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: -GAINS.SMALL }
    },
    {
        id: 35,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, infrastructure: GAINS.SMALL, people: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 36,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, health: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 37,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, military: GAINS.SMALL, infrastructure: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 38,
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, business: -GAINS.SMALL, people: GAINS.SMALL, infrastructure: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },

    // --- Lasting-effect laws (TR-lasting-004, PRD Feature 1 content) ---
    // Income laws (L-A, L-D, L-E) carry people -GAINS.MEDIUM on accept — the
    // no-cap mitigation requires -2 to the opposing faction, not the default -1.
    {
        // L-A: Legalize Gambling
        id: 39,
        power: "business",
        acceptEffect: { business: GAINS.SMALL, people: -GAINS.MEDIUM },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL },
        recurringEffect: { incomeBonus: RECURRING.LARGE, label: 'laws.recurring.gambling_income' }
    },
    {
        // L-B: Free Housing Program
        // treasury: -30 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 40,
        power: "people",
        acceptEffect: { people: GAINS.MEDIUM, treasury: -30 },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL },
        recurringEffect: { expenseBonus: RECURRING.MEDIUM, label: 'laws.recurring.housing_cost' }
    },
    {
        // L-C: Military Contractor Deal
        id: 41,
        power: "military",
        acceptEffect: { military: GAINS.SMALL, treasury: -COSTS.MEDIUM },
        rejectEffect: { military: -GAINS.SMALL, business: GAINS.SMALL },
        recurringEffect: { expenseBonus: RECURRING.MEDIUM, label: 'laws.recurring.contractor_cost' }
    },
    {
        // L-D: State Media Monopoly
        id: 42,
        power: "military",
        acceptEffect: { military: GAINS.SMALL, people: -GAINS.MEDIUM },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL },
        recurringEffect: { incomeBonus: RECURRING.MEDIUM, label: 'laws.recurring.media_income' }
    },
    {
        // L-E: Export Tariff Reform
        id: 43,
        power: "business",
        acceptEffect: { business: GAINS.SMALL, people: -GAINS.MEDIUM },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL },
        recurringEffect: { incomeBonus: RECURRING.MEDIUM, label: 'laws.recurring.tariff_income' }
    },
    {
        // L-F: Public Works Program
        // treasury: -30 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 44,
        power: "people",
        acceptEffect: { people: GAINS.SMALL, business: GAINS.SMALL, treasury: -30 },
        rejectEffect: { people: -GAINS.SMALL, military: GAINS.SMALL },
        recurringEffect: { expenseBonus: RECURRING.LARGE, label: 'laws.recurring.public_works_cost' }
    }
];
