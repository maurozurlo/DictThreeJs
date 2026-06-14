import type { Deal } from "../types/Deal";
import { RECURRING } from "../Constants/Costs";

export const DEALS: Deal[] = [
    {
        id: 1,
        text: 'deals.1.text',
        acceptText: 'deals.1.acceptText',
        rejectText: 'deals.1.rejectText',
        acceptEffect: { treasury: -50, military: 2, risk: 0.3 },
        rejectEffect: { military: 1 },
        riskText: 'deals.1.riskText'
    },
    {
        id: 2,
        text: 'deals.2.text',
        acceptText: 'deals.2.acceptText',
        rejectText: 'deals.2.rejectText',
        acceptEffect: { treasury: 80, business: 1, people: -2 },
        rejectEffect: { people: 1, business: -1 }
    },
    {
        id: 3,
        text: 'deals.3.text',
        acceptText: 'deals.3.acceptText',
        rejectText: 'deals.3.rejectText',
        acceptEffect: { treasury: -40, military: 1 },
        rejectEffect: { risk: 0.2 },
        riskText: 'deals.3.riskText'
    },
    {
        id: 4,
        text: 'deals.4.text',
        acceptText: 'deals.4.acceptText',
        rejectText: 'deals.4.rejectText',
        acceptEffect: { treasury: -30, people: 2 },
        rejectEffect: { people: 0 }
    },
    {
        id: 5,
        text: 'deals.5.text',
        acceptText: 'deals.5.acceptText',
        rejectText: 'deals.5.rejectText',
        acceptEffect: { treasury: -60, military: 2, people: -1 },
        rejectEffect: { people: 1 }
    },
    {
        id: 6,
        text: 'deals.6.text',
        acceptText: 'deals.6.acceptText',
        rejectText: 'deals.6.rejectText',
        acceptEffect: { treasury: -70, military: 3 },
        rejectEffect: { military: -2 }
    },
    {
        id: 7,
        text: 'deals.7.text',
        acceptText: 'deals.7.acceptText',
        rejectText: 'deals.7.rejectText',
        acceptEffect: { treasury: 50, military: 2, risk: 0.4 },
        rejectEffect: { military: 1 },
        riskText: 'deals.7.riskText'
    },
    {
        id: 8,
        text: 'deals.8.text',
        acceptText: 'deals.8.acceptText',
        rejectText: 'deals.8.rejectText',
        acceptEffect: { treasury: -30, military: -1, business: 2 },
        rejectEffect: { military: 1, business: -2 }
    },
    {
        id: 9,
        text: 'deals.9.text',
        acceptText: 'deals.9.acceptText',
        rejectText: 'deals.9.rejectText',
        acceptEffect: { treasury: 100, business: 2, people: -2 },
        rejectEffect: { business: -2 }
    },
    {
        id: 10,
        text: 'deals.10.text',
        acceptText: 'deals.10.acceptText',
        rejectText: 'deals.10.rejectText',
        acceptEffect: { treasury: 120, business: 1, military: -1 },
        rejectEffect: { business: 1 }
    },
    {
        id: 11,
        text: 'deals.11.text',
        acceptText: 'deals.11.acceptText',
        rejectText: 'deals.11.rejectText',
        acceptEffect: { treasury: 40, business: 1, people: -1 },
        rejectEffect: { people: 1 }
    },
    {
        id: 12,
        text: 'deals.12.text',
        acceptText: 'deals.12.acceptText',
        rejectText: 'deals.12.rejectText',
        acceptEffect: { treasury: 80, business: 1, risk: 0.25 },
        rejectEffect: { business: -2, military: -1 },
        riskText: 'deals.12.riskText'
    },
    {
        id: 13,
        text: 'deals.13.text',
        acceptText: 'deals.13.acceptText',
        rejectText: 'deals.13.rejectText',
        acceptEffect: { treasury: -20, people: 2 },
        rejectEffect: { people: -2 }
    },
    {
        id: 14,
        text: 'deals.14.text',
        acceptText: 'deals.14.acceptText',
        rejectText: 'deals.14.rejectText',
        acceptEffect: { treasury: -60, people: 3 },
        rejectEffect: { people: -2, military: 1 }
    },
    {
        id: 15,
        text: 'deals.15.text',
        acceptText: 'deals.15.acceptText',
        rejectText: 'deals.15.rejectText',
        acceptEffect: { people: 1, business: 1, risk: 0.3 },
        rejectEffect: { people: -2, business: -1 },
        riskText: 'deals.15.riskText'
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
        acceptEffect: { treasury: 40, business: 1 },
        rejectEffect: { business: -1 },
        power: 'business',
        recurringEffect: { incomeBonus: RECURRING.MEDIUM, label: 'deals.recurring.investment_income' }
    },
    {
        // D-B: Arms Supplier Contract
        // treasury: -30 — deliberately between COSTS.MEDIUM (20) and COSTS.LARGE (50); no matching tier constant.
        id: 17,
        text: 'deals.17.text',
        acceptText: 'deals.17.acceptText',
        rejectText: 'deals.17.rejectText',
        acceptEffect: { military: 2, treasury: -30 },
        rejectEffect: { military: -1 },
        power: 'military',
        recurringEffect: { expenseBonus: RECURRING.MEDIUM, label: 'deals.recurring.arms_cost' }
    },
    {
        // D-C: Humanitarian Aid
        id: 18,
        text: 'deals.18.text',
        acceptText: 'deals.18.acceptText',
        rejectText: 'deals.18.rejectText',
        acceptEffect: { people: 2, business: -1 },
        rejectEffect: { people: -2 },
        power: 'people',
        recurringEffect: { expenseBonus: RECURRING.SMALL, label: 'deals.recurring.aid_cost' }
    },

    // --- Weird Deals Tier 1 (Story 5-3) ---

    {
        // Deal 19 — Dog-Sized Cow Initiative
        id: 19,
        text: 'deals.19.text',
        acceptText: 'deals.19.acceptText',
        rejectText: 'deals.19.rejectText',
        acceptEffect: { treasury: 15, people: -1 },
        rejectEffect: {},
        power: 'people',
        recurringEffect: { incomeBonus: RECURRING.TINY, label: 'deals.recurring.cow_income' }
    },
    {
        // Deal 20 — Giant National Computer Mouse (no power = not repealable, no recurring)
        id: 20,
        text: 'deals.20.text',
        acceptText: 'deals.20.acceptText',
        rejectText: 'deals.20.rejectText',
        acceptEffect: { treasury: -50 },
        rejectEffect: {},
        charismaEffect: 2
    },
    {
        // Deal 21 — Strategic Pigeon Surveillance Program
        id: 21,
        text: 'deals.21.text',
        acceptText: 'deals.21.acceptText',
        rejectText: 'deals.21.rejectText',
        acceptEffect: { military: 1, people: -1 },
        rejectEffect: {},
        power: 'military'
    },
    {
        // Deal 22 — Swiss Hostage Diplomacy
        id: 22,
        text: 'deals.22.text',
        acceptText: 'deals.22.acceptText',
        rejectText: 'deals.22.rejectText',
        acceptEffect: { military: -1, people: 1 },
        rejectEffect: { military: 1, treasury: -20 },
        power: 'people'
    }
];
