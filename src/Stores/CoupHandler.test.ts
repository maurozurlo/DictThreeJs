import { describe, it, expect } from 'vitest';
import { checkCoup } from './CoupHandler';
import type { Power } from '../types/Power';

/**
 * Coup mechanic — deterministic threshold/grace/tiebreak logic
 * (TR-coup-002, ADR-0009).
 *
 * checkCoup() is a pure, fully deterministic function: no RNG. The first armed
 * round is always survived (grace); a coup fires only when the armed condition
 * is still met the following round (graceTaken = true).
 */

function makeRelations(overrides: Partial<Record<Power, number>> = {}): Record<Power, number> {
    return { military: 0, business: 0, people: 0, ...overrides };
}

describe('checkCoup — deterministic coup threshold evaluation', () => {
    // No coup when relation below armed threshold.
    // Note: relation +7 with charisma −3 still satisfies the yellow-warning
    // condition (≥+6, ≤−2) — the intent is "no coup", not "no warning".
    it('does not fire coup or grace when all relations are below the armed threshold', () => {
        const result = checkCoup(makeRelations({ military: 7 }), -3, false);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
        expect(result.outcome).toBe('yellow-warning');
    });

    it('returns safe when no faction reaches even the warning threshold', () => {
        const result = checkCoup(makeRelations({ military: 5, business: 5, people: 5 }), -10, false);
        expect(result.outcome).toBe('safe');
    });

    // charisma at −2 (above CHARISMA_THRESHOLD of −3) → no coup, yellow instead
    it('does not fire coup when charisma is −2 (above threshold), even with relation at +8', () => {
        const result = checkCoup(makeRelations({ military: 8 }), -2, false);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
        expect(result.outcome).toBe('yellow-warning');
    });

    // Yellow warning fires at WARN_CHARISMA boundary (−2) with relation ≥+6
    it('returns yellow-warning when relation ≥+6 and charisma ≤−2 but below armed threshold', () => {
        const result = checkCoup(makeRelations({ people: 7 }), -2, false);
        expect(result.outcome).toBe('yellow-warning');
        if (result.outcome === 'yellow-warning') {
            expect(result.faction).toBe('people');
        }
    });

    // No warning when charisma is −1 (above WARN_CHARISMA), even with high relation
    it('returns safe when charisma is −1 and relation ≥+6 (charisma above warning threshold)', () => {
        const result = checkCoup(makeRelations({ people: 7 }), -1, false);
        expect(result.outcome).toBe('safe');
    });

    // ADR-0009 §2: the FIRST armed round is ALWAYS survived (deterministic grace) —
    // no RNG, no coin-flip death. It arms and emits the red warning.
    it('returns grace (never coup) on the first armed round, graceTaken=false', () => {
        const result = checkCoup(makeRelations({ military: 8 }), -3, false);
        expect(result.outcome).toBe('grace');
        if (result.outcome === 'grace') {
            expect(result.faction).toBe('military');
        }
    });

    // ADR-0009 §2: coup fires only when the armed condition is STILL met the next
    // round (graceTaken = true).
    it('returns coup when armed and graceTaken=true (second consecutive armed round)', () => {
        const result = checkCoup(makeRelations({ military: 8 }), -3, true);
        expect(result.outcome).toBe('coup');
        if (result.outcome === 'coup') {
            expect(result.faction).toBe('military');
            expect(result.cause).toBe('military_coup');
        }
    });

    // ADR-0009 validation: dropping the faction's effective relation below the
    // armed threshold DURING the grace round prevents the coup, even with graceTaken.
    it('does not fire coup when graceTaken=true but relation has dropped below the armed threshold (defused)', () => {
        const result = checkCoup(makeRelations({ military: 5 }), -3, true);
        expect(result.outcome).not.toBe('coup');
    });

    // ADR-0009 validation: raising charisma above CHARISMA_THRESHOLD during the
    // grace round prevents the coup, even with graceTaken.
    it('does not fire coup when graceTaken=true but charisma has risen above the threshold (defused)', () => {
        const result = checkCoup(makeRelations({ military: 8 }), 0, true);
        expect(result.outcome).not.toBe('coup');
    });

    // No coup when charisma ≥ 0 even with maxed relation (special-ending scenario)
    it('returns non-coup result when charisma=0 and relation=+10 (special ending unaffected)', () => {
        const result = checkCoup(makeRelations({ military: 10 }), 0, false);
        expect(result.outcome).not.toBe('coup');
        expect(result.outcome).not.toBe('grace');
    });

    // Tiebreak — military beats business when both at the same (armed) relation
    it('selects military over business when both have equal relation (tiebreak rule)', () => {
        const result = checkCoup(makeRelations({ military: 8, business: 8 }), -3, true);
        expect(result.outcome).toBe('coup');
        if (result.outcome === 'coup') {
            expect(result.cause).toBe('military_coup');
        }
    });
});
