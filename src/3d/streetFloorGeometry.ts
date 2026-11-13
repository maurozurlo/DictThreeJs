/**
 * Street ground geometry built straight from the road network (ADR-0014): asphalt ribbons,
 * kerb walls, sidewalk bands, lot / park / median fills and road markings. One merged geometry
 * per surface kind, so the whole street floor costs a handful of draw calls — and the kerbs the
 * player sees are exactly the kerbs the traffic simulation uses.
 *
 * UVs are world-space (texture tiles every STREET_TILE units), matching the old env_roads density.
 */
import * as THREE from 'three';
import { STREET_ASPHALT_Y, STREET_SIDEWALK_Y, STREET_TILE } from '../Constants/Traffic';
import type { V2 } from '../Traffic/Geometry';
import type { RoadNetwork } from '../Traffic/RoadBuilder';

export type SurfaceKind = 'ground' | 'asphalt' | 'sidewalk' | 'kerb' | 'lot' | 'park' | 'esplanade' | 'markWhite' | 'markYellow';

/** Height of road paint above the asphalt (avoids z-fighting; polygonOffset helps too). */
const MARKING_LIFT = 0.015;
/** Ground plane sits just under the asphalt so road ribbons never fight it. */
const GROUND_DROP = 0.02;

class Builder {
    readonly pos: number[] = [];
    readonly nrm: number[] = [];
    readonly uv: number[] = [];

    /** Upward-facing triangle on a flat level, world-space UVs scaled by `tile`. */
    flatTri(a: V2, b: V2, c: V2, y: number, tile: number): void {
        // y-component of (b - a) × (c - a) in a Y-up world; positive = facing up
        const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
        const [p, q, r] = ny >= 0 ? [a, b, c] : [a, c, b];
        for (const v of [p, q, r]) {
            this.pos.push(v[0], y, v[1]);
            this.nrm.push(0, 1, 0);
            this.uv.push(v[0] / tile, v[1] / tile);
        }
    }

    /** Vertical quad from a to b between y0 and y1, facing `out` (unit XZ). */
    wall(a: V2, b: V2, y0: number, y1: number, out: V2, u0: number, tile: number): void {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const u1 = u0 + len / tile;
        const quad = [
            [a, y0, u0, 0], [b, y0, u1, 0], [b, y1, u1, (y1 - y0) / tile],
            [a, y0, u0, 0], [b, y1, u1, (y1 - y0) / tile], [a, y1, u0, (y1 - y0) / tile],
        ] as const;
        // flip the winding if the default doesn't face `out`
        const e1x = b[0] - a[0], e1z = b[1] - a[1];
        // normal of (a,y0)->(b,y0)->(b,y1) is (e1 × up) = (-e1z, 0, e1x)·(-1) → (e1z, 0, -e1x)
        const faces = e1z * out[0] - e1x * out[1] >= 0;
        const order = faces ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4];
        for (const i of order) {
            const [p, y, u, v] = quad[i];
            this.pos.push(p[0], y, p[1]);
            this.nrm.push(out[0], 0, out[1]);
            this.uv.push(u, v);
        }
    }

    /** Filled polygon (optionally with holes), triangulated with earcut. */
    polygon(outer: V2[], holes: V2[][], y: number, tile: number): void {
        const contour = outer.map((p) => new THREE.Vector2(p[0], p[1]));
        const holeVecs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
        const all = [...outer, ...holes.flat()];
        for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, holeVecs)) this.flatTri(all[i], all[j], all[k], y, tile);
    }

    quad(q: [V2, V2, V2, V2], y: number, tile: number): void {
        this.flatTri(q[0], q[1], q[2], y, tile);
        this.flatTri(q[0], q[2], q[3], y, tile);
    }

    geometry(): THREE.BufferGeometry | null {
        if (this.pos.length === 0) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.computeBoundingSphere();
        return g;
    }
}

/** Builds every street ground surface, keyed by kind (kinds with no geometry are absent). */
export function buildRoadSurface(net: RoadNetwork): Partial<Record<SurfaceKind, THREE.BufferGeometry>> {
    const b: Record<SurfaceKind, Builder> = {
        ground: new Builder(), asphalt: new Builder(), sidewalk: new Builder(), kerb: new Builder(),
        lot: new Builder(), park: new Builder(), esplanade: new Builder(), markWhite: new Builder(), markYellow: new Builder(),
    };
    const { min, max } = net.plan.bounds;

    b.ground.quad([[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]], STREET_ASPHALT_Y - GROUND_DROP, STREET_TILE.ground);

    for (const r of net.ribbons) {
        const n = r.left.length;
        const segs = r.closed ? n : n - 1;
        for (let i = 0; i < segs; i++) {
            const j = (i + 1) % n;
            b.asphalt.quad([r.left[i], r.right[i], r.right[j], r.left[j]], STREET_ASPHALT_Y, STREET_TILE.asphalt);
        }
    }

    for (const blk of net.blocks) {
        const kerb = blk.kerb;
        // kerb walls: kerb polygons are wound interior-right, so outward is the driver's left
        let u = 0;
        for (let i = 0; i < kerb.length; i++) {
            const a = kerb[i], c = kerb[(i + 1) % kerb.length];
            const dx = c[0] - a[0], dz = c[1] - a[1];
            const l = Math.hypot(dx, dz);
            if (l < 1e-6) continue;
            b.kerb.wall(a, c, STREET_ASPHALT_Y, STREET_SIDEWALK_Y, [dz / l, -dx / l], u, STREET_TILE.kerb);
            u += l / STREET_TILE.kerb;
        }
        if (blk.kind === 'median') {
            b.park.polygon(kerb, [], STREET_SIDEWALK_Y, STREET_TILE.park);
            continue;
        }
        b.sidewalk.polygon(kerb, [blk.inner], STREET_SIDEWALK_Y, STREET_TILE.sidewalk);
        if (blk.kind === 'plaza') continue; // env_plaza fills it
        const fill = blk.kind === 'park' ? b.park : blk.kind === 'esplanade' ? b.esplanade : b.lot;
        const tile = blk.kind === 'park' ? STREET_TILE.park : blk.kind === 'esplanade' ? STREET_TILE.sidewalk : STREET_TILE.lot;
        fill.polygon(blk.inner, [], STREET_SIDEWALK_Y, tile);
    }

    for (const m of net.markings) {
        (m.kind === 'centre' ? b.markYellow : b.markWhite).quad(m.quad, STREET_ASPHALT_Y + MARKING_LIFT, 1);
    }

    const out: Partial<Record<SurfaceKind, THREE.BufferGeometry>> = {};
    for (const kind of Object.keys(b) as SurfaceKind[]) {
        const g = b[kind].geometry();
        if (g) out[kind] = g;
    }
    return out;
}
