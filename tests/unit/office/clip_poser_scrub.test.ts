import { describe, it, expect } from 'vitest';
import { AnimationClip, Object3D, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { ClipPoser } from '../../../src/3d/ClipPoser';

const FPS = 30;

/** Root → Mover (position 0→3 on x over 30 frames), Spinner (0→180° about y). */
function makeRig() {
    const root = new Object3D();
    const mover = new Object3D(); mover.name = 'Mover';
    const spinner = new Object3D(); spinner.name = 'Spinner';
    const still = new Object3D(); still.name = 'Still'; still.position.set(7, 8, 9);
    root.add(mover, spinner, still);
    const half = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, Math.PI);
    const clip = new AnimationClip('take', 1, [
        new VectorKeyframeTrack('Mover.position', [0, 1], [0, 0, 0, 3, 0, 0]),
        new QuaternionKeyframeTrack('Spinner.quaternion', [0, 1], [0, 0, 0, 1, half.x, half.y, half.z, half.w]),
        new VectorKeyframeTrack('Ghost.position', [0, 1], [0, 0, 0, 1, 1, 1]),
    ]);
    return { root, mover, spinner, still, poser: new ClipPoser(root, clip, FPS) };
}

describe('ClipPoser', () => {
    it('test_clip_poser_apply_poses_listed_nodes_at_exact_frame', () => {
        const { mover, poser } = makeRig();
        poser.apply(['Mover'], 15);
        expect(mover.position.x).toBeCloseTo(1.5);
        poser.apply(['Mover'], 30);
        expect(mover.position.x).toBeCloseTo(3);
    });

    it('test_clip_poser_apply_leaves_unlisted_nodes_alone', () => {
        const { spinner, poser } = makeRig();
        poser.apply(['Mover'], 30);
        expect(spinner.quaternion.w).toBeCloseTo(1);
    });

    it('test_clip_poser_quaternion_tracks_slerp', () => {
        const { spinner, poser } = makeRig();
        poser.apply(['Spinner'], 15);
        // Halfway between 0° and 180° about y is 90°: w = cos(45°).
        expect(spinner.quaternion.w).toBeCloseTo(Math.SQRT1_2);
        expect(spinner.quaternion.y).toBeCloseTo(Math.SQRT1_2);
    });

    it('test_clip_poser_frames_outside_clip_hold_end_values', () => {
        const { mover, poser } = makeRig();
        poser.apply(['Mover'], -10);
        expect(mover.position.x).toBeCloseTo(0);
        poser.apply(['Mover'], 90);
        expect(mover.position.x).toBeCloseTo(3);
    });

    it('test_clip_poser_sample_position_does_not_move_node', () => {
        const { mover, poser } = makeRig();
        expect(poser.samplePosition('Mover', 10)[0]).toBeCloseTo(1);
        expect(mover.position.x).toBe(0);
    });

    it('test_clip_poser_unanimated_and_missing_nodes', () => {
        const { poser } = makeRig();
        expect(poser.animates('Mover')).toBe(true);
        expect(poser.animates('Still')).toBe(false);
        expect(poser.animates('Ghost')).toBe(false); // track exists, node does not
        expect(poser.samplePosition('Still', 10)).toEqual([7, 8, 9]);
    });
});
