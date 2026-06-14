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

/** Maps each power to its corresponding EndCause for type-safe coup cause derivation. */
const COUP_CAUSE_MAP: Record<Power, EndCause> = {
    military: 'military_coup',
    business: 'business_coup',
    people:   'people_coup',
};

/**
 * Pure coup threshold evaluation (TR-lasting-007).
 *
 * Checks two thresholds in priority order:
 *   1. Armed (relation ≥ effective threshold AND charisma ≤ CHARISMA_THRESHOLD)
 *   2. Yellow warning (relation ≥ WARN_RELATION AND charisma ≤ WARN_CHARISMA)
 *
 * The graceRoll parameter makes this deterministically testable without
 * mocking Math.random globally (ADR-0004). Pass rollFloat() in production,
 * a fixed value in tests.
 *
 * Security spend modifies the armed threshold (Story 3-5):
 *   HIGH security (≥ BUDGET_EFFECTS.SECURITY.HIGH): threshold +1 (harder to coup)
 *   LOW  security (< BUDGET_EFFECTS.SECURITY.LOW):  threshold -1 (easier to coup)
 *
 * @param relations    - Snapshot of current faction relations
 * @param charisma     - Player's current charisma value
 * @param graceRoll    - Random float [0, 1); compared against GRACE_CHANCE (0.5)
 * @param graceTaken   - Was the armed state active last round? (second trigger = certain coup)
 * @param securitySpend - Current security expenditure level; omit for no modifier
 */
export function checkCoup(
    relations: Record<Power, number>,
    charisma: number,
    graceRoll: number,
    graceTaken: boolean,
    securitySpend?: number
): CoupResult {
    const { COUP, BUDGET_EFFECTS } = GAMESTATE;
    const powers: Power[] = ['military', 'business', 'people'];

    // Security spend shifts the armed threshold by ±1; omitting the param means no modifier
    let armedThreshold = COUP.RELATION_THRESHOLD;
    if (securitySpend !== undefined) {
        if (securitySpend >= BUDGET_EFFECTS.SECURITY.HIGH) armedThreshold += 1;
        else if (securitySpend < BUDGET_EFFECTS.SECURITY.LOW) armedThreshold -= 1;
    }

    // --- Armed threshold (relation ≥ armedThreshold AND charisma ≤ CHARISMA_THRESHOLD) ---
    const armedFactions = powers.filter(p => relations[p] >= armedThreshold);
    if (armedFactions.length > 0 && charisma <= COUP.CHARISMA_THRESHOLD) {
        const faction = pickCoupFaction(armedFactions, relations);
        const cause = COUP_CAUSE_MAP[faction];
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
