import { GAMESTATE } from '../Constants/GameState';
import type { Modifier } from '../types/GameState';
import type { Power } from '../types/Power';
import { getEffectiveRelation } from './Modifiers';

/**
 * Display data returned by selectCoupRisk (TR-coup-002, ADR-0009 §4).
 * All values are live (computed from current effective relations), not cached.
 */
export interface CoupRiskInfo {
    /** Faction posing the highest coup risk this round. */
    faction: Power;
    /** Effective relation for that faction at the current round. */
    effectiveRelation: number;
    /** Armed-threshold that applies this round (security-spend adjusted). */
    armedThreshold: number;
    /** 'yellow' = approaching danger; 'red' = armed condition met (ADR-0009 §1). */
    tier: 'yellow' | 'red';
}

const TIEBREAK: Power[] = ['military', 'business', 'people'];

function pickHighestRelation(factions: Power[], effectiveRelations: Record<Power, number>): Power {
    const maxRel = Math.max(...factions.map(p => effectiveRelations[p]));
    const atMax  = factions.filter(p => effectiveRelations[p] === maxRel);
    return TIEBREAK.find(p => atMax.includes(p)) ?? atMax[0];
}

/**
 * Pure coup-risk projection for the UI readout (TR-coup-002, ADR-0009 §1/§4).
 *
 * Evaluates the two-tier coup telegraph against live effective relations and
 * returns display data (faction, relation, distance) for CoupRiskReadout.
 * Red tier is checked first; yellow is returned only when no faction is armed.
 * Returns null when no faction qualifies for either tier.
 *
 * @param baseRelations     Raw faction relations from the store.
 * @param effectiveCharisma Pre-computed effective charisma (use getEffectiveCharisma).
 * @param modifiers         Active modifier array from the store.
 * @param round             Current round number.
 * @param securitySpend     Current security expenditure (adjusts armed threshold ±1).
 */
export function selectCoupRisk(
    baseRelations: Record<Power, number>,
    effectiveCharisma: number,
    modifiers: Modifier[],
    round: number,
    securitySpend?: number,
): CoupRiskInfo | null {
    const { COUP, BUDGET_EFFECTS } = GAMESTATE;
    const powers: Power[] = ['military', 'business', 'people'];

    let armedThreshold = COUP.RELATION_THRESHOLD;
    if (securitySpend !== undefined) {
        if (securitySpend >= BUDGET_EFFECTS.SECURITY.HIGH) armedThreshold += 1;
        else if (securitySpend < BUDGET_EFFECTS.SECURITY.LOW) armedThreshold -= 1;
    }

    const effectiveRelations: Record<Power, number> = {
        military: getEffectiveRelation(baseRelations.military, modifiers, 'military', round),
        business: getEffectiveRelation(baseRelations.business, modifiers, 'business', round),
        people:   getEffectiveRelation(baseRelations.people,   modifiers, 'people',   round),
    };

    // Red tier: armed threshold + charisma check (ADR-0009 §1)
    const armedFactions = powers.filter(p => effectiveRelations[p] >= armedThreshold);
    if (armedFactions.length > 0 && effectiveCharisma <= COUP.CHARISMA_THRESHOLD) {
        const faction = pickHighestRelation(armedFactions, effectiveRelations);
        return { faction, effectiveRelation: effectiveRelations[faction], armedThreshold, tier: 'red' };
    }

    // Yellow tier: softer warn threshold + warn charisma check (ADR-0009 §1)
    const warnFactions = powers.filter(p => effectiveRelations[p] >= COUP.WARN_RELATION);
    if (warnFactions.length > 0 && effectiveCharisma <= COUP.WARN_CHARISMA) {
        const faction = pickHighestRelation(warnFactions, effectiveRelations);
        return { faction, effectiveRelation: effectiveRelations[faction], armedThreshold, tier: 'yellow' };
    }

    return null;
}
