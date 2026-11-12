"""Street vehicles (public/models/vehicles/*.glb): car_sedan (normal tier), car_limo (rich tier),
car_jeep_military (security budget >= 8) and car_ambulance (health budget >= 8).

    python tools/texgen/vehicles.py                      # textures first (they are embedded in the GLBs)
    $env:TEMP = "$PWD\\build\\visual_gaps\\vehicles\\tmp"; $env:TMP = $env:TEMP
    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/vehicles.py -- [car_sedan|car_limo|car_jeep_military|car_ambulance ...] [--no-preview]

No model name rebuilds all four. The tier lineup (build/visual_gaps/vehicles/vehicles_tiers.png):

    & "<blender>" -b --factory-startup --python tools/blender/vehicles.py -- --lineup
    & "<blender>" -b --factory-startup --python tools/blender/tier_preview.py -- build/visual_gaps/vehicles/vehicles_tiers.png ^
        poor=build/visual_gaps/vehicles/scratch/junker_ingame.glb normal=public/models/vehicles/car_sedan.glb ^
        rich=public/models/vehicles/car_limo.glb --views 3q,front,top --person
    python tools/blender/label_sheet.py build/visual_gaps/vehicles/vehicles_tiers.png "<title>" ^
        build/visual_gaps/vehicles/vehicles_tiers_3q.png build/visual_gaps/vehicles/vehicles_tiers_front.png ^
        build/visual_gaps/vehicles/vehicles_tiers_top.png

`--lineup` writes a scratch junker GLB as the game shows it (see junker_for_lineup). Reads tools/texgen/vehicles_layout.json (the contract shared with the texture
script): every dimension, feature position, texture rect and world-to-pixel frame comes from it.

Built in game world units, Blender Z-up, nose +X, car's left +Y, ground at z = 0, origin under the middle
of the car. Each GLB is a root node `car_<name>` (scale 0.001 like the street GLBs, plus a +90 degree turn
about the up axis) with five children: `body`, `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` (l = +Y).
Each wheel's origin is on its hub with no rotation of its own. The children are stored in the root's
turned frame, so in the scene the nose still points +X while the root-local X axis is the AXLE: three.js
`wheel.rotation.x += distance / radius` rolls them forward, exactly like the junker's wheels in Vehicles.tsx.

Materials are named after their textures (car_sedan_body, car_sedan_lights, car_sedan_wheels, car_limo_*);
car_sedan_body is grayscale for the per-car tint, car_limo_* are fixed colour.

With previews (default) it re-imports each GLB and checks its nodes, tris and bounds, parses the GLB to check
the root turn and the wheel nodes, and renders build/visual_gaps/vehicles/<car>_*.png in Workbench with FLAT
light (what the game's single ambient light looks like) and back-face culling on.
"""
import json
import math
import os
import struct
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dt_common as dt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAYOUT = os.path.join(ROOT, 'tools', 'texgen', 'vehicles_layout.json')
MODELS = os.path.join(ROOT, 'public', 'models', 'vehicles')
PREVIEW = os.path.join(ROOT, 'build', 'visual_gaps', 'vehicles')


# ---------------------------------------------------------------------------------------------------
# Textures and UVs (contract rects, frames)

class Tex:
    def __init__(self, name, spec):
        self.name = name
        self.W, self.H = spec['size']
        self.regions = spec['regions']
        self.file = os.path.join(ROOT, spec['file'])

    def _rect(self, region):
        return self.regions[region]['rect']

    def _uv(self, px, py):
        return (px / self.W, 1.0 - py / self.H)

    def planar(self, region, a, b, inset=0.5):
        """World values a (along the frame's u axis) and b (its v axis) to UV, clamped inside the rect."""
        x, y, w, h = self._rect(region)
        fu, fv = self.regions[region]['frame']['u'], self.regions[region]['frame']['v']
        tu = (a - fu[1]) / (fu[2] - fu[1])
        tv = (b - fv[1]) / (fv[2] - fv[1])
        return self._uv(x + min(max(tu * w, inset), w - inset), y + min(max(tv * h, inset), h - inset))

    def unit(self, region, tu, tv, inset=0.5):
        """Normalised rect coordinates (tv = 0 at the rect's top) to UV."""
        x, y, w, h = self._rect(region)
        return self._uv(x + min(max(tu * w, inset), w - inset), y + min(max(tv * h, inset), h - inset))

    def disc(self, region, c, s, inset=0.6):
        x, y, w, h = self._rect(region)
        R = w / 2 - inset
        return self._uv(x + w / 2 + c * R, y + h / 2 - s * R)


def newell(pts):
    n = Vector((0, 0, 0))
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


class Builder:
    """Collects faces (own vertices, per-loop UVs, flat) and flips each to face its `out` hint."""

    def __init__(self, mats):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.mats = list(mats)
        self.count = 0

    def face(self, pts, uvs, mat, out):
        pts = [Vector(p) for p in pts]
        uvs = list(uvs)
        if newell(pts).dot(Vector(out)) < 0:
            pts, uvs = pts[::-1], uvs[::-1]
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        f.material_index = self.mats.index(mat)
        f.smooth = False
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        self.count += len(pts) - 2
        return f

    def finish(self, name, location=(0, 0, 0)):
        ob = dt.mesh_object(name, self.bm, [bpy.data.materials[m] for m in self.mats])
        ob.location = location
        return ob


# ---------------------------------------------------------------------------------------------------
# Geometry from the contract

def top_z(g, x):
    pts = sorted(g['top_z'])
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        if x <= x1:
            return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def arch_z(g, x):
    """Body underside height at x: the sill, rising through each wheel arch's trapezoid notch."""
    a = g['arch']
    for ax in g['axles']:
        d = abs(x - ax)
        if d <= a['half_high'] + 1e-6:
            return a['z_top']
        if d < a['half_low']:
            t = (a['half_low'] - d) / (a['half_low'] - a['half_high'])
            return g['z_sill'] + (a['z_top'] - g['z_sill']) * t
    return g['z_sill']


def stations(g):
    xs = {g['x_nose'], g['x_tail']}
    if 'cabin' in g:
        xs |= set(g['cabin']['x_bottom'])
        if 'split_x' in g['cabin']:
            xs.add(g['cabin']['split_x'])
    if 'tub' in g:
        xs |= set(g['tub']['x'])
    a = g['arch']
    for ax in g['axles']:
        xs |= {ax + a['half_low'], ax + a['half_high'], ax - a['half_high'], ax - a['half_low']}
    return sorted((round(x, 5) for x in xs), reverse=True)


def section(g, x):
    """Cross-section points at station x for each side s: A (sill), B (waist), C (shoulder)."""
    hw = g['half_width']
    k = (hw - g['nose_taper']) / hw if x in (g['x_nose'], g['x_tail']) else 1.0
    zb, zt = arch_z(g, x), top_z(g, x)
    out = {}
    for s in (1, -1):
        a = Vector((x, s * (hw - g['sill_inset']) * k, zb))
        c = Vector((x, s * (hw - g['shoulder_inset']) * k, zt))
        out[s] = (a, c) if g.get('z_waist') is None else (a, Vector((x, s * hw * k, g['z_waist'])), c)
    return out


def side_region(car, x):
    if car == 'car_limo':
        return 'side_front' if x >= 0 else 'side_rear'
    return 'side'


def top_region(car, g, x):
    if car != 'car_limo':
        return 'top'
    c = g['cabin']['x_bottom']
    if x > c[0] - 1e-4:
        return 'hood'
    if x < c[1] + 1e-4:
        return 'trunk'
    return 'roof'


def build_body(car, g, tb, tl_, tw):
    """Lower body (lofted sections with arch notches, nose and tail caps), then whatever parts the contract
    lists: cabin, bumpers, mirrors, flags, ornament; the jeep's tub and gear; the ambulance's beacons."""
    B = Builder([tb.name, tl_.name] + ([tw.name] if 'spare' in g else []))
    xs = stations(g)
    secs = [section(g, x) for x in xs]
    # ---- lower body bands
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        S0, S1 = secs[i], secs[i + 1]
        xm = 0.5 * (x0 + x1)
        sreg = side_region(car, xm)
        for s in (1, -1):
            for j in range(len(S0[s]) - 1):                    # A->B, B->C (A->C without a waist)
                q = [S0[s][j], S1[s][j], S1[s][j + 1], S0[s][j + 1]]
                B.face(q, [tb.planar(sreg, p.x, p.z) for p in q], tb.name, (0, s, 0))
        open_top = 'tub' in g and g['tub']['x'][1] < xm < g['tub']['x'][0]
        covered = g.get('cabin_covers_deck') and xm < g['cabin']['x_bottom'][0]
        if not (open_top or covered):
            q = [S0[1][-1], S0[-1][-1], S1[-1][-1], S1[1][-1]]  # top band
            treg = top_region(car, g, xm)
            B.face(q, [tb.planar(treg, p.x, p.y) for p in q], tb.name, (0, 0, 1))
        if S0[1][0].z > g['z_sill'] + 1e-3 or S1[1][0].z > g['z_sill'] + 1e-3:   # wheel-well ceilings
            q = [S0[1][0], S0[-1][0], S1[-1][0], S1[1][0]]
            uv = [tb.unit('dark', 0.2 + 0.6 * (k in (1, 2)), 0.2 + 0.6 * (k in (2, 3))) for k in range(4)]
            B.face(q, uv, tb.name, (0, 0, -1))
    # ---- nose and tail caps (lights texture)
    for idx, reg, out in ((0, 'nose', (1, 0, 0)), (-1, 'tail', (-1, 0, 0))):
        S = secs[idx]
        ring = list(S[-1]) + list(S[1])[::-1]
        B.face(ring, [tl_.planar(reg, p.y, p.z) for p in ring], tl_.name, out)
    if 'cabin' in g:
        build_cabin(car, g, B, tb, tl_)
    if 'bumper' in g:
        for front in (True, False):
            build_bumper(g, B, tl_, front)
    if 'mirror' in g:
        build_mirrors(car, g, B, tb, tl_)
    if 'tub' in g:
        build_tub(g, B, tb)
        build_windscreen(g, B, tb)
        build_seats(g, B, tb)
        build_roll_bar(g, B, tl_)
        build_gun(g, B, tl_)
        build_spare(g, B, tw)
        build_jerry(g, B, tl_)
        build_bumper_bar(g, B, tl_)
        build_fenders(g, B, tb)
    if 'beacons' in g:
        build_beacons(g, B, tl_, g['cabin']['z_top'])
    if 'flags' in g:
        build_flags(g, B, tl_)
    if 'ornament' in g:
        build_ornament(g, B, tl_)
    return B


def build_ornament(g, B, tl_):
    """Gilt pyramid on the nose of the hood (four faces, no base)."""
    o = g['ornament']
    x, hs = o['x'], o['half']
    z = top_z(g, x) - 0.01
    apex = Vector((x, 0, z + o['h']))
    base = [Vector((x + hs, 0, z)), Vector((x, hs, z)), Vector((x - hs, 0, z)), Vector((x, -hs, z))]
    for i in range(4):
        p, q = base[i], base[(i + 1) % 4]
        B.face([p, q, apex], [tl_.unit('gold', 0.15, 0.85), tl_.unit('gold', 0.85, 0.85), tl_.unit('gold', 0.4, 0.15)],
               tl_.name, (p + q) / 2 - Vector((x, 0, z)) + Vector((0, 0, 0.03)))


def build_cabin(car, g, B, tb, tl_):
    c = g['cabin']
    (xbf, xbr), (xtf, xtr) = c['x_bottom'], c['x_top']
    zb, zt, hb, ht = c['z_bottom'], c['z_top'], c['half_bottom'], c['half_top']
    cuts_b, cuts_t = [xbf, xbr], [xtf, xtr]
    if 'split_x' in c:
        cuts_b.insert(1, c['split_x'])
        cuts_t.insert(1, c['split_x'])
    for s in (1, -1):
        for i in range(len(cuts_b) - 1):
            q = [Vector((cuts_b[i], s * hb, zb)), Vector((cuts_b[i + 1], s * hb, zb)),
                 Vector((cuts_t[i + 1], s * ht, zt)), Vector((cuts_t[i], s * ht, zt))]
            reg = side_region(car, 0.25 * sum(p.x for p in q))
            B.face(q, [tb.planar(reg, p.x, p.z) for p in q], tb.name, (0, s, 0.3))
    roof = [Vector((xtf, ht, zt)), Vector((xtf, -ht, zt)), Vector((xtr, -ht, zt)), Vector((xtr, ht, zt))]
    rreg = 'roof' if car == 'car_limo' else 'top'
    B.face(roof, [tb.planar(rreg, p.x, p.y) for p in roof], tb.name, (0, 0, 1))
    glass_tex = tl_ if car == 'car_limo' else tb
    ws = [Vector((xbf, -hb, zb)), Vector((xbf, hb, zb)), Vector((xtf, ht, zt)), Vector((xtf, -ht, zt))]
    slant = [0, 0, 1, 1]
    B.face(ws, [glass_tex.planar('windshield', p.y, sl) for p, sl in zip(ws, slant)], glass_tex.name, (1, 0, 0.6))
    rw = [Vector((xbr, hb, zb)), Vector((xbr, -hb, zb)), Vector((xtr, -ht, zt)), Vector((xtr, ht, zt))]
    rreg = g.get('rear_region', 'rear_window')
    B.face(rw, [glass_tex.planar(rreg, p.y, sl) for p, sl in zip(rw, slant)], glass_tex.name, (-1, 0, 0.6))


def build_bumper(g, B, tl_, front):
    """Chrome bumper wrapping round the corners: outer faces, top faces, end faces (no back or bottom)."""
    b = g['bumper']
    reg = b.get('region', 'chrome')
    sx = 1 if front else -1
    hw, xo, xb, wrap = b['half_width'], b['x_outer'], b['x_body'], b['wrap_x']
    z0, z1 = b['z']
    plan = [(xb - wrap, hw), (xo - 0.12, hw - 0.06), (xo, hw - 0.42), (xo, -(hw - 0.42)),
            (xo - 0.12, -(hw - 0.06)), (xb - wrap, -hw)]
    plan = [Vector((sx * px, py, 0)) for px, py in plan]
    inner = Vector((sx * (xb - 1.5), 0, 0))
    seg_n = []
    for p, q in zip(plan, plan[1:]):
        d = q - p
        n = Vector((d.y, -d.x, 0)).normalized()
        if n.dot((p + q) / 2 - inner) < 0:
            n = -n
        seg_n.append(n)
    vert_n = [seg_n[0]] + [(a + b_).normalized() for a, b_ in zip(seg_n, seg_n[1:])] + [seg_n[-1]]
    depth = 0.24
    inner_pts = [p - n * depth for p, n in zip(plan, vert_n)]
    lens = [0.0]
    for p, q in zip(plan, plan[1:]):
        lens.append(lens[-1] + (q - p).length)
    tus = [v / lens[-1] for v in lens]
    up = Vector((0, 0, 1))
    for i in range(len(plan) - 1):
        p, q, n = plan[i], plan[i + 1], seg_n[i]
        quad = [p + up * z0, q + up * z0, q + up * z1, p + up * z1]
        uv = [tl_.unit(reg, tus[i], 1), tl_.unit(reg, tus[i + 1], 1),
              tl_.unit(reg, tus[i + 1], 0), tl_.unit(reg, tus[i], 0)]
        B.face(quad, uv, tl_.name, n)
        quad = [p + up * z1, q + up * z1, inner_pts[i + 1] + up * z1, inner_pts[i] + up * z1]
        uv = [tl_.unit(reg, tus[i], 0.06), tl_.unit(reg, tus[i + 1], 0.06),
              tl_.unit(reg, tus[i + 1], 0.0), tl_.unit(reg, tus[i], 0.0)]
        B.face(quad, uv, tl_.name, (0, 0, 1))
    for k in (0, -1):
        p, q = plan[k], inner_pts[k]
        quad = [p + up * z0, q + up * z0, q + up * z1, p + up * z1]
        uv = [tl_.unit(reg, 0.1, 0.8), tl_.unit(reg, 0.2, 0.8),
              tl_.unit(reg, 0.2, 0.2), tl_.unit(reg, 0.1, 0.2)]
        B.face(quad, uv, tl_.name, (-sx, 0, 0))


def box_faces(B, centre, size, faces, mat_for, uv_for):
    """Axis-aligned box faces by name (+x, -x, +y, -y, +z, -z)."""
    c, h = Vector(centre), Vector(size) / 2
    corners = {}
    for key, (axis, sgn) in {'+x': (0, 1), '-x': (0, -1), '+y': (1, 1), '-y': (1, -1), '+z': (2, 1), '-z': (2, -1)}.items():
        if key not in faces:
            continue
        o = [0, 1, 2]
        o.remove(axis)
        a, b = o
        pts = []
        for da, db in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            v = Vector(c)
            v[axis] += sgn * h[axis]
            v[a] += da * h[a]
            v[b] += db * h[b]
            pts.append(v)
        n = [0, 0, 0]
        n[axis] = sgn
        B.face(pts, uv_for(key), mat_for(key), n)
        corners[key] = pts


def build_mirrors(car, g, B, tb, tl_):
    m = g['mirror']
    sx, sy, sz = m['size']
    hw = g['half_width'] - g['shoulder_inset']
    for s in (1, -1):
        centre = (m['x'], s * (hw + sy / 2 - 0.04), m['z'] + sz / 2)
        outer = '+y' if s > 0 else '-y'
        if car == 'car_limo':
            mat = lambda k: tl_.name
            uv = lambda k: [tl_.unit('chrome', u, v) for u, v in ((0.3, 0.7), (0.5, 0.7), (0.5, 0.2), (0.3, 0.2))]
        else:
            mat = lambda k: tl_.name if k == '-x' else tb.name
            uv = lambda k: ([tl_.unit('rubber', u, v) for u, v in ((0.2, 0.8), (0.4, 0.8), (0.4, 0.2), (0.2, 0.2))]
                            if k == '-x' else
                            [tb.unit('paint', u, v) for u, v in ((0.1, 0.8), (0.15, 0.8), (0.15, 0.2), (0.1, 0.2))])
        box_faces(B, centre, (sx, sy, sz), ('+x', '-x', '+z', outer), mat, uv)


def build_flags(g, B, tl_):
    f = g['flags']
    fl, fh = f['flag']
    for s in (1, -1):
        px, py = f['x'], s * f['y']
        z0 = top_z(g, px) - 0.02
        z1 = z0 + f['pole_h']
        ring = [Vector((px + f['pole_r'] * math.cos(a), py + f['pole_r'] * math.sin(a), 0))
                for a in (0.3, 0.3 + 2 * math.pi / 3, 0.3 + 4 * math.pi / 3)]
        for i in range(3):
            p, q = ring[i], ring[(i + 1) % 3]
            mid = (p + q) / 2 - Vector((px, py, 0))
            quad = [p + Vector((0, 0, z0)), q + Vector((0, 0, z0)), q + Vector((0, 0, z1)), p + Vector((0, 0, z1))]
            uv = [tl_.unit('chrome', u, v) for u, v in ((0.6, 0.9), (0.7, 0.9), (0.7, 0.1), (0.6, 0.1))]
            B.face(quad, uv, tl_.name, mid)
        apex = Vector((px, py, z1 + 0.16))
        base = [Vector((px + 0.09 * math.cos(a), py + 0.09 * math.sin(a), z1)) for a in (0, 2 * math.pi / 3, 4 * math.pi / 3)]
        for i in range(3):
            p, q = base[i], base[(i + 1) % 3]
            B.face([p, q, apex], [tl_.unit('gold', 0.2, 0.8), tl_.unit('gold', 0.8, 0.8), tl_.unit('gold', 0.5, 0.1)],
                   tl_.name, (p + q) / 2 - Vector((px, py, z1)) + Vector((0, 0, 0.05)))
        # pennant: two segments with a kink (it flies backward), two faces back to back
        top, bot = z1 - 0.04, z1 - 0.04 - fh
        xs = [px, px - fl * 0.5, px - fl]
        ys = [py, py + s * 0.08, py]
        for side in (1, -1):
            off = side * 0.006
            for i in range(2):
                quad = [Vector((xs[i], ys[i] + off, bot)), Vector((xs[i + 1], ys[i + 1] + off, bot)),
                        Vector((xs[i + 1], ys[i + 1] + off, top)), Vector((xs[i], ys[i] + off, top))]
                uv = [tl_.unit('flag', (px - p.x) / fl, 1 - (p.z - bot) / fh) for p in quad]
                B.face(quad, uv, tl_.name, (0, side, 0))


def build_wheel(name, g, tw, location):
    r, w, n = g['wheel_radius'], g['wheel_width'], g['wheel_sides']
    B = Builder([tw.name])
    ang = [2 * math.pi * (i + 0.5) / n for i in range(n)]
    for i in range(n):
        a0, a1 = ang[i], ang[(i + 1) % n]
        p0 = (r * math.cos(a0), 0, r * math.sin(a0))
        p1 = (r * math.cos(a1), 0, r * math.sin(a1))
        quad = [Vector(p0) + Vector((0, -w / 2, 0)), Vector(p1) + Vector((0, -w / 2, 0)),
                Vector(p1) + Vector((0, w / 2, 0)), Vector(p0) + Vector((0, w / 2, 0))]
        uv = [tw.unit('tread', i / n, 0), tw.unit('tread', (i + 1) / n, 0),
              tw.unit('tread', (i + 1) / n, 1), tw.unit('tread', i / n, 1)]
        am = 0.5 * (a0 + a1) + (math.pi if i == n - 1 else 0)
        B.face(quad, uv, tw.name, (math.cos(am), 0, math.sin(am)))
    for sy in (1, -1):
        cap = [Vector((r * math.cos(a), sy * w / 2, r * math.sin(a))) for a in ang]
        B.face(cap, [tw.disc('face', math.cos(a), math.sin(a)) for a in ang], tw.name, (0, sy, 0))
    return B.finish(name, location)


# ---------------------------------------------------------------------------------------------------
# Service vehicles: the jeep's open tub, windscreen, seats, roll bar, gun, spare, jerry can, bumper bar,
# fenders; the ambulance's beacons

def quad_uv(tex, region, u0, v0, u1, v1):
    """UVs for a quad listed (p00, p10, p11, p01) over a sub-rect of a region (normalised, v from the top)."""
    return [tex.unit(region, u0, v1), tex.unit(region, u1, v1), tex.unit(region, u1, v0), tex.unit(region, u0, v0)]


def box(B, x, y, z, faces, mat, uv):
    """Axis-aligned box from ranges x, y, z (any order); faces among +x -x +y -y +z -z; uv(key) -> 4 UVs."""
    x0, x1 = sorted(x)
    y0, y1 = sorted(y)
    z0, z1 = sorted(z)
    V = Vector
    quads = {
        '+x': ([V((x1, y0, z0)), V((x1, y1, z0)), V((x1, y1, z1)), V((x1, y0, z1))], (1, 0, 0)),
        '-x': ([V((x0, y1, z0)), V((x0, y0, z0)), V((x0, y0, z1)), V((x0, y1, z1))], (-1, 0, 0)),
        '+y': ([V((x1, y1, z0)), V((x0, y1, z0)), V((x0, y1, z1)), V((x1, y1, z1))], (0, 1, 0)),
        '-y': ([V((x0, y0, z0)), V((x1, y0, z0)), V((x1, y0, z1)), V((x0, y0, z1))], (0, -1, 0)),
        '+z': ([V((x0, y0, z1)), V((x1, y0, z1)), V((x1, y1, z1)), V((x0, y1, z1))], (0, 0, 1)),
        '-z': ([V((x0, y1, z0)), V((x1, y1, z0)), V((x1, y0, z0)), V((x0, y0, z0))], (0, 0, -1)),
    }
    for k in faces:
        pts, out = quads[k]
        B.face(pts, uv(k), mat, out)


def prism(B, p0, p1, r, mat, tex, region, sides=3, phase=0.3):
    """Open n-sided tube from p0 to p1 (no caps), UVs round x along the region."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    a = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    e1 = axis.cross(a).normalized()
    e2 = axis.cross(e1).normalized()
    dirs = [e1 * math.cos(phase + 2 * math.pi * i / sides) + e2 * math.sin(phase + 2 * math.pi * i / sides)
            for i in range(sides)]
    for i in range(sides):
        d0, d1 = dirs[i], dirs[(i + 1) % sides]
        q = [p0 + d0 * r, p0 + d1 * r, p1 + d1 * r, p1 + d0 * r]
        B.face(q, quad_uv(tex, region, i / sides, 0.1, (i + 1) / sides, 0.9), mat, (d0 + d1) / 2)


def build_tub(g, B, tb):
    t = g['tub']
    xf, xr = t['x']
    zf = t['z_floor']
    hw = g['half_width'] - g['shoulder_inset']
    inner = hw - t['wall']
    zrf, zrr = top_z(g, xf), top_z(g, xr)
    V = Vector
    for s in (1, -1):
        rim = [V((xf, s * hw, zrf)), V((xr, s * hw, zrr)), V((xr, s * inner, zrr)), V((xf, s * inner, zrf))]
        B.face(rim, [tb.planar('top', p.x, p.y) for p in rim], tb.name, (0, 0, 1))
        wall = [V((xf, s * inner, zf)), V((xr, s * inner, zf)), V((xr, s * inner, zrr)), V((xf, s * inner, zrf))]
        B.face(wall, [tb.planar('inner', p.x, p.z) for p in wall], tb.name, (0, -s, 0))
    floor = [V((xf, inner, zf)), V((xf, -inner, zf)), V((xr, -inner, zf)), V((xr, inner, zf))]
    B.face(floor, [tb.planar('top', p.x, p.y) for p in floor], tb.name, (0, 0, 1))
    for x, zr, out in ((xf, zrf, (-1, 0, 0)), (xr, zrr, (1, 0, 0))):
        end = [V((x, inner, zf)), V((x, -inner, zf)), V((x, -inner, zr)), V((x, inner, zr))]
        uv = [tb.unit('inner', (p.y + inner) / (2 * inner), (zr - p.z) / (zr - zf)) for p in end]
        B.face(end, uv, tb.name, out)


def build_windscreen(g, B, tb):
    w = g['windscreen']
    x, rk, (z0, z1), h, th = w['x'], w['rake'], w['z'], w['half'], w['thick']
    V = Vector
    for off, out in ((0.0, (1, 0, 0.15)), (-th, (-1, 0, -0.15))):
        q = [V((x + off, -h, z0)), V((x + off, h, z0)), V((x + off - rk, h, z1)), V((x + off - rk, -h, z1))]
        B.face(q, [tb.planar('windscreen', p.y, sl) for p, sl in zip(q, (0, 0, 1, 1))], tb.name, out)
    top = [V((x - rk, -h, z1)), V((x - rk, h, z1)), V((x - rk - th, h, z1)), V((x - rk - th, -h, z1))]
    B.face(top, quad_uv(tb, 'windscreen', 0.0, 0.0, 1.0, 0.06), tb.name, (0, 0, 1))
    for s in (1, -1):
        q = [V((x, s * h, z0)), V((x - th, s * h, z0)), V((x - th - rk, s * h, z1)), V((x - rk, s * h, z1))]
        B.face(q, quad_uv(tb, 'windscreen', 0.0, 0.0, 0.05, 1.0), tb.name, (0, s, 0))


def build_seats(g, B, tb):
    zf = g['tub']['z_floor']
    for seat in g['seats']:
        (xa, xb), (y0, y1), zc, bx, bz, reg = seat['x'], seat['y'], seat['z'], seat['back_x'], seat['back_z'], seat['region']
        uv = lambda k, reg=reg: quad_uv(tb, reg, 0.05, 0.05, 0.95, 0.95) if k == '+z' else quad_uv(tb, reg, 0.05, 0.5, 0.95, 0.95)
        box(B, (xb, xa), (y0, y1), (zf, zc), ('+z', '+x'), tb.name, uv)
        box(B, (bx, xb), (y0, y1), (zf, bz), ('+x', '-x', '+y', '-y', '+z'), tb.name, uv)


def build_roll_bar(g, B, tl_):
    rb = g['roll_bar']
    x, y, (z0, z1), r = rb['x'], rb['y'], rb['z'], rb['r']
    for s in (1, -1):
        prism(B, (x, s * y, z0), (x, s * y, z1 + r), r, tl_.name, tl_, 'bar')
    prism(B, (x, -y - r, z1), (x, y + r, z1), r, tl_.name, tl_, 'bar')


def build_gun(g, B, tl_):
    gn = g['gun']
    prism(B, (gn['x'], 0, gn['post_z'][0]), (gn['x'], 0, gn['post_z'][1]), 0.05, tl_.name, tl_, 'metal')
    metal = lambda k: quad_uv(tl_, 'metal', 0.1, 0.1, 0.9, 0.9)
    hb = gn['body_half']
    box(B, gn['body_x'], (-hb, hb), gn['body_z'], ('+x', '-x', '+y', '-y', '+z'), tl_.name, metal)
    bz = gn['barrel_z']
    prism(B, (gn['barrel_x'][0], 0, bz), (gn['barrel_x'][1], 0, bz), gn['barrel_r'], tl_.name, tl_, 'metal')
    ammo = lambda k: quad_uv(tl_, 'ammo', 0.05, 0.0, 0.95, 1.0)
    box(B, gn['ammo_x'], gn['ammo_y'], gn['ammo_z'], ('+x', '-x', '+y', '-y', '+z'), tl_.name, ammo)


def build_spare(g, B, tw):
    sp = g['spare']
    x, z, r, w, n = sp['x'], sp['z'], sp['radius'], sp['width'], sp['sides']
    ang = [2 * math.pi * (i + 0.5) / n for i in range(n)]
    ring = [(math.cos(a), math.sin(a)) for a in ang]
    for i in range(n):
        (c0, s0), (c1, s1) = ring[i], ring[(i + 1) % n]
        q = [Vector((x + w / 2, r * c0, z + r * s0)), Vector((x + w / 2, r * c1, z + r * s1)),
             Vector((x - w / 2, r * c1, z + r * s1)), Vector((x - w / 2, r * c0, z + r * s0))]
        uv = [tw.unit('tread', i / n, 0), tw.unit('tread', (i + 1) / n, 0), tw.unit('tread', (i + 1) / n, 1), tw.unit('tread', i / n, 1)]
        B.face(q, uv, tw.name, (0, (c0 + c1) / 2, (s0 + s1) / 2))
    cap = [Vector((x - w / 2, r * c, z + r * s)) for c, s in ring]
    B.face(cap, [tw.disc('face', c, s) for c, s in ring], tw.name, (-1, 0, 0))


def build_jerry(g, B, tl_):
    j = g['jerry']
    box(B, j['x'], j['y'], j['z'], ('-x', '+y', '-y', '+z'), tl_.name,
        lambda k: quad_uv(tl_, 'jerry', 0.0, 0.0, 1.0, 1.0) if k in ('+y', '-y') else quad_uv(tl_, 'jerry', 0.1, 0.1, 0.3, 0.9))


def build_bumper_bar(g, B, tl_):
    b = g['bumper_bar']
    box(B, b['x'], (-b['half'], b['half']), b['z'], ('+x', '+z', '+y', '-y'), tl_.name,
        lambda k: quad_uv(tl_, 'bar', 0.0, 0.1, 1.0, 0.9))


def build_fenders(g, B, tb):
    f = g['fenders']
    hw = g['half_width'] - g['shoulder_inset'] - 0.02
    V = Vector
    for ax in g['axles']:
        x0, x1 = ax + f['reach'], ax - f['reach']
        for s in (1, -1):
            plate = [V((x0, s * hw, f['z'])), V((x1, s * hw, f['z'])), V((x1, s * f['out'], f['z'])), V((x0, s * f['out'], f['z']))]
            B.face(plate, quad_uv(tb, 'paint', 0.05, 0.1, 0.95, 0.6), tb.name, (0, 0, 1))
            lip = [V((x0, s * f['out'], f['z'] - f['lip'])), V((x1, s * f['out'], f['z'] - f['lip'])),
                   V((x1, s * f['out'], f['z'])), V((x0, s * f['out'], f['z']))]
            B.face(lip, quad_uv(tb, 'paint', 0.05, 0.7, 0.95, 0.95), tb.name, (0, s, 0))


def build_beacons(g, B, tl_, z_roof):
    bc = g['beacons']
    sx, sy, sz = bc['size']
    for s in (1, -1):
        cx, cy = bc['x'], s * bc['y']
        box(B, (cx - sx / 2, cx + sx / 2), (cy - sy / 2, cy + sy / 2), (z_roof - 0.02, z_roof + sz),
            ('+x', '-x', '+y', '-y', '+z'), tl_.name,
            lambda k: quad_uv(tl_, 'beacon', 0.1, 0.1, 0.4, 0.3) if k == '+z' else quad_uv(tl_, 'beacon', 0.05, 0.0, 0.95, 1.0))


# ---------------------------------------------------------------------------------------------------
# Assembly and export

TURN = Matrix.Rotation(math.radians(90), 4, 'Z')
WHEELS = (('wheel_fl', 0, 1), ('wheel_fr', 0, -1), ('wheel_rl', 1, 1), ('wheel_rr', 1, -1))


def build_car(car, spec):
    dt.reset()
    g = spec['geometry']
    tex = {k: Tex(k, v) for k, v in spec['textures'].items()}
    for t in tex.values():
        dt.material(t.name, t.file)
    tb, tl_, tw = tex[f'{car}_body'], tex[f'{car}_lights'], tex[f'{car}_wheels']
    B = build_body(car, g, tb, tl_, tw)
    body_tris = B.count
    body = B.finish('body')
    wheels = [build_wheel(nm, g, tw, (g['axles'][ax], s * g['wheel_y'], g['wheel_radius'])) for nm, ax, s in WHEELS]
    parts = [body] + wheels
    bpy.context.view_layer.update()
    tris = dt.tri_count(parts)
    mn, mx = dt.bounds(parts)
    print(f'{car}: {tris} tris (body {body_tris}, wheels {tris - body_tris}; budget {spec["tri_budget"]}), '
          f'bounds {tuple(round(v, 3) for v in mn)} .. {tuple(round(v, 3) for v in mx)}')
    assert tris <= spec['tri_budget'], 'over the triangle budget'
    assert abs(mn.z) < 1e-4, 'the tyres must stand on z = 0'
    return parts, tris


def export_car(car, parts):
    """Root `car` turned +90 degrees about Z; the parts are stored in its frame so the scene is unchanged."""
    root = bpy.data.objects.new(car, None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_euler = (0, 0, math.radians(90))
    inv = TURN.inverted()
    for p in parts:
        p.data.transform(inv)
        p.location = inv @ p.location
        p.parent = root
        p.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    path = os.path.join(MODELS, car + '.glb')
    dt.export_glb([root] + parts, path)
    return path


# ---------------------------------------------------------------------------------------------------
# Checks

def glb_json(path):
    with open(path, 'rb') as fh:
        d = fh.read()
    n = struct.unpack('<I', d[12:16])[0]
    return json.loads(d[20:20 + n])


def check_glb(path, car):
    """Node tree as three.js will see it: one root, five children, the root's turn puts the nose on scene +X
    and its local X (the wheels' rotation.x axis) across the car."""
    from mathutils import Quaternion
    j = glb_json(path)
    nodes = j['nodes']
    top = j['scenes'][0]['nodes']
    assert len(top) == 1, f'{len(top)} root nodes'
    root = nodes[top[0]]
    print(f'  GLB root {root.get("name")!r} rotation {root.get("rotation")} scale {root.get("scale")}')
    kids = {nodes[c]['name']: nodes[c] for c in root.get('children', [])}
    assert set(kids) == {'body', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'}, sorted(kids)
    for name, n in sorted(kids.items()):
        rot = n.get('rotation', [0, 0, 0, 1])
        assert max(abs(a - b) for a, b in zip(rot, [0, 0, 0, 1])) < 1e-5 and 'scale' not in n, name
        prims = j['meshes'][n['mesh']]['primitives']
        mats = [j['materials'][p['material']]['name'] for p in prims]
        print(f'    {name:9s} translation {[round(v, 4) for v in n.get("translation", [0, 0, 0])]} materials {mats}')
    x, y, z, w = root['rotation']
    R = Quaternion((w, x, y, z)).to_matrix()
    axle, nose = R @ Vector((1, 0, 0)), R @ Vector((0, 0, 1))
    assert (axle - Vector((0, 0, -1))).length < 1e-4, axle
    assert (nose - Vector((1, 0, 0))).length < 1e-4, nose
    print(f'    root-local X -> scene {tuple(round(v, 3) for v in axle)} (axle), local +Z -> scene '
          f'{tuple(round(v, 3) for v in nose)} (nose): rotation.x += d / r rolls the wheels forward')
    print(f'    materials {[m["name"] for m in j["materials"]]}, images {len(j.get("images", []))}')


def reimport(path):
    dt.reset()
    bpy.ops.import_scene.gltf(filepath=path)
    objs = list(bpy.data.objects)
    for o in objs:
        if o.type == 'MESH':
            for m in o.data.materials:
                for n in (m.node_tree.nodes if m and m.use_nodes else []):
                    if n.type == 'TEX_IMAGE':
                        n.interpolation = 'Closest'
    for r in [o for o in objs if o.parent is None]:
        r.scale = r.scale * 1000.0          # StreetView's GLB_UNIT_FIX, as tier_preview does
    bpy.context.view_layer.update()
    mn, mx = dt.bounds(objs)
    meshes = [o for o in objs if o.type == 'MESH']
    print(f'  re-import: {[(o.name, o.type, o.parent.name if o.parent else None) for o in objs]}')
    print(f'  re-import x1000: {dt.tri_count(meshes)} tris, size {tuple(round(v, 2) for v in (mx - mn))}, '
          f'min {tuple(round(v, 3) for v in mn)}')
    for o in meshes:
        if o.name.startswith('wheel'):
            c = o.matrix_world.translation
            print(f'    {o.name} hub at {tuple(round(v, 3) for v in c)}')
    return objs


# ---------------------------------------------------------------------------------------------------
# Previews (Workbench FLAT = the game's single ambient light; back faces culled like the game)

VIEWS = {
    '3q': Vector((0.62, -1.0, 0.55)),         # front-right three-quarter: nose and the car's right side
    '3qrear': Vector((-0.62, 1.0, 0.55)),     # rear-left three-quarter: tail and the left side
    'street': Vector((0.0, -math.cos(math.radians(25)), math.sin(math.radians(25)))),
    'top': Vector((0.0, -0.001, 1.0)),
}


def setup_render(light, res=(960, 540)):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sh = sc.display.shading
    sh.light = light
    sh.color_type = 'TEXTURE'
    sh.show_backface_culling = True
    sh.show_shadows = light == 'STUDIO'
    sh.shadow_intensity = 0.3
    sh.show_cavity = False
    world = bpy.data.worlds.get('bg') or bpy.data.worlds.new('bg')
    world.color = (0.55, 0.6, 0.66)
    sc.world = world
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False


def add_ground(size):
    me = bpy.data.meshes.new('ground')
    s = size
    me.from_pydata([(-s, -s, -0.01), (s, -s, -0.01), (s, s, -0.01), (-s, s, -0.01)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new('ground', me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('road')
    mat.diffuse_color = (0.2, 0.2, 0.21, 1)
    me.materials.append(mat)
    return ob


def render_views(objs, prefix, light, views):
    mn, mx = dt.bounds(objs)
    corners = [Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    centre = (mn + mx) / 2
    sc = bpy.context.scene
    out = []
    for view in views:
        d = VIEWS[view].normalized()
        cam_data = bpy.data.cameras.new('cam')
        cam = bpy.data.objects.new('cam', cam_data)
        sc.collection.objects.link(cam)
        sc.camera = cam
        cam_data.type = 'ORTHO'
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        rot = cam.rotation_euler.to_matrix()
        right, up = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0))
        xs = [(c - centre).dot(right) for c in corners]
        ys = [(c - centre).dot(up) for c in corners]
        aspect = sc.render.resolution_x / sc.render.resolution_y
        cam_data.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * aspect) * 1.12
        shift = right * (max(xs) + min(xs)) / 2 + up * (max(ys) + min(ys)) / 2
        cam.location = centre + shift + d * 80
        cam_data.clip_end = 400
        path = f'{prefix}_{view}.png'
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam)
        out.append(path)
    return out


def preview(path, car):
    objs = reimport(path)
    meshes = [o for o in objs if o.type == 'MESH']
    add_ground(60)
    os.makedirs(PREVIEW, exist_ok=True)
    setup_render('FLAT')
    render_views(meshes, os.path.join(PREVIEW, f'{car}_flat'), 'FLAT', ('3q', '3qrear', 'street', 'top'))
    setup_render('STUDIO')
    render_views(meshes, os.path.join(PREVIEW, f'{car}_studio'), 'STUDIO', ('3q',))


JUNKER = os.path.join(MODELS, 'car_junker.glb')
JUNKER_LINEUP = os.path.join(PREVIEW, 'scratch', 'junker_ingame.glb')
CAR_LENGTH = 2.9 * 3.7      # Vehicles.tsx: CAR_LENGTH_M x VEHICLE_WORLD_SCALE


def junker_for_lineup(out=JUNKER_LINEUP):
    """Scratch copy of the poor-tier junker as Vehicles.tsx shows it, for tier_preview.py: the UV-less back wheels
    share the front wheels' mesh (useCarAssets does the same) and the roots are scaled so that tier_preview's x1000
    gives the game's 10.73 length (the raw GLB shows 11.22 long, and Blender leaves the back wheels blank)."""
    dt.reset()
    bpy.ops.import_scene.gltf(filepath=JUNKER)
    objs = list(bpy.data.objects)
    bpy.data.objects['wheels_back'].data = bpy.data.objects['wheels_front'].data
    bpy.context.view_layer.update()
    mn, mx = dt.bounds(objs)
    k = CAR_LENGTH / ((mx.x - mn.x) * 1000.0)
    # tier_preview multiplies each ROOT's scale by 1000 but not its location; the junker's three dummy roots
    # carry translations (the back axle 6.7 units aft, both axles 2 units down), so give them one root at
    # the origin that takes the scale instead.
    holder = bpy.data.objects.new('car_junker', None)
    bpy.context.scene.collection.objects.link(holder)
    for r in [o for o in objs if o.parent is None]:
        r.parent = holder
        r.matrix_parent_inverse = Matrix.Identity(4)
    holder.scale = (k, k, k)
    objs.append(holder)
    bpy.context.view_layer.update()
    mn, mx = dt.bounds(objs)
    print(f'junker for the lineup: x{k:.4f}, size x1000 {tuple(round(v * 1000, 2) for v in (mx - mn))}')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=False, export_materials='EXPORT', export_animations=False)
    print('wrote', out)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--lineup' in argv:
        junker_for_lineup()
        print('VEHICLES_DONE')
        return
    with open(LAYOUT, encoding='utf-8') as fh:
        layout = json.load(fh)
    names = [a for a in argv if not a.startswith('--')] or list(layout['cars'])
    for car in names:
        parts, tris = build_car(car, layout['cars'][car])
        path = export_car(car, parts)
        check_glb(path, car)
        if '--no-preview' not in argv:
            preview(path, car)
    print('VEHICLES_DONE')


main()
