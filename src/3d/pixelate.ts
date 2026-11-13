import { NearestFilter, type Material, type Mesh, type Object3D, type Texture } from 'three';

/**
 * Pixelated look for the Max-exported interiors: nearest-neighbour filtering on
 * every mesh's diffuse map under `root` (the source textures are 64 px tiles).
 */
export function pixelateTextures(root: Object3D): void {
    root.traverse((child) => {
        if (!(child as Mesh).isMesh) return;
        const material = (child as Mesh).material as Material | Material[];
        for (const mat of Array.isArray(material) ? material : [material]) {
            const map = (mat as Material & { map?: Texture | null }).map;
            if (!map) continue;
            map.magFilter = NearestFilter;
            map.minFilter = NearestFilter;
            map.needsUpdate = true;
        }
    });
}
