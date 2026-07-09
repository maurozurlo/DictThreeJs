/**
 * Story 10-4: picker unification — swapLaw adopts the canonical pickNextLaw
 * (fixing the rep-status drift bug: the old inline closure could propose a law
 * from an eliminated faction's representative) with allowWeird: false (swaps
 * have never surfaced weird laws). pickNextDeal is the single deal-draw impl.
 *
 * RNG comes from the seeded cursor (ADR-0010); tests sweep seeds for
 * distribution properties instead of mocking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { pickNextLaw, pickNextDeal } from '../../../src/Stores/RoundResolver';
import { seedRng } from '../../../src/Utils/Math';
import { DEALS } from '../../../src/assets/deals';
import type { GameState } from '../../../src/types/GameState';
import type { Power } from '../../../src/types/Power';

vi.mock('../../../src/i18n', () => ({
    default: { t: (key: string) => key }
}));

const ALL_ACTIVE = { military: 'active', business: 'active', people: 'active' } as const;
type RepStatuses = Record<Power, 'active' | 'sick' | 'eliminated'>;

function freshState(): GameState {
    useGameStore.getState().gameManagement.setPhase('start');
    return useGameStore.getState();
}

describe('pickNextLaw — canonical picker properties', () => {
    beforeEach(() => { freshState(); });

    it('test_picker_excludes_eliminated_faction_laws', () => {
        // Arrange
        const state = useGameStore.getState();
        const statuses: RepStatuses = { ...ALL_ACTIVE, military: 'eliminated' };

        // Act + Assert — across 100 seeds, no military law may surface
        for (let seed = 0; seed < 100; seed++) {
            seedRng(seed);
            const law = pickNextLaw(state, statuses, new Set(), { allowWeird: false });
            expect(law).not.toBeNull();
            expect(law!.power).not.toBe('military');
        }
    });

    it('test_picker_allowweird_false_never_returns_weird', () => {
        const state = useGameStore.getState();
        for (let seed = 0; seed < 200; seed++) {
            seedRng(seed);
            const law = pickNextLaw(state, ALL_ACTIVE, new Set(), { allowWeird: false });
            expect(law!.type).not.toBe('weird');
        }
    });

    it('test_picker_default_allows_weird_laws', () => {
        // Contrast: with the default (nextRound path) the 10% roll must fire
        // for SOME seed in the sweep — proving allowWeird:false actually gates.
        const state = useGameStore.getState();
        let weirdSeen = false;
        for (let seed = 0; seed < 200 && !weirdSeen; seed++) {
            seedRng(seed);
            const law = pickNextLaw(state, ALL_ACTIVE, new Set());
            if (law!.type === 'weird') weirdSeen = true;
        }
        expect(weirdSeen).toBe(true);
    });
});

describe('swapLaw — store action uses the canonical picker', () => {
    beforeEach(() => { freshState(); });

    it('test_swaplaw_never_proposes_eliminated_factions_law', () => {
        // Arrange — eliminate the military representative (drift-bug regression)
        useGameStore.setState((s) => ({
            gameManagement: {
                ...s.gameManagement,
                representativeStatuses: { ...s.gameManagement.representativeStatuses, military: 'eliminated' },
            },
        }));

        // Act + Assert — repeated swaps across seeds
        for (let seed = 0; seed < 60; seed++) {
            seedRng(seed);
            useGameStore.getState().law.swapLaw();
            const current = useGameStore.getState().law.current;
            if (!current) break; // pool exhausted — acceptable end
            expect(current.power).not.toBe('military');
            // keep the pool from exhausting: clear interaction history
            useGameStore.setState((s) => ({ law: { ...s.law, interactedWithLaws: new Set() } }));
        }
    });

    it('test_swaplaw_never_surfaces_weird_laws', () => {
        for (let seed = 0; seed < 100; seed++) {
            seedRng(seed);
            useGameStore.getState().law.swapLaw();
            const current = useGameStore.getState().law.current;
            expect(current?.type).not.toBe('weird');
            useGameStore.setState((s) => ({ law: { ...s.law, interactedWithLaws: new Set() } }));
        }
    });
});

describe('pickNextDeal — single deal-draw implementation', () => {
    it('test_pickdeal_excludes_interacted_deals', () => {
        seedRng(5);
        const used = new Set(DEALS.slice(1)); // everything but DEALS[0]
        const { deal, updatedDeals } = pickNextDeal(used);
        expect(deal).toBe(DEALS[0]);
        expect(updatedDeals.has(DEALS[0])).toBe(true);
    });

    it('test_pickdeal_resets_pool_when_exhausted', () => {
        seedRng(5);
        const used = new Set(DEALS); // all shown
        const { deal, updatedDeals } = pickNextDeal(used);
        expect(deal).not.toBeNull();
        // Reset semantics: the stored set restarts from the fresh draw only
        expect(updatedDeals.size).toBe(1);
    });
});
