/**
 * Unit tests for CitizenHandler P2 — Employment + Happiness + Body-Type (Story 7-2).
 *
 * All happiness inputs are passed as effective values (ADR-0008 — callers of
 * computeHappiness pre-resolve relations and charisma). Tests drive the three
 * pure functions directly; no store or RNG involvement.
 *
 * Floating-point note: faction-fortune and charisma terms involve /10 and *3/*2
 * which are not exact in IEEE 754. Happiness assertions use toBeCloseTo(x, 9)
 * (nine significant decimal places) — tight enough to catch formula bugs while
 * tolerant of sub-ulp rounding.
 */

import { describe, it, expect } from 'vitest';
import {
    computeEmployment,
    computeHappiness,
    computeBodyType,
    type HappinessInputs,
    VOLATILITY_CAP,
    VOLATILITY_COEFFICIENT,
    FAT_AT_ZERO, FAT_AT_MAX, SLIM_AT_ZERO, SLIM_AT_MAX,
} from '../../../src/Stores/CitizenHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a full HappinessInputs with army-faction defaults. Override as needed. */
function makeInputs(overrides: Partial<HappinessInputs>): HappinessInputs {
    return {
        faction: 'military',
        effectiveRelation: 0,
        lastFactionRelation: 0,
        effectiveCharisma: 0,
        security: 5,
        infrastructure: 5,
        health: 5,
        peopleTax: 0,
        businessTax: 0,
        employed: true,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// AC-3: Marco worked examples (pinned happiness values)
// ---------------------------------------------------------------------------

describe('computeHappiness — AC-3 Marco examples', () => {
    it('R1: sec=7, rel=+4, char=+2, army, employed, lastRel=+4 → happiness 7.0', () => {
        // factionFortune = (4/10)*3 + (7-5)/5 = 1.2 + 0.4 = 1.6
        // charismaTerm = (2/10)*2 = 0.4
        // displacement = 0, volatility = min(2, |4-4|*0.4) = 0
        // 5 + 1.6 + 0.4 - 0 - 0 = 7.0
        const h = computeHappiness(makeInputs({
            faction: 'military',
            effectiveRelation: 4,
            lastFactionRelation: 4,
            effectiveCharisma: 2,
            security: 7,
            employed: true,
        }));
        expect(h).toBeCloseTo(7.0, 9);
    });

    it('R4: sec=2, rel=-1, char=+2, army, displaced, lastRel=+4 → happiness 0.5', () => {
        // factionFortune = (-1/10)*3 + (2-5)/5 = -0.3 + (-0.6) = -0.9
        // charismaTerm = (2/10)*2 = 0.4
        // displacement = 2 (army, not employed)
        // volatility = min(2, |-1-4|*0.4) = min(2, 2.0) = 2.0
        // 5 - 0.9 + 0.4 - 2 - 2 = 0.5
        const h = computeHappiness(makeInputs({
            faction: 'military',
            effectiveRelation: -1,
            lastFactionRelation: 4,
            effectiveCharisma: 2,
            security: 2,
            employed: false,
        }));
        expect(h).toBeCloseTo(0.5, 9);
    });

    it('R4 volatility term: min(2, |−1 − 4| × 0.4) = 2.0 exactly', () => {
        // This verifies the cap applies at this exact boundary (5 * 0.4 = 2.0)
        const volatility = Math.min(VOLATILITY_CAP, Math.abs(-1 - 4) * VOLATILITY_COEFFICIENT);
        expect(volatility).toBe(2.0);
    });
});

// ---------------------------------------------------------------------------
// AC-4: Clamp endpoints — raw below 0 → 0; above 10 → 10
// ---------------------------------------------------------------------------

describe('computeHappiness — AC-4 clamp', () => {
    it('raw above 10 clamps to 10 (army, rel=+10, char=+10, sec=10)', () => {
        // factionFortune = (10/10)*3 + (10-5)/5 = 3 + 1 = 4
        // charismaTerm = (10/10)*2 = 2; raw = 5+4+2 = 11 → 10
        const h = computeHappiness(makeInputs({
            faction: 'military',
            effectiveRelation: 10,
            lastFactionRelation: 10,
            effectiveCharisma: 10,
            security: 10,
            employed: true,
        }));
        expect(h).toBe(10);
    });

    it('raw below 0 clamps to 0 (people, rel=-10, char=-10, health=0, peopleTax=50)', () => {
        // factionFortune = (-10/10)*3 + (0-5)/5 + (-0.5 tax) = -3 + (-1) + (-0.5) = -4.5
        // charismaTerm = (-10/10)*2 = -2; displacement = 0 (people); volatility = 0 (lastRel same)
        // raw = 5 - 4.5 - 2 = -1.5 → 0
        const h = computeHappiness(makeInputs({
            faction: 'people',
            effectiveRelation: -10,
            lastFactionRelation: -10,
            effectiveCharisma: -10,
            health: 0,
            peopleTax: 50,
            employed: true,
        }));
        expect(h).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// AC-5: Employment boundary values
// ---------------------------------------------------------------------------

describe('computeEmployment — AC-5 boundary values', () => {
    describe('army', () => {
        it('security=4, rel=0 → employed (boundary: both conditions exactly met)', () => {
            expect(computeEmployment('military', 0, 4, 5)).toBe(true);
        });

        it('security=3, rel=+5 → displaced (security below threshold)', () => {
            expect(computeEmployment('military', 5, 3, 5)).toBe(false);
        });

        it('security=5, rel=-1 → displaced (relation below zero)', () => {
            expect(computeEmployment('military', -1, 5, 5)).toBe(false);
        });
    });

    describe('business', () => {
        it('rel=0, infrastructure=3 → employed (boundary: both conditions exactly met)', () => {
            expect(computeEmployment('business', 0, 5, 3)).toBe(true);
        });

        it('rel=-1, infrastructure=5 → displaced (relation below zero)', () => {
            expect(computeEmployment('business', -1, 5, 5)).toBe(false);
        });

        it('rel=+5, infrastructure=2 → displaced (infrastructure below threshold)', () => {
            expect(computeEmployment('business', 5, 5, 2)).toBe(false);
        });
    });

    describe('people', () => {
        it('always employed regardless of security/infrastructure/relation', () => {
            expect(computeEmployment('people', -10, 0, 0)).toBe(true);
            expect(computeEmployment('people', 10, 10, 10)).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// AC-6: Displaced ped recovers when thresholds recover same round
// ---------------------------------------------------------------------------

describe('computeEmployment — AC-6 elite recovery', () => {
    it('army: R1 employed → R2 displaced (sec drops) → R3 re-employed (sec recovers)', () => {
        // R1: sec=7, rel=+3
        expect(computeEmployment('military', 3, 7, 5)).toBe(true);

        // R2: sec=2 (< 4) → displaced
        expect(computeEmployment('military', 3, 2, 5)).toBe(false);

        // R3: sec=5 (≥ 4), rel=+1 (≥ 0) → re-employed that same round
        expect(computeEmployment('military', 1, 5, 5)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// AC-17: Body-type lerp at both health extremes
// ---------------------------------------------------------------------------

describe('computeBodyType — AC-17 lerp boundary values', () => {
    it('health=0: fatShare=0.05, slimShare=0.70, fitShare=0.25', () => {
        const t = 0;
        const fat  = FAT_AT_ZERO  + (FAT_AT_MAX  - FAT_AT_ZERO)  * t;
        const slim = SLIM_AT_ZERO + (SLIM_AT_MAX - SLIM_AT_ZERO) * t;
        expect(fat).toBeCloseTo(0.05, 9);
        expect(slim).toBeCloseTo(0.70, 9);
        expect(1 - fat - slim).toBeCloseTo(0.25, 9);
    });

    it('health=10: fatShare=0.40, slimShare=0.15, fitShare=0.45', () => {
        const t = 1;
        const fat  = FAT_AT_ZERO  + (FAT_AT_MAX  - FAT_AT_ZERO)  * t;
        const slim = SLIM_AT_ZERO + (SLIM_AT_MAX - SLIM_AT_ZERO) * t;
        expect(fat).toBeCloseTo(0.40, 9);
        expect(slim).toBeCloseTo(0.15, 9);
        expect(1 - fat - slim).toBeCloseTo(0.45, 9);
    });

    it('health=0 classifications: bodySeed=0.03→fat, 0.20→fit, 0.90→slim', () => {
        expect(computeBodyType(0.03, 0)).toBe('fat');
        expect(computeBodyType(0.20, 0)).toBe('fit');   // 0.20 in [0.05, 0.30)
        expect(computeBodyType(0.90, 0)).toBe('slim');  // 0.90 ≥ 0.30
    });

    it('health=10 classifications: bodySeed=0.03→fat, 0.20→fat, 0.90→slim', () => {
        expect(computeBodyType(0.03, 10)).toBe('fat');  // 0.03 < 0.40
        expect(computeBodyType(0.20, 10)).toBe('fat');  // 0.20 < 0.40 (was fit at health=0)
        expect(computeBodyType(0.90, 10)).toBe('slim'); // 0.90 ≥ 0.85
    });

    it('health=3 (mid-range): bodySeed=0.20 is still fit (fatShare≈0.155, fitShare≈0.305)', () => {
        // fatShare = 0.05 + 0.35*0.3 = 0.155; slimShare = 0.70 - 0.55*0.3 = 0.535; fitShare = 0.31
        // 0.20 > 0.155 (not fat) and 0.20 < 0.155 + 0.31 = 0.465 (fit)
        expect(computeBodyType(0.20, 3)).toBe('fit');
    });
});

// ---------------------------------------------------------------------------
// AC-18: Round-1 volatility = 0 (no phantom whiplash when lastRel == rel)
// ---------------------------------------------------------------------------

describe('computeHappiness — AC-18 round-1 zero volatility', () => {
    it('volatility = 0 when rel=+10 and lastRel=+10 (initialized at generation)', () => {
        // factionFortune = 3 + 0 = 3, charismaTerm = 0, displacement = 0, volatility = 0
        // expected = 5 + 3 = 8.0
        const h = computeHappiness(makeInputs({
            faction: 'military',
            effectiveRelation: 10,
            lastFactionRelation: 10,
            security: 5,
        }));
        expect(h).toBeCloseTo(8.0, 9);
    });

    it('volatility = 0 when rel=-8 and lastRel=-8', () => {
        // factionFortune = (-8/10)*3 + 0 = -2.4, charismaTerm = 0, displacement = 0, volatility = 0
        // expected = 5 - 2.4 = 2.6
        const h = computeHappiness(makeInputs({
            faction: 'military',
            effectiveRelation: -8,
            lastFactionRelation: -8,
            security: 5,
        }));
        expect(h).toBeCloseTo(2.6, 9);
    });
});

// ---------------------------------------------------------------------------
// AC-19: Three-round elite recovery arc (employment + happiness together)
// ---------------------------------------------------------------------------

describe('computeHappiness + computeEmployment — AC-19 three-round arc', () => {
    it('army arc: R1 content → R2 displaced (happiness drops) → R3 re-employed (displacement lifts)', () => {
        // R1: sec=7, rel=+3, lastRel=+3 (initialized), charisma=0, employed
        const employed_r1 = computeEmployment('military', 3, 7, 5);
        const h_r1 = computeHappiness(makeInputs({
            faction: 'military', effectiveRelation: 3, lastFactionRelation: 3,
            security: 7, employed: employed_r1,
        }));
        // factionFortune = 0.9 + 0.4 = 1.3; raw = 5 + 1.3 = 6.3
        expect(employed_r1).toBe(true);
        expect(h_r1).toBeCloseTo(6.3, 9);

        // R2: sec drops to 2 (< 4) → displaced
        const employed_r2 = computeEmployment('military', 3, 2, 5);
        const h_r2 = computeHappiness(makeInputs({
            faction: 'military', effectiveRelation: 3, lastFactionRelation: 3,
            security: 2, employed: employed_r2,
        }));
        // factionFortune = 0.9 + (-0.6) = 0.3; displacement = 2; volatility = 0 (rel unchanged)
        // raw = 5 + 0.3 - 2 = 3.3
        expect(employed_r2).toBe(false);
        expect(h_r2).toBeCloseTo(3.3, 9);

        // R3: sec=5 (≥ 4), rel=+1 (≥ 0) → re-employed; volatility from |+1−+3|*0.4 = 0.8
        const employed_r3 = computeEmployment('military', 1, 5, 5);
        const h_r3 = computeHappiness(makeInputs({
            faction: 'military', effectiveRelation: 1, lastFactionRelation: 3,
            security: 5, employed: employed_r3,
        }));
        // factionFortune = 0.3 + 0 = 0.3; displacement = 0; volatility = 0.8
        // raw = 5 + 0.3 - 0.8 = 4.5
        expect(employed_r3).toBe(true);
        expect(h_r3).toBeCloseTo(4.5, 9);
    });
});

// ---------------------------------------------------------------------------
// Volatility cap
// ---------------------------------------------------------------------------

describe('computeHappiness — volatility cap', () => {
    it('|prevRel=+5, rel=-5|: raw swing * coeff = 4 → capped to 2', () => {
        // Expected: volatility = min(2, |-5-5|*0.4) = min(2, 4) = 2
        // happiness = 5 + factionFortune + charismaTerm - 2
        // factionFortune = (-5/10)*3 + 0 = -1.5; charismaTerm = 0
        // happiness = 5 - 1.5 - 2 = 1.5
        const h = computeHappiness(makeInputs({
            faction: 'military',
            effectiveRelation: -5,
            lastFactionRelation: 5,
            security: 5,
        }));
        expect(h).toBeCloseTo(1.5, 9);
    });
});

// ---------------------------------------------------------------------------
// Tax threshold boundaries
// ---------------------------------------------------------------------------

describe('computeHappiness — tax threshold boundaries', () => {
    it('peopleTax=30 → no penalty (condition is strictly > 30)', () => {
        const hNoTax = computeHappiness(makeInputs({
            faction: 'people', effectiveRelation: 0, lastFactionRelation: 0,
            health: 5, peopleTax: 30,
        }));
        const hBaseline = computeHappiness(makeInputs({
            faction: 'people', effectiveRelation: 0, lastFactionRelation: 0,
            health: 5, peopleTax: 0,
        }));
        expect(hNoTax).toBeCloseTo(hBaseline, 9);
    });

    it('peopleTax=31 → −0.5 penalty fires', () => {
        const hTaxed = computeHappiness(makeInputs({
            faction: 'people', effectiveRelation: 0, lastFactionRelation: 0,
            health: 5, peopleTax: 31,
        }));
        const hBaseline = computeHappiness(makeInputs({
            faction: 'people', effectiveRelation: 0, lastFactionRelation: 0,
            health: 5, peopleTax: 0,
        }));
        expect(hTaxed).toBeCloseTo(hBaseline - 0.5, 9);
    });

    it('businessTax=45 → no penalty (condition is strictly > 45)', () => {
        const hNoTax = computeHappiness(makeInputs({
            faction: 'business', effectiveRelation: 0, lastFactionRelation: 0,
            infrastructure: 5, businessTax: 45,
        }));
        const hBaseline = computeHappiness(makeInputs({
            faction: 'business', effectiveRelation: 0, lastFactionRelation: 0,
            infrastructure: 5, businessTax: 0,
        }));
        expect(hNoTax).toBeCloseTo(hBaseline, 9);
    });

    it('businessTax=46 → −0.5 penalty fires', () => {
        const hTaxed = computeHappiness(makeInputs({
            faction: 'business', effectiveRelation: 0, lastFactionRelation: 0,
            infrastructure: 5, businessTax: 46,
        }));
        const hBaseline = computeHappiness(makeInputs({
            faction: 'business', effectiveRelation: 0, lastFactionRelation: 0,
            infrastructure: 5, businessTax: 0,
        }));
        expect(hTaxed).toBeCloseTo(hBaseline - 0.5, 9);
    });
});
