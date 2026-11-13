import { Power as POWERS } from '../Constants/Power';
import {
    ELITE_YEET,
    EXECUTION_FPS,
    MILITARY_DROP,
    PEOPLE_GRAB,
    REP_EXECUTIONS,
} from '../Constants/Office';
import type { Power } from '../types/Power';

/**
 * Representative "executions": the goofy send-off each representative gets in the
 * Meet room when eliminated (couch spring, trapdoor, toy claw). Pure timeline and
 * pose maths; the office props themselves are scrubbed from the baked Max take by
 * src/3d/ClipPoser.ts and the two are driven together by src/3d/MainModel.tsx.
 * Cosmetic only — game state flips to 'eliminated' immediately, as before.
 */

export type Vec3 = [number, number, number];
export type RepStatus = 'active' | 'sick' | 'eliminated';
export type RepStatuses = Record<Power, RepStatus>;

/** Start time (ms on the performance.now() clock) of each execution in progress. */
export type ExecutionRuns = Partial<Record<Power, number>>;

/** Local position (office model frame) of an office FBX node at a timeline frame. */
export type NodeSampler = (node: string, frame: number) => Vec3;

/** Transform applied on top of a representative's rest placement. */
export interface RepPose {
    /** Translation from the rest position, metres. */
    offset: Vec3;
    /** Euler XYZ rotation about the figurine's centre, radians. */
    rotation: Vec3;
    visible: boolean;
}

const REST_POSE: RepPose = { offset: [0, 0, 0], rotation: [0, 0, 0], visible: true };

/** Representatives that just went from 'active' to 'eliminated' (sick reps are not on screen). */
export function findNewEliminations(prev: RepStatuses, next: RepStatuses): Power[] {
    return POWERS.filter((p) => prev[p] === 'active' && next[p] === 'eliminated');
}

/**
 * Next set of runs after a status change: runs whose representative is no longer
 * eliminated are dropped (e.g. a new rep was appointed at round end), and fresh
 * eliminations start at `now` — only while the room is on screen, so an
 * elimination nobody saw is not replayed later.
 */
export function updateExecutionRuns(
    runs: ExecutionRuns,
    prev: RepStatuses,
    next: RepStatuses,
    roomVisible: boolean,
    now: number,
): ExecutionRuns {
    const updated: ExecutionRuns = {};
    for (const p of POWERS) {
        const start = runs[p];
        if (start !== undefined && next[p] === 'eliminated') updated[p] = start;
    }
    if (roomVisible) {
        for (const p of findNewEliminations(prev, next)) updated[p] = now;
    }
    return updated;
}

/** Office timeline frame of `power`'s execution after `elapsedMs`, clamped to its slice. */
export function executionFrame(power: Power, elapsedMs: number): number {
    const { startFrame, endFrame } = REP_EXECUTIONS[power];
    return Math.min(endFrame, startFrame + (Math.max(0, elapsedMs) * EXECUTION_FPS) / 1000);
}

/** True once the execution has reached its last frame. */
export function isExecutionOver(power: Power, elapsedMs: number): boolean {
    return executionFrame(power, elapsedMs) >= REP_EXECUTIONS[power].endFrame;
}

/** Representative transform at an office timeline `frame` of its own execution. */
export function repExecutionPose(power: Power, frame: number, sample: NodeSampler): RepPose {
    switch (power) {
        case 'business': return elitePose(frame, sample);
        case 'military': return militaryPose(frame);
        case 'people': return peoplePose(frame, sample);
    }
}

/** Rides the spring plate, then leaves it at launchFrame on a tumbling arc. */
function elitePose(frame: number, sample: NodeSampler): RepPose {
    const { plateNode, launchFrame, velocity, gravity, spin } = ELITE_YEET;
    const restY = sample(plateNode, REP_EXECUTIONS.business.startFrame)[1];
    if (frame < launchFrame) {
        return { ...REST_POSE, offset: [0, sample(plateNode, frame)[1] - restY, 0] };
    }
    const t = (frame - launchFrame) / EXECUTION_FPS;
    const lift = sample(plateNode, launchFrame)[1] - restY;
    return {
        offset: [velocity[0] * t, lift + velocity[1] * t - 0.5 * gravity * t * t, velocity[2] * t],
        rotation: [spin[0] * t, spin[1] * t, spin[2] * t],
        visible: true,
    };
}

/** Hangs over the open trapdoor until dropFrame, then free-falls out of sight. */
function militaryPose(frame: number): RepPose {
    const { dropFrame, gravity, tiltRate, maxTilt, hideBelow } = MILITARY_DROP;
    const t = Math.max(0, frame - dropFrame) / EXECUTION_FPS;
    const drop = 0.5 * gravity * t * t;
    return {
        offset: [0, -drop, 0],
        rotation: [-Math.min(maxTilt, tiltRate * t), 0, 0],
        visible: drop < hideBelow,
    };
}

/** Sits until the claw's fingers close on him, then moves rigidly with the claw. */
function peoplePose(frame: number, sample: NodeSampler): RepPose {
    const { clawNode, grabFrame } = PEOPLE_GRAB;
    if (frame < grabFrame) return REST_POSE;
    const clawAtGrab = sample(clawNode, grabFrame);
    const claw = sample(clawNode, frame);
    return {
        ...REST_POSE,
        offset: [claw[0] - clawAtGrab[0], claw[1] - clawAtGrab[1], claw[2] - clawAtGrab[2]],
    };
}
