/**
 * Integration tests for ADR-0008 P3 — content migration + getVisibleModifiers.
 * Story 6-3 / TR-mod-001, TR-street-001.
 *
 * Covers:
 *  - getVisibleModifiers projection (in-window, future-window, rejected, no-mods)
 *  - No modifier created for class-A content (periodic events, mini-challenges)
 *  - Statue (structure) already emits a modifier via buildShopModifier — regression
 */

import { describe, it, expect } from 'vitest';
import { getVisibleModifiers, isWindowActive, resolveWindow } from '../../../src/Utils/Modifiers';
import { buildShopModifier, STATUES } from '../../../src/assets/ShopItems';
import type { Modifier } from '../../../src/types/GameState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModifier(overrides: Partial<Modifier> & Pick<Modifier, 'mods'>): Modifier {
    return {
        id: 'test.1',
        type: 'deal',
        state: 'active',
        acquiredRound: 1,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getVisibleModifiers — projection correctness
// ---------------------------------------------------------------------------

describe('getVisibleModifiers', () => {
    it('includes an active modifier whose window is open at round', () => {
        const m = makeModifier({
            mods: [{ stat: 'roundIncome', amount: 5, window: { startRound: 1, endRound: null } }],
        });
        expect(getVisibleModifiers([m], 3)).toHaveLength(1);
    });

    it('excludes a modifier whose only window has not yet started', () => {
        const m = makeModifier({
            mods: [{ stat: 'roundIncome', amount: 5, window: { startRound: 5, endRound: null } }],
        });
        expect(getVisibleModifiers([m], 3)).toHaveLength(0);
    });

    it('excludes a modifier whose only window has already closed (exclusive upper bound)', () => {
        const m = makeModifier({
            // window: startRound=1, endRound=3 → active for rounds 1,2; NOT round 3
            mods: [{ stat: 'roundIncome', amount: 5, window: { startRound: 1, endRound: 3 } }],
        });
        expect(getVisibleModifiers([m], 3)).toHaveLength(0);
    });

    it('includes a modifier when at least one of its mods is in-window even if others are not', () => {
        const m = makeModifier({
            mods: [
                { stat: 'people', amount: 1, window: { startRound: 1, endRound: 2 } }, // expired at round 3
                { stat: 'roundIncome', amount: 5, window: { startRound: 1, endRound: null } }, // permanent
            ],
        });
        expect(getVisibleModifiers([m], 3)).toHaveLength(1);
    });

    it('excludes a rejected modifier even if its window is open', () => {
        const m = makeModifier({
            state: 'rejected',
            mods: [{ stat: 'roundIncome', amount: 5, window: { startRound: 1, endRound: null } }],
        });
        expect(getVisibleModifiers([m], 3)).toHaveLength(0);
    });

    it('excludes a modifier with no mods (e.g. weird-law slot entry)', () => {
        const m = makeModifier({ type: 'weird-law', mods: [] });
        expect(getVisibleModifiers([m], 3)).toHaveLength(0);
    });

    it('returns only the in-window subset from a mixed array', () => {
        const visible = makeModifier({
            id: 'test.visible',
            mods: [{ stat: 'charisma', amount: 1, window: { startRound: 1, endRound: null } }],
        });
        const future = makeModifier({
            id: 'test.future',
            mods: [{ stat: 'charisma', amount: 1, window: { startRound: 10, endRound: null } }],
        });
        const rejected = makeModifier({
            id: 'test.rejected',
            state: 'rejected',
            mods: [{ stat: 'charisma', amount: 1, window: { startRound: 1, endRound: null } }],
        });
        const result = getVisibleModifiers([visible, future, rejected], 5);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('test.visible');
    });

    it('returns an empty array when modifiers is empty', () => {
        expect(getVisibleModifiers([], 5)).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Class-A content — no modifier (ADR-0008 §3 / story AC: content with no
// recurring/windowed effect creates no lingering modifier)
// ---------------------------------------------------------------------------

describe('Class-A content (periodic events, mini-challenges) — no modifier', () => {
    it('periodic event effects are pure immediate deltas — no modifier shape in the effect object', async () => {
        // Verify by inspection: all PERIODIC_EVENTS options carry only treasury/relation
        // keys (class A base mutations). There is no `mods` or `recurringEffect` field.
        // This test documents the design decision; a regression would be a new option
        // with a `mods` field that should instead push a Modifier on resolve().
        const { PERIODIC_EVENTS } = await import('../../../src/assets/periodicEvents');
        for (const event of PERIODIC_EVENTS) {
            for (const option of event.options) {
                expect(option.effect).not.toHaveProperty('mods');
                expect(option.effect).not.toHaveProperty('recurringEffect');
            }
        }
    });

    it('mini-challenge effects are pure immediate deltas — no modifier shape in the effect objects', async () => {
        const { MINI_CHALLENGES } = await import('../../../src/assets/miniChallenges');
        for (const challenge of MINI_CHALLENGES) {
            expect(challenge.acceptOutcome).not.toHaveProperty('mods');
            expect(challenge.acceptOutcome).not.toHaveProperty('recurringEffect');
            expect(challenge.rejectOutcome).not.toHaveProperty('mods');
            expect(challenge.rejectOutcome).not.toHaveProperty('recurringEffect');
        }
    });
});

// ---------------------------------------------------------------------------
// Structures — statue pattern already emits a modifier (regression guard)
// ---------------------------------------------------------------------------

describe('Structures — buildShopModifier (statue regression)', () => {
    it('each statue tier produces an active modifier with a permanent charisma contribution', () => {
        STATUES.forEach((statue, i) => {
            const round = 3;
            const mod = buildShopModifier(statue, round);
            expect(mod.state).toBe('active');
            expect(mod.type).toBe('statue');
            expect(mod.id).toBe(statue.id);
            expect(mod.mods).toHaveLength(1);
            expect(mod.mods[0].stat).toBe('charisma');
            expect(mod.mods[0].amount).toBe(1);
            // Permanent window: startRound === acquiredRound, endRound === null
            expect(mod.mods[0].window.startRound).toBe(round);
            expect(mod.mods[0].window.endRound).toBeNull();
            // Should be visible immediately
            expect(getVisibleModifiers([mod], round)).toHaveLength(1);
            void i; // suppress lint
        });
    });

    it('statue modifier is visible at all future rounds (permanent window)', () => {
        const mod = buildShopModifier(STATUES[0], 2);
        for (const round of [2, 5, 9, 10, 100]) {
            expect(getVisibleModifiers([mod], round)).toHaveLength(1);
        }
    });
});

// ---------------------------------------------------------------------------
// resolveWindow + isWindowActive boundary (supports getVisibleModifiers logic)
// ---------------------------------------------------------------------------

describe('isWindowActive exclusive-upper-bound (ADR-0008 §5)', () => {
    it('is active at startRound', () => {
        expect(isWindowActive({ startRound: 3, endRound: 5 }, 3)).toBe(true);
    });

    it('is NOT active at endRound (exclusive)', () => {
        expect(isWindowActive({ startRound: 3, endRound: 5 }, 5)).toBe(false);
    });

    it('is active at endRound - 1', () => {
        expect(isWindowActive({ startRound: 3, endRound: 5 }, 4)).toBe(true);
    });

    it('permanent window (endRound null) is active at any future round', () => {
        expect(isWindowActive({ startRound: 1, endRound: null }, 999)).toBe(true);
    });
});
