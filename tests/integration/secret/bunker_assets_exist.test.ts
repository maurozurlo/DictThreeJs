/**
 * Bunker asset integrity: the exported FBX exists, every texture it names by
 * bare file name sits next to it (FBXLoader resolves them against the FBX's
 * folder; a "..\..\Docs\..." path would 404), and its take animates the press
 * nodes the Bunker component scrubs. Integration-level (reads public/).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Loader, LoadingManager, Texture } from 'three';
import { BUNKER } from '../../../src/Constants/SecretRooms';

const PUBLIC = join(__dirname, '..', '..', '..', 'public');
const FBX_PATH = join(PUBLIC, BUNKER.url);

/** Stands in for TextureLoader (no DOM images in node). */
class NullTextureLoader extends Loader {
    load(): Texture { return new Texture(); }
}

describe('bunker assets', () => {
    it('test_bunker_fbx_exists', () => {
        expect(existsSync(FBX_PATH)).toBe(true);
    });

    it('test_bunker_textures_bare_names_exist_next_to_fbx', () => {
        const text = readFileSync(FBX_PATH).toString('latin1');
        const bare = [...new Set(text.match(/(?<![\\/\w.-])[\w-]+\.png/gi) ?? [])];
        expect(bare.length).toBeGreaterThan(0);
        const missing = bare.filter((name) => !existsSync(join(dirname(FBX_PATH), name)));
        expect(missing).toEqual([]);
    });

    it('test_bunker_take_animates_press_nodes', () => {
        const manager = new LoadingManager();
        manager.addHandler(/\.png$/i, new NullTextureLoader());
        const buf = readFileSync(FBX_PATH);
        const root = new FBXLoader(manager).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
        const animated = new Set((root.animations[0]?.tracks ?? []).map((t) => t.name.slice(0, t.name.lastIndexOf('.'))));
        for (const node of BUNKER.pressNodes) expect(animated.has(node)).toBe(true);
    });
});
