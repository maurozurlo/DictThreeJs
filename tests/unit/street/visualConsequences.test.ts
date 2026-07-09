import { describe, it, expect } from 'vitest';
import { getActiveVisualConsequences, VISUAL_CONSEQUENCES } from '../../../src/assets/visualConsequences';
import type { GameState, Modifier } from '../../../src/types/GameState';
import type { Power } from '../../../src/types/Power';

/**
 * Visual Consequence Registry — pure evaluator (TR-lasting-009, formerly Story 2-9).
 *
 * getActiveVisualConsequences reads relations.current, budget.expenditures,
 * gameManagement.round and the active modifier ids (ADR-0008 P2), so the factory
 * builds just that slice and casts (same pattern as ActionHandler.test.ts).
 */

type StateOverrides = {
    relations?: Partial<Record<Power, number>>;
    expenditures?: Partial<Record<'health' | 'infrastructure' | 'security' | 'education', number>>;
    round?: number;
    /** Namespaced ids of active modifiers (e.g. 'laws.39', 'deals.19', 'weird.1001'). */
    modifierIds?: string[];
};

function makeState(overrides: StateOverrides = {}): GameState {
    const modifiers: Modifier[] = (overrides.modifierIds ?? []).map(id => ({
        id,
        type: 'law-recurring',
        state: 'active',
        acquiredRound: 1,
        mods: [],
    }));
    return {
        relations: {
            current: { military: 0, business: 0, people: 0, ...overrides.relations },
        },
        budget: {
            // Mid-range defaults: security < 8, infrastructure > 2 — no entry triggers
            expenditures: { health: 5, infrastructure: 5, security: 5, education: 5, ...overrides.expenditures },
        },
        gameManagement: {
            round: overrides.round ?? 1,
            modifiers,
        },
    } as unknown as GameState;
}

function resultIds(state: GameState): string[] {
    return getActiveVisualConsequences(state).map(e => e.id);
}

describe('getActiveVisualConsequences', () => {
    // AC-1: AND logic — all defined fields must match
    describe('AND logic (AC-1)', () => {
        it('does not include military-checkpoint when security is below the gte bound (7 < 8)', () => {
            const state = makeState({ expenditures: { security: 7 } });
            expect(resultIds(state)).not.toContain('military-checkpoint');
        });

        it('includes military-checkpoint when security equals the gte bound (8)', () => {
            const state = makeState({ expenditures: { security: 8 } });
            expect(resultIds(state)).toContain('military-checkpoint');
        });

        it('includes military-checkpoint when security exceeds the gte bound (9)', () => {
            const state = makeState({ expenditures: { security: 9 } });
            expect(resultIds(state)).toContain('military-checkpoint');
        });

        it('includes dilapidated-buildings only when infrastructure is at or below the lte bound (2)', () => {
            expect(resultIds(makeState({ expenditures: { infrastructure: 2 } }))).toContain('dilapidated-buildings');
            expect(resultIds(makeState({ expenditures: { infrastructure: 3 } }))).not.toContain('dilapidated-buildings');
        });
    });

    // AC-2: Empty result when no conditions match
    it('returns an empty array for a fresh game state (AC-2)', () => {
        expect(getActiveVisualConsequences(makeState())).toEqual([]);
    });

    // AC-3: active modifier id condition
    it('includes casino-sign when the gambling law modifier is active (AC-3)', () => {
        const state = makeState({ modifierIds: ['laws.39'] });
        expect(resultIds(state)).toContain('casino-sign');
    });

    it('does not include casino-sign for a different active modifier id', () => {
        const state = makeState({ modifierIds: ['laws.40'] });
        expect(resultIds(state)).not.toContain('casino-sign');
    });

    // AC-4: Exclusive replacement — public-housing-blocks removes dilapidated-buildings
    it('removes dilapidated-buildings when public-housing-blocks is also active (AC-4)', () => {
        const state = makeState({
            expenditures: { infrastructure: 1 },     // dilapidated condition met
            modifierIds: ['laws.40'],                // public-housing condition met
        });
        const ids = resultIds(state);
        expect(ids).toContain('public-housing-blocks');
        expect(ids).not.toContain('dilapidated-buildings');
    });

    it('keeps dilapidated-buildings when public-housing-blocks is not active', () => {
        const state = makeState({ expenditures: { infrastructure: 1 } });
        expect(resultIds(state)).toContain('dilapidated-buildings');
    });

    // AC-5: Multiple independent entries
    it('returns both military-checkpoint and casino-sign when both conditions hold (AC-5)', () => {
        const state = makeState({
            expenditures: { security: 8 },
            modifierIds: ['laws.39'],
        });
        const ids = resultIds(state);
        expect(ids).toContain('military-checkpoint');
        expect(ids).toContain('casino-sign');
        expect(ids).toHaveLength(2);
    });

    // factionRelation without faction: any faction in range matches
    it('includes faction-coup-crown when any faction relation reaches +6', () => {
        const state = makeState({ relations: { people: 6 } });
        expect(resultIds(state)).toContain('faction-coup-crown');
    });

    it('does not include faction-coup-crown when all relations are below +6', () => {
        const state = makeState({ relations: { military: 5, business: 5, people: 5 } });
        expect(resultIds(state)).not.toContain('faction-coup-crown');
    });

    // weird-law and deal modifier ids drive their stub entries
    it('includes the cemeteries stub when its weird-law modifier is active', () => {
        const state = makeState({ modifierIds: ['weird.1001'] });
        expect(resultIds(state)).toContain('weird-cemeteries');
    });

    // Purity: evaluator does not mutate state or the registry
    it('does not mutate the input state or the registry (purity)', () => {
        const state = makeState({ expenditures: { security: 8 } });
        const registrySnapshot = JSON.stringify(VISUAL_CONSEQUENCES);
        const stateSnapshot = JSON.stringify(state);
        getActiveVisualConsequences(state);
        expect(JSON.stringify(VISUAL_CONSEQUENCES)).toBe(registrySnapshot);
        expect(JSON.stringify(state)).toBe(stateSnapshot);
    });
});
