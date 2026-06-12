import { GAMESTATE } from '../Constants/GameState';
import type { Power } from '../types/Power';
import type { EndCause } from '../types/GameState';

/**
 * The possible outcomes of a coup threshold check.
 * 'grace'   — armed threshold met on first trigger; player survives the 50% roll this round.
 * 'coup'    — coup fires (either grace exhausted or bad first roll).
 */
export type CoupResult =
    | { outcome: 'safe' }
    | { outcome: 'yellow-warning'; faction: Power }
    | { outcome: 'grace'; faction: Power }
    | { outcome: 'coup'; faction: Power; cause: EndCause };

/**
 * Selects the threatening faction from candidates.
 * Highest relation wins; tiebreak order: military > business > people.
 */
function pickCoupFaction(factions: Power[], relations: Record<Power, number>): Power {
    const maxRel = Math.max(...factions.map(p => relations[p]));
    const atMax = factions.filter(p => relations[p] === maxRel);
    const priority: Power[] = ['military', 'business', 'people'];
    return priority.find(p => atMax.includes(p)) ?? atMax[0];
}

/**
 * Pure coup threshold evaluation (TR-lasting-007).
 *
 * Checks two thresholds in priority order:
 *   1. Armed (relation ≥ RELATION_THRESHOLD AND charisma ≤ CHARISMA_THRESHOLD)
 *   2. Yellow warning (relation ≥ WARN_RELATION AND charisma ≤ WARN_CHARISMA)
 *
 * The graceRoll parameter makes this deterministically testable without
 * mocking Math.random globally (ADR-0004). Pass rollFloat() in production,
 * a fixed value in tests.
 *
 * @param relations  - Snapshot of current faction relations
 * @param charisma   - Player's current charisma value
 * @param graceRoll  - Random float [0, 1); compared against GRACE_CHANCE (0.5)
 * @param graceTaken - Was the armed state active last round? (second trigger = certain coup)
 */
export function checkCoup(
    relations: Record<Power, number>,
    charisma: number,
    graceRoll: number,
    graceTaken: boolean
): CoupResult {
    const { COUP } = GAMESTATE;
    const powers: Power[] = ['military', 'business', 'people'];

    // --- Armed threshold (relation ≥ +8 AND charisma ≤ −3) ---
    const armedFactions = powers.filter(p => relations[p] >= COUP.RELATION_THRESHOLD);
    if (armedFactions.length > 0 && charisma <= COUP.CHARISMA_THRESHOLD) {
        const faction = pickCoupFaction(armedFactions, relations);
        const cause = `${faction}_coup` as EndCause;
        if (graceTaken || graceRoll >= COUP.GRACE_CHANCE) {
            return { outcome: 'coup', faction, cause };
        }
        return { outcome: 'grace', faction };
    }

    // --- Yellow warning threshold (relation ≥ +6 AND charisma ≤ 0) ---
    const warnFactions = powers.filter(p => relations[p] >= COUP.WARN_RELATION);
    if (warnFactions.length > 0 && charisma <= COUP.WARN_CHARISMA) {
        const faction = pickCoupFaction(warnFactions, relations);
        return { outcome: 'yellow-warning', faction };
    }

    return { outcome: 'safe' };
}
