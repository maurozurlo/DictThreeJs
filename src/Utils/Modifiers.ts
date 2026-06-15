import type { Modifier, ModifierStat } from '../types/GameState';
import { GAMESTATE } from '../Constants/GameState';
import { Clamp } from './Math';

/**
 * Sum every modifier contribution to a given stat. The single place that knows
 * how to aggregate modifiers — gameplay and UI both go through here, so adding a
 * new modifier type (or a new modifiable stat) requires no changes at call sites.
 */
export function sumModifiers(modifiers: Modifier[], stat: ModifierStat): number {
    let total = 0;
    for (const m of modifiers) {
        for (const sm of m.mods) {
            if (sm.stat === stat) total += sm.amount;
        }
    }
    return total;
}

/**
 * Effective charisma used by all real-time calculations and the HUD:
 * base charisma (which fluctuates with gameplay) plus permanent modifier
 * contributions (e.g. statues), clamped to the charisma bounds.
 */
export function getEffectiveCharisma(baseCharisma: number, modifiers: Modifier[]): number {
    return Clamp(
        baseCharisma + sumModifiers(modifiers, 'charisma'),
        GAMESTATE.CHARISMA.MIN,
        GAMESTATE.CHARISMA.MAX,
    );
}
