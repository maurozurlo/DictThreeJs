import type { DailyEvent } from "../types/DailyEvent";

export const DAILY_EVENTS: DailyEvent[] = [
    // TERRIBLE EVENTS (low chance, high negative impact)
    {
        power: "military",
        key: "daily_events.military_coup_attempt",
        mod: -3,
        chance: 5
    },
    {
        power: "people",
        key: "daily_events.health_epidemic",
        mod: -3,
        chance: 8
    },
    {
        power: "business",
        key: "daily_events.foreign_investors_withdraw",
        mod: -3,
        chance: 10
    },
    {
        power: "people",
        key: "daily_events.natural_disaster",
        mod: -3,
        chance: 12
    },

    // SEVERE EVENTS (moderate-low chance, significant negative impact)
    {
        power: "military",
        key: "daily_events.regional_conflicts",
        mod: -2,
        chance: 20
    },
    {
        power: "people",
        key: "daily_events.labor_strikes",
        mod: -2,
        chance: 25
    },
    {
        power: "business",
        key: "daily_events.international_sanctions",
        mod: -2,
        chance: 15
    },
    {
        power: "people",
        key: "daily_events.inflation_spike",
        mod: -2,
        chance: 30
    },
    {
        power: "military",
        key: "daily_events.cyber_attack",
        mod: -2,
        chance: 18
    },
    {
        power: "business",
        key: "daily_events.smuggling_exposed",
        mod: -2,
        chance: 22
    },

    // MODERATE NEGATIVE EVENTS (higher chance, moderate impact)
    {
        power: "people",
        key: "daily_events.economic_unrest",
        mod: -1,
        chance: 40
    },
    {
        power: "military",
        key: "daily_events.border_tension",
        mod: -1,
        chance: 35
    },
    {
        power: "business",
        key: "daily_events.government_interference_concern",
        mod: -1,
        chance: 38
    },
    {
        power: "people",
        key: "daily_events.opposition_protests",
        mod: -1,
        chance: 45
    },
    {
        power: "military",
        key: "daily_events.stability_concerns",
        mod: -1,
        chance: 35
    },
    {
        power: "people",
        key: "daily_events.corruption_scandal",
        mod: -1,
        chance: 30
    },
    {
        power: "people",
        key: "daily_events.media_leaks",
        mod: -1,
        chance: 28
    },
    {
        power: "people",
        key: "daily_events.religious_mobilization",
        mod: -1,
        chance: 32
    },
    {
        power: "business",
        key: "daily_events.infrastructure_failure",
        mod: -1,
        chance: 25
    },
    {
        power: "business",
        key: "daily_events.tech_regulations_anger",
        mod: -1,
        chance: 35
    },
    {
        power: "people",
        key: "daily_events.aid_delayed",
        mod: -1,
        chance: 30
    },
    {
        power: "people",
        key: "daily_events.transport_strikes",
        mod: -1,
        chance: 40
    },
    {
        power: "business",
        key: "daily_events.environmental_protests",
        mod: -1,
        chance: 33
    },
    {
        power: "people",
        key: "daily_events.official_scandal",
        mod: -1,
        chance: 35
    },

    // POSITIVE EVENT (for balance)
    {
        power: "people",
        key: "daily_events.politician_support",
        mod: 1,
        chance: 25
    },
];