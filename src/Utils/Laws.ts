import type { Power } from "../types/Power";

export function getRandomUniqueItemForPower<T extends { power: Power }>(
    items: T[],
    used: Set<T>,
    power: Power
): T | null {
    const available = items.filter(i => i.power === power && !used.has(i));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}
