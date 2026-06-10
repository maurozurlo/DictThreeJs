import type { PeriodicEvent } from "../types/PeriodicEvent";

export const PERIODIC_EVENTS: PeriodicEvent[] = [
    {
        id: "international_summit",
        round: 3,
        title: "International Summit",
        text: "World leaders are watching your performance. Choose your approach:",
        options: [
            {
                id: "host_lavish",
                text: "Host lavish summit ($100M)",
                effect: { treasury: -100, military: 1, business: 1, people: -1 },
                result: "The summit was impressive but expensive. International prestige gained."
            },
            {
                id: "modest_meeting",
                text: "Modest diplomatic meeting ($30M)",
                effect: { treasury: -30, people: 1 },
                result: "A reasonable diplomatic approach. Modest costs, modest gains."
            },
            {
                id: "skip",
                text: "Skip the summit (Free)",
                effect: { military: -1, business: -1 },
                result: "You avoided the summit. Saved money but damaged international relations."
            }
        ]
    },
    {
        id: "economic_crisis",
        round: 6,
        title: "Economic Crisis",
        text: "A financial crisis hits the nation. How do you respond?",
        options: [
            {
                id: "stimulus",
                text: "Massive stimulus package ($150M)",
                effect: { treasury: -150, business: 3, people: 2 },
                result: "The stimulus worked! Economy stabilized and public confidence restored."
            },
            {
                id: "bailouts",
                text: "Targeted business bailouts ($80M)",
                effect: { treasury: -80, business: 2, people: -1 },
                result: "Businesses recovered but people felt abandoned during the crisis."
            },
            {
                id: "free_market",
                text: "Let market forces decide (Free)",
                effect: { business: -2, people: -2, military: 1 },
                result: "The crisis deepened. Only the military appreciated your 'tough' stance."
            }
        ]
    },
    {
        id: "natural_disaster",
        round: 9,
        title: "Natural Disaster",
        text: "A major earthquake strikes the capital. Emergency response needed:",
        options: [
            {
                id: "full_response",
                text: "Full emergency response ($120M)",
                effect: { treasury: -120, people: 3, military: 1 },
                result: "Swift response saved lives. The people are grateful for your leadership."
            },
            {
                id: "basic_relief",
                text: "Basic relief efforts ($50M)",
                effect: { treasury: -50, people: 1 },
                result: "Adequate response provided. Situation managed without major issues."
            },
            {
                id: "minimal",
                text: "Minimal intervention ($10M)",
                effect: { treasury: -10, people: -3, military: -1, business: 1 },
                result: "Poor response caused suffering. Only businesses benefited from reduced spending."
            }
        ]
    }
];
