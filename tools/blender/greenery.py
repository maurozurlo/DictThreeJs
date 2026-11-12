"""Greenery family models: rich palm, planter ladder (poor | normal | rich), topiary bust of the leader.

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/greenery.py -- [model ...] [--preview build/visual_gaps/greenery/models]

Run from the repo root after `python tools/texgen/greenery.py`. Builds every model (or only those named:
env_tree_rich, env_planter_poor, env_planter_normal, env_planter_rich, env_bush_rich) in game units,
Z-up, Blender -Y toward the Street camera, and writes public/models/map/<name>.glb with dt_common.export_glb.
Rects and texture sizes come from tools/texgen/greenery_layout.json.

The game's street textures CLAMP (TextureLoader default, no wrapS), so every UV stays inside its rect with
a half-pixel inset; nothing relies on UV repeat. The street is lit by a single ambient light and ignores
vertex colour, so shading is baked through the UVs: 'ramp' regions run light to dark and each vertex
picks its row from its smooth normal (up = light, sideways = mid, down = dark) times a height occlusion.
With --preview the script also renders each model alone in Workbench FLAT light with back-face culling on
(what the game shows), and saves the .blend.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dt_common as dt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LAYOUT = json.load(open(os.path.join(ROOT, 'tools', 'texgen', 'greenery_layout.json'), encoding='utf-8'))
TEX = LAYOUT['textures']
Z = Vector((0, 0, 1))


def rect(tex, region):
    return TEX[tex]['regions'][region]['rect']


def size(tex):
    return TEX[tex]['size']


# ---------------------------------------------------------------------------------------------------------
# Mesh builder: faces carry pixel UVs of their material's texture; outward orientation is enforced.

def newell(pts):
    n = Vector()
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n  # length = 2 * area


class Part:
    def __init__(self, mat, name=''):
        self.mat, self.name, self.faces = mat, name, []

    def face(self, pts, uvs=None, out=None):
        pts = [Vector(p) for p in pts]
        uvs = list(uvs) if uvs is not None else None
        if out is not None and newell(pts).dot(Vector(out)) < 0:
            pts.reverse()
            if uvs:
                uvs.reverse()
        self.faces.append([pts, uvs])
        return self.faces[-1]


class Model:
    def __init__(self, name):
        self.name, self.parts = name, []

    def part(self, mat, name=''):
        p = Part(mat, name)
        self.parts.append(p)
        return p

    def build(self):
        mats = []
        for p in self.parts:
            if p.mat not in mats:
                mats.append(p.mat)
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new('UVMap')
        for p in self.parts:
            W, H = size(p.mat)
            mi = mats.index(p.mat)
            for pts, uvs in p.faces:
                if uvs is None:
                    raise SystemExit(f'{self.name}/{p.name}: face without UVs')
                vs = [bm.verts.new(q) for q in pts]
                f = bm.faces.new(vs)
                f.material_index = mi
                for loop, (px, py) in zip(f.loops, uvs):
                    u, v = px / W, 1.0 - py / H
                    if not (-1e-6 <= u <= 1 + 1e-6 and -1e-6 <= v <= 1 + 1e-6):
                        raise SystemExit(f'{self.name}/{p.name}: UV outside [0,1] ({u:.3f}, {v:.3f})')
                    loop[uvl].uv = (u, v)
        bm.normal_update()
        mobjs = [material(m) for m in mats]
        return dt.mesh_object(self.name, bm, mobjs)

    def tris(self):
        return sum(len(f[0]) - 2 for p in self.parts for f in p.faces)


_MATS = {}


def material(name):
    if name in _MATS:
        return _MATS[name]
    m = dt.material(name, os.path.join(ROOT, TEX[name]['file']))
    if TEX[name]['mode'] == 'RGBA':
        # alpha clip the way the glTF exporter recognises (Round -> alphaMode MASK, cutoff 0.5)
        nt = m.node_tree
        tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        rnd = nt.nodes.new('ShaderNodeMath')
        rnd.operation = 'ROUND'
        nt.links.new(tex.outputs['Alpha'], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
        for attr, val in (('surface_render_method', 'DITHERED'), ('blend_method', 'CLIP')):
            try:
                setattr(m, attr, val)
            except (AttributeError, TypeError):
                pass
        m.use_backface_culling = False
    else:
        # dt.material links the image alpha whenever Blender reports 4 channels (it does for RGB PNGs
        # too), which exports alphaMode BLEND; an opaque texture should export OPAQUE
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        for link in list(bsdf.inputs['Alpha'].links):
            nt.links.remove(link)
        for attr, val in (('surface_render_method', 'DITHERED'), ('blend_method', 'OPAQUE')):
            try:
                setattr(m, attr, val)
            except (AttributeError, TypeError):
                pass
        m.use_backface_culling = True
    _MATS[name] = m
    return m


# ---------------------------------------------------------------------------------------------------------
# UV helpers (pixel space)

def map_quad(r, u0, u1, v0, v1, inset=0.5):
    """UVs for a quad given bottom-left, bottom-right, top-right, top-left: u0..u1 across, v0 (bottom
    row, image y) .. v1 (top row) in pixel coordinates relative to rect r, clamped inside it."""
    x, y, w, h = r
    cu = lambda u: x + min(max(u, inset), w - inset)
    cv = lambda v: y + min(max(v, inset), h - inset)
    return [(cu(u0), cv(v0)), (cu(u1), cv(v0)), (cu(u1), cv(v1)), (cu(u0), cv(v1))]


def map_planar(r, pts, ax_u, ax_v, origin, scale_u, scale_v, inset=0.5):
    """Projects pts onto ax_u / ax_v from origin; scale in px per unit; v grows downward (image y)."""
    x, y, w, h = r
    out = []
    for p in pts:
        d = Vector(p) - Vector(origin)
        u = d.dot(Vector(ax_u)) * scale_u
        v = d.dot(Vector(ax_v)) * scale_v
        out.append((x + min(max(u, inset), w - inset), y + min(max(v, inset), h - inset)))
    return out


def fit_planar(r, pts, ax_u, ax_v, inset=0.5):
    """Maps pts' extent on ax_u / ax_v onto the whole rect (ax_v pointing down the image)."""
    us = [Vector(p).dot(Vector(ax_u)) for p in pts]
    vs = [Vector(p).dot(Vector(ax_v)) for p in pts]
    x, y, w, h = r
    out = []
    for u, v in zip(us, vs):
        fu = (u - min(us)) / max(1e-6, max(us) - min(us))
        fv = (v - min(vs)) / max(1e-6, max(vs) - min(vs))
        out.append((x + inset + fu * (w - 2 * inset), y + inset + fv * (h - 2 * inset)))
    return out


def ramp_uv(part, r, density=6.0, ao=None, seed=0, bias=0.0, gain=1.0):
    """Ramp mapping: V row from each vertex's smooth normal (and ao(p) in [0, 1]), U packed per face
    along its horizontal tangent at `density` px/unit with a seeded offset inside the rect."""
    rnd = random.Random(seed)
    key = lambda p: (round(p.x, 4), round(p.y, 4), round(p.z, 4))
    acc = {}
    for pts, _ in part.faces:
        n = newell(pts)
        for p in pts:
            acc[key(p)] = acc.get(key(p), Vector()) + n
    x, y, w, h = r
    for f in part.faces:
        pts = f[0]
        fn = newell(pts).normalized()
        flat = abs(fn.z) > 0.6
        t = Vector((-fn.y, fn.x, 0))
        t = t.normalized() if (t.length > 0.25 and not flat) else Vector((1, 0, 0))
        us = [p.dot(t) * density for p in pts]
        span = max(us) - min(us)
        if span > w - 2:
            k = (w - 2) / span
            us = [u * k for u in us]
            span = w - 2
        off = x + 1 + rnd.random() * (w - 2 - span) - min(us)
        vs = []
        for p in pts:
            n = acc[key(p)].normalized()
            light = 0.5 + 0.5 * n.z
            if ao:
                light *= ao(p)
            light = min(1.0, max(0.0, bias + gain * light))
            vs.append(y + 1 + (1.0 - light) * (h - 2))
        if flat:
            # a flat top or underside would sample one row (stripes): spread it over a few rows by its
            # planar y, kept inside a band of about a fifth of the ramp
            ly = [p.y * density for p in pts]
            ymid = (max(ly) + min(ly)) / 2
            band = max(4.0, 0.2 * h)
            k = min(1.0, band / max(1e-6, max(ly) - min(ly)))
            vs = [v + (q - ymid) * k for v, q in zip(vs, ly)]
            lo, hi = min(vs), max(vs)
            shift = max(0.0, (y + 0.5) - lo) - max(0.0, hi - (y + h - 0.5))
            vs = [v + shift for v in vs]
        f[1] = [(u + off, v) for u, v in zip(us, vs)]


def height_ao(z0, z1, floor=0.55):
    """Occlusion that darkens toward z0 (contact) and is 1 from z1 up."""
    def fn(p):
        t = min(1.0, max(0.0, (p.z - z0) / max(1e-6, z1 - z0)))
        return floor + (1 - floor) * t * t * (3 - 2 * t)
    return fn


# ---------------------------------------------------------------------------------------------------------
# Shape helpers

def ring_pts(c, rx, ry, z, n, phase=0.0):
    return [Vector((c[0] + rx * math.cos(phase + 2 * math.pi * i / n),
                    c[1] + ry * math.sin(phase + 2 * math.pi * i / n), z)) for i in range(n)]


def loft(part, rings, close_top=False, close_bottom=False, centre=None):
    """Side faces between consecutive rings (lists of equal length), oriented away from the axis."""
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            q = [a[i], a[j], b[j], b[i]]
            c = sum(q, Vector()) / 4
            ax = Vector(centre) if centre is not None else sum(a, Vector()) / n
            out = Vector((c.x - ax.x, c.y - ax.y, 0))
            if out.length < 1e-6:
                out = Z.copy()
            part.face(q, out=out)
    if close_top:
        part.face(list(rings[-1]), out=Z)
    if close_bottom:
        part.face(list(rings[0]), out=-Z)


def box_faces(part, x0, x1, y0, y1, z0, z1, skip=()):
    """Axis box, faces named -x +x -y +y top bottom; returns {name: face}."""
    P = lambda x, y, z: Vector((x, y, z))
    faces = {
        '-y': ([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], (0, -1, 0)),
        '+x': ([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], (1, 0, 0)),
        '+y': ([P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], (0, 1, 0)),
        '-x': ([P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], (-1, 0, 0)),
        'top': ([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], (0, 0, 1)),
        'bottom': ([P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], (0, 0, -1)),
    }
    out = {}
    for k, (pts, o) in faces.items():
        if k not in skip:
            out[k] = part.face(pts, out=o)
    return out


# ---------------------------------------------------------------------------------------------------------
# env_tree_rich: palm on the normal tree's pivot (ground z = -9.14, trunk foot at (0.15, -0.10))

TREE_BASE = Vector((0.15, -0.10, -9.14))


def trunk_point(t):
    return TREE_BASE + Vector((1.9 * t ** 1.7, -0.35 * t * t, 20.3 * t))


def trunk_radius(t):
    flare = 0.42 * (1.0 - min(1.0, t / 0.07)) ** 2
    return 0.92 - 0.38 * t + flare


def frond(part, tex_y0, base, az, length, e0, e1, half_w=1.8, fold=28.0, segs=(0.3, 0.36, 0.34)):
    """Folded frond card (inverted V along the rib). tex_y0: 0 = frond_lit band, 32 = frond_shade."""
    d = Vector((math.cos(az), math.sin(az), 0))
    side = Vector((-math.sin(az), math.cos(az), 0))
    spine, s_acc, p = [base.copy()], [0.0], base.copy()
    acc = 0.0
    for frac in segs:
        mid = acc + frac * 0.5
        e = math.radians(e0 + (e1 - e0) * mid)
        p = p + (d * math.cos(e) + Z * math.sin(e)) * length * frac
        acc += frac
        spine.append(p.copy())
        s_acc.append(acc)
    f = math.radians(fold)
    rows = []
    for i, q in enumerate(spine):
        tan = (spine[min(i + 1, len(spine) - 1)] - spine[max(i - 1, 0)]).normalized()
        nrm = tan.cross(side).normalized()
        if nrm.z < 0:
            nrm = -nrm
        w = half_w * (0.35 if i == 0 else 1.0)
        left = q + side * w * math.cos(f) - nrm * w * math.sin(f)
        right = q - side * w * math.cos(f) - nrm * w * math.sin(f)
        rows.append((left, q, right))
    r = (0, tex_y0, 64, 32)
    for i in range(len(spine) - 1):
        u0, u1 = 0.5 + s_acc[i] * 63.0, 0.5 + s_acc[i + 1] * 63.0
        l0, c0, r0 = rows[i]
        l1, c1, r1 = rows[i + 1]
        part.face([c0, c1, l1, l0], [(u0, tex_y0 + 16), (u1, tex_y0 + 16), (u1, tex_y0 + 0.5), (u0, tex_y0 + 0.5)])
        part.face([c0, r0, r1, c1], [(u0, tex_y0 + 16), (u0, tex_y0 + 31.5), (u1, tex_y0 + 31.5), (u1, tex_y0 + 16)])


def build_tree_rich():
    m = Model('env_tree_rich')
    # trunk: 6 sides, horizontal rings along a curve, V once from crown (top) to foot
    trunk = m.part('env_tree_rich_trunk', 'trunk')
    ts = [0.0, 0.05, 0.18, 0.34, 0.5, 0.66, 0.83, 1.0]
    sides = 6
    rings = [ring_pts(trunk_point(t), trunk_radius(t), trunk_radius(t), trunk_point(t).z, sides, 0.3) for t in ts]
    tr = rect('env_tree_rich_trunk', 'trunk')
    for k in range(len(ts) - 1):
        for i in range(sides):
            j = i + 1
            a0, a1 = rings[k][i], rings[k][j % sides]
            b0, b1 = rings[k + 1][i], rings[k + 1][j % sides]
            c = trunk_point(ts[k])
            uv = map_quad(tr, i * 32 / sides, j * 32 / sides, (1 - ts[k]) * 52, (1 - ts[k + 1]) * 52)
            fc = (a0 + a1 + b0 + b1) / 4
            trunk.face([a0, a1, b1, b0], uv, out=Vector((fc.x - c.x, fc.y - c.y, 0)))
    # crown knob: frond boots, crown region (top row = apex)
    top = trunk_point(1.0)
    crown = m.part('env_tree_rich_trunk', 'crown')
    cr = rect('env_tree_rich_trunk', 'crown')
    bulge = ring_pts(top + Vector((0, 0, 0.9)), 0.95, 0.95, top.z + 0.9, sides, 0.3)
    apex = top + Vector((0.1, 0, 2.0))
    base_ring = rings[-1]
    for i in range(sides):
        j = (i + 1) % sides
        u0, u1 = i * 32 / sides, (i + 1) * 32 / sides
        fc = (base_ring[i] + bulge[j]) / 2
        crown.face([base_ring[i], base_ring[j], bulge[j], bulge[i]], map_quad(cr, u0, u1, 12, 5),
                   out=Vector((fc.x - top.x, fc.y - top.y, 0)))
        crown.face([bulge[i], bulge[j], apex], [map_quad(cr, u0, u1, 5, 0)[k] for k in (0, 1, 2)],
                   out=Vector((fc.x - top.x, fc.y - top.y, 0.6)))
    # fronds: upper lit ring, lower shaded drooping ring, two young upright ones
    fr = m.part('env_tree_rich_fronds', 'fronds')
    origin = top + Vector((0, 0, 1.2))
    rnd = random.Random(11)
    for i in range(6):
        az = math.radians(15 + i * 60 + rnd.uniform(-12, 12))
        frond(fr, 0, origin + Vector((math.cos(az), math.sin(az), 0)) * 0.3, az,
              rnd.uniform(9.0, 10.0), rnd.uniform(22, 32), rnd.uniform(-38, -28), half_w=2.05)
    for i in range(3):
        az = math.radians(75 + i * 120 + rnd.uniform(-10, 10))
        frond(fr, 32, origin + Vector((math.cos(az), math.sin(az), -0.4)) * 0.3, az,
              rnd.uniform(8.0, 8.8), rnd.uniform(-5, 5), rnd.uniform(-70, -58), half_w=1.7)
    for i in range(2):
        az = math.radians(130 + i * 170 + rnd.uniform(-10, 10))
        frond(fr, 0, origin + Vector((0, 0, 0.3)), az, rnd.uniform(6.0, 6.8), 62, 25, half_w=1.6)
    # gilded collar (band outside, gilt top, darker gilt inside) + railing cage, octagonal
    gold = m.part('greenery_gold', 'collar')
    n, ro, ri, zc0, zc1 = 8, 2.0, 1.7, TREE_BASE.z, TREE_BASE.z + 0.55
    c = TREE_BASE
    outer0 = ring_pts(c, ro, ro, zc0, n, math.pi / 8)
    outer1 = ring_pts(c, ro, ro, zc1, n, math.pi / 8)
    inner0 = ring_pts(c, ri, ri, zc0 + 0.25, n, math.pi / 8)
    inner1 = ring_pts(c, ri, ri, zc1, n, math.pi / 8)
    band, gilt, rail = (rect('greenery_gold', k) for k in ('band', 'gilt', 'railing'))
    for i in range(n):
        j = (i + 1) % n
        u0 = (i % 4) * 16
        mid = (outer0[i] + outer0[j]) / 2 - c
        outv = Vector((mid.x, mid.y, 0))
        gold.face([outer0[i], outer0[j], outer1[j], outer1[i]], map_quad(band, u0, u0 + 16, 16, 0), out=outv)
        gold.face([outer1[i], outer1[j], inner1[j], inner1[i]],
                  [(gilt[0] + u0 + 0.5, gilt[1] + 1.5), (gilt[0] + u0 + 15.5, gilt[1] + 1.5),
                   (gilt[0] + u0 + 15.5, gilt[1] + 3.5), (gilt[0] + u0 + 0.5, gilt[1] + 3.5)], out=Z)
        gold.face([inner0[i], inner0[j], inner1[j], inner1[i]], map_quad(gilt, u0, u0 + 16, 22, 14), out=-outv)
    cage = m.part('greenery_gold', 'cage')
    rc = 1.85
    cz0, cz1 = zc1, zc1 + 1.7
    lo = ring_pts(c, rc, rc, cz0, n, math.pi / 8)
    hi = ring_pts(c, rc, rc, cz1, n, math.pi / 8)
    for i in range(n):
        j = (i + 1) % n
        u0 = (i % 4) * 16
        cage.face([lo[i], lo[j], hi[j], hi[i]], map_quad(rail, u0, u0 + 16, 24, 0, inset=0.01))
    return m


# ---------------------------------------------------------------------------------------------------------
# Planter shell: four slabs (front/back span the full width, sides fit between), each split into pieces
# with their own top height (a broken corner). Outer faces map the side strip by absolute height, inner
# faces its lower rows (darker toward the soil), tops the rim strip; broken tops and steps get rubble.

def planter_shell(m, tex, side, top, hx, hy, h, t, soil_z, pieces=None, rubble=False, density=6.4):
    sr, tr = rect(tex, side), rect(tex, top)
    pieces = pieces or {}
    shell = m.part(tex, 'shell')
    rub = m.part('greenery_cards', 'rubble') if rubble else None
    rr = rect('greenery_cards', 'rubble') if rubble else None
    srow = lambda z: (1.0 - z / h) * sr[3]
    irow = lambda z: 2.0 + (1.0 - (z - soil_z) / max(1e-6, h - soil_z)) * (sr[3] - 2.0)
    slabs = {
        # name: (axis along, start, end, outer coordinate, inward sign)
        'front': ('x', -hx, hx, -hy, +1),
        'back': ('x', hx, -hx, hy, -1),
        'right': ('y', -hy + t, hy - t, hx, -1),
        'left': ('y', hy - t, -hy + t, -hx, +1),
    }
    for name, (ax, a0, a1, fixed, inward) in slabs.items():
        cuts = pieces.get(name, [(a0, a1, h)])
        L = abs(a1 - a0)
        squeeze = min(1.0, sr[2] / (L * density))
        for k, (s0, s1, ztop) in enumerate(cuts):
            def P(s, z, depth, fixed=fixed, inward=inward, ax=ax):
                f = fixed + inward * depth
                return Vector((s, f, z)) if ax == 'x' else Vector((f, s, z))
            out_dir = Vector((0, -inward, 0)) if ax == 'x' else Vector((-inward, 0, 0))
            u0 = abs(s0 - a0) * density * squeeze
            u1 = abs(s1 - a0) * density * squeeze
            e0 = s0 - math.copysign(t, a1 - a0) if (ax == 'y' and k == 0) else s0          # side slabs
            e1 = s1 + math.copysign(t, a1 - a0) if (ax == 'y' and k == len(cuts) - 1) else s1  # wrap corners
            shell.face([P(e0, 0, 0), P(e1, 0, 0), P(e1, ztop, 0), P(e0, ztop, 0)],
                       map_quad(sr, u0, u1, srow(0), srow(ztop)), out=out_dir)
            shell.face([P(s0, soil_z, t), P(s1, soil_z, t), P(s1, ztop, t), P(s0, ztop, t)],
                       map_quad(sr, u0, u1, irow(soil_z), irow(ztop)), out=-out_dir)
            topq = [P(s0, ztop, 0), P(s1, ztop, 0), P(s1, ztop, t), P(s0, ztop, t)]
            along = Vector((1, 0, 0)) if ax == 'x' else Vector((0, 1, 0))
            across = Vector((0, 1, 0)) if ax == 'x' else Vector((1, 0, 0))
            if ztop < h - 1e-6 and rub is not None:
                rub.face(topq, fit_planar(rr, topq, along, across), out=Z)
            else:
                shell.face(topq, map_quad(tr, u0, u1, 0, tr[3]), out=Z)
            if k + 1 < len(cuts) and rub is not None:   # exposed fracture where the next piece is lower
                z2 = cuts[k + 1][2]
                if abs(z2 - ztop) > 1e-6:
                    zl, zh = min(z2, ztop), max(z2, ztop)
                    q = [P(s1, zl, 0), P(s1, zl, t), P(s1, zh, t), P(s1, zh, 0)]
                    d = along * (1 if s1 > s0 else -1) * (1 if z2 < ztop else -1)
                    rub.face(q, fit_planar(rr, q, across, (0, 0, -1)), out=d)
    return shell


def soil_plane(m, tex, region, x0, x1, y0, y1, z, nx=1, ny=1):
    p = m.part(tex, 'soil')
    r = rect(tex, region)
    for i in range(nx):
        for j in range(ny):
            a0, a1 = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
            b0, b1 = y0 + (y1 - y0) * j / ny, y0 + (y1 - y0) * (j + 1) / ny
            q = [Vector((a0, b0, z)), Vector((a1, b0, z)), Vector((a1, b1, z)), Vector((a0, b1, z))]
            p.face(q, fit_planar(r, q, (1, 0, 0), (0, -1, 0)), out=Z)
    return p


def card(part, region_tex, region, c, w, hgt, az, z0, flip=False):
    """Upright cut-out card centred on c (x, y), bottom at z0, running along az (radians)."""
    r = rect(region_tex, region)
    d = Vector((math.cos(az), math.sin(az), 0)) * (w / 2)
    b0 = Vector((c[0], c[1], z0)) - d
    b1 = Vector((c[0], c[1], z0)) + d
    up = Vector((0, 0, hgt))
    uv = map_quad(r, 0, r[2], r[3], 0)
    if flip:
        uv = [uv[1], uv[0], uv[3], uv[2]]
    part.face([b0, b1, b1 + up, b0 + up], uv)


def crossed(part, tex, region, c, w, hgt, z0, az=0.6):
    card(part, tex, region, c, w, hgt, az, z0)
    card(part, tex, region, c, w, hgt, az + math.pi / 2, z0, flip=True)


def chamfer_ring(cx, cy, hx, hy, ch, z):
    pts = [(hx - ch, -hy), (hx, -hy + ch), (hx, hy - ch), (hx - ch, hy),
           (-hx + ch, hy), (-hx, hy - ch), (-hx, -hy + ch), (-hx + ch, -hy)]
    return [Vector((cx + x, cy + y, z)) for x, y in pts]


def lathe(part, profile, n, c=(0, 0), phase=math.pi / 8, close_top=False, ry_scale=1.0, yoff=None):
    """profile [(r, z) ...] bottom to top, rings of n sides; returns the rings."""
    rings = []
    for k, (r, z) in enumerate(profile):
        off = yoff[k] if yoff else 0.0
        rings.append(ring_pts((c[0], c[1] + off), r, r * ry_scale, z, n, phase))
    loft(part, rings, close_top=close_top, centre=Vector((c[0], c[1], 0)))
    return rings


def cylinder_along(part, region_tex, region, a, d, prof, n=6, cap0=True, squash=None):
    """Tube from a along d: prof [(r, s) ...]; U around, V from s = 0 (bottom row) to the end (top row)."""
    r = rect(region_tex, region)
    a = Vector(a)
    d = Vector(d).normalized()
    s1 = d.cross(Z if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    s2 = d.cross(s1).normalized()
    smax = prof[-1][1]
    rings = []
    for k, (rad, s) in enumerate(prof):
        sq = squash[k] if squash else 1.0
        rings.append([a + d * s + s1 * rad * math.cos(2 * math.pi * i / n)
                      + s2 * rad * sq * math.sin(2 * math.pi * i / n) for i in range(n)])
    for k in range(len(rings) - 1):
        c = a + d * (prof[k][1] + prof[k + 1][1]) / 2
        for i in range(n):
            j = (i + 1) % n
            q = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
            fc = sum(q, Vector()) / 4
            v0 = (1 - prof[k][1] / smax) * r[3]
            v1 = (1 - prof[k + 1][1] / smax) * r[3]
            part.face(q, map_quad(r, i * r[2] / n, (i + 1) * r[2] / n, v0, v1), out=fc - c)
    if cap0:
        q = list(rings[0])
        part.face(q, fit_planar(r, q, s1, s2), out=-d)
    return rings


# ---------------------------------------------------------------------------------------------------------
# env_planter_normal / env_planter_poor (10 x 6, origin at the footprint centre, ground z = 0)

PL_HX, PL_HY, PL_H, PL_T = 5.0, 3.0, 2.2, 0.5


def build_planter_normal():
    m = Model('env_planter_normal')
    soil_z = 1.75
    planter_shell(m, 'greenery_stone', 'conc_side', 'conc_top', PL_HX, PL_HY, PL_H, PL_T, soil_z)
    soil_plane(m, 'greenery_stone', 'soil', -PL_HX + PL_T, PL_HX - PL_T, -PL_HY + PL_T, PL_HY - PL_T, soil_z)
    shrub = m.part('greenery_hedge', 'shrub')
    rings = [chamfer_ring(0, 0.1, 2.75, 1.45, 0.6, soil_z), chamfer_ring(0, 0.1, 3.0, 1.65, 0.7, 2.35),
             chamfer_ring(0, 0.1, 3.0, 1.65, 0.7, 3.95), chamfer_ring(0, 0.1, 2.6, 1.3, 0.5, 4.45)]
    loft(shrub, rings, close_top=True, centre=Vector((0, 0.1, 0)))
    ramp_uv(shrub, rect('greenery_hedge', 'ramp'), density=6.0, ao=height_ao(soil_z, 2.9, 0.55), seed=3)
    fl = m.part('greenery_cards', 'flowers')
    crossed(fl, 'greenery_cards', 'flowers', (-3.85, 0.4), 1.5, 1.7, soil_z - 0.05, 0.7)
    crossed(fl, 'greenery_cards', 'flowers', (3.85, -0.3), 1.5, 1.6, soil_z - 0.05, 0.3)
    card(fl, 'greenery_cards', 'flowers', (-1.3, -2.12), 2.5, 1.35, 0.0, soil_z - 0.05)
    card(fl, 'greenery_cards', 'flowers', (1.3, -2.12), 2.5, 1.25, 0.0, soil_z - 0.05, flip=True)
    return m


def build_planter_poor():
    m = Model('env_planter_poor')
    soil_z = 1.2
    pieces = {
        'front': [(-PL_HX, 3.2, PL_H), (3.2, PL_HX, 1.3)],
        'right': [(-PL_HY + PL_T, -1.3, 1.3), (-1.3, PL_HY - PL_T, PL_H)],
    }
    planter_shell(m, 'greenery_stone', 'poor_side', 'poor_top', PL_HX, PL_HY, PL_H, PL_T, soil_z,
                  pieces=pieces, rubble=True)
    soil_plane(m, 'greenery_stone', 'soil_poor', -PL_HX + PL_T, PL_HX - PL_T, -PL_HY + PL_T, PL_HY - PL_T,
               soil_z, nx=2, ny=1)
    weeds = m.part('greenery_cards', 'weeds')
    crossed(weeds, 'greenery_cards', 'weeds', (-3.0, 0.6), 2.4, 2.5, soil_z - 0.1, 0.4)
    crossed(weeds, 'greenery_cards', 'weeds', (-0.6, -1.1), 2.2, 2.1, soil_z - 0.1, 1.1)
    crossed(weeds, 'greenery_cards', 'weeds', (2.5, 1.3), 2.6, 2.8, soil_z - 0.1, 0.2)
    card(weeds, 'greenery_cards', 'litter', (0.4, 2.15), 4.0, 1.0, 0.0, soil_z - 0.05)
    trash = m.part('greenery_cards', 'trash')
    # a green bottle lying half sunk in the dirt, neck toward the broken corner
    cylinder_along(trash, 'greenery_cards', 'glass', (0.3, -0.5, soil_z + 0.12),
                   (math.cos(0.45), -math.sin(0.45), 0.22),
                   [(0.3, 0.0), (0.3, 1.05), (0.13, 1.4), (0.12, 1.85)], n=6)
    # crushed can
    cylinder_along(trash, 'greenery_cards', 'can', (-2.1, -1.7, soil_z + 0.12), (0.2, 1.0, 0.0),
                   [(0.26, 0.0), (0.24, 0.3), (0.26, 0.6)], n=6, squash=[1.0, 0.45, 1.0])
    # crumpled newspaper
    pr = rect('greenery_cards', 'paper')
    centre = Vector((1.6, 0.2, soil_z))
    base = [centre + Vector((0.6 * math.cos(a), 0.45 * math.sin(a), 0.02))
            for a in [i * 2 * math.pi / 5 + 0.3 for i in range(5)]]
    apex = centre + Vector((0.1, -0.05, 0.5))
    for i in range(5):
        tri = [base[i], base[(i + 1) % 5], apex]
        trash.face(tri, fit_planar(pr, tri, (1, 0, 0), (0, -1, 0)), out=sum(tri, Vector()) / 3 - centre)
    # the broken-off corner chunk on the ground
    rr = rect('greenery_cards', 'rubble')
    chunk = m.part('greenery_cards', 'chunk')
    cx, cy, a = 6.0, -3.9, 0.4

    def rot(x, y, z):
        return Vector((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a), z))
    b = [rot(-0.6, -0.35, 0), rot(0.6, -0.35, 0), rot(0.6, 0.35, 0), rot(-0.6, 0.35, 0)]
    tp = [rot(-0.55, -0.3, 0.5), rot(0.5, -0.25, 0.3), rot(0.45, 0.3, 0.35), rot(-0.5, 0.3, 0.6)]
    for i in range(4):
        j = (i + 1) % 4
        q = [b[i], b[j], tp[j], tp[i]]
        fc = sum(q, Vector()) / 4
        chunk.face(q, fit_planar(rr, q, (b[j] - b[i]).normalized(), (0, 0, -1)), out=fc - Vector((cx, cy, 0.2)))
    chunk.face(tp, fit_planar(rr, tp, (1, 0, 0), (0, -1, 0)), out=Z)
    return m


# ---------------------------------------------------------------------------------------------------------
# env_planter_rich: formal parterre (14 x 9). Marble curb, gilded fence and corner posts with ball finials,
# clipped hedge frame + diagonals + ring, red and gold beds in the four compartments, gold urn of red
# flowers on a marble pedestal.

def hedge_box(part, pts_bottom, pts_top):
    """Prism between two parallel polygons (CCW from above), sides + top."""
    n = len(pts_bottom)
    c = sum(pts_bottom, Vector()) / n
    for i in range(n):
        j = (i + 1) % n
        q = [pts_bottom[i], pts_bottom[j], pts_top[j], pts_top[i]]
        fc = sum(q, Vector()) / 4
        part.face(q, out=Vector((fc.x - c.x, fc.y - c.y, 0)))
    part.face(list(pts_top), out=Z)


def build_planter_rich():
    m = Model('env_planter_rich')
    HX, HY, H, T = 7.0, 4.5, 0.8, 0.6
    bed_z = 0.9
    planter_shell(m, 'greenery_stone', 'marble_side', 'marble_top', HX, HY, H, T, 0.4, density=4.6)
    ix, iy = HX - T, HY - T                      # 6.4, 3.9: hedge frame sits against the curb
    fx, fy = ix - 0.7, iy - 0.7                  # 5.7, 3.2: bed rectangle
    hed = m.part('greenery_hedge', 'hedges')
    # frame: four slabs, outer faces only above the curb
    ftop = 1.5
    frame = [((-ix, -iy), (ix, -iy + 0.7)), ((-ix, iy - 0.7), (ix, iy)),
             ((-ix, -iy + 0.7), (-fx, iy - 0.7)), ((fx, -iy + 0.7), (ix, iy - 0.7))]
    for (x0, y0), (x1, y1) in frame:
        P = lambda x, y, z: Vector((x, y, z))
        bot = [P(x0, y0, 0.75), P(x1, y0, 0.75), P(x1, y1, 0.75), P(x0, y1, 0.75)]   # starts inside the curb
        top = [P(x0, y0, ftop), P(x1, y0, ftop), P(x1, y1, ftop), P(x0, y1, ftop)]
        hedge_box(hed, bot, top)
    # ring around the urn
    n, ro, ri, rtop = 8, 1.75, 1.15, 1.4
    o0, o1 = ring_pts((0, 0), ro, ro, bed_z, n, math.pi / 8), ring_pts((0, 0), ro, ro, rtop, n, math.pi / 8)
    i0, i1 = ring_pts((0, 0), ri, ri, bed_z, n, math.pi / 8), ring_pts((0, 0), ri, ri, rtop, n, math.pi / 8)
    for i in range(n):
        j = (i + 1) % n
        mid = (o0[i] + o0[j]) / 2
        hed.face([o0[i], o0[j], o1[j], o1[i]], out=Vector((mid.x, mid.y, 0)))
        hed.face([o1[i], o1[j], i1[j], i1[i]], out=Z)
        hed.face([i0[i], i0[j], i1[j], i1[i]], out=-Vector((mid.x, mid.y, 0)))
    # diagonals from the ring to the bed corners
    dtop, hw = 1.3, 0.28
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        d = Vector((sx * fx, sy * fy, 0)).normalized()
        s = Vector((-d.y, d.x, 0))
        a = d * (ro - 0.15)
        b = Vector((sx * fx, sy * fy, 0)) - d * 0.2
        for side_sign in (1, -1):
            q = [a + s * hw * side_sign, b + s * hw * side_sign, b + s * hw * side_sign, a + s * hw * side_sign]
            q = [q[0] + Vector((0, 0, bed_z)), q[1] + Vector((0, 0, bed_z)),
                 q[2] + Vector((0, 0, dtop)), q[3] + Vector((0, 0, dtop))]
            hed.face(q, out=s * side_sign)
        hed.face([a + s * hw + Vector((0, 0, dtop)), b + s * hw + Vector((0, 0, dtop)),
                  b - s * hw + Vector((0, 0, dtop)), a - s * hw + Vector((0, 0, dtop))], out=Z)
    ramp_uv(hed, rect('greenery_hedge', 'ramp'), density=6.0, ao=height_ao(bed_z, 1.45, 0.5), seed=5, gain=1.05)
    # flower beds: four triangles from the centre, front/back red, left/right gold
    beds = m.part('greenery_hedge', 'beds')
    c0 = Vector((0, 0, bed_z))
    corners = [Vector((fx, -fy, bed_z)), Vector((fx, fy, bed_z)), Vector((-fx, fy, bed_z)), Vector((-fx, -fy, bed_z))]
    red, gold = rect('greenery_hedge', 'flowers_red'), rect('greenery_hedge', 'flowers_gold')
    # world-scaled (about 5.5 px/unit both ways) so the flower heads keep their shape.
    # front (-y) and back (+y): one triangle each, U along x, the dark edge rows at the hedge frame
    k = 5.5
    for a_, b_, sgn in ((corners[3], corners[0], -1), (corners[1], corners[2], 1)):
        tri = [a_, b_, c0]
        beds.face(tri, map_planar(red, tri, (1, 0, 0), (0, sgn, 0), (-fx, 0, 0), k, 16 / fy), out=Z)
    # left/right: split at half depth so the 16 px rows cover each piece
    for a_, b_ in ((corners[0], corners[1]), (corners[2], corners[3])):
        ma, mb = a_.lerp(c0, 0.5), b_.lerp(c0, 0.5)
        sx = 1 if a_.x > 0 else -1
        ax_v = (-sx, 0, 0)
        quad = [a_, b_, mb, ma]
        beds.face(quad, map_planar(gold, quad, (0, 1, 0), ax_v, (sx * fx, -fy, 0), k, 16 / (fx * 0.5)), out=Z)
        tri = [ma, mb, c0]
        beds.face(tri, map_planar(gold, tri, (0, 1, 0), ax_v, (sx * fx * 0.5, -fy, 0), k, 16 / (fx * 0.5)), out=Z)
    # marble pedestal + gold urn with a mound of red flowers
    ped = m.part('greenery_stone', 'pedestal')
    ms, mt = rect('greenery_stone', 'marble_side'), rect('greenery_stone', 'marble_top')
    faces = box_faces(ped, -0.5, 0.5, -0.5, 0.5, bed_z, 1.75, skip=('bottom',))
    for k, f in faces.items():
        if k == 'top':
            f[1] = fit_planar(mt, f[0], (1, 0, 0), (0, -1, 0))
        else:
            f[1] = map_quad(ms, 4, 4 + 1.0 * 12, ms[3], 0)
    urn = m.part('greenery_gold', 'urn')
    prof = [(0.36, 1.75), (0.22, 2.0), (0.62, 2.4), (0.78, 2.85), (0.48, 3.35), (0.7, 3.6)]
    rings = lathe(urn, prof, 8)
    # finials: gold balls on the fence posts (ramp too)
    posts = m.part('greenery_gold', 'posts')
    px, py = HX - 0.18, HY - 0.18
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        cx, cy = sx * px, sy * py
        box_faces(posts, cx - 0.2, cx + 0.2, cy - 0.2, cy + 0.2, H, 2.45, skip=('bottom',))
        top, rb = Vector((cx, cy, 2.45 + 0.6)), 0.3
        mid = [Vector((cx + rb * math.cos(a), cy + rb * math.sin(a), 2.45 + 0.3)) for a in
               [math.pi / 4 + i * math.pi / 2 for i in range(4)]]
        low = Vector((cx, cy, 2.45))
        for i in range(4):
            j = (i + 1) % 4
            mc = (mid[i] + mid[j]) / 2
            posts.face([mid[i], mid[j], top], out=mc - Vector((cx, cy, 2.75)) + Vector((0, 0, 0.3)))
            posts.face([mid[j], mid[i], low], out=mc - Vector((cx, cy, 2.75)) - Vector((0, 0, 0.3)))
    gilt = rect('greenery_gold', 'gilt')
    ramp_uv(urn, gilt, density=8.0, seed=7)
    ramp_uv(posts, gilt, density=8.0, seed=8)
    mound = m.part('greenery_hedge', 'mound')
    apex = Vector((0, 0, 3.95))
    for i in range(8):
        j = (i + 1) % 8
        tri = [rings[-1][i], rings[-1][j], apex]
        mound.face(tri, fit_planar(red, tri, (1, 0, 0), (0, -1, 0)), out=Z)
    # gilded fence: railing cards along the curb, 0.18 in from its outer edge
    rail = rect('greenery_gold', 'railing')
    fence = m.part('greenery_gold', 'fence')
    fz0, fz1 = H, 2.15
    fxx, fyy = HX - 0.18, HY - 0.18
    runs = [((-fxx, -fyy), (0, -fyy)), ((0, -fyy), (fxx, -fyy)), ((fxx, -fyy), (fxx, 0)), ((fxx, 0), (fxx, fyy)),
            ((fxx, fyy), (0, fyy)), ((0, fyy), (-fxx, fyy)), ((-fxx, fyy), (-fxx, 0)), ((-fxx, 0), (-fxx, -fyy))]
    for (x0, y0), (x1, y1) in runs:
        L = math.hypot(x1 - x0, y1 - y0)
        upx = min(64.0, L * 9.4)
        fence.face([Vector((x0, y0, fz0)), Vector((x1, y1, fz0)), Vector((x1, y1, fz1)), Vector((x0, y0, fz1))],
                   map_quad(rail, 0, upx, 24, 0, inset=0.01))
    return m


# ---------------------------------------------------------------------------------------------------------
# env_bush_rich: gilded pot, clipped hedge bust of the leader (peaked cap, moustache, gold epaulettes)

def build_bush_rich():
    m = Model('env_bush_rich')
    gilt = rect('greenery_gold', 'gilt')
    pot = m.part('greenery_gold', 'pot')
    prof = [(1.05, 0.0), (1.45, 1.55), (1.82, 2.0), (1.55, 2.2)]
    prings = lathe(pot, prof, 8)
    ramp_uv(pot, gilt, density=8.0, ao=height_ao(0.0, 0.9, 0.6), seed=21)
    hedge = rect('greenery_hedge', 'ramp')
    soil = m.part('greenery_hedge', 'soil')
    soil.face([Vector((p.x, p.y, 2.1)) for p in prings[-1]],
              fit_planar((hedge[0], hedge[1] + hedge[3] - 6, hedge[2], 5), prings[-1], (1, 0, 0), (0, -1, 0)), out=Z)
    bust = m.part('greenery_hedge', 'bust')
    n = 8
    ph = math.pi / 8
    sh = [(1.15, 0.75, 2.1, 0.0), (1.85, 1.0, 2.9, 0.0), (1.92, 0.95, 3.6, 0.0), (0.72, 0.58, 4.15, 0.0)]
    sh_r = [ring_pts((0, yo), rx, ry, z, n, ph) for rx, ry, z, yo in sh]
    loft(bust, sh_r, centre=Vector((0, 0, 0)))
    hd = [(0.48, 0.48, 4.1, 0.0), (0.84, 0.88, 4.75, -0.04), (0.88, 0.92, 5.4, -0.02), (0.84, 0.88, 5.9, 0.0)]
    hd_r = [ring_pts((0, yo), rx, ry, z, n, ph) for rx, ry, z, yo in hd]
    loft(bust, hd_r, centre=Vector((0, 0, 0)))
    # cap: band, flaring crown, flat top
    cap = [(0.88, 0.92, 5.85, 0.0), (0.9, 0.94, 6.25, 0.0), (1.24, 1.32, 6.78, -0.12)]
    cap_r = [ring_pts((0, yo), rx, ry, z, n, ph) for rx, ry, z, yo in cap]
    loft(bust, cap_r, close_top=True, centre=Vector((0, 0, 0)))
    # peak (visor) on the -Y side
    angs = [math.radians(a) for a in (-155, -118, -62, -25)]
    inner = [Vector((0.92 * math.cos(a), 0.96 * math.sin(a), 5.89)) for a in angs]
    outer = [Vector((1.3 * math.cos(a), 1.55 * math.sin(a) - 0.05, 5.72)) for a in angs]
    lower = [p - Vector((0, 0, 0.1)) for p in outer]
    under = [p - Vector((0, 0, 0.08)) for p in inner]
    for i in range(3):
        bust.face([inner[i], inner[i + 1], outer[i + 1], outer[i]], out=Z)
        bust.face([under[i], lower[i], lower[i + 1], under[i + 1]], out=-Z)
        fc = (outer[i] + outer[i + 1]) / 2
        bust.face([lower[i], lower[i + 1], outer[i + 1], outer[i]], out=Vector((fc.x, fc.y, 0)))
    # moustache: a clipped bar across the upper lip, ends drooping and wrapping round the face
    stache = m.part('greenery_hedge', 'moustache')
    xs = [-0.78, -0.26, 0.26, 0.78]
    zc = 4.86
    def face_y(x, z=zc):
        return -0.9 * math.sqrt(max(0.0, 1 - (x / 0.87) ** 2)) - 0.03
    rows = []
    for x in xs:
        droop = -0.3 if abs(x) > 0.5 else 0.0
        yb = face_y(min(abs(x), 0.8) * (1 if x > 0 else -1))
        yf = yb - 0.36
        z0 = zc + droop
        rows.append((Vector((x, yb + 0.06, z0 + 0.2)), Vector((x * 1.05, yf, z0 + 0.12)),
                     Vector((x * 1.05, yf, z0 - 0.15)), Vector((x, yb + 0.06, z0 - 0.22))))
    for i in range(3):
        a, b = rows[i], rows[i + 1]
        stache.face([a[0], a[1], b[1], b[0]], out=Vector((0, -0.4, 1)))
        stache.face([a[1], a[2], b[2], b[1]], out=Vector((0, -1, 0)))
        stache.face([a[2], a[3], b[3], b[2]], out=Vector((0, -0.4, -1)))
    stache.face([rows[0][0], rows[0][1], rows[0][2], rows[0][3]], out=Vector((-1, 0, 0)))
    stache.face([rows[-1][0], rows[-1][1], rows[-1][2], rows[-1][3]], out=Vector((1, 0, 0)))
    ramp_uv(stache, hedge, density=6.0, seed=29, gain=0.42)
    # nose
    ny = face_y(0, 5.2)
    nb = [Vector((-0.2, ny + 0.06, 5.06)), Vector((0.2, ny + 0.06, 5.06)), Vector((0.0, ny + 0.08, 5.5))]
    tip = Vector((0, ny - 0.36, 5.08))
    for i in range(3):
        tri = [nb[i], nb[(i + 1) % 3], tip]
        fc = sum(tri, Vector()) / 3
        bust.face(tri, out=fc - Vector((0, ny + 0.1, 5.4)))

    def bust_ao(p):
        a = height_ao(2.1, 2.9, 0.6)(p)
        if p.y < -0.45 and 5.2 < p.z < 5.85:      # eye band under the peak
            a *= 0.5
        elif p.y < -0.4 and 4.5 < p.z <= 5.2:     # cheeks and nose clipped lighter than the moustache
            a *= 1.3
        return a
    ramp_uv(bust, hedge, density=6.0, ao=bust_ao, seed=23)
    # gold: epaulettes and cap badge
    trim = m.part('greenery_gold', 'trim')
    band = rect('greenery_gold', 'band')
    for sx in (1, -1):
        x0, x1 = (1.05, 1.82) if sx > 0 else (-1.82, -1.05)
        f = box_faces(trim, x0, x1, -0.42, 0.42, 3.72, 4.0, skip=('bottom', '+y', '-x' if sx > 0 else '+x'))
        for k, fc in f.items():
            if k == 'top':
                fc[1] = map_quad(gilt, 4 + 16 * (sx > 0), 16 + 16 * (sx > 0), 4, 1)
            else:
                fc[1] = map_quad(band, 0, 14, 16, 0)
    by = -0.94
    trim.face([Vector((0, by - 0.02, 5.87)), Vector((0.2, by, 6.05)), Vector((0, by - 0.02, 6.23)),
               Vector((-0.2, by, 6.05))], map_quad(gilt, 20, 28, 6, 0), out=(0, -1, 0))
    return m


# ---------------------------------------------------------------------------------------------------------
# Driver and previews

BUILDERS = {
    'env_tree_rich': build_tree_rich,
    'env_planter_poor': build_planter_poor,
    'env_planter_normal': build_planter_normal,
    'env_planter_rich': build_planter_rich,
    'env_bush_rich': build_bush_rich,
}


def render_alone(name, objs, outdir):
    """Workbench FLAT light (the game's single ambient light), textured, back faces culled."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x, sc.render.resolution_y = 640, 640
    sh = sc.display.shading
    sh.light = 'FLAT'
    sh.color_type = 'TEXTURE'
    sh.show_backface_culling = True
    sh.background_type = 'WORLD'
    world = bpy.data.worlds.get('bg') or bpy.data.worlds.new('bg')
    world.color = (0.62, 0.72, 0.84)
    sc.world = world
    sc.view_settings.view_transform = 'Standard'
    mn, mx = dt.bounds(objs)
    c = (mn + mx) / 2
    span = max((mx - mn).x, (mx - mn).y, (mx - mn).z)
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = span * 1.25
    cam_data.clip_end = 1000
    views = {'3q': Vector((0.62, -1.0, 0.55)), 'street': Vector((0.0, -1.0, 0.47)), 'top': Vector((0, -0.001, 1))}
    for v, d in views.items():
        d = d.normalized()
        cam.location = c + d * (span * 4 + 20)
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(outdir, f'{name}_flat_{v}.png')
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    preview = None
    if '--preview' in argv:
        i = argv.index('--preview')
        preview = os.path.abspath(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    names = argv or list(BUILDERS)
    for name in names:
        dt.reset()
        _MATS.clear()
        m = BUILDERS[name]()
        budget = LAYOUT['models'][name]['budget_tris']
        ob = m.build()
        tris = dt.tri_count([ob])
        mn, mx = dt.bounds([ob])
        per_part = {}
        for p in m.parts:
            per_part[p.name] = per_part.get(p.name, 0) + sum(len(f[0]) - 2 for f in p.faces)
        print(f'MODEL {name}: {tris} tris (budget {budget}) bounds {tuple(round(v, 2) for v in mn)} '
              f'{tuple(round(v, 2) for v in mx)} parts {per_part}')
        if tris > budget:
            raise SystemExit(f'{name} over budget: {tris} > {budget}')
        if preview:
            os.makedirs(preview, exist_ok=True)
            render_alone(name, [ob], preview)
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(preview, f'{name}.blend'))
        dt.export_glb([ob], os.path.join(ROOT, LAYOUT['models'][name]['glb']))


main()
