import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { STREET_LAYOUT } from '../assets/streetLayout';
import type { WaypointPath } from '../types/StreetLayout';
import type { Citizen, CitizenState } from '../types/Citizen';
import { computeBodyType } from '../Stores/CitizenHandler';
import { pathTotalLength, positionAtPathDistance } from '../Utils/PathUtils';

// ---------------------------------------------------------------------------
// Asset catalogue
// ---------------------------------------------------------------------------

type BodyType = ReturnType<typeof computeBodyType>;

/**
 * Street-visual variant, resolved from role/employment/faction with the same
 * precedence as the old outfit-colour chain (GDD citizen-simulation §3.2).
 */
type PedVariant = 'citizen' | 'army' | 'biz' | 'thf' | 'pro';

/** Stable order — index-aligned with the useLoader model array. */
const BODY_TYPES: readonly BodyType[] = ['fit', 'fat', 'slim'];

const MODEL_URLS: Record<BodyType, string> = {
    fit: '/models/citizens/fitman_walking.fbx',
    fat: '/models/citizens/fatman_walking.fbx',
    slim: '/models/citizens/slimman_walking.fbx',
};

const PROP_URL_LIST = [
    '/models/citizens/ped_army_hat.glb',
    '/models/citizens/ped_protester_megaphone.glb',
    '/models/citizens/ped_protester_sign.glb',
] as const;
type PropKind = 'armyHat' | 'megaphone' | 'sign';
const PROP_KINDS: readonly PropKind[] = ['armyHat', 'megaphone', 'sign'];

const TEX_BASE = '/textures/peds';
const HEAD_TEXTURE_URLS = [`${TEX_BASE}/head_citizen1.png`, `${TEX_BASE}/head_citizen2.png`];

/** Role-specific body/pants textures ship pre-coloured; only 'citizen' gets tinted. */
function bodyTextureUrl(v: PedVariant): string {
    return v === 'citizen' ? `${TEX_BASE}/body_citizen.png` : `${TEX_BASE}/body_citizen_${v}.png`;
}
function pantsTextureUrl(v: PedVariant): string {
    return v === 'citizen' ? `${TEX_BASE}/pants_citizen.png` : `${TEX_BASE}/pants_citizen_${v}.png`;
}

const ALL_VARIANTS: readonly PedVariant[] = ['citizen', 'army', 'biz', 'thf', 'pro'];
const ALL_TEXTURE_URLS: string[] = [
    ...ALL_VARIANTS.map(bodyTextureUrl),
    ...ALL_VARIANTS.map(pantsTextureUrl),
    ...HEAD_TEXTURE_URLS,
];

/**
 * Material names inside the citizen FBX exports (identical across all three
 * body models — verified) → logical body part. Textures are assigned
 * explicitly per part, so the FBX-embedded maps are never used.
 */
const MATERIAL_PART: Record<string, 'body' | 'pants' | 'head'> = {
    'Material #495': 'body',
    'Material #470': 'pants',
    'Material #482': 'head',
};

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/**
 * World units per metre for citizen models. The street layout is metric
 * (1 unit = 1 m) but the env GLBs are drawn ~3.7× oversized (stylised), so
 * peds are scaled to match the environment, not the metric layout — the size
 * the user locked in during live testing of the FBX experiment.
 */
const PED_WORLD_SCALE = 3.7;

/** Rendered heights in metres per body type (× PED_WORLD_SCALE at render). */
const TARGET_HEIGHTS: Record<BodyType, number> = { fit: 1.8, fat: 1.5, slim: 1.6 };

/** Invisible click-hitbox dimensions [w, h, d] per body type, in metres. */
const HITBOX_DIMS: Record<BodyType, [number, number, number]> = {
    fat: [0.8, 1.5, 0.8],
    slim: [0.4, 1.6, 0.4],
    fit: [0.6, 1.8, 0.6],
};

/** Ground speed (m/s) at which the Mixamo walk cycle plays at 1× without foot sliding. */
const WALK_CLIP_NATURAL_SPEED = 1.4;
/** Static protestors march in place at this fraction of walk speed (placeholder anim). */
const PROTESTOR_ANIM_TIMESCALE = 0.45;
/** Citizens pause when another ped is within this distance ahead of them (world units). */
const MIN_PED_SEPARATION = 3.0;

// Tint pools for regular citizens — the ped textures are grayscale so
// material.color multiplies through as the part colour. Cosmetic only:
// deliberately NOT the seeded gameplay RNG (would desync rolls, ADR-0010).
const CIVILIAN_BODY_TINTS = ['#d9584a', '#4a7ad9', '#4aa06a', '#d9a54a', '#9a6ad9', '#d98ab8', '#d0d0d0', '#6a9a9a'];
const CIVILIAN_PANTS_TINTS = ['#4a5a7a', '#6a5a4a', '#5a5a5a', '#7a7a6a', '#3a4a3a', '#8a4a4a'];

/** Persistent skin tones — indexed by `Citizen.skin` (0–4), light → dark. */
const SKIN_TONES = ['#ffdfc4', '#f0c8a0', '#dda577', '#b97a50', '#8d5a3b'] as const;

/**
 * Flat prop colours. The current GLB exports have no UVs (and the hat's
 * embedded texture is unusable without them), so textures — including
 * protester_bits.png — can't be applied until the props are re-exported
 * with UV maps. Until then: olive cap, red megaphone, cardboard sign.
 */
const PROP_COLORS: Record<PropKind, string> = {
    armyHat: '#4f5d3a',
    megaphone: '#b03a30',
    sign: '#d6c9a8',
};

/**
 * Bone-attachment tuning per prop. `position` is in bone-local raw FBX units
 * (the rig is ~6.7 units tall, so 1 unit ≈ ¼ body height); `scale` is the
 * absolute bone-local scale (the GLBs carry a 0.001 exporter node scale, so
 * useful values sit in the hundreds — tuned against screenshots).
 */
interface PropFit {
    bone: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
}
const PROP_FIT: Record<PropKind, PropFit> = {
    armyHat: { bone: 'mixamorigHead', position: [0, 0.55, 0.08], rotation: [0, 0, 0], scale: 1400 },
    megaphone: { bone: 'mixamorigRightHand', position: [0, 0.35, 0.1], rotation: [Math.PI / 2, 0, 0], scale: 700 },
    sign: { bone: 'mixamorigRightHand', position: [0, 0.45, 0], rotation: [0, Math.PI / 2, Math.PI], scale: 550 },
};

/** Protestors cluster statically at these plaza positions (cycles if > 8).
 *  Spread for env-scale peds (~2.2 units shoulder width). */
const PROTESTOR_POSITIONS: readonly [number, number, number][] = [
    [-4, 0, -6], [-1.5, 0, -7], [1.5, 0, -6], [4, 0, -7],
    [-3, 0, -9.5], [0, 0, -10.5], [3, 0, -9.5], [0, 0, -13],
];

// ---------------------------------------------------------------------------
// Shared per-frame position registry for proximity pausing
// ---------------------------------------------------------------------------

const citizenPedPositions = new Map<number, THREE.Vector3>();

// ---------------------------------------------------------------------------
// Appearance helpers
// ---------------------------------------------------------------------------

/** Outfit precedence chain — first matching rule wins (GDD §3.2). */
function variantFor(role: CitizenState['role'], employed: boolean, faction: Citizen['faction']): PedVariant {
    if (role === 'thief') return 'thf';
    if (role === 'protestor') return 'pro';
    if (employed && faction === 'military') return 'army';
    if (employed && faction === 'business') return 'biz';
    return 'citizen';
}

function randomFrom<T>(pool: readonly T[]): T {
    return pool[Math.floor(Math.random() * pool.length)];
}

interface Appearance {
    variant: PedVariant;
    /** null = leave white (role textures are pre-coloured). */
    bodyTint: string | null;
    pantsTint: string | null;
    /** Persistent — indexed by Citizen.skin. */
    skinTint: string;
    /** Bald-head texture variant — random per mount, deliberately untracked. */
    headTextureUrl: string;
}

function rollAppearance(variant: PedVariant, skin: Citizen['skin']): Appearance {
    return {
        variant,
        bodyTint: variant === 'citizen' ? randomFrom(CIVILIAN_BODY_TINTS) : null,
        pantsTint: variant === 'citizen' ? randomFrom(CIVILIAN_PANTS_TINTS) : null,
        skinTint: SKIN_TONES[skin],
        headTextureUrl: randomFrom(HEAD_TEXTURE_URLS),
    };
}

// ---------------------------------------------------------------------------
// Asset bundle prepared once per session
// ---------------------------------------------------------------------------

interface BodyModelAsset {
    source: THREE.Group;
    walkClip: THREE.AnimationClip | null;
    /** Uniform scale bringing the raw FBX to TARGET_HEIGHTS metres. */
    modelScale: number;
    /** World-Y lift (already scaled) so feet sit on the ground plane. */
    yOffset: number;
}

interface CitizenAssets {
    bodies: Record<BodyType, BodyModelAsset>;
    textures: Map<string, THREE.Texture>;
    /** Prop template objects — materials already prepared; clone per instance. */
    props: Record<PropKind, THREE.Object3D>;
}

/** Loads and prepares every model/texture the citizen roster needs. Suspends. */
function useCitizenAssets(): CitizenAssets {
    const models = useLoader(FBXLoader, BODY_TYPES.map((bt) => MODEL_URLS[bt]));
    const gltfs = useLoader(GLTFLoader, [...PROP_URL_LIST]);
    const loadedTextures = useLoader(THREE.TextureLoader, ALL_TEXTURE_URLS);

    return useMemo((): CitizenAssets => {
        const textures = new Map<string, THREE.Texture>();
        ALL_TEXTURE_URLS.forEach((url, i) => {
            const tex = loadedTextures[i];
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            textures.set(url, tex);
        });

        const bodies = {} as Record<BodyType, BodyModelAsset>;
        BODY_TYPES.forEach((bt, i) => {
            const source = models[i];
            // Longest clip is the Mixamo walk ("Take 001" is a zero-length stub)
            const walkClip = source.animations.reduce<THREE.AnimationClip | null>(
                (best, c) => (best === null || c.duration > best.duration ? c : best),
                null,
            );
            const bounds = new THREE.Box3().setFromObject(source);
            const rawHeight = Math.max(bounds.max.y - bounds.min.y, 1e-3);
            const modelScale = (TARGET_HEIGHTS[bt] * PED_WORLD_SCALE) / rawHeight;
            bodies[bt] = { source, walkClip, modelScale, yOffset: -bounds.min.y * modelScale };
        });

        // Prop templates — flat colours only until the GLBs get UV maps.
        const props = {} as Record<PropKind, THREE.Object3D>;
        PROP_KINDS.forEach((kind, i) => {
            const template = gltfs[i].scene.clone(true);
            template.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.castShadow = true;
                // Fresh unlit material: the exports lack UVs and normals, so a
                // lit material renders black. Basic keeps the flat colour visible.
                const prep = (): THREE.Material => new THREE.MeshBasicMaterial({ color: PROP_COLORS[kind] });
                mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prep) : prep();
            });
            props[kind] = template;
        });

        return { bodies, textures, props };
    }, [models, gltfs, loadedTextures]);
}

// ---------------------------------------------------------------------------
// Model construction per citizen instance
// ---------------------------------------------------------------------------

/** Clone the body model, apply per-part textures/tints, optionally attach a prop. */
function buildCitizenModel(
    assets: CitizenAssets,
    body: BodyModelAsset,
    appearance: Appearance,
    prop: PropKind | null,
): { model: THREE.Group; mixer: THREE.AnimationMixer } {
    const parts = {
        body: { map: assets.textures.get(bodyTextureUrl(appearance.variant))!, tint: appearance.bodyTint },
        pants: { map: assets.textures.get(pantsTextureUrl(appearance.variant))!, tint: appearance.pantsTint },
        head: { map: assets.textures.get(appearance.headTextureUrl)!, tint: appearance.skinTint },
    };

    const model = cloneSkeleton(body.source) as THREE.Group;
    model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Skinned bounds don't track bone motion — never cull mid-animation
        mesh.frustumCulled = false;
        const apply = (m: THREE.Material): THREE.Material => {
            const part = MATERIAL_PART[m.name];
            const mat = m.clone() as THREE.MeshPhongMaterial;
            if (!part) return mat;
            mat.map = parts[part].map;
            mat.color = new THREE.Color(parts[part].tint ?? '#ffffff');
            return mat;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(apply) : apply(mesh.material);
    });

    if (prop) {
        const fit = PROP_FIT[prop];
        const bone = model.getObjectByName(fit.bone);
        if (bone) {
            const instance = assets.props[prop].clone(true);
            instance.position.set(...fit.position);
            instance.rotation.set(...fit.rotation);
            // Bone-local scale: children of the bone inherit the body's model
            // scale, so a constant here keeps the prop proportional to its body.
            instance.scale.setScalar(fit.scale);
            bone.add(instance);
        }
    }

    return { model, mixer: new THREE.AnimationMixer(model) };
}

/** Starts the walk action StrictMode-safely; returns the effect cleanup. */
function startWalkAction(
    mixer: THREE.AnimationMixer,
    clip: THREE.AnimationClip | null,
    timeScale: number,
    phase: number,
): () => void {
    if (clip) {
        const action = mixer.clipAction(clip);
        action.time = phase * clip.duration;
        action.timeScale = timeScale;
        action.play();
    }
    return () => { mixer.stopAllAction(); };
}

// ---------------------------------------------------------------------------
// CitizenModelWalker — one walking citizen following a waypoint loop
// ---------------------------------------------------------------------------

interface WalkerProps {
    assets: CitizenAssets;
    bodyType: BodyType;
    appearance: Appearance;
    path: WaypointPath;
    startPos: THREE.Vector3;
    startNextIdx: number;
    speed: number;
    citizenId: number;
    onClick: (e: ThreeEvent<MouseEvent>) => void;
}

function CitizenModelWalker({
    assets, bodyType, appearance, path,
    startPos, startNextIdx, speed, citizenId, onClick,
}: WalkerProps) {
    const groupRef = useRef<THREE.Group>(null);
    const pos = useRef(startPos.clone());
    const nextIdx = useRef(startNextIdx);

    const body = assets.bodies[bodyType];

    const { model, mixer, phase } = useMemo(
        () => ({
            // Army walkers wear the hat; other roles carry nothing while walking
            ...buildCitizenModel(assets, body, appearance, appearance.variant === 'army' ? 'armyHat' : null),
            phase: Math.random(),
        }),
        [assets, body, appearance],
    );

    useEffect(
        () => startWalkAction(mixer, body.walkClip, speed / WALK_CLIP_NATURAL_SPEED, phase),
        [mixer, body.walkClip, speed, phase],
    );

    // Remove this citizen from the registry on unmount (death, role change, etc.)
    useEffect(() => {
        return () => { citizenPedPositions.delete(citizenId); };
    }, [citizenId]);

    useFrame((_, delta) => {
        mixer.update(delta);

        // Register current position so neighbours can read it
        let entry = citizenPedPositions.get(citizenId);
        if (!entry) { entry = new THREE.Vector3(); citizenPedPositions.set(citizenId, entry); }
        entry.copy(pos.current);

        const target = path.waypoints[nextIdx.current];
        const targetPos = new THREE.Vector3(target.x, target.y, target.z);
        const toTarget = targetPos.clone().sub(pos.current);
        const dist = toTarget.length();
        const moveDir = toTarget.clone().normalize();

        // Proximity pause: if another citizen ped is close AND ahead, wait this frame
        for (const [otherId, otherPos] of citizenPedPositions) {
            if (otherId === citizenId) continue;
            const diff = otherPos.clone().sub(pos.current);
            if (diff.length() < MIN_PED_SEPARATION && diff.dot(moveDir) > 0) return;
        }

        const step = speed * delta;
        if (dist <= step) {
            pos.current.copy(targetPos);
            nextIdx.current = (nextIdx.current + 1) % path.waypoints.length;
        } else {
            pos.current.addScaledVector(moveDir, step);
        }

        if (groupRef.current) {
            groupRef.current.position.set(pos.current.x, pos.current.y + body.yOffset, pos.current.z);
            // Mixamo rigs face +Z, so atan2(x, z) of the move direction is the heading
            if (dist > 1e-4) groupRef.current.rotation.y = Math.atan2(moveDir.x, moveDir.z);
        }
    });

    const [hw, hh, hd] = HITBOX_DIMS[bodyType].map((d) => d * PED_WORLD_SCALE) as [number, number, number];

    return (
        <group ref={groupRef} position={[startPos.x, startPos.y + body.yOffset, startPos.z]}>
            <group scale={body.modelScale}>
                <primitive object={model} />
            </group>
            {/* Invisible click hitbox — skinned-mesh raycasting is unreliable/costly */}
            <mesh position={[0, hh / 2, 0]} onClick={onClick}>
                <boxGeometry args={[hw, hh, hd]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------
// CitizenModelStatic — protestor standing at the plaza with an optional prop
// ---------------------------------------------------------------------------

interface StaticProps {
    assets: CitizenAssets;
    bodyType: BodyType;
    appearance: Appearance;
    position: readonly [number, number, number];
    onClick: (e: ThreeEvent<MouseEvent>) => void;
}

function CitizenModelStatic({ assets, bodyType, appearance, position, onClick }: StaticProps) {
    const body = assets.bodies[bodyType];

    const { model, mixer, phase, facing } = useMemo(() => {
        const roll = Math.random();
        const prop: PropKind | null = roll < 0.4 ? 'megaphone' : roll < 0.8 ? 'sign' : null;
        return {
            ...buildCitizenModel(assets, body, appearance, prop),
            phase: Math.random(),
            // Face the street (+Z) with a little jitter so the crowd looks organic
            facing: (Math.random() - 0.5) * 1.2,
        };
    }, [assets, body, appearance]);

    useEffect(
        () => startWalkAction(mixer, body.walkClip, PROTESTOR_ANIM_TIMESCALE, phase),
        [mixer, body.walkClip, phase],
    );

    useFrame((_, delta) => { mixer.update(delta); });

    const [hw, hh, hd] = HITBOX_DIMS[bodyType].map((d) => d * PED_WORLD_SCALE) as [number, number, number];

    return (
        <group position={[position[0], position[1] + body.yOffset, position[2]]} rotation={[0, facing, 0]}>
            <group scale={body.modelScale}>
                <primitive object={model} />
            </group>
            <mesh position={[0, hh / 2, 0]} onClick={onClick}>
                <boxGeometry args={[hw, hh, hd]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------
// CitizenModels — the full roster, replacing the old box peds
// ---------------------------------------------------------------------------

interface CitizenPathAssignment {
    startPos: THREE.Vector3;
    startNextIdx: number;
    speed: number;
}

/**
 * Renders every living citizen as an animated 3D model: walkers on the
 * sidewalk loops, protestors standing at the plaza. Role/employment/faction
 * pick the texture set (army/biz/thf/pro/citizen), `Citizen.skin` drives the
 * persistent head tint, and regular citizens get random body/pants tints.
 * Must be rendered inside a <Suspense> boundary (model + texture loads suspend).
 */
function CitizenModels() {
    const citizens = useGameStore((s) => s.citizens);
    const citizenStates = useGameStore((s) => s.citizenStates);
    const health = useGameStore((s) => s.budget.expenditures.health);
    const selectPed = useGameStore((s) => s.scene.selectPed);

    const assets = useCitizenAssets();

    // Pre-compute stable path assignments for all citizens. Depends only on the
    // citizens array (set once at game start) so assignments never shift mid-run.
    const citizenPathAssignments = useMemo((): Map<number, CitizenPathAssignment> => {
        const map = new Map<number, CitizenPathAssignment>();
        if (citizens.length === 0) return map;

        const { pedestrianPaths } = STREET_LAYOUT;
        const pathGroups: number[][] = pedestrianPaths.map(() => []);
        citizens.forEach((c) => pathGroups[c.id % pedestrianPaths.length].push(c.id));

        pathGroups.forEach((ids, pathIdx) => {
            if (ids.length === 0) return;
            const path = pedestrianPaths[pathIdx];
            const total = pathTotalLength(path.waypoints);
            const gap = total / ids.length;

            ids.forEach((citizenId, rank) => {
                const { pos, nextIdx } = positionAtPathDistance(path.waypoints, rank * gap);
                // Spread speeds evenly across [0.9, 1.4] within each path group
                const speed = 0.9 + (rank / ids.length) * 0.5;
                map.set(citizenId, { startPos: pos, startNextIdx: nextIdx, speed });
            });
        });

        return map;
    }, [citizens]);

    // Appearance per citizen — persistent skin tone from identity; head texture
    // and civilian tints re-roll ONLY when the variant changes (role/employment
    // shift). The cache keeps Appearance identity stable across rounds so child
    // useMemos don't re-clone 25 skeletons on every store update.
    const appearanceCache = useRef(new Map<number, Appearance>());
    const appearances = useMemo((): Map<number, Appearance> => {
        const cache = appearanceCache.current;
        citizens.forEach((citizen, i) => {
            const cs = citizenStates[i];
            if (!cs) return;
            const variant = variantFor(cs.role, cs.employed, citizen.faction);
            const prev = cache.get(citizen.id);
            if (!prev || prev.variant !== variant) {
                cache.set(citizen.id, rollAppearance(variant, citizen.skin));
            }
        });
        return new Map(cache);
    }, [citizens, citizenStates]);

    if (citizens.length === 0) return null;

    const { pedestrianPaths } = STREET_LAYOUT;
    let protestorSlot = 0;

    return (
        <>
            {citizenStates.map((cs, i) => {
                if (!cs.alive) return null;
                const citizen = citizens[i];
                if (!citizen) return null;

                const bodyType = computeBodyType(citizen.bodySeed, health);
                const appearance = appearances.get(citizen.id);
                if (!appearance) return null;

                const handleClick = (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    selectPed(citizen.id);
                };

                if (cs.role === 'protestor') {
                    const posIdx = protestorSlot % PROTESTOR_POSITIONS.length;
                    protestorSlot++;
                    return (
                        <CitizenModelStatic
                            key={citizen.id}
                            assets={assets}
                            bodyType={bodyType}
                            appearance={appearance}
                            position={PROTESTOR_POSITIONS[posIdx]}
                            onClick={handleClick}
                        />
                    );
                }

                const assignment = citizenPathAssignments.get(citizen.id);
                if (!assignment) return null;
                const path = pedestrianPaths[citizen.id % pedestrianPaths.length];

                return (
                    <CitizenModelWalker
                        key={citizen.id}
                        assets={assets}
                        bodyType={bodyType}
                        appearance={appearance}
                        path={path}
                        startPos={assignment.startPos}
                        startNextIdx={assignment.startNextIdx}
                        speed={assignment.speed}
                        citizenId={citizen.id}
                        onClick={handleClick}
                    />
                );
            })}
        </>
    );
}

export default CitizenModels;
