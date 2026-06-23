import type { ModifierSpec } from '../types/GameState';
import type { TFunction } from 'i18next';

export interface ConsequenceLine {
    label: string;
    amount: number;
    timing: string;
}

/**
 * Converts ModifierSpec[] into human-readable consequence lines.
 * Requires the menu-namespace translator so stat.* and consequence.* keys resolve.
 *
 * Timing conventions (matching laws.ts/deals.ts asset data):
 *   - treasury, time:1  → "next round" (one-time treasury hit applied in nextRound())
 *   - roundIncome/roundExpense, time:0 → "per round" (permanent recurring)
 *   - everything else, time:0 → "permanent" (relation/charisma/slider, removed on repeal)
 *   - time:1, non-treasury → "" (one-shot immediate, no timing label needed)
 */
export function formatConsequences(specs: ModifierSpec[], t: TFunction): ConsequenceLine[] {
    return specs.map(s => ({
        label: t(`stat.${s.stat}`),
        amount: s.amount,
        timing:
            s.stat === 'treasury' && s.time === 1 ? t('consequence.next_round')
            : s.time === 0 && (s.stat === 'roundIncome' || s.stat === 'roundExpense') ? t('consequence.per_round')
            : s.time === 0 ? t('consequence.permanent')
            : '',
    }));
}
