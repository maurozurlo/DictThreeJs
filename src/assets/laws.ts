import { COSTS, GAINS } from "../Constants/Costs";
import type { Law } from "../types/Law";

export const LAWS: Law[] = [
    // --- Military ---
    {
        id: 0,
        label: "Increase military spending by 50%",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, security: GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 1,
        label: "Implement martial law in troubled regions",
        power: "military",
        acceptEffect: { people: -GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.MEDIUM, business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 2,
        label: "Expand military recruitment program",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, security: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 3,
        label: "Conduct joint exercises with allied nations",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 4,
        label: "Modernize military equipment",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, business: -GAINS.SMALL, security: GAINS.SMALL },
        rejectEffect: { military: -GAINS.MEDIUM, people: GAINS.SMALL }
    },
    {
        id: 5,
        label: "Introduce mandatory military training in schools",
        power: "military",
        acceptEffect: { military: GAINS.SMALL, people: -GAINS.MEDIUM, education: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 6,
        label: "Strengthen border defenses",
        power: "military",
        acceptEffect: { military: GAINS.SMALL, business: -GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 7,
        label: "Launch intelligence reforms",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },
    {
        id: 8,
        label: "Increase military salaries",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, security: GAINS.MEDIUM },
        rejectEffect: { military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 9,
        label: "Implement stricter military hierarchy",
        power: "military",
        acceptEffect: { people: -GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },
    {
        id: 10,
        label: "Promote veterans programs",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL, people: -GAINS.SMALL }
    },
    {
        id: 11,
        label: "Deploy troops to international missions",
        power: "military",
        acceptEffect: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },
    {
        id: 12,
        label: "Expand naval fleet",
        power: "military",
        acceptEffect: { treasury: -COSTS.SMALL, people: -GAINS.SMALL, military: GAINS.SMALL },
        rejectEffect: { military: -GAINS.SMALL }
    },

    // --- Business ---
    {
        id: 13,
        label: "Cut corporate tax rates by 10%",
        power: "business",
        acceptEffect: { businessTaxes: -GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 14,
        label: "Deregulate key industries",
        power: "business",
        acceptEffect: { people: -GAINS.SMALL, business: GAINS.SMALL, businessTaxes: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 15,
        label: "Establish free trade zones",
        power: "business",
        acceptEffect: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: -GAINS.SMALL }
    },
    {
        id: 16,
        label: "Subsidize major industries",
        power: "business",
        acceptEffect: { treasury: -COSTS.LARGE, people: -GAINS.SMALL, business: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 17,
        label: "Introduce business-friendly labor laws",
        power: "business",
        acceptEffect: { people: -GAINS.MEDIUM, business: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 18,
        label: "Provide tax holidays for startups",
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, business: GAINS.MEDIUM, people: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 19,
        label: "Encourage foreign investment",
        power: "business",
        acceptEffect: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 20,
        label: "Privatize state-owned companies",
        power: "business",
        acceptEffect: { treasury: COSTS.LARGE, business: GAINS.MEDIUM, people: -GAINS.MEDIUM, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 21,
        label: "Offer export incentives",
        power: "business",
        acceptEffect: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 22,
        label: "Reduce import tariffs",
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, businessTaxes: -GAINS.SMALL, people: -GAINS.SMALL, business: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: GAINS.SMALL }
    },
    {
        id: 23,
        label: "Simplify corporate licensing",
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, business: GAINS.SMALL, people: -GAINS.SMALL, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 24,
        label: "Promote tech hubs and innovation zones",
        power: "business",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, business: GAINS.SMALL, military: -GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, people: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 25,
        label: "Implement flexible working regulations",
        power: "business",
        acceptEffect: { business: GAINS.SMALL, people: -GAINS.MEDIUM, military: GAINS.SMALL },
        rejectEffect: { business: -GAINS.SMALL, military: -GAINS.SMALL, people: GAINS.SMALL }
    },

    // --- People ---
    {
        id: 26,
        label: "Increase minimum wage by 25%",
        power: "people",
        acceptEffect: { people: GAINS.SMALL, treasury: -COSTS.LARGE, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 27,
        label: "Expand free healthcare coverage",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, health: GAINS.SMALL, people: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 28,
        label: "Implement universal basic education",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, education: GAINS.SMALL, people: GAINS.SMALL, business: -GAINS.SMALL, military: -GAINS.MEDIUM },
        rejectEffect: { people: -GAINS.SMALL, business: -GAINS.SMALL, military: -GAINS.SMALL }
    },
    {
        id: 29,
        label: "Provide housing subsidies",
        power: "people",
        acceptEffect: { treasury: GAINS.SMALL, business: -GAINS.SMALL, people: GAINS.SMALL, security: GAINS.SMALL, infrastructure: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 30,
        label: "Introduce unemployment benefits",
        power: "people",
        acceptEffect: { treasury: -COSTS.LARGE, people: GAINS.SMALL, military: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 31,
        label: "Launch food security programs",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, infrastructure: GAINS.SMALL, military: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 32,
        label: "Implement progressive tax on wealthy",
        power: "people",
        acceptEffect: { business: -GAINS.MEDIUM, people: GAINS.SMALL, businessTaxes: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: GAINS.SMALL }
    },
    {
        id: 33,
        label: "Expand public transport access",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, infrastructure: GAINS.SMALL, people: GAINS.SMALL, business: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: -GAINS.SMALL }
    },
    {
        id: 34,
        label: "Enforce workplace safety regulations",
        power: "people",
        acceptEffect: { people: GAINS.SMALL, business: GAINS.SMALL, military: -GAINS.SMALL, infrastructure: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: -GAINS.SMALL }
    },
    {
        id: 35,
        label: "Subsidize cultural and sports programs",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, infrastructure: GAINS.SMALL, people: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 36,
        label: "Provide childcare support",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, health: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 37,
        label: "Expand pension schemes",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, military: GAINS.SMALL, infrastructure: GAINS.SMALL, business: -GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL }
    },
    {
        id: 38,
        label: "Implement renewable energy projects",
        power: "people",
        acceptEffect: { treasury: -COSTS.MEDIUM, business: -GAINS.SMALL, people: GAINS.SMALL, infrastructure: GAINS.SMALL },
        rejectEffect: { people: -GAINS.SMALL, business: GAINS.SMALL }
    }
];
