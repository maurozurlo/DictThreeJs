// @vitest-environment jsdom
/**
 * Visual-gaps POC integration (docs/architecture/visual-gaps-poc-2026-11-12.md)
 *
 * Runs useStreetLayout against the REAL street IDE/IPL data and checks the tier wiring:
 *   - conditionStage > 0 swaps every building slot to its rich model
 *   - infrastructure tiers swap trees / streetlights / benches without overlap
 *   - each statue slot shows its empty pedestal until the matching statue is bought
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { state, statues } = vi.hoisted(() => {
    const state = {
        tabs: { activeTab: 'Street' },
        budget: { expenditures: { infrastructure: 5, security: 5 } },
        debug: { enabled: false },
        gameManagement: { modifiers: [] as unknown[], round: 1, conditionStage: 0 },
    };
    const statues = { count: 0 };
    return { state, statues };
});

vi.mock('../../../src/assets/data/road-plans', () => ({
    // these tests exercise IPL resolution alone — no road-plan buildings / props / replacements
    STREET_PLAN: { buildings: [], props: [], replacesIpl: [] },
}));
vi.mock('../../../src/Stores/GameState', () => ({
    useGameStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

vi.mock('../../../src/Utils/Modifiers', () => ({
    getVisibleModifiers: () => [],
    countModifiersByType: () => statues.count,
}));

import { useStreetLayout } from '../../../src/Hooks/useStreetLayout';

function modelNames(): string[] {
    const { result } = renderHook(() => useStreetLayout());
    return result.current.map((p) => p.modelName);
}

function count(names: string[], name: string): number {
    return names.filter((n) => n === name).length;
}

beforeEach(() => {
    state.budget.expenditures.infrastructure = 5;
    state.gameManagement.conditionStage = 0;
    state.debug.enabled = false;
    statues.count = 0;
});

describe('street tiers — rich building slots', () => {
    it('test_street_condition_stage_max_all_slots_rich', () => {
        // Arrange
        state.gameManagement.conditionStage = 5;
        // Act
        const names = modelNames();
        // Assert
        for (const slot of ['mixeduse', 'apartment', 'commercial', 'civic', 'residential']) {
            expect(count(names, `env_bld_${slot}_rich`)).toBe(1);
            expect(count(names, `env_bld_${slot}_normal`)).toBe(0);
        }
    });

    it('test_street_condition_stage_zero_mixeduse_normal_uses_its_own_glb', () => {
        // Arrange — conditionStage 0: every slot normal
        // Act
        const { result } = renderHook(() => useStreetLayout());
        const mixeduse = result.current.find((p) => p.modelName === 'env_bld_mixeduse_normal');
        // Assert — regression: the normal entry used to load the poor GLB
        expect(mixeduse?.asset).toBe('models/map/env_bld_mixeduse_normal.glb');
    });
});

describe('street tiers — prop swaps by infrastructure', () => {
    it.each([
        [2, 'env_tree_poor', 'env_streetlight_poor', 'env_parkbench_poor'],
        [5, 'env_tree_medium', 'env_streetlight_standard_medium', 'env_parkbench_medium'],
        [9, 'env_tree_rich', 'env_streetlight_rich', 'env_parkbench_rich'],
    ] as const)('test_street_infrastructure_%d_shows_only_its_tier_props', (infra, tree, light, bench) => {
        // Arrange
        state.budget.expenditures.infrastructure = infra;
        // Act
        const names = modelNames();
        // Assert — exactly one tier per prop family at the shared positions
        const trees = names.filter((n) => n.startsWith('env_tree_'));
        const lights = names.filter((n) => n.startsWith('env_streetlight_'));
        const benches = names.filter((n) => n.startsWith('env_parkbench_'));
        expect(new Set(trees)).toEqual(new Set([tree]));
        expect(new Set(lights)).toEqual(new Set([light]));
        expect(new Set(benches)).toEqual(new Set([bench]));
    });

    it.each([
        [2, 'env_planter_poor', 'env_trashcan_burning'],
        [5, 'env_planter_normal', 'env_fountain_normal'],
        [9, 'env_planter_rich', 'env_fountain_rich'],
    ] as const)('test_street_infrastructure_%d_shows_tier_plaza_props', (infra, planter, feature) => {
        // Arrange
        state.budget.expenditures.infrastructure = infra;
        // Act
        const names = modelNames();
        // Assert
        expect(count(names, planter)).toBe(2);
        expect(count(names, feature)).toBeGreaterThan(0);
        expect(names.filter((n) => n.startsWith('env_planter_') && n !== planter)).toHaveLength(0);
    });
});

describe('street tiers — statue slots', () => {
    it.each([
        [0, [], ['env_statue_pedestal_slot1', 'env_statue_pedestal_slot2', 'env_statue_pedestal_slot3']],
        [1, ['env_statue_bronze'], ['env_statue_pedestal_slot2', 'env_statue_pedestal_slot3']],
        [2, ['env_statue_bronze', 'env_statue_silver'], ['env_statue_pedestal_slot3']],
        [3, ['env_statue_bronze', 'env_statue_silver', 'env_statue_gold'], []],
    ] as const)('test_street_statues_bought_%d_fills_that_many_slots', (bought, shown, pedestals) => {
        // Arrange
        statues.count = bought;
        // Act
        const names = modelNames();
        const statueModels = names.filter((n) => n.startsWith('env_statue_'));
        // Assert — every slot shows exactly one model: its statue or its empty pedestal
        expect(new Set(statueModels)).toEqual(new Set([...shown, ...pedestals]));
        expect(statueModels).toHaveLength(3);
    });

    it('test_street_debug_mode_shows_all_statues', () => {
        // Arrange
        state.debug.enabled = true;
        // Act
        const names = modelNames();
        // Assert
        expect(names.filter((n) => n.startsWith('env_statue_')).sort())
            .toEqual(['env_statue_bronze', 'env_statue_gold', 'env_statue_silver']);
    });
});
