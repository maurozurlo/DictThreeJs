import { DAILY_EVENTS } from "../assets/dailyEvents";
import type { DailyEvent } from "../types/DailyEvent";
import { rollFloat } from "../Utils/Math";

/**
 * Gets a random daily event based on weighted probabilities
 * @returns A randomly selected daily event, or null if no event occurs
 */
export function getRandomDailyEvent(): DailyEvent | null {
    // Calculate total probability weight
    const totalChance = DAILY_EVENTS.reduce((sum, event) => sum + event.chance, 0);

    // Random number between 0 and total chance (seeded cursor — ADR-0010)
    const roll = rollFloat() * totalChance;

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