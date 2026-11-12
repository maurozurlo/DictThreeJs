"""bld_a family models: env_bld_mixeduse_normal, env_bld_apartment_rich, env_bld_civic_rich.

    $env:TEMP = "$PWD\\build\\visual_gaps\\bld_a\\tmp"; $env:TMP = $env:TEMP
    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/bld_a.py -- [model ...] [--verify build/visual_gaps/bld_a/verify]

Rebuilds every model (or just the ones named) into public/models/map/<name>.glb. Each model is built
directly in its street slot's pivot frame (dt_common.SLOTS): ground at the slot's min z, the camera-facing
street line where the normal model's is. Rects, sizes and strip heights come from
tools/texgen/bld_a_layout.json (textures painted by tools/texgen/bld_a.py, run that first).

With --verify the script re-imports each GLB, checks its lowest point against the slot ground (+-0.05),
counts triangles, and renders what the game shows: flat light (the street has one ambient light and no
directional light) and back-face culling on, from the Street camera's direction, plus a studio 3/4.

Faces are built with their outside on the right of p0 -> p1 (walls) or counter-clockwise from outside,
so every normal points out; the game culls back faces except on the transparent trim (double-sided).
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dt_common as dt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
with open(os.path.join(ROOT, 'tools', 'texgen', 'bld_a_layout.json'), encoding='utf-8') as _fh:
    LAYOUT = json.load(_fh)
TEXDIR = os.path.join(ROOT, 'public', 'textures', 'map')
OUTDIR = os.path.join(ROOT, 'public', 'models', 'map')
GAME_CAMERA = Vector((8.0, -124.0, 61.0))   # game (8, 61, 124) in Blender axes

TRIM, APT, CIV, PARTS = 'bld_a_rich_trim', 'env_bld_apartment_rich_facade', 'env_bld_civic_rich_facade', 'env_bld_civic_rich_parts'


def rect(tex, region, inset=0.5):
    """(u0, u1, v_bottom, v_top) of a contract region, inset by `inset` px."""
    t = LAYOUT['textures'][tex]
    W, H = t['size']
    x, y, w, h = t['regions'][region]['rect']
    return (x + inset) / W, (x + w - inset) / W, 1 - (y + h - inset) / H, 1 - (y + inset) / H


class Mesh:
    """bmesh accumulator: polygons with per-loop UVs and one material per texture basename."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.mats = []

    def poly(self, pts, uvs, tex):
        vs = [self.bm.verts.new(Vector(p)) for p in pts]
        f = self.bm.faces.new(vs)
        if tex not in self.mats:
            self.mats.append(tex)
        f.material_index = self.mats.index(tex)
        f.smooth = False
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        return f

    def wall(self, p0, p1, z0, z1, tex, region, metres=None, u_off=0.0, vfrac=(0.0, 1.0), ufrac=(0.0, 1.0)):
        """Vertical quad from p0 to p1 (outside on the right). metres: U-tiling strip, world-scaled U;
        else the region is stretched over the face (ufrac/vfrac pick part of it)."""
        a, b = Vector((p0[0], p0[1], z0)), Vector((p1[0], p1[1], z0))
        c, d = Vector((p1[0], p1[1], z1)), Vector((p0[0], p0[1], z1))
        u0, u1, vb, vt = rect(tex, region)
        vb, vt = vb + (vt - vb) * vfrac[0], vb + (vt - vb) * vfrac[1]
        if metres:
            ua, ub = u_off, u_off + (b - a).length / metres
        else:
            ua, ub = u0 + (u1 - u0) * ufrac[0], u0 + (u1 - u0) * ufrac[1]
        return self.poly([a, b, c, d], [(ua, vb), (ub, vb), (ub, vt), (ua, vt)], tex)

    def flat(self, pts, z, tex, region, metres=None, axis='x', flip=False, vfrac=(0.0, 1.0)):
        """Horizontal polygon (2D points counter-clockwise from above, normal +Z; flip: normal -Z).
        Stretched over the region by its bounding box, or with metres a U-strip along `axis` (V across
        it, from the low side at vfrac[0] to the high side at vfrac[1])."""
        u0, u1, vb, vt = rect(tex, region)
        vb, vt = vb + (vt - vb) * vfrac[0], vb + (vt - vb) * vfrac[1]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        uvs = []
        for x, y in pts:
            if metres:
                along, across = (x, (y - y0) / (y1 - y0)) if axis == 'x' else (y, (x - x0) / (x1 - x0))
                uvs.append((along / metres, vb + (vt - vb) * across))
            else:
                uvs.append((u0 + (u1 - u0) * (x - x0) / (x1 - x0), vb + (vt - vb) * (y - y0) / (y1 - y0)))
        P = [(x, y, z) for x, y in pts]
        if flip:
            P, uvs = P[::-1], uvs[::-1]
        return self.poly(P, uvs, tex)

    def tri(self, a, b, c, tex, region, uvw=((0, 0), (1, 0), (0.5, 1))):
        u0, u1, vb, vt = rect(tex, region)
        uvs = [(u0 + (u1 - u0) * s, vb + (vt - vb) * t) for s, t in uvw]
        return self.poly([a, b, c], uvs, tex)

    def box(self, x0, x1, y0, y1, z0, z1, **faces):
        """Axis box; faces maps '-Y', '+X', '-X', '+Y', 'top' to (tex, region, kwargs) or omits them."""
        spec = {'-Y': ((x0, y0), (x1, y0)), '+X': ((x1, y0), (x1, y1)),
                '+Y': ((x1, y1), (x0, y1)), '-X': ((x0, y1), (x0, y0))}
        for key, (p0, p1) in spec.items():
            f = faces.get(key.replace('-', 'n').replace('+', 'p'))
            if f:
                self.wall(p0, p1, z0, z1, f[0], f[1], **(f[2] if len(f) > 2 else {}))
        if faces.get('top'):
            f = faces['top']
            self.flat([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z1, f[0], f[1], **(f[2] if len(f) > 2 else {}))

    def object(self):
        mats = [dt.material(t, os.path.join(TEXDIR, t + '.png')) for t in self.mats]
        return dt.mesh_object(self.name, self.bm, mats)


def offset_poly(pts, d):
    """Offsets a convex CCW polygon outward by d (miter joins)."""
    n = len(pts)
    out = []
    for i in range(n):
        p_prev, p, p_next = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1, e2 = (p - p_prev).normalized(), (p_next - p).normalized()
        n1, n2 = Vector((e1.y, -e1.x)), Vector((e2.y, -e2.x))
        m = (n1 + n2).normalized()
        out.append(tuple(p + m * (d / max(0.2, m.dot(n1)))))
    return out


def edges(pts):
    return [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def seg_len(p0, p1):
    return (Vector(p1) - Vector(p0)).length


# ---------------------------------------------------------------------------------------------------------
# env_bld_mixeduse_normal: the poor model's box without its damage, on the existing building4 facade.

def build_mixeduse_normal():
    m = Mesh('env_bld_mixeduse_normal')
    X0, X1, Y0, Y1, Z0, Z1 = -8.06, 9.46, -11.35, 11.35, -8.58, 8.58
    H = Z1 - Z0
    B4, TOP, BASE = 'building4', 'concrete_buildings_top', 'concrete_buildings_base'

    def v(z):
        return (z - Z0) / H

    def side_u(y):          # -X side: u 0 at the back (y = 11.35) to 1 at the front corner (y = -11.35)
        return (Y1 - y) / (Y1 - Y0)

    def quad_uv(pts, uvs, tex):
        m.poly([Vector(p) for p in pts], uvs, tex)

    # front (-Y): right half of building4 (u 0.502..1), full height, like the poor model
    quad_uv([(X0, Y0, Z0), (X1, Y0, Z0), (X1, Y0, Z1), (X0, Y0, Z1)],
            [(0.502, 0), (1, 0), (1, 1), (0.502, 1)], B4)
    # -X road side above the shop bays
    ZB = -3.69
    quad_uv([(X0, Y1, ZB), (X0, Y0, ZB), (X0, Y0, Z1), (X0, Y1, Z1)],
            [(side_u(Y1), v(ZB)), (side_u(Y0), v(ZB)), (side_u(Y0), 1), (side_u(Y1), 1)], B4)
    # ground floor: piers on the wall line, four recessed shop bays (the poor model's three plus the
    # middle shopfront building4 paints at u 0.265..0.485, which the poor model had caved in)
    bays = [(10.42, 6.46), (5.33, 0.34), (-0.91, -4.45), (-7.18, -10.5)]   # (y back end, y front end)
    XR = -6.96                                                              # recess depth 1.1
    ys = [Y1]
    for yb, yf in bays:
        ys += [yb, yf]
    ys.append(Y0)
    for i in range(0, len(ys), 2):                                          # piers
        ya, yb_ = ys[i], ys[i + 1]
        quad_uv([(X0, ya, Z0), (X0, yb_, Z0), (X0, yb_, ZB), (X0, ya, ZB)],
                [(side_u(ya), 0), (side_u(yb_), 0), (side_u(yb_), v(ZB)), (side_u(ya), v(ZB))], B4)
    dep = (XR - X0) / (Y1 - Y0)                                             # reveal width in u
    for yb, yf in bays:
        ub, uf = side_u(yb), side_u(yf)
        quad_uv([(XR, yb, Z0), (XR, yf, Z0), (XR, yf, ZB), (XR, yb, ZB)],
                [(ub, 0), (uf, 0), (uf, v(ZB)), (ub, v(ZB))], B4)           # shopfront at the back
        # reveal at the back end faces -Y (toward the front); at the front end faces +Y
        quad_uv([(X0, yb, Z0), (XR, yb, Z0), (XR, yb, ZB), (X0, yb, ZB)],
                [(ub - dep, 0), (ub, 0), (ub, v(ZB)), (ub - dep, v(ZB))], B4)
        quad_uv([(XR, yf, Z0), (X0, yf, Z0), (X0, yf, ZB), (XR, yf, ZB)],
                [(uf, 0), (uf + dep, 0), (uf + dep, v(ZB)), (uf, v(ZB))], B4)
        m.poly([Vector((X0, yb, ZB)), Vector((XR, yb, ZB)), Vector((XR, yf, ZB)), Vector((X0, yf, ZB))],
               [(0, 1), (0.1, 1), (0.1, 0), (0, 0)], BASE)                 # soffit, faces down
    # roof: concrete_buildings_top tiled every 8 units
    T = 8.0
    quad_uv([(X0, Y0, Z1), (X1, Y0, Z1), (X1, Y1, Z1), (X0, Y1, Z1)],
            [(X0 / T, Y0 / T), (X1 / T, Y0 / T), (X1 / T, Y1 / T), (X0 / T, Y1 / T)], TOP)
    # low parapet on the two street edges, capped in concrete_buildings_base (a light line at the top
    # of the facade, which reads against the dark roof under flat light)
    PH, PT = 0.5, 0.35
    for (p0, p1, inner0, inner1) in (((X0, Y0), (X1, Y0), (X0 + PT, Y0 + PT), (X1, Y0 + PT)),
                                     ((X0, Y1), (X0, Y0), (X0 + PT, Y1), (X0 + PT, Y0 + PT))):
        L = seg_len(p0, p1)
        quad_uv([(*p0, Z1), (*p1, Z1), (*p1, Z1 + PH), (*p0, Z1 + PH)],
                [(0, 0), (L / T, 0), (L / T, PH / T), (0, PH / T)], BASE)                     # outer
        quad_uv([(*inner1, Z1), (*inner0, Z1), (*inner0, Z1 + PH), (*inner1, Z1 + PH)],
                [(0, 0), (L / T, 0), (L / T, PH / T), (0, PH / T)], BASE)                     # inner
        quad_uv([(*p0, Z1 + PH), (*p1, Z1 + PH), (*inner1, Z1 + PH), (*inner0, Z1 + PH)],
                [(0, 0), (L / T, 0), (L / T, PT / T), (0, PT / T)], BASE)                     # cap
    return m


# ---------------------------------------------------------------------------------------------------------
# env_bld_apartment_rich: luxury tower on the apartment plot (fronts +X road, -Y camera)

def build_apartment_rich():
    m = Mesh('env_bld_apartment_rich')
    g = dt.slot_ground_z('apartment')

    def Z(h):
        return g + h

    # --- podium: recessed marble lobby behind a colonnade, entablature box over it
    LX0, LX1, LY0, LY1 = -15.0, 11.8, -22.6, 25.0
    col_y = [-25.11, -16.2, -8.2, 1.8, 9.8, 17.8]       # +X row (x = 14.26); -25.11 is the corner
    col_x = [-13.4, -6.7, 0.0, 6.7]                      # -Y row (y = -25.11)
    m.wall((LX0, LY0), (LX1, LY0), Z(0), Z(7), APT, 'podium_lit', metres=26.8, u_off=(LX0 + 13.4) / 26.8)
    m.wall((LX1, LY0), (LX1, LY1), Z(0), Z(7), APT, 'podium_shade', metres=32.0, u_off=(LY0 + 24.2) / 32.0)
    m.wall((LX0, LY1), (LX0, LY0), Z(0), Z(7), APT, 'podium_shade', metres=32.0)
    EX0, EX1, EY0, EY1 = -15.46, 15.46, -25.71, 25.0   # street line = the normal model's
    m.box(EX0, EX1, EY0, EY1, Z(7), Z(9),
          nY=(TRIM, 'cornice', {'metres': 16}), pX=(TRIM, 'cornice', {'metres': 16}),
          nX=(TRIM, 'cornice', {'metres': 16}))
    # colonnade porch floor (between the lobby wall and the street line) and the roof terrace in 12-unit
    # marble cells so the slab pattern keeps its scale
    xs = [EX0, -5.0, 5.0, EX1]
    ys = [EY0, -12.0, 0.0, 12.0, EY1]
    for i in range(3):
        for j in range(4):
            m.flat([(xs[i], ys[j]), (xs[i + 1], ys[j]), (xs[i + 1], ys[j + 1]), (xs[i], ys[j + 1])], Z(9), TRIM, 'marble')
    for (x, y) in [(14.26, yy) for yy in col_y] + [(xx, -25.11) for xx in col_x]:
        h = 0.6
        m.box(x - h, x + h, y - h, y + h, Z(0), Z(7),
              nY=(TRIM, 'column'), pX=(TRIM, 'column'), nX=(TRIM, 'column'), pY=(TRIM, 'column'))
    # entrance on +X, centred at y = -3: door, red carpet, canopy on two gilt posts
    m.wall((LX1 + 0.05, -5.4), (LX1 + 0.05, -0.6), Z(0), Z(7.0), TRIM, 'door')
    m.flat([(LX1, -5.0), (16.0, -5.0), (16.0, -1.0), (LX1, -1.0)], Z(0.04), TRIM, 'carpet', metres=8, axis='x')
    CX0, CX1, CY0, CY1, CZ0, CZ1 = LX1, 15.9, -6.6, 0.6, Z(5.0), Z(6.0)
    m.box(CX0, CX1, CY0, CY1, CZ0, CZ1, pX=(TRIM, 'canopy', {'vfrac': (0.0, 0.34)}),
          nY=(TRIM, 'canopy', {'vfrac': (0.0, 0.34)}), pY=(TRIM, 'canopy', {'vfrac': (0.0, 0.34)}))
    u0, u1, vb, vt = rect(TRIM, 'canopy')
    vmid = vb + (vt - vb) * 0.34
    m.poly([Vector((CX0, CY0, CZ1)), Vector((CX1, CY0, CZ1)), Vector((CX1, CY1, CZ1)), Vector((CX0, CY1, CZ1))],
           [(u0, vt), (u0, vmid), (u1, vmid), (u1, vt)], TRIM)               # red top, gold edge at the street
    for py in (CY0 + 0.3, CY1 - 0.3):
        m.box(15.35, 15.65, py - 0.15, py + 0.15, Z(0), CZ0,
              nY=(TRIM, 'gilt'), pX=(TRIM, 'gilt'), pY=(TRIM, 'gilt'), nX=(TRIM, 'gilt'))

    # --- tower: five 5-unit storeys, +X/-Y corner chamfered (it carries the leader's banner)
    TP = [(-12.0, -20.0), (3.0, -20.0), (8.0, -15.0), (8.0, 15.0), (-12.0, 15.0)]
    shade_of = {0: 'tower_lit', 1: 'tower_lit', 2: 'tower_shade', 3: None, 4: 'tower_shade'}
    for k in range(5):
        z0, z1 = Z(9 + 5 * k), Z(14 + 5 * k)
        for i, (p0, p1) in enumerate(edges(TP)):
            if shade_of[i]:
                m.wall(p0, p1, z0, z1, APT, shade_of[i], metres=20.0)
    # balconies at the four inner floor lines (-Y and +X faces only), gilt rails
    D = 1.5
    cor_l = (APT, 'tower_lit', {'metres': 20, 'vfrac': (0.0, 0.16)})      # marble slab edge, gilt line
    cor_s = (APT, 'tower_shade', {'metres': 20, 'vfrac': (0.0, 0.16)})
    for k in range(1, 5):
        zf = Z(9 + 5 * k)
        zr0, zr1 = zf + 0.05, zf + 1.25
        # -Y balcony: x -12..3, out to y -21.5 (its +Y side is the tower wall)
        m.box(-12.0, 3.0, -20.0 - D, -20.0, zf - 0.45, zf + 0.05, nY=cor_l, pX=cor_s, nX=cor_s, top=(TRIM, 'marble'))
        m.wall((-12.0, -20.0 - D + 0.08), (3.0, -20.0 - D + 0.08), zr0, zr1, TRIM, 'rail', metres=12)
        m.wall((3.0 - 0.08, -20.0 - D), (3.0 - 0.08, -20.0), zr0, zr1, TRIM, 'rail', metres=12)
        # +X balcony: y -15..15, out to x 9.5 (its -X side is the tower wall)
        m.box(8.0, 8.0 + D, -15.0, 15.0, zf - 0.45, zf + 0.05, pX=cor_s, nY=cor_l, pY=cor_s, top=(TRIM, 'marble'))
        m.wall((8.0 + D - 0.08, -15.0), (8.0 + D - 0.08, 15.0), zr0, zr1, TRIM, 'rail', metres=12)
        m.wall((8.0, -15.0 + 0.08), (8.0 + D, -15.0 + 0.08), zr0, zr1, TRIM, 'rail', metres=12)
    # roof-edge rail on the camera faces
    RP = offset_poly(TP, -0.1)
    for i in (0, 1, 2):
        m.wall(RP[i], RP[i + 1], Z(34.05), Z(35.25), TRIM, 'rail', metres=12)
    m.flat(TP, Z(34), TRIM, 'marble')
    # leader banner on the chamfer
    c0, c1 = Vector(TP[1]), Vector(TP[2])
    n = Vector((c1.y - c0.y, -(c1.x - c0.x))).normalized() * 0.3
    mid, along = (c0 + c1) / 2, (c1 - c0).normalized()
    b0, b1 = mid - along * 2.8 + n, mid + along * 2.8 + n
    m.wall(tuple(b0), tuple(b1), Z(12.5), Z(31.0), TRIM, 'banner')

    # --- penthouse, gilt cornice, crown with spikes, pyramid roof, needle spire
    PP = offset_poly(TP, -1.6)
    for i, (p0, p1) in enumerate(edges(PP)):
        if i != 3:
            m.wall(p0, p1, Z(34), Z(39), APT, 'tower_lit' if i < 2 else 'tower_shade', metres=20.0)
    CP = offset_poly(PP, 0.6)
    for i, (p0, p1) in enumerate(edges(CP)):
        if i != 3:
            m.wall(p0, p1, Z(39), Z(40.4), TRIM, 'cornice', metres=16)
    spikes = 0
    for i, (p0, p1) in enumerate(edges(CP)):
        if i == 3:
            continue
        L = seg_len(p0, p1)
        nsp = max(1, round(L / 2.6))
        a, b = Vector(p0), Vector(p1)
        for s in range(nsp):
            t0, t1 = s / nsp, (s + 1) / nsp
            q0, q1 = a.lerp(b, t0 + 0.12 / nsp), a.lerp(b, t1 - 0.12 / nsp)
            apex = (q0 + q1) / 2
            m.tri(Vector((q0.x, q0.y, Z(40.4))), Vector((q1.x, q1.y, Z(40.4))), Vector((apex.x, apex.y, Z(42.0))),
                  TRIM, 'gilt', uvw=((0.1, 0), (0.9, 0), (0.5, 1)))
            spikes += 1
    # crown terrace inside the spikes, then a steep gilt pyramid from a smaller base
    IP = offset_poly(CP, -2.4)
    for (p0, p1), (q0, q1) in zip(edges(CP), edges(IP)):
        m.poly([Vector((p0[0], p0[1], Z(40.4))), Vector((p1[0], p1[1], Z(40.4))),
                Vector((q1[0], q1[1], Z(40.4))), Vector((q0[0], q0[1], Z(40.4)))],
               [(rect(TRIM, 'marble')[0], rect(TRIM, 'marble')[2]), (rect(TRIM, 'marble')[1], rect(TRIM, 'marble')[2]),
                (rect(TRIM, 'marble')[1], rect(TRIM, 'marble')[2] + 0.04), (rect(TRIM, 'marble')[0], rect(TRIM, 'marble')[2] + 0.04)], TRIM)
    apex = Vector((sum(p[0] for p in IP) / len(IP), sum(p[1] for p in IP) / len(IP), Z(46.0)))
    for p0, p1 in edges(IP):
        m.tri(Vector((p0[0], p0[1], Z(40.4))), Vector((p1[0], p1[1], Z(40.4))), apex, TRIM, 'gilt')
    # gilt orb and needle
    oc, r = Vector((apex.x, apex.y, Z(47.4))), 1.1
    ring = [oc + Vector((math.cos(a) * r, math.sin(a) * r, 0)) for a in [i * math.pi / 3 for i in range(6)]]
    top, bot = oc + Vector((0, 0, r * 1.3)), oc - Vector((0, 0, r * 1.4))
    for i in range(6):
        a, b = ring[i], ring[(i + 1) % 6]
        m.tri(a, b, top, TRIM, 'gilt')
        m.tri(b, a, bot, TRIM, 'gilt')
    nb, hw = Z(48.6), 0.35
    base = [Vector((apex.x + dx, apex.y + dy, nb)) for dx, dy in ((-hw, -hw), (hw, -hw), (hw, hw), (-hw, hw))]
    tip = Vector((apex.x, apex.y, Z(54.0)))
    for i in range(4):
        m.tri(base[i], base[(i + 1) % 4], tip, TRIM, 'gilt')
    return m


# ---------------------------------------------------------------------------------------------------------
# env_bld_civic_rich: Stalinist-baroque government palace (fronts -Y, +X, -X)

def revolve(m, centre, profile, segs, tex, region, u_tiles=None, close_top=True):
    """Surface of revolution from (radius, z) profile points bottom to top. With u_tiles the region is a
    U strip wrapped u_tiles times per turn (v over the whole profile); else every segment column maps
    the whole region (ribs at its edges, v from the first ring to the last)."""
    cx, cy = centre
    u0, u1, vb, vt = rect(tex, region)
    zs = [p[1] for p in profile]
    vz = [(z - zs[0]) / (zs[-1] - zs[0]) for z in zs]

    def P(i, j):
        a = 2 * math.pi * (i % segs) / segs - math.pi / 2
        r, z = profile[j]
        return Vector((cx + math.cos(a) * r, cy + math.sin(a) * r, z))

    for i in range(segs):
        for j in range(len(profile) - 1):
            if u_tiles:
                ua, ub = u_tiles * i / segs, u_tiles * (i + 1) / segs
            else:
                ua, ub = u0, u1
            va, vb_ = vb + (vt - vb) * vz[j], vb + (vt - vb) * vz[j + 1]
            if profile[j + 1][0] < 1e-6:
                if close_top:
                    m.poly([P(i, j), P(i + 1, j), P(i, j + 1)], [(ua, va), (ub, va), ((ua + ub) / 2, vb_)], tex)
            else:
                m.poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)],
                       [(ua, va), (ub, va), (ub, vb_), (ua, vb_)], tex)


def build_civic_rich():
    m = Mesh('env_bld_civic_rich')
    g = dt.slot_ground_z('civic')

    def Z(h):
        return g + h

    MX, PX = 16.49, 24.49            # main block half-width, pavilion outer x
    FY, PY, BY = -9.0, -12.5, 15.25  # main wall y, pavilion / colonnade front y, back y
    # --- main block: wall behind the colonnade, copper roof
    m.wall((-MX, FY), (MX, FY), Z(0), Z(17), CIV, 'wall_lit', metres=32, u_off=0.0)
    for x0, x1 in ((-MX, 0.0), (0.0, MX)):
        for y0, y1 in ((FY, 3.0), (3.0, BY)):
            m.flat([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], Z(17), PARTS, 'roof')
    # --- end pavilions (20 high), attic band on top, banner on the front
    for s in (-1, 1):
        xi, xo = s * MX, s * PX
        x0, x1 = min(xi, xo), max(xi, xo)
        m.wall((x0, PY), (x1, PY), Z(0), Z(17), CIV, 'wall_lit', metres=32, u_off=(x0 + 32.0) / 32)
        m.wall((x0, PY), (x1, PY), Z(17), Z(20), PARTS, 'attic', metres=16)
        outer = ((xo, PY), (xo, BY)) if s > 0 else ((xo, BY), (xo, PY))
        m.wall(*outer, Z(0), Z(17), CIV, 'wall_shade', metres=32)
        m.wall(*outer, Z(17), Z(20), PARTS, 'attic', metres=16)
        inner_front = ((xi, FY), (xi, PY)) if s > 0 else ((xi, PY), (xi, FY))
        m.wall(*inner_front, Z(0), Z(17), CIV, 'wall_shade', metres=32)
        m.wall(*inner_front, Z(17), Z(20), PARTS, 'attic', metres=16)
        inner_back = ((xi, BY), (xi, FY)) if s > 0 else ((xi, FY), (xi, BY))
        m.wall(*inner_back, Z(17), Z(20), PARTS, 'attic', metres=16)
        for y0, y1 in ((PY, 1.4), (1.4, BY)):
            m.flat([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], Z(20), PARTS, 'roof')
        bc = s * 20.49
        m.wall((bc - 2.3, PY - 0.1), (bc + 2.3, PY - 0.1), Z(3.5), Z(16.5), TRIM, 'banner')
        # gilt cupola, flagpole and flag
        cc = (s * 20.49, -4.0)
        revolve(m, cc, [(2.9, Z(20)), (2.75, Z(21.4)), (2.0, Z(22.9)), (0.0, Z(23.9))], 8, TRIM, 'gilt')
        pz0, pz1, hw = Z(23.6), Z(30.5), 0.12
        m.box(cc[0] - hw, cc[0] + hw, cc[1] - hw, cc[1] + hw, pz0, pz1,
              nY=(TRIM, 'gilt'), pX=(TRIM, 'gilt'), nX=(TRIM, 'gilt'), pY=(TRIM, 'gilt'))
        fx = cc[0] + hw * s
        if s > 0:   # hoist (star) at the pole on both flags; they fly outward
            m.wall((fx, cc[1]), (fx + 3.6, cc[1]), Z(27.6), Z(30.2), TRIM, 'flag')
        else:
            m.wall((fx - 3.6, cc[1]), (fx, cc[1]), Z(27.6), Z(30.2), TRIM, 'flag', ufrac=(1.0, 0.0))
    # --- stylobate, giant-order colonnade, entablature
    m.wall((-MX, PY), (-9.0, PY), Z(0), Z(1.2), PARTS, 'stair', metres=16, vfrac=(0.0, 0.375))
    m.wall((9.0, PY), (MX, PY), Z(0), Z(1.2), PARTS, 'stair', metres=16, vfrac=(0.0, 0.375))
    m.flat([(-MX, PY), (MX, PY), (MX, FY), (-MX, FY)], Z(1.2), PARTS, 'stair', metres=16, axis='x', vfrac=(0.375, 1.0))
    for x in (-15.2, -11.4, -7.6, -3.8, 3.8, 7.6, 11.4, 15.2):
        h, cy = 0.7, -11.3
        m.box(x - h, x + h, cy - h, cy + h, Z(1.2), Z(14),
              nY=(TRIM, 'column'), pX=(TRIM, 'column'), nX=(TRIM, 'column'), pY=(TRIM, 'column'))
    m.wall((-MX, PY), (MX, PY), Z(14), Z(15.5), PARTS, 'attic', metres=6)
    m.wall((-MX, PY), (MX, PY), Z(15.5), Z(17), TRIM, 'cornice', metres=12)
    m.flat([(-MX, PY), (-7.0, PY), (-7.0, FY), (-MX, FY)], Z(17), PARTS, 'roof')
    m.flat([(7.0, PY), (MX, PY), (MX, FY), (7.0, FY)], Z(17), PARTS, 'roof')
    # --- central attic and pediment
    AY0, AY1 = PY - 0.3, FY + 0.5
    m.box(-7.0, 7.0, AY0, AY1, Z(17), Z(21),
          nY=(PARTS, 'attic', {'metres': 16, 'u_off': 0.5}), pX=(PARTS, 'attic', {'metres': 16}),
          nX=(PARTS, 'attic', {'metres': 16}), top=(PARTS, 'roof'))
    pa, pb, apx = Vector((-7.6, AY0 - 0.2, Z(21))), Vector((7.6, AY0 - 0.2, Z(21))), Vector((0.0, AY0 - 0.2, Z(24.6)))
    m.tri(pa, pb, apx, PARTS, 'tympanum')
    back = Vector((0, AY1 - (AY0 - 0.2), 0))
    u0, u1, vb, vt = rect(PARTS, 'roof')
    roof_uv = [(u0, vb), (u1, vb), (u1, vt), (u0, vt)]
    m.poly([pb, pb + back, apx + back, apx], roof_uv, PARTS)        # right slope
    m.poly([apx, apx + back, pa + back, pa], roof_uv, PARTS)        # left slope
    # --- speech balcony with gilt rail, the balcony door and the main door behind
    BX, BY0, BY1, BZ = 3.0, -13.4, FY, Z(7.6)
    m.box(-BX, BX, BY0, BY1, BZ - 0.6, BZ, nY=(TRIM, 'cornice', {'metres': 8}), pX=(TRIM, 'cornice', {'metres': 8}),
          nX=(TRIM, 'cornice', {'metres': 8}), top=(TRIM, 'marble'))
    m.wall((-BX, BY0 + 0.08), (BX, BY0 + 0.08), BZ, BZ + 1.2, TRIM, 'rail', metres=12)
    m.wall((BX - 0.08, BY0), (BX - 0.08, BY1), BZ, BZ + 1.2, TRIM, 'rail', metres=12)
    m.wall((-BX + 0.08, BY1), (-BX + 0.08, BY0), BZ, BZ + 1.2, TRIM, 'rail', metres=12)
    m.wall((-2.0, FY - 0.05), (2.0, FY - 0.05), BZ, BZ + 5.6, TRIM, 'door')
    m.wall((-2.4, FY - 0.05), (2.4, FY - 0.05), Z(1.2), BZ - 0.7, TRIM, 'door')
    # --- grand stair with a red runner
    nst, sh, y_front = 4, 0.3, -15.25
    td = (PY - y_front) / nst
    for k in range(nst):
        yr, z0, z1 = y_front + k * td, Z(k * sh), Z((k + 1) * sh)
        m.wall((-9.0, yr), (9.0, yr), z0, z1, PARTS, 'stair', metres=16, vfrac=(0.0, 0.375))
        m.flat([(-9.0, yr), (9.0, yr), (9.0, yr + td), (-9.0, yr + td)], z1, PARTS, 'stair', metres=16,
               axis='x', vfrac=(0.375, 1.0))                     # nosing at the front edge
    for s in (-1, 1):                                  # stepped side profiles
        x = s * 9.0
        prof = [(y_front, Z(0))]
        for k in range(nst):
            yr = y_front + k * td
            prof += [(yr, Z((k + 1) * sh)), (yr + td, Z((k + 1) * sh))]
        prof += [(PY, Z(0))]
        pts = [Vector((x, y, z)) for y, z in prof]
        if s > 0:                                      # counter-clockwise seen from outside
            pts = pts[::-1]
        u0, u1, vb, vt = rect(PARTS, 'stair')
        uvs = [(p.y / 16.0, vb + (vt - vb) * 0.375 * (p.z - Z(0)) / 1.2) for p in pts]
        m.poly(pts, uvs, PARTS)
    cw, lift = 2.0, 0.03
    cu0, cu1, cvb, cvt = rect(TRIM, 'carpet')
    for k in range(nst):                               # runner down each riser (U along the run)
        yr, z0, z1 = y_front + k * td, Z(k * sh), Z((k + 1) * sh)
        y = yr - lift
        m.poly([Vector((-cw, y, z0)), Vector((cw, y, z0)), Vector((cw, y, z1 + lift)), Vector((-cw, y, z1 + lift))],
               [(0, cvb), (0, cvt), (sh / 8, cvt), (sh / 8, cvb)], TRIM)
        m.flat([(-cw, yr - lift), (cw, yr - lift), (cw, yr + td), (-cw, yr + td)], z1 + lift, TRIM, 'carpet',
               metres=8, axis='y')
    m.flat([(-cw, PY), (cw, PY), (cw, FY), (-cw, FY)], Z(1.2) + lift, TRIM, 'carpet', metres=8, axis='y')
    m.flat([(-cw, -16.0), (cw, -16.0), (cw, y_front - lift), (-cw, y_front - lift)], Z(0) + lift, TRIM, 'carpet',
           metres=8, axis='y')
    # --- drum, gilt dome, lantern, spire
    dc = (0.0, 3.0)
    revolve(m, dc, [(6.0, Z(17)), (6.0, Z(22))], 12, PARTS, 'drum', u_tiles=1.5)
    revolve(m, dc, [(6.25, Z(22)), (5.95, Z(24.8)), (4.9, Z(27.6)), (3.0, Z(29.8)), (1.0, Z(30.8))], 12, TRIM, 'gilt')
    revolve(m, dc, [(1.0, Z(30.8)), (1.0, Z(32.6))], 8, TRIM, 'column')
    revolve(m, dc, [(1.35, Z(32.6)), (0.0, Z(34.0))], 8, TRIM, 'gilt')
    revolve(m, dc, [(0.3, Z(34.0)), (0.0, Z(37.2))], 4, TRIM, 'gilt')
    return m


# ---------------------------------------------------------------------------------------------------------
# Build, export, verify

MODELS = {
    'env_bld_mixeduse_normal': ('mixeduse', build_mixeduse_normal),
    'env_bld_apartment_rich': ('apartment', build_apartment_rich),
    'env_bld_civic_rich': ('civic', build_civic_rich),
}


def build_one(name):
    slot, fn = MODELS[name]
    dt.reset()
    m = fn()
    ob = m.object()
    tris = dt.tri_count([ob])
    mn, mx = dt.bounds([ob])
    print(f'BUILT {name}: {tris} tris, mats {m.mats}, bounds {tuple(round(v, 2) for v in mn)} .. {tuple(round(v, 2) for v in mx)}')
    path = dt.export_glb([ob], os.path.join(OUTDIR, name + '.glb'))
    return path, slot


def render_view(path, d, flat, cull, ortho_pad=1.12, res=(1000, 800)):
    """Ortho Workbench render of the current scene along direction d (from target to camera)."""
    sc = bpy.context.scene
    objs = [o for o in sc.objects if o.type == 'MESH']
    mn, mx = dt.bounds(objs)
    centre = (mn + mx) / 2
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam_data.type = 'ORTHO'
    d = Vector(d).normalized()
    cam.location = centre + d * 400
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    corners = [Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    rot = cam.rotation_euler.to_matrix()
    right, up = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0))
    w = max(abs((c - centre).dot(right)) for c in corners) * 2
    h = max(abs((c - centre).dot(up)) for c in corners) * 2
    sc.render.resolution_x, sc.render.resolution_y = res
    cam_data.ortho_scale = max(w, h * res[0] / res[1]) * ortho_pad
    cam_data.clip_end = 2000
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    sh = sc.display.shading
    sh.light = 'FLAT' if flat else 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_backface_culling = cull
    sh.show_shadows = False
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('bg')
    world.color = (0.55, 0.62, 0.7)
    sc.world = world
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def verify(glb, slot, outdir):
    dt.reset()
    bpy.ops.import_scene.gltf(filepath=glb)
    for o in bpy.context.scene.objects:
        if o.parent is None:
            o.scale = o.scale * 1000
        for mat in (o.data.materials if o.type == 'MESH' else []):
            for n in mat.node_tree.nodes:
                if n.type == 'TEX_IMAGE':
                    n.interpolation = 'Closest'
    bpy.context.view_layer.update()
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    mn, mx = dt.bounds(objs)
    ground = dt.slot_ground_z(slot)
    ok = abs(mn.z - ground) <= 0.05
    tris = dt.tri_count(objs)
    name = os.path.splitext(os.path.basename(glb))[0]
    print(f'VERIFY {name}: tris {tris}, min {tuple(round(v, 3) for v in mn)}, max {tuple(round(v, 3) for v in mx)}, '
          f'ground {ground} -> {"OK" if ok else "FAIL"}, height above ground {mx.z - ground:.2f}')
    s = dt.SLOTS[slot]['ipl']
    to_cam = GAME_CAMERA - Vector((s[0], -s[2], s[1]))   # IPL (game x, y, z) -> Blender (x, -z, y)
    os.makedirs(outdir, exist_ok=True)
    render_view(os.path.join(outdir, f'{name}_game_flat.png'), to_cam, flat=True, cull=True)
    side = (0.62, -1, 0.55) if '+X' in dt.SLOTS[slot]['fronts'] else (-0.62, -1, 0.55)
    render_view(os.path.join(outdir, f'{name}_3q_studio.png'), side, flat=False, cull=True)
    render_view(os.path.join(outdir, f'{name}_front_flat.png'), (0, -1, 0.2), flat=True, cull=True)
    return ok


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    vdir = None
    if '--verify' in argv:
        i = argv.index('--verify')
        vdir = os.path.abspath(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    names = argv or list(MODELS)
    results = []
    for name in names:
        path, slot = build_one(name)
        if vdir:
            results.append((name, verify(path, slot, vdir)))
    if vdir and not all(ok for _, ok in results):
        raise SystemExit('ground check failed: ' + str(results))


main()
