// @vitest-environment jsdom
/**
 * Story 8-8: buildingVariantForSlot + hook rich-fallback
 *
 * AC-11: all 55 combinations (11 stage values × 5 slots) match the GDD §3.1 table
 * AC-12: useStreetLayout falls back to 'normal' variant asset when rich model is null
 */

import { describe, it, expect, vi } from 'vitest';
import { buildingVariantForSlot } from '../../../src/Utils/BuildingDegradation';

// ---------------------------------------------------------------------------
// AC-11: pure function — all 55 combinations
// ---------------------------------------------------------------------------

// Expected output table keyed as [stage][slot] = variant
// Derived from GDD §3.1 stage→variant table (Story 8-8 context section).
const TABLE: Record<number, ('poor' | 'normal' | 'rich')[]> = {
    [-5]: ['poor',   'poor',   'poor',   'poor',   'poor'],
    [-4]: ['poor',   'poor',   'poor',   'poor',   'normal'],
    [-3]: ['poor',   'poor',   'poor',   'normal', 'normal'],
    [-2]: ['poor',   'poor',   'normal', 'normal', 'normal'],
    [-1]: ['poor',   'normal', 'normal', 'normal', 'normal'],
    [ 0]: ['normal', 'normal', 'normal', 'normal', 'normal'],
    [ 1]: ['normal', 'normal', 'normal', 'normal', 'rich'],
    [ 2]: ['normal', 'normal', 'normal', 'rich',   'rich'],
    [ 3]: ['normal', 'normal', 'rich',   'rich',   'rich'],
    [ 4]: ['normal', 'rich',   'rich',   'rich',   'rich'],
    [ 5]: ['rich',   'rich',   'rich',   'rich',   'rich'],
};

describe('buildingVariantForSlot — all 55 combinations', () => {
    for (const stage of Object.keys(TABLE).map(Number)) {
        for (let slot = 0; slot < 5; slot++) {
            const expected = TABLE[stage][slot];
            it(`stage=${stage > 0 ? '+' : ''}${stage}, slot=${slot} → ${expected}`, () => {
                expect(buildingVariantForSlot(slot, stage)).toBe(expected);
            });
        }
    }
});

// ---------------------------------------------------------------------------
// AC-12: hook falls back to normal variant when rich model is null
// ---------------------------------------------------------------------------

const { hookState } = vi.hoisted(() => {
    const hookState = {
        tabs: { activeTab: 'Street' },
        budget: { expenditures: { infrastructure: 5, security: 5 } },
        gameManagement: { modifiers: [] as unknown[], round: 1, conditionStage: 5 },
    };
    return { hookState };
});

vi.mock('../../../src/Stores/GameState', () => ({
    useGameStore: (selector: (s: typeof hookState) => unknown) => selector(hookState),
}));

// Minimal IDE with only slot-0 entries (normal + poor, no rich)
vi.mock('../../../src/assets/data/street-objects.ide', () => ({
    STREET_IDE: {
        version: 1,
        objs: [
            { id: 2001, modelName: 'env_bld_mixeduse_normal', asset: 'models/normal.glb', textures: [], visibleIf: { tab: 'Street' } },
            { id: 2006, modelName: 'env_bld_mixeduse_poor',   asset: 'models/poor.glb',   textures: [], visibleIf: { tab: 'Street' } },
        ],
    },
}));

// One canonical building instance only (poor variant IPL entries are skipped by the hook)
vi.mock('../../../src/assets/data/street-placement.ipl', () => ({
    STREET_IPL: {
        version: 1,
        inst: [
            { id: 1, modelName: 'env_bld_mixeduse_normal', pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            { id: 59, modelName: 'env_bld_mixeduse_poor',  pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        ],
    },
}));

vi.mock('../../../src/Utils/Modifiers', () => ({
    getVisibleModifiers: () => [],
}));

import { renderHook } from '@testing-library/react';
import { useStreetLayout } from '../../../src/Hooks/useStreetLayout';

describe('useStreetLayout — rich variant fallback', () => {
    it('AC-12: returns normal asset when conditionStage=5 but rich model is null for slot 0', () => {
        // conditionStage=5 → buildingVariantForSlot(0, 5) = 'rich'
        // slot 0 has rich=null → hook falls back to normal variant
        hookState.gameManagement.conditionStage = 5;
        const { result } = renderHook(() => useStreetLayout());

        // Should produce exactly one placement (canonical inst, not the poor IPL entry)
        expect(result.current).toHaveLength(1);
        expect(result.current[0].modelName).toBe('env_bld_mixeduse_normal');
        expect(result.current[0].asset).toBe('models/normal.glb');
    });

    it('poor variant IPL instance (inst 59) is skipped — no z-fighting', () => {
        hookState.gameManagement.conditionStage = 0; // all normal
        const { result } = renderHook(() => useStreetLayout());
        // Only the canonical inst 1 should produce a placement
        expect(result.current).toHaveLength(1);
        expect(result.current[0].instanceId).toBe(1);
    });
});
