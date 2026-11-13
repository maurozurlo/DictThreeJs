// @vitest-environment jsdom
/**
 * The Bunker (military special-ending room): press-take timing, end-screen hold,
 * and the Secret tab camera framing it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BUNKER, BUNKER_PRESS_MS, bunkerPressFrame, specialEndingRevealDelayMs } from '../../../src/Constants/SecretRooms';
import { SECRET_ROOMS } from '../../../src/assets/secretRooms';
import { GAMESTATE } from '../../../src/Constants/GameState';
import { useGameStore } from '../../../src/Stores/GameState';
import { useDelayedFlag } from '../../../src/Hooks/useDelayedFlag';
import { Tabs } from '../../../src/types/Tabs';
import type { Power } from '../../../src/types/Power';

vi.mock('../../../src/i18n', () => ({ default: { t: (key: string) => key } }));

describe('bunker press take', () => {
    it('test_bunker_press_frame_rest_until_pressed', () => {
        expect(bunkerPressFrame(null)).toBe(BUNKER.pressStartFrame);
        expect(bunkerPressFrame(0)).toBe(BUNKER.pressStartFrame);
        expect(bunkerPressFrame(-50)).toBe(BUNKER.pressStartFrame);
    });

    it('test_bunker_press_frame_advances_at_take_fps', () => {
        expect(bunkerPressFrame(500)).toBeCloseTo(BUNKER.pressStartFrame + BUNKER.fps / 2);
    });

    it('test_bunker_press_frame_holds_last_frame', () => {
        expect(bunkerPressFrame(BUNKER_PRESS_MS)).toBe(BUNKER.pressEndFrame);
        expect(bunkerPressFrame(BUNKER_PRESS_MS * 5)).toBe(BUNKER.pressEndFrame);
    });

    it('test_bunker_end_screen_waits_for_take_plus_hold', () => {
        expect(specialEndingRevealDelayMs('military')).toBe(BUNKER_PRESS_MS + BUNKER.endScreenHoldMs);
    });

    it('test_rooms_without_take_reveal_immediately', () => {
        expect(specialEndingRevealDelayMs('business')).toBe(0);
        expect(specialEndingRevealDelayMs('people')).toBe(0);
        expect(specialEndingRevealDelayMs(null)).toBe(0);
    });
});

describe('bunker camera', () => {
    beforeEach(() => {
        useGameStore.setState((s) => ({
            debug: { ...s.debug, enabled: false },
            gameManagement: { ...s.gameManagement, phase: 'start', dwelling: false },
            tabs: { ...s.tabs, activeTab: Tabs.Log, tabsLocked: false, secretRoomIndex: 0 },
        }));
    });

    function enterSecretWith(faction: Power) {
        useGameStore.setState((s) => ({ specialEnding: { ...s.specialEnding, available: true, faction, used: false } }));
        useGameStore.getState().tabs.setActiveTab(Tabs.Secret);
        return useGameStore.getState().scene.camera;
    }

    it('test_military_room_is_the_bunker', () => {
        const room = SECRET_ROOMS[GAMESTATE.FACTION_ROOM_INDEX.military];
        expect(room.name).toBe('bunker');
        expect(room.pos).toEqual(BUNKER.offset.map((o, i) => o + BUNKER.camera.pos[i]));
    });

    it('test_military_special_ending_frames_bunker_with_horizontal_fov', () => {
        const camera = enterSecretWith('military');
        const room = SECRET_ROOMS[GAMESTATE.FACTION_ROOM_INDEX.military];
        expect(camera.cameraPos).toEqual(room.pos);
        expect(camera.cameraRotation).toEqual(room.rotation);
        expect(camera.cameraHFov).toBe(BUNKER.camera.hFov);
    });

    it('test_placeholder_rooms_keep_vertical_fov', () => {
        const camera = enterSecretWith('business');
        expect(camera.cameraHFov).toBeUndefined();
        expect(camera.cameraFov).toBe(SECRET_ROOMS[GAMESTATE.FACTION_ROOM_INDEX.business].fov);
    });
});

describe('useDelayedFlag', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const setup = (on: boolean, delayMs: number) =>
        renderHook(({ on: o, delayMs: d }) => useDelayedFlag(o, d), { initialProps: { on, delayMs } });

    it('test_delayed_flag_no_delay_is_immediate', () => {
        expect(setup(true, 0).result.current).toBe(true);
    });

    it('test_delayed_flag_waits_for_delay', () => {
        const { result } = setup(true, 1000);
        expect(result.current).toBe(false);
        act(() => { vi.advanceTimersByTime(999); });
        expect(result.current).toBe(false);
        act(() => { vi.advanceTimersByTime(1); });
        expect(result.current).toBe(true);
    });

    it('test_delayed_flag_drops_when_off_and_restarts', () => {
        const { result, rerender } = setup(true, 1000);
        act(() => { vi.advanceTimersByTime(1000); });
        rerender({ on: false, delayMs: 1000 });
        expect(result.current).toBe(false);
        rerender({ on: true, delayMs: 1000 });
        expect(result.current).toBe(false);
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current).toBe(true);
    });
});
