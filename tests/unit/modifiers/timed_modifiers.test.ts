/**
 * Timed Modifier Engine — ADR-0008 Phase 1 unit tests.
 *
 * Covers the pure read-through engine in src/Utils/Modifiers.ts: window activity,
 * round-aware summation, effective charisma/relation getters (re-clamped ±10),
 * the onStart fire-once guard, and legacy-save normalization. The statue
 * behaviour-preservation regression lives in tests/unit/shop/statue_charisma.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
    isWindowActive,
    sumModifiers,
    getEffectiveCharisma,
    getEffectiveRelation,
    fireOnStartModifiers,
    resolveWindow,
    normalizeModifier,
} from '../../../src/Utils/Modifiers';
import type { Modifier, ModifierStat, ResolvedWindow } from '../../../src/types/GameState';

// --- factories (no shared mutable state) ---
function mod(over: Partial<Modifier> & { mods: Modifier['mods'] }): Modifier {
    return {
        id: 'test.0',
        type: 'deal',
        state: 'active',
        acquiredRound: 0,
        ...over,
    };
}
function statMod(stat: ModifierStat, amount: number, window: ResolvedWindow) {
    return { stat, amount, window };
}
const permanent = (start = 0): ResolvedWindow => ({ startRound: start, endRound: null });

describe('isWindowActive — exclusive upper bound', () => {
    it('test_window_active_within_bounds_exclusive_upper', () => {
        const w: ResolvedWindow = { startRound: 5, endRound: 7 };
        expect([4, 5, 6, 7, 8].map(r => isWindowActive(w, r))).toEqual([false, true, true, false, false]);
    });

    it('test_window_permanent_active_once_started', () => {
        const w = permanent(3);
        expect(isWindowActive(w, 2)).toBe(false);
        expect(isWindowActive(w, 3)).toBe(true);
        expect(isWindowActive(w, 999)).toBe(true);
    });
});

describe('resolveWindow — registry resolution at acquisition', () => {
    it('test_resolve_immediate_permanent', () => {
        expect(resolveWindow(0, 4)).toEqual({ startRound: 4, endRound: null });
    });
    it('test_resolve_one_round_now', () => {
        expect(resolveWindow(1, 4)).toEqual({ startRound: 4, endRound: 5 });
    });
    it('test_resolve_delayed_two_then_permanent', () => {
        expect(resolveWindow(2, 4)).toEqual({ startRound: 6, endRound: null });
    });
});

describe('sumModifiers — round-aware, active-only', () => {
    it('test_one_round_people_bump_active_exactly_one_round', () => {
        const r = 3;
        const m = mod({ mods: [statMod('people', 1, { startRound: r, endRound: r + 1 })] });
        expect(sumModifiers([m], 'people', r)).toBe(1);
        expect(sumModifiers([m], 'people', r + 1)).toBe(0);
        expect(sumModifiers([m], 'people', r + 2)).toBe(0);
    });

    it('test_delayed_round_income_contributes_after_delay', () => {
        const r = 1;
        const m = mod({ mods: [statMod('roundIncome', 5, resolveWindow(2, r))] }); // start r+2
        expect(sumModifiers([m], 'roundIncome', r)).toBe(0);
        expect(sumModifiers([m], 'roundIncome', r + 1)).toBe(0);
        expect(sumModifiers([m], 'roundIncome', r + 2)).toBe(5);
        expect(sumModifiers([m], 'roundIncome', r + 3)).toBe(5);
    });

    it('test_rejected_modifier_not_summed', () => {
        const m = mod({ state: 'rejected', mods: [statMod('charisma', 5, permanent())] });
        expect(sumModifiers([m], 'charisma', 0)).toBe(0);
    });
});

describe('getEffectiveCharisma / getEffectiveRelation — re-clamp ±10', () => {
    it('test_effective_relation_reclamped_at_max', () => {
        const m = mod({ mods: [statMod('military', 3, permanent())] });
        expect(getEffectiveRelation(10, [m], 'military', 0)).toBe(10); // 13 clamped to 10
    });

    it('test_effective_relation_reclamped_at_min', () => {
        const m = mod({ mods: [statMod('military', -3, permanent())] });
        expect(getEffectiveRelation(-9, [m], 'military', 0)).toBe(-10); // -12 clamped to -10
    });

    it('test_effective_relation_equals_base_when_no_modifier', () => {
        expect(getEffectiveRelation(4, [], 'people', 0)).toBe(4);
    });

    it('test_effective_charisma_sums_in_window_only', () => {
        const m = mod({ mods: [statMod('charisma', 2, { startRound: 5, endRound: 7 })] });
        expect(getEffectiveCharisma(1, [m], 4)).toBe(1); // not started
        expect(getEffectiveCharisma(1, [m], 5)).toBe(3); // active
        expect(getEffectiveCharisma(1, [m], 7)).toBe(1); // expired (exclusive)
    });
});

describe('fireOnStartModifiers — fire-once guard', () => {
    it('test_onstart_fires_once_at_trigger_round', () => {
        const m = mod({ onStartTriggerRound: 4, onStartFired: false, mods: [statMod('roundIncome', 5, resolveWindow(2, 2))] });

        // before trigger: nothing fires
        const before = fireOnStartModifiers([m], 3);
        expect(before.fired).toHaveLength(0);
        expect(before.modifiers[0].onStartFired).toBeFalsy();

        // at trigger: fires once, guard flips
        const atTrigger = fireOnStartModifiers(before.modifiers, 4);
        expect(atTrigger.fired).toHaveLength(1);
        expect(atTrigger.fired[0].id).toBe('test.0');
        expect(atTrigger.modifiers[0].onStartFired).toBe(true);

        // subsequent rounds: never fires again (guard holds, survives a "reload" of the array)
        const after = fireOnStartModifiers(atTrigger.modifiers, 5);
        expect(after.fired).toHaveLength(0);
    });

    it('test_onstart_never_fires_if_no_trigger_round', () => {
        const m = mod({ mods: [statMod('charisma', 1, permanent())] }); // statue-like, no onStart
        const res = fireOnStartModifiers([m], 100);
        expect(res.fired).toHaveLength(0);
        expect(res.modifiers).toEqual([m]);
    });
});

describe('normalizeModifier — legacy save migration', () => {
    it('test_legacy_statue_without_window_defaults_permanent', () => {
        const legacy = { type: 'statue', mods: [{ stat: 'charisma', amount: 1 }] };
        const normalized = normalizeModifier(legacy, 0);
        expect(normalized).toMatchObject({
            id: 'statue.0',
            type: 'statue',
            state: 'active',
            acquiredRound: 0,
            mods: [{ stat: 'charisma', amount: 1, window: { startRound: 0, endRound: null } }],
        });
        // and it still contributes identically through the engine
        expect(getEffectiveCharisma(0, [normalized], 5)).toBe(1);
    });
});
