import { DAILY_EVENTS } from "../assets/dailyEvents";
import type { DailyEvent } from "../types/DailyEvent";
import type { Power } from "../types/Power";

/**
 * Gets a random daily event based on weighted probabilities
 * @returns A randomly selected daily event, or null if no event occurs
 */
export function getRandomDailyEvent(): DailyEvent | null {
    // Calculate total probability weight
    const totalChance = DAILY_EVENTS.reduce((sum, event) => sum + event.chance, 0);

    // Random number between 0 and total chance
    const roll = Math.random() * totalChance;

    // Select event based on weighted probability
    let cumulative = 0;
    for (const event of DAILY_EVENTS) {
        cumulative += event.chance;
        if (roll <= cumulative) {
            return event;
        }
    }

    return null;
}

/**
 * Gets a random daily event for a specific power
 * @param power The power faction to get an event for
 * @returns A randomly selected event for that power, or null if no event occurs
 */
export function getRandomDailyEventForPower(power: Power): DailyEvent | null {
    const powerEvents = DAILY_EVENTS.filter(event => event.power === power);

    if (powerEvents.length === 0) return null;

    const totalChance = powerEvents.reduce((sum, event) => sum + event.chance, 0);
    const roll = Math.random() * totalChance;

    let cumulative = 0;
    for (const event of powerEvents) {
        cumulative += event.chance;
        if (roll <= cumulative) {
            return event;
        }
    }

    return null;
}