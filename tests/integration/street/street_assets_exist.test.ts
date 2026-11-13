/**
 * Street data integrity: every model and texture the street IDE references exists under
 * public/, every IPL placement names an IDE model, and every street vehicle GLB exists.
 * Integration-level (reads the filesystem) — catches a renamed or missing POC asset before
 * the browser does (a missing GLB suspends the whole Street scene).
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STREET_IDE } from '../../../src/assets/data/street-objects.ide';
import { STREET_IPL } from '../../../src/assets/data/street-placement.ipl';

const PUBLIC = join(__dirname, '..', '..', '..', 'public');
const VEHICLE_GLBS = ['car_junker', 'car_sedan', 'car_limo', 'car_jeep_military', 'car_ambulance'];

describe('street assets exist', () => {
    it('test_street_ide_every_asset_file_exists', () => {
        const missing = STREET_IDE.objs
            .flatMap((o) => [o.asset, ...(o.textures ?? []).map((t) => t.texture)])
            .filter((p): p is string => p !== null && !existsSync(join(PUBLIC, p)));
        expect(missing).toEqual([]);
    });

    // StreetView only swaps in external textures the IDE lists; an unlisted material keeps the
    // copy embedded in the GLB, so edits to public/textures/map silently never show.
    it('test_street_ide_lists_every_external_texture_its_materials_name', () => {
        const unlisted = STREET_IDE.objs.flatMap((o) => {
            const glb = readFileSync(join(PUBLIC, o.asset));
            const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { materials?: { name?: string }[] };
            const listed = new Set((o.textures ?? []).map((t) => t.texture.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase()));
            return (json.materials ?? [])
                .map((m) => m.name ?? '')
                .filter((n) => n !== '' && existsSync(join(PUBLIC, 'textures', 'map', `${n}.png`)) && !listed.has(n.toLowerCase()))
                .map((n) => `${o.modelName}: ${n}`);
        });
        expect(unlisted).toEqual([]);
    });

    it('test_street_ipl_every_placement_names_an_ide_model', () => {
        const models = new Set(STREET_IDE.objs.map((o) => o.modelName));
        const orphans = STREET_IPL.inst.filter((i) => !models.has(i.modelName)).map((i) => i.modelName);
        expect(orphans).toEqual([]);
    });

    it('test_street_ipl_instance_ids_unique', () => {
        const ids = STREET_IPL.inst.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('test_street_vehicle_models_exist', () => {
        const missing = VEHICLE_GLBS.filter((n) => !existsSync(join(PUBLIC, 'models', 'vehicles', `${n}.glb`)));
        expect(missing).toEqual([]);
    });
});
