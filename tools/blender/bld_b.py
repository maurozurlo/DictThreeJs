"""bld_b: rich-tier street buildings for dict-three (luxury mall, corporate HQ, grand hotel).

    $env:TEMP = "E:\\GameDev\\dict-three\\build\\visual_gaps\\bld_b\\tmp"; $env:TMP = $env:TEMP
    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/bld_b.py -- [env_bld_commercial_rich|env_bld_mixeduse_rich|env_bld_residential_rich ...] ^
        [--preview build/visual_gaps/bld_b/models]

Builds each model in its plot's IPL pivot frame (dt_common.SLOTS: ground at the slot's min z, the
camera-facing street line where the normal model's is), maps faces to the regions of
tools/texgen/bld_b_layout.json (textures from tools/texgen/bld_b.py, run that first), exports
public/models/map/<name>.glb, re-imports it to check triangles, bounds, ground and footprint, and with
--preview renders flat-lit (the game's single ambient light) and back-face-culled checks.

Lighting: the game shows albedo flat, so faces pick darker texture regions by facing: -Y faces use the
*_front facade regions, +-X/+Y faces the *_side ones, and trim faces a shade band chosen from the face
normal (contract `lighting.band_pick`).
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
with open(os.path.join(ROOT, 'tools', 'texgen', 'bld_b_layout.json'), encoding='utf-8') as _fh:
    LAYOUT = json.load(_fh)
TEX = LAYOUT['textures']
LIGHT = Vector(LAYOUT['lighting']['band_light']).normalized()
INSET = 0.5  # px; the game samples Nearest without mips, half a texel keeps faces off the neighbours

TRIM, CUT = 'bld_b_rich_trim', 'bld_b_rich_cutout'
V = Vector


def band_of(n):
    d = n.normalized().dot(LIGHT)
    return 0 if d >= 0.55 else 1 if d >= 0.25 else 2 if d >= -0.1 else 3


def newell(pts):
    n = Vector((0, 0, 0))
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n.normalized() if n.length > 1e-12 else n


class Builder:
    """One model: a bmesh of flat faces, one material per texture, UVs from contract regions."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.mats = []

    # ---- texture-space helpers -----------------------------------------------------------------------
    def mi(self, tex):
        if tex not in self.mats:
            self.mats.append(tex)
        return self.mats.index(tex)

    @staticmethod
    def region(tex, reg):
        r = TEX[tex]['regions'][reg]
        W, H = TEX[tex]['size']
        return r, W, H

    @staticmethod
    def uv_of(tex, reg, s, t, t_lo=0.0, t_hi=1.0):
        """s along U (tiles for a full-width strip, 0-1 across a decal), t 0 = region top .. 1 = bottom,
        remapped into [t_lo, t_hi] of the region (a shade band) with a half-texel inset."""
        r, W, H = Builder.region(tex, reg)
        x, y, w, h = r['rect']
        tt = t_lo + (t_hi - t_lo) * min(max(t, 0.0), 1.0)
        tt = INSET / h + tt * (1 - 2 * INSET / h)
        if r.get('tiles') == 'u' and w == W:
            u = s
        else:
            u = (x + (INSET + min(max(s, 0.0), 1.0) * (w - 2 * INSET))) / W
        return (u, 1.0 - (y + tt * h) / H)

    # ---- faces -----------------------------------------------------------------------------------------
    def poly(self, pts, uvs, tex, want=None):
        pts = [V(p) for p in pts]
        if want is not None and newell(pts).dot(V(want)) < 0:
            pts, uvs = pts[::-1], uvs[::-1]
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(tex)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        return f

    def wall(self, p0, p1, z0, z1, tex, reg, s0=0.0, t0=0.0, t1=1.0, metres=None):
        """Vertical quad from p0 to p1 (outward normal = (p1 - p0) x Z), U runs p0 -> p1 in tiles of
        `metres` (the region's own if omitted) starting at s0; t0 at the top edge, t1 at the bottom."""
        p0, p1 = V((p0[0], p0[1], 0)), V((p1[0], p1[1], 0))
        L = (p1 - p0).length
        m = metres or self.region(tex, reg)[0].get('metres', L)
        s1 = s0 + L / m
        pts = [p0 + V((0, 0, z0)), p1 + V((0, 0, z0)), p1 + V((0, 0, z1)), p0 + V((0, 0, z1))]
        uvs = [self.uv_of(tex, reg, s0, t1), self.uv_of(tex, reg, s1, t1),
               self.uv_of(tex, reg, s1, t0), self.uv_of(tex, reg, s0, t0)]
        want = (p1 - p0).cross(V((0, 0, 1)))
        return self.poly(pts, uvs, tex, want)

    def decal(self, corners, tex, reg, want):
        """Quad corners bottom-left, bottom-right, top-right, top-left (seen from outside) on a decal."""
        uvs = [self.uv_of(tex, reg, 0, 1), self.uv_of(tex, reg, 1, 1), self.uv_of(tex, reg, 1, 0),
               self.uv_of(tex, reg, 0, 0)]
        return self.poly(corners, uvs, tex, want)

    def shaded(self, pts, tex, reg, want, metres=None, band=None, t_part=(0.0, 1.0)):
        """Plain trim face: shade band from the outward normal, U from world position (metres a tile),
        V spanning the band (or the t_part of a single-band region)."""
        pts = [V(p) for p in pts]
        n = newell(pts)
        if n.dot(V(want)) < 0:
            pts, n = pts[::-1], -n
        r = self.region(tex, reg)[0]
        nb = r.get('bands', 1)
        k = band_of(n) if band is None else band
        k = min(k, nb - 1)
        lo, hi = (k / nb, (k + 1) / nb) if nb > 1 else t_part
        m = metres or r.get('metres', 8)
        if abs(n.z) < 0.7:
            hx = V((-n.y, n.x, 0)).normalized()
            zs = [p.z for p in pts]
            za, zb = max(zs), min(zs)
            uvs = [self.uv_of(tex, reg, p.dot(hx) / m, (za - p.z) / max(za - zb, 1e-6), lo, hi) for p in pts]
        else:
            ys = [p.y for p in pts]
            ya, yb = max(ys), min(ys)
            uvs = [self.uv_of(tex, reg, p.x / m, (ya - p.y) / max(ya - yb, 1e-6), lo, hi) for p in pts]
        return self.poly(pts, uvs, tex)

    # ---- solids ----------------------------------------------------------------------------------------
    def box(self, x0, x1, y0, y1, z0, z1, tex, reg, skip=('-Z',), metres=None, band=None, t_part=(0.0, 1.0)):
        """Axis box of shaded trim faces; `skip` lists faces left out ('-X', '+X', '-Y', '+Y', '-Z', '+Z')."""
        P = lambda x, y, z: V((x, y, z))
        faces = {
            '-Y': ([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], (0, -1, 0)),
            '+Y': ([P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], (0, 1, 0)),
            '-X': ([P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], (-1, 0, 0)),
            '+X': ([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], (1, 0, 0)),
            '+Z': ([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], (0, 0, 1)),
            '-Z': ([P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], (0, 0, -1)),
        }
        for k, (pts, want) in faces.items():
            if k not in skip:
                self.shaded(pts, tex, reg, want, metres, band, t_part)

    def prism(self, cx, cy, r, n, z0, z1, tex, reg, cap=True, rot=0.0, r_top=None, metres=None):
        """n-sided upright prism (or frustum with r_top), shaded sides, optional flat top."""
        rt = r if r_top is None else r_top
        ang = [rot + 2 * math.pi * i / n for i in range(n)]
        for a, b in zip(ang, ang[1:] + ang[:1]):
            pa, pb = V((math.cos(a), math.sin(a), 0)), V((math.cos(b), math.sin(b), 0))
            c = V((cx, cy, 0))
            pts = [c + pa * r + V((0, 0, z0)), c + pb * r + V((0, 0, z0)), c + pb * rt + V((0, 0, z1)),
                   c + pa * rt + V((0, 0, z1))]
            if rt < 1e-6:
                pts = pts[:3]
            mid = (pa + pb).normalized()
            self.shaded(pts, tex, reg, (mid.x, mid.y, 0.3), metres)
        if cap and rt > 1e-6:
            top = [V((cx + rt * math.cos(a), cy + rt * math.sin(a), z1)) for a in ang]
            self.shaded(top, tex, reg, (0, 0, 1), metres)

    def pyramid(self, cx, cy, r, n, z0, z1, tex, reg, rot=0.0):
        self.prism(cx, cy, r, n, z0, z1, tex, reg, cap=False, rot=rot, r_top=0.0)

    def dome(self, cx, cy, z0, profile, n, tex, reg, rot=None):
        """Dome of n gores; profile = [(radius, dz), ...] from the base up; radius 0 closes it."""
        rot = math.pi / n if rot is None else rot
        ang = [rot + 2 * math.pi * i / n for i in range(n)]
        c = V((cx, cy, z0))
        for (r0, h0), (r1, h1) in zip(profile, profile[1:]):
            for a, b in zip(ang, ang[1:] + ang[:1]):
                pa, pb = V((math.cos(a), math.sin(a), 0)), V((math.cos(b), math.sin(b), 0))
                pts = [c + pa * r0 + V((0, 0, h0)), c + pb * r0 + V((0, 0, h0)), c + pb * r1 + V((0, 0, h1)),
                       c + pa * r1 + V((0, 0, h1))]
                if r1 < 1e-6:
                    pts = pts[:3]
                mid = (pa + pb).normalized()
                slope = V((mid.x * (h1 - h0), mid.y * (h1 - h0), (r0 - r1))).normalized()
                self.shaded(pts, tex, reg, slope)

    def vault(self, axis, a0, a1, c, zc, r, nseg, tex, reg, ends=(True, True), end_reg=None, end_tex=None):
        """Half-cylinder vault along 'x' or 'y' from a0 to a1, axis line at the other coordinate c,
        springing at zc, radius r, nseg segments; optional semicircular end fans."""
        def P(a, ang):
            off, z = r * math.cos(ang), zc + r * math.sin(ang)
            return V((a, c + off, z)) if axis == 'x' else V((c + off, a, z))
        angs = [math.pi * i / nseg for i in range(nseg + 1)]
        for t0, t1 in zip(angs, angs[1:]):
            pts = [P(a0, t0), P(a1, t0), P(a1, t1), P(a0, t1)]
            m = (t0 + t1) / 2
            out = V((0, math.cos(m), math.sin(m))) if axis == 'x' else V((math.cos(m), 0, math.sin(m)))
            self.shaded(pts, tex, reg, out)
        et, er = end_tex or tex, end_reg or reg
        for a, sgn, on in ((a0, -1, ends[0]), (a1, 1, ends[1])):
            if not on:
                continue
            ctr = V((a, c, zc)) if axis == 'x' else V((c, a, zc))
            want = V((sgn, 0, 0)) if axis == 'x' else V((0, sgn, 0))
            for t0, t1 in zip(angs, angs[1:]):
                self.shaded([ctr, P(a, t0), P(a, t1)], et, er, want)

    def disc(self, centre, normal, up, r, n, thick, tex_face, reg_face, tex_rim, reg_rim):
        """Upright medallion: decal fan on the front, plain back, shaded rim."""
        nrm, up = V(normal).normalized(), V(up).normalized()
        right = up.cross(nrm).normalized()
        c = V(centre)
        ring = [(math.cos(2 * math.pi * i / n), math.sin(2 * math.pi * i / n)) for i in range(n)]
        front = [c + (right * x + up * y) * r for x, y in ring]
        back = [p - nrm * thick for p in front]
        cu = self.uv_of(tex_face, reg_face, 0.5, 0.5)
        for (x0, y0), (x1, y1), p0, p1 in zip(ring, ring[1:] + ring[:1], front, front[1:] + front[:1]):
            uvs = [cu, self.uv_of(tex_face, reg_face, 0.5 + 0.5 * x0, 0.5 - 0.5 * y0),
                   self.uv_of(tex_face, reg_face, 0.5 + 0.5 * x1, 0.5 - 0.5 * y1)]
            self.poly([c, p0, p1], uvs, tex_face, nrm)
            self.shaded([c - nrm * thick, p1 - nrm * thick, p0 - nrm * thick], tex_rim, reg_rim, -nrm)
        for p0, p1, q0, q1 in zip(front, front[1:] + front[:1], back, back[1:] + back[:1]):
            out = ((p0 + p1) / 2 - c)
            self.shaded([p0, q0, q1, p1], tex_rim, reg_rim, out)

    def flag(self, base, along, w, h, reg):
        """Cutout flag quad hanging from a pole: base = top-of-pole attach point, extends `along` (unit
        horizontal vector) by w, down by h. Double-sided in the game (transparent material)."""
        b, a = V(base), V(along).normalized() * w
        dn = V((0, 0, -h))
        want = a.cross(V((0, 0, 1)))
        self.decal([b + dn, b + a + dn, b + a, b], CUT, reg, want)

    def flagpole(self, x, y, z0, z1, reg_flag, along=(1, 0, 0), fw=3.2, fh=2.0):
        self.prism(x, y, 0.13, 4, z0, z1, TRIM, 'gold', cap=False, rot=math.pi / 4)
        self.pyramid(x, y, 0.28, 4, z1, z1 + 0.6, TRIM, 'gold', rot=math.pi / 4)
        self.flag((x + 0.1 * along[0], y + 0.1 * along[1], z1 - 0.15), along, fw, fh, reg_flag)

    def balustrade(self, p0, p1, z, h=1.8, reg='balustrade'):
        p0, p1 = V(p0), V(p1)
        L = (p1 - p0).length
        m = TEX[CUT]['regions'][reg]['metres']
        tw = TEX[CUT]['size'][0]
        # cutout strips are full-width (64 px) U strips: s in tiles
        self.wall(p0, p1, z, z + h, CUT, reg, 0.0, 0.0, 1.0, metres=m)

    # ---- finish ----------------------------------------------------------------------------------------
    def finish(self, ground_z):
        bmesh.ops.translate(self.bm, verts=self.bm.verts, vec=V((0, 0, ground_z)))
        mats = [dt.material(t, os.path.join(ROOT, TEX[t]['file'])) for t in self.mats]
        return dt.mesh_object(self.name, self.bm, mats)


# ---------------------------------------------------------------------------------------------------------
# Shared pieces

def lip(b, p0, p1, depth, z0, z1, reg='cornice', ends=True):
    """Projecting moulding along a wall from p0 to p1 (wall convention): cornice front, marble underside,
    top and end caps."""
    p0, p1 = V((p0[0], p0[1], 0)), V((p1[0], p1[1], 0))
    out = (p1 - p0).cross(V((0, 0, 1))).normalized()
    a0, a1 = p0 + out * depth, p1 + out * depth
    b.wall(a0, a1, z0, z1, TRIM, reg, 0.0, 0.0, 1.0, metres=8)
    Z = lambda p, z: V((p.x, p.y, z))
    b.shaded([Z(p0, z0), Z(p1, z0), Z(a1, z0), Z(a0, z0)], TRIM, 'marble', (0, 0, -1))
    b.shaded([Z(a0, z1), Z(a1, z1), Z(p1, z1), Z(p0, z1)], TRIM, 'marble', (0, 0, 1))
    if ends:
        d = (p1 - p0).normalized()
        b.shaded([Z(p0, z0), Z(a0, z0), Z(a0, z1), Z(p0, z1)], TRIM, 'marble', -d)
        b.shaded([Z(a1, z0), Z(p1, z0), Z(p1, z1), Z(a1, z1)], TRIM, 'marble', d)


def roof(b, x0, x1, y0, y1, z):
    b.shaded([V((x0, y0, z)), V((x1, y0, z)), V((x1, y1, z)), V((x0, y1, z))], TRIM, 'roof', (0, 0, 1))


def stack(b, p0, p1, tex, levels, s0):
    """Facade wall made of stacked strips: levels = [(z0, z1, region, t0, t1), ...]."""
    for z0, z1, reg, t0, t1 in levels:
        b.wall(p0, p1, z0, z1, tex, reg, s0, t0, t1)


# ---------------------------------------------------------------------------------------------------------
# 1. env_bld_commercial_rich: luxury mall (commercial plot, fronts -Y)

def build_commercial():
    b = Builder('env_bld_commercial_rich')
    FAC = 'env_bld_commercial_rich_facade'
    yf, yb, H = -8.74, 12.0, 14.0
    sx = lambda x: (x + 26.0) / 26.0          # bays every 6.5 units from x = -26
    # main block: fronts either side of the pavilion, ends, back, roof
    b.wall((-26, yf), (-6.5, yf), 0, H, FAC, 'front', sx(-26))
    b.wall((6.5, yf), (26, yf), 0, H, FAC, 'front', sx(6.5))
    b.wall((-26, yb), (-26, yf), 0, H, FAC, 'side', 0.0)
    b.wall((26, yf), (26, yb), 0, H, FAC, 'side', 0.0)
    b.wall((26, yb), (-26, yb), 0, H, FAC, 'side', 0.0)
    roof(b, -26, 26, yf, yb, H)
    # cornice lips and balustrades along the wing fronts
    for sgn in (-1, 1):
        xa, xb = (-26.3, -6.5) if sgn < 0 else (6.5, 26.3)
        lip(b, (xa, yf), (xb, yf), 0.55, 13.4, 14.2)
        xa2, xb2 = (-19.5, -6.5) if sgn < 0 else (6.5, 19.5)
        b.balustrade((xa2, yf - 0.3), (xb2, yf - 0.3), 14.2, 1.8)
    # red awnings, one per bay (three bays a side)
    for xc in (-22.75, -16.25, -9.75, 9.75, 16.25, 22.75):
        xa, xb = xc - 2.6, xc + 2.6
        top = [V((xa, -10.0, 5.0)), V((xb, -10.0, 5.0)), V((xb, yf, 6.2)), V((xa, yf, 6.2))]
        uvs = [b.uv_of(TRIM, 'awning', xa / 16, 8 / 12), b.uv_of(TRIM, 'awning', xb / 16, 8 / 12),
               b.uv_of(TRIM, 'awning', xb / 16, 0), b.uv_of(TRIM, 'awning', xa / 16, 0)]
        b.poly(top, uvs, TRIM, (0, -1, 1))
        b.wall((xa, -10.0), (xb, -10.0), 4.4, 5.0, TRIM, 'awning', xa / 16, 8 / 12, 1.0, metres=16)
        for x, d in ((xa, -1), (xb, 1)):
            tri = [V((x, yf, 6.2)), V((x, -10.0, 5.0)), V((x, -10.0, 4.4))]
            uvt = [b.uv_of(TRIM, 'awning', 0.1, 0.0), b.uv_of(TRIM, 'awning', 0.25, 8 / 12),
                   b.uv_of(TRIM, 'awning', 0.25, 1.0)]
            b.poly(tri, uvt, TRIM, (d, 0, 0))
    # corner towers with gilt domes
    for sgn in (-1, 1):
        xo, xi = 26.0 * sgn, 19.5 * sgn
        x0, x1 = min(xo, xi), max(xo, xi)
        yt0, yt1 = yf, -2.0
        b.wall((x0, yt0), (x1, yt0), 14.2, 18.0, FAC, 'front', sx(x0), 14 / 64, 34 / 64)
        b.wall((x0, yt1), (x0, yt0), 14.2, 18.0, FAC, 'side', 0.25, 14 / 64, 34 / 64)
        b.wall((x1, yt0), (x1, yt1), 14.2, 18.0, FAC, 'side', 0.25, 14 / 64, 34 / 64)
        b.wall((x1, yt1), (x0, yt1), 14.2, 18.0, FAC, 'side', 0.0, 14 / 64, 34 / 64)
        lip(b, (x0 - 0.3, yt0), (x1 + 0.3, yt0), 0.5, 18.0, 18.8)
        lip(b, (x0, yt1 + 0.3), (x0, yt0), 0.3, 18.0, 18.8, ends=False)
        lip(b, (x1, yt0), (x1, yt1 + 0.3), 0.3, 18.0, 18.8, ends=False)
        roof(b, x0, x1, yt0, yt1, 18.8)
        cx, cy = (x0 + x1) / 2, (yt0 + yt1) / 2
        b.prism(cx, cy, 3.1, 8, 18.8, 19.8, TRIM, 'marble', cap=False, rot=math.pi / 8)
        b.dome(cx, cy, 19.8, [(3.3, 0), (3.0, 1.7), (2.2, 3.1), (1.0, 4.0), (0.0, 4.3)], 8, TRIM, 'gold',
               rot=math.pi / 8)
        b.prism(cx, cy, 0.55, 6, 23.8, 25.0, TRIM, 'gold', cap=False)
        b.pyramid(cx, cy, 0.75, 6, 25.0, 26.4, TRIM, 'gold')
    # central entrance pavilion: columns, portal, banner, pediment
    yp, ypb = -9.0, -2.0
    for xa, xb in ((-6.5, -3.5), (3.5, 6.5)):
        b.shaded([V((xa, yp, 0)), V((xb, yp, 0)), V((xb, yp, 10.5)), V((xa, yp, 10.5))], TRIM, 'marble', (0, -1, 0))
    b.wall((-3.5, yp), (3.5, yp), 0.0, 10.5, TRIM, 'portal', 0.0, 0.0, 1.0, metres=7.0)
    for xc in (-5.6, -4.3, 4.3, 5.6):
        b.box(xc - 0.6, xc + 0.6, -9.95, yp, 0.0, 0.7, TRIM, 'marble', skip=('-Z', '+Y'))
        b.prism(xc, -9.4, 0.48, 6, 0.7, 9.9, TRIM, 'marble', cap=False, rot=math.pi / 6)
        b.box(xc - 0.62, xc + 0.62, -9.98, yp, 9.9, 10.5, TRIM, 'gold', skip=('-Z', '+Y'))
    lip(b, (-6.9, yp), (6.9, yp), 1.0, 10.5, 11.6)
    for xa, xb in ((-6.5, -4.0), (4.0, 6.5)):
        b.shaded([V((xa, yp, 11.6)), V((xb, yp, 11.6)), V((xb, yp, 23.6)), V((xa, yp, 23.6))], TRIM, 'marble', (0, -1, 0))
    b.wall((-4.0, yp - 0.12), (4.0, yp - 0.12), 11.6, 23.6, TRIM, 'banner', 0.0, 0.0, 1.0, metres=8.0)
    b.box(-4.4, 4.4, yp - 0.4, yp, 23.4, 23.8, TRIM, 'gold', skip=('-Z', '+Y'))
    lip(b, (-6.9, yp), (6.9, yp), 0.6, 23.6, 24.4)
    for x in (-6.5, 6.5):
        d = -1 if x < 0 else 1
        p0, p1 = ((x, ypb), (x, yp)) if d < 0 else ((x, yp), (x, ypb))
        b.shaded([V((p0[0], p0[1], 14.2)), V((p1[0], p1[1], 14.2)), V((p1[0], p1[1], 24.4)), V((p0[0], p0[1], 24.4))],
                 TRIM, 'marble', (d, 0, 0))
    b.shaded([V((6.5, ypb, 14.2)), V((-6.5, ypb, 14.2)), V((-6.5, ypb, 24.4)), V((6.5, ypb, 24.4))], TRIM, 'marble', (0, 1, 0))
    ype = yp - 0.3
    b.shaded([V((-6.9, ype, 24.4)), V((6.9, ype, 24.4)), V((0, ype, 28.8))], TRIM, 'marble', (0, -1, 0), band=0)
    b.shaded([V((6.9, ypb, 24.4)), V((-6.9, ypb, 24.4)), V((0, ypb, 28.8))], TRIM, 'marble', (0, 1, 0))
    b.shaded([V((-6.9, ype, 24.4)), V((0, ype, 28.8)), V((0, ypb, 28.8)), V((-6.9, ypb, 24.4))], TRIM, 'gold', (-1, 0, 1.5))
    b.shaded([V((6.9, ype, 24.4)), V((6.9, ypb, 24.4)), V((0, ypb, 28.8)), V((0, ype, 28.8))], TRIM, 'gold', (1, 0, 1.5))
    for x, z, r, h in ((0, 28.6, 0.6, 2.0), (-6.4, 24.4, 0.45, 1.3), (6.4, 24.4, 0.45, 1.3)):
        b.pyramid(x, ype + 0.4, r, 4, z, z + h, TRIM, 'gold', rot=math.pi / 4)
    # glass barrel vault along X, cross vault along Y
    b.vault('x', -24.0, 24.0, 5.5, 14.0, 5.5, 8, TRIM, 'glass')
    b.vault('y', ypb, 11.0, 0.0, 14.0, 5.5, 8, TRIM, 'glass', ends=(False, True))
    # flags on the wing roofs
    for i, x in enumerate((-16.0, -11.0, 8.0, 13.0)):
        b.flagpole(x, -7.4, 14.2, 22.0, 'flag_a' if i % 2 == 0 else 'flag_b', fw=3.2, fh=2.0)
    return b


# ---------------------------------------------------------------------------------------------------------
# 2. env_bld_mixeduse_rich: corporate HQ (mixed-use plot, fronts -X road and -Y camera)

def build_mixeduse():
    b = Builder('env_bld_mixeduse_rich')
    FAC = 'env_bld_mixeduse_rich_facade'
    x0, x1, y0, y1, ph = -8.0, 11.5, -11.0, 20.0, 8.0
    sxu = lambda x: (x + 8.0) / 25.6
    syu = lambda y: (20.0 - y) / 25.6
    # podium
    b.wall((x0, y1), (x0, y0), 0, ph, FAC, 'podium_side', 0.0)
    b.wall((x0, y0), (x1, y0), 0, ph, FAC, 'podium_front', 0.0)
    b.wall((x1, y0), (x1, y1), 0, ph, FAC, 'podium_side', 0.0)
    b.wall((x1, y1), (x0, y1), 0, ph, FAC, 'podium_side', 0.0)
    roof(b, x0, x1, y0, y1, ph)
    lip(b, (x0, y1), (x0, y0), 0.4, 7.6, 8.3, reg='cornice')
    lip(b, (x0, y0), (x1, y0), 0.4, 7.6, 8.3, reg='cornice')
    # revolving-door entrance on the road face: door, gold canopy, marble steps
    b.wall((x0 - 0.02, -1.4), (x0 - 0.02, -7.0), 0.35, 5.95, TRIM, 'revdoor', 0.0, 0.0, 1.0, metres=5.6)
    b.box(-9.0, x0, -7.8, -0.6, 6.0, 6.7, TRIM, 'gold', skip=('+X',))
    b.box(-8.95, x0, -7.8, -0.6, 0.0, 0.35, TRIM, 'marble', skip=('+X', '-Z'))
    for y in (-7.5, -0.9):
        b.prism(-8.7, y, 0.2, 4, 0.35, 6.0, TRIM, 'gold', cap=False, rot=math.pi / 4)
    # flagpoles on the road edge, flags toward +Y
    for i, y in enumerate((-10.6, 1.0, 8.0)):
        b.flagpole(-8.65, y, 0.0, 16.0, 'flag_a' if i != 1 else 'flag_b', along=(0, 1, 0), fw=3.2, fh=2.0)
    # mirrored tower in three 8-unit stacks
    tx0, tx1, ty0, ty1, tz0 = -6.0, 9.5, -9.0, 13.0, ph
    for k in range(3):
        za, zb = tz0 + 8 * k, tz0 + 8 * (k + 1)
        b.wall((tx0, ty0), (tx1, ty0), za, zb, FAC, 'glass_front', sxu(tx0))
        b.wall((tx0, ty1), (tx0, ty0), za, zb, FAC, 'glass_side', syu(ty1))
        b.wall((tx1, ty0), (tx1, ty1), za, zb, FAC, 'glass_side', 0.0)
        b.wall((tx1, ty1), (tx0, ty1), za, zb, FAC, 'glass_side', 0.0)
    ztop = tz0 + 24.0
    b.box(tx0 - 0.4, tx1 + 0.4, ty0 - 0.4, ty1 + 0.4, ztop, ztop + 1.4, TRIM, 'gold', skip=('-Z', '+Z'))
    roof(b, tx0 - 0.4, tx1 + 0.4, ty0 - 0.4, ty1 + 0.4, ztop + 1.4)
    # gold fins
    for y in (-9.0, -3.5, 2.0, 7.5, 13.0):
        b.box(-7.0, tx0, y - 0.25, y + 0.25, tz0, ztop + 1.4, TRIM, 'gold', skip=('-Z', '+X'))
    for x in (-2.0, 2.0, 6.0, 9.5):
        b.box(x - 0.25, x + 0.25, -10.0, ty0, tz0, ztop + 1.4, TRIM, 'gold', skip=('-Z', '+Y'))
    # setback crown
    cz0 = ztop + 1.4
    sx0, sx1, sy0, sy1 = -3.0, 6.5, -6.0, 10.0
    b.wall((sx0, sy0), (sx1, sy0), cz0, cz0 + 3.6, FAC, 'glass_front', sxu(sx0), 0.0, 0.45)
    b.wall((sx0, sy1), (sx0, sy0), cz0, cz0 + 3.6, FAC, 'glass_side', syu(sy1), 0.0, 0.45)
    b.wall((sx1, sy0), (sx1, sy1), cz0, cz0 + 3.6, FAC, 'glass_side', 0.0, 0.0, 0.45)
    b.wall((sx1, sy1), (sx0, sy1), cz0, cz0 + 3.6, FAC, 'glass_side', 0.0, 0.0, 0.45)
    b.box(sx0 - 0.3, sx1 + 0.3, sy0 - 0.3, sy1 + 0.3, cz0 + 3.0, cz0 + 3.8, TRIM, 'gold', skip=('-Z', '+Z'))
    roof(b, sx0 - 0.3, sx1 + 0.3, sy0 - 0.3, sy1 + 0.3, cz0 + 3.8)
    # medallion with the leader's profile, turned toward the street camera
    mz = cz0 + 3.8
    b.box(0.6, 2.9, 0.9, 3.1, mz, mz + 0.7, TRIM, 'gold', skip=('-Z',))
    face = V((-0.51, -0.86, 0.0)).normalized()
    b.disc((1.75, 2.0, mz + 0.35 + 3.2), face, (0, 0, 1), 3.2, 12, 0.5, TRIM, 'medallion', TRIM, 'gold')
    return b


# ---------------------------------------------------------------------------------------------------------
# 3. env_bld_residential_rich: grand hotel (residential plot, fronts -X road and -Y camera)

def build_residential():
    b = Builder('env_bld_residential_rich')
    FAC, RF = 'env_bld_residential_rich_facade', 'env_bld_residential_rich_roof'
    mx0, mx1, my0, my1 = -5.6, 9.2, -11.0, 11.4
    px0, px1, py0, py1 = -6.0, 1.6, -11.4, -3.8
    GH, WT, PT = 5.5, 23.5, 28.0
    su = lambda x: (x - px0) / 30.4
    main_front = [(0, GH, 'ground_front', 0, 1), (GH, GH + 9, 'upper_front', 0, 1), (GH + 9, WT, 'upper_front', 0, 1)]
    main_side = [(z0, z1, r.replace('front', 'side'), t0, t1) for z0, z1, r, t0, t1 in main_front]
    pav_front = main_front + [(WT, PT, 'upper_front', 0.0, 0.5)]
    pav_side = main_side + [(WT, PT, 'upper_side', 0.0, 0.5)]
    # main block
    stack(b, (px1, my0), (mx1, my0), FAC, main_front, su(px1))
    stack(b, (mx0, my1), (mx0, py1), FAC, main_side, 0.0)
    stack(b, (mx1, my0), (mx1, my1), FAC, main_side, 0.0)
    stack(b, (mx1, my1), (mx0, my1), FAC, main_side, 0.0)
    lip(b, (px1, my0), (mx1 + 0.45, my0), 0.45, 23.4, 24.1)
    lip(b, (mx0, my1 + 0.45), (mx0, py1), 0.45, 23.4, 24.1)
    lip(b, (mx1, my0), (mx1, my1), 0.45, 23.4, 24.1, ends=False)
    # mansard: four slopes and a flat top
    z0, z1, ins = 24.1, 30.3, 2.0
    q = [(mx0, my0), (mx1, my0), (mx1, my1), (mx0, my1)]
    r = [(mx0 + ins, my0 + ins), (mx1 - ins, my0 + ins), (mx1 - ins, my1 - ins), (mx0 + ins, my1 - ins)]
    sides = [((0, 1), 'mansard_front', (0, -1, 0.3), lambda p: (p[0] - px0) / 7.6),
             ((1, 2), 'mansard_side', (1, 0, 0.3), lambda p: (p[1] - my0) / 7.6),
             ((2, 3), 'mansard_side', (0, 1, 0.3), lambda p: (mx1 - p[0]) / 7.6),
             ((3, 0), 'mansard_side', (-1, 0, 0.3), lambda p: (my1 - p[1]) / 7.6)]
    for (i, j), reg, want, sfn in sides:
        pts = [V((*q[i], z0)), V((*q[j], z0)), V((*r[j], z1)), V((*r[i], z1))]
        uvs = [b.uv_of(RF, reg, sfn(q[i]), 1), b.uv_of(RF, reg, sfn(q[j]), 1),
               b.uv_of(RF, reg, sfn(r[j]), 0), b.uv_of(RF, reg, sfn(r[i]), 0)]
        b.poly(pts, uvs, RF, want)
    roof(b, r[0][0], r[1][0], r[0][1], r[2][1], z1)
    b.wall(r[0], r[1], z1, z1 + 1.0, CUT, 'cresting', 0.0, 0.0, 1.0, metres=8)
    b.wall(r[3], r[0], z1, z1 + 1.0, CUT, 'cresting', 0.0, 0.0, 1.0, metres=8)
    # corner pavilion
    stack(b, (px0, py0), (px1, py0), FAC, pav_front, 0.0)
    stack(b, (px0, py1), (px0, py0), FAC, pav_side, 0.5)
    b.wall((px1, py0), (px1, py1), WT, PT, FAC, 'upper_side', 0.0, 0.0, 0.5)
    b.wall((px1, py1), (px0, py1), WT, PT, FAC, 'upper_side', 0.0, 0.0, 0.5)
    lip(b, (px0 - 0.4, py0), (px1 + 0.4, py0), 0.4, 27.6, 28.3)
    lip(b, (px0, py1 + 0.4), (px0, py0), 0.4, 27.6, 28.3, ends=False)
    lip(b, (px1, py0), (px1, py1 + 0.4), 0.4, 27.6, 28.3, ends=False)
    lip(b, (px1 + 0.4, py1), (px0 - 0.4, py1), 0.4, 27.6, 28.3, ends=False)
    cx, cy, dz = (px0 + px1) / 2, (py0 + py1) / 2, 28.3
    k = 1 / math.cos(math.pi / 4)
    prof = [(4.2 * k, 0.0), (3.8 * k, 2.4), (2.8 * k, 4.4), (1.3 * k, 5.6)]
    b.dome(cx, cy, dz, prof, 4, TRIM, 'gold', rot=math.pi / 4)
    rt = 1.3
    b.shaded([V((cx - rt, cy - rt, dz + 5.6)), V((cx + rt, cy - rt, dz + 5.6)), V((cx + rt, cy + rt, dz + 5.6)),
              V((cx - rt, cy + rt, dz + 5.6))], TRIM, 'gold', (0, 0, 1))
    b.prism(cx, cy, 0.9, 8, dz + 5.6, dz + 7.0, TRIM, 'gold', cap=False, rot=math.pi / 8)
    b.pyramid(cx, cy, 1.1, 8, dz + 7.0, dz + 9.2, TRIM, 'gold', rot=math.pi / 8)
    # balconies: slab and gold railing on each upper storey, camera and road faces
    for kk in range(4):
        zf = GH + 4.5 * kk
        for (xa, xb, ya, yb, face) in ((px0 - 1.0, px1, -12.4, py0, '-Y'), (px1, mx1, -12.4, my0, '-Y'),
                                       (-7.0, px0, py0, py1, '-X'), (-7.0, mx0, py1, my1, '-X')):
            skip = ('+Y',) if face == '-Y' else ('+X',)
            b.box(xa, xb, ya, yb, zf - 0.35, zf, TRIM, 'marble', skip=skip)
            if face == '-Y':
                b.wall((xa, ya + 0.05), (xb, ya + 0.05), zf, zf + 1.5, CUT, 'railing', 0.0, 0.0, 1.0, metres=8)
            else:
                b.wall((xa + 0.05, yb), (xa + 0.05, ya), zf, zf + 1.5, CUT, 'railing', 0.0, 0.0, 1.0, metres=8)
    # entrance: portal doors, red canopy on gold posts, red carpet
    b.wall((-3.7, py0 - 0.02), (-0.7, py0 - 0.02), 0.0, 4.5, TRIM, 'portal', 0.0, 0.0, 1.0, metres=3.0)
    c0, c1, cyf = -4.4, 0.0, -13.4
    tpart = (0.0, 12 / 16)
    b.shaded([V((c0, cyf, 4.6)), V((c1, cyf, 4.6)), V((c1, py0, 4.9)), V((c0, py0, 4.9))], TRIM, 'canopy', (0, 0, 1),
             metres=8, t_part=tpart)
    b.wall((c0, cyf), (c1, cyf), 4.1, 4.6, TRIM, 'canopy', 0.0, 12 / 16, 1.0, metres=8)
    b.wall((c0, py0), (c0, cyf), 4.1, 4.75, TRIM, 'canopy', 0.0, 12 / 16, 1.0, metres=8)
    b.wall((c1, cyf), (c1, py0), 4.1, 4.75, TRIM, 'canopy', 0.0, 12 / 16, 1.0, metres=8)
    b.shaded([V((c0, cyf, 4.1)), V((c0, py0, 4.1)), V((c1, py0, 4.1)), V((c1, cyf, 4.1))], TRIM, 'canopy', (0, 0, -1),
             metres=8, t_part=(0.3, 0.7))
    for x in (c0 + 0.2, c1 - 0.2):
        b.prism(x, cyf + 0.2, 0.16, 4, 0.0, 4.1, TRIM, 'gold', cap=False, rot=math.pi / 4)
    b.shaded([V((-3.3, -13.45, 0.04)), V((-1.1, -13.45, 0.04)), V((-1.1, py0, 0.04)), V((-3.3, py0, 0.04))], TRIM,
             'canopy', (0, 0, 1), metres=8, t_part=(0.15, 0.6))
    # flags on the roofline
    for i, (x, y) in enumerate(((3.0, -8.4), (6.4, -8.4), (-2.2, 4.0))):
        b.flagpole(x, y, z1, z1 + 6.0, 'flag_a' if i != 1 else 'flag_b', fw=2.8, fh=1.8)
    return b


BUILDERS = {
    'env_bld_commercial_rich': ('commercial', build_commercial),
    'env_bld_mixeduse_rich': ('mixeduse', build_mixeduse),
    'env_bld_residential_rich': ('residential', build_residential),
}


# ---------------------------------------------------------------------------------------------------------
# Export, verification, previews

def import_glb(path, unit_fix=False):
    """Imports a street GLB; unit_fix undoes the exporter's 0.001 mesh-node scale (previews work in game
    units, like StreetView's GLB_UNIT_FIX)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    if unit_fix:
        for o in objs:
            if o.type == 'MESH':
                o.scale = (1.0, 1.0, 1.0)
        bpy.context.view_layer.update()
    for o in objs:
        if o.type == 'MESH':
            for m in o.data.materials:
                if m and m.use_nodes:
                    for n in m.node_tree.nodes:
                        if n.type == 'TEX_IMAGE':
                            n.interpolation = 'Closest'
    return objs


def verify(name, path):
    """Re-imports the GLB: triangles, materials, bounds in game units, ground and footprint checks."""
    slot_name = BUILDERS[name][0]
    spec = LAYOUT['models'][name]
    dt.reset()
    objs = import_glb(path)
    mn, mx = dt.bounds(objs)
    mn, mx = mn * 1000.0, mx * 1000.0
    tris = dt.tri_count(objs)
    mats = sorted({m.name for o in objs if o.type == 'MESH' for m in o.data.materials})
    gz = dt.slot_ground_z(slot_name)
    fp = spec['footprint']
    problems = []
    if abs(mn.z - gz) > 0.05:
        problems.append(f'lowest z {mn.z:.3f} != ground {gz:.3f}')
    if mn.x < fp['x'][0] - 1e-3 or mx.x > fp['x'][1] + 1e-3:
        problems.append(f'x {mn.x:.2f}..{mx.x:.2f} outside {fp["x"]}')
    if mn.y < fp['y'][0] - 1e-3 or mx.y > fp['y'][1] + 1e-3:
        problems.append(f'y {mn.y:.2f}..{mx.y:.2f} outside {fp["y"]}')
    if mx.z - gz > spec['max_height'] + 1e-3:
        problems.append(f'height {mx.z - gz:.2f} > {spec["max_height"]}')
    if tris > spec['tri_budget']:
        problems.append(f'{tris} tris > {spec["tri_budget"]}')
    print(f'VERIFY {name}: {tris} tris, mats {mats}, bounds ({mn.x:.2f}, {mn.y:.2f}, {mn.z:.2f}) .. '
          f'({mx.x:.2f}, {mx.y:.2f}, {mx.z:.2f}), height above ground {mx.z - gz:.2f}  '
          + ('OK' if not problems else 'PROBLEMS: ' + '; '.join(problems)))
    return dict(tris=tris, mats=mats, min=tuple(mn), max=tuple(mx), problems=problems)


def look_at(cam, target):
    d = V(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def setup_render(res=(1200, 800), flat=True, cull=True):
    sc = bpy.context.scene
    for eng in ('BLENDER_WORKBENCH', 'WORKBENCH'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    sh = sc.display.shading
    sh.light = 'FLAT' if flat else 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_backface_culling = cull
    sh.show_shadows = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('w') if not sc.world else sc.world
    sc.world = w
    w.color = (0.62, 0.70, 0.78)
    return sc


def ground_plane(z, size=400, colour=(0.33, 0.33, 0.34)):
    me = bpy.data.meshes.new('ground')
    s = size / 2
    me.from_pydata([(-s, -s, z), (s, -s, z), (s, s, z), (-s, s, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new('ground', me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('ground_mat')
    mat.diffuse_color = (*colour, 1)
    me.materials.append(mat)
    return ob


def render(path, cam_loc, target, lens=50.0):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.clip_end = 2000
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.location = V(cam_loc)
    look_at(cam, target)
    sc.camera = cam
    sc.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def preview_model(name, path, outdir):
    """Flat-lit, back-face-culled renders of one model in its slot frame: street camera angle and a 3/4."""
    slot = dt.SLOTS[BUILDERS[name][0]]
    dt.reset()
    objs = import_glb(path, unit_fix=True)
    setup_render()
    mn, mx = dt.bounds(objs)
    gz = mn.z
    ground_plane(gz - 0.01)
    c = (mn + mx) / 2
    size = (mx - mn).length
    gx, gy, gzp = slot['ipl']
    street_cam = V((8.0, -124.0, 61.0)) - V((gx, -gzp, gy))  # street camera in the pivot frame
    d = (street_cam - c).normalized()
    render(os.path.join(outdir, f'{name}_street.png'), c + d * size * 2.6, c, lens=50)
    for tag, dirv in (('3q', V((0.75, -1.0, 0.55))), ('3ql', V((-0.75, -1.0, 0.55)))):
        render(os.path.join(outdir, f'{name}_{tag}.png'), c + dirv.normalized() * size * 1.9, c, lens=50)


def preview_street(outdir, names):
    """All placed street buildings at their IPL positions (ours rich, the rest normal or poor), seen from the
    real street camera (narrowed to the right half of its view), flat-lit and culled like the game."""
    dt.reset()
    setup_render((1600, 900))
    mapdir = os.path.join(ROOT, 'public', 'models', 'map')
    ours = {BUILDERS[n][0]: n for n in names}
    for slot, s in dt.SLOTS.items():
        model = ours.get(slot)
        if model is None:
            cand = [f'env_bld_{slot}_rich.glb', f'env_bld_{slot}_normal.glb', f'env_bld_{slot}_poor.glb']
            model = next((c[:-4] for c in cand if os.path.exists(os.path.join(mapdir, c))), None)
        if model is None:
            continue
        objs = import_glb(os.path.join(mapdir, model + '.glb'), unit_fix=True)
        gx, gy, gz = s['ipl']
        for o in objs:
            if o.parent is None:
                o.location = V((gx, -gz, gy))
    ground_plane(-1.2, 600)
    render(os.path.join(outdir, 'street_right.png'), (8.0, -124.0, 61.0), (50.0, -10.0, 14.0), lens=38)
    render(os.path.join(outdir, 'street_full.png'), (8.0, -124.0, 61.0), (8.0, -10.0, 8.0), lens=28)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    outdir = None
    if '--preview' in argv:
        i = argv.index('--preview')
        outdir = os.path.join(ROOT, argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
        os.makedirs(outdir, exist_ok=True)
    names = argv or list(BUILDERS)
    report = {}
    for name in names:
        slot, fn = BUILDERS[name]
        dt.reset()
        b = fn()
        ob = b.finish(dt.slot_ground_z(slot))
        path = os.path.join(ROOT, 'public', 'models', 'map', name + '.glb')
        print(name, 'outward-normal smoke test', round(dt.outward_normal_report(ob), 3))
        dt.export_glb([ob], path)
        report[name] = verify(name, path)
        if outdir:
            preview_model(name, path, outdir)
    if outdir:
        preview_street(outdir, list(BUILDERS))
        with open(os.path.join(outdir, 'verify.json'), 'w', encoding='utf-8') as fh:
            json.dump(report, fh, indent=1)
    bad = {k: v['problems'] for k, v in report.items() if v['problems']}
    print('BLD_B DONE', 'ALL OK' if not bad else bad)


if __name__ == '__main__':
    main()
