import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLoader, type ThreeEvent } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { Tabs } from '../types/Tabs';
import { useStreetLayout, STREET_TEXTURE_SLOTS, STREET_TEXTURE_URLS } from '../Hooks/useStreetLayout';
import type { ResolvedPlacement } from '../types/WorldLayout';
import CitizenModels from './CitizenModels';
import Vehicles from './Vehicles';
import RoadSurface from './RoadSurface';
import StreetSimDriver from './StreetSimDriver';
import { applyStreetPlacements } from '../Traffic/streetWorld';
import { STREET_SIDEWALK_Y } from '../Constants/Traffic';
import { STREET_PLAN } from '../assets/data/road-plans';
import { isInspectable } from '../Utils/StreetInspect';
import { INSPECT_HOVER_EMISSIVE, INSPECT_SELECTED_EMISSIVE } from '../Constants/StreetInspect';

const DESELECT = (() => {
    const { min, max } = STREET_PLAN.bounds;
    return { cx: (min[0] + max[0]) / 2, cz: (min[1] + max[1]) / 2, w: max[0] - min[0], d: max[1] - min[1] };
})();

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
interface PlacedObjectProps {
    placement: ResolvedPlacement;
    textures: TextureMap;
    /** True while this instance is the street inspector's selection (highlight). */
    selected: boolean;
    /** Click handler — given only for inspectable models; others take no pointer events. */
    onSelect?: (placement: ResolvedPlacement) => void;
}

function PlacedObject({ placement, textures, selected, onSelect }: PlacedObjectProps) {
    const gltf = useLoader(GLTFLoader, `/${placement.asset}`);
    const variantSuffix = placement.textureVariantSuffix;
    const [hovered, setHovered] = useState(false);
    const hoveredRef = useRef(false);

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
            // Keep the embedded texture; clone so the inspector highlight lights this instance only.
            if ((mat as THREE.MeshStandardMaterial).map) return mat.clone();
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

    // Inspector highlight: emissive tint while selected (stronger) or hovered.
    useEffect(() => {
        const tint = selected ? INSPECT_SELECTED_EMISSIVE : hovered ? INSPECT_HOVER_EMISSIVE : null;
        object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
                const std = m as THREE.MeshStandardMaterial;
                if (std.emissive) std.emissive.set(tint ?? 0x000000);
            }
        });
    }, [object, selected, hovered]);

    // Never leave the pointer cursor behind when a hovered object leaves the scene.
    useEffect(() => () => {
        if (hoveredRef.current) document.body.style.cursor = '';
    }, []);

    const quaternion = useMemo(() => placementQuaternion(placement.rot), [placement.rot]);
    const scale = useMemo(() => fixedScale(placement.scale), [placement.scale]);

    if (!onSelect) {
        return <primitive object={object} position={placement.pos} quaternion={quaternion} scale={scale} />;
    }
    const setHover = (on: boolean) => {
        hoveredRef.current = on;
        setHovered(on);
        document.body.style.cursor = on ? 'pointer' : '';
    };
    return (
        <primitive
            object={object}
            position={placement.pos}
            quaternion={quaternion}
            scale={scale}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(placement); }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); }}
            onPointerOut={() => setHover(false)}
        />
    );
}

/**
 * Preloads every external street texture once, then renders all placements. Lives inside
 * the StreetView <Suspense> so the texture and GLB loads suspend together.
 */
function PlacedObjects({ placements, selectedInstanceId, onSelect }: {
    placements: ResolvedPlacement[];
    selectedInstanceId: number | null;
    onSelect: (placement: ResolvedPlacement) => void;
}) {
    const loaded = useLoader(THREE.TextureLoader, STREET_TEXTURE_URLS.map((u) => `/${u}`));

    const textures = useMemo((): TextureMap => {
        const map: TextureMap = new Map();
        STREET_TEXTURE_SLOTS.forEach((slot, i) => {
            const tex = loaded[i];
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false; // glTF UV convention
            // TextureLoader defaults to ClampToEdge; the GLBs' strip/tiled UVs (facade bands,
            // statue ramps, env_roads' kerb concrete) run past 0..1 and smear without repeat.
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            map.set(normalizeTexName(slot.texture), { tex, transparent: slot.transparent });
        });
        return map;
    }, [loaded]);

    return (
        <>
            {placements.map((p) =>
                p.asset !== null
                    ? <PlacedObject
                        key={p.instanceId}
                        placement={p}
                        textures={textures}
                        selected={p.instanceId === selectedInstanceId}
                        onSelect={isInspectable(p.modelName) ? onSelect : undefined}
                    />
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
    const select = useGameStore((s) => s.scene.select);
    const selection = useGameStore((s) => s.scene.selection);
    const selectedInstanceId = selection?.kind === 'prop' ? selection.instanceId : null;

    // Peds steer around the street furniture standing right now; cars weave around road props
    // (tier / security dependent).
    useEffect(() => {
        applyStreetPlacements(placements);
    }, [placements]);

    // A selected object that swapped tier or vanished (budget change, new round) drops the card.
    useEffect(() => {
        if (activeTab !== Tabs.Street || selection?.kind !== 'prop') return;
        const still = placements.some((p) => p.instanceId === selection.instanceId && p.modelName === selection.modelName);
        if (!still) select(null);
    }, [activeTab, placements, selection, select]);

    const selectProp = useMemo(
        () => (p: ResolvedPlacement) => select({ kind: 'prop', instanceId: p.instanceId, modelName: p.modelName }),
        [select],
    );

    if (activeTab !== Tabs.Street) return null;

    return (
        <group position={[0, 0, 0]}>
            <StreetSimDriver />
            {/* Click catcher over the whole street floor — clicking empty ground clears the
                inspector selection (two triangles, cheaper to raycast than the street meshes) */}
            <mesh position={[DESELECT.cx, STREET_SIDEWALK_Y + 0.01, DESELECT.cz]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => select(null)}>
                <planeGeometry args={[DESELECT.w, DESELECT.d]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Street floor generated from the active road plan (ADR-0014) */}
            <Suspense fallback={null}>
                <RoadSurface />
            </Suspense>


            {/* IDE/IPL placed objects — GLBs textured from public/textures by material name */}
            <Suspense fallback={null}>
                <PlacedObjects placements={placements} selectedInstanceId={selectedInstanceId} onSelect={selectProp} />
            </Suspense>

            {/* Citizens — simulation entities rendered as animated models (roles,
                skin tones, props). Replaces the old box peds (Story 7-4/7-5). */}
            <Suspense fallback={null}>
                <CitizenModels />
            </Suspense>

            {/* Vehicles — the traffic simulation's cars (src/Traffic/StreetSim.ts) */}
            <Suspense fallback={null}>
                <Vehicles />
            </Suspense>

        </group>
    );
}

export default StreetView;
