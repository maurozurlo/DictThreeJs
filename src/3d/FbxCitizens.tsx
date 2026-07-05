import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { WaypointPath } from '../types/StreetLayout';
import { pathTotalLength, positionAtPathDistance } from '../Utils/PathUtils';

const FITMAN_URL = '/models/fitman_walking.fbx';
const HEAD_TEXTURE_URL = '/textures/head_citizen1.png';

/** How many animated fit-man clones to scatter across the sidewalk loops. */
const FBX_CITIZEN_COUNT = 8;
/** Rendered character height in metres — matches the 'fit' box ped (art-bible §10.0). */
const TARGET_HEIGHT = 1.8;
/** Ground speed range [min, max] in m/s, matching the box-citizen speed spread. */
const SPEED_RANGE: [number, number] = [0.9, 1.4];
/** Ground speed (m/s) at which the Mixamo walk cycle plays at 1× without foot sliding. */
const WALK_CLIP_NATURAL_SPEED = 1.4;

/**
 * Material names inside fitman_walking.fbx (Mixamo export) → logical body part.
 * The head material lost its texture link at export, so we re-attach
 * head_citizen1.png manually; body/pants keep their embedded textures.
 */
const MATERIAL_PART: Record<string, 'body' | 'pants' | 'head'> = {
    'Material #495': 'body',
    'Material #470': 'pants',
    'Material #482': 'head',
};

// Tint pools — the citizen textures are grayscale, so material.color
// multiplies through as the part's colour. Cosmetic only (no seeded RNG).
const BODY_TINTS = ['#d9584a', '#4a7ad9', '#4aa06a', '#d9a54a', '#9a6ad9', '#d98ab8', '#d0d0d0', '#6a9a9a'];
const PANTS_TINTS = ['#4a5a7a', '#6a5a4a', '#5a5a5a', '#7a7a6a', '#3a4a3a', '#8a4a4a'];
const HEAD_TINTS = ['#ffe0c0', '#f5cfa8', '#e0ab80', '#c08858', '#a06840', '#ffd9b8'];

interface CitizenTints {
    body: string;
    pants: string;
    head: string;
}

function randomFrom<T>(pool: readonly T[]): T {
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Clone a source material for one clone instance, tinting it per body part.
 * The head part also gets its texture re-attached (missing from the FBX).
 */
function tintedMaterial(source: THREE.Material, tints: CitizenTints, headTexture: THREE.Texture): THREE.Material {
    const mat = source.clone() as THREE.MeshPhongMaterial;
    const part = MATERIAL_PART[source.name];
    if (!part) return mat;
    if (part === 'head' && !mat.map) mat.map = headTexture;
    mat.color = new THREE.Color(tints[part]);
    return mat;
}

interface FbxCitizenSpawn {
    id: number;
    path: WaypointPath;
    startDist: number;
    speed: number;
    /** Walk-cycle phase offset [0, 1) so clones don't step in sync. */
    phase: number;
    tints: CitizenTints;
}

// ---------------------------------------------------------------------------
// FbxCitizenWalker — one animated clone following a waypoint loop
// ---------------------------------------------------------------------------

interface FbxCitizenWalkerProps {
    source: THREE.Group;
    clip: THREE.AnimationClip | null;
    headTexture: THREE.Texture;
    /** Uniform scale factor bringing the raw FBX to TARGET_HEIGHT metres. */
    modelScale: number;
    /** World-Y lift (already scaled) so the model's feet sit on the ground plane. */
    yOffset: number;
    spawn: FbxCitizenSpawn;
}

function FbxCitizenWalker({ source, clip, headTexture, modelScale, yOffset, spawn }: FbxCitizenWalkerProps) {
    const groupRef = useRef<THREE.Group>(null);

    const start = useMemo(
        () => positionAtPathDistance(spawn.path.waypoints, spawn.startDist),
        [spawn.path, spawn.startDist],
    );
    const pos = useRef(start.pos.clone());
    const nextIdx = useRef(start.nextIdx);

    const { model, mixer } = useMemo(() => {
        const model = cloneSkeleton(source) as THREE.Group;
        model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Skinned bounds don't track bone motion — never cull mid-animation
            mesh.frustumCulled = false;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map((m) => tintedMaterial(m, spawn.tints, headTexture))
                : tintedMaterial(mesh.material, spawn.tints, headTexture);
        });

        const mixer = new THREE.AnimationMixer(model);
        return { model, mixer };
    }, [source, clip, headTexture, spawn]);

    // Start/stop inside the effect (not useMemo) so StrictMode's mount →
    // cleanup → remount cycle in dev doesn't leave the action stopped.
    useEffect(() => {
        if (clip) {
            const action = mixer.clipAction(clip);
            action.time = spawn.phase * clip.duration;
            action.timeScale = spawn.speed / WALK_CLIP_NATURAL_SPEED;
            action.play();
        }
        return () => { mixer.stopAllAction(); };
    }, [mixer, clip, spawn]);

    useFrame((_, delta) => {
        mixer.update(delta);

        const target = spawn.path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget = targetPos.clone().sub(pos.current);
        const dist = toTarget.length();
        const moveDir = toTarget.clone().normalize();

        const step = spawn.speed * delta;
        if (dist <= step) {
            pos.current.copy(targetPos);
            nextIdx.current = (nextIdx.current + 1) % spawn.path.waypoints.length;
        } else {
            pos.current.addScaledVector(moveDir, step);
        }

        if (groupRef.current) {
            groupRef.current.position.set(pos.current.x, pos.current.y + yOffset, pos.current.z);
            // Mixamo rigs face +Z, so atan2(x, z) of the move direction is the heading
            if (dist > 1e-4) groupRef.current.rotation.y = Math.atan2(moveDir.x, moveDir.z);
        }
    });

    return (
        <group
            ref={groupRef}
            position={[start.pos.x, start.pos.y + yOffset, start.pos.z]}
            scale={modelScale}
        >
            <primitive object={model} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// FbxCitizens — atmospheric crowd of animated fit-man clones
// ---------------------------------------------------------------------------

/**
 * Spawns FBX_CITIZEN_COUNT walking fit-man clones distributed across the given
 * pedestrian paths, each with a random body/pants/head tint, speed, and
 * walk-cycle phase. Purely atmospheric — no game-state interaction.
 * Must be rendered inside a <Suspense> boundary (FBX + texture loads suspend).
 */
function FbxCitizens({ paths }: { paths: WaypointPath[] }) {
    const fbx = useLoader(FBXLoader, FITMAN_URL);
    const headTexture = useLoader(THREE.TextureLoader, HEAD_TEXTURE_URL);

    const { walkClip, modelScale, yOffset } = useMemo(() => {
        headTexture.colorSpace = THREE.SRGBColorSpace;
        headTexture.needsUpdate = true;

        // Longest clip is the Mixamo walk ("Take 001" is a zero-length stub)
        const walkClip = fbx.animations.reduce<THREE.AnimationClip | null>(
            (best, c) => (best === null || c.duration > best.duration ? c : best),
            null,
        );

        // Normalise raw FBX units (bind pose ≈ 6.7 units tall) to metres
        const bounds = new THREE.Box3().setFromObject(fbx);
        const rawHeight = Math.max(bounds.max.y - bounds.min.y, 1e-3);
        const modelScale = 1; //TARGET_HEIGHT / rawHeight;
        const yOffset = -bounds.min.y * modelScale;

        return { walkClip, modelScale, yOffset };
    }, [fbx, headTexture]);

    // Cosmetic randomisation only — deliberately NOT the seeded gameplay RNG
    // (drawing from the cursor here would desync gameplay rolls, ADR-0010).
    const spawns = useMemo((): FbxCitizenSpawn[] => {
        if (paths.length === 0) return [];
        const [minSpeed, maxSpeed] = SPEED_RANGE;

        return Array.from({ length: FBX_CITIZEN_COUNT }, (_, i) => {
            const path = paths[i % paths.length];
            const total = pathTotalLength(path.waypoints);
            const perPath = Math.ceil(FBX_CITIZEN_COUNT / paths.length);
            const rank = Math.floor(i / paths.length);
            // Even spacing along the loop with a little jitter so it reads organic
            const startDist = ((rank + Math.random() * 0.5) / perPath) * total;

            return {
                id: i,
                path,
                startDist,
                speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
                phase: Math.random(),
                tints: {
                    body: randomFrom(BODY_TINTS),
                    pants: randomFrom(PANTS_TINTS),
                    head: randomFrom(HEAD_TINTS),
                },
            };
        });
    }, [paths]);

    return (
        <>
            {spawns.map((spawn) => (
                <FbxCitizenWalker
                    key={spawn.id}
                    source={fbx}
                    clip={walkClip}
                    headTexture={headTexture}
                    modelScale={modelScale}
                    yOffset={yOffset}
                    spawn={spawn}
                />
            ))}
        </>
    );
}

export default FbxCitizens;
