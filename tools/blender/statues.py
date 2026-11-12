"""Statues family: the empty pedestal and the three shop statues of the leader (bronze, silver, gold).

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/statues.py -- [env_statue_pedestal env_statue_bronze ...] [--check <dir>]

No model names = rebuild all four. Writes public/models/map/<name>.glb (textures from
public/textures/map/env_statue_*.png, painted by tools/texgen/statues.py; contract
tools/texgen/statues_layout.json). `--check <dir>` re-imports each GLB and renders it the way the game
shows it (Workbench FLAT light, back faces culled) from the front, 3/4 and the Street camera's pitch.

Frame: Blender Z-up, game units (a citizen is 6.66), -Y faces the Street camera, origin at the centre of
the pedestal footprint on the ground. The game lights the street with one ambient light only, so all form
is baked: every metal face maps onto the metal sheet's exposure ramp, V picked per vertex from hemisphere
occlusion (statue + pedestal + ground) and convexity (`metal_ramp_rule` in the contract).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dt_common as dt  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
with open(os.path.join(ROOT, 'tools', 'texgen', 'statues_layout.json'), encoding='utf-8') as _fh:
    CONTRACT = json.load(_fh)
PED = CONTRACT['textures']['env_statue_pedestal']['regions']
PED_W, PED_H = CONTRACT['textures']['env_statue_pedestal']['size']
MET = CONTRACT['metal_regions']
MET_W, MET_H = 64, 64
PED_MAT = 'env_statue_pedestal'
TOP_Z = 5.0           # the pedestal top the figures stand on
STRIP_PX = 20.0       # pedestal strips: px per unit along U
RAMP_PX = 6.0         # metal ramp: px per unit along U
HEAD_SCALE = 1.15     # the leader's head (and cap) a touch big, so the moustache and cap read at street distance


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


# ---------------------------------------------------------------------------------------------------------
# A small mesh builder: faces carry their material and (for decals and strips) pixel UVs; metal faces
# without UVs get ramp UVs at the end.

class Mesh:
    def __init__(self):
        self.v = []
        self.f = []

    def vert(self, p):
        self.v.append(Vector(p))
        return len(self.v) - 1

    def verts(self, pts):
        return [self.vert(p) for p in pts]

    def normal(self, idx):
        n = Vector((0.0, 0.0, 0.0))
        ps = [self.v[i] for i in idx]
        for i, a in enumerate(ps):
            b = ps[(i + 1) % len(ps)]
            n.x += (a.y - b.y) * (a.z + b.z)
            n.y += (a.z - b.z) * (a.x + b.x)
            n.z += (a.x - b.x) * (a.y + b.y)
        return n

    def centre(self, idx):
        return sum((self.v[i] for i in idx), Vector()) / len(idx)

    def face(self, idx, mat, away=None, uv=None, tag=''):
        """Adds a face; with `away` it is wound so its normal points away from that point."""
        idx = list(idx)
        if away is not None:
            if self.normal(idx).dot(self.centre(idx) - Vector(away)) < 0:
                idx.reverse()
                if uv:
                    uv = list(reversed(uv))
        self.f.append(dict(v=idx, mat=mat, uv=uv, tag=tag))
        return len(self.f) - 1

    def merge(self, other, M=Matrix.Identity(4)):
        off = len(self.v)
        self.v.extend(M @ p for p in other.v)
        for f in other.f:
            g = dict(f)
            g['v'] = [i + off for i in f['v']]
            self.f.append(g)

    def tris(self):
        return sum(len(f['v']) - 2 for f in self.f)


def frame(axis, xref):
    a = Vector(axis).normalized()
    x = Vector(xref) - a * a.dot(Vector(xref))
    if x.length < 1e-6:
        x = a.orthogonal()
    x.normalize()
    return a, x, a.cross(x)


def ring(c, axis, xref, rx, ry, n, phase=None):
    """n points round c in the plane normal to axis; xref picks the local x (rx) direction."""
    a, x, y = frame(axis, xref)
    ph = math.pi / n if phase is None else phase
    return [Vector(c) + x * (rx * math.cos(ph + 2 * math.pi * i / n)) + y * (ry * math.sin(ph + 2 * math.pi * i / n))
            for i in range(n)]


def loft(m, rings, mat, cap0=False, cap1=False, tag=''):
    """Quads between consecutive rings (lists of the same length), wound outward from the centre line."""
    ids = [m.verts(pts) for _, pts in rings]
    n = len(ids[0])
    out = []
    for k in range(len(rings) - 1):
        c0, c1 = Vector(rings[k][0]), Vector(rings[k + 1][0])
        seg = c1 - c0
        for i in range(n):
            j = (i + 1) % n
            q = [ids[k][i], ids[k][j], ids[k + 1][j], ids[k + 1][i]]
            cen = m.centre(q)
            t = 0.0 if seg.length_squared < 1e-12 else max(0.0, min(1.0, (cen - c0).dot(seg) / seg.length_squared))
            out.append(m.face(q, mat, away=c0 + seg * t, tag=tag))
    if cap0:
        out.append(m.face(ids[0], mat, away=rings[1][0], tag=tag))
    if cap1:
        out.append(m.face(ids[-1], mat, away=rings[-2][0], tag=tag))
    return out


def chain(m, pts, radii, n, mat, xref=(0, 0, 1), cap0=False, cap1=False, phase=None, tag=''):
    """A tapered tube along a polyline; radii are r or (rx, ry) per point."""
    pts = [Vector(p) for p in pts]
    rings = []
    for i, p in enumerate(pts):
        a = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        r = radii[i]
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        rings.append((p, ring(p, a, xref, rx, ry, n, phase)))
    return loft(m, rings, mat, cap0, cap1, tag)


def box(m, c, hx, hy, hz, mat, R=None, skip=(), tag='', uvs=None):
    """Box round c (R: 3x3 rotation). skip: any of '+x -x +y -y +z -z'. uvs: {side: [4 px uvs]}."""
    R = R or Matrix.Identity(3)
    c = Vector(c)
    P = lambda sx, sy, sz: c + R @ Vector((sx * hx, sy * hy, sz * hz))  # noqa: E731
    sides = {
        '-y': [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)],
        '+y': [(1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)],
        '-x': [(-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)],
        '+x': [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)],
        '+z': [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)],
        '-z': [(-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)],
    }
    out = []
    for s, cs in sides.items():
        if s in skip:
            continue
        ids = m.verts([P(*k) for k in cs])
        out.append(m.face(ids, mat, away=c, uv=(uvs or {}).get(s), tag=tag))
    return out


def plate(m, pts, mat, tag=''):
    """A double-sided flat polygon (separate vertices per side so the game's culling keeps both)."""
    a = m.verts(pts)
    b = m.verts(pts)
    n = m.normal(a)
    c = m.centre(a)
    return [m.face(a, mat, away=c - n, tag=tag), m.face(b[::-1], mat, away=c + n, tag=tag)]


def rect_px(rect, u, v, inset=1.5):
    """Normalised (u, v) inside a contract rect (v = 0 at the rect's top) -> pixel uv."""
    x, y, w, h = rect
    return (x + inset + u * (w - 2 * inset), y + inset + v * (h - 2 * inset))


def planar_px(m, face_ids, rect, origin, ax_u, ax_v, size_u, size_v, inset=1.5):
    """Maps faces planar onto a decal rect: u along ax_u over size_u (centred on origin), v down ax_v."""
    o, au, av = Vector(origin), Vector(ax_u).normalized(), Vector(ax_v).normalized()
    for fi in face_ids:
        f = m.f[fi]
        uv = []
        for i in f['v']:
            d = m.v[i] - o
            u = max(0.0, min(1.0, d.dot(au) / size_u + 0.5))
            v = max(0.0, min(1.0, d.dot(av) / size_v + 0.5))
            uv.append(rect_px(rect, u, v, inset))
        f['uv'] = uv


# ---------------------------------------------------------------------------------------------------------
# Pedestal: stepped granite plinth, cornice, blank bronze plaque on -Y, optional wilted wreath

STEPS = [(0.0, 0.6, 0.0), (0.6, 1.15, 0.4)]   # (z0, z1, inset from the footprint edge)
DIE = (1.15, 4.2, 0.85)
CORNICE = (4.2, 4.45, 4.85, 0.55)             # slope bottom, slope top, wash bottom, inset
TOP_INSET = 0.75


def side_quads(hx, hy, z0, z1, hx1=None, hy1=None):
    """The four side quads of a (possibly tapered) ring between z0 (hx, hy) and z1 (hx1, hy1).
    Yields (side, [p0 p1 p2 p3] bottom-left, bottom-right, top-right, top-left seen from outside, along)."""
    hx1 = hx if hx1 is None else hx1
    hy1 = hy if hy1 is None else hy1
    b = lambda sx, sy: Vector((sx * hx, sy * hy, z0))   # noqa: E731
    t = lambda sx, sy: Vector((sx * hx1, sy * hy1, z1))  # noqa: E731
    yield '-y', [b(-1, -1), b(1, -1), t(1, -1), t(-1, -1)], 'x'
    yield '+x', [b(1, -1), b(1, 1), t(1, 1), t(1, -1)], 'y'
    yield '+y', [b(1, 1), b(-1, 1), t(-1, 1), t(1, 1)], '-x'
    yield '-x', [b(-1, 1), b(-1, -1), t(-1, -1), t(-1, 1)], '-y'


def along(p, axis):
    return {'x': p.x, 'y': p.y, '-x': -p.x, '-y': -p.y}[axis]


def strip_uv(pts, axis, rect, row0, row1, ztop, zbot):
    """Strip UV: U = along * STRIP_PX (wraps), V maps ztop..zbot onto rows row0..row1 of the rect."""
    x, y, w, h = rect
    out = []
    for p in pts:
        f = (ztop - p.z) / (ztop - zbot) if ztop != zbot else 0.0
        out.append((x + along(p, axis) * STRIP_PX, y + row0 + f * (row1 - row0)))
    return out


def pedestal(m, hx, hy, wreath=False):
    """Stepped plinth with footprint 2hx x 2hy, top at TOP_Z. Returns the plaque centre."""
    pc = Vector((0, 0, 2.0))
    # steps: risers + trapezoid treads (strip 'step': rows 0-7 tread, 8-23 riser)
    for k, (z0, z1, ins) in enumerate(STEPS):
        ax, ay = hx - ins, hy - ins
        for side, pts, ax_name in side_quads(ax, ay, z0, z1):
            uv = strip_uv(pts, ax_name, PED['step']['rect'], 9.5, 22.5, z1, z0)
            m.face(m.verts(pts), PED_MAT, away=pc, uv=uv, tag='riser')
        nxt = STEPS[k + 1][2] if k + 1 < len(STEPS) else DIE[2]
        ix, iy = hx - nxt, hy - nxt
        for side, pts, ax_name in side_quads(ax, ay, z1, z1, ix, iy):
            # pts: outer edge (0, 1) and inner edge (2, 3) at the same z; rows by depth
            rect = PED['step']['rect']
            uv = [(rect[0] + along(p, ax_name) * STRIP_PX, rect[1] + (1.5 if i < 2 else 6.5)) for i, p in enumerate(pts)]
            m.face(m.verts(pts), PED_MAT, away=Vector((0, 0, z1 - 1.0)), uv=uv, tag='tread')
    # die
    z0, z1, ins = DIE
    dx, dy = hx - ins, hy - ins
    for side, pts, ax_name in side_quads(dx, dy, z0, z1):
        m.face(m.verts(pts), PED_MAT, away=pc, uv=strip_uv(pts, ax_name, PED['die']['rect'], 1.5, 62.5, z1, z0), tag='die')
    # cornice: under-slope (die's shadowed top rows), vertical face, upward wash, top
    zs0, zs1, zw0, cins = CORNICE
    cx, cy = hx - cins, hy - cins
    tx, ty = hx - TOP_INSET, hy - TOP_INSET
    for side, pts, ax_name in side_quads(dx, dy, zs0, zs1, cx, cy):
        m.face(m.verts(pts), PED_MAT, away=Vector((0, 0, zs1 + 6.0)),
               uv=strip_uv(pts, ax_name, PED['die']['rect'], 0.5, 1.5, zs1, zs0), tag='underslope')
    for side, pts, ax_name in side_quads(cx, cy, zs1, zw0):
        m.face(m.verts(pts), PED_MAT, away=pc, uv=strip_uv(pts, ax_name, PED['cap']['rect'], 9.0, 14.5, zw0, zs1), tag='cornice')
    for side, pts, ax_name in side_quads(cx, cy, zw0, TOP_Z, tx, ty):
        m.face(m.verts(pts), PED_MAT, away=Vector((0, 0, zw0 - 6.0)),
               uv=strip_uv(pts, ax_name, PED['cap']['rect'], 6.5, 1.5, zw0, TOP_Z), tag='wash')
    top = [Vector((-tx, -ty, TOP_Z)), Vector((tx, -ty, TOP_Z)), Vector((tx, ty, TOP_Z)), Vector((-tx, ty, TOP_Z))]
    dr = PED['die']['rect']   # the top reuses the die strip, rows 6-54 across its depth
    uv = [(dr[0] + p.x * 11.0, dr[1] + 6.0 + (ty - p.y) / (2 * ty) * 48.0) for p in top]
    m.face(m.verts(top), PED_MAT, away=Vector((0, 0, 0)), uv=uv, tag='top')
    # plaque on the -Y die face: front decal, rim faces on the bright frame pixels
    pw, ph, pd = 1.3, 0.65, 0.08
    pz = 3.3
    py = -dy
    prect = PED['plaque']['rect']
    fr = (prect[0] + 0.5, prect[1] + 0.5, 3, 3)
    rim_uv = [rect_px(fr, u, v, 0.2) for u, v in ((0, 1), (1, 1), (1, 0), (0, 0))]
    front_uv = [rect_px(prect, u, v) for u, v in ((0, 1), (1, 1), (1, 0), (0, 0))]
    box(m, (0, py - pd / 2 + 0.01, pz), pw, pd / 2, ph, PED_MAT, skip=('+y', '-z'),
        uvs={'-y': front_uv, '+x': rim_uv, '-x': rim_uv, '+z': rim_uv, '-z': rim_uv}, tag='plaque')
    if wreath:
        add_wreath(m, dx, dy)
    return Vector((0, py - pd, pz))


def add_wreath(m, dx, dy):
    """A wilted funeral wreath leaning on the die front, right of centre, over the plaque's corner."""
    n = 7
    r_out, r_in, depth = 1.0, 0.42, 0.28
    base = Vector((0.95, -dy - 0.36, STEPS[-1][1] + 0.02))      # bottom of the ring on the tread
    top_lean = Vector((0.0, 0.28, 0.0))                            # leans back toward the die
    up = (Vector((0, 0.28, 2 * r_out))).normalized()
    centre = base + up * r_out
    right = Vector((1, 0, 0))
    fwd = right.cross(up).normalized() * -1.0                     # out of the wreath, toward -Y
    if fwd.y > 0:
        fwd = -fwd
    wrect = PED['wreath']['rect']
    seg_px = (wrect[2] - 3.0) / n

    def P(ang, r, out):
        sag = 0.14 * max(0.0, math.sin(ang)) * (1.0 + 0.4 * math.cos(ang * 3.0))   # wilted: the top sags
        jit = 0.05 * math.sin(ang * 5.0 + 1.3)
        return centre + right * (math.cos(ang) * (r + jit)) + up * (math.sin(ang) * (r + jit) - sag) + fwd * out

    for i in range(n):
        a0 = 2 * math.pi * i / n + 0.2
        a1 = 2 * math.pi * (i + 1) / n + 0.2
        u0 = wrect[0] + 1.5 + i * seg_px
        u1 = u0 + seg_px
        rm = (r_out + r_in) / 2
        outer = [P(a0, r_out, 0.0), P(a1, r_out, 0.0)]
        crest = [P(a0, rm, depth), P(a1, rm, depth)]
        inner = [P(a0, r_in, 0.02), P(a1, r_in, 0.02)]
        yo, ym, yi = wrect[1] + 1.5, wrect[1] + wrect[3] / 2, wrect[1] + wrect[3] - 1.5
        c = centre + fwd * -0.3
        m.face(m.verts([outer[0], outer[1], crest[1], crest[0]]), PED_MAT, away=c,
               uv=[(u0, yo), (u1, yo), (u1, ym), (u0, ym)], tag='wreath')
        m.face(m.verts([crest[0], crest[1], inner[1], inner[0]]), PED_MAT, away=c,
               uv=[(u0, ym), (u1, ym), (u1, yi), (u0, yi)], tag='wreath')
        if math.sin((a0 + a1) / 2) < -0.2:
            continue   # the rim only shows on the upper part
        back = [P(a0, r_out, -0.18), P(a1, r_out, -0.18)]
        m.face(m.verts([back[0], back[1], outer[1], outer[0]]), PED_MAT, away=centre,
               uv=[(u0, yo), (u1, yo), (u1, yo + 3), (u0, yo + 3)], tag='wreath')
    # two ribbon tails hanging from the bottom of the ring onto the tread
    rr = PED['ribbon']['rect']
    edge_y = -(dy + STEPS[1][2] * 0 + 0.45) - 0.03          # front edge of the upper step's tread
    for ang, sw in ((-math.pi / 2 - 0.45, -0.12), (-math.pi / 2 + 0.35, 0.16)):
        t0 = P(ang, r_out * 0.9, 0.2)
        t1 = Vector((t0.x + sw * 0.5, edge_y, STEPS[1][1] + 0.03))
        t2 = Vector((t0.x + sw, edge_y - 0.04, STEPS[0][1] + 0.12))
        w = right * 0.15
        for (a, b, v0, v1) in ((t0, t1, 0.0, 0.4), (t1, t2, 0.4, 1.0)):
            pts = [a - w, a + w, b + w, b - w]
            uv = [rect_px(rr, 0, v0), rect_px(rr, 1, v0), rect_px(rr, 1, v1), rect_px(rr, 0, v1)]
            m.face(m.verts(pts), PED_MAT, away=(a + b) / 2 + Vector((0, 0.5, -0.3)), uv=uv, tag='ribbon')


# ---------------------------------------------------------------------------------------------------------
# Transforms (figures are built in canonical metres, then scaled into place)

def T(v):
    return Matrix.Translation(Vector(v))


def Rx(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'X')


def Ry(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Y')


def Rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


def S(k):
    return Matrix.Scale(k, 4)


# ---------------------------------------------------------------------------------------------------------
# The leader: a generic moustached strongman in a peaked cap and greatcoat. Canonical metres, facing -Y
# (his right hand is -X), origin at his feet (standing) or the saddle seat (riding).

def hand(m, mat, wr, d, kind, extra=None):
    d = Vector(d).normalized()
    wr = Vector(wr)
    chain(m, [wr - d * 0.035, wr + d * 0.035], [0.064, 0.062], 6, mat)            # cuff
    if kind == 'point':
        chain(m, [wr + d * 0.03, wr + d * 0.12], [(0.042, 0.03), (0.036, 0.026)], 4, mat, xref=(0, 0, 1), cap1=True)
        chain(m, [wr + d * 0.11, wr + d * 0.21], [0.019, 0.014], 4, mat, cap1=True)
    elif kind == 'flat':
        chain(m, [wr + d * 0.03, wr + d * 0.14], [(0.045, 0.016), (0.04, 0.013)], 4, mat,
              xref=extra or (0, 0, 1), cap1=True)
    else:  # fist / chest / rein
        chain(m, [wr + d * 0.03, wr + d * 0.10], [0.045, 0.04], 5, mat, cap1=True)


def foot(m, mat, ankle, d, polish=False):
    """Boot foot: three square rings from heel to toe along d (horizontal), toe cap optionally polished."""
    d = Vector(d).normalized()
    a = Vector(ankle)
    heel = a - d * 0.06 + Vector((0, 0, -0.025))
    mid = a + d * 0.07 + Vector((0, 0, -0.035))
    toe = a + d * 0.2 + Vector((0, 0, -0.05))
    side = d.cross(Vector((0, 0, 1)))
    rings = [(heel, ring(heel, d, side, 0.05, 0.055, 4, math.pi / 4)),
             (mid, ring(mid, d, side, 0.056, 0.05, 4, math.pi / 4)),
             (toe, ring(toe, d, side, 0.046, 0.032, 4, math.pi / 4))]
    fs = loft(m, rings, mat, cap0=True, cap1=True)
    if polish:
        toe_faces = [fs[-1]] + [fs[4 + i] for i in range(4) if m.normal(m.f[fs[4 + i]]['v']).z > -0.2]
        planar_px(m, toe_faces, MET['polish']['rect'], toe, side, Vector((0, 0, -1)), 0.14, 0.14)


def leader(mat, pose):
    m = Mesh()
    up = Mesh()                                     # upper body in the waist frame
    loft(up, [((0, 0, -0.035), ring((0, 0, -0.035), (0, 0, 1), (1, 0, 0), 0.18, 0.13, 8)),
              ((0, 0, 0.035), ring((0, 0, 0.035), (0, 0, 1), (1, 0, 0), 0.18, 0.13, 8))], mat)       # belt
    torso = [(0.0, 0.17, 0.12, 0.0), (0.18, 0.19, 0.135, -0.005), (0.36, 0.24, 0.155, -0.02),
             (0.47, 0.235, 0.125, 0.0), (0.53, 0.10, 0.085, 0.0)]
    loft(up, [((0, y, z), ring((0, y, z), (0, 0, 1), (1, 0, 0), rx, ry, 8)) for z, rx, ry, y in torso], mat, cap1=True)
    loft(up, [((0, 0, 0.45), ring((0, 0, 0.45), (0, 0, 1), (1, 0, 0), 0.145, 0.13, 8)),
              ((0, 0.01, 0.585), ring((0, 0.01, 0.585), (0, 0.15, 1), (1, 0, 0), 0.13, 0.12, 8))], mat)   # collar
    skirt = []
    for k, (z, rx, ry, y) in enumerate(pose['skirt']):   # 12-gon with a vertex front and back: the coat's split
        pts = ring((0, y, z), (0, 0, 1), (1, 0, 0), rx, ry, 12, phase=0.0)
        pts[9] = pts[9].lerp(V(0, y, z), pose['fold'][k])
        pts[3] = pts[3].lerp(V(0, y, z), pose['fold'][k] * 0.4)
        skirt.append(((0, y, z), pts))
    loft(up, skirt, mat)
    for sx in (-1, 1):                                                                            # epaulettes
        box(up, (sx * 0.205, 0, 0.478), 0.085, 0.066, 0.02, mat, R=Ry(sx * -14).to_3x3(), skip=('-z',))
        box(up, (sx * 0.282, 0, 0.44), 0.018, 0.064, 0.04, mat, R=Ry(sx * -14).to_3x3(), skip=('+z',))
    med = box(up, (0.095, -0.158, 0.27), 0.062, 0.012, 0.095, mat, skip=('+y',))                 # medals
    planar_px(up, [med[0]], MET['medals']['rect'], (0.095, -0.17, 0.27), (1, 0, 0), (0, 0, -1), 0.124, 0.19)
    if pose.get('star'):                                                                          # gold: a star
        box(up, (-0.10, -0.163, 0.31), 0.045, 0.01, 0.045, mat, R=Ry(45).to_3x3(), skip=('+y',))
    for side, arm in (('r', pose['r_arm']), ('l', pose['l_arm'])):
        sh, el, wr, d, kind = arm[:5]
        chain(up, [sh, el, wr], [0.072, 0.062, 0.054], 6, mat)
        hand(up, mat, wr, d, kind, arm[5] if len(arm) > 5 else None)
        if kind == 'sabre':
            pts = pose['sabre']
            chain(up, pts, [(0.03, 0.008), (0.028, 0.007), (0.022, 0.006), (0.004, 0.002)], 4, mat,
                  xref=pose.get('sabre_flat', (0, 1, 0)))
            box(up, pts[0], 0.07, 0.02, 0.012, mat, R=Matrix.Rotation(0, 3, 'Z'))
    # head + cap in the head frame (neck top)
    hd = Mesh()
    head = [(0.0, 0.056, 0.05, -0.03), (0.045, 0.08, 0.085, -0.01), (0.10, 0.087, 0.095, 0.0),
            (0.16, 0.088, 0.10, 0.0), (0.215, 0.08, 0.095, 0.0)]
    fs = loft(hd, [((0, y, z), ring((0, y, z), (0, 0, 1), (1, 0, 0), rx, ry, 8)) for z, rx, ry, y in head], mat, cap0=True)
    front = [fi for fi in fs if hd.normal(hd.f[fi]['v']).normalized().y < -0.45 and hd.centre(hd.f[fi]['v']).z < 0.16]
    planar_px(hd, front, MET['face']['rect'], (0, 0, 0.08), (1, 0, 0), (0, 0, -1), 0.19, 0.16)
    a, b, c, tip = V(0, -0.098, 0.145), V(-0.02, -0.096, 0.085), V(0.02, -0.096, 0.085), V(0, -0.13, 0.088)
    for tri in ((a, b, tip), (a, tip, c), (b, c, tip)):                                           # nose
        hd.face(hd.verts(tri), mat, away=V(0, -0.06, 0.11))
    chain(hd, [(-0.095, -0.07, 0.035), (-0.045, -0.104, 0.068), (0.045, -0.104, 0.068), (0.095, -0.07, 0.035)],
          [0.012, 0.026, 0.026, 0.012], 3, mat, xref=(0, -1, 0), cap0=True, cap1=True)            # moustache
    loft(hd, [((0, 0, 0.145), ring((0, 0, 0.145), (0, 0, 1), (1, 0, 0), 0.1, 0.112, 8)),
              ((0, 0, 0.215), ring((0, 0, 0.215), (0, 0, 1), (1, 0, 0), 0.106, 0.118, 8))], mat)   # cap band
    crown_top = V(0, -0.012, 0.272)
    loft(hd, [((0, 0, 0.215), ring((0, 0, 0.215), (0, 0, 1), (1, 0, 0), 0.106, 0.118, 8)),
              (crown_top, ring(crown_top, (0, 0.22, 1), (1, 0, 0), 0.148, 0.16, 8))], mat, cap1=True)  # crown
    peak = []
    for k in range(4):
        ang = math.radians(-138 + k * 32)
        inner = V(0.1 * math.cos(ang), 0.112 * math.sin(ang), 0.15)
        outer = V(0.165 * math.cos(ang), 0.19 * math.sin(ang), 0.118)
        peak.append((inner, outer))
    for k in range(3):
        plate(hd, [peak[k][0], peak[k + 1][0], peak[k + 1][1], peak[k][1]], mat)
    badge = box(hd, (0, -0.135, 0.236), 0.028, 0.012, 0.026, mat, skip=('+y', '-z'))
    planar_px(hd, badge, MET['polish']['rect'], (0, -0.14, 0.236), (1, 0, 0), (0, 0, -1), 0.06, 0.06)
    Mh = T(pose['neck']) @ Rz(pose.get('head_yaw', 0)) @ Rx(-pose.get('head_up', 0)) @ S(HEAD_SCALE)
    up.merge(hd, Mh)
    Mu = T(pose['waist']) @ Rz(pose.get('twist', 0)) @ Rx(pose.get('lean', 0))
    m.merge(up, Mu)
    for leg in pose['legs']:
        pts, toe_dir, polish = leg
        chain(m, pts, [0.085, 0.074, 0.07] if len(pts) == 3 else [0.088, 0.078], 6, mat)
        foot(m, mat, pts[-1], toe_dir, polish)
    return m


STANDING = dict(
    waist=(0, 0, 1.0), lean=-2, twist=-6, neck=(0, 0.0, 0.555), head_yaw=-22, head_up=10,
    skirt=[(-0.02, 0.175, 0.125, 0.0), (-0.36, 0.235, 0.172, 0.01), (-0.70, 0.27, 0.21, 0.03)], fold=[0.0, 0.3, 0.45],
    r_arm=[(-0.205, 0.0, 0.445), (-0.37, -0.13, 0.55), (-0.53, -0.28, 0.67), (-0.56, -0.5, 0.42), 'point'],
    l_arm=[(0.205, 0.0, 0.445), (0.30, -0.04, 0.22), (0.11, -0.17, 0.28), (-0.9, -0.1, 0.3), 'chest'],
    legs=[([(-0.14, -0.07, 0.46), (-0.15, -0.08, 0.09)], (-0.25, -1, 0), True),
          ([(0.14, 0.06, 0.46), (0.15, 0.05, 0.09)], (0.35, -1, 0), False)],
)


def bronze_figure(mat):
    """Statue 1: standing, right arm thrust toward the future, left hand tucked in the coat."""
    return leader(mat, STANDING)


# ---------------------------------------------------------------------------------------------------------
# Exposure ramp UVs for metal faces

def _hemi_dirs(n=48):
    out = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        u = (i + 0.5) / n
        r = math.sqrt(u)
        out.append(Vector((r * math.cos(i * ga), r * math.sin(i * ga), math.sqrt(max(0.0, 1 - u)))))
    return out


def ramp_uvs(m, metal_mat, dmax, ground=True, tune=None):
    """Per-vertex exposure from hemisphere occlusion (+ convexity, + a little up-facing), then ramp UVs."""
    tune = tune or {}
    polys = [f['v'] for f in m.f]
    verts = [tuple(v) for v in m.v]
    if ground:
        g = len(verts)
        verts += [(-400, -400, 0), (400, -400, 0), (400, 400, 0), (-400, 400, 0)]
        polys = polys + [[g, g + 1, g + 2, g + 3]]
    bvh = BVHTree.FromPolygons(verts, polys, all_triangles=False)
    vn = [Vector() for _ in m.v]
    nbr = [set() for _ in m.v]
    used = set()
    for f in m.f:
        if f['mat'] != metal_mat:
            continue
        n = m.normal(f['v'])
        for k, i in enumerate(f['v']):
            vn[i] += n
            nbr[i].add(f['v'][k - 1])
            nbr[i].add(f['v'][(k + 1) % len(f['v'])])
            used.add(i)
    dirs = _hemi_dirs(48)
    expo = {}
    for i in used:
        n = vn[i].normalized() if vn[i].length > 1e-9 else Vector((0, 0, 1))
        q = Vector((0, 0, 1)).rotation_difference(n)
        o = m.v[i] + n * (dmax * 0.01)
        occ = 0.0
        for d in dirs:
            hit = bvh.ray_cast(o, q @ d, dmax)
            if hit[0] is not None:
                occ += (1.0 - hit[3] / dmax) ** 0.7
        occ /= len(dirs)
        conv = 0.0
        for j in nbr[i]:
            e = m.v[i] - m.v[j]
            if e.length > 1e-9:
                conv += n.dot(e.normalized())
        conv /= max(1, len(nbr[i]))
        t = tune.get('base', 0.05) + tune.get('open', 0.78) * (1.0 - occ) ** tune.get('gamma', 1.8) \
            + tune.get('conv', 0.5) * (conv - 0.22) + tune.get('up', 0.12) * n.z
        expo[i] = max(0.0, min(1.0, t))
    rx, ry, rw, rh = MET['ramp']['rect']
    for f in m.f:
        if f['mat'] != metal_mat or f['uv'] is not None:
            continue
        n = m.normal(f['v'])
        n = n.normalized() if n.length > 1e-12 else Vector((0, 0, 1))
        t_ax = n.cross(Vector((0, 0, 1)))
        t_ax = t_ax.normalized() if t_ax.length > 0.2 else Vector((1, 0, 0))
        b_ax = n.cross(t_ax)
        c = m.centre(f['v'])
        uv = []
        for i in f['v']:
            p = m.v[i]
            row = 1.5 + (1.0 - expo[i]) * (rh - 3.0) + max(-2.5, min(2.5, (p - c).dot(b_ax) * 1.2))
            row = max(1.5, min(rh - 1.5, row))
            uv.append((rx + p.dot(t_ax) * RAMP_PX, ry + row))
        f['uv'] = uv
    vals = sorted(expo.values())
    if vals:
        q = [vals[int(len(vals) * k / 10)] for k in range(10)] + [vals[-1]]
        print('EXPOSURE deciles', metal_mat, ' '.join(f'{x:.2f}' for x in q))


# ---------------------------------------------------------------------------------------------------------
# Blender object + export

def to_object(m, name):
    mats = []
    for f in m.f:
        if f['mat'] not in mats:
            mats.append(f['mat'])
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in m.v], [], [f['v'] for f in m.f])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for mn in mats:
        png = os.path.join(ROOT, 'public', 'textures', 'map', mn + '.png')
        me.materials.append(dt.material(mn, png))
    uvl = me.uv_layers.new(name='UVMap')
    for pi, (poly, f) in enumerate(zip(me.polygons, m.f)):
        poly.material_index = mats.index(f['mat'])
        W, H = (PED_W, PED_H) if f['mat'] == PED_MAT else (MET_W, MET_H)
        for li, (u, y) in zip(poly.loop_indices, f['uv']):
            uvl.data[li].uv = (u / W, 1.0 - y / H)
    for poly in me.polygons:
        poly.use_smooth = False
    me.update()
    return ob


def build(name):
    m = Mesh()
    if name == 'env_statue_pedestal':
        pedestal(m, 3.0, 3.0, wreath=True)
        return m, None
    metal = {'env_statue_bronze': 'env_statue_bronze', 'env_statue_silver': 'env_statue_silver',
             'env_statue_gold': 'env_statue_gold'}[name]
    if name == 'env_statue_bronze':
        pedestal(m, 3.0, 3.0)
        fig = bronze_figure(metal)
        m.merge(fig, T((0.25, 0.35, TOP_Z)) @ S(8.6))
        ramp_uvs(m, metal, dmax=3.2)
    else:
        build_group(m, name, metal)
    low = {i for f in m.f if f['mat'] == metal for i in f['v'] if m.v[i].z < TOP_Z + 0.6}
    if low:
        xs, ys = [m.v[i].x for i in low], [m.v[i].y for i in low]
        print(f'CONTACT {name}: x {min(xs):.2f}..{max(xs):.2f} y {min(ys):.2f}..{max(ys):.2f} (z < top + 0.6)')
    return m, metal


# ---------------------------------------------------------------------------------------------------------
# The horse (canonical metres, facing +X, origin on the ground under the barrel). `body` holds what rears
# (barrel, neck, head, forelegs, saddle cloth); `hind` holds the hind legs and tail.

def horse(mat, pose):
    body, hind = Mesh(), Mesh()
    barrel = [(-0.84, 1.22, 0.20, 0.18), (-0.64, 1.21, 0.35, 0.30), (-0.15, 1.13, 0.38, 0.31),
              (0.35, 1.16, 0.37, 0.29), (0.68, 1.27, 0.30, 0.24)]
    loft(body, [((x, 0, z), ring((x, 0, z), (1, 0, 0), (0, 0, 1), rz, ry, 8)) for x, z, rz, ry in barrel], mat,
         cap0=True, cap1=True)
    nb = Vector((0.56, 0, 1.40))
    Mn = T(nb) @ Rz(pose.get('neck_turn', 0)) @ Ry(-pose.get('head_up', 0)) @ T(-nb)
    nk = Mesh()
    chain(nk, [(0.56, 0, 1.40), (0.78, 0, 1.68), (0.94, 0, 1.92)], [(0.27, 0.19), (0.19, 0.13), (0.13, 0.095)], 6, mat)
    hf = chain(nk, [(0.92, 0, 1.98), (1.07, 0, 1.80), (1.22, 0, 1.53)], [(0.10, 0.085), (0.12, 0.09), (0.085, 0.066)], 6,
               mat, xref=(1, 0, 0), cap0=True, cap1=True)
    planar_px(nk, [hf[-1]], MET['polish']['rect'], (1.23, 0, 1.52), (0, 1, 0), (-0.8, 0, -0.6), 0.16, 0.16)
    for sy in (-1, 1):                                                                              # ears
        a, b, c, tip = V(0.90, sy * 0.03, 2.0), V(0.96, sy * 0.06, 2.0), V(0.92, sy * 0.08, 1.99), V(0.90, sy * 0.065, 2.12)
        for tri in ((a, b, tip), (b, c, tip), (c, a, tip)):
            nk.face(nk.verts(tri), mat, away=V(0.93, sy * 0.055, 2.03))
    mane = [V(0.50, 0, 1.62), V(0.62, 0, 1.86), V(0.70, 0, 1.80), V(0.80, 0, 2.02), V(0.86, 0, 1.94), V(0.92, 0, 2.10),
            V(0.93, 0, 1.98), V(0.66, 0, 1.62)]
    plate(nk, mane, mat)
    body.merge(nk, Mn)
    xs = (-0.32, 0.20)                                                                              # saddle cloth
    arcs = []
    for x in xs:
        arcs.append([V(x, 0.335 * math.sin(a), 1.13 + 0.405 * math.cos(a)) for a in [-1.9 + 0.76 * k for k in range(6)]])
    for k in range(5):
        q = body.verts([arcs[0][k], arcs[0][k + 1], arcs[1][k + 1], arcs[1][k]])
        body.face(q, mat, away=V(-0.06, 0, 1.13))
    for leg in pose['fore']:
        chain(body, leg, [0.12, 0.08, 0.058, 0.07], 5, mat, cap1=True)
    for leg in pose['hind']:
        chain(hind, leg, [0.19, 0.13, 0.075, 0.058, 0.07], 5, mat, cap1=True)
    chain(hind, pose['tail'], [0.06, 0.095, 0.09, 0.05][:len(pose['tail'])], 5, mat, cap1=True)
    return body, hind


def legs_pair(fn):
    return [fn(-1), fn(1)]


STRIDE = dict(   # Statue 2: walking, near foreleg raised high, head up and turned to the camera
    neck_turn=-12, head_up=6,
    fore=[[(0.55, -0.15, 1.05), (0.82, -0.17, 0.80), (0.74, -0.17, 0.46), (0.82, -0.17, 0.40)],
          [(0.55, 0.15, 1.05), (0.55, 0.15, 0.58), (0.56, 0.15, 0.17), (0.58, 0.15, 0.03)]],
    hind=[[(-0.55, -0.16, 1.12), (-0.40, -0.17, 0.80), (-0.66, -0.15, 0.52), (-0.56, -0.15, 0.17), (-0.53, -0.15, 0.03)],
          [(-0.55, 0.16, 1.12), (-0.48, 0.17, 0.80), (-0.78, 0.15, 0.52), (-0.80, 0.15, 0.17), (-0.84, 0.15, 0.03)]],
    tail=[(-0.84, 0, 1.30), (-0.98, 0, 1.12), (-1.03, 0, 0.82), (-1.0, 0, 0.52)],
)

REAR = dict(     # Statue 3: rearing on the hind legs; forelegs tucked over the heap; tail to the ground
    neck_turn=-10, head_up=-18,
    fore=[[(0.55, -0.15, 1.05), (0.84, -0.17, 0.80), (0.70, -0.17, 0.50), (0.78, -0.17, 0.38)],
          [(0.55, 0.15, 1.05), (0.78, 0.17, 0.72), (0.72, 0.17, 0.40), (0.80, 0.17, 0.30)]],
    hind=[[(-0.55, -0.16, 1.10), (-0.28, -0.18, 0.66), (-0.58, -0.15, 0.36), (-0.36, -0.15, 0.12), (-0.26, -0.15, 0.03)],
          [(-0.55, 0.16, 1.10), (-0.32, 0.18, 0.64), (-0.64, 0.15, 0.34), (-0.46, 0.15, 0.10), (-0.38, 0.15, 0.03)]],
    tail=[(-0.92, 0, 1.18), (-1.08, 0, 0.82), (-1.16, 0, 0.40), (-1.22, 0, 0.03)],
    pivot=(-0.55, 0, 1.02), rear=30,
)

RIDER = dict(    # seated, origin at the saddle seat; the camera is on his right
    waist=(0, 0, 0.17), lean=0, twist=-18, neck=(0, 0, 0.555), head_yaw=-40, head_up=6,
    skirt=[(-0.02, 0.175, 0.125, 0.0), (-0.13, 0.25, 0.21, 0.0), (-0.25, 0.31, 0.29, 0.02)], fold=[0.0, 0.3, 0.5],
    r_arm=[(-0.205, 0.0, 0.445), (-0.41, -0.06, 0.50), (-0.23, -0.11, 0.62), (0.10, 0.08, 0.09), 'flat', (0, -1, 0)],
    l_arm=[(0.205, 0.0, 0.445), (0.26, -0.12, 0.22), (0.11, -0.30, 0.18), (-0.15, -1, 0.0), 'fist'],
    legs=[([(-0.11, 0.0, 0.02), (-0.35, -0.30, -0.08), (-0.37, -0.12, -0.52)], (0, -1, 0), True),
          ([(0.11, 0.0, 0.02), (0.35, -0.30, -0.08), (0.37, -0.12, -0.52)], (0, -1, 0), False)],
)

RIDER_SABRE = dict(RIDER, twist=-14, head_yaw=-36, head_up=10, star=True,
                   r_arm=[(-0.205, 0.0, 0.445), (-0.33, -0.22, 0.60), (-0.36, -0.42, 0.80), (-0.1, -0.7, 0.7), 'sabre'],
                   sabre=[(-0.37, -0.47, 0.86), (-0.38, -0.66, 1.10), (-0.37, -0.84, 1.38), (-0.35, -0.94, 1.62)],
                   sabre_flat=(1, 0, 0))

SEAT = Vector((-0.10, 0, 1.53))


def rider_matrix(pose_rider):
    return T(SEAT) @ Rz(90)


def upper_point(pose, p):
    """A point given in the rider's upper-body frame -> rider local."""
    return (T(pose['waist']) @ Rz(pose.get('twist', 0)) @ Rx(pose.get('lean', 0))) @ Vector(p)


def head_point(pose, p):
    Mh = T(pose['neck']) @ Rz(pose.get('head_yaw', 0)) @ Rx(-pose.get('head_up', 0))
    return upper_point(pose, Mh @ Vector(p))


def reins(m, mat, a, b, sag=0.08):
    a, b = Vector(a), Vector(b)
    mid = (a + b) / 2 + Vector((0, 0, -sag))
    chain(m, [a, mid, b], [0.014, 0.014, 0.014], 3, mat)


# ---------------------------------------------------------------------------------------------------------
# Victory (gold): a winged woman crowning him with a laurel wreath. Local frame faces -Y, origin at her feet.

def victory(mat):
    m = Mesh()
    robe = [(0.0, 0.28, 0.20, 0.14), (0.5, 0.20, 0.15, 0.05), (1.0, 0.14, 0.10, 0.0)]
    loft(m, [((0, y, z), ring((0, y, z), (0, 0, 1), (1, 0, 0), rx, ry, 8)) for z, rx, ry, y in robe], mat, cap0=True)
    up = Mesh()                                                     # upper body, waist frame
    torso = [(0.0, 0.135, 0.10, 0.0), (0.22, 0.16, 0.125, -0.015), (0.38, 0.165, 0.10, 0.0), (0.44, 0.07, 0.06, 0.0)]
    loft(up, [((0, y, z), ring((0, y, z), (0, 0, 1), (1, 0, 0), rx, ry, 8)) for z, rx, ry, y in torso], mat, cap1=True)
    head = [(0.44, 0.045, 0.045, -0.01), (0.50, 0.068, 0.074, -0.005), (0.58, 0.072, 0.08, 0.0), (0.65, 0.06, 0.07, 0.01)]
    loft(up, [((0, y, z), ring((0, y, z), (0, 0, 1), (1, 0, 0), rx, ry, 6)) for z, rx, ry, y in head], mat, cap1=True)
    box(up, (0, 0.075, 0.60), 0.045, 0.04, 0.04, mat, skip=('-y',))                                # hair bun
    wr = []
    for sx in (-1, 1):
        sh, el, w = V(sx * 0.165, 0, 0.36), V(sx * 0.22, -0.22, 0.50), V(sx * 0.14, -0.44, 0.62)
        chain(up, [sh, el, w], [0.055, 0.045, 0.038], 5, mat)
        chain(up, [w, w + V(-sx * 0.03, -0.06, 0.02)], [0.036, 0.03], 4, mat, cap1=True)
        wr.append(w + V(-sx * 0.02, -0.04, 0.02))
        if sx > 0:   # far wing (+x turns away from the camera): raised high
            yz = [(0.08, 0.42), (0.18, 0.95), (0.38, 1.50), (0.58, 1.78), (0.70, 1.55), (0.84, 1.30), (0.82, 1.02),
                  (0.68, 0.74), (0.45, 0.46), (0.22, 0.24), (0.08, 0.16)]
        else:        # near wing: swept back
            yz = [(0.08, 0.42), (0.35, 0.80), (0.75, 1.10), (1.20, 1.25), (1.45, 1.22), (1.30, 1.00), (1.18, 0.78),
                  (0.98, 0.58), (0.72, 0.40), (0.42, 0.22), (0.08, 0.16)]
        plate(up, [V(sx * (0.05 + 0.25 * y / 1.2), y, z) for y, z in yz], mat)
    Mu = T((0, 0, 1.0)) @ Rx(22)
    m.merge(up, Mu)
    hands = [Mu @ w for w in wr]
    return m, hands


def laurel(m, mat, c, r, tube=0.04, n=8):
    rings = []
    for k in range(n + 1):
        a = 2 * math.pi * k / n
        p = Vector(c) + Vector((math.cos(a) * r, math.sin(a) * r, 0))
        tang = Vector((-math.sin(a), math.cos(a), 0))
        rings.append((p, ring(p, tang, (math.cos(a), math.sin(a), 0), tube * 1.4, tube, 3)))
    loft(m, rings, mat)


def bureaucrat(m, mat, M):
    """A little crushed clerk lying face down along +X (head at +X), arms flung out, in local metres."""
    b = Mesh()
    box(b, (0, 0, 0.06), 0.16, 0.085, 0.055, mat, skip=('-z',))                                     # suit
    chain(b, [(0.18, 0, 0.06), (0.30, 0, 0.07)], [0.06, 0.055], 6, mat, cap1=True)                 # head
    for sy in (-1, 1):
        chain(b, [(-0.15, sy * 0.05, 0.05), (-0.42, sy * 0.09, 0.04)], [0.045, 0.035], 4, mat, cap1=True)
        chain(b, [(0.12, sy * 0.08, 0.07), (0.22, sy * 0.25, 0.05)], [0.035, 0.03], 4, mat, cap1=True)
    m.merge(b, M @ S(1.3))


def heap(m, mat):
    """Under the forelegs: a mound of crushed bureaucrats, a desk, briefcases and papers (horse frame)."""
    c = V(0.95, 0.0, 0.0)
    loft(m, [(c, ring(c, (0, 0, 1), (1, 0, 0), 0.52, 0.42, 6)),
             (c + V(0.0, 0, 0.2), ring(c + V(0.0, 0, 0.2), (0, 0, 1), (1, 0, 0), 0.30, 0.22, 6))], mat, cap1=True)
    box(m, (1.05, 0.10, 0.34), 0.20, 0.13, 0.03, mat, R=(Ry(-24) @ Rz(20)).to_3x3())               # desk top
    box(m, (1.12, 0.10, 0.22), 0.19, 0.11, 0.08, mat, R=(Ry(-24) @ Rz(20)).to_3x3(), skip=('+z',))  # drawers
    bureaucrat(m, mat, T((0.68, -0.22, 0.12)) @ Rz(-150) @ Ry(-8))
    bureaucrat(m, mat, T((1.10, -0.30, 0.10)) @ Rz(-60) @ Ry(10))
    bureaucrat(m, mat, T((1.15, 0.22, 0.18)) @ Rz(30) @ Ry(-18))
    for p, rot in (((0.62, 0.28, 0.06), 20), ((1.38, -0.05, 0.05), -35), ((0.88, -0.48, 0.05), 70)):   # briefcases
        box(m, p, 0.09, 0.03, 0.065, mat, R=(Rz(rot) @ Rx(-60)).to_3x3())
    for k, (x, y, z, a, tilt) in enumerate(((0.80, -0.35, 0.21, 10, 12), (1.30, 0.20, 0.10, 40, 20),
                                            (0.55, 0.05, 0.12, -20, 25), (1.45, -0.32, 0.02, 75, 0),
                                            (0.98, 0.40, 0.18, 5, 30), (1.25, -0.48, 0.02, -50, 0))):  # papers
        R = (Rz(a) @ Rx(tilt)).to_3x3()
        pts = [V(x, y, z) + R @ V(sx * 0.11, sy * 0.15, 0) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        m.face(m.verts(pts), mat, away=V(x, y, z) - R @ V(0, 0, 1))


# ---------------------------------------------------------------------------------------------------------
# Groups

LONG_HX = 6.5   # silver's plinth: 13 x 6 (brief: "about 6 x 12")
GOLD_HX, GOLD_HY = 7.7, 3.5   # gold's plinth, same design: 15.4 x 7
VICTORY_SCALE = 1.2           # heroic scale: she is bigger than the leader
VICTORY_YAW = 85   # Victory faces the rider (+X); her wings sweep up and back in the picture plane


def place_group(m, g, k, yaw, hx, hy):
    """Scales/yaws the group and centres its ground contacts (z < 0.12 m) on the plinth top."""
    M0 = Rz(yaw) @ S(k)
    pts = [M0 @ v for v in g.v if v.z < 0.12]
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    m.merge(g, T((-cx, -cy, TOP_Z)) @ M0)
    tx, ty = hx - TOP_INSET, hy - TOP_INSET
    print(f'FOOTPRINT contacts {max(xs) - min(xs):.2f} x {max(ys) - min(ys):.2f} on a top of {2 * tx:.2f} x {2 * ty:.2f}')


def build_group(m, name, mat):
    g = Mesh()
    if name == 'env_statue_silver':
        body, hind = horse(mat, STRIDE)
        g.merge(body)
        g.merge(hind)
        r = leader(mat, RIDER)
        Mr = rider_matrix(RIDER)
        g.merge(r, Mr)
        fist = Mr @ upper_point(RIDER, V(0.11, -0.30, 0.18) + V(-0.15, -1, 0).normalized() * 0.07)
        nb = Vector((0.56, 0, 1.40))
        Mn = T(nb) @ Rz(STRIDE['neck_turn']) @ Ry(-STRIDE['head_up']) @ T(-nb)
        for sy in (-1, 1):
            reins(g, mat, fist + V(0, sy * 0.03, 0), Mn @ V(1.16, sy * 0.07, 1.60))
        pedestal(m, LONG_HX, 3.0)
        place_group(m, g, 6.0, -15, LONG_HX, 3.0)
        ramp_uvs(m, mat, dmax=2.6)
    else:
        body, hind = horse(mat, REAR)
        piv = Vector(REAR['pivot'])
        Mb = T(piv) @ Ry(-REAR['rear']) @ T(-piv)
        r = leader(mat, RIDER_SABRE)
        Mr = Mb @ T(SEAT) @ Ry(REAR['rear'] * 0.62) @ Rz(90)
        g.merge(body, Mb)
        g.merge(hind)
        g.merge(r, Mr)
        fist = Mr @ upper_point(RIDER_SABRE, V(0.11, -0.30, 0.18) + V(-0.15, -1, 0).normalized() * 0.07)
        nb = Vector((0.56, 0, 1.40))
        Mn = Mb @ T(nb) @ Rz(REAR['neck_turn']) @ Ry(-REAR['head_up']) @ T(-nb)
        for sy in (-1, 1):
            reins(g, mat, fist + V(0, sy * 0.03, 0), Mn @ V(1.16, sy * 0.07, 1.60))
        hp = Mesh()
        heap(hp, mat)
        g.merge(hp, T((0.78, 0, 0)) @ S(0.85) @ T((-0.95, 0, 0)))
        crown = Mr @ head_point(RIDER_SABRE, V(0, -0.01, 0.30))
        wreath_c = crown + V(0, 0, 0.16)
        vic, hands = victory(mat)
        mid = (hands[0] + hands[1]) / 2
        # her local -Y faces the camera in the group frame: undo the group's yaw so she faces it squarely
        Mv = T(wreath_c) @ Rz(VICTORY_YAW) @ S(VICTORY_SCALE) @ T(-(mid + V(0, -0.10, 0.02)))
        g.merge(vic, Mv)
        laurel(g, mat, wreath_c, 0.15)
        feet = Mv @ V(0, 0, 0)
        base = V(REAR['tail'][-1][0], REAR['tail'][-1][1], 0.0)   # the strut rises from where the tail meets the plinth
        gc = feet + V(0, 0, -0.2)                                                                 # globe
        loft(g, [(gc + V(0, 0, z), ring(gc + V(0, 0, z), (0, 0, 1), (1, 0, 0), r, r, 8))
                 for z, r in ((-0.19, 0.08), (-0.12, 0.17), (0.0, 0.21), (0.12, 0.17), (0.19, 0.08))], mat, cap1=True)
        chain(g, [base + V(0, 0, 0.0), base + V(0, 0, 0.12), gc + V(0, 0, -0.17)], [0.24, 0.12, 0.08], 6, mat)  # column
        pedestal(m, GOLD_HX, GOLD_HY)
        place_group(m, g, 5.0, -5, GOLD_HX, GOLD_HY)
        print('VICTORY feet (horse frame)', tuple(round(x, 2) for x in feet), 'wreath', tuple(round(x, 2) for x in wreath_c))
        ramp_uvs(m, mat, dmax=2.4)


# ---------------------------------------------------------------------------------------------------------
# Main: build, export, check renders

NAMES = ['env_statue_pedestal', 'env_statue_bronze', 'env_statue_silver', 'env_statue_gold']
BUDGET = CONTRACT['model_envelope']['budgets']


def export(name):
    dt.reset()
    m, metal = build(name)
    ob = to_object(m, name)
    tris = dt.tri_count([ob])
    mn, mx = dt.bounds([ob])
    flag = 'OK' if tris <= BUDGET[name] else 'OVER BUDGET'
    print(f'MODEL {name}: {tris} tris (budget {BUDGET[name]}, {flag}); bounds '
          f'x {mn.x:.2f}..{mx.x:.2f} y {mn.y:.2f}..{mx.y:.2f} z {mn.z:.2f}..{mx.z:.2f}')
    path = os.path.join(ROOT, 'public', 'models', 'map', name + '.glb')
    dt.export_glb([ob], path)
    return path


def check_render(name, glb, outdir):
    dt.reset()
    bpy.ops.import_scene.gltf(filepath=glb)
    objs = list(bpy.data.objects)
    for o in objs:
        if o.parent is None:
            o.scale = o.scale * 1000.0
        if o.type == 'MESH':
            for mt in o.data.materials:
                for nd in mt.node_tree.nodes:
                    if nd.type == 'TEX_IMAGE':
                        nd.interpolation = 'Closest'
    bpy.context.view_layer.update()
    mn, mx = dt.bounds(objs)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'FLAT'
    sh.color_type = 'TEXTURE'
    sh.show_backface_culling = True
    sh.show_shadows = False
    sh.show_cavity = False
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('bg')
    w.color = (0.36, 0.40, 0.46)
    sc.world = w
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    c = (mn + mx) / 2
    size = max(mx.x - mn.x, mx.z - mn.z, mx.y - mn.y)
    os.makedirs(outdir, exist_ok=True)
    for view, d, res in (('front', (0, -1, 0.06), 640), ('3q', (0.62, -1, 0.55), 640), ('3ql', (-0.62, -1, 0.4), 640),
                         ('back', (0.5, 1, 0.3), 400), ('street', (0.1, -1, 0.466), 640), ('small', (0.1, -1, 0.466), 300)):
        dv = Vector(d).normalized()
        cam.location = c + dv * (size * 4)
        cam.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = size * 1.12
        cam.data.clip_end = size * 10
        sc.render.resolution_x = sc.render.resolution_y = res
        sc.render.filepath = os.path.join(outdir, f'{name}_{view}.png')
        bpy.ops.render.render(write_still=True)
    print('CHECKED', name)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    check = None
    if '--check' in argv:
        i = argv.index('--check')
        check = os.path.join(ROOT, argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    names = [a for a in argv if a in NAMES] or NAMES
    paths = {n: export(n) for n in names}
    if check:
        for n, p in paths.items():
            check_render(n, p, check)


main()
