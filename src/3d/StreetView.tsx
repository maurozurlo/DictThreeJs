import { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { useStreetLayout, STREET_TEXTURE_SLOTS, STREET_TEXTURE_URLS } from '../Hooks/useStreetLayout';
import type { ResolvedPlacement } from '../types/WorldLayout';
import CitizenModels from './CitizenModels';
import Vehicles from './Vehicles';

const BUILDING_COLOR = '#7a6e62';
const PLAZA_COLOR = '#b8a98a';
const ROAD_COLOR = '#4a4a4a';

// ---------------------------------------------------------------------------
// PlacedObject — renders one IDE/IPL instance from the world layout system
// ---------------------------------------------------------------------------

/**
 * Readable solid colour per model, keyed on name fragments. Used until the GLB
 * re-export carries UVs and the IDE references an external texture (see below).
 */
function paletteFor(modelName: string): string {
    const n = modelName;
    if (n.includes('road') || n.includes('pothole')) return ROAD_COLOR;
    if (n.includes('plaza')) return PLAZA_COLOR;
    if (n.includes('tree')) return '#4a7a3a';
    if (n.includes('skybox') || n.includes('skyline')) return '#8fa6c4';
    if (n.includes('flag')) return '#9a3a3a';
    if (n.includes('graffiti') || n.includes('billboard')) return '#b07a3a';
    if (n.includes('bld') || n.includes('building') || n.includes('scaffolding')) return BUILDING_COLOR;
    if (n.includes('tank') || n.includes('cannon') || n.includes('gunnest') || n.includes('guard') ||
        n.includes('barricade') || n.includes('searchlight') || n.includes('camera_pole')) return '#5a5e4a';
    return '#9a9088';
}

function placementQuaternion(rot: ResolvedPlacement['rot']): THREE.Quaternion {
    return new THREE.Quaternion(rot[0], rot[1], rot[2], rot[3]);
}

/** "textures/Road_01.PNG" -> "road_01" — basename without extension, lower-cased. */
function normalizeTexName(path: string): string {
    const base = path.split('/').pop() ?? path;
    const name = base.replace(/\.[^.]+$/, '').toLowerCase();
    return name.replace(/_(png|jpg|jpeg|bmp|tga|gif)$/, '');
}

/**
 * The GLBs already render Y-up (the Max exporter adds a root −90° X node, matching
 * convert_maxdump.mjs), so no extra rotation is applied here. But the Max scene is
 * in millimetres, so every GLB carries a 0.001 mm→m mesh-node scale, rendering 1000×
 * too small. We multiply the placement scale by 1000 to undo it (net 1000 × 0.001 = 1).
 * Proper source fix: set Max System Units to metres and re-export, then drop GLB_UNIT_FIX.
 */
const GLB_UNIT_FIX = 1000;

function fixedScale(scale: ResolvedPlacement['scale']): [number, number, number] {
    return [scale[0] * GLB_UNIT_FIX, scale[1] * GLB_UNIT_FIX, scale[2] * GLB_UNIT_FIX];
}

/** Texture entry keyed by normalized basename — carries the loaded texture and its per-slot transparency flag. */
type TextureEntry = { tex: THREE.Texture; transparent: boolean };
type TextureMap = Map<string, TextureEntry>;

/**
 * Renders one IPL placement. Each mesh part keeps its own material slot; we apply the
 * external texture whose basename matches that part's material NAME (set at export time).
 * Transparency is per-slot — decals/foliage slots get alphaTest cutout independently.
 * Parts with no matching texture but an embedded map keep it; otherwise palette fallback.
 *
 * `placement.textureVariantSuffix` (e.g. `'_poor'`) lets a single GLB whose material names
 * never change (env_roads, env_plaza) swap textures by game state: the suffixed key is tried
 * first, falling back to the bare name if no such variant texture was preloaded.
 */
function PlacedObject({ placement, textures }: { placement: ResolvedPlacement; textures: TextureMap }) {
    const gltf = useLoader(GLTFLoader, `/${placement.asset}`);
    const variantSuffix = placement.textureVariantSuffix;

    const object = useMemo(() => {
        const fallback = paletteFor(placement.modelName);
        const pickMaterial = (mat: THREE.Material): THREE.Material => {
            const baseName = normalizeTexName(mat.name ?? '');
            const entry = (variantSuffix ? textures.get(baseName + variantSuffix) : undefined) ?? textures.get(baseName);
            if (entry) {
                const { tex, transparent } = entry;
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tex.needsUpdate = true;
                const alphaProps = transparent
                    ? { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }
                    : {};
                return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, ...alphaProps });
            }
            if ((mat as THREE.MeshStandardMaterial).map) return mat; // keep embedded texture
            return new THREE.MeshStandardMaterial({ color: fallback, roughness: 0.9, metalness: 0 });
        };
        const g = (gltf.scene as THREE.Group).clone(true);
        g.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(pickMaterial)
                : pickMaterial(mesh.material);
        });
        return g;
    }, [gltf, textures, placement.modelName, variantSuffix]);

    const quaternion = useMemo(() => placementQuaternion(placement.rot), [placement.rot]);
    const scale = useMemo(() => fixedScale(placement.scale), [placement.scale]);
    return <primitive object={object} position={placement.pos} quaternion={quaternion} scale={scale} />;
}

/**
 * Preloads every external street texture once, then renders all placements. Lives inside
 * the StreetView <Suspense> so the texture and GLB loads suspend together.
 */
function PlacedObjects({ placements }: { placements: ResolvedPlacement[] }) {
    const loaded = useLoader(THREE.TextureLoader, STREET_TEXTURE_URLS.map((u) => `/${u}`));

    const textures = useMemo((): TextureMap => {
        const map: TextureMap = new Map();
        STREET_TEXTURE_SLOTS.forEach((slot, i) => {
            const tex = loaded[i];
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false; // glTF UV convention
            map.set(normalizeTexName(slot.texture), { tex, transparent: slot.transparent });
        });
        return map;
    }, [loaded]);

    return (
        <>
            {placements.map((p) =>
                p.asset !== null
                    ? <PlacedObject key={p.instanceId} placement={p} textures={textures} />
                    : null,
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// StreetView
// ---------------------------------------------------------------------------

function StreetView() {
    const activeTab = useGameStore((s) => s.tabs.activeTab);
    const placements = useStreetLayout();
    const selectPed = useGameStore((s) => s.scene.selectPed);

    if (activeTab !== Tabs.Street) return null;

    return (
        <group position={[0, 0, 0]}>
            {/* Ground — clicking deselects any selected citizen */}
            <mesh position={[0, -0.05, -8]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => selectPed(null)}>
                <planeGeometry args={[42, 28]} />
                <meshStandardMaterial transparent opacity={0} />
            </mesh>


            {/* IDE/IPL placed objects — GLBs textured from public/textures by material name */}
            <Suspense fallback={null}>
                <PlacedObjects placements={placements} />
            </Suspense>

            {/* Citizens — simulation entities rendered as animated models (roles,
                skin tones, props). Replaces the old box peds (Story 7-4/7-5). */}
            <Suspense fallback={null}>
                <CitizenModels />
            </Suspense>

            {/* Vehicles — one junker per exported car loop; stopFor nodes gate them at crossings */}
            <Suspense fallback={null}>
                <Vehicles />
            </Suspense>

        </group>
    );
}

export default StreetView;
