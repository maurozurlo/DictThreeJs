import type { Power } from '../types/Power';

type Vec3 = [number, number, number];

/**
 * Palace interior (Meet + Laws rooms and the representative "execution" props),
 * exported from `main interiors06.max` by tools/maxscript/export_office_fbx.ms.
 * One baked 30 fps take; see REP_EXECUTIONS for which frames belong to whom.
 */
export const OFFICE_MODEL_URL = '/assets/3d/main.FBX';

/** Frame rate of the Max timeline the execution take was authored on. */
export const EXECUTION_FPS = 30;

/**
 * Places the Max scene (origin-centred, metres, Y up) in the palace frame the
 * representatives, point lights and camera stops are authored in. Fitted on the
 * 6,227 vertices the current room shares with the previous main.FBX
 * (residual < 0.01 mm), so nothing else in the scene had to move.
 */
export const OFFICE_MODEL_OFFSET: Vec3 = [-1.06222, 0.60245, -0.32824];

/**
 * Palace camera stops, indexed by TAB_CAMERA `scan` entries. These used to be the
 * CameraStart / CameraStart001 / CameraStart002 dummies inside the old main.FBX.
 */
export const OFFICE_CAMERA_POSITIONS: Vec3[] = [
    [-1.33567, 0.62986, 0.30205], // Meet — the three representatives
    [-0.80100, 0.62986, 0.30205], // Laws — the desk
    [-0.06944, 0.62986, 0.30205],
];

/** Rest placement of a representative figurine (world space). Its origin is its bbox centre. */
export interface RepModelConfig {
    url: string;
    position: Vec3;
    scale: number;
    /** Yaw in degrees. */
    rotationY: number;
}

export const REP_MODELS: Record<Power, RepModelConfig> = {
    business: { url: '/assets/3d/chars/elite.FBX', position: [-1.435, 0.6, -0.19], scale: 1.15, rotationY: 0 },
    military: { url: '/assets/3d/chars/police.FBX', position: [-1.335, 0.642, -0.19], scale: 1.15, rotationY: 10 },
    people: { url: '/assets/3d/chars/people.FBX', position: [-1.242, 0.629, -0.15], scale: 1, rotationY: 0 },
};

/** Slice of the office take that plays when a representative is eliminated. */
export interface RepExecutionConfig {
    /** First frame of the slice; also the rest pose of `nodes` when idle. */
    startFrame: number;
    /** Last frame; the representative is gone once it is reached. */
    endFrame: number;
    /** Office FBX nodes this slice animates (other nodes are left alone). */
    nodes: string[];
}

export const REP_EXECUTIONS: Record<Power, RepExecutionConfig> = {
    business: { startFrame: 0, endFrame: 20, nodes: ['Object002', 'Helix001'] }, // couch spring
    military: { startFrame: 20, endFrame: 35, nodes: ['Object001'] }, // trapdoor
    people: { startFrame: 40, endFrame: 80, nodes: ['Dummy001', 'Box072', 'Box073', 'Box074'] }, // toy claw
};

/**
 * Business rep: rides the spring plate up, leaves it at `launchFrame` and flies
 * ballistically. Units are metres / seconds in the palace frame (figurines are
 * ~9 cm tall, so gravity is scaled down from real life to read as human-sized).
 */
export const ELITE_YEET = {
    plateNode: 'Object002',
    /** Plate is still accelerating here (Max key data: up 22 mm in frames 1-3). */
    launchFrame: 3,
    /** Up, a little left and toward the camera. */
    velocity: [-0.3, 1.1, 0.5] as Vec3,
    gravity: 1.5,
    /** Tumble, rad/s per axis. */
    spin: [-6, 2, 11] as Vec3,
};

/** Military rep: hangs a beat over the open trapdoor, then drops through it. */
export const MILITARY_DROP = {
    /** Trapdoor starts opening at 20; the cartoon hang lasts until here. */
    dropFrame: 22,
    gravity: 12,
    /** Backward tilt while falling, rad/s, capped at maxTilt. */
    tiltRate: 4,
    maxTilt: 0.6,
    /** Hidden once this far below his rest height (well under the floor). */
    hideBelow: 0.35,
};

/**
 * People's rep: carried rigidly by the claw once its fingers close on him. The
 * claw is keyed in Max centred over his upper body (X -179.8 / Y -150.0 mm),
 * turned so two fingers come down at his front corners (the third is behind
 * him, back-right), and its fingers stop at contact (frame 62) rather than
 * closing fully — nothing passes through him or the armchair. Any extra pull,
 * lift or sway in code would push him back into the fingers.
 */
export const PEOPLE_GRAB = {
    clawNode: 'Dummy001',
    /** Fingers meet him here (Max keys: open until 58, contact pose at 62). */
    grabFrame: 62,
};
