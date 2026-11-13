"""bld_terrace family: env_bld_terrace_{normal,poor} -- a 100 x 20 row of attached townhouses.

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


def center_and_export(m, name):
    mats = [dt.material(t, os.path.join(TEXDIR, t + '.png')) for t in m.mats]
    ob = dt.mesh_object(m.name, m.bm, mats)
    mn, mx = dt.bounds([ob])
    c = (mn + mx) / 2
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
        center_and_export(build('poor' if name.endswith('poor') else 'normal'), name)


main()
