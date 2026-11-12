"""Poor and rich streetlights and park benches for the Street tab (street_furniture family).

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/street_furniture.py -- [model ...] [--preview build/visual_gaps/street_furniture/models]

Builds env_streetlight_poor, env_streetlight_rich, env_parkbench_poor, env_parkbench_rich (all, or the ones
named) into public/models/map/<name>.glb, textured with public/textures/map/<name>.png from
tools/texgen/street_furniture.py (run that first). Rects come from tools/texgen/street_furniture_layout.json.

Pivot: each model replaces its NORMAL model at the same IPL placements, so it keeps the normal GLB's pivot:
origin at the normal model's bbox centre (streetlight ground z = -8.356, pole axis x = -2.18; bench ground
z = -1.273, footprint x +-3.18, y +-1.1). Blender -Y faces the Street camera; the streetlight's arm reaches +X.

Every face is wound outward against an inside reference point given with it (asserted at the end); the cut-out
parts sit on transparent (alpha-tested, double-sided) materials. With --preview the script also renders each
model alone, flat-lit (the game's single ambient light) with back faces culled, next to the normal model
placed at the same pivot.
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dt_common as dt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LAYOUT = json.load(open(os.path.join(ROOT, 'tools', 'texgen', 'street_furniture_layout.json'), encoding='utf-8'))
V = Vector

LIGHT_Z0 = -8.356   # normal streetlight's ground in its pivot frame
LIGHT_PX = -2.18    # normal streetlight's pole axis x (y = 0)
BENCH_Z0 = -1.273   # normal bench's ground


# ---------------------------------------------------------------------------------------------------
# Builder: one bmesh, one material, UVs from the contract's pixel rects

class Builder:
    def __init__(self, tex):
        self.tex = tex
        spec = LAYOUT['textures'][tex]
        self.W, self.H = spec['size']
        self.regions = {k: v['rect'] for k, v in spec['regions'].items()}
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.checks = []  # (face, inside point)
        self.parts = {}

    def uvp(self, region, s, t, inset=0.5):
        """UV of the point (s, t) in a region, s left->right, t top->bottom, both 0..1."""
        x, y, w, h = self.regions[region]
        px = x + inset + s * (w - 2 * inset)
        py = y + inset + t * (h - 2 * inset)
        return (px / self.W, 1.0 - py / self.H)

    def face(self, pts, uvs, inside, part='misc'):
        """Adds a polygon, winding it so its normal points away from `inside` (a point or a direction
        given as ('dir', Vector) meaning the normal should point along that direction)."""
        pts = [V(p) for p in pts]
        c = sum(pts, V()) / len(pts)
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-9:
            n = (pts[2] - pts[0]).cross(pts[3] - pts[0]) if len(pts) > 3 else n
        want = inside[1] if isinstance(inside, tuple) and inside[0] == 'dir' else c - V(inside)
        if n.dot(want) < 0:
            pts, uvs = pts[::-1], uvs[::-1]
        verts = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(verts)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        self.checks.append((f, inside))
        self.parts[part] = self.parts.get(part, 0) + len(pts) - 2
        return f

    def quad(self, p0, p1, p2, p3, region, inside, s0=0.0, s1=1.0, t0=0.0, t1=1.0, part='misc'):
        """p0 bottom-left, p1 bottom-right, p2 top-right, p3 top-left (as the texture reads)."""
        uvs = [self.uvp(region, s0, t1), self.uvp(region, s1, t1), self.uvp(region, s1, t0), self.uvp(region, s0, t0)]
        return self.face([p0, p1, p2, p3], uvs, inside, part)

    def planar(self, pts, region, inside, origin, ax_u, ax_v, size_u, size_v, part='misc'):
        """Polygon mapped by planar projection: s = (p - origin).ax_u / size_u + 0.5, t likewise (t down)."""
        uvs = []
        for p in pts:
            d = V(p) - V(origin)
            s = min(1, max(0, d.dot(ax_u) / size_u + 0.5))
            t = min(1, max(0, -d.dot(ax_v) / size_v + 0.5))
            uvs.append(self.uvp(region, s, t))
        return self.face(pts, uvs, inside, part)

    def loft(self, rings, centres, side_regions, ts, part, along='v', s_ranges=None):
        """Quads between consecutive rings (lists of n points). side_regions[i] is the region of side i
        (between ring points i and i+1) or a callable (k, i) -> region; ts[k] is the along-coordinate of ring k
        (t for along='v', s for along='u'). s_ranges[i] = (a, b) is the across range of side i (default 0..1)."""
        n = len(rings[0])
        for k in range(len(rings) - 1):
            inside = (V(centres[k]) + V(centres[k + 1])) * 0.5
            for i in range(n):
                j = (i + 1) % n
                reg = side_regions(k, i) if callable(side_regions) else side_regions[i]
                if reg is None:
                    continue
                a, b = s_ranges[i] if s_ranges else (0.0, 1.0)
                if along == 'v':
                    self.quad(rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i], reg, inside,
                              s0=a, s1=b, t0=ts[k + 1], t1=ts[k], part=part)
                else:
                    self.quad(rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j], reg, inside,
                              s0=ts[k], s1=ts[k + 1], t0=a, t1=b, part=part)

    def box(self, mn, mx, regions, part, skip=()):
        """Axis-aligned box; regions maps '+x', '-x', '+y', '-y', '+z', '-z' to region names."""
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        c = V(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
        F_ = {
            '-y': [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
            '+y': [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
            '+x': [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
            '-x': [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)],
            '+z': [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
            '-z': [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
        }
        for k, pts in F_.items():
            if k in skip or k not in regions:
                continue
            self.quad(*pts, regions[k], c, part=part)

    def finish(self, name, expect_max):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        bad = 0
        for f, inside in self.checks:
            want = inside[1] if isinstance(inside, tuple) and inside[0] == 'dir' else f.calc_center_median() - V(inside)
            if f.normal.dot(want) < 0:
                bad += 1
        if bad:
            raise SystemExit(f'{name}: {bad} faces wound inward')
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        png = os.path.join(ROOT, LAYOUT['textures'][self.tex]['file'])
        mat = dt.material(self.tex, png)
        if LAYOUT['textures'][self.tex].get('alpha'):
            cutout(mat)
        me.materials.append(mat)
        tris = dt.tri_count([ob])
        print(f'{name}: {tris} tris (budget {expect_max})', dict(sorted(self.parts.items())))
        if tris > expect_max:
            raise SystemExit(f'{name}: {tris} tris over budget {expect_max}')
        return ob


def cutout(mat):
    """Alpha through a Math Round node: the glTF exporter writes alphaMode MASK (cutoff 0.5), the same test the
    game applies to `transparent` textures, and Blender's previews of the re-imported GLB clip it too."""
    nt = mat.node_tree
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    rnd = nt.nodes.new('ShaderNodeMath')
    rnd.operation = 'ROUND'
    nt.links.new(tex.outputs['Alpha'], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
    for attr, val in (('blend_method', 'CLIP'), ('surface_render_method', 'DITHERED')):
        if hasattr(mat, attr):
            try:
                setattr(mat, attr, val)
            except (TypeError, ValueError):
                pass


def basis(d):
    """Two unit vectors perpendicular to direction d: a (toward +X-ish / up-ish) and b (toward +Y)."""
    d = V(d).normalized()
    ref = V((0, 1, 0)) if abs(d.y) < 0.9 else V((1, 0, 0))
    a = ref.cross(d).normalized()
    b = d.cross(a).normalized()
    return a, b


def rect_ring(c, d, ha, hb):
    """Rectangle section around centre c perpendicular to d: points in order a+b, -a+b, -a-b, a-b."""
    a, b = basis(d)
    c = V(c)
    return [c + a * ha + b * hb, c - a * ha + b * hb, c - a * ha - b * hb, c + a * ha - b * hb]


def ngon_ring(c, r, n, z_axis=V((0, 0, 1)), rot=0.0):
    a, b = basis(z_axis)
    return [V(c) + (a * math.cos(rot + 2 * math.pi * i / n) + b * math.sin(rot + 2 * math.pi * i / n)) * r
            for i in range(n)]


def globe(B, c, r, region_body, region_top, region_bottom, part, segs=6):
    """Faceted globe: bottom cap fan, one middle band, top cap fan (4 * segs tris). Body faces get a planar
    projection from the front (-Y), so the region's radial gradient reads as a lit globe."""
    c = V(c)
    lat = math.radians(30)
    lo = [c + V((r * math.cos(lat) * math.cos(2 * math.pi * i / segs + 0.3), r * math.cos(lat) * math.sin(2 * math.pi * i / segs + 0.3), -r * math.sin(lat))) for i in range(segs)]
    hi = [p + V((0, 0, 2 * r * math.sin(lat))) for p in lo]
    bot, top = c - V((0, 0, r)), c + V((0, 0, r))
    ax_u, ax_v = V((1, 0, 0)), V((0, 0, 1))
    for i in range(segs):
        j = (i + 1) % segs
        for reg, pts in ((region_bottom, [bot, lo[j], lo[i]]), (region_body, [lo[i], lo[j], hi[j], hi[i]]),
                         (region_top, [hi[i], hi[j], top])):
            if reg in ('globe',):
                B.planar(pts, reg, c, c, ax_u, ax_v, 2 * r, 2 * r, part)
            else:
                B.planar(pts, reg, c, c, ax_u, ax_v, 2 * r, 2 * r, part)


def prism_path(B, path, radius, sides, region, part, along='v', t_range=(0.0, 1.0)):
    """Thin n-sided tube along a polyline (wires, stems). Each side maps the region's full width; the
    along-coordinate runs t_range over the path's length (t 0 at the first point)."""
    rings, centres, ts = [], [], []
    L = sum(((V(path[i + 1]) - V(path[i])).length for i in range(len(path) - 1)))
    acc = 0.0
    for k, p in enumerate(path):
        if k == 0:
            d = V(path[1]) - V(path[0])
        elif k == len(path) - 1:
            d = V(path[-1]) - V(path[-2])
        else:
            d = (V(path[k + 1]) - V(path[k])).normalized() + (V(path[k]) - V(path[k - 1])).normalized()
        if k:
            acc += (V(path[k]) - V(path[k - 1])).length
        a, b = basis(d)
        rings.append([V(p) + (a * math.cos(2 * math.pi * i / sides) + b * math.sin(2 * math.pi * i / sides)) * radius
                      for i in range(sides)])
        centres.append(p)
        ts.append(t_range[0] + (t_range[1] - t_range[0]) * acc / L)
    B.loft(rings, centres, [region] * sides, ts, part, along=along)


# ---------------------------------------------------------------------------------------------------
# Streetlights

def rot_about(p, pivot, axis, deg):
    return Matrix.Rotation(math.radians(deg), 3, axis) @ (V(p) - V(pivot)) + V(pivot)


def build_streetlight_poor():
    B = Builder('env_streetlight_poor')
    Z0, PX = LIGHT_Z0, LIGHT_PX
    # concrete plinth (the normal's frustum), its +X/-Y top corner chipped down
    zt = Z0 + 1.15
    bot = [V((PX - 0.66, -0.57, Z0)), V((PX + 0.66, -0.57, Z0)), V((PX + 0.66, 0.57, Z0)), V((PX - 0.66, 0.57, Z0))]
    top = [V((PX - 0.545, -0.47, zt)), V((PX + 0.545, -0.47, zt - 0.22)), V((PX + 0.545, 0.47, zt)), V((PX - 0.545, 0.47, zt))]
    cin = V((PX, 0, Z0 + 0.5))
    for i in range(4):
        j = (i + 1) % 4
        B.quad(bot[i], bot[j], top[j], top[i], 'base_side', cin, part='plinth')
    B.quad(top[0], top[1], top[2], top[3], 'base_top', cin, part='plinth')

    # pole: two segments, kinked at z -1, leaning 4 deg to +X and 2 deg toward the camera above it
    p0 = V((PX, 0, zt - 0.1))
    p1 = V((PX + 0.12, -0.03, -1.0))
    lean = V((math.sin(math.radians(4)), -math.sin(math.radians(2)), 1)).normalized()
    p2 = p1 + lean * (7.75 - p1.z) / lean.z
    d01, d12 = (p1 - p0).normalized(), lean
    rings = [rect_ring(p0, d01, 0.22, 0.22), rect_ring(p1, (d01 + d12), 0.21, 0.21), rect_ring(p2, d12, 0.19, 0.19)]
    L = (p1 - p0).length + (p2 - p1).length
    ts = [1.0, (p2 - p1).length / L, 0.0]
    # ring order a+b, -a+b, -a-b, a-b; a ~ +X, b ~ +Y: side 0 faces +Y, 1 -X, 2 -Y, 3 +X
    B.loft(rings, [p0, p1, p2], ['pole_front', 'pole_side', 'pole_front', 'pole_side'], ts, 'pole')
    r = rings[-1]
    B.quad(r[2], r[3], r[0], r[1], 'arm_top', p2 - V((0, 0, 0.3)), part='pole')

    # arm: from inside the pole top out to +X, sagging at the tip
    a0 = p2 + V((-0.1, 0, -0.22))
    a1 = a0 + V((2.0, 0, -0.18))
    a2 = a1 + V((1.75, -0.05, -0.62))
    pts = [a0, a1, a2]
    rings, ts = [], []
    L = (a1 - a0).length + (a2 - a1).length
    for k, p in enumerate(pts):
        d = (a1 - a0) if k == 0 else ((a2 - a1) if k == 2 else (a1 - a0).normalized() + (a2 - a1).normalized())
        # section: up-ish half 0.18, depth half 0.17
        up = V((0, 1, 0)).cross(V(d)).normalized()
        if up.z < 0:
            up = -up
        yv = V((0, 1, 0))
        c = V(p)
        rings.append([c + up * 0.18 + yv * 0.17, c + up * 0.18 - yv * 0.17, c - up * 0.18 - yv * 0.17, c - up * 0.18 + yv * 0.17])
        ts.append(0.0 if k == 0 else ((a1 - a0).length / L if k == 1 else 1.0))
    # sides: 0 top, 1 front (-Y), 2 bottom, 3 back (+Y)
    B.loft(rings, pts, ['arm_top', 'arm_side', 'arm_under', 'arm_side'], ts, 'arm', along='u')
    r = rings[-1]
    B.quad(r[1], r[0], r[3], r[2], 'arm_under', a2 - V((0.3, 0, 0)), part='arm')

    # the smashed head hanging on its wire under the tip, tilted so its broken underside shows
    tip = a2 + V((0.05, 0, -0.18))
    h0 = tip + V((0.2, -0.12, -1.55))
    prism_path(B, [tip, tip + V((0.2, -0.02, -0.8)), h0 + V((0, 0, 0.05))], 0.08, 3, 'wire', 'wire', t_range=(0.0, 0.7))
    M = Matrix.Rotation(math.radians(18), 3, 'Z') @ Matrix.Rotation(math.radians(-52), 3, 'X')
    hood_top = [V((sx * 0.28, sy * 0.24, 0)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    hood_bot = [V((sx * 0.56, sy * 0.46, -0.55)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    hood_top = [h0 + M @ p for p in hood_top]
    hood_bot = [h0 + M @ p for p in hood_bot]
    hc = h0 + M @ V((0, 0, -0.27))
    for i in range(4):
        j = (i + 1) % 4
        B.quad(hood_bot[i], hood_bot[j], hood_top[j], hood_top[i], 'head_out', hc, part='head')
    B.quad(hood_top[0], hood_top[1], hood_top[2], hood_top[3], 'head_out', hc, t0=0.0, t1=0.3, part='head')
    B.quad(hood_bot[2], hood_bot[3], hood_bot[0], hood_bot[1], 'head_in', hc, part='head')

    # a second, frayed cable dangling from the arm's kink
    k0 = a1 + V((0.0, -0.1, -0.15))
    prism_path(B, [k0, k0 + V((0.3, -0.2, -1.9)), k0 + V((0.05, -0.28, -3.8)), k0 + V((0.4, -0.2, -5.0))],
               0.08, 3, 'wire', 'wire2')

    # open access hatch on the pole's front face (the painted hole is at t 25..28 of 32 px)
    def pole_at(t):  # point on the pole axis at texture t (0 top .. 1 bottom), via the lower segment
        frac = (t - ts_pole[1]) / (1.0 - ts_pole[1])
        return p1 + (p0 - p1) * frac
    ts_pole = [1.0, (p2 - p1).length / ((p1 - p0).length + (p2 - p1).length), 0.0]
    hz0, hz1 = pole_at(28.0 / 32.0), pole_at(25.0 / 32.0)
    hinge_x = hz0.x - 0.22 + 0.04
    yf = -0.225
    w_h = 0.26
    ang = math.radians(115)
    o = V((math.cos(ang), -math.sin(ang), 0)) * w_h  # swung open toward the camera and -X
    q0, q1 = V((hinge_x, yf, hz0.z)), V((hinge_x, yf, hz1.z))
    B.quad(q0, q0 + o, q1 + o, q1, 'hatch', ('dir', V((math.sin(ang), math.cos(ang), 0))), part='hatch')
    k = -V((math.sin(ang), math.cos(ang), 0)) * 0.03  # back side, nudged off the front one (no z-fight)
    B.quad(q0 + o + k, q0 + k, q1 + k, q1 + o + k, 'hatch', ('dir', -V((math.sin(ang), math.cos(ang), 0))), part='hatch')

    # glass shards on the ground under the head
    gx, gy = h0.x - 0.2, h0.y - 0.3
    for (dx, dy, s, rot) in ((0.0, 0.0, 0.5, 0.3), (0.7, -0.4, 0.35, 1.9), (-0.5, 0.35, 0.3, 4.0)):
        tri = [V((gx + dx + s * math.cos(rot + a), gy + dy + s * math.sin(rot + a) * 0.8, Z0 + 0.02)) for a in (0, 2.3, 4.1)]
        uvs = [B.uvp('shard', 0.1, 0.9), B.uvp('shard', 0.9, 0.9), B.uvp('shard', 0.5, 0.1)]
        B.face(tri, uvs, ('dir', V((0, 0, 1))), part='shards')
    return B.finish('env_streetlight_poor', 120)


def build_streetlight_rich():
    B = Builder('env_streetlight_rich')
    Z0, PX = LIGHT_Z0, LIGHT_PX
    up = V((0, 0, 1))
    # marble plinth
    B.box((PX - 0.8, -0.8, Z0), (PX + 0.8, 0.8, Z0 + 0.5),
          {'-y': 'plinth_side', '+y': 'plinth_side', '-x': 'plinth_side', '+x': 'plinth_side', '+z': 'plinth_top'}, 'plinth')

    def col(profile, regions_for, part, rot=math.pi / 6):
        """Hexagonal lathe: profile [(h, r)], regions_for(k) -> (region, t_top, t_bottom) of segment k."""
        rings = [ngon_ring(V((PX, 0, Z0 + h)), r, 6, up, rot) for h, r in profile]
        cents = [V((PX, 0, Z0 + h - 0.01)) for h, r in profile]
        for k in range(len(profile) - 1):
            reg, ta, tb = regions_for(k)
            B.loft(rings[k:k + 2], cents[k:k + 2], [reg] * 6, [tb, ta], part)
        return rings

    # fluted bell base, h 0.45..3.0 above the ground; base region t = (3.0 - h) / 2.5
    base = [(0.45, 0.62), (0.9, 0.55), (2.35, 0.40), (2.55, 0.50), (2.75, 0.50), (3.0, 0.27)]
    col(base, lambda k: ('base', (3.0 - base[k + 1][0]) / 2.55, (3.0 - base[k][0]) / 2.55), 'base')
    # fluted shaft with a gilt collar; shaft region t = (15 - h) / 12
    shaft = [(3.0, 0.27), (8.6, 0.24), (8.75, 0.34), (9.05, 0.34), (9.2, 0.24), (15.0, 0.22)]
    regs = {0: 'shaft', 1: 'gold_lit', 2: 'gold_mid', 3: 'gold_shade', 4: 'shaft'}
    col(shaft, lambda k: (regs[k], (15.0 - shaft[k + 1][0]) / 12.0 if regs[k] == 'shaft' else 0.0,
                          (15.0 - shaft[k][0]) / 12.0 if regs[k] == 'shaft' else 1.0), 'shaft')
    # gilt capital, flat top
    cap = [(15.0, 0.22), (15.5, 0.48), (15.7, 0.48)]
    rings = col(cap, lambda k: (('gold_lit', 0.0, 1.0) if k == 0 else ('gold_mid', 0.0, 1.0)), 'capital')
    topc = V((PX, 0, Z0 + 15.7))
    B.planar(rings[-1], 'gold_lit', topc - V((0, 0, 0.1)), topc, V((1, 0, 0)), V((0, 1, 0)), 1.0, 1.0, 'capital')

    # gilt crossbar on the capital, brackets under it
    hb = 15.7
    B.box((PX - 1.5, -0.14, Z0 + hb), (PX + 1.5, 0.14, Z0 + hb + 0.25),
          {'+z': 'gold_lit', '-y': 'gold_mid', '+y': 'gold_mid', '-x': 'gold_mid', '+x': 'gold_mid'}, 'crossbar')
    B.quad(V((PX - 1.5, 0, Z0 + hb - 1.5)), V((PX + 1.5, 0, Z0 + hb - 1.5)), V((PX + 1.5, 0, Z0 + hb + 0.05)),
           V((PX - 1.5, 0, Z0 + hb + 0.05)), 'scroll_cross', ('dir', V((0, -1, 0))), part='scroll_cross')
    # three globes on the crossbar, the centre one bigger, a star finial on top
    hz = Z0 + hb + 0.25
    for gx, r in ((-1.3, 0.5), (1.3, 0.5)):
        globe(B, V((PX + gx, 0, hz + r * 0.85)), r, 'globe', 'globe', 'gold_mid', 'globes')
    rc = 0.75
    gc = V((PX, 0, hz + rc * 0.85))
    globe(B, gc, rc, 'globe', 'globe', 'gold_mid', 'globes')
    ft = gc.z + rc - 0.15
    for ax in (V((1, 0, 0)), V((0, 1, 0))):
        n = ax.cross(up)
        B.quad(gc + V((0, 0, 0)) - ax * 0.6 + V((0, 0, ft - gc.z)), gc + ax * 0.6 + V((0, 0, ft - gc.z)),
               gc + ax * 0.6 + V((0, 0, ft - gc.z + 1.6)), gc - ax * 0.6 + V((0, 0, ft - gc.z + 1.6)),
               'finial', ('dir', -n if n.y < 0 or n.x < 0 else n), part='finial')

    # straight gilt arm reaching +X like the normal's, filigree under it, a hanging globe lantern
    arm0 = V((PX, 0, Z0 + 12.25))
    arm1 = V((2.35, 0, Z0 + 12.85))
    d = arm1 - arm0
    upv = V((0, 1, 0)).cross(d).normalized()
    if upv.z < 0:
        upv = -upv
    yv = V((0, 1, 0))
    ring = lambda c: [c + upv * 0.11 + yv * 0.11, c + upv * 0.11 - yv * 0.11, c - upv * 0.11 - yv * 0.11, c - upv * 0.11 + yv * 0.11]
    B.loft([ring(arm0), ring(arm1)], [arm0, arm1], ['gold_lit', 'iron', 'gold_shade', 'iron'], [0.0, 1.0], 'arm', along='u')
    xs0, xs1 = PX + 0.25, 2.35 - 0.55
    zt = lambda x: arm0.z + (x - arm0.x) / d.x * d.z - 0.1
    B.quad(V((xs0, 0, zt(xs0) - 1.56)), V((xs1, 0, zt(xs1) - 1.56)), V((xs1, 0, zt(xs1))), V((xs0, 0, zt(xs0))),
           'scroll_swan', ('dir', V((0, -1, 0))), part='scroll_swan')
    lg = arm1 + V((0, 0, -0.95))
    prism_path(B, [arm1 + V((0, 0, 0.05)), lg + V((0, 0, 0.5))], 0.1, 3, 'gold_mid', 'lantern')
    globe(B, lg, 0.6, 'globe', 'gold_lit', 'globe', 'lantern')

    # red pennant with the leader's bust on the -X side, hung from a gilt bar
    hy = Z0 + 10.0
    bx0, bx1 = PX - 0.2, PX - 2.75
    B.loft([ring(V((bx0, 0, hy))), ring(V((bx1, 0, hy)))], [V((bx0, 0, hy)), V((bx1, 0, hy))],
           ['gold_lit', 'gold_mid', 'gold_shade', 'gold_mid'], [0.0, 1.0], 'banner_bar', along='u')
    B.quad(V((PX - 2.7, 0, hy - 3.15)), V((PX - 0.3, 0, hy - 3.15)), V((PX - 0.3, 0, hy + 0.05)),
           V((PX - 2.7, 0, hy + 0.05)), 'banner', ('dir', V((0, -1, 0))), part='banner')
    return B.finish('env_streetlight_rich', 300)


# ---------------------------------------------------------------------------------------------------
# Benches

def clip_z(pts, uvs, zmin):
    """Clips a convex polygon (with its UVs) to z >= zmin (Sutherland-Hodgman, one plane)."""
    out_p, out_u = [], []
    n = len(pts)
    for i in range(n):
        a, b = V(pts[i]), V(pts[(i + 1) % n])
        ua, ub = uvs[i], uvs[(i + 1) % n]
        ina, inb = a.z >= zmin - 1e-6, b.z >= zmin - 1e-6
        if ina:
            out_p.append(a)
            out_u.append(ua)
        if ina != inb:
            t = (zmin - a.z) / (b.z - a.z)
            out_p.append(a + (b - a) * t)
            out_u.append((ua[0] + (ub[0] - ua[0]) * t, ua[1] + (ub[1] - ua[1]) * t))
    return out_p, out_u


def slat(B, pl, pr, w_vec, n_vec, width, thick, region, part, s0=0.0, s1=1.0, edge='slat_edge'):
    """A slat whose TOP face runs from pl to pr (centre line), width along w_vec, normal n_vec."""
    pl, pr, w_vec, n_vec = V(pl), V(pr), V(w_vec).normalized(), V(n_vec).normalized()
    hw = w_vec * (width / 2)
    tl_, tr_, br_, bl_ = pl - hw, pr - hw, pr + hw, pl + hw  # top face: front-left, front-right, back-right, back-left
    down = -n_vec * thick
    c = (pl + pr) / 2 + down / 2
    B.quad(tl_, tr_, br_, bl_, region, c, s0=s0, s1=s1, t0=0.0, t1=1.0, part=part)            # top
    B.quad(tl_ + down, tr_ + down, tr_, tl_, edge, c, s0=s0, s1=s1, part=part)                # front edge
    B.quad(br_ + down, bl_ + down, bl_, br_, edge, c, s0=s1, s1=s0, part=part)                # back edge


def build_parkbench_poor():
    B = Builder('env_parkbench_poor')
    Z0 = BENCH_Z0
    ZT = 1.27            # top of the end frames (the normal's backrest top)
    piv = V((0, 0.61, Z0))  # the broken end tips forward about its back foot
    sag = Matrix.Rotation(math.radians(8), 3, 'X')

    def sagged(p):
        q = V((p[0], piv.y, piv.z))
        return sag @ (V(p) - q) + q

    for x, broken in ((-2.7, False), (2.7, True)):
        corners = [V((x, -1.1, Z0)), V((x, 1.1, Z0)), V((x, 1.1, ZT)), V((x, -1.1, ZT))]
        reg = 'frame_broken' if broken else 'frame'
        uvs = [B.uvp(reg, 0, 1), B.uvp(reg, 1, 1), B.uvp(reg, 1, 0), B.uvp(reg, 0, 0)]
        if broken:
            corners = [sagged(p) for p in corners]
            corners, uvs = clip_z(corners, uvs, Z0)
        B.face(corners, uvs, ('dir', V((1 if x > 0 else -1, 0, 0))), part='frames')
    # front leg seen from the front (the intact end only; the other's is snapped off)
    B.quad(V((-3.02, -0.76, Z0)), V((-2.38, -0.76, Z0)), V((-2.38, -0.76, ZT)), V((-3.02, -0.76, ZT)),
           'leg_front', ('dir', V((0, -1, 0))), part='legs')

    def seat_pt(x, y, z_top):
        """Point on a slat resting on both frames: linear between the left support (x -2.7) and the sagged
        right support, extrapolated to the slat ends."""
        r = sagged((2.7, y, z_top))
        f = (x + 2.7) / 5.4
        return V((x, y + (r.y - y) * f, z_top + (r.z - z_top) * f))

    up = V((0, 0, 1))
    yv = V((0, 1, 0))
    # seat slats: A front intact, B missing, C snapped (left half drooping, right half on the ground), D back
    slat(B, seat_pt(-3.15, -0.92, -0.14), seat_pt(3.15, -0.92, -0.14), yv, up, 0.3, 0.1, 'slat_top', 'seat')
    slat(B, seat_pt(-3.15, 0.15, -0.14), seat_pt(3.15, 0.15, -0.14), yv, up, 0.3, 0.1, 'slat_top2', 'seat')
    droop = math.radians(14)
    dl = V((math.cos(droop), 0, -math.sin(droop)))
    pivc = V((-2.7, -0.18, -0.14))
    slat(B, pivc - dl * 0.45, pivc + dl * 2.4, yv, V((math.sin(droop), 0, math.cos(droop))), 0.3, 0.1,
         'slat_broken', 'seat')
    a = math.radians(12)
    gd = V((math.cos(a), math.sin(a), 0))
    g0 = V((0.25, -0.45, Z0 + 0.1))
    slat(B, g0, g0 + gd * 2.6, V((-math.sin(a), math.cos(a), 0)), up, 0.3, 0.1, 'slat_broken', 'ground', s0=1.0, s1=0.0)

    # back slats along the backrest line (front surface) from (y .58, z -.05) to (y .80, z 1.2)
    lo, hi = V((0, 0.58, -0.05)), V((0, 0.80, 1.2))
    along = (hi - lo).normalized()
    nb = V((0, -along.z, along.y))  # faces -Y and a little up

    def back_pt(x, f):
        p = lo + (hi - lo) * f
        left = V((-2.7, p.y, p.z))
        right = sagged((2.7, p.y, p.z))
        t = (x + 2.7) / 5.4
        return left + (right - left) * t
    # E: low back slat, intact
    slat(B, back_pt(-3.15, 0.22), back_pt(3.15, 0.22), along, nb, 0.3, 0.1, 'slat_top', 'back')
    # G: top back slat, intact
    slat(B, back_pt(-3.15, 0.88), back_pt(3.15, 0.88), along, nb, 0.3, 0.1, 'slat_top2', 'back')
    # F: middle back slat hanging from its left end, the right end fallen onto the seat
    hl = back_pt(-2.7, 0.56)
    hr = V((2.9, 0.1, 0.05))
    dh = (hr - hl).normalized()
    nh = dh.cross(along).normalized()
    if nh.y > 0:
        nh = -nh
    slat(B, hl - dh * 0.45, hr, along, nh, 0.3, 0.1, 'slat_top2', 'back')

    # litter under the seat
    B.quad(V((-1.6, -0.75, Z0 + 0.02)), V((-0.6, -0.75, Z0 + 0.02)), V((-0.6, -0.25, Z0 + 0.02)),
           V((-1.6, -0.25, Z0 + 0.02)), 'litter', ('dir', up), part='litter')
    return B.finish('env_parkbench_poor', 60)


def build_parkbench_rich():
    B = Builder('env_parkbench_rich')
    Z0 = BENCH_Z0
    ZT = 1.30
    # gilt ends (side profile, cut-out), doubled for thickness
    for x in (-3.0, -2.82, 2.82, 3.0):
        B.quad(V((x, -1.1, Z0)), V((x, 1.1, Z0)), V((x, 1.1, ZT)), V((x, -1.1, ZT)), 'end',
               ('dir', V((1 if x > 0 else -1, 0, 0))), part='ends')
    for sx in (-1, 1):
        x = 2.91 * sx
        # front face of the armrest scroll
        B.quad(V((x - 0.3, -0.92, 0.0)), V((x + 0.3, -0.92, 0.0)), V((x + 0.3, -0.92, 0.6)), V((x - 0.3, -0.92, 0.6)),
               'volute', ('dir', V((0, -1, 0))), part='volutes')
        # solid gilt armrest rail from the scroll back to the back support
        p0, p1 = V((x, -0.62, 0.5)), V((x, 0.8, 0.58))
        d = p1 - p0
        upv = d.cross(V((1, 0, 0))).normalized()
        if upv.z < 0:
            upv = -upv
        xv = V((1, 0, 0))
        ring = lambda c: [c + upv * 0.1 - xv * 0.11, c + upv * 0.1 + xv * 0.11, c - upv * 0.1 + xv * 0.11, c - upv * 0.1 - xv * 0.11]
        B.loft([ring(p0), ring(p1)], [p0, p1], ['gold', 'gold', 'gold_shade', 'gold'], [0.0, 1.0], 'rails', along='u')
    # cabriole legs seen from the front and back (ends and middle)
    for x in (-2.91, 0.0, 2.91):
        for y, dy in ((-0.84, -1), (0.92, 1)):
            B.quad(V((x - 0.22, y, Z0)), V((x + 0.22, y, Z0)), V((x + 0.22, y, -0.38)), V((x - 0.22, y, -0.38)),
                   'leg', ('dir', V((0, dy, 0))), part='legs')
    # white marble seat slab
    B.box((-2.95, -1.0, -0.62), (2.95, 0.45, -0.38),
          {'-y': 'marble_edge', '+y': 'marble_edge', '-x': 'marble_edge', '+x': 'marble_edge', '+z': 'marble_top'}, 'slab')
    # tufted red velvet cushion with a rounded front edge
    x0, x1 = -2.8, 2.8
    prof = [V((0, -0.97, -0.38)), V((0, 0.33, -0.38)), V((0, 0.33, -0.06)), V((0, -0.86, -0.06)), V((0, -0.97, -0.17))]
    cc = V((0, -0.3, -0.22))
    L = [p + V((x0, 0, 0)) for p in prof]
    R = [p + V((x1, 0, 0)) for p in prof]
    B.quad(L[3], R[3], R[2], L[2], 'velvet_top', cc, part='cushion')
    B.quad(L[4], R[4], R[3], L[3], 'velvet_side', cc, part='cushion')
    B.quad(L[0], R[0], R[4], L[4], 'velvet_side', cc, t0=0.3, part='cushion')
    B.quad(R[1], L[1], L[2], R[2], 'velvet_side', cc, part='cushion')
    for side in (L, R):
        uvs = [B.uvp('velvet_side', (p.y + 0.97) / 1.3, 1 - (p.z + 0.38) / 0.32) for p in side]
        B.face(side, uvs, cc, part='cushion')
    # velvet backrest in a gilt frame, leaning back
    bl0, bl1, tl0, tl1 = V((0, 0.36, -0.38)), V((0, 0.58, -0.38)), V((0, 0.68, 1.55)), V((0, 0.90, 1.55))
    bc = V((0, 0.6, 0.4))
    xa, xb = V((-2.75, 0, 0)), V((2.75, 0, 0))
    B.quad(bl0 + xa, bl0 + xb, tl0 + xb, tl0 + xa, 'back_front', bc, part='backrest')
    B.quad(bl1 + xb, bl1 + xa, tl1 + xa, tl1 + xb, 'back_rear', bc, part='backrest')
    B.quad(tl0 + xa, tl0 + xb, tl1 + xb, tl1 + xa, 'gold', bc, part='backrest')
    B.quad(bl1 + xa, bl0 + xa, tl0 + xa, tl1 + xa, 'gold', bc, part='backrest')
    B.quad(bl0 + xb, bl1 + xb, tl1 + xb, tl0 + xb, 'gold', bc, part='backrest')
    # gilt crest with the leader's bust, in the backrest's plane
    lean = (tl0 - bl0).normalized()
    cb = V((0, 0.78, 1.45))
    B.quad(cb - V((1.4, 0, 0)), cb + V((1.4, 0, 0)), cb + V((1.4, 0, 0)) + lean * 1.22, cb - V((1.4, 0, 0)) + lean * 1.22,
           'crest', ('dir', V((0, -1, 0))), part='crest')
    # gold ball finials on the backrest's top corners
    for x in (-2.75, 2.75):
        globe(B, V((x, 0.79, 1.55 + 0.2)), 0.26, 'gold', 'gold', 'gold_shade', 'finials')
    return B.finish('env_parkbench_rich', 200)


# ---------------------------------------------------------------------------------------------------
# Preview: flat-lit (the game's single ambient light), back faces culled, beside the normal model

NORMALS = {'env_streetlight_poor': 'env_streetlight_standard_medium', 'env_streetlight_rich': 'env_streetlight_standard_medium',
           'env_parkbench_poor': 'env_parkbench_medium', 'env_parkbench_rich': 'env_parkbench_medium'}


def import_glb(path, dx=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    for o in objs:
        if o.parent is None:
            o.scale = o.scale * 1000.0 if o.type == 'MESH' else o.scale
            o.location.x += dx
        if o.type == 'MESH':
            for m in o.data.materials:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE':
                        n.interpolation = 'Closest'
    # the Max exporter's GLBs put the 0.001 on a child mesh under an identity root
    for o in objs:
        if o.type == 'MESH' and o.parent is not None and o.scale.x < 0.01:
            o.scale = o.scale * 1000.0
    bpy.context.view_layer.update()
    return objs


def preview(name, out_dir):
    """EEVEE under a uniform warm world light: the game's flat ambient light, with alpha cut-outs (Workbench
    ignores texture alpha in Blender 5.1) and back faces culled on opaque materials as the game does."""
    dt.reset()
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('ambient')
    w.use_nodes = True
    bgn = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bgn.inputs[0].default_value = (1.0, 0.96, 0.88, 1)
    sc.world = w
    sc.render.resolution_x, sc.render.resolution_y = 1000, 800
    mine = import_glb(os.path.join(ROOT, 'public', 'models', 'map', name + '.glb'))
    mn, mx = dt.bounds(mine)
    off = (mx.x - mn.x) + 3.0
    normal = import_glb(os.path.join(ROOT, 'public', 'models', 'map', NORMALS[name] + '.glb'), dx=off)
    nmn, nmx = dt.bounds(normal)
    for o in mine + normal:
        if o.type == 'MESH':
            for m in o.data.materials:
                if not LAYOUT['textures'].get(m.name, {}).get('alpha'):
                    m.use_backface_culling = True
    print(f'PIVOT {name}: min {tuple(round(v, 3) for v in mn)} max {tuple(round(v, 3) for v in mx)};'
          f' normal min {tuple(round(v, 3) for v in nmn)} (offset {off:.2f} in x)')
    gz = nmn.z
    bpy.ops.mesh.primitive_plane_add(size=1, location=((mn.x + nmx.x) / 2, 0, gz - 0.01))
    g = bpy.context.object
    g.scale = (nmx.x - mn.x + 6, 12, 1)
    gm = bpy.data.materials.new('ground')
    gm.diffuse_color = (0.30, 0.29, 0.28, 1)
    g.data.materials.append(gm)
    cx = (mn.x + nmx.x) / 2
    span = nmx.x - mn.x
    height = max(mx.z, nmx.z) - gz
    target = V((cx, 0, gz + height * 0.45))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(span * 1.25, height * 1.35 * 1000 / 800)
    os.makedirs(out_dir, exist_ok=True)
    for view, d in (('3q', V((0.5, -1.0, 0.5))), ('street', V((0.15, -1.0, 0.47))), ('back', V((-0.5, 1.0, 0.5)))):
        d.normalize()
        cam.location = target + d * 200
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        cam.data.clip_end = 1000
        sc.render.filepath = os.path.join(out_dir, f'{name}_flat_{view}.png')
        bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    prev = None
    if '--preview' in argv:
        i = argv.index('--preview')
        prev = os.path.abspath(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    builders = {'env_streetlight_poor': build_streetlight_poor, 'env_streetlight_rich': build_streetlight_rich,
                'env_parkbench_poor': build_parkbench_poor, 'env_parkbench_rich': build_parkbench_rich}
    names = argv or list(builders)
    for name in names:
        dt.reset()
        ob = builders[name]()
        mn, mx = dt.bounds([ob])
        print(f'BOUNDS {name}: min {tuple(round(v, 3) for v in mn)} max {tuple(round(v, 3) for v in mx)}')
        dt.export_glb([ob], os.path.join(ROOT, 'public', 'models', 'map', name + '.glb'))
    if prev:
        for name in names:
            preview(name, prev)


main()
