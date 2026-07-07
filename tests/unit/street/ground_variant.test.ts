// @vitest-environment jsdom
/**
 * Ground texture-variant swap: env_roads/env_plaza are single meshes whose GLB never
 * changes — only the painted texture does, driven by conditionStage (art-bible §7.2.3).
 */

import { describe, it, expect, vi } from 'vitest';
import { groundVariantSuffix } from '../../../src/Utils/BuildingDegradation';

// ---------------------------------------------------------------------------
// Pure function — conditionStage → suffix
// ---------------------------------------------------------------------------

describe('groundVariantSuffix', () => {
    it.each([
        [-5, '_poor'], [-4, '_poor'], [-3, '_poor'], [-2, '_poor'], [-1, '_poor'],
        [0, ''], [1, ''], [2, ''], [3, ''], [4, ''], [5, ''],
    ] as const)('conditionStage=%d → %j', (stage, expected) => {
        expect(groundVariantSuffix(stage)).toBe(expected);
    });
});

// ---------------------------------------------------------------------------
// Hook-level wiring — useStreetLayout attaches textureVariantSuffix for ground models only
// ---------------------------------------------------------------------------

const { hookState } = vi.hoisted(() => {
    const hookState = {
        tabs: { activeTab: 'Street' },
        budget: { expenditures: { infrastructure: 5, security: 5 } },
        gameManagement: { modifiers: [] as unknown[], round: 1, conditionStage: 0 },
    };
    return { hookState };
});

vi.mock('../../../src/Stores/GameState', () => ({
    useGameStore: (selector: (s: typeof hookState) => unknown) => selector(hookState),
}));

vi.mock('../../../src/assets/data/street-objects.ide', () => ({
    STREET_IDE: {
        version: 1,
        objs: [
            { id: 2014, modelName: 'env_roads', asset: 'models/map/env_roads.glb', textures: [], visibleIf: { tab: 'Street' } },
            { id: 2015, modelName: 'env_plaza', asset: 'models/map/env_plaza.glb', textures: [], visibleIf: { tab: 'Street' } },
            { id: 2011, modelName: 'env_flagpole_large', asset: 'models/map/env_flagpole_large.glb', textures: [], visibleIf: { tab: 'Street' } },
        ],
    },
}));

vi.mock('../../../src/assets/data/street-placement.ipl', () => ({
    STREET_IPL: {
        version: 1,
        inst: [
            { id: 1, modelName: 'env_roads', pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            { id: 2, modelName: 'env_plaza', pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            { id: 3, modelName: 'env_flagpole_large', pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        ],
    },
}));

vi.mock('../../../src/Utils/Modifiers', () => ({
    getVisibleModifiers: () => [],
}));

import { renderHook } from '@testing-library/react';
import { useStreetLayout } from '../../../src/Hooks/useStreetLayout';

describe('useStreetLayout — ground texture variant wiring', () => {
    it('conditionStage < 0: env_roads and env_plaza carry textureVariantSuffix "_poor"', () => {
        hookState.gameManagement.conditionStage = -2;
        const { result } = renderHook(() => useStreetLayout());

        const roads = result.current.find((p) => p.modelName === 'env_roads');
        const plaza = result.current.find((p) => p.modelName === 'env_plaza');
        expect(roads?.textureVariantSuffix).toBe('_poor');
        expect(plaza?.textureVariantSuffix).toBe('_poor');
    });

    it('conditionStage >= 0: env_roads and env_plaza carry no textureVariantSuffix', () => {
        hookState.gameManagement.conditionStage = 0;
        const { result } = renderHook(() => useStreetLayout());

        const roads = result.current.find((p) => p.modelName === 'env_roads');
        const plaza = result.current.find((p) => p.modelName === 'env_plaza');
        expect(roads?.textureVariantSuffix).toBeUndefined();
        expect(plaza?.textureVariantSuffix).toBeUndefined();
    });

    it('non-ground objects never carry textureVariantSuffix, regardless of conditionStage', () => {
        hookState.gameManagement.conditionStage = -5;
        const { result } = renderHook(() => useStreetLayout());

        const flagpole = result.current.find((p) => p.modelName === 'env_flagpole_large');
        expect(flagpole?.textureVariantSuffix).toBeUndefined();
    });
});
