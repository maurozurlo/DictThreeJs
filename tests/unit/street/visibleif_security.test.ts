// @vitest-environment jsdom
/**
 * Story 8-3: visibleIf security condition
 *
 * Verifies the security filter in useStreetLayout:
 *   AC-3  — excludes entries when security value is outside their [min, max] range
 *   AC-4  — includes entries when security value is within their [min, max] range
 *   AC-5  — infrastructure and security conditions compose as AND
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mutable state object closed over by the GameState mock factory.
// vi.hoisted ensures this is available when vi.mock factories run.
const { state } = vi.hoisted(() => {
    const state = {
        tabs: { activeTab: 'Street' },
        budget: { expenditures: { infrastructure: 5, security: 5 } },
        gameManagement: { modifiers: [] as unknown[], round: 1 },
    };
    return { state };
});

vi.mock('../../../src/Stores/GameState', () => ({
    useGameStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

vi.mock('../../../src/assets/data/street-objects.ide', () => ({
    STREET_IDE: {
        version: 1,
        objs: [
            // Militarised tier prop — only visible when security 8–10
            { id: 1, modelName: 'guard_post', asset: 'models/guard_post.glb', textures: [], visibleIf: { security: [8, 10] } },
            // Disorder tier prop — only visible when security 1–3
            { id: 2, modelName: 'graffiti',   asset: 'models/graffiti.glb',   textures: [], visibleIf: { security: [1, 3] } },
            // No visibleIf — always visible
            { id: 3, modelName: 'road',        asset: 'models/road.glb',        textures: [] },
            // Both conditions — visible only when infrastructure [1,3] AND security [1,3]
            { id: 4, modelName: 'checkpoint',  asset: 'models/checkpoint.glb',  textures: [], visibleIf: { infrastructure: [1, 3], security: [1, 3] } },
        ],
    },
}));

vi.mock('../../../src/assets/data/street-placement.ipl', () => ({
    STREET_IPL: {
        version: 1,
        inst: [
            { id: 1, modelName: 'guard_post', pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            { id: 2, modelName: 'graffiti',   pos: [1, 0, 0], rot: [0, 0, 0, 1] },
            { id: 3, modelName: 'road',        pos: [2, 0, 0], rot: [0, 0, 0, 1] },
            { id: 4, modelName: 'checkpoint',  pos: [3, 0, 0], rot: [0, 0, 0, 1] },
        ],
    },
}));

vi.mock('../../../src/Utils/Modifiers', () => ({
    getVisibleModifiers: () => [],
}));

import { useStreetLayout } from '../../../src/Hooks/useStreetLayout';

function names(placements: ReturnType<typeof useStreetLayout>): string[] {
    return placements.map((p) => p.modelName);
}

describe('useStreetLayout — visibleIf security filter', () => {
    it('AC-3: excludes entry when security is outside its range', () => {
        state.budget.expenditures.security = 5; // guard_post requires [8, 10]
        const { result } = renderHook(() => useStreetLayout());
        expect(names(result.current)).not.toContain('guard_post');
        expect(names(result.current)).toContain('road'); // always-visible baseline
    });

    it('AC-4: includes entry when security is within its range', () => {
        state.budget.expenditures.security = 10; // guard_post requires [8, 10]
        const { result } = renderHook(() => useStreetLayout());
        expect(names(result.current)).toContain('guard_post');
    });

    it('AC-5a: excludes entry when security passes but infrastructure fails', () => {
        state.budget.expenditures.infrastructure = 8; // checkpoint requires [1, 3] — fails
        state.budget.expenditures.security = 2;       // checkpoint requires [1, 3] — passes
        const { result } = renderHook(() => useStreetLayout());
        expect(names(result.current)).not.toContain('checkpoint');
    });

    it('AC-5b: excludes entry when infrastructure passes but security fails', () => {
        state.budget.expenditures.infrastructure = 2; // checkpoint requires [1, 3] — passes
        state.budget.expenditures.security = 5;       // checkpoint requires [1, 3] — fails
        const { result } = renderHook(() => useStreetLayout());
        expect(names(result.current)).not.toContain('checkpoint');
    });

    it('AC-5c: includes entry when both infrastructure and security pass', () => {
        state.budget.expenditures.infrastructure = 2; // checkpoint requires [1, 3] — passes
        state.budget.expenditures.security = 2;       // checkpoint requires [1, 3] — passes
        const { result } = renderHook(() => useStreetLayout());
        expect(names(result.current)).toContain('checkpoint');
    });
});
