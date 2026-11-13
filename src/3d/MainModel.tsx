import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { AnimationClip, Vector3, type Group } from "three";
import { useGameStore } from "../Stores/GameState";
import { Power as POWERS } from "../Constants/Power";
import {
    EXECUTION_FPS,
    OFFICE_CAMERA_POSITIONS,
    OFFICE_MODEL_OFFSET,
    OFFICE_MODEL_URL,
    REP_EXECUTIONS,
    REP_MODELS,
} from "../Constants/Office";
import { executionFrame, repExecutionPose, type ExecutionRuns, type NodeSampler, type RepPose } from "../Utils/RepExecution";
import type { Power } from "../types/Power";
import { ClipPoser } from "./ClipPoser";
import { pixelateTextures } from "./pixelate";

/** Outer group of each representative figurine, moved by the execution director. */
export type RepRigs = Record<Power, Group | null>;

interface MainModelProps {
    /** Executions in progress (start times, performance.now() clock). */
    executions: ExecutionRuns;
    /** Called once when an execution reaches its last frame. */
    onExecutionDone: (power: Power) => void;
    repRigs: RefObject<RepRigs>;
}

/**
 * The palace interior (Meet + Laws rooms). Also the execution director: every
 * frame it scrubs each representative's slice of the baked office take (couch
 * spring, trapdoor, toy claw) — rest frame when idle — and moves the
 * representatives being executed in sync with those props.
 */
export function MainModel({ executions, onExecutionDone, repRigs }: MainModelProps) {
    const fbx = useLoader(FBXLoader, OFFICE_MODEL_URL) as Group;
    const moveCameraTo = useGameStore((s) => s.scene.camera.moveCameraTo);
    const setCameraPositions = useGameStore((s) => s.scene.camera.setCameraPositions);

    const poser = useMemo(() => {
        const clip = fbx.animations[0] ?? new AnimationClip('empty', 0, []);
        const p = new ClipPoser(fbx, clip, EXECUTION_FPS);
        for (const power of POWERS) {
            for (const node of REP_EXECUTIONS[power].nodes) {
                if (!p.animates(node)) console.warn(`MainModel: office take does not animate "${node}" (${power} execution)`);
            }
        }
        return p;
    }, [fbx]);

    useEffect(() => {
        const positions = OFFICE_CAMERA_POSITIONS.map(([x, y, z]) => new Vector3(x, y, z));
        setCameraPositions(positions);
        moveCameraTo([...OFFICE_CAMERA_POSITIONS[0]], positions[0].clone());

        pixelateTextures(fbx);
    }, [fbx, moveCameraTo, setCameraPositions]);

    // `${power}@${start}` of runs already reported done, so each run reports once.
    const reported = useRef(new Set<string>());

    useFrame(() => {
        const now = performance.now();
        const sample: NodeSampler = (node, frame) => poser.samplePosition(node, frame);
        for (const power of POWERS) {
            const slice = REP_EXECUTIONS[power];
            const start = executions[power];
            const frame = start === undefined ? slice.startFrame : executionFrame(power, now - start);
            poser.apply(slice.nodes, frame);
            if (start === undefined) continue;

            const rig = repRigs.current?.[power];
            if (rig) applyRepPose(rig, power, repExecutionPose(power, frame, sample));

            const key = `${power}@${start}`;
            if (frame >= slice.endFrame && !reported.current.has(key)) {
                reported.current.add(key);
                onExecutionDone(power);
            }
        }
    });

    return <primitive receiveShadow object={fbx} position={OFFICE_MODEL_OFFSET} />;
}

function applyRepPose(rig: Group, power: Power, pose: RepPose) {
    const [x, y, z] = REP_MODELS[power].position;
    rig.position.set(x + pose.offset[0], y + pose.offset[1], z + pose.offset[2]);
    rig.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
    rig.visible = pose.visible;
}
