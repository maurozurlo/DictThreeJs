/*
 * convert_maxdump.mjs
 * -------------------
 * Converts a 3ds Max placement dump (from tools/maxscript/dump_placements.ms)
 * into the engine's IPL + IDE TypeScript modules.
 *
 *   node tools/ipl/convert_maxdump.mjs <dump.txt> <outDir>
 *
 * Coordinate conversion (3ds Max -> engine):
 *   Max is Z-up, right-handed; engine is Y-up, right-handed.
 *   That is a -90 deg rotation about X:  (x, y, z)_max -> (x, z, -y)_engine
 *   - position: [mx, my, mz] -> [mx, mz, -my]   (x UNIT_SCALE)
 *   - quaternion: conjugated by c = Rx(-90),  q' = c * q * c^-1
 *   - scale (per-axis magnitude): [sx, sy, sz] -> [sx, sz, sy]
 *
 * UNIT_SCALE: Max values are treated as metres (1 Max unit = 1 m). The scene
 * spans ~35 units which reads as a ~35 m plaza, matching the existing IPL scale.
 * If the scene was authored at a different unit, change UNIT_SCALE.
 *
 * Only objects whose name starts with "env_" become IPL instances; cameras,
 * dummies and vehicle rig parts are reported as excluded.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const UNIT_SCALE = 1;            // Max units -> metres
const POS_DEC = 4, ROT_DEC = 6, SCALE_DEC = 6;
const S = Math.SQRT1_2;          // sin/cos(45 deg)
const C = { x: -S, y: 0, z: 0, w: S };       // Rx(-90 deg) as quaternion
const C_INV = { x: S, y: 0, z: 0, w: S };

const args = process.argv.slice(2);
const includeScale = !args.includes('--no-scale');   // --no-scale = models exported pre-scaled
const positional = args.filter((a) => !a.startsWith('--'));
const [dumpPath, outDir = 'middleground'] = positional;
if (!dumpPath) { console.error('usage: node convert_maxdump.mjs <dump.txt> [outDir] [--no-scale]'); process.exit(1); }

// ---- parse (the dump is line-per-object; tolerant of the missing-brace bug) ----
const raw = readFileSync(dumpPath, 'utf8');
const ROW = /"name":\s*"([^"]*)"[^[]*\[([^\]]*)\][^[]*\[([^\]]*)\][^[]*\[([^\]]*)\]/g;
const nums = (s) => s.split(',').map((v) => parseFloat(v.trim()));
const rows = [];
for (const m of raw.matchAll(ROW)) {
    rows.push({ name: m[1], pos: nums(m[2]), rot: nums(m[3]), scale: nums(m[4]) });
}

// ---- conversion helpers ----
const snap = (v, dec) => { const r = Math.abs(v) < 1e-6 ? 0 : parseFloat(v.toFixed(dec)); return r === 0 ? 0 : r; };
const qmul = (a, b) => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const convPos = ([x, y, z]) => [snap(x * UNIT_SCALE, POS_DEC), snap(z * UNIT_SCALE, POS_DEC), snap(-y * UNIT_SCALE, POS_DEC)];
const convScale = ([x, y, z]) => [snap(x, SCALE_DEC), snap(z, SCALE_DEC), snap(y, SCALE_DEC)];
const convRot = ([x, y, z, w]) => {
    const q = qmul(qmul(C, { x, y, z, w }), C_INV);
    return [snap(q.x, ROT_DEC), snap(q.y, ROT_DEC), snap(q.z, ROT_DEC), snap(q.w, ROT_DEC)];
};
const isIdentity = (r) => r[0] === 0 && r[1] === 0 && r[2] === 0 && Math.abs(r[3] - 1) < 1e-6;
const isUnit = (s) => Math.abs(s[0] - s[1]) < 1e-6 && Math.abs(s[1] - s[2]) < 1e-6;

// ---- classify ----
const env = rows.filter((r) => r.name.startsWith('env_'));
const other = rows.filter((r) => !r.name.startsWith('env_'));

// ---- build IPL instances ----
let instId = 0;
const inst = env.map((r) => {
    const pos = convPos(r.pos), rot = convRot(r.rot), scale = convScale(r.scale);
    const fields = [`id: ${++instId}`, `modelName: '${r.name}'`, `pos: [${pos.join(', ')}]`, `rot: [${rot.join(', ')}]`];
    if (includeScale && (!isUnit(scale) || Math.abs(scale[0] - 1) > 1e-6)) fields.push(`scale: [${scale.join(', ')}]`);
    return `        { ${fields.join(', ')} },`;
});

// ---- optional texture manifest (modelName -> texture filename) -------------
// Written by tools/maxscript/export_unique_meshes.ms next to the dump. Lets the
// IDE reference EXTERNAL texture files (public/textures/*) instead of embedding
// them in the GLB. Missing manifest = no texture fields emitted (geometry only).
const manifestPath = join(dirname(dumpPath), 'texture-manifest.json');
let texManifest = {};
if (existsSync(manifestPath)) {
    try { texManifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
    catch (e) { console.warn(`! could not parse ${manifestPath}: ${e.message}`); }
}

// ---- build IDE defs (one per unique model name) ----
const uniqueModels = [...new Set(env.map((r) => r.name))];
let ideId = 2000;
const objs = uniqueModels.map((name) => {
    const tex = texManifest[name];
    const texField = tex ? `, texture: 'textures/${tex}'` : '';
    return `        { id: ${++ideId}, modelName: '${name}', asset: 'models/${name}.glb', visibleIf: { tab: 'Street' }${texField} },`;
});

// ---- write IPL ----
const iplTs = `import type { IPLFile } from '../../types/WorldLayout';

/**
 * Street scene world instance placements (IPL format, GTA-inspired).
 * pos = world position [x, y, z] in metres. rot = quaternion [x, y, z, w].
 * Generated from a 3ds Max dump via tools/ipl/convert_maxdump.mjs
 * (Max Z-up -> engine Y-up; 1 Max unit = 1 m). scale omitted = [1, 1, 1].
 */
export const STREET_IPL: IPLFile = {
    version: 1,
    inst: [
${inst.join('\n')}
    ],
};
`;

const ideTs = `import type { IDEFile } from '../../types/WorldLayout';

/**
 * Street scene object definitions (IDE format, GTA-inspired).
 * One entry per distinct model type. Asset paths are relative to public/.
 * Generated stub — fix asset paths/extensions and visibleIf as needed.
 */
export const STREET_IDE: IDEFile = {
    version: 1,
    objs: [
${objs.join('\n')}
    ],
};
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'street-placement.ipl.ts'), iplTs);
writeFileSync(join(outDir, 'street-objects.ide.ts'), ideTs);

// ---- report ----
const report = [];
report.push(`parsed ${rows.length} rows -> ${inst.length} IPL instances, ${uniqueModels.length} unique models`);
report.push('');
report.push('EXCLUDED (non-env) objects:');
for (const r of other) {
    report.push(`  - ${r.name}  ->  pos ${JSON.stringify(convPos(r.pos))}  rot ${JSON.stringify(convRot(r.rot))}`);
}
const log = report.join('\n');
writeFileSync(join(dirname(dumpPath), 'maxdump-report.txt'), log + '\n');
console.log(log);
console.log(`\nwrote ${join(outDir, 'street-placement.ipl.ts')}`);
console.log(`wrote ${join(outDir, 'street-objects.ide.ts')}`);
