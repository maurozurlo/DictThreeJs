import { GAMESTATE } from '../Constants/GameState';
import type { Power } from '../types/Power';
import type { EndCause } from '../types/GameState';

/**
 * The possible outcomes of a coup threshold check.
 * 'grace'   — armed threshold met for the FIRST time; the run is deterministically
 *             survived this round and an explicit red warning is emitted (ADR-0009 §2
 *             guaranteed warning round).
 * 'coup'    — armed threshold STILL met the round after a grace round (graceTaken);
 *             the run ends.
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
 * Pure coup threshold evaluation (TR-coup-002, ADR-0009).
 *
 * Fully deterministic — no RNG. The output is a pure function of
 * (relations, charisma, graceTaken, securitySpend). Checks two tiers in priority order:
 *   1. Armed (relation ≥ effective threshold AND charisma ≤ CHARISMA_THRESHOLD)
 *   2. Yellow warning (relation ≥ WARN_RELATION AND charisma ≤ WARN_CHARISMA)
 *
 * Deterministic grace (ADR-0009 §2): the FIRST armed round is always survived — the
 * system arms, emits the red warning, and the caller sets coupArmedLastRound = true.
 * The coup fires only if the armed condition is STILL met the next round (graceTaken),
 * guaranteeing at least one explicit, actionable warning round before a run can end.
 *
 * Security spend modifies the armed threshold (Story 3-5):
 *   HIGH security (≥ BUDGET_EFFECTS.SECURITY.HIGH): threshold +1 (harder to coup)
 *   LOW  security (< BUDGET_EFFECTS.SECURITY.LOW):  threshold -1 (easier to coup)
 *
 * @param relations     - Snapshot of current (effective) faction relations
 * @param charisma      - Player's current (effective) charisma value
 * @param graceTaken    - Was the armed state active last round? (second consecutive armed round = certain coup)
 * @param securitySpend - Current security expenditure level; omit for no modifier
 */
export function checkCoup(
    relations: Record<Power, number>,
    charisma: number,
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
        // Deterministic grace (ADR-0009 §2): first armed round always survives;
        // the coup fires only when the armed condition persists into the next round.
        if (graceTaken) {
            return { outcome: 'coup', faction, cause };
        }
        return { outcome: 'grace', faction };
    }

    // --- Yellow warning threshold (relation ≥ WARN_RELATION AND charisma ≤ WARN_CHARISMA) ---
    const warnFactions = powers.filter(p => relations[p] >= COUP.WARN_RELATION);
    if (warnFactions.length > 0 && charisma <= COUP.WARN_CHARISMA) {
        const faction = pickCoupFaction(warnFactions, relations);
        return { outcome: 'yellow-warning', faction };
    }

    return { outcome: 'safe' };
}
