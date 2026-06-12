import type { ActiveRecurringEffect } from "../types/GameState";
import type { Law } from "../types/Law";
import type { Deal } from "../types/Deal";
import type { Power } from "../types/Power";
import { RECURRING } from "../Constants/Costs";

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

/**
 * Pool weighting (PRD Feature 1, no-cap mitigation 2): once `maxIncomeLaws`
 * lasting-income laws are active, further lasting-income laws are excluded
 * from the candidate pool. Runs at pool-generation time, not render time.
 *
 * Pure function: returns the input array unchanged while under the cap.
 */
export function filterLawPool(
    laws: Law[],
    effects: ActiveRecurringEffect[],
    maxIncomeLaws: number = RECURRING.MAX_INCOME_LAWS_PER_RUN,
): Law[] {
    const activeIncomeLaws = effects.filter(e => e.sourceType === 'law' && e.incomeBonus > 0).length;
    if (activeIncomeLaws < maxIncomeLaws) return laws;
    return laws.filter(law => (law.recurringEffect?.incomeBonus ?? 0) <= 0);
}
