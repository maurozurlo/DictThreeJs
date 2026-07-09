/**
 * Story 9-4: Round 1 opening — inherited city state (ADR-0012)
 *
 * Tests verify:
 *   - buildStartState opens new games on Street with dwelling: true and the
 *     timer paused (timerStartedAt: null)
 *   - beginFirstWorkDay() dismisses the intro: unlocks decision tabs, starts
 *     the timer, moves off Street
 *   - The Street camera is actually applied on both transitions (regression
 *     guard for the "camera stuck at the last tab" bug — expireTimer/
 *     buildStartState must move scene.camera, not just tabs.activeTab)
 */

import { describe, it, expect } from 'vitest';
import { useGameStore } from '../../../src/Stores/GameState';
import { Tabs } from '../../../src/types/Tabs';
import { STREET_CAMERA } from '../../../src/Constants/GameState';

describe('buildStartState — round 1 opening (via setPhase)', () => {
    it('test_new_game_opens_on_street_tab', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Street);
    });

    it('test_new_game_starts_dwelling_true', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        expect(useGameStore.getState().gameManagement.dwelling).toBe(true);
    });

    it('test_new_game_timer_not_started', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        expect(useGameStore.getState().gameManagement.timerStartedAt).toBeNull();
    });

    it('test_new_game_camera_matches_street_camera', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        const cam = useGameStore.getState().scene.camera;
        expect(cam.cameraPos).toEqual(STREET_CAMERA.pos);
        expect(cam.cameraFov).toBe(STREET_CAMERA.fov);
    });
});

describe('beginFirstWorkDay() — dismisses the intro', () => {
    it('test_beginFirstWorkDay_sets_dwelling_false', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        useGameStore.getState().gameManagement.beginFirstWorkDay();
        expect(useGameStore.getState().gameManagement.dwelling).toBe(false);
    });

    it('test_beginFirstWorkDay_starts_the_timer', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        useGameStore.getState().gameManagement.beginFirstWorkDay();
        expect(useGameStore.getState().gameManagement.timerStartedAt).not.toBeNull();
    });

    it('test_beginFirstWorkDay_moves_off_street_tab', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        useGameStore.getState().gameManagement.beginFirstWorkDay();
        expect(useGameStore.getState().tabs.activeTab).toBe(Tabs.Log);
    });
});

describe('expireTimer() — camera regression guard', () => {
    it('test_expireTimer_moves_camera_to_street_position', () => {
        useGameStore.getState().gameManagement.setPhase('start');
        useGameStore.getState().gameManagement.beginFirstWorkDay();
        // Simulate the camera sitting somewhere else (e.g. the Meet tab) when the
        // round ends — this is the exact bug: expireTimer() used to only move
        // tabs.activeTab, leaving scene.camera wherever it last was.
        useGameStore.setState((s) => ({
            scene: { ...s.scene, camera: { ...s.scene.camera, cameraPos: [0, 0, 0], cameraFov: 34 } },
        }));

        useGameStore.getState().gameManagement.expireTimer();
        expect(useGameStore.getState().scene.camera.cameraPos).toEqual(STREET_CAMERA.pos);
        expect(useGameStore.getState().scene.camera.cameraFov).toBe(STREET_CAMERA.fov);
    });
});
