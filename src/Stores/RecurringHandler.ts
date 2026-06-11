import type { ActiveRecurringEffect } from "../types/GameState";
import type { Law } from "../types/Law";
import type { Deal } from "../types/Deal";
import type { Power } from "../types/Power";

/**
 * Returns a new effects array with the item's recurring effect activated.
 *
 * - No-op (same array back) when the item has no recurringEffect.
 * - No-op when an entry with the same sourceId already exists (dedup — a law
 *   re-offered after pool reset must not double its effect).
 *
 * Pure function: never mutates the input array.
 */
export function withRecurringEffect({
    effects,
    item,
    sourceType,
    round,
}: {
    effects: ActiveRecurringEffect[];
    item: Law | Deal;
    sourceType: 'law' | 'deal';
    round: number;
}): ActiveRecurringEffect[] {
    if (!item.recurringEffect) return effects;

    const sourceId = `${sourceType}-${item.id}`;
    if (effects.some(e => e.sourceId === sourceId)) return effects;

    // Content rule: items carrying a recurringEffect must declare a proposing
    // faction (Law.power is required; recurring Deals must set power too).
    const sourceFaction: Power = item.power ?? 'people';

    return [
        ...effects,
        {
            sourceId,
            sourceType,
            sourceFaction,
            label: item.recurringEffect.label,
            incomeBonus: item.recurringEffect.incomeBonus ?? 0,
            expenseBonus: item.recurringEffect.expenseBonus ?? 0,
            roundActivated: round,
        },
    ];
}
