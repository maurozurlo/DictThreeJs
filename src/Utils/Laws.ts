import type { Power } from "../types/Power";
import { getRandomFromList } from "./Math";

export function getRandomUniqueItemForPower<T extends { power: Power }>(
    items: T[],
    used: Set<T>,
    power: Power
): T | null {
    const available = items.filter(i => i.power === power && !used.has(i));
    if (available.length === 0) return null;
    return getRandomFromList(available);
}
