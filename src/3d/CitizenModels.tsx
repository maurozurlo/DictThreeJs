import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import type { Citizen, CitizenState } from '../types/Citizen';
import { computeBodyType } from '../Stores/CitizenHandler';
import { STREET_PLAN } from '../assets/data/road-plans';
import { PLAZA_CENTRE } from '../assets/data/road-plans/common';
import { streetSim } from '../Traffic/streetWorld';
import { streetFrustum } from './streetFrustum';

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

const IDLE_URL = '/models/citizens/idle.fbx';
const SAD_WALK_URL = '/models/citizens/sad_walk.fbx';
const HAPPY_WALK_URL = '/models/citizens/happy_walk.fbx';

const TEX_BASE = '/textures/peds';
const HEAD_TEXTURE_URLS = [`${TEX_BASE}/head_citizen1.png`, `${TEX_BASE}/head_citizen2.png`];
/** Balaclava head — thieves only. Grayscale like the others, so skin tint still applies. */
const THIEF_HEAD_TEXTURE_URL = `${TEX_BASE}/head_citizen_thf.png`;

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
    THIEF_HEAD_TEXTURE_URL,
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

/**
 * Ground speed (m/s, metric) at which the Mixamo walk cycle plays at 1× without
 * foot sliding. Compared against world-unit speeds via × PED_WORLD_SCALE (the
 * model is scaled up by the same factor, so its stride length scales with it).
 */
const WALK_CLIP_NATURAL_SPEED = 1.4;
/** Static protestors march in place at this fraction of walk speed (placeholder anim). */
const PROTESTOR_ANIM_TIMESCALE = 0.45;
/** Walk-mood thresholds: happiness below the first → sad_walk; at/above the second → happy_walk. */
const SAD_WALK_BELOW = 3;
const HAPPY_WALK_FROM = 8;
// Tint pools for regular citizens — the ped textures are grayscale so
// material.color multiplies through as the part colour. Cosmetic only:
// deliberately NOT the seeded gameplay RNG (would desync rolls, ADR-0010).
const CIVILIAN_BODY_TINTS = ['#d9584a', '#4a7ad9', '#4aa06a', '#d9a54a', '#9a6ad9', '#d98ab8', '#d0d0d0', '#6a9a9a'];
const CIVILIAN_PANTS_TINTS = ['#4a5a7a', '#6a5a4a', '#5a5a5a', '#7a7a6a', '#3a4a3a', '#8a4a4a'];

/** Persistent skin tones — indexed by `Citizen.skin` (0–4), light → dark. */
const SKIN_TONES = ['#ffdfc4', '#f0c8a0', '#dda577', '#b97a50', '#8d5a3b'] as const;

/**
 * Flat prop colours for the props whose GLB exports have no UVs (megaphone, sign) — textures,
 * including protester_bits.png, can't be applied until they are re-exported with UV maps.
 * Red megaphone, cardboard sign.
 */
const PROP_COLORS: Record<Exclude<PropKind, 'armyHat'>, string> = {
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
    /** Per-body overrides — the bodies' heads differ in size and sit differently on the head bone. */
    byBody?: Partial<Record<BodyType, Pick<PropFit, 'position' | 'scale'>>>;
}
const PROP_FIT: Record<PropKind, PropFit> = {
    // Hat ≈ head width with the brim just above the eyes (measured in bind pose, 2026-11-13).
    // The fat body's head is relatively larger and sits higher/forward of its head bone.
    armyHat: {
        bone: 'mixamorigHead', position: [0, 0.62, 0.05], rotation: [0, 0, 0], scale: 1050,
        byBody: {
            fat: { position: [0, 0.82, 0.14], scale: 1150 },
            slim: { position: [0, 0.62, 0.05], scale: 1100 },
        },
    },
    megaphone: { bone: 'mixamorigRightHand', position: [0, 0.35, 0.1], rotation: [Math.PI / 2, 0, 0], scale: 700 },
    sign: { bone: 'mixamorigRightHand', position: [0, 0.45, 0], rotation: [0, Math.PI / 2, Math.PI], scale: 550 },
};

// ---------------------------------------------------------------------------
// Protest square (road plan zone)
// ---------------------------------------------------------------------------

/** The plaza's protest area from the active road plan; a small square at the plaza centre otherwise. */
const PROTEST_ZONE = STREET_PLAN.zones?.find((z) => z.id === 'protest') ?? {
    id: 'protest', min: [PLAZA_CENTRE[0] - 15, PLAZA_CENTRE[1] + 5], max: [PLAZA_CENTRE[0] + 15, PLAZA_CENTRE[1] + 18],
};
const ZONE_PAD = 1.2;
const ZONE_COLS = 4;
const ZONE_ROW_SPACING = 2.6;

/** Jittered grid spot inside the protest zone (stable per slot). */
function protestorPositionForSlot(slot: number): readonly [number, number, number] {
    const w = Math.max(0.1, PROTEST_ZONE.max[0] - PROTEST_ZONE.min[0] - ZONE_PAD * 2);
    const d = Math.max(0.1, PROTEST_ZONE.max[1] - PROTEST_ZONE.min[1] - ZONE_PAD * 2);
    const rows = Math.max(1, Math.floor(d / ZONE_ROW_SPACING) + 1);
    const col = slot % ZONE_COLS;
    const row = Math.floor(slot / ZONE_COLS) % rows;
    // Deterministic jitter so spots don't shuffle between renders
    const jx = ((((slot + 1) * 2654435761) >>> 16) % 100) / 100 - 0.5;
    const jz = ((((slot + 1) * 40503) >>> 8) % 100) / 100 - 0.5;
    const x = PROTEST_ZONE.min[0] + ZONE_PAD + (col / Math.max(1, ZONE_COLS - 1)) * w + jx;
    const z = PROTEST_ZONE.min[1] + ZONE_PAD + (row / Math.max(1, rows - 1)) * d + jz;
    return [x, 0, z] as const;
}

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
        headTextureUrl: variant === 'thf' ? THIEF_HEAD_TEXTURE_URL : randomFrom(HEAD_TEXTURE_URLS),
    };
}

// ---------------------------------------------------------------------------
// Asset bundle prepared once per session
// ---------------------------------------------------------------------------

interface BodyModelAsset {
    type: BodyType;
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
    /** Shared bones-only idle clip (idle.fbx) — retargets onto every body's rig. */
    idleClip: THREE.AnimationClip | null;
    /** Bones-only mood walk clips — retarget like idleClip; picked by happiness. */
    sadWalkClip: THREE.AnimationClip | null;
    happyWalkClip: THREE.AnimationClip | null;
}

/** Longest clip in an FBX ("Take 001" is a zero-length stub). */
function longestClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | null {
    return animations.reduce<THREE.AnimationClip | null>(
        (best, c) => (best === null || c.duration > best.duration ? c : best),
        null,
    );
}

/** Loads and prepares every model/texture the citizen roster needs. Suspends. */
function useCitizenAssets(): CitizenAssets {
    const models = useLoader(FBXLoader, BODY_TYPES.map((bt) => MODEL_URLS[bt]));
    const clipFbx = useLoader(FBXLoader, [IDLE_URL, SAD_WALK_URL, HAPPY_WALK_URL]);
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
            const walkClip = longestClip(source.animations);
            const bounds = new THREE.Box3().setFromObject(source);
            const rawHeight = Math.max(bounds.max.y - bounds.min.y, 1e-3);
            const modelScale = (TARGET_HEIGHTS[bt] * PED_WORLD_SCALE) / rawHeight;
            bodies[bt] = { type: bt, source, walkClip, modelScale, yOffset: -bounds.min.y * modelScale };
        });

        // Prop templates. The hat ships UVs, normals and an embedded camo texture; the
        // megaphone and sign have no UVs, so they keep flat colours.
        const props = {} as Record<PropKind, THREE.Object3D>;
        PROP_KINDS.forEach((kind, i) => {
            const template = gltfs[i].scene.clone(true);
            template.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.castShadow = true;
                const prep = (mat: THREE.Material): THREE.Material => {
                    if (kind === 'armyHat') {
                        // Embedded albedo, sampled nearest like the ped textures' pixel look. The
                        // export's 0.5 base-colour factor would darken the camo, so leave it white.
                        const map = (mat as THREE.MeshStandardMaterial).map ?? null;
                        if (map) {
                            map.magFilter = THREE.NearestFilter;
                            map.minFilter = THREE.NearestFilter;
                        }
                        return new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
                    }
                    // Unlit: these exports lack UVs, so a flat colour is all they can show.
                    return new THREE.MeshBasicMaterial({ color: PROP_COLORS[kind] });
                };
                mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prep) : prep(mesh.material);
            });
            props[kind] = template;
        });

        return {
            bodies, textures, props,
            idleClip: longestClip(clipFbx[0].animations),
            sadWalkClip: longestClip(clipFbx[1].animations),
            happyWalkClip: longestClip(clipFbx[2].animations),
        };
    }, [models, clipFbx, gltfs, loadedTextures]);
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
        const placed = { ...fit, ...fit.byBody?.[body.type] };
        const bone = model.getObjectByName(fit.bone);
        if (bone) {
            const instance = assets.props[prop].clone(true);
            instance.position.set(...placed.position);
            instance.rotation.set(...fit.rotation);
            // Bone-local scale: children of the bone inherit the body's model
            // scale, so a constant here keeps the prop proportional to its body.
            instance.scale.setScalar(placed.scale);
            bone.add(instance);
        }
    }

    return { model, mixer: new THREE.AnimationMixer(model) };
}

/** Starts a looping clip action StrictMode-safely; returns the effect cleanup. */
function startClipAction(
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
// CitizenModelWalker — one walking citizen, moved by the street simulation
// ---------------------------------------------------------------------------

interface WalkerProps {
    assets: CitizenAssets;
    bodyType: BodyType;
    appearance: Appearance;
    /** Current happiness (0–10) — picks the walk-mood clip. */
    happiness: number;
    citizenId: number;
    onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/** Walk-cycle playback rate limits as the sim speed varies (sidesteps, kerb waits, follows). */
const WALK_TIMESCALE_MIN = 0.35;
const WALK_TIMESCALE_MAX = 1.8;
/**
 * Walk/idle switch with hysteresis (ground speed, u/s): idle below WALK_IDLE_BELOW, walk again
 * only above WALK_RESUME_ABOVE — a ped creeping at a yield gap doesn't flicker between clips.
 */
const WALK_IDLE_BELOW = 0.3;
const WALK_RESUME_ABOVE = 0.8;
/** Bounding radius (u) for the per-walker frustum test. */
const WALKER_CULL_RADIUS = 6;

/**
 * A citizen walking the street. Position, heading and speed come from the street simulation
 * (src/Traffic/StreetSim.ts, ADR-0014) — it owns sidewalks, zebras and avoidance; this component
 * only draws: walk/idle crossfade by speed, walk rate matched to ground speed, and no skinning
 * updates or draws while off screen.
 */
function CitizenModelWalker({ assets, bodyType, appearance, happiness, citizenId, onClick }: WalkerProps) {
    const groupRef = useRef<THREE.Group>(null);
    const actions = useRef<{ walk: THREE.AnimationAction | null; idle: THREE.AnimationAction | null; moving: boolean }>(
        { walk: null, idle: null, moving: true },
    );

    const body = assets.bodies[bodyType];

    const { model, mixer, phase } = useMemo(
        () => ({
            // Army walkers wear the hat; other roles carry nothing while walking
            ...buildCitizenModel(assets, body, appearance, appearance.variant === 'army' ? 'armyHat' : null),
            phase: Math.random(),
        }),
        [assets, body, appearance],
    );

    // Join the simulation on mount, leave on unmount (death, role change). StrictMode's
    // mount → cleanup → mount simply removes and re-adds the agent.
    useEffect(() => {
        streetSim().addPed(citizenId);
        // look the sim up again on cleanup: it may have been rebuilt (road props changed)
        return () => { streetSim().removePed(citizenId); };
    }, [citizenId]);

    // Bucket, not raw happiness, so the actions only rebuild when a threshold
    // is crossed at round resolution — not on every happiness tick within a band.
    const mood = happiness < SAD_WALK_BELOW ? 'sad' : happiness >= HAPPY_WALK_FROM ? 'happy' : 'normal';

    useEffect(() => {
        const moodClip = mood === 'sad' ? assets.sadWalkClip : mood === 'happy' ? assets.happyWalkClip : null;
        // Fall back to the body's own walk when the mood clip failed to load
        const walkClip = moodClip ?? body.walkClip;
        const walk = walkClip ? mixer.clipAction(walkClip) : null;
        if (walk && walkClip) walk.time = phase * walkClip.duration;
        const idle = assets.idleClip ? mixer.clipAction(assets.idleClip) : null;
        if (idle && assets.idleClip) idle.time = phase * assets.idleClip.duration;
        // Keep the pause state across mood swaps so a kerb-waiting ped doesn't
        // pop to walking for a frame when its bucket changes.
        const moving = actions.current.moving;
        (moving ? walk : idle)?.play();
        actions.current = { walk, idle, moving };
        return () => { mixer.stopAllAction(); };
    }, [mixer, body.walkClip, assets.idleClip, assets.sadWalkClip, assets.happyWalkClip, mood, phase]);

    /** Crossfade between the walk and idle actions. */
    const setMoving = (moving: boolean) => {
        const a = actions.current;
        if (a.moving === moving) return;
        a.moving = moving;
        const from = moving ? a.idle : a.walk;
        const to = moving ? a.walk : a.idle;
        if (!to) return;
        to.reset();
        if (from) to.crossFadeFrom(from, 0.25, false);
        to.play();
    };

    const cullSphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), WALKER_CULL_RADIUS), []);

    useFrame((_, delta) => {
        const p = streetSim().getPed(citizenId);
        const group = groupRef.current;
        if (!p || !group) return;
        group.position.set(p.x, p.y + body.yOffset, p.z);
        // Mixamo rigs face +Z, the sim's yaw convention
        group.rotation.y = p.yaw;
        cullSphere.center.set(p.x, p.y + WALKER_CULL_RADIUS / 2, p.z);
        const visible = streetFrustum.intersectsSphere(cullSphere);
        group.visible = visible;
        setMoving(p.v > (actions.current.moving ? WALK_IDLE_BELOW : WALK_RESUME_ABOVE));
        const walk = actions.current.walk;
        if (walk) {
            const natural = WALK_CLIP_NATURAL_SPEED * PED_WORLD_SCALE;
            walk.timeScale = Math.min(WALK_TIMESCALE_MAX, Math.max(WALK_TIMESCALE_MIN, p.v / natural));
        }
        if (visible) mixer.update(delta);
    });

    const [hw, hh, hd] = HITBOX_DIMS[bodyType].map((d) => d * PED_WORLD_SCALE) as [number, number, number];

    return (
        <group ref={groupRef}>
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

    // Idle on the spot (retargeted shared clip); marching walk as a fallback
    useEffect(
        () => startClipAction(
            mixer,
            assets.idleClip ?? body.walkClip,
            assets.idleClip ? 1 : PROTESTOR_ANIM_TIMESCALE,
            phase,
        ),
        [mixer, assets.idleClip, body.walkClip, phase],
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

/**
 * Renders every living citizen as an animated 3D model: walkers driven by the street
 * simulation (sidewalks, zebras, avoidance — ADR-0014), protestors standing at the plaza. Role/employment/faction
 * pick the texture set (army/biz/thf/pro/citizen), `Citizen.skin` drives the
 * persistent head tint, and regular citizens get random body/pants tints.
 * Must be rendered inside a <Suspense> boundary (model + texture loads suspend).
 */
function CitizenModels() {
    const citizens = useGameStore((s) => s.citizens);
    const citizenStates = useGameStore((s) => s.citizenStates);
    const health = useGameStore((s) => s.budget.expenditures.health);
    const select = useGameStore((s) => s.scene.select);

    const assets = useCitizenAssets();

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
                    select({ kind: 'ped', id: citizen.id });
                };

                if (cs.role === 'protestor') {
                    const slot = protestorSlot++;
                    return (
                        <CitizenModelStatic
                            key={citizen.id}
                            assets={assets}
                            bodyType={bodyType}
                            appearance={appearance}
                            position={protestorPositionForSlot(slot)}
                            onClick={handleClick}
                        />
                    );
                }

                return (
                    <CitizenModelWalker
                        key={citizen.id}
                        assets={assets}
                        bodyType={bodyType}
                        appearance={appearance}
                        happiness={cs.happiness}
                        citizenId={citizen.id}
                        onClick={handleClick}
                    />
                );
            })}
        </>
    );
}

export default CitizenModels;
