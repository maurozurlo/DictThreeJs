export const DEALS = [
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
    }
];
