import { describe, it, expect } from 'vitest';
import { checkCoup } from './CoupHandler';
import type { Power } from '../types/Power';

/**
 * Story 2-7: Coup mechanic — threshold, grace roll, and tiebreak logic (TR-lasting-007).
 *
 * checkCoup() is a pure function that accepts an injected graceRoll so tests
 * remain deterministic without mocking Math.random (ADR-0004).
 */

function makeRelations(overrides: Partial<Record<Power, number>> = {}): Record<Power, number> {
    return { military: 0, business: 0, people: 0, ...overrides };
}

describe('checkCoup — coup threshold evaluation', () => {
    // AC-1: No coup when relation below armed threshold
    // Note: relation +7 with charisma −3 still satisfies the yellow-warning
    // condition (≥+6, ≤0) — the story's AC-1 intent is "no coup", not "no warning".
    it('does not fire coup or grace when all relations are below the armed threshold', () => {
        const result = checkCoup(makeRelations({ military: 7 }), -3, 0.9, false);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
        expect(result.outcome).toBe('yellow-warning');
    });

    it('returns safe when no faction reaches even the warning threshold', () => {
        const result = checkCoup(makeRelations({ military: 5, business: 5, people: 5 }), -10, 0.9, false);
        expect(result.outcome).toBe('safe');
    });

    // AC-1 edge: charisma at −2 (above CHARISMA_THRESHOLD of −3) → no coup
    it('does not fire coup when charisma is −2 (above threshold), even with relation at +8', () => {
        // charisma −2 > CHARISMA_THRESHOLD (−3) → armed check fails
        // charisma −2 ≤ WARN_CHARISMA (0), relation 8 ≥ WARN_RELATION (6) → yellow warning
        const result = checkCoup(makeRelations({ military: 8 }), -2, 0.9, false);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
        expect(result.outcome).toBe('yellow-warning');
    });

    // AC-2: Yellow warning (relation ≥+6, charisma ≤0, but below armed threshold)
    it('returns yellow-warning when relation ≥+6 and charisma ≤0 but below armed threshold', () => {
        const result = checkCoup(makeRelations({ people: 7 }), -1, 0.9, false);
        expect(result.outcome).toBe('yellow-warning');
        if (result.outcome === 'yellow-warning') {
            expect(result.faction).toBe('people');
        }
    });

    // AC-3: Grace — armed threshold met, first trigger, survives 50% roll (0.3 < 0.5)
    it('returns grace when armed conditions met, graceTaken=false, and roll < GRACE_CHANCE', () => {
        const result = checkCoup(makeRelations({ military: 8 }), -3, 0.3, false);
        expect(result.outcome).toBe('grace');
        if (result.outcome === 'grace') {
            expect(result.faction).toBe('military');
        }
    });

    // AC-4: Coup fires — grace already exhausted (graceTaken=true), roll irrelevant
    it('returns coup when graceTaken=true regardless of roll value', () => {
        const result = checkCoup(makeRelations({ military: 8 }), -3, 0.3, true);
        expect(result.outcome).toBe('coup');
        if (result.outcome === 'coup') {
            expect(result.faction).toBe('military');
            expect(result.cause).toBe('military_coup');
        }
    });

    // AC-5: Coup fires on first trigger due to bad luck (roll ≥ 0.5)
    it('returns coup on first trigger when roll ≥ GRACE_CHANCE (0.7 ≥ 0.5)', () => {
        const result = checkCoup(makeRelations({ business: 8 }), -3, 0.7, false);
        expect(result.outcome).toBe('coup');
        if (result.outcome === 'coup') {
            expect(result.faction).toBe('business');
            expect(result.cause).toBe('business_coup');
        }
    });

    // AC-6: No coup when charisma ≥ 0 even with maxed relation (special-ending scenario)
    it('returns non-coup result when charisma=0 and relation=+10 (special ending unaffected)', () => {
        // charisma 0 is NOT ≤ CHARISMA_THRESHOLD (−3) → armed check fails → no coup
        const result = checkCoup(makeRelations({ military: 10 }), 0, 0.3, false);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
    });

    // AC-7: Tiebreak — military beats business when both at same relation
    it('selects military over business when both have equal relation (tiebreak rule)', () => {
        const result = checkCoup(makeRelations({ military: 8, business: 8 }), -3, 0.9, false);
        expect(result.outcome).toBe('coup');
        if (result.outcome === 'coup') {
            expect(result.cause).toBe('military_coup');
        }
    });
});
