import { describe, it, expect } from 'vitest';
import {
    findNewEliminations, updateExecutionRuns, executionFrame, isExecutionOver, repExecutionPose,
    type RepStatuses, type NodeSampler, type Vec3,
} from '../../../src/Utils/RepExecution';
import {
    EXECUTION_FPS, REP_EXECUTIONS, ELITE_YEET, MILITARY_DROP, PEOPLE_GRAB,
} from '../../../src/Constants/Office';

const ALL_ACTIVE: RepStatuses = { people: 'active', business: 'active', military: 'active' };
const msForFrames = (frames: number) => (frames / EXECUTION_FPS) * 1000;

// Fake office take: the spring plate rises one unit per frame, the claw rises
// two units per frame after the grab — only the shape matters to the poses.
const PLATE_RISE_PER_FRAME = 0.01;
const CLAW_RISE_PER_FRAME = 0.02;
const sampler: NodeSampler = (node, frame): Vec3 => {
    if (node === ELITE_YEET.plateNode) return [0, frame * PLATE_RISE_PER_FRAME, 0];
    if (node === PEOPLE_GRAB.clawNode) return [0.5, Math.max(0, frame - PEOPLE_GRAB.grabFrame) * CLAW_RISE_PER_FRAME, 0.25];
    return [0, 0, 0];
};

describe('RepExecution — status transitions', () => {
    it('test_rep_execution_active_to_eliminated_starts_execution', () => {
        expect(findNewEliminations(ALL_ACTIVE, { ...ALL_ACTIVE, military: 'eliminated' })).toEqual(['military']);
    });

    it('test_rep_execution_sick_or_unchanged_reps_do_not_start_execution', () => {
        const sick: RepStatuses = { ...ALL_ACTIVE, people: 'sick' };
        expect(findNewEliminations(sick, { ...sick, people: 'eliminated' })).toEqual([]);
        expect(findNewEliminations(ALL_ACTIVE, ALL_ACTIVE)).toEqual([]);
    });

    it('test_rep_execution_run_starts_at_now_only_while_room_visible', () => {
        const next: RepStatuses = { ...ALL_ACTIVE, business: 'eliminated' };
        expect(updateExecutionRuns({}, ALL_ACTIVE, next, true, 1234)).toEqual({ business: 1234 });
        expect(updateExecutionRuns({}, ALL_ACTIVE, next, false, 1234)).toEqual({});
    });

    it('test_rep_execution_run_survives_unrelated_change_and_drops_when_rep_returns', () => {
        const eliminated: RepStatuses = { ...ALL_ACTIVE, business: 'eliminated' };
        const runs = { business: 1000 };
        const unrelated: RepStatuses = { ...eliminated, people: 'sick' };
        expect(updateExecutionRuns(runs, eliminated, unrelated, true, 2000)).toEqual({ business: 1000 });
        expect(updateExecutionRuns(runs, eliminated, ALL_ACTIVE, true, 2000)).toEqual({});
    });
});

describe('RepExecution — timeline', () => {
    it('test_rep_execution_frame_starts_at_slice_start_and_advances_at_fps', () => {
        const { startFrame } = REP_EXECUTIONS.people;
        expect(executionFrame('people', 0)).toBe(startFrame);
        expect(executionFrame('people', -50)).toBe(startFrame);
        expect(executionFrame('people', msForFrames(10))).toBeCloseTo(startFrame + 10);
    });

    it('test_rep_execution_frame_clamps_at_slice_end_and_reports_over', () => {
        const { startFrame, endFrame } = REP_EXECUTIONS.military;
        const length = endFrame - startFrame;
        expect(isExecutionOver('military', msForFrames(length - 1))).toBe(false);
        expect(isExecutionOver('military', msForFrames(length))).toBe(true);
        expect(executionFrame('military', msForFrames(length * 3))).toBe(endFrame);
    });

    it('test_rep_execution_slices_do_not_overlap', () => {
        const slices = Object.values(REP_EXECUTIONS).sort((a, b) => a.startFrame - b.startFrame);
        for (let i = 1; i < slices.length; i++) expect(slices[i].startFrame).toBeGreaterThanOrEqual(slices[i - 1].endFrame);
        const nodes = slices.flatMap((s) => s.nodes);
        expect(new Set(nodes).size).toBe(nodes.length);
    });
});

describe('RepExecution — poses', () => {
    it('test_rep_execution_elite_rides_plate_then_flies_up_and_tumbles', () => {
        const start = REP_EXECUTIONS.business.startFrame;
        const riding = repExecutionPose('business', ELITE_YEET.launchFrame - 1, sampler);
        expect(riding.offset[1]).toBeCloseTo((ELITE_YEET.launchFrame - 1 - start) * PLATE_RISE_PER_FRAME);
        expect(riding.rotation).toEqual([0, 0, 0]);

        const atLaunch = repExecutionPose('business', ELITE_YEET.launchFrame, sampler);
        const airborne = repExecutionPose('business', ELITE_YEET.launchFrame + 4, sampler);
        expect(airborne.offset[1]).toBeGreaterThan(atLaunch.offset[1]);
        expect(Math.sign(airborne.offset[0])).toBe(Math.sign(ELITE_YEET.velocity[0]));
        expect(airborne.rotation.some((r) => r !== 0)).toBe(true);
        expect(airborne.visible).toBe(true);
    });

    it('test_rep_execution_military_hangs_then_falls_out_of_sight', () => {
        const hanging = repExecutionPose('military', MILITARY_DROP.dropFrame, sampler);
        expect(hanging.offset).toEqual([0, -0, 0]);
        expect(hanging.visible).toBe(true);

        const falling = repExecutionPose('military', MILITARY_DROP.dropFrame + 2, sampler);
        expect(falling.offset[1]).toBeLessThan(0);
        expect(Math.abs(falling.rotation[0])).toBeLessThanOrEqual(MILITARY_DROP.maxTilt);

        const gone = repExecutionPose('military', REP_EXECUTIONS.military.endFrame, sampler);
        expect(gone.visible).toBe(false);
    });

    it('test_rep_execution_people_rep_rests_until_grab_then_moves_with_claw', () => {
        expect(repExecutionPose('people', PEOPLE_GRAB.grabFrame - 1, sampler).offset).toEqual([0, 0, 0]);
        expect(repExecutionPose('people', PEOPLE_GRAB.grabFrame, sampler).offset).toEqual([0, 0, 0]);
        const carried = repExecutionPose('people', PEOPLE_GRAB.grabFrame + 5, sampler);
        expect(carried.offset[1]).toBeCloseTo(5 * CLAW_RISE_PER_FRAME);
        expect(carried.offset[0]).toBe(0);
        expect(carried.rotation).toEqual([0, 0, 0]);
    });
});
