/**
 * Unit tests for CitizenHandler P1 — Generation + Immutable Identity (Story 7-1).
 *
 * Tests control randomness via seedRng(fixed) — never by spying Math.random()
 * (ADR-0010: draw helpers no longer call Math.random).
 *
 * Test file: tests/unit/citizens/citizen_generation.test.ts
 * Implementation: src/Stores/CitizenHandler.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { seedRng, getRngState, setRngState } from '../../../src/Utils/Math';
import { buildCitizenRoster, TOTAL_CITIZENS } from '../../../src/Stores/CitizenHandler';
import type { Power } from '../../../src/types/Power';

const INITIAL_RELATIONS: Record<Power, number> = { military: 0, business: 0, people: 0 };

describe('CitizenHandler — generation', () => {

    beforeEach(() => {
        seedRng(42);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // AC-1a: 25 citizens with exact 11 / 7 / 7 split
    // -------------------------------------------------------------------------

    it('returns exactly 25 citizens', () => {
        const { citizens } = buildCitizenRoster(INITIAL_RELATIONS);
        expect(citizens).toHaveLength(TOTAL_CITIZENS);
    });

    it('has exactly 11 people, 7 military, 7 business (fixed faction split)', () => {
        const { citizens } = buildCitizenRoster(INITIAL_RELATIONS);
        const people   = citizens.filter(c => c.faction === 'people').length;
        const military = citizens.filter(c => c.faction === 'military').length;
        const business = citizens.filter(c => c.faction === 'business').length;
        expect(people).toBe(11);
        expect(military).toBe(7);
        expect(business).toBe(7);
    });

    // -------------------------------------------------------------------------
    // AC-1b: Seed determinism — same seed → identical roster
    // -------------------------------------------------------------------------

    it('produces identical rosters for the same seed', () => {
        seedRng(1);
        const { citizens: first } = buildCitizenRoster(INITIAL_RELATIONS);

        seedRng(1);
        const { citizens: second } = buildCitizenRoster(INITIAL_RELATIONS);

        for (let i = 0; i < TOTAL_CITIZENS; i++) {
            expect(second[i].name).toBe(first[i].name);
            expect(second[i].skin).toBe(first[i].skin);
            expect(second[i].faction).toBe(first[i].faction);
            expect(second[i].bodySeed).toBe(first[i].bodySeed);
        }
    });

    it('produces different rosters for different seeds', () => {
        seedRng(1);
        const { citizens: rosterA } = buildCitizenRoster(INITIAL_RELATIONS);

        seedRng(9999);
        const { citizens: rosterB } = buildCitizenRoster(INITIAL_RELATIONS);

        // Statistically, at least one name will differ across two different seeds.
        const anyDiffers = rosterA.some((c, i) => c.name !== rosterB[i].name);
        expect(anyDiffers).toBe(true);
    });

    // -------------------------------------------------------------------------
    // AC-2: Faction assignment is fixed by index (not RNG-driven)
    // -------------------------------------------------------------------------

    it('assigns faction by fixed index regardless of seed', () => {
        for (const seed of [1, 42, 999]) {
            seedRng(seed);
            const { citizens } = buildCitizenRoster(INITIAL_RELATIONS);

            // people: indices 0–10
            for (let i = 0; i <= 10; i++) {
                expect(citizens[i].faction).toBe('people');
            }
            // military: indices 11–17
            for (let i = 11; i <= 17; i++) {
                expect(citizens[i].faction).toBe('military');
            }
            // business: indices 18–24
            for (let i = 18; i <= 24; i++) {
                expect(citizens[i].faction).toBe('business');
            }
        }
    });

    // -------------------------------------------------------------------------
    // bodySeed range and seeded source
    // -------------------------------------------------------------------------

    it('all bodySeed values are in [0, 1)', () => {
        const { citizens } = buildCitizenRoster(INITIAL_RELATIONS);
        for (const c of citizens) {
            expect(c.bodySeed).toBeGreaterThanOrEqual(0);
            expect(c.bodySeed).toBeLessThan(1);
        }
    });

    it('advances the RNG cursor (bodySeed drawn from seeded cursor, not Math.random)', () => {
        seedRng(42);
        const cursorBefore = getRngState();
        // Install spy after reseed so it only covers the handler call (not seedRng itself)
        const mathRandomSpy = vi.spyOn(Math, 'random');

        buildCitizenRoster(INITIAL_RELATIONS);

        const cursorAfter = getRngState();

        // Math.random must not have been called by CitizenHandler (ADR-0010)
        expect(mathRandomSpy).not.toHaveBeenCalled();
        // The seeded cursor must have advanced (draws happened)
        expect(cursorAfter).not.toBe(cursorBefore);
    });

    // -------------------------------------------------------------------------
    // Save/load determinism (Edge Case 11)
    // -------------------------------------------------------------------------

    it('cursor-save / cursor-restore round trip produces identical roster (Edge Case 11)', () => {
        // Save cursor BEFORE generation, so restoring it replays the same stream
        seedRng(7);
        const cursorBeforeGeneration = getRngState();
        const { citizens: first } = buildCitizenRoster(INITIAL_RELATIONS);

        // Exhaust entropy with a different seed to prove restoration works
        seedRng(99999);
        buildCitizenRoster(INITIAL_RELATIONS);

        // Restore to the pre-generation position and re-generate
        setRngState(cursorBeforeGeneration);
        const { citizens: second } = buildCitizenRoster(INITIAL_RELATIONS);

        // All 25 identity fields must be identical — this is the save-scum-resistance guarantee
        for (let i = 0; i < TOTAL_CITIZENS; i++) {
            expect(second[i].name, `citizen ${i} name`).toBe(first[i].name);
            expect(second[i].skin, `citizen ${i} skin`).toBe(first[i].skin);
            expect(second[i].bodySeed, `citizen ${i} bodySeed`).toBe(first[i].bodySeed);
        }
    });

    it('boundary seeds (0 and MAX_SAFE_INTEGER) produce valid 25-citizen rosters', () => {
        for (const seed of [0, Number.MAX_SAFE_INTEGER]) {
            seedRng(seed);
            const { citizens } = buildCitizenRoster(INITIAL_RELATIONS);
            expect(citizens).toHaveLength(TOTAL_CITIZENS);
            // All bodySeed values must be valid [0, 1)
            expect(citizens.every(c => c.bodySeed >= 0 && c.bodySeed < 1)).toBe(true);
        }
    });

    // -------------------------------------------------------------------------
    // CitizenState initial values (Story 7-1 — P2/P3 recompute from round 1)
    // -------------------------------------------------------------------------

    // AC-2 DEFERRED: Identity fields immutable after round resolution cannot be
    // tested here because computeHappiness / nextRound() are implemented in
    // Stories 7-2 and 7-3. Immutability test lives in citizen_employment_happiness.test.ts.

    it('initializes citizenStates with alive=true and lastFactionRelation matching initialRelations', () => {
        const rels: Record<Power, number> = { military: 3, business: -2, people: 1 };
        seedRng(42);
        const { citizens, citizenStates } = buildCitizenRoster(rels);

        expect(citizenStates).toHaveLength(TOTAL_CITIZENS);
        for (let i = 0; i < TOTAL_CITIZENS; i++) {
            expect(citizenStates[i].alive).toBe(true);
            expect(citizenStates[i].lastFactionRelation).toBe(rels[citizens[i].faction]);
        }
    });

});
