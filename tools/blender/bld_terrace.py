"""bld_terrace family: env_bld_terrace_{normal,poor} -- a 100 x 20 row of attached townhouses.

The poor model (build_poor) is its own dilapidated build; see the notes above it. It uses the *_poor textures,
with bld_terrace_trim_poor as a 64 x 64 atlas (layout json poor.atlas) so it still has 4 materials.

    $env:TEMP = "$PWD\\build\\roadplan\\scratch\\tmp"; $env:TMP = $env:TEMP
    python tools/texgen/bld_terrace.py          # textures first
    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/bld_terrace.py -- [env_bld_terrace_normal ...]

Writes public/models/map/<name>.glb. Sizes, house layout and door positions come from
tools/texgen/bld_terrace_layout.json. Built in Blender axes, game units: front facade at -Y (= game +Z, the
Street camera), pitched roof with the ridge along X, bbox centre at the origin (the IPL pivot
convention; placement Y = HEIGHT / 2 puts the base on the ground). No UV exceeds 0..1 (StreetView never
sets texture wrap), so the facade spans the whole 100 u once, each roof slope and end wall is mapped once.
Every face is wound with its outside on the right of p0 -> p1 (walls) or counter-clockwise from outside.
"""
import json
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dt_common as dt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAYOUT = json.load(open(os.path.join(ROOT, 'tools', 'texgen', 'bld_terrace_layout.json'), encoding='utf-8'))
TEXDIR = os.path.join(ROOT, 'public', 'textures', 'map')
OUTDIR = os.path.join(ROOT, 'public', 'models', 'map')

M = LAYOUT['model']
LEN, DEP = M['size']
WH, RISE, OVER = M['wall_height'], M['roof_rise'], M['eave_overhang']
X0, X1, Y0, Y1 = -LEN / 2, LEN / 2, -DEP / 2, DEP / 2
RIDGE = WH + RISE
SLOPE = RISE / (DEP / 2)                      # rise per unit of depth
EAVE_Z = RIDGE - SLOPE * (DEP / 2 + OVER)     # roof edge height at the overhang
CHIM_TOP = RIDGE + 1.5
FAC = LAYOUT['textures']['bld_terrace_facade']
FW, FH = FAC['size']
PX_U = FW / LEN                                # facade px per unit along X
PX_V = FH / WH                                 # facade px per unit of height


class Mesh:
    def __init__(self, name):
        self.name, self.bm, self.mats = name, bmesh.new(), []
        self.uv = self.bm.loops.layers.uv.new('UVMap')

    def poly(self, pts, uvs, tex):
        f = self.bm.faces.new([self.bm.verts.new(Vector(p)) for p in pts])
        if tex not in self.mats:
            self.mats.append(tex)
        f.material_index = self.mats.index(tex)
        f.smooth = False
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv

    def box(self, x0, x1, y0, y1, z0, z1, tex, uv, faces='-Y +X -X +Y top'):
        """Axis box, one flat UV rect for every face (uv = (u0, v0, u1, v1)); faces picks the sides."""
        u0, v0, u1, v1 = uv
        q = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
        side = {'-Y': ((x0, y0), (x1, y0)), '+X': ((x1, y0), (x1, y1)),
                '+Y': ((x1, y1), (x0, y1)), '-X': ((x0, y1), (x0, y0))}
        for k, (a, b) in side.items():
            if k in faces.split():
                self.poly([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], q, tex)
        if 'top' in faces.split():
            self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], q, tex)
        if 'bottom' in faces.split():
            self.poly([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], q, tex)


def build(tier):
    sfx = '_poor' if tier == 'poor' else ''
    FACADE, BRICK, ROOF, TRIM = (f'bld_terrace_{n}{sfx}' for n in ('facade', 'brick', 'roof', 'trim'))
    m = Mesh(f'env_bld_terrace_{tier}')
    trim_uv = (0.25, 0.25, 0.75, 0.75)

    # front facade: the whole texture once over the 100 x 15 wall
    m.poly([(X0, Y0, 0), (X1, Y0, 0), (X1, Y0, WH), (X0, Y0, WH)], [(0, 0), (1, 0), (1, 1), (0, 1)], FACADE)
    # cornice: projecting band carrying the facade's top 3 px (0.7 u), plus its soffit
    cz0 = WH - 3.0 / PX_V
    cv0 = 1 - 3.0 / FH
    m.poly([(X0, Y0 - 0.6, cz0), (X1, Y0 - 0.6, cz0), (X1, Y0 - 0.6, WH), (X0, Y0 - 0.6, WH)],
           [(0, cv0), (1, cv0), (1, 1), (0, 1)], FACADE)
    m.poly([(X0, Y0, cz0), (X1, Y0, cz0), (X1, Y0 - 0.6, cz0), (X0, Y0 - 0.6, cz0)],
           [(0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)], TRIM)
    for x, (a, b) in ((X0, (Y0 - 0.6, Y0)), (X1, (Y0, Y0 - 0.6))):   # cornice end caps
        m.poly([(x, a, cz0), (x, b, cz0), (x, b, WH), (x, a, WH)], [(0.5, 0.5)] * 4, TRIM)
    # end walls (pentagons incl. the gable) and the back wall, brick stretched once
    def end(x, ya, yb):
        pts = [(x, ya, 0), (x, yb, 0), (x, yb, WH), (x, 0, RIDGE), (x, ya, WH)]
        us = [((p[1] - Y0) / DEP) for p in pts]
        m.poly(pts, [(u, p[2] / RIDGE) for u, p in zip(us, pts)], BRICK)
    end(X1, Y0, Y1)
    end(X0, Y1, Y0)
    m.poly([(X1, Y1, 0), (X0, Y1, 0), (X0, Y1, WH), (X1, Y1, WH)], [(0, 0), (1, 0), (1, 0.8), (0, 0.8)], BRICK)
    # roof slopes (eave overhang OVER), mapped once each
    m.poly([(X0, Y0 - OVER, EAVE_Z), (X1, Y0 - OVER, EAVE_Z), (X1, 0, RIDGE), (X0, 0, RIDGE)],
           [(0, 0), (1, 0), (1, 1), (0, 1)], ROOF)
    m.poly([(X0, 0, RIDGE), (X1, 0, RIDGE), (X1, Y1 + OVER, EAVE_Z), (X0, Y1 + OVER, EAVE_Z)],
           [(0, 1), (1, 1), (1, 0), (0, 0)], ROOF)
    # chimneys on the party walls every 20 u (brick shafts, trim caps)
    for cx in (-40, -20, 0, 20, 40):
        m.box(cx - 1.0, cx + 1.0, -0.8, 0.8, RIDGE - 1.2, CHIM_TOP, BRICK, (0.1, 0.3, 0.9, 0.9), faces='-Y +X -X +Y')
        m.box(cx - 1.25, cx + 1.25, -1.0, 1.0, CHIM_TOP, CHIM_TOP + 0.5, TRIM, trim_uv)
    # door canopies + steps; balcony slabs under the iron rails of the balconied houses
    for hs in FAC['houses']:
        px = hs['x'] + (FAC['door_px']['left_x'] if hs['door'] == 'left' else FAC['door_px']['right_x'])
        dcx = X0 + (px + FAC['door_px']['w'] / 2) / PX_U
        if not hs['shop']:
            m.box(dcx - 2.0, dcx + 2.0, Y0 - 1.3, Y0, 4.55, 4.9, TRIM, trim_uv, faces='-Y +X -X top bottom')
            m.box(dcx - 1.8, dcx + 1.8, Y0 - 1.1, Y0, 0, 0.45, TRIM, trim_uv, faces='-Y +X -X top')
        if hs['balcony']:
            bcx = X0 + (hs['x'] + 16) / PX_U
            zb = (FH - 40.0) / PX_V - 0.15
            m.box(bcx - 4.0, bcx + 4.0, Y0 - 0.9, Y0, zb, zb + 0.35, TRIM, trim_uv, faces='-Y +X -X top bottom')
    return m


# ---------------------------------------------------------------------------------------------------------
# POOR tier. Same 100 x 20 box, same 10-house rhythm, same pivot (the NORMAL model's bbox centre, see
# center_and_export), but dilapidated: roof pits + tarps + sagging ridge, a slumped collapsed end house
# with shoring, broken / leaning chimneys, rotten gutters and downpipes, planks nailed over windows and
# doors, tilted canopies and balconies, hanging shutters, dishes, laundry. Everything on the street side
# stays within 0.8 u of the facade plane. Window / door states come from the layout json (poor.houses).

import math
import random

POOR = LAYOUT['poor']
ATL = POOR['atlas']
HOUSES = LAYOUT['textures']['bld_terrace_facade']['houses']
DP = FAC['door_px']
P_FAC, P_BRICK, P_ROOF, P_ATLAS = ('bld_terrace_facade_poor', 'bld_terrace_brick_poor',
                                   'bld_terrace_roof_poor', 'bld_terrace_trim_poor')
FRONT_N = Vector((0, -SLOPE, 1)).normalized()      # outward normal of the front roof slope
BACK_N = Vector((0, SLOPE, 1)).normalized()
DROOP_X0, DROOP_D = 44.0, 4.4                      # house 9: roof slumps over the broken top floor
SAGS = [(-27.0, 5.5, 0.9), (14.0, 6.0, 1.0)]       # (x centre, half width, depth) of ridge sags
PITS = [dict(x=(-17.0, -11.0), s=(0.35, 0.80), floor=14.6),
        dict(x=(23.0, 28.0), s=(0.30, 0.75), floor=14.6),
        dict(x=(46.5, 49.5), s=(0.15, 0.70), floor=10.2)]
TARPS = [dict(x=(-38.0, -31.0), s=(0.18, 0.78), tex='tarp'), dict(x=(31.0, 37.0), s=(0.30, 0.95), tex='tarp'),
         dict(x=(2.5, 8.0), s=(0.10, 0.58), tex='tin')]


def atlas_uv(name, inset=0.5, band=None, bands=4, bx=None):
    x0, y0, x1, y1 = ATL[name]
    if band is not None:
        h = (y1 - y0) / bands
        y0, y1 = y0 + band * h, y0 + (band + 1) * h
    if bx is not None:
        w = (x1 - x0) / bands
        x0, x1 = x0 + bx * w, x0 + (bx + 1) * w
    return ((x0 + inset) / 64.0, 1 - (y1 - inset) / 64.0, (x1 - inset) / 64.0, 1 - (y0 + inset) / 64.0)


def quv(uv):
    u0, v0, u1, v1 = uv
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]


def mp(m, pts, uvs, tex, face_dir=None, centre=None):
    """poly() that fixes the winding so the face looks along face_dir (or away from centre)."""
    P = [Vector(p) for p in pts]
    n = Vector()
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    if face_dir is not None:
        ref = Vector(face_dir)
    else:
        ref = sum(P, Vector()) / len(P) - Vector(centre)
    if n.dot(ref) < 0:
        P, uvs = P[::-1], list(uvs)[::-1]
    m.poly([tuple(p) for p in P], uvs, tex)


def beam(m, A, B, t, yb, yf, tex, uv, faces=('front', 'top', 'bottom', 'a', 'b')):
    """Board in the XZ plane from A to B (x, z), thickness t across, spanning y in [yf, yb] (yf is the street side)."""
    ax, az = A
    bx, bz = B
    L = math.hypot(bx - ax, bz - az) or 1e-6
    ux, uz = (bx - ax) / L, (bz - az) / L
    nx, nz = -uz * t / 2, ux * t / 2
    P0, P1, P2, P3 = (ax - nx, az - nz), (bx - nx, bz - nz), (bx + nx, bz + nz), (ax + nx, az + nz)
    c = ((ax + bx) / 2, (yb + yf) / 2, (az + bz) / 2)
    q = quv(uv)

    def v(p, y):
        return (p[0], y, p[1])
    if 'front' in faces:
        mp(m, [v(P0, yf), v(P1, yf), v(P2, yf), v(P3, yf)], q, tex, centre=c)
    if 'top' in faces:
        mp(m, [v(P3, yf), v(P2, yf), v(P2, yb), v(P3, yb)], q, tex, centre=c)
    if 'bottom' in faces:
        mp(m, [v(P0, yb), v(P1, yb), v(P1, yf), v(P0, yf)], q, tex, centre=c)
    if 'a' in faces:
        mp(m, [v(P3, yb), v(P0, yb), v(P0, yf), v(P3, yf)], q, tex, centre=c)
    if 'b' in faces:
        mp(m, [v(P1, yb), v(P2, yb), v(P2, yf), v(P1, yf)], q, tex, centre=c)


def bar(m, A, B, w, h, tex, uv, ends=False):
    """Oriented 3D box from A to B (Vectors), cross-section w x h; the 4 long faces (+ ends if asked)."""
    A, B = Vector(A), Vector(B)
    d = (B - A).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    s = d.cross(up).normalized()
    u2 = s.cross(d).normalized()
    ring = lambda P: [P + s * w / 2 + u2 * h / 2, P - s * w / 2 + u2 * h / 2,
                      P - s * w / 2 - u2 * h / 2, P + s * w / 2 - u2 * h / 2]
    ra, rb = ring(A), ring(B)
    c = (A + B) / 2
    q = quv(uv)
    for i in range(4):
        j = (i + 1) % 4
        mp(m, [ra[i], ra[j], rb[j], rb[i]], q, tex, centre=c)
    if ends:
        mp(m, ra, q, tex, centre=c)
        mp(m, rb, q, tex, centre=c)


def prism(m, bot, top, tex, uv, cap=True):
    """Convex-ish solid between two 4-point rings (bottom, top)."""
    c = sum([Vector(p) for p in bot + top], Vector()) / 8
    q = quv(uv)
    for i in range(4):
        j = (i + 1) % 4
        mp(m, [bot[i], bot[j], top[j], top[i]], q, tex, centre=c)
    if cap:
        mp(m, top, q, tex, centre=c)


def ring(cx, cy, hx, hy, z, dx=0.0, dy=0.0, zj=(0, 0, 0, 0)):
    return [(cx - hx + dx, cy - hy + dy, z + zj[0]), (cx + hx + dx, cy - hy + dy, z + zj[1]),
            (cx + hx + dx, cy + hy + dy, z + zj[2]), (cx - hx + dx, cy + hy + dy, z + zj[3])]


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def droop(x):
    return DROOP_D * smooth((x - DROOP_X0) / (X1 - DROOP_X0))


def rdz(x, s):
    """Roof displacement at x, s (s = 0 eave .. 1 ridge): ridge sags pull the ridge more than the eaves."""
    d = sum(depth * math.exp(-((x - xc) / hw) ** 2) for xc, hw, depth in SAGS)
    return -d * (0.35 + 0.65 * s) - droop(x)


def front_pt(x, s):
    return (x, (Y0 - OVER) * (1 - s), EAVE_Z + (RIDGE - EAVE_Z) * s + rdz(x, s))


def back_pt(x, s):
    return (x, (Y1 + OVER) * (1 - s), EAVE_Z + (RIDGE - EAVE_Z) * s + rdz(x, s))


def wxx(px):
    return X0 + px / PX_U


def wzz(py):
    return WH * (1 - py / FH)


def build_poor():
    rnd = random.Random(7311)
    m = Mesh('env_bld_terrace_poor')
    ST = P_ATLAS
    yf_b = Y0 - 0.28                       # planks sit 0.28 proud of the wall
    stone = atlas_uv('stone')
    planks = lambda band=None: atlas_uv('planks', band=rnd.randrange(4) if band is None else band)
    tin_uv = atlas_uv('tin')
    rust_uv = atlas_uv('rust')
    dark_uv = atlas_uv('dark')
    timber_uv = atlas_uv('timber')
    paper_uv = atlas_uv('wallpaper')

    # ---- front facade: main wall to the slump line, then the broken house-9 corner -----------------
    def fuv(x, z):
        return ((x - X0) / LEN, z / WH)
    XC = DROOP_X0
    p = [(X0, Y0, 0), (XC, Y0, 0), (XC, Y0, WH), (X0, Y0, WH)]
    m.poly(p, [fuv(a[0], a[2]) for a in p], P_FAC)
    notch = [(44.0, 0.0), (45.6, 0.3), (45.8, 3.0), (46.4, 2.6), (46.6, 0.4), (48.2, 0.3), (48.4, 4.6),
             (49.1, 3.4), (49.3, 0.5), (50.0, 0.1)]
    top = [(x, WH - droop(x) - n) for x, n in notch]
    p = [(XC, Y0, 0), (X1, Y0, 0)] + [(x, Y0, z) for x, z in reversed(top)]
    # polygon order: bottom-left -> bottom-right -> up the right edge -> back along the jagged top
    m.poly(p, [fuv(a[0], a[2]) for a in p], P_FAC)

    # ---- cornice: segments with chunks missing, none over the collapsed corner ---------------------
    cz0 = WH - 3.0 / PX_V
    cv0 = 1 - 3.0 / FH
    gaps = [(-37.0, -34.2), (-9.0, -6.0), (16.5, 19.5), (33.0, 36.0)]
    edges = [X0] + [v for g in gaps for v in g] + [XC]
    for xa, xb in zip(edges[0::2], edges[1::2]):
        ua, ub = (xa - X0) / LEN, (xb - X0) / LEN
        m.poly([(xa, Y0 - 0.6, cz0), (xb, Y0 - 0.6, cz0), (xb, Y0 - 0.6, WH), (xa, Y0 - 0.6, WH)],
               [(ua, cv0), (ub, cv0), (ub, 1), (ua, 1)], P_FAC)
        for x in (xa, xb):
            mp(m, [(x, Y0 - 0.6, cz0), (x, Y0, cz0), (x, Y0, WH), (x, Y0 - 0.6, WH)], [(0.2, 0.2)] * 4, ST,
               centre=((xa + xb) / 2, Y0 - 0.3, (cz0 + WH) / 2))
        m.poly([(xa, Y0, cz0), (xb, Y0, cz0), (xb, Y0 - 0.6, cz0), (xa, Y0 - 0.6, cz0)], [(0.1, 0.9)] * 4, ST) \
            if False else None

    # ---- end walls and back wall ---------------------------------------------------------------------
    def end(x, ya, yb, hz):
        pts = [(x, ya, 0), (x, yb, 0), (x, yb, WH - hz), (x, 0, RIDGE - hz), (x, ya, WH - hz)]
        us = [((p_[1] - Y0) / DEP) for p_ in pts]
        m.poly(pts, [(u, p_[2] / RIDGE) for u, p_ in zip(us, pts)], P_BRICK)
    end(X1, Y0, Y1, DROOP_D + 0.1)
    end(X0, Y1, Y0, 0.0)
    back = [(X1, Y1, 0), (X0, Y1, 0), (X0, Y1, WH), (XC, Y1, WH), (46.0, Y1, WH - droop(46.0)),
            (48.0, Y1, WH - droop(48.0)), (X1, Y1, WH - droop(X1) - 0.1)]
    m.poly(back, [((X1 - p_[0]) / LEN, 0.8 * p_[2] / WH) for p_ in back], P_BRICK)
    # house 9 interior seen through the broken corner: wallpapered back wall + a floor slab
    inner = [(XC, Y1 - 0.05, 6.8), (X1, Y1 - 0.05, 6.8), (X1, Y1 - 0.05, WH - droop(X1) - 0.2),
             (48.0, Y1 - 0.05, WH - droop(48.0)), (46.0, Y1 - 0.05, WH - droop(46.0)), (XC, Y1 - 0.05, WH)]
    mp(m, inner, [(paper_uv[0] + (paper_uv[2] - paper_uv[0]) * (p_[0] - XC) / 6.0,
                   paper_uv[1] + (paper_uv[3] - paper_uv[1]) * (p_[2] - 6.8) / 8.2) for p_ in inner], ST,
       face_dir=(0, -1, 0))
    mp(m, [(XC, Y0 + 0.3, 9.0), (X1, Y0 + 0.3, 9.0), (X1, Y1 - 0.05, 9.0), (XC, Y1 - 0.05, 9.0)],
       quv(timber_uv), ST, face_dir=(0, 0, 1))

    # ---- roof: per-column strips with pits cut out, ridge sag + house-9 slump ------------------------
    colx = sorted(set([round(X0 + 5.0 * i, 3) for i in range(21)] + [44.0, 46.0, 48.0] +
                      [v for pit in PITS for v in pit['x']]))
    for slope, ptf, nrm in (('front', front_pt, FRONT_N), ('back', back_pt, BACK_N)):
        for xa, xb in zip(colx[:-1], colx[1:]):
            rows = [0.0, 1.0]
            pit = next((pt for pt in PITS if slope == 'front' and pt['x'][0] <= xa and xb <= pt['x'][1]), None)
            if pit:
                rows = [0.0, pit['s'][0], pit['s'][1], 1.0]
            for sa, sb in zip(rows[:-1], rows[1:]):
                if pit and sa == pit['s'][0]:
                    continue
                pts = [ptf(xa, sa), ptf(xb, sa), ptf(xb, sb), ptf(xa, sb)]
                uvs = [((xa - X0) / LEN, sa), ((xb - X0) / LEN, sa), ((xb - X0) / LEN, sb), ((xa - X0) / LEN, sb)]
                mp(m, pts, uvs, P_ROOF, face_dir=nrm)
    # pits: dark walls + attic floor + splintered rafters
    for pit in PITS:
        (xa, xb), (sa, sb), zf = pit['x'], pit['s'], pit['floor']
        a0, a1, b0, b1 = front_pt(xa, sa), front_pt(xb, sa), front_pt(xa, sb), front_pt(xb, sb)
        c = ((xa + xb) / 2, (a0[1] + b0[1]) / 2, zf + 1.0)
        dq = quv(dark_uv)
        mp(m, [(xa, a0[1], zf), (xb, a0[1], zf), (xb, b0[1], zf), (xa, b0[1], zf)], dq, ST, centre=(c[0], c[1], zf - 1))
        mp(m, [(xa, b0[1], zf), (xb, b0[1], zf), b1, b0], dq, ST, centre=c)          # far wall, faces the camera
        mp(m, [(xa, a0[1], zf), (xa, b0[1], zf), b0, a0], dq, ST, centre=c)
        mp(m, [(xb, a0[1], zf), (xb, b0[1], zf), b1, a1], dq, ST, centre=c)
        # rafters: three broken timbers poking up out of the hole
        for k, fr in enumerate((0.25, 0.55, 0.82)):
            xr = xa + (xb - xa) * fr
            lo = (xr, b0[1] + 0.2, zf + 0.2)
            hi = (xr + rnd.uniform(-0.6, 0.6), a0[1] * 0.45 + b0[1] * 0.55, front_pt(xr, (sa + sb) / 2)[2] + rnd.uniform(0.2, 0.9))
            bar(m, lo, hi, 0.45, 0.4, ST, timber_uv)
    # overlays on the front slope: tarps and a tin patch (0.18 above the tiles; tarp corners flap up)
    for k, tp in enumerate(TARPS):
        (xa, xb), (sa, sb) = tp['x'], tp['s']
        pts = [Vector(front_pt(xa, sa)) + FRONT_N * 0.18, Vector(front_pt(xb, sa)) + FRONT_N * 0.18,
               Vector(front_pt(xb, sb)) + FRONT_N * (0.18 + (0.7 if tp['tex'] == 'tarp' else 0.0)),
               Vector(front_pt(xa, sb)) + FRONT_N * 0.18]
        uv = atlas_uv(tp['tex'])
        mp(m, pts, quv(uv), ST, face_dir=FRONT_N)

    # ---- chimneys: leaning, broken, capless, a stump, a crooked one -----------------------------------
    chim = {-40: dict(h=1.7, lean=(1.3, -0.5), cap=(1.8, -0.7)),
            -20: dict(h=0.9, lean=(0, 0), cap=None, jag=(0.9, 0.2, 0.6, 0.0)),
            0: dict(h=1.5, lean=(0.2, 0.0), cap='half'),
            20: dict(h=0.35, lean=(0, 0), cap=None, jag=(0.3, 0.0, 0.2, 0.35)),
            40: dict(h=1.6, lean=(-1.0, 0.3), cap=(-1.4, 0.4))}
    bq = (0.1, 0.3, 0.9, 0.9)
    for cx, cd in chim.items():
        rz = RIDGE + rdz(cx, 1.0)
        z0, z1 = rz - 1.5, rz + cd['h']
        bot = ring(cx, 0, 1.0, 0.8, z0)
        topr = ring(cx, 0, 1.0, 0.8, z1, cd['lean'][0], cd['lean'][1], cd.get('jag', (0, 0, 0, 0)))
        prism(m, bot, topr, P_BRICK, bq, cap=True)
        if cd['cap'] == 'half':
            prism(m, ring(cx - 0.5, 0, 0.75, 1.0, z1), ring(cx - 0.5, 0, 0.75, 1.0, z1 + 0.5, 0, 0, (0, 0.1, 0.1, 0)), ST, stone)
        elif cd['cap']:
            prism(m, ring(cx, 0, 1.25, 1.0, z1, cd['cap'][0], cd['cap'][1], (0, 0.15, 0.0, -0.1)),
                  ring(cx, 0, 1.25, 1.0, z1 + 0.5, cd['cap'][0], cd['cap'][1], (0, 0.15, 0.0, -0.1)), ST, stone)

    # ---- gutters and downpipes ------------------------------------------------------------------------
    gy_b, gy_f = Y0 - 0.5, Y0 - 0.78
    for hi, ps in enumerate(POOR['houses']):
        xa, xb = X0 + 10.0 * hi + 0.2, X0 + 10.0 * (hi + 1) - 0.2
        za, zb_ = EAVE_Z + rdz(xa, 0) - 0.2, EAVE_Z + rdz(xb, 0) - 0.2
        g = ps['gutter']
        fc = ('front', 'top')
        if g == 'ok':
            beam(m, (xa, za), (xb, zb_), 0.35, gy_b, gy_f, ST, rust_uv, fc)
        elif g == 'sag':
            xm = (xa + xb) / 2
            zm = (za + zb_) / 2 - 0.9
            beam(m, (xa, za), (xm, zm), 0.35, gy_b, gy_f, ST, rust_uv, fc)
            beam(m, (xm, zm), (xb, zb_), 0.35, gy_b, gy_f, ST, rust_uv, fc)
        elif g == 'hang':
            beam(m, (xa, za), (xb - 3.0, zb_ - 0.4), 0.35, gy_b, gy_f, ST, rust_uv, fc)
            beam(m, (xb - 3.0, zb_ - 0.4), (xb - 1.8, zb_ - 3.2), 0.35, gy_b, gy_f, ST, rust_uv, fc)
    pipe = (Y0 - 0.45, Y0)
    pf = ('front', 'top', 'bottom')
    beam(m, (-30.0, 14.3), (-30.0, 0.0), 0.35, pipe[1], pipe[0], ST, rust_uv, pf)
    beam(m, (10.0, 14.3), (10.0, 7.2), 0.35, pipe[1], pipe[0], ST, rust_uv, pf)
    beam(m, (10.0, 7.2), (11.4, 3.8), 0.35, pipe[1], pipe[0], ST, rust_uv, pf)
    beam(m, (30.0, 5.5), (30.0, 0.0), 0.35, pipe[1], pipe[0], ST, rust_uv, pf)

    # ---- boards ------------------------------------------------------------------------------------
    def board_opening(xl, xr, zb_, zt, kind):
        """Planks nailed across an opening [xl, xr] x [zb_, zt]; kind 0 = three, 1 = two + diagonal, 2 = X + one."""
        w, h = xr - xl, zt - zb_
        th = 0.5

        def hz(fr, tilt):
            ex = rnd.uniform(0.15, 0.55)
            z = zb_ + h * fr
            beam(m, (xl - ex, z - tilt / 2), (xr + rnd.uniform(0.15, 0.55), z + tilt / 2), th, Y0, yf_b, ST,
                 planks(), ('front', 'top'))

        def dg(flip):
            xa_, xb_ = (xl - 0.2, xr + 0.2)
            za_, zb2 = (zb_ - 0.1, zt + 0.1)
            if flip:
                za_, zb2 = zb2, za_
            beam(m, (xa_, za_), (xb_, zb2), th, Y0, yf_b - 0.04, ST, planks(), ('front', 'top'))
        if kind == 0:
            for fr in (0.17, 0.5, 0.83):
                hz(fr, rnd.uniform(-0.3, 0.3))
        elif kind == 1:
            hz(0.2, rnd.uniform(-0.2, 0.2))
            hz(0.78, rnd.uniform(-0.2, 0.2))
            dg(rnd.random() < 0.5)
        else:
            dg(False)
            dg(True)
            hz(0.5, rnd.uniform(-0.2, 0.2))

    for hi, (hs, ps) in enumerate(zip(HOUSES, POOR['houses'])):
        x0 = hs['x']
        door_left = hs['door'] == 'left'
        for key, (ya, yb) in (('w3', (7, 18)), ('w2', (26, 38))):
            for side, wx in enumerate((5, 21)):
                if ps[key][side] == 'boarded':
                    board_opening(wxx(x0 + wx), wxx(x0 + wx + 6), wzz(yb), wzz(ya), rnd.randrange(3))
        dxp = x0 + (DP['left_x'] if door_left else DP['right_x'])
        if hs['shop']:
            if ps['gf'] == 'shop_boarded':
                zb_, zt = wzz(60), wzz(50.5)
                xl, xr = wxx(x0 + 3), wxx(x0 + 21)
                for fr, tl_ in ((0.12, 0.2), (0.4, -0.25), (0.68, 0.15), (0.92, -0.1)):
                    z = zb_ + (zt - zb_) * fr
                    beam(m, (xl - 0.3, z - tl_ / 2), (xr + 0.3, z + tl_ / 2), 0.5, Y0, yf_b, ST, planks(), ('front', 'top'))
        else:
            wxg = x0 + (18 if door_left else 3)
            if ps['gf'] == 'boarded':
                board_opening(wxx(wxg), wxx(wxg + 9), wzz(58), wzz(49), rnd.randrange(3))
            if ps['door'] == 'boarded':
                board_opening(wxx(dxp) + 0.1, wxx(dxp + DP['w']) - 0.1, wzz(61) + 0.1, wzz(47), 2 if hi % 2 else 0)

    # ---- canopies, steps, balconies, shutters, laundry --------------------------------------------------
    zb = (FH - 40.0) / PX_V - 0.15
    for hi, (hs, ps) in enumerate(zip(HOUSES, POOR['houses'])):
        x0 = hs['x']
        if not hs['shop']:
            px = x0 + (DP['left_x'] if hs['door'] == 'left' else DP['right_x'])
            dcx = X0 + (px + DP['w'] / 2) / PX_U
            cn = ps['canopy']
            cy = (Y0, Y0 - 0.78)
            if cn == 'ok':
                beam(m, (dcx - 2, 4.72), (dcx + 2, 4.72), 0.35, *cy, ST, stone, ('front', 'top', 'bottom'))
            elif cn == 'tilt':
                beam(m, (dcx - 2, 3.7), (dcx + 2, 4.75), 0.35, *cy, ST, stone, ('front', 'top', 'bottom', 'a'))
            elif cn == 'half':
                beam(m, (dcx, 4.72), (dcx + 2, 4.72), 0.35, *cy, ST, stone, ('front', 'top', 'bottom', 'a'))
            st = ps['steps']
            if st == 'ok':
                beam(m, (dcx - 1.7, 0.22), (dcx + 1.7, 0.22), 0.44, Y0, Y0 - 0.55, ST, stone, ('front', 'top'))
            elif st == 'cracked':
                beam(m, (dcx - 0.1, 0.17), (dcx + 1.7, 0.17), 0.34, Y0, Y0 - 0.5, ST, stone, ('front', 'top', 'a'))
        bal = ps['balcony']
        if bal:
            bcx = X0 + (x0 + 16) / PX_U
            zc = zb + 0.175
            by = (Y0, Y0 - 0.8)
            if bal == 'ok':
                beam(m, (bcx - 4, zc), (bcx + 4, zc), 0.35, *by, ST, stone, ('front', 'top', 'bottom', 'a', 'b'))
            elif bal == 'droop':
                beam(m, (bcx - 4, zc - 1.5), (bcx + 4, zc), 0.35, *by, ST, stone, ('front', 'top', 'bottom', 'a', 'b'))
            else:
                beam(m, (bcx, zc), (bcx + 4, zc), 0.35, *by, ST, stone, ('front', 'top', 'bottom', 'a'))
            if hi in (4, 5):   # laundry on the line
                for k, off in enumerate((-2.8, -0.4, 2.2)):
                    cx = bcx + off
                    zt = zc + 2.6 + rnd.uniform(-0.2, 0.2)
                    uvc = atlas_uv('cloth', bands=4, bx=(hi + k) % 4)
                    mp(m, [(cx - 0.55, Y0 - 0.5, zt - 1.3), (cx + 0.55, Y0 - 0.5, zt - 1.3 + rnd.uniform(-0.15, 0.15)),
                           (cx + 0.55, Y0 - 0.5, zt), (cx - 0.55, Y0 - 0.5, zt)], quv(uvc), ST, face_dir=(0, -1, 0))
        for nm in ps['shutter_hang']:
            key, side = nm[:2], nm[2]
            ya, yb = (7, 18) if key == 'w3' else (26, 38)
            wl = wxx(x0 + (5 if side == 'L' else 21))
            wr = wxx(x0 + (5 if side == 'L' else 21) + 6)
            zt = wzz(ya) + 0.15
            sgn = 1 if side == 'L' else -1
            hx_ = (wl - 0.35) if side == 'L' else (wr + 0.35)
            th = math.radians(26) * -sgn
            W_, H_ = 0.75, 3.0
            wv, dv = Vector((sgn, 0)), Vector((0, -1))
            rot = lambda v: Vector((v.x * math.cos(th) - v.y * math.sin(th), v.x * math.sin(th) + v.y * math.cos(th)))
            wv, dv = rot(wv), rot(dv)
            A_ = Vector((hx_, zt))
            pts2 = [A_, A_ + wv * W_, A_ + wv * W_ + dv * H_, A_ + dv * H_]
            ys = [Y0 - 0.06, Y0 - 0.1, Y0 - 0.74, Y0 - 0.7]
            uvs = [(0, 1), (1, 1), (1, 0), (0, 0)]
            su = atlas_uv('shutter')
            mp(m, [(p2.x, y, p2.y) for p2, y in zip(pts2, ys)],
               [(su[0] + (su[2] - su[0]) * u, su[1] + (su[3] - su[1]) * v) for u, v in uvs], ST, face_dir=(0, -1, 0))

    # ---- satellite dishes -------------------------------------------------------------------------------
    for dxw, dzw in ((-15.0, 10.0), (15.0, 9.9), (35.0, 10.1)):
        n = Vector((0, -1.0, 0.5)).normalized()
        a_ = Vector((1, 0, 0))
        b_ = n.cross(a_).normalized()
        c0 = Vector((dxw, Y0 - 0.38, dzw))
        rim = [c0 + 0.95 * (math.cos(t * math.pi / 4) * a_ + math.sin(t * math.pi / 4) * b_) for t in range(8)]
        ctr = c0 - n * 0.22
        du = atlas_uv('dish')
        for i in range(8):
            mp(m, [ctr, rim[i], rim[(i + 1) % 8]], [((du[0] + du[2]) / 2, (du[1] + du[3]) / 2), (du[0], du[1]), (du[2], du[1])], ST, face_dir=n)
        bar(m, (dxw, Y0 - 0.02, dzw - 0.3), tuple(ctr), 0.22, 0.22, ST, rust_uv)

    # ---- shoring: left end house and the collapsed right end -----------------------------------------------
    sh = (Y0, Y0 - 0.6)
    allf = ('front', 'top', 'bottom', 'a', 'b')
    beam(m, (-49.3, 0.0), (-49.3, 9.6), 0.6, *sh, ST, timber_uv, allf)
    beam(m, (-49.0, 1.2), (-45.4, 8.8), 0.5, *sh, ST, timber_uv, allf)
    beam(m, (44.7, 0.0), (44.7, 10.2), 0.6, *sh, ST, timber_uv, allf)
    beam(m, (46.1, 0.3), (44.9, 8.6), 0.5, *sh, ST, timber_uv, allf)
    beam(m, (48.9, 0.3), (47.2, 8.0), 0.5, *sh, ST, timber_uv, allf)
    beam(m, (44.3, 9.2), (49.8, 9.5), 0.45, *sh, ST, timber_uv, allf)
    return m


def bm_bounds(m):
    vs = [v.co for v in m.bm.verts]
    return (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
            Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))


def center_and_export(m, name, centre=None):
    """centre=None: centre on the model's own bbox (normal). The poor model passes the NORMAL model's bbox
    centre instead, so both GLBs share one pivot and the poor base lands on the same ground (a lower or
    higher poor silhouette must not move its feet)."""
    mats = [dt.material(t, os.path.join(TEXDIR, t + '.png')) for t in m.mats]
    ob = dt.mesh_object(m.name, m.bm, mats)
    mn, mx = dt.bounds([ob])
    c = (mn + mx) / 2 if centre is None else centre
    ob.data.transform(__import__('mathutils').Matrix.Translation(-c))
    ob.data.update()
    mn, mx = dt.bounds([ob])
    path = dt.export_glb([ob], os.path.join(OUTDIR, name + '.glb'))
    size = mx - mn
    print('BLD_TERRACE', name, 'size x/y/z', tuple(round(v, 2) for v in size), 'half height', round(size.z / 2, 3),
          'tris', dt.tri_count([ob]))
    return path


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = argv or ['env_bld_terrace_normal', 'env_bld_terrace_poor']
    for name in names:
        dt.reset()
        if name.endswith('poor'):
            ref = build('normal')                     # only its bbox is used: the shared pivot
            mn, mx = bm_bounds(ref)
            ref.bm.free()
            center_and_export(build_poor(), name, (mn + mx) / 2)
        else:
            center_and_export(build('normal'), name)


main()
