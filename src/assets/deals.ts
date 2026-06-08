import type { Deal } from "../types/Deal";

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
        rejectEffect: { military: -1 }
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
        rejectEffect: { military: 1, business: -1 }
    },
    {
        id: 9,
        text: 'deals.9.text',
        acceptText: 'deals.9.acceptText',
        rejectText: 'deals.9.rejectText',
        acceptEffect: { treasury: 100, business: 2, people: -2 },
        rejectEffect: { business: -1 }
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
        rejectEffect: { business: -1 },
        riskText: 'deals.12.riskText'
    },
    {
        id: 13,
        text: 'deals.13.text',
        acceptText: 'deals.13.acceptText',
        rejectText: 'deals.13.rejectText',
        acceptEffect: { treasury: -20, people: 2 },
        rejectEffect: { people: -1 }
    },
    {
        id: 14,
        text: 'deals.14.text',
        acceptText: 'deals.14.acceptText',
        rejectText: 'deals.14.rejectText',
        acceptEffect: { treasury: -60, people: 3 },
        rejectEffect: { people: -1, military: 1 }
    },
    {
        id: 15,
        text: 'deals.15.text',
        acceptText: 'deals.15.acceptText',
        rejectText: 'deals.15.rejectText',
        acceptEffect: { people: 1, business: 1, risk: 0.3 },
        rejectEffect: { people: -1 },
        riskText: 'deals.15.riskText'
    }
];
