import type { AnimationClip, Interpolant, KeyframeTrack, Object3D } from 'three';
import type { Vec3 } from '../Utils/RepExecution';

/** Set at runtime by KeyframeTrack.setInterpolation (slerp for quaternion tracks); missing from @types/three. */
type TrackWithInterpolant = KeyframeTrack & { createInterpolant(): Interpolant };

type TransformProperty = 'position' | 'quaternion' | 'scale';

interface Channel {
    nodeName: string;
    node: Object3D;
    property: TransformProperty;
    interpolant: Interpolant;
}

/**
 * Poses a hierarchy at an exact frame of a baked transform clip — a scrubber, not
 * a player. Used for the office take, where each representative's execution owns
 * a slice of one timeline: an AnimationMixer would need one action per slice and
 * looping/clamping care at the slice ends, while here the caller just says
 * "these nodes, this frame". Only position/quaternion/scale tracks are handled
 * (the Max export is transform-only).
 */
export class ClipPoser {
    private readonly channels: Channel[] = [];
    private readonly root: Object3D;
    private readonly fps: number;

    /**
     * @param root hierarchy the clip's track names resolve against (by node name)
     * @param clip baked clip; track names look like `NodeName.position`
     * @param fps frame rate the clip was authored at, to convert frames to clip time
     */
    constructor(root: Object3D, clip: AnimationClip, fps: number) {
        this.root = root;
        this.fps = fps;
        for (const track of clip.tracks) {
            const dot = track.name.lastIndexOf('.');
            const nodeName = track.name.slice(0, dot);
            const property = track.name.slice(dot + 1);
            if (property !== 'position' && property !== 'quaternion' && property !== 'scale') continue;
            const node = root.getObjectByName(nodeName);
            if (!node) continue;
            this.channels.push({ nodeName, node, property, interpolant: (track as TrackWithInterpolant).createInterpolant() });
        }
    }

    /** True when the clip animates `nodeName`. */
    animates(nodeName: string): boolean {
        return this.channels.some((c) => c.nodeName === nodeName);
    }

    /** Writes the clip's transforms at `frame` into the listed nodes; other nodes are untouched. */
    apply(nodeNames: readonly string[], frame: number): void {
        const t = frame / this.fps;
        for (const c of this.channels) {
            if (!nodeNames.includes(c.nodeName)) continue;
            const v = c.interpolant.evaluate(t);
            c.node[c.property].fromArray(v);
        }
    }

    /**
     * Local position of `nodeName` at `frame`, without touching the node. Falls back
     * to the node's current position when the clip has no position track for it.
     */
    samplePosition(nodeName: string, frame: number): Vec3 {
        const c = this.channels.find((ch) => ch.nodeName === nodeName && ch.property === 'position');
        if (c) {
            const v = c.interpolant.evaluate(frame / this.fps);
            return [v[0], v[1], v[2]];
        }
        const node = this.root.getObjectByName(nodeName);
        return node ? [node.position.x, node.position.y, node.position.z] : [0, 0, 0];
    }
}
