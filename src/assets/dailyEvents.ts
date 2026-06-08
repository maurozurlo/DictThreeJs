import type { DailyEvent } from "../types/DailyEvent";

export const DAILY_EVENTS: DailyEvent[] = [
    // TERRIBLE EVENTS (low chance, high negative impact)
    {
        power: "military",
        key: "daily_events.military_coup_attempt",
        headline: "Military Faction Threatens Stability in the Capital",
        mod: -3,
        chance: 5
    },
    {
        power: "people",
        key: "daily_events.health_epidemic",
        headline: "Health Crisis Spreads Across Multiple Provinces",
        mod: -3,
        chance: 8
    },
    {
        power: "business",
        key: "daily_events.foreign_investors_withdraw",
        headline: "Foreign Investors Pull Out Amid Political Uncertainty",
        mod: -3,
        chance: 10
    },
    {
        power: "people",
        key: "daily_events.natural_disaster",
        headline: "Floods Devastate Southern Regions, Thousands Displaced",
        mod: -3,
        chance: 12
    },

    // SEVERE EVENTS (moderate-low chance, significant negative impact)
    {
        power: "military",
        key: "daily_events.regional_conflicts",
        headline: "Border Skirmishes Reported Along the Eastern Frontier",
        mod: -2,
        chance: 20
    },
    {
        power: "people",
        key: "daily_events.labor_strikes",
        headline: "Workers Walk Out in Nationwide Strike Wave",
        mod: -2,
        chance: 25
    },
    {
        power: "business",
        key: "daily_events.international_sanctions",
        headline: "New Sanctions Imposed Over Human Rights Concerns",
        mod: -2,
        chance: 15
    },
    {
        power: "people",
        key: "daily_events.inflation_spike",
        headline: "Consumer Prices Surge as Inflation Hits Record High",
        mod: -2,
        chance: 30
    },
    {
        power: "military",
        key: "daily_events.cyber_attack",
        headline: "State Infrastructure Hit by Coordinated Cyber Attack",
        mod: -2,
        chance: 18
    },
    {
        power: "business",
        key: "daily_events.smuggling_exposed",
        headline: "Major Smuggling Network Uncovered by Authorities",
        mod: -2,
        chance: 22
    },

    // MODERATE NEGATIVE EVENTS (higher chance, moderate impact)
    {
        power: "people",
        key: "daily_events.economic_unrest",
        headline: "Growing Frustration Over Rising Cost of Living",
        mod: -1,
        chance: 40
    },
    {
        power: "military",
        key: "daily_events.border_tension",
        headline: "Troops Mobilized as Neighboring State Increases Pressure",
        mod: -1,
        chance: 35
    },
    {
        power: "business",
        key: "daily_events.government_interference_concern",
        headline: "Business Leaders Warn Against New Regulatory Overreach",
        mod: -1,
        chance: 38
    },
    {
        power: "people",
        key: "daily_events.opposition_protests",
        headline: "Thousands March Against Government Policies in Capital",
        mod: -1,
        chance: 45
    },
    {
        power: "military",
        key: "daily_events.stability_concerns",
        headline: "Senior Officers Express Concern Over Security Direction",
        mod: -1,
        chance: 35
    },
    {
        power: "people",
        key: "daily_events.corruption_scandal",
        headline: "Senior Official Implicated in Corruption Investigation",
        mod: -1,
        chance: 30
    },
    {
        power: "people",
        key: "daily_events.media_leaks",
        headline: "Classified Documents Reportedly Leaked to Foreign Press",
        mod: -1,
        chance: 28
    },
    {
        power: "people",
        key: "daily_events.religious_mobilization",
        headline: "Religious Leaders Call for Political Change from Pulpits",
        mod: -1,
        chance: 32
    },
    {
        power: "business",
        key: "daily_events.infrastructure_failure",
        headline: "Power Grid Failures Disrupt Commerce Nationwide",
        mod: -1,
        chance: 25
    },
    {
        power: "business",
        key: "daily_events.tech_regulations_anger",
        headline: "Tech Sector Threatens Relocation Over New Government Rules",
        mod: -1,
        chance: 35
    },
    {
        power: "people",
        key: "daily_events.aid_delayed",
        headline: "International Aid Shipments Blocked at the Border",
        mod: -1,
        chance: 30
    },
    {
        power: "people",
        key: "daily_events.transport_strikes",
        headline: "Rail and Transit Workers Announce Indefinite Strike",
        mod: -1,
        chance: 40
    },
    {
        power: "business",
        key: "daily_events.environmental_protests",
        headline: "Demonstrators Block Industrial Zone Over Pollution Claims",
        mod: -1,
        chance: 33
    },
    {
        power: "people",
        key: "daily_events.official_scandal",
        headline: "Minister Faces Calls to Resign Following Public Scandal",
        mod: -1,
        chance: 35
    },

    // POSITIVE EVENTS (Plans D + J)
    {
        power: "people",
        key: "daily_events.politician_support",
        headline: "Popular Mayor Publicly Endorses Government's New Direction",
        mod: 1,
        chance: 25
    },
    {
        power: "military",
        key: "daily_events.military_parade",
        headline: "Armed Forces Parade Draws Record Crowds, Morale Soars",
        mod: 1,
        chance: 22
    },
    {
        power: "military",
        key: "daily_events.joint_exercises",
        headline: "Joint Military Exercises Praised as Show of National Strength",
        mod: 1,
        chance: 20
    },
    {
        power: "business",
        key: "daily_events.trade_agreement",
        headline: "New Trade Agreement Signed, Business Confidence Rises",
        mod: 1,
        chance: 25
    },
    {
        power: "business",
        key: "daily_events.investment_summit",
        headline: "Investment Summit Attracts Major International Players",
        mod: 1,
        chance: 20
    },
    {
        power: "people",
        key: "daily_events.public_works_milestone",
        headline: "New Public Works Program Celebrates Major First Milestone",
        mod: 1,
        chance: 22
    },
    {
        power: "military",
        key: "daily_events.defence_commendation",
        headline: "Government Commends Armed Forces for Exceptional Service",
        mod: 2,
        chance: 8
    },
    {
        power: "business",
        key: "daily_events.economic_boom",
        headline: "Economic Output Reaches Five-Year High, Analysts Celebrate",
        mod: 2,
        chance: 8
    },
];
