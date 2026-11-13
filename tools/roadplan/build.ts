/**
 * Road-plan CLI: builds every variant, prints stats + warnings, writes geometry JSON (Blender
 * mesher input) and an SVG top-down plan per variant.
 *
 *     node tools/roadplan/build.ts [outDir=build/roadplan] [variantId ...]
 *
 * Runs on Node 24 type stripping (no build step).
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRoadNetwork, type RoadNetwork } from '../../src/Traffic/RoadBuilder.ts';
import { pointInPolygon, type V2 } from '../../src/Traffic/Geometry.ts';
import type { RoadPlan } from '../../src/Traffic/RoadPlan.ts';
import { AVENIDA } from '../../src/assets/data/road-plans/avenida.ts';
import { ROTONDA } from '../../src/assets/data/road-plans/rotonda.ts';
import { EXPLANADA } from '../../src/assets/data/road-plans/explanada.ts';
import { BUILDING_FOOTPRINT } from '../../src/assets/data/road-plans/common.ts';

const PLANS: RoadPlan[] = [AVENIDA, ROTONDA, EXPLANADA];

// Street camera (src/Constants/GameState.ts STREET_CAMERA) at 16:9.
const CAMERA = { pos: [8.116, 60.961, 124.141] as const, pitch: -0.4364, hFov: 60, aspect: 16 / 9 };

/** Ground footprint of the camera frustum: near-left, near-right, far-right, far-left. */
export function frustumFootprint(far = 420): V2[] {
    const th = Math.tan((CAMERA.hFov / 2) * (Math.PI / 180));
    const tv = th / CAMERA.aspect;
    const [px, py, pz] = CAMERA.pos;
    const c = Math.cos(CAMERA.pitch), s = Math.sin(CAMERA.pitch);
    const ray = (sx: number, sy: number): V2 => {
        const x = sx * th, y0 = sy * tv, z0 = -1;
        const y = y0 * c - z0 * s, z = y0 * s + z0 * c;
        const t = y < -1e-4 ? Math.min(-py / y, far) : far;
        return [px + x * t, pz + z * t];
    };
    return [ray(-1, -1), ray(1, -1), ray(1, 1), ray(-1, 1)];
}

function visibleFraction(lines: V2[][], frame: V2[]): number {
    let vis = 0, tot = 0;
    for (const pts of lines) for (const p of pts) { tot++; if (pointInPolygon(p, frame)) vis++; }
    return tot ? vis / tot : 0;
}

function stats(net: RoadNetwork, frame: V2[]) {
    const lanes = net.paths.filter((p) => p.kind === 'lane');
    const conns = net.paths.filter((p) => p.kind === 'connector');
    const turns = { left: 0, right: 0, straight: 0 };
    for (const c of conns) turns[c.turn!]++;
    return {
        lanes: lanes.length,
        connectors: conns.length,
        turns,
        junctions: net.junctions.length,
        spawns: net.paths.filter((p) => p.spawn).length,
        sinks: net.paths.filter((p) => p.sink).length,
        laneLength: Math.round(lanes.reduce((a, p) => a + p.line.length, 0)),
        laneInFrame: visibleFraction(net.paths.map((p) => p.line.pts), frame),
        loops: net.loops.length,
        loopLength: Math.round(net.loops.reduce((a, l) => a + l.line.length, 0)),
        loopInFrame: visibleFraction(net.loops.map((l) => l.line.pts), frame),
        crossings: net.crossings.length,
        walkways: net.walkways.length,
    };
}

// ---------------------------------------------------------------------------
// SVG plan
// ---------------------------------------------------------------------------

const VIEW = { x0: -185, z0: -210, x1: 195, z1: 140 };
const PX = 2;
const f = (n: number) => n.toFixed(1);
const P = (p: V2) => `${f((p[0] - VIEW.x0) * PX)},${f((p[1] - VIEW.z0) * PX)}`;
const poly = (pts: V2[], attrs: string) => `<polygon points="${pts.map(P).join(' ')}" ${attrs}/>`;
const line = (pts: V2[], attrs: string) => `<polyline points="${pts.map(P).join(' ')}" fill="none" ${attrs}/>`;

const KIND_FILL: Record<string, string> = {
    plaza: '#a7b07e', urban: '#9c958a', park: '#8fa96b', esplanade: '#d3c8b2', median: '#86a463',
};

export function planSvg(net: RoadNetwork, frame: V2[]): string {
    const w = (VIEW.x1 - VIEW.x0) * PX, h = (VIEW.z1 - VIEW.z0) * PX;
    const out: string[] = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`);
    out.push(`<defs><marker id="arr" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#ffd34d"/></marker></defs>`);
    out.push(`<rect width="${w}" height="${h}" fill="#cfcac0"/>`);
    // asphalt
    for (const r of net.ribbons) {
        const ring = r.closed ? [...r.right, ...r.left.slice().reverse()] : [...r.right, ...r.left.slice().reverse()];
        if (r.closed) {
            out.push(poly(r.right, 'fill="#4b4d52"'));
            out.push(poly(r.left, 'fill="#cfcac0"'));
        } else {
            out.push(poly(ring, 'fill="#4b4d52"'));
        }
    }
    // blocks: sidewalk band then interior
    for (const b of net.blocks) {
        if (b.kind === 'median') { out.push(poly(b.kerb, `fill="${KIND_FILL.median}" stroke="#e8e4da" stroke-width="0.6"`)); continue; }
        out.push(poly(b.kerb, 'fill="#c8c2b6" stroke="#f0ece4" stroke-width="0.8"'));
        out.push(poly(b.inner, `fill="${KIND_FILL[b.kind]}"`));
    }
    // markings
    for (const m of net.markings) {
        const col = m.kind === 'centre' ? '#e8c84a' : '#f4f4f0';
        out.push(poly(m.quad, `fill="${col}"`));
    }
    // lanes + connectors with direction arrows
    for (const p of net.paths) {
        const attrs = p.kind === 'lane'
            ? `stroke="${p.spawn ? '#4fd1c5' : p.sink ? '#f6ad55' : '#ffd34d'}" stroke-width="1.1" stroke-opacity="0.9"`
            : `stroke="${p.turn === 'left' ? '#fc8181' : p.turn === 'right' ? '#90cdf4' : '#ffd34d'}" stroke-width="0.9" stroke-dasharray="2 2" stroke-opacity="0.9"`;
        out.push(line(p.line.pts, attrs));
        if (p.kind === 'lane') {
            for (let s = 12; s < p.line.length - 4; s += 30) {
                const i = p.line.cum.findIndex((c) => c >= s);
                if (i < 1) continue;
                out.push(line([p.line.pts[i - 1], p.line.pts[i]], 'stroke="#ffd34d" stroke-width="1.1" marker-end="url(#arr)"'));
            }
        }
    }
    // ped network
    for (const l of net.loops) out.push(poly(l.line.pts, 'fill="none" stroke="#2f855a" stroke-width="1" stroke-dasharray="1.5 2.5"'));
    for (const c of net.crossings) out.push(line(c.line.pts, 'stroke="#2f855a" stroke-width="1.4"'));
    for (const wk of net.walkways) out.push(line(wk.line.pts, 'stroke="#2f855a" stroke-width="1.4" stroke-dasharray="4 2"'));
    // buildings
    for (const b of net.plan.buildings ?? []) {
        const fp = BUILDING_FOOTPRINT[b.model];
        if (!fp) continue;
        const [x, z] = b.pos, [hx, hz] = [fp[0] / 2, fp[1] / 2];
        out.push(poly([[x - hx, z - hz], [x + hx, z - hz], [x + hx, z + hz], [x - hx, z + hz]], 'fill="#5a524a" stroke="#2d2924" stroke-width="0.8"'));
        const label = b.model.replace(/^env_(bld_)?/, '').replace(/_(normal|large)$/, '');
        out.push(`<text x="${f((x - VIEW.x0) * PX)}" y="${f((z - VIEW.z0) * PX + 4)}" font-family="sans-serif" font-size="11" fill="#f0ece4" text-anchor="middle">${label}</text>`);
    }
    // junctions + camera frame
    for (const j of net.junctions) out.push(`<circle cx="${f((j.pos[0] - VIEW.x0) * PX)}" cy="${f((j.pos[1] - VIEW.z0) * PX)}" r="3" fill="none" stroke="#fff" stroke-width="1"/>`);
    out.push(poly(frame, 'fill="none" stroke="#ff6b35" stroke-width="2" stroke-dasharray="8 5"'));
    out.push('</svg>');
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// Geometry JSON for the Blender mesher
// ---------------------------------------------------------------------------

function geometryJson(net: RoadNetwork) {
    const r2 = (p: V2) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    return {
        id: net.plan.id,
        name: net.plan.name,
        summary: net.plan.summary,
        bounds: net.plan.bounds,
        heights: { ground: 0, asphalt: 0, sidewalk: 0.25 },
        ribbons: net.ribbons.map((r) => ({ road: r.road, closed: r.closed, left: r.left.map(r2), right: r.right.map(r2) })),
        blocks: net.blocks.map((b) => ({ id: b.id, kind: b.kind, sidewalk: b.sidewalk, kerb: b.kerb.map(r2), inner: b.inner.map(r2) })),
        markings: net.markings.map((m) => ({ kind: m.kind, quad: m.quad.map(r2) })),
        crossings: net.crossings.map((c) => ({ id: c.id, centre: r2(c.centre), along: c.along, across: c.across, halfBand: c.halfBand, line: c.line.pts.map(r2) })),
        buildings: net.plan.buildings ?? [],
        paths: net.paths.map((p) => ({ key: p.key, kind: p.kind, turn: p.turn, pts: p.line.pts.filter((_, i) => i % 2 === 0).map(r2) })),
        loops: net.loops.map((l) => ({ block: l.block, pts: l.line.pts.filter((_, i) => i % 2 === 0).map(r2) })),
    };
}

// ---------------------------------------------------------------------------

function main() {
    const [outArg, ...only] = process.argv.slice(2);
    const outDir = path.resolve(outArg ?? 'build/roadplan');
    fs.mkdirSync(outDir, { recursive: true });
    const frame = frustumFootprint();
    const summary: Record<string, unknown> = {};
    for (const plan of PLANS) {
        if (only.length && !only.includes(plan.id)) continue;
        const net = buildRoadNetwork(plan);
        const st = stats(net, frame);
        summary[plan.id] = st;
        console.log(`\n== ${plan.name} (${plan.id})`);
        console.log(JSON.stringify(st));
        for (const wmsg of net.warnings) console.log('  WARN', wmsg);
        // buildings inside a block interior?
        for (const b of plan.buildings ?? []) {
            const fp = BUILDING_FOOTPRINT[b.model];
            if (!fp) continue;
            const corners: V2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [b.pos[0] + (sx * fp[0]) / 2, b.pos[1] + (sz * fp[1]) / 2]);
            const ok = net.blocks.some((bl) => bl.kind !== 'median' && corners.every((c) => pointInPolygon(c, bl.inner)));
            if (!ok) console.log(`  WARN building ${b.model} at (${b.pos}) not inside any block interior`);
        }
        fs.writeFileSync(path.join(outDir, `${plan.id}.json`), JSON.stringify(geometryJson(net)));
        fs.writeFileSync(path.join(outDir, `${plan.id}.svg`), planSvg(net, frame));
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ camera: CAMERA, frame, variants: summary }, null, 2));
    console.log(`\nwrote ${outDir}`);
}

main();
