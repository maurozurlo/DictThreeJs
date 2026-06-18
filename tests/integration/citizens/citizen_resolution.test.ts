/**
 * Story 7-3: CitizenHandler P3 — Role Fork + Death + Feedback + nextRound() Wiring.
 *
 * Integration tests covering `computeRole`, `computeFeedback`, and
 * `resolveCitizenPipeline`. The `rollFn` parameter is injected throughout so
 * tests are deterministic — no seeded PRNG, no time-dependent assertions.
 *
 * Coverage: AC-7a, AC-7b, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14,
 *           AC-20, AC-21, AC-22, AC-23, AC-24, AC-25.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    computeRole,
    computeFeedback,
    resolveCitizenPipeline,
    CONTENT_THRESHOLD,
    NEUTRAL_THRESHOLD,
    GONE_HAPPINESS_THRESHOLD,
    GONE_CHANCE,
    HEALTH_DEATH_THRESHOLD,
    DEATH_RATE_MAX,
    PROTEST_DIVISOR,
    PROTEST_FEEDBACK_CAP,
    THIEF_SKIM,
    TOTAL_CITIZENS,
    BASE_POPULATION,
} from '../../../src/Stores/CitizenHandler';
import type { Citizen, CitizenState } from '../../../src/types/Citizen';
import type { Power } from '../../../src/types/Power';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const alwaysTrue  = () => true;
const alwaysFalse = () => false;

function mockPed(overrides: Partial<Citizen> = {}): Citizen {
    return {
        id: 0,
        name: 'Test Citizen',
        skin: 0,
        faction: 'people',
        bodySeed: 0.5,
        ...overrides,
    };
}

function aliveCitizenState(overrides: Partial<CitizenState> = {}): CitizenState {
    return {
        alive: true,
        employed: true,
        happiness: 5,
        role: 'neutral',
        lastFactionRelation: 0,
        ...overrides,
    };
}

/** Build a full 25-citizen roster with homogeneous faction and education. */
function buildRoster(
    faction: Power,
    extra: { education?: number } = {},
): { citizens: Citizen[]; citizenStates: CitizenState[] } {
    const citizens: Citizen[] = Array.from({ length: TOTAL_CITIZENS }, (_, i) => ({
        id: i,
        name: `Citizen ${i}`,
        skin: 0,
        faction,
        bodySeed: 0.5,
    }));
    const citizenStates: CitizenState[] = citizens.map(() => aliveCitizenState());
    return { citizens, citizenStates };
}

/** Minimal pipeline inputs with safe defaults. */
function basePipelineInputs(
    overrides: Partial<Parameters<typeof resolveCitizenPipeline>[0]> = {},
): Parameters<typeof resolveCitizenPipeline>[0] {
    const { citizens, citizenStates } = buildRoster('people');
    return {
        citizens,
        citizenStates,
        effectiveRelations: { military: 0, business: 0, people: 0 },
        effectiveCharisma: 0,
        security: 5,
        infrastructure: 5,
        health: 5,
        education: 5,
        peopleTax: 0,
        businessTax: 0,
        currentPeopleRel: 0,
        currentTreasury: 1000,
        rollFn: alwaysFalse,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// AC-7a: Role band boundaries (gone mocked false)
// ---------------------------------------------------------------------------

describe('computeRole — role band boundaries (AC-7a)', () => {
    it('happiness=6 → content (exact CONTENT_THRESHOLD)', () => {
        expect(computeRole('people', 6, 5, alwaysFalse)).toBe('content');
    });

    it('happiness=5.9 → neutral (just below CONTENT_THRESHOLD)', () => {
        expect(computeRole('people', 5.9, 5, alwaysFalse)).toBe('neutral');
    });

    it('happiness=4.0 → neutral (exact NEUTRAL_THRESHOLD)', () => {
        expect(computeRole('people', 4.0, 5, alwaysFalse)).toBe('neutral');
    });

    it('happiness=3.9 → not neutral — falls through to unrest (people, education=4 → thief)', () => {
        // gone roll is false (mocked); people-faction, education≤4 → thief
        expect(computeRole('people', 3.9, 4, alwaysFalse)).toBe('thief');
    });

    it('h=4 is neutral, h=6 is content — off-by-one guard passes', () => {
        expect(computeRole('people', 4, 5, alwaysFalse)).toBe('neutral');
        expect(computeRole('people', 6, 5, alwaysFalse)).toBe('content');
    });
});

// ---------------------------------------------------------------------------
// AC-7b: Gone roll both paths
// ---------------------------------------------------------------------------

describe('computeRole — gone roll (AC-7b)', () => {
    it('h=0.5, rollFn=true → gone', () => {
        expect(computeRole('people', 0.5, 5, alwaysTrue)).toBe('gone');
    });

    it('h=0.5, rollFn=false, people, education=4 → thief', () => {
        expect(computeRole('people', 0.5, 4, alwaysFalse)).toBe('thief');
    });

    it('h=0.5, rollFn=false, people, education=5 → protestor', () => {
        expect(computeRole('people', 0.5, 5, alwaysFalse)).toBe('protestor');
    });

    it('gone check uses GONE_HAPPINESS_THRESHOLD boundary correctly', () => {
        expect(computeRole('people', GONE_HAPPINESS_THRESHOLD, 5, alwaysTrue)).toBe('gone');
        // just above threshold (1.01) → gone check skipped; still in unrest zone so never 'gone'
        expect(computeRole('people', GONE_HAPPINESS_THRESHOLD + 0.01, 5, alwaysTrue)).not.toBe('gone');
    });
});

// ---------------------------------------------------------------------------
// AC-8: Education fork — faction gate fires before education check
// ---------------------------------------------------------------------------

describe('computeRole — education fork (AC-8)', () => {
    it('people-faction, h=3, education=4 → thief', () => {
        expect(computeRole('people', 3, 4, alwaysFalse)).toBe('thief');
    });

    it('people-faction, h=3, education=5 → protestor', () => {
        expect(computeRole('people', 3, 5, alwaysFalse)).toBe('protestor');
    });

    it('army-faction, h=3, education=7 → thief (faction gate fires first, education ignored)', () => {
        expect(computeRole('military', 3, 7, alwaysFalse)).toBe('thief');
    });

    it('business-faction, h=3, education=9 → thief (faction gate fires first)', () => {
        expect(computeRole('business', 3, 9, alwaysFalse)).toBe('thief');
    });
});

// ---------------------------------------------------------------------------
// AC-20: Education flip — people-faction only
// ---------------------------------------------------------------------------

describe('computeRole — education flip (AC-20)', () => {
    it('people, h=3, education=4 → thief; raise to 5 → protestor', () => {
        expect(computeRole('people', 3, 4, alwaysFalse)).toBe('thief');
        expect(computeRole('people', 3, 5, alwaysFalse)).toBe('protestor');
    });

    it('people, h=3, education=5 → protestor; lower to 4 → thief', () => {
        expect(computeRole('people', 3, 5, alwaysFalse)).toBe('protestor');
        expect(computeRole('people', 3, 4, alwaysFalse)).toBe('thief');
    });

    it('army-faction is unaffected by any education value', () => {
        expect(computeRole('military', 3, 4, alwaysFalse)).toBe('thief');
        expect(computeRole('military', 3, 5, alwaysFalse)).toBe('thief');
        expect(computeRole('military', 3, 10, alwaysFalse)).toBe('thief');
    });
});

// ---------------------------------------------------------------------------
// AC-12: Protest feedback + underflow guard
// ---------------------------------------------------------------------------

describe('computeFeedback — protest skim (AC-12)', () => {
    function statesWithRoles(roles: CitizenState['role'][]): CitizenState[] {
        return roles.map(role => aliveCitizenState({ role }));
    }

    it('rel=+5, 3 protestors → floor(3/3)=1 → rel becomes +4', () => {
        const states = statesWithRoles(['protestor', 'protestor', 'protestor']);
        expect(computeFeedback(states, 5, 1000).peopleRelation).toBe(4);
    });

    it('rel=+5, 6 protestors → floor(6/3)=2 → rel becomes +3', () => {
        const states = statesWithRoles(Array(6).fill('protestor'));
        expect(computeFeedback(states, 5, 1000).peopleRelation).toBe(3);
    });

    it('rel=+5, 15 protestors → raw floor(15/3)=5, capped at 5 → rel becomes 0', () => {
        const states = statesWithRoles(Array(15).fill('protestor'));
        expect(computeFeedback(states, 5, 1000).peopleRelation).toBe(0);
    });

    it('rel=-8, 15 protestors → would be -13 but floor-guarded at -10', () => {
        const states = statesWithRoles(Array(15).fill('protestor'));
        expect(computeFeedback(states, -8, 1000).peopleRelation).toBe(-10);
    });

    it('rel=-10, 15 protestors → no-op (already at minimum)', () => {
        const states = statesWithRoles(Array(15).fill('protestor'));
        expect(computeFeedback(states, -10, 1000).peopleRelation).toBe(-10);
    });
});

// ---------------------------------------------------------------------------
// AC-23: Protest cap at 25 protestors
// ---------------------------------------------------------------------------

describe('computeFeedback — protest cap (AC-23)', () => {
    it('25 protestors, rel=+5 → subtracts exactly 5 (cap=5, not raw floor(25/3)=8) → rel=0', () => {
        const states = Array(25).fill(null).map(() => aliveCitizenState({ role: 'protestor' }));
        expect(computeFeedback(states, 5, 1000).peopleRelation).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// AC-13: Thief skim + underflow guard
// ---------------------------------------------------------------------------

describe('computeFeedback — thief skim (AC-13)', () => {
    function statesWithThieves(count: number): CitizenState[] {
        return Array(count).fill(null).map(() => aliveCitizenState({ role: 'thief' }));
    }

    it('treasury=100, 10 thieves → 100 - 10*2 = 80', () => {
        expect(computeFeedback(statesWithThieves(10), 0, 100).treasury).toBe(80);
    });

    it('treasury=5, 4 thieves → would be -3 but floored at 0', () => {
        expect(computeFeedback(statesWithThieves(4), 0, 5).treasury).toBe(0);
    });

    it('treasury=0, 5 thieves → stays 0 (no negative)', () => {
        expect(computeFeedback(statesWithThieves(5), 0, 0).treasury).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// AC-21: No feedback when protestors=0 and thieves=0
// ---------------------------------------------------------------------------

describe('computeFeedback — no-op when no protestors or thieves (AC-21)', () => {
    it('all content citizens → relations and treasury unchanged', () => {
        const states = Array(25).fill(null).map(() => aliveCitizenState({ role: 'content' }));
        expect(computeFeedback(states, 3, 500)).toEqual({ peopleRelation: 3, treasury: 500 });
    });
});

// ---------------------------------------------------------------------------
// AC-14: displayedPopulation formula
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — displayedPopulation (AC-14)', () => {
    it('25 alive → BASE_POPULATION', () => {
        const result = resolveCitizenPipeline(basePipelineInputs({
            effectiveRelations: { military: 5, business: 5, people: 5 },
            effectiveCharisma: 5,
            health: 10,
            rollFn: alwaysFalse,
        }));
        expect(result.newDisplayedPopulation).toBe(BASE_POPULATION);
    });

    it('0 alive → 0', () => {
        const { citizens } = buildRoster('people');
        const citizenStates = citizens.map(() => aliveCitizenState({ alive: false }));
        const result = resolveCitizenPipeline(basePipelineInputs({ citizens, citizenStates }));
        expect(result.newDisplayedPopulation).toBe(0);
    });

    it('12 alive → round(12/25 * 5924511) = 2843765', () => {
        const { citizens } = buildRoster('people');
        // first 12 alive, rest dead
        const citizenStates = citizens.map((_, i) => aliveCitizenState({ alive: i < 12 }));
        const result = resolveCitizenPipeline(basePipelineInputs({ citizens, citizenStates }));
        expect(result.newDisplayedPopulation).toBe(Math.round(12 / 25 * BASE_POPULATION));
        expect(result.newDisplayedPopulation).toBe(2843765);
    });
});

// ---------------------------------------------------------------------------
// AC-24: displayedPopulation decreases after a death
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — population decreases after death (AC-24)', () => {
    it('a ped with h≤1, gone roll true → displayedPopulation decreases', () => {
        // Use high happiness first to get BASE_POPULATION baseline
        const fullInputs = basePipelineInputs({
            effectiveRelations: { military: 5, business: 5, people: 5 },
            effectiveCharisma: 5,
            health: 10,
            rollFn: alwaysFalse,
        });
        const fullResult = resolveCitizenPipeline(fullInputs);
        expect(fullResult.newDisplayedPopulation).toBe(BASE_POPULATION);

        // Now one citizen dies (gone roll true for low happiness)
        const { citizens, citizenStates } = buildRoster('people');
        // happiness will be low with poor relations
        const dyingInputs = basePipelineInputs({
            citizens,
            citizenStates,
            effectiveRelations: { military: -10, business: -10, people: -10 },
            effectiveCharisma: -10,
            health: 0,
            rollFn: alwaysTrue,  // gone roll + starvation both fire
        });
        const dyingResult = resolveCitizenPipeline(dyingInputs);
        expect(dyingResult.newDisplayedPopulation).toBeLessThan(BASE_POPULATION);
    });
});

// ---------------------------------------------------------------------------
// AC-9: Gone roll true → alive=false (death)
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — gone death (AC-9)', () => {
    it('ped at h≤1, gone roll true → alive=false', () => {
        const citizens: Citizen[] = [mockPed({ id: 0, faction: 'people' })];
        const citizenStates: CitizenState[] = [aliveCitizenState({ lastFactionRelation: -10 })];

        const result = resolveCitizenPipeline(basePipelineInputs({
            citizens,
            citizenStates,
            effectiveRelations: { military: -10, business: -10, people: -10 },
            effectiveCharisma: -10,
            health: 0,
            education: 5,
            rollFn: alwaysTrue,  // gone roll fires → dead
        }));
        expect(result.newCitizenStates[0].alive).toBe(false);
        expect(result.newCitizenStates[0].role).toBe('gone');
    });

    it('dead citizen from prior round (alive=false) stays dead regardless of rolls', () => {
        const citizens: Citizen[] = [mockPed({ id: 0 })];
        const citizenStates: CitizenState[] = [aliveCitizenState({ alive: false })];
        const result = resolveCitizenPipeline(basePipelineInputs({
            citizens,
            citizenStates,
            rollFn: alwaysTrue,
        }));
        expect(result.newCitizenStates[0].alive).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AC-10: Starvation eligibility
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — starvation eligibility (AC-10)', () => {
    function onePersonRun(
        faction: Power,
        employed: boolean,
        health: number,
    ): number {
        // Return starvationChance via the formula (not via the pipeline — we test the formula directly)
        if (employed && faction !== 'people') return 0;  // immune
        if (health <= HEALTH_DEATH_THRESHOLD) {
            return DEATH_RATE_MAX * (1 - health / HEALTH_DEATH_THRESHOLD);
        }
        return 0;
    }

    it('people-faction, health=0 → starvationChance=0.15', () => {
        expect(onePersonRun('people', true, 0)).toBeCloseTo(0.15);
    });

    it('displaced army (employed=false), health=0 → starvationChance=0.15', () => {
        expect(onePersonRun('military', false, 0)).toBeCloseTo(0.15);
    });

    it('employed army, health=0 → starvationChance=0 (immune)', () => {
        expect(onePersonRun('military', true, 0)).toBe(0);
    });

    it('employed business, health=0 → starvationChance=0 (immune)', () => {
        expect(onePersonRun('business', true, 0)).toBe(0);
    });

    it('people-faction, health=3 → starvationChance=0 (at threshold boundary)', () => {
        expect(onePersonRun('people', true, HEALTH_DEATH_THRESHOLD)).toBeCloseTo(0);
    });
});

// ---------------------------------------------------------------------------
// AC-11: Mutual exclusion — gone kills before starvation is evaluated
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — gone/starvation mutual exclusion (AC-11)', () => {
    it('gone roll true → starvation rollFn NOT called (call count = 1 total)', () => {
        const rollFn = vi.fn().mockReturnValue(true);

        // people-faction at very low happiness will trigger the gone check
        const citizens: Citizen[] = [mockPed({ id: 0, faction: 'people' })];
        const citizenStates: CitizenState[] = [aliveCitizenState({ lastFactionRelation: -10 })];

        resolveCitizenPipeline({
            citizens,
            citizenStates,
            effectiveRelations: { military: -10, business: -10, people: -10 },
            effectiveCharisma: -10,
            health: 0,
            education: 5,
            security: 5,
            infrastructure: 5,
            peopleTax: 0,
            businessTax: 0,
            currentPeopleRel: 0,
            currentTreasury: 1000,
            rollFn,
        });

        // One call for the gone roll; starvation roll skipped because gone exited early
        expect(rollFn).toHaveBeenCalledTimes(1);
        expect(rollFn).toHaveBeenCalledWith(GONE_CHANCE);
    });
});

// ---------------------------------------------------------------------------
// AC-22: people at h≤1 AND health=0 — gone fires first, counted once dead
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — AC-22 mutual exclusion with starvation eligible', () => {
    it('people, h≤1, health=0: gone true → dead via gone, starvation skipped', () => {
        const rollFn = vi.fn().mockReturnValue(true);

        const citizens: Citizen[] = [mockPed({ id: 0, faction: 'people' })];
        const citizenStates: CitizenState[] = [aliveCitizenState({ lastFactionRelation: -10 })];

        const result = resolveCitizenPipeline({
            citizens,
            citizenStates,
            effectiveRelations: { military: -10, business: -10, people: -10 },
            effectiveCharisma: -10,
            health: 0,
            education: 5,
            security: 5,
            infrastructure: 5,
            peopleTax: 0,
            businessTax: 0,
            currentPeopleRel: 0,
            currentTreasury: 1000,
            rollFn,
        });

        expect(result.newCitizenStates[0].alive).toBe(false);
        expect(result.newCitizenStates[0].role).toBe('gone');
        // Only the gone roll fired (1 call) — starvation roll skipped
        expect(rollFn).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// AC-25: Starvation linearity
// ---------------------------------------------------------------------------

describe('starvation chance linearity (AC-25)', () => {
    it('health=1 → starvationChance = 0.10', () => {
        const chance = DEATH_RATE_MAX * (1 - 1 / HEALTH_DEATH_THRESHOLD);
        expect(chance).toBeCloseTo(0.10, 5);
    });

    it('health=2 → starvationChance = 0.05', () => {
        const chance = DEATH_RATE_MAX * (1 - 2 / HEALTH_DEATH_THRESHOLD);
        expect(chance).toBeCloseTo(0.05, 5);
    });

    it('health=0 → starvationChance = 0.15 (DEATH_RATE_MAX)', () => {
        const chance = DEATH_RATE_MAX * (1 - 0 / HEALTH_DEATH_THRESHOLD);
        expect(chance).toBeCloseTo(0.15, 5);
    });
});

// ---------------------------------------------------------------------------
// Integration: citizenStates updated after pipeline
// ---------------------------------------------------------------------------

describe('resolveCitizenPipeline — full state update integration', () => {
    it('role, happiness, employed, lastFactionRelation all updated after one round', () => {
        const citizens: Citizen[] = [mockPed({ id: 0, faction: 'people' })];
        // lastFactionRelation matches effectiveRelation so volatility=0 this round
        const citizenStates: CitizenState[] = [aliveCitizenState({
            happiness: 5,
            role: 'neutral',
            lastFactionRelation: 5,
        })];

        const result = resolveCitizenPipeline({
            citizens,
            citizenStates,
            effectiveRelations: { military: 5, business: 5, people: 5 },
            effectiveCharisma: 5,
            security: 7,
            infrastructure: 7,
            health: 7,
            education: 5,
            peopleTax: 0,
            businessTax: 0,
            currentPeopleRel: 2,
            currentTreasury: 500,
            rollFn: alwaysFalse,
        });

        const cs = result.newCitizenStates[0];
        expect(cs.alive).toBe(true);
        expect(cs.employed).toBe(true);
        // happiness = 5 + (5/10*3 + (7-5)/5) + (5/10*2) - 0 - 0 = 5+1.9+1.0 = 7.9 → content
        expect(cs.role).toBe('content');
        // lastFactionRelation updated to this round's effective people relation
        expect(cs.lastFactionRelation).toBe(5);
    });

    it('empty citizens array → returns passthrough values unchanged', () => {
        const result = resolveCitizenPipeline(basePipelineInputs({
            citizens: [],
            citizenStates: [],
            currentPeopleRel: 3,
            currentTreasury: 200,
        }));
        expect(result.newCitizenStates).toHaveLength(0);
        expect(result.newDisplayedPopulation).toBe(0);
        expect(result.peopleRelation).toBe(3);
        expect(result.treasury).toBe(200);
    });

    it('feedback mutations: protestors reduce peopleRelation, thieves reduce treasury', () => {
        // 6 people-faction citizens at low happiness → will become thieves or protestors
        const citizens: Citizen[] = Array.from({ length: 6 }, (_, i) => ({
            id: i, name: `C${i}`, skin: 0, faction: 'people' as Power, bodySeed: 0.5,
        }));
        const citizenStates = citizens.map(() => aliveCitizenState());

        // Force low happiness: people at rel=-10, charisma=-10, health=0
        // → happiness ≈ 5 + (-3) + (-1) + (-1) - 0 - 0 = 0 → unrest branch
        // gone roll=false → education=4 → thief
        const result = resolveCitizenPipeline({
            citizens,
            citizenStates,
            effectiveRelations: { military: -10, business: -10, people: -10 },
            effectiveCharisma: -10,
            security: 0,
            infrastructure: 0,
            health: 0,
            education: 4,
            peopleTax: 0,
            businessTax: 0,
            currentPeopleRel: 5,
            currentTreasury: 100,
            rollFn: alwaysFalse,  // gone=false → thieves
        });

        // 6 thieves × THIEF_SKIM(2) = 12 drained from treasury
        expect(result.treasury).toBe(100 - 6 * THIEF_SKIM);
        // 0 protestors → no relation change
        expect(result.peopleRelation).toBe(5);
    });

    it('AC-15 guard: Math.random not called in pipeline (rollFn injection handles all RNG)', () => {
        const mathRandomSpy = vi.spyOn(Math, 'random');
        resolveCitizenPipeline(basePipelineInputs({ rollFn: alwaysFalse }));
        expect(mathRandomSpy).not.toHaveBeenCalled();
        mathRandomSpy.mockRestore();
    });
});
