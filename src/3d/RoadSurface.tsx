import { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../Stores/GameState';
import { groundVariantSuffix } from '../Utils/BuildingDegradation';
import { streetNetwork } from '../Traffic/streetWorld';
import { buildRoadSurface, type SurfaceKind } from './streetFloorGeometry';
import { roadPaintOpacity } from '../Utils/RoadPaint';

/** Texture per textured surface kind (public/textures/map/<name>.png, `_poor` variants exist). */
const SURFACE_TEXTURE: Partial<Record<SurfaceKind, string>> = {
    ground: 'stone',
    asphalt: 'road_centr',
    sidewalk: 'sidewalk_str',
    kerb: 'sidewalk_crn',
    lot: 'concrete_buildings_base',
    park: 'park',
    esplanade: 'stone',
};
const TEXTURE_NAMES = [...new Set(Object.values(SURFACE_TEXTURE))];
const TEXTURE_URLS = TEXTURE_NAMES.flatMap((n) => [`/textures/map/${n}.png`, `/textures/map/${n}_poor.png`]);

/** The open ground beyond the street reads darker than paving (old env_roads look). */
const GROUND_TINT = '#808080';
const MARKING_COLOR: Partial<Record<SurfaceKind, string>> = { markWhite: '#ecebe4', markYellow: '#e2bd3c' };

/**
 * The street floor — asphalt, kerbs, sidewalks, lots, medians and road markings — generated from
 * the active road plan (ADR-0014; replaces the env_roads GLB). Ground textures swap to their
 * `_poor` paint when the city degrades, like env_roads did (art-bible §7.2.3). Road paint
 * (lines, stop lines, zebras) wears off with the infrastructure budget: invisible at the
 * minimum, fresh at the maximum (src/Utils/RoadPaint.ts).
 * Suspends while textures load.
 */
function RoadSurface() {
    const conditionStage = useGameStore((s) => s.gameManagement.conditionStage);
    const infrastructure = useGameStore((s) => s.budget.expenditures.infrastructure);
    const suffix = groundVariantSuffix(conditionStage);
    const paintOpacity = roadPaintOpacity(infrastructure);
    const loaded = useLoader(THREE.TextureLoader, TEXTURE_URLS);
    const geometries = useMemo(() => buildRoadSurface(streetNetwork()), []);

    const textures = useMemo(() => {
        const map = new Map<string, THREE.Texture>();
        TEXTURE_URLS.forEach((url, i) => {
            const tex = loaded[i];
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.needsUpdate = true;
            map.set(url, tex);
        });
        return map;
    }, [loaded]);

    const materials = useMemo(() => {
        const out: Partial<Record<SurfaceKind, THREE.Material>> = {};
        for (const kind of Object.keys(geometries) as SurfaceKind[]) {
            const texName = SURFACE_TEXTURE[kind];
            if (texName) {
                const tex = textures.get(`/textures/map/${texName}${suffix}.png`) ?? textures.get(`/textures/map/${texName}.png`)!;
                out[kind] = new THREE.MeshStandardMaterial({
                    map: tex, roughness: 0.9, metalness: 0, color: kind === 'ground' ? GROUND_TINT : '#ffffff',
                });
            } else {
                // Road paint: transparent so it can wear off; no depth write (flat decal on the asphalt).
                out[kind] = new THREE.MeshStandardMaterial({
                    color: MARKING_COLOR[kind] ?? '#ffffff', roughness: 0.9, metalness: 0,
                    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
                    transparent: true, depthWrite: false,
                });
            }
        }
        return out;
    }, [geometries, textures, suffix]);

    // Wear follows the budget live without rebuilding materials.
    useEffect(() => {
        for (const kind of Object.keys(MARKING_COLOR) as SurfaceKind[]) {
            const mat = materials[kind];
            if (mat) mat.opacity = paintOpacity;
        }
    }, [materials, paintOpacity]);

    return (
        <group>
            {(Object.keys(geometries) as SurfaceKind[]).map((kind) => (
                <mesh
                    key={kind}
                    geometry={geometries[kind]}
                    material={materials[kind]}
                    visible={!(kind in MARKING_COLOR) || paintOpacity > 0}
                    receiveShadow
                />
            ))}
        </group>
    );
}

export default RoadSurface;
