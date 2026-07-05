/*
 * convert_paths.mjs
 * -----------------
 * Converts a 3ds Max spline dump (from tools/maxscript/dump_paths.ms) into the
 * engine's generated path module (src/assets/data/street-paths.ts).
 *
 *   node tools/ipl/convert_paths.mjs <paths-dump.txt> [outDir]
 *
 * Coordinate conversion matches convert_maxdump.mjs:
 *   Max is Z-up, right-handed; engine is Y-up: (x, y, z)_max -> (x, z, -y)_engine
 *   1 Max unit = 1 metre (UNIT_SCALE below if that ever changes).
 *
 * What it does per shape prefix:
 *   path_ped_* / path_car_*  simplify arc-length samples (Douglas-Peucker) into
 *                            waypoints; auto-derive ry ("facing when leaving
 *                            this waypoint": 0 = -Z, per streetLayout.ts).
 *   cross_*                  simplified open polyline; each endpoint snaps to
 *                            the nearest ped-loop waypoint (warns > SNAP_WARN m).
 *                            Car paths get a `stopFor` waypoint inserted
 *                            STOP_BACKOFF m before every crossing intersection.
 *   zone_*                   closed rect -> XZ bounds.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const UNIT_SCALE = 1;        // Max units -> metres
const SIMPLIFY_TOL = 0.15;   // Douglas-Peucker tolerance (m) — straights collapse, arcs survive
const SNAP_WARN = 3.0;       // warn if a crossing endpoint is further than this from any ped knot
const STOP_BACKOFF = 2.5;    // car stop node distance before the crossing line (m)
const DEC = 2;               // output decimals

const [dumpPath, outDir = 'src/assets/data'] = process.argv.slice(2);
if (!dumpPath) { console.error('usage: node tools/ipl/convert_paths.mjs <paths-dump.txt> [outDir]'); process.exit(1); }

// ---- parse (dump may carry Listener noise around the JSON) ------------------
const raw = readFileSync(dumpPath, 'utf8');
const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
const dump = JSON.parse(jsonText);

const warnings = [];

// ---- conversion helpers ------------------------------------------------------
const r2 = (v) => { const r = parseFloat(v.toFixed(DEC)); return Object.is(r, -0) ? 0 : r; };
/** Max [x, y, z] -> engine {x, y, z}: (x, z, -y), scaled to metres. */
const conv = ([x, y, z]) => ({ x: r2(x * UNIT_SCALE), y: r2(z * UNIT_SCALE), z: r2(-y * UNIT_SCALE) });
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Douglas-Peucker on the XZ plane. Keeps first/last point. */
function simplify(pts, tol) {
    if (pts.length <= 2) return pts;
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const A = pts[a], B = pts[b];
        const abx = B.x - A.x, abz = B.z - A.z;
        const abLen2 = abx * abx + abz * abz;
        let maxD = -1, maxI = -1;
        for (let i = a + 1; i < b; i++) {
            const P = pts[i];
            let d;
            if (abLen2 < 1e-12) d = dist2d(P, A);
            else {
                const t = Math.max(0, Math.min(1, ((P.x - A.x) * abx + (P.z - A.z) * abz) / abLen2));
                d = Math.hypot(P.x - (A.x + t * abx), P.z - (A.z + t * abz));
            }
            if (d > maxD) { maxD = d; maxI = i; }
        }
        if (maxD > tol) { keep[maxI] = true; stack.push([a, maxI], [maxI, b]); }
    }
    return pts.filter((_, i) => keep[i]);
}

/** For a closed loop, drop a duplicated last point (samples already avoid it, knots may not). */
function dedupeLoop(pts) {
    if (pts.length > 1 && dist2d(pts[0], pts[pts.length - 1]) < 1e-3) return pts.slice(0, -1);
    return pts;
}

/** ry: yaw facing the NEXT waypoint; ry = 0 faces -Z (streetLayout convention). */
function withRy(pts, loop) {
    return pts.map((p, i) => {
        const next = loop ? pts[(i + 1) % pts.length] : pts[Math.min(i + 1, pts.length - 1)];
        const from = loop || i + 1 < pts.length ? p : pts[i - 1] ?? p;
        const dx = next.x - from.x, dz = next.z - from.z;
        if (Math.hypot(dx, dz) < 1e-6) return { ...p };
        return { ...p, ry: parseFloat(Math.atan2(-dx, -dz).toFixed(4)) };
    });
}

/** XZ segment intersection. Returns { t, u, point } for A+t(B-A) x C+u(D-C), or null. */
function segIntersect(A, B, C, D) {
    const rX = B.x - A.x, rZ = B.z - A.z;
    const sX = D.x - C.x, sZ = D.z - C.z;
    const denom = rX * sZ - rZ * sX;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((C.x - A.x) * sZ - (C.z - A.z) * sX) / denom;
    const u = ((C.x - A.x) * rZ - (C.z - A.z) * rX) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u, point: { x: A.x + t * rX, y: A.y, z: A.z + t * rZ } };
}

// ---- classify shapes ---------------------------------------------------------
const shapes = dump.shapes.map((s) => ({
    ...s,
    knots: s.knots.map(conv),
    samples: s.samples.map(conv),
}));

const byPrefix = (p) => shapes.filter((s) => s.name.startsWith(p));
const pedShapes = byPrefix('path_ped_');
const carShapes = byPrefix('path_car_');
const crossShapes = byPrefix('cross_');
const zoneShapes = byPrefix('zone_');

// ---- ped + car paths ----------------------------------------------------------
function toPath(s, idPrefix) {
    if (!s.closed) warnings.push(`${s.name}: expected a CLOSED loop but it is open`);
    const pts = withRy(dedupeLoop(simplify(s.samples, SIMPLIFY_TOL)), s.closed);
    return { id: s.name.replace(idPrefix, '').replace(/_/g, '-'), name: s.name, waypoints: pts, loop: s.closed };
}
const pedPaths = pedShapes.map((s) => toPath(s, 'path_ped_'));
const carPaths = carShapes.map((s) => toPath(s, 'path_car_'));

// ---- crossings: project endpoints onto ped-loop SEGMENTS and insert kerbs ------
// Long straights simplify down to 2 waypoints, so mid-block crossing endpoints
// have no nearby vertex. Project onto the polyline instead; if the projection
// lands away from an existing vertex, INSERT a kerb waypoint at that spot.
const VERTEX_SNAP = 0.5; // reuse an existing vertex if projection lands within this (m)

const crossingsRaw = crossShapes.map((s) => {
    if (s.closed) warnings.push(`${s.name}: expected an OPEN line but it is closed`);
    const pts = withRy(simplify(s.samples, SIMPLIFY_TOL), false);
    return { id: s.name.replace(/^cross_/, '').replace(/_/g, '-'), name: s.name, waypoints: pts };
});

/** Closest point on a ped path polyline: { pathIdx, segIdx, t, point, d }. */
function projectOntoPedPaths(pt) {
    let best = null;
    pedPaths.forEach((path, pathIdx) => {
        const n = path.waypoints.length;
        const segCount = path.loop ? n : n - 1;
        for (let i = 0; i < segCount; i++) {
            const A = path.waypoints[i], B = path.waypoints[(i + 1) % n];
            const abx = B.x - A.x, abz = B.z - A.z;
            const len2 = abx * abx + abz * abz;
            const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((pt.x - A.x) * abx + (pt.z - A.z) * abz) / len2));
            const P = { x: A.x + t * abx, y: A.y, z: A.z + t * abz };
            const d = dist2d(pt, P);
            if (!best || d < best.d) best = { pathIdx, segIdx: i, t, point: P, d };
        }
    });
    return best;
}

// Gather link requests (two per crossing), then batch-insert kerb waypoints.
const linkRequests = []; // { crossIdx, end, pathIdx, segIdx, t, point, useVertexIdx|null }
crossingsRaw.forEach((cross, crossIdx) => {
    [0, 1].forEach((end) => {
        const endPt = end === 0 ? cross.waypoints[0] : cross.waypoints[cross.waypoints.length - 1];
        const best = projectOntoPedPaths(endPt);
        if (!best) { warnings.push(`${cross.name}: no ped paths to link to`); return; }
        if (best.d > SNAP_WARN) {
            warnings.push(`${cross.name} ${end === 0 ? 'start' : 'end'}: ${best.d.toFixed(1)} m from the nearest ped loop (> ${SNAP_WARN} m) — check the drawing`);
        }
        const path = pedPaths[best.pathIdx];
        const n = path.waypoints.length;
        const A = path.waypoints[best.segIdx], B = path.waypoints[(best.segIdx + 1) % n];
        let useVertexIdx = null;
        if (dist2d(best.point, A) < VERTEX_SNAP) useVertexIdx = best.segIdx;
        else if (dist2d(best.point, B) < VERTEX_SNAP) useVertexIdx = (best.segIdx + 1) % n;
        linkRequests.push({ crossIdx, end, ...best, useVertexIdx });
    });
});

// Rebuild each ped path's waypoint list with kerb insertions, tracking final indices.
pedPaths.forEach((path, pathIdx) => {
    const inserts = linkRequests
        .filter((r) => r.pathIdx === pathIdx && r.useVertexIdx === null)
        .sort((a, b) => a.segIdx - b.segIdx || a.t - b.t);
    const vertexRefs = linkRequests.filter((r) => r.pathIdx === pathIdx && r.useVertexIdx !== null);
    if (inserts.length === 0 && vertexRefs.length === 0) return;

    const out = [];
    const vertexFinal = new Map(); // old vertex idx -> final idx
    path.waypoints.forEach((wp, i) => {
        vertexFinal.set(i, out.length);
        out.push(wp);
        for (const ins of inserts.filter((r) => r.segIdx === i)) {
            ins.finalIdx = out.length;
            out.push({ x: r2(ins.point.x), y: r2(ins.point.y), z: r2(ins.point.z) });
        }
    });
    for (const ref of vertexRefs) ref.finalIdx = vertexFinal.get(ref.useVertexIdx);
    path.waypoints = withRy(out, path.loop); // recompute ry incl. inserted kerbs
});

const crossings = crossingsRaw.map((cross, crossIdx) => {
    const linkOf = (end) => {
        const r = linkRequests.find((x) => x.crossIdx === crossIdx && x.end === end);
        return r && r.finalIdx !== undefined ? { pathId: pedPaths[r.pathIdx].id, waypointIdx: r.finalIdx } : null;
    };
    return { id: cross.id, waypoints: cross.waypoints, links: [linkOf(0), linkOf(1)] };
});

// ---- bake car stop nodes before each crossing ----------------------------------
let stopCount = 0;
for (const path of carPaths) {
    const inserts = []; // { segIdx, t, waypoint }
    const n = path.waypoints.length;
    for (let i = 0; i < n; i++) {
        const A = path.waypoints[i];
        const B = path.waypoints[(i + 1) % n];
        if (!path.loop && i + 1 >= n) break;
        for (const cross of crossings) {
            for (let j = 0; j < cross.waypoints.length - 1; j++) {
                const hit = segIntersect(A, B, cross.waypoints[j], cross.waypoints[j + 1]);
                if (!hit) continue;
                const segLen = dist2d(A, B);
                // Back off from the crossing along the travel direction (clamped into the segment)
                const tStop = Math.max(0.02, hit.t - (segLen > 1e-6 ? STOP_BACKOFF / segLen : 0));
                inserts.push({
                    segIdx: i,
                    t: tStop,
                    waypoint: {
                        x: r2(A.x + (B.x - A.x) * tStop),
                        y: A.y,
                        z: r2(A.z + (B.z - A.z) * tStop),
                        ry: A.ry,
                        stopFor: cross.id,
                    },
                });
                stopCount++;
            }
        }
    }
    // Insert back-to-front so indices stay valid
    inserts.sort((a, b) => b.segIdx - a.segIdx || b.t - a.t);
    for (const ins of inserts) path.waypoints.splice(ins.segIdx + 1, 0, ins.waypoint);
}

// ---- zones ---------------------------------------------------------------------
const zones = zoneShapes.map((s) => {
    const pts = s.knots.length >= 3 ? s.knots : s.samples;
    const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
    return {
        id: s.name.replace(/^zone_/, '').replace(/_/g, '-'),
        min: [r2(Math.min(...xs)), r2(Math.min(...zs))],
        max: [r2(Math.max(...xs)), r2(Math.max(...zs))],
    };
});

// ---- emit TypeScript -------------------------------------------------------------
const wpStr = (w) => {
    const parts = [`x: ${w.x}`, `y: ${w.y}`, `z: ${w.z}`];
    if (w.ry !== undefined) parts.push(`ry: ${w.ry}`);
    if (w.stopFor !== undefined) parts.push(`stopFor: '${w.stopFor}'`);
    return `            { ${parts.join(', ')} },`;
};
const pathStr = (p) => `        {
            id: '${p.id}',
            loop: ${p.loop},
            waypoints: [
${p.waypoints.map(wpStr).map((l) => '    ' + l).join('\n')}
            ],
        },`;
const crossStr = (c) => `        {
            id: '${c.id}',
            links: [${c.links.map((l) => (l ? `{ pathId: '${l.pathId}', waypointIdx: ${l.waypointIdx} }` : 'null')).join(', ')}],
            waypoints: [
${c.waypoints.map(wpStr).map((l) => '    ' + l).join('\n')}
            ],
        },`;
const zoneStr = (z) => `        { id: '${z.id}', min: [${z.min.join(', ')}], max: [${z.max.join(', ')}] },`;

const ts = `import type { StreetPaths } from '../../types/StreetLayout';

/**
 * Street paths: ped loops, car loops, crossings and zones. 1 unit = 1 metre.
 * GENERATED by tools/ipl/convert_paths.mjs from a 3ds Max spline dump
 * (tools/maxscript/dump_paths.ms) — do not edit by hand, re-export instead.
 *
 * Car paths carry baked \`stopFor\` waypoints ${STOP_BACKOFF} m before each crossing:
 * a car must wait there while that crossing's light is in its ped phase.
 * Crossing \`links\` anchor each end to a ped-loop waypoint (the kerb).
 */
export const STREET_PATHS: StreetPaths = {
    pedPaths: [
${pedPaths.map(pathStr).join('\n')}
    ],
    carPaths: [
${carPaths.map(pathStr).join('\n')}
    ],
    crossings: [
${crossings.map(crossStr).join('\n')}
    ],
    zones: [
${zones.map(zoneStr).join('\n')}
    ],
};
`;

mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'street-paths.ts');
writeFileSync(outFile, ts);

// ---- report -----------------------------------------------------------------------
console.log(`shapes: ${pedShapes.length} ped, ${carShapes.length} car, ${crossShapes.length} crossings, ${zoneShapes.length} zones`);
for (const p of [...pedPaths, ...carPaths]) console.log(`  ${p.id}: ${p.waypoints.length} waypoints`);
for (const c of crossings) console.log(`  cross ${c.id}: links -> ${c.links.map((l) => (l ? `${l.pathId}[${l.waypointIdx}]` : 'NONE')).join(', ')}`);
console.log(`baked ${stopCount} car stop node(s)`);
if (warnings.length) { console.log('\nWARNINGS:'); warnings.forEach((w) => console.log('  ! ' + w)); }
console.log(`\nwrote ${outFile}`);
