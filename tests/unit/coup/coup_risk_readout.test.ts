/**
 * Unit tests for selectCoupRisk — the pure selection function powering the
 * coup-risk readout UI (TR-coup-002, ADR-0009 §4, Story 6-7).
 *
 * Covers: safe state, yellow tier, red tier, tier priority, faction tiebreak,
 * modifier-driven effective relations, and security-spend threshold adjustment.
 */

import { describe, it, expect } from 'vitest';
import { selectCoupRisk } from '../../../src/Utils/CoupRisk';
import { GAMESTATE } from '../../../src/Constants/GameState';
import type { Modifier } from '../../../src/types/GameState';

const { COUP, BUDGET_EFFECTS } = GAMESTATE;
const noMods: Modifier[] = [];
const safeRelations = { military: 0, business: 0, people: 0 };
const safeCharisma = 0; // above both WARN_CHARISMA (-2) and CHARISMA_THRESHOLD (-3)

// ---------------------------------------------------------------------------
// Safe state
// ---------------------------------------------------------------------------

describe('selectCoupRisk — safe state', () => {
    it('returns null when all factions are below warning threshold', () => {
        expect(selectCoupRisk(safeRelations, safeCharisma, noMods, 1)).toBeNull();
    });

    it('returns null when relation is high but charisma is above WARN_CHARISMA', () => {
        // Charisma = 0 > WARN_CHARISMA (-2) → no coup risk even at warning relation
        const relations = { military: COUP.WARN_RELATION, business: 0, people: 0 };
        expect(selectCoupRisk(relations, 0, noMods, 1)).toBeNull();
    });

    it('returns null when relation is at WARN_RELATION but charisma is exactly above WARN_CHARISMA', () => {
        const relations = { military: COUP.WARN_RELATION, business: 0, people: 0 };
        // WARN_CHARISMA = -2; charisma -1 > -2 → no warning
        expect(selectCoupRisk(relations, COUP.WARN_CHARISMA + 1, noMods, 1)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Yellow tier
// ---------------------------------------------------------------------------

describe('selectCoupRisk — yellow tier', () => {
    it('returns yellow when faction meets warn relation and charisma is at WARN_CHARISMA', () => {
        const relations = { military: COUP.WARN_RELATION, business: 0, people: 0 };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, noMods, 1);
        expect(result).not.toBeNull();
        expect(result?.tier).toBe('yellow');
        expect(result?.faction).toBe('military');
        expect(result?.effectiveRelation).toBe(COUP.WARN_RELATION);
    });

    it('yellow result carries the correct armedThreshold (not the warn threshold)', () => {
        const relations = { military: COUP.WARN_RELATION, business: 0, people: 0 };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, noMods, 1);
        expect(result?.armedThreshold).toBe(COUP.RELATION_THRESHOLD);
    });
});

// ---------------------------------------------------------------------------
// Red tier
// ---------------------------------------------------------------------------

describe('selectCoupRisk — red tier', () => {
    it('returns red when faction meets armed relation and charisma is at CHARISMA_THRESHOLD', () => {
        const relations = { military: COUP.RELATION_THRESHOLD, business: 0, people: 0 };
        const result = selectCoupRisk(relations, COUP.CHARISMA_THRESHOLD, noMods, 1);
        expect(result?.tier).toBe('red');
        expect(result?.faction).toBe('military');
        expect(result?.effectiveRelation).toBe(COUP.RELATION_THRESHOLD);
    });

    it('red tier overrides yellow — returns red when both tiers are triggered', () => {
        // military armed (red), people at warn (yellow)
        const relations = {
            military: COUP.RELATION_THRESHOLD,
            business: 0,
            people:   COUP.WARN_RELATION,
        };
        // CHARISMA_THRESHOLD (-3) <= WARN_CHARISMA (-2) → both yellow and red charisma checks pass
        const result = selectCoupRisk(relations, COUP.CHARISMA_THRESHOLD, noMods, 1);
        expect(result?.tier).toBe('red');
        expect(result?.faction).toBe('military');
    });
});

// ---------------------------------------------------------------------------
// Faction selection
// ---------------------------------------------------------------------------

describe('selectCoupRisk — faction selection', () => {
    it('selects the highest-relation faction when multiple are in the warn zone', () => {
        const relations = {
            military: COUP.WARN_RELATION,
            business: COUP.WARN_RELATION + 1,
            people:   0,
        };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, noMods, 1);
        expect(result?.faction).toBe('business');
    });

    it('tiebreak: military is preferred over business and people at equal relation', () => {
        const rel = COUP.WARN_RELATION;
        const relations = { military: rel, business: rel, people: rel };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, noMods, 1);
        expect(result?.faction).toBe('military');
    });

    it('tiebreak: business is preferred over people when military is not involved', () => {
        const rel = COUP.WARN_RELATION;
        const relations = { military: 0, business: rel, people: rel };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, noMods, 1);
        expect(result?.faction).toBe('business');
    });
});

// ---------------------------------------------------------------------------
// Modifier-driven effective relations
// ---------------------------------------------------------------------------

describe('selectCoupRisk — effective relations via modifiers', () => {
    it('modifier adding to a faction triggers the warning threshold', () => {
        // base is 1 below WARN_RELATION; modifier brings it up to threshold
        const relations = { military: COUP.WARN_RELATION - 1, business: 0, people: 0 };
        const modifier: Modifier = {
            id: 'test.1',
            type: 'deal',
            state: 'active',
            acquiredRound: 1,
            mods: [{ stat: 'military', amount: 1, window: { startRound: 1, endRound: null } }],
        };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, [modifier], 2);
        expect(result?.faction).toBe('military');
        expect(result?.effectiveRelation).toBe(COUP.WARN_RELATION);
    });

    it('expired modifier does not contribute to effective relation', () => {
        // base = WARN_RELATION; modifier +1 but expired → effective stays at WARN_RELATION
        // (edge: modifier window closed at round 2, we query at round 3)
        const relations = { military: COUP.WARN_RELATION - 1, business: 0, people: 0 };
        const modifier: Modifier = {
            id: 'test.2',
            type: 'deal',
            state: 'active',
            acquiredRound: 1,
            mods: [{ stat: 'military', amount: 1, window: { startRound: 1, endRound: 2 } }], // expired at round 2
        };
        const result = selectCoupRisk(relations, COUP.WARN_CHARISMA, [modifier], 3);
        expect(result).toBeNull(); // still 1 below threshold without the expired modifier
    });
});

// ---------------------------------------------------------------------------
// Security-spend threshold adjustment
// ---------------------------------------------------------------------------

describe('selectCoupRisk — security-spend threshold', () => {
    it('HIGH security spend raises the armed threshold by 1', () => {
        // At base RELATION_THRESHOLD with HIGH security → threshold becomes +1 → not armed
        const relations = { military: COUP.RELATION_THRESHOLD, business: 0, people: 0 };
        const result = selectCoupRisk(
            relations,
            COUP.CHARISMA_THRESHOLD,
            noMods,
            1,
            BUDGET_EFFECTS.SECURITY.HIGH,
        );
        // relation == RELATION_THRESHOLD, new armed threshold = RELATION_THRESHOLD + 1
        // → not armed, but >= WARN_RELATION → yellow (charisma -3 <= WARN_CHARISMA -2)
        expect(result?.tier).toBe('yellow');
        expect(result?.armedThreshold).toBe(COUP.RELATION_THRESHOLD + 1);
    });

    it('LOW security spend lowers the armed threshold by 1', () => {
        // At RELATION_THRESHOLD - 1 with LOW security → threshold decreases by 1 → now armed
        const relations = { military: COUP.RELATION_THRESHOLD - 1, business: 0, people: 0 };
        const result = selectCoupRisk(
            relations,
            COUP.CHARISMA_THRESHOLD,
            noMods,
            1,
            BUDGET_EFFECTS.SECURITY.LOW - 1, // below LOW threshold
        );
        expect(result?.tier).toBe('red');
        expect(result?.armedThreshold).toBe(COUP.RELATION_THRESHOLD - 1);
    });
});
