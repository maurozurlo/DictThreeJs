import { describe, it, expect } from 'vitest';
import { getActiveVisualConsequences, VISUAL_CONSEQUENCES } from './visualConsequences';
import type { GameState, ActiveRecurringEffect } from '../types/GameState';
import type { Power } from '../types/Power';

/**
 * Story 2-9: Visual Consequence Registry — pure evaluator (TR-lasting-009).
 *
 * getActiveVisualConsequences only reads relations.current, budget.expenditures,
 * gameManagement.round and gameManagement.activeRecurringEffects, so the factory
 * builds just that slice and casts (same pattern as ActionHandler.test.ts).
 */

type StateOverrides = {
    relations?: Partial<Record<Power, number>>;
    expenditures?: Partial<Record<'health' | 'infrastructure' | 'security' | 'education', number>>;
    round?: number;
    activeEffects?: Array<Partial<ActiveRecurringEffect> & { sourceId: string }>;
};

function makeState(overrides: StateOverrides = {}): GameState {
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
            activeRecurringEffects: (overrides.activeEffects ?? []).map(e => ({
                sourceType: 'law',
                sourceFaction: 'business',
                label: 'laws.recurring.test',
                incomeBonus: 0,
                expenseBonus: 0,
                roundActivated: 1,
                ...e,
            })),
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

    // AC-3: activeRecurringEffectId condition
    it('includes casino-sign when the gambling law recurring effect is active (AC-3)', () => {
        const state = makeState({ activeEffects: [{ sourceId: 'law-39' }] });
        expect(resultIds(state)).toContain('casino-sign');
    });

    it('does not include casino-sign for a different active sourceId', () => {
        const state = makeState({ activeEffects: [{ sourceId: 'law-40' }] });
        expect(resultIds(state)).not.toContain('casino-sign');
    });

    // AC-4: Exclusive replacement — public-housing-blocks removes dilapidated-buildings
    it('removes dilapidated-buildings when public-housing-blocks is also active (AC-4)', () => {
        const state = makeState({
            expenditures: { infrastructure: 1 },           // dilapidated condition met
            activeEffects: [{ sourceId: 'law-40' }],        // public-housing condition met
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
            activeEffects: [{ sourceId: 'law-39' }],
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
