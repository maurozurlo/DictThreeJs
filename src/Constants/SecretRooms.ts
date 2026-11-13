import type { Power } from '../types/Power';

type Vec3 = [number, number, number];

/**
 * The Bunker — the military special-ending room, exported from
 * `E:\Docs\dict\bunkerr01.max` by tools/maxscript/export_room_fbx.ms (metres,
 * Y up, Max origin = foot of the nuke console). One baked 30 fps take:
 *   0-10   Plane001   key inserts and turns
 *   15-30  Object002  red button pressed (bottoms out at 27, settles by 30)
 */
export const BUNKER = {
    url: '/assets/3d/bunker/bunker.FBX',
    /**
     * Where the Max origin sits in the world. "Deep beneath the palace": ten
     * metres below everything else, so the representatives (always mounted) and
     * the palace lights never reach the frame.
     */
    offset: [0, -10, 0] as Vec3,
    fps: 30,
    /** Nodes the press take animates; everything else is static. */
    pressNodes: ['Plane001', 'Object002'] as const,
    pressStartFrame: 0,
    pressEndFrame: 30,
    /**
     * Secret-tab camera, relative to `offset`. Position is the Max perspective
     * viewport the room was framed in (pos [2.0, -625.9, 172.8] mm). Pitched 7°
     * down (Max view: 3°) so the console clears the bottom ActionPanel, no yaw
     * (Max: 1°) and 40° horizontal FOV (Max: 45°) so the open front's wall edges
     * sit at the frame edges. Horizontal FOV keeps that at any canvas aspect,
     * like the Street camera.
     */
    camera: {
        pos: [0.00203, 0.17282, 0.62587] as Vec3,
        rotation: [-0.12217, 0] as [number, number],
        hFov: 40,
    },
    /**
     * Warm light under the ceiling lamp painted on the back wall (offset-relative).
     * The bunker textures are ~3x darker than the palace's, so ambient alone reads
     * as black. Intensity is physical (candela, decay 2) at room scale (~0.6 m deep).
     */
    lamp: { pos: [0, 0.24, -0.4] as Vec3, color: '#ffc98a', intensity: 0.12 },
    /** Edge of the black box around the room, so the open front shows darkness, not the clear colour. */
    voidSize: 4,
    /** How long the pressed button stays on screen before the end screen covers it. */
    endScreenHoldMs: 700,
} as const;

/** Length of the bunker press take in milliseconds. */
export const BUNKER_PRESS_MS = ((BUNKER.pressEndFrame - BUNKER.pressStartFrame) / BUNKER.fps) * 1000;

/**
 * Frame of the bunker press take `elapsedMs` after the Nuke button was pressed;
 * the rest frame before it (or when not pressed: `elapsedMs` null), held on the
 * last frame after.
 */
export function bunkerPressFrame(elapsedMs: number | null): number {
    if (elapsedMs === null || elapsedMs <= 0) return BUNKER.pressStartFrame;
    const frame = BUNKER.pressStartFrame + (elapsedMs / 1000) * BUNKER.fps;
    return Math.min(frame, BUNKER.pressEndFrame);
}

/**
 * How long the end screen waits after a special ending is used, so the room's
 * take can play first. Only the bunker has one so far (vault / zen garden: 0).
 */
export function specialEndingRevealDelayMs(faction: Power | null): number {
    return faction === 'military' ? BUNKER_PRESS_MS + BUNKER.endScreenHoldMs : 0;
}
