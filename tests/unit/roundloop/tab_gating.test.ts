/**
 * Story 9-2: Tab gating — Street lock / decision lock (ADR-0012)
 *
 * Tests verify setActiveTab's dwelling-aware gate directly against the store:
 *   - dwelling=true blocks Meet/Laws/Deals/Budget
 *   - dwelling=false (work day) blocks Street
 *   - debug mode bypasses both gates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { Tabs } from '../../../src/types/Tabs';

function resetStore(): void {
    useGameStore.getState().gameManagement.setPhase('start');
    useGameStore.getState().debug.setDebugMode(false);
}

describe('setActiveTab — dwelling blocks decision tabs', () => {
    beforeEach(resetStore);

    it('test_dwelling_true_blocks_meet_tab', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Meet);
        expect(useGameStore.getState().tabs.activeTab).not.toBe(Tabs.Meet);
    });

    it('test_dwelling_true_blocks_laws_tab', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Laws);
        expect(useGameStore.getState().tabs.activeTab).not.toBe(Tabs.Laws);
    });

    it('test_dwelling_true_blocks_deals_tab', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Deals);
        expect(useGameStore.getState().tabs.activeTab).not.toBe(Tabs.Deals);
    });

    it('test_dwelling_true_blocks_budget_tab', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Budget);
        expect(useGameStore.getState().tabs.activeTab).not.toBe(Tabs.Budget);
    });

    it('test_dwelling_true_allows_street_tab', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Street);
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Street);
    });
});

describe('setActiveTab — work day (dwelling=false) blocks Street', () => {
    beforeEach(resetStore);

    it('test_dwelling_false_blocks_street_tab_during_start_phase', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: false, phase: 'start' } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Street);
        expect(useGameStore.getState().tabs.activeTab).not.toBe(Tabs.Street);
    });

    it('test_dwelling_false_allows_meet_tab_during_start_phase', () => {
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: false, phase: 'start' } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Meet);
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Meet);
    });
});

describe('setActiveTab — debug mode bypasses both gates', () => {
    beforeEach(resetStore);

    it('test_debug_enabled_allows_street_during_work_day', () => {
        useGameStore.getState().debug.setDebugMode(true);
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: false, phase: 'start' } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Street);
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Street);
    });

    it('test_debug_enabled_allows_meet_during_dwelling', () => {
        useGameStore.getState().debug.setDebugMode(true);
        useGameStore.setState((s) => ({ gameManagement: { ...s.gameManagement, dwelling: true } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Meet);
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Meet);
    });
});
