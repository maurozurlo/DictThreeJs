import type { Law } from "../types/Law";
import type { Modifier } from "../types/GameState";
import { RECURRING } from "../Constants/Costs";
import { lawModifierId } from "../assets/modifierContent";

/**
 * Law-pool filter (ADR-0008 §8). Two exclusions, both driven by the modifiers
 * array (the single source of truth after P2):
 *
 *  1. **Re-offer guard** — a law whose `law-recurring` modifier is currently active
 *     is removed from the pool (`m.id === 'laws.{id}' && state === 'active'`), so an
 *     active lasting law is never re-offered.
 *  2. **Income-law cap** — once `maxIncomeLaws` lasting-income laws are active,
 *     further lasting-income laws are excluded (PRD Feature 1, no-cap mitigation 2).
 *
 * Pure function: returns a filtered copy; never mutates the inputs.
 */
export function filterLawPool(
    laws: Law[],
    modifiers: Modifier[],
    maxIncomeLaws: number = RECURRING.MAX_INCOME_LAWS_PER_RUN,
): Law[] {
    const activeRecurringLaws = modifiers.filter(m => m.type === 'law-recurring' && m.state === 'active');
    const activeLawIds = new Set(activeRecurringLaws.map(m => m.id));
    const activeIncomeLaws = activeRecurringLaws.filter(
        m => m.mods.some(sm => sm.stat === 'roundIncome' && sm.amount > 0),
    ).length;

    const underCap = activeIncomeLaws < maxIncomeLaws
        ? laws
        : laws.filter(law => (law.recurringEffect?.incomeBonus ?? 0) <= 0);

    return underCap.filter(law => !activeLawIds.has(lawModifierId(law.id)));
}
