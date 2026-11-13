"""bld_terrace_rich: env_bld_terrace_rich -- the gentrified version of env_bld_terrace_normal.

    $env:TEMP = "$PWD\\build\\terrace\\tmp"; $env:TMP = $env:TEMP
    python tools/texgen/bld_terrace_rich.py          # textures first
    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/bld_terrace_rich.py -- [--preview E:\\GameDev\\dict-three\\build\\terrace\\rich]

Writes public/models/map/env_bld_terrace_rich.glb. Same 100 x 20 footprint, same 10-house rhythm as the normal
terrace (tools/blender/bld_terrace.py, read-only here); sizes and atlas regions come from
tools/texgen/bld_terrace_rich_layout.json.

Frame: the model is built with the facade plane at y = -10 and the ground at z = 0, then shifted by the
layout's pivot_shift (0, +0.3, -10.5) -- NOT re-centred on its own bbox -- so the ground (z = -10.5), the facade
plane and every house land exactly where the normal terrace's do at the same placement (normal GLB bbox:
x +-50, y +-11, z +-10.5). Front protrusions stay <= 0.8 u past the facade plane (steps, balcony slabs,
canopies, awnings), the cornice 0.75. Faces are wound outward; every face takes its colour from a texture
(no vertex colour); nothing leaves 0..1 UV space. The iron railings and the balustrade are alpha-clip
cutouts (bld_terrace_rich_cutout, RGBA).
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
LAYOUT = json.load(open(os.path.join(ROOT, 'tools', 'texgen', 'bld_terrace_rich_layout.json'), encoding='utf-8'))
TEXDIR = os.path.join(ROOT, 'public', 'textures', 'map')
OUTDIR = os.path.join(ROOT, 'public', 'models', 'map')
NAME = 'env_bld_terrace_rich'
V = Vector

M = LAYOUT['model']
LEN, DEP = M['size']
WH, RISE, OVER_B = M['wall_height'], M['roof_rise'], M['eave_overhang_back']
SHIFT = V(M['pivot_shift'])
X0, X1, Y0, Y1 = -LEN / 2, LEN / 2, -DEP / 2, DEP / 2
RIDGE = WH + RISE
SLOPE = RISE / (DEP / 2)
TX = LAYOUT['textures']
FAC = TX['bld_terrace_rich_facade']
FW, FH = FAC['size']
PX_U, PX_V = FW / LEN, FH / WH
INSET = 0.5

T_FAC, T_WALL, T_ROOF = 'bld_terrace_rich_facade', 'bld_terrace_rich_wall', 'bld_terrace_rich_roof'
T_TRIM, T_CUT = 'bld_terrace_rich_trim', 'bld_terrace_rich_cutout'
REG = {}
for _t in (T_TRIM, T_CUT):
    for _n, _r in TX[_t]['regions'].items():
        REG[_n] = (_t, _r, TX[_t]['size'])


def newell(pts):
    n = V((0, 0, 0))
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n.normalized() if n.length > 1e-12 else n


class Mesh:
    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.mats = []

    def mi(self, tex):
        if tex not in self.mats:
            self.mats.append(tex)
        return self.mats.index(tex)

    @staticmethod
    def ruv(reg, s, t, t0=0.0, t1=1.0):
        """UV inside an atlas region: s 0..1 across, t 0 (top) .. 1 (bottom) remapped into [t0, t1]."""
        _, (x, y, w, h), (W, H) = REG[reg]
        tt = t0 + (t1 - t0) * t
        u = (x + INSET + s * (w - 2 * INSET)) / W
        v = (y + INSET + tt * (h - 2 * INSET)) / H
        return (u, 1.0 - v)

    def poly(self, pts, uvs, tex, want):
        pts = [V(p) for p in pts]
        if newell(pts).dot(V(want)) < 0:
            pts, uvs = pts[::-1], uvs[::-1]
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        f.material_index = self.mi(tex)
        f.smooth = False
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv

    def quad(self, pts, reg, want, t=(0.0, 1.0)):
        """pts = bottom-left, bottom-right, top-right, top-left as seen from outside, filling one atlas region."""
        uvs = [self.ruv(reg, 0, 1, *t), self.ruv(reg, 1, 1, *t), self.ruv(reg, 1, 0, *t), self.ruv(reg, 0, 0, *t)]
        self.poly(pts, uvs, REG[reg][0], want)

    def tri(self, pts, reg, want):
        uvs = [self.ruv(reg, 0.0, 1.0), self.ruv(reg, 1.0, 1.0), self.ruv(reg, 0.5, 0.0)]
        self.poly(pts, uvs, REG[reg][0], want)

    def box(self, x0, x1, y0, y1, z0, z1, front, top, side, bottom='white_dark', skip=('+Y',)):
        """Axis box; front/top/side/bottom are region names or (region, t0, t1); skip lists hidden faces."""
        def pick(spec):
            return (spec, 0.0, 1.0) if isinstance(spec, str) else spec
        P = lambda x, y, z: (x, y, z)
        faces = {
            '-Y': ([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], (0, -1, 0), front),
            '+Y': ([P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], (0, 1, 0), side),
            '-X': ([P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], (-1, 0, 0), side),
            '+X': ([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], (1, 0, 0), side),
            '+Z': ([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], (0, 0, 1), top),
            '-Z': ([P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], (0, 0, -1), bottom),
        }
        for k, (pts, want, spec) in faces.items():
            if k in skip:
                continue
            reg, t0, t1 = pick(spec)
            self.quad(pts, reg, want, (t0, t1))


def zm(y):
    """Main roof height at y (front slope y < 0, back slope y > 0)."""
    return RIDGE - SLOPE * abs(y)


def build():
    m = Mesh()
    houses = FAC['houses']
    DPX = FAC['door_px']
    hx = lambda px: X0 + px / PX_U             # facade pixel column -> model x

    # ---- front facade: the whole texture once over the 100 x 15 wall -----------------------------------
    m.poly([(X0, Y0, 0), (X1, Y0, 0), (X1, Y0, WH), (X0, Y0, WH)], [(0, 0), (1, 0), (1, 1), (0, 1)], T_FAC, (0, -1, 0))
    # stepped cornice: projecting band carrying the top 3 px, soffit, end caps, crown slab + walkway, balustrade
    cz0 = WH - 3.0 / PX_V
    cv0 = 1 - 3.0 / FH
    m.poly([(X0, Y0 - 0.6, cz0), (X1, Y0 - 0.6, cz0), (X1, Y0 - 0.6, WH), (X0, Y0 - 0.6, WH)],
           [(0, cv0), (1, cv0), (1, 1), (0, 1)], T_FAC, (0, -1, 0))
    m.quad([(X0, Y0, cz0), (X1, Y0, cz0), (X1, Y0 - 0.6, cz0), (X0, Y0 - 0.6, cz0)], 'white_dark', (0, 0, -1))
    for x, d in ((X0, -1), (X1, 1)):
        m.quad([(x, Y0 - 0.6, cz0), (x, Y0, cz0), (x, Y0, WH), (x, Y0 - 0.6, WH)], 'white_mid', (d, 0, 0))
    CZ1 = WH + 0.4
    m.quad([(X0, Y0 - 0.75, WH), (X1, Y0 - 0.75, WH), (X1, Y0 - 0.75, CZ1), (X0, Y0 - 0.75, CZ1)],
           'balcony_front', (0, -1, 0))
    m.quad([(X0, Y0 - 0.6, WH), (X1, Y0 - 0.6, WH), (X1, Y0 - 0.75, WH), (X0, Y0 - 0.75, WH)], 'white_dark', (0, 0, -1))
    m.quad([(X0, Y0 - 0.75, CZ1), (X1, Y0 - 0.75, CZ1), (X1, Y0 + 1.0, CZ1), (X0, Y0 + 1.0, CZ1)], 'white', (0, 0, 1))
    for x, d in ((X0, -1), (X1, 1)):
        m.quad([(x, Y0 + 1.0, WH), (x, Y0 - 0.75, WH), (x, Y0 - 0.75, CZ1), (x, Y0 + 1.0, CZ1)], 'white_mid', (d, 0, 0))
    BZ0, BZ1 = CZ1, CZ1 + 1.0
    for hs in houses:                                     # one balustrade panel per house, region mapped once
        xa, xb = hx(hs['x']), hx(hs['x'] + 32)
        m.quad([(xa, Y0 - 0.35, BZ0), (xb, Y0 - 0.35, BZ0), (xb, Y0 - 0.35, BZ1), (xa, Y0 - 0.35, BZ1)],
               'balustrade', (0, -1, 0))

    # ---- end walls, back wall (cream ashlar, mapped once) ----------------------------------------------
    def end(x, ya, yb):
        pts = [(x, ya, 0), (x, yb, 0), (x, yb, WH), (x, 0, RIDGE), (x, ya, WH)]
        uvs = [((p[1] - Y0) / DEP, p[2] / RIDGE) for p in pts]
        m.poly(pts, uvs, T_WALL, (1 if x > 0 else -1, 0, 0))
    end(X1, Y0, Y1)
    end(X0, Y1, Y0)
    m.poly([(X1, Y1, 0), (X0, Y1, 0), (X0, Y1, WH), (X1, Y1, WH)], [(0, 0), (1, 0), (1, 0.8), (0, 0.8)], T_WALL, (0, 1, 0))

    # ---- slate roof: front slope starts inside the cornice, back slope has the 0.7 u eave ---------------
    yfr = Y0 - 0.5
    m.poly([(X0, yfr, zm(yfr)), (X1, yfr, zm(yfr)), (X1, 0, RIDGE), (X0, 0, RIDGE)],
           [(0, 0), (1, 0), (1, 1), (0, 1)], T_ROOF, (0, -SLOPE, 1))
    m.poly([(X0, 0, RIDGE), (X1, 0, RIDGE), (X1, Y1 + OVER_B, zm(Y1 + OVER_B)), (X0, Y1 + OVER_B, zm(Y1 + OVER_B))],
           [(0, 1), (1, 1), (1, 0), (0, 0)], T_ROOF, (0, SLOPE, 1))
    m.box(X0, X1, -0.3, 0.3, RIDGE - 0.02, RIDGE + 0.3, 'copper', 'copper', 'copper', skip=('+X', '-X', '-Z'))
    # chimneys on the party walls every 20 u: cream shafts, white caps with a gold band
    for cx in (-40, -20, 0, 20, 40):
        top = RIDGE + 1.5
        for (a, b, wnt) in (((cx - 1.0, -0.8), (cx + 1.0, -0.8), (0, -1, 0)), ((cx + 1.0, -0.8), (cx + 1.0, 0.8), (1, 0, 0)),
                            ((cx + 1.0, 0.8), (cx - 1.0, 0.8), (0, 1, 0)), ((cx - 1.0, 0.8), (cx - 1.0, -0.8), (-1, 0, 0))):
            m.poly([(a[0], a[1], RIDGE - 1.2), (b[0], b[1], RIDGE - 1.2), (b[0], b[1], top), (a[0], a[1], top)],
                   [(0.1, 0.1), (0.9, 0.1), (0.9, 0.7), (0.1, 0.7)], T_WALL, wnt)
        m.box(cx - 1.25, cx + 1.25, -1.0, 1.0, top, top + 0.5, 'balcony_front', 'white', 'white_mid', skip=('-Z',))

    # ---- dormers: gabled, one per house, front wall 3 u behind the facade -----------------------------
    yf, dw, zt, ap, sd = -7.0, 3.0, 18.0, 18.9, 0.55
    hw = dw / 2
    g = (ap - zt) / hw
    zA = zm(yf) - 0.02
    y_int = lambda ax: (ap + sd * yf - g * ax - RIDGE) / (SLOPE + sd)   # where the roof plane meets the main roof
    z_pl = lambda ax, y: ap - sd * (y - yf) - g * ax
    xe = hw + 0.25
    ru0, ru1, rv0, rv1 = 0.30, 0.33, 0.25, 0.45                       # a flat slate patch for dormer roofs
    for hs in houses:
        cx = hx(hs['x'] + 16)
        pts = [(cx - hw, yf, zA), (cx + hw, yf, zA), (cx + hw, yf, zt), (cx, yf, ap), (cx - hw, yf, zt)]
        uvs = [m.ruv('dormer', (p[0] - cx + hw) / dw, (ap - p[2]) / (ap - zA)) for p in pts]
        m.poly(pts, uvs, T_TRIM, (0, -1, 0))
        yc = y_int(hw)
        for sgn in (-1, 1):
            m.tri([(cx + sgn * hw, yf, zA), (cx + sgn * hw, yc, zm(yc)), (cx + sgn * hw, yf, zt)] if sgn > 0 else
                  [(cx - hw, yf, zA), (cx - hw, yc, zm(yc)), (cx - hw, yf, zt)], 'white_mid', (sgn, 0, 0))
            ye = y_int(xe)
            yr = y_int(0.0)
            plane = [(cx + sgn * xe, yf - 0.3, z_pl(xe, yf - 0.3)), (cx + sgn * xe, ye, zm(ye)),
                     (cx, yr, zm(yr)), (cx, yf - 0.3, z_pl(0, yf - 0.3))]
            uvs = [(ru0, rv0), (ru1, rv0), (ru1, rv1), (ru0, rv1)]
            m.poly(plane, uvs, T_ROOF, (sgn * g, -sd, 1))

    # ---- balconies (all houses), window boxes, door canopies + steps, shop awnings ---------------------
    for hs in houses:
        x0 = hs['x']
        bcx = hx(x0 + 16)
        zs0, zs1 = 5.30, 5.70
        m.box(bcx - 4.05, bcx + 4.05, Y0 - 0.8, Y0, zs0, zs1, 'balcony_front', 'white', 'white_mid')
        yr = Y0 - 0.74
        m.quad([(bcx - 4.0, yr, zs1), (bcx + 4.0, yr, zs1), (bcx + 4.0, yr, zs1 + 1.5), (bcx - 4.0, yr, zs1 + 1.5)],
               'railing', (0, -1, 0))
        for sgn in (-1, 1):
            xs = bcx + sgn * 4.0
            m.quad([(xs, yr, zs1), (xs, Y0, zs1), (xs, Y0, zs1 + 1.5), (xs, yr, zs1 + 1.5)] if sgn > 0 else
                   [(xs, Y0, zs1), (xs, yr, zs1), (xs, yr, zs1 + 1.5), (xs, Y0, zs1 + 1.5)], 'railing_side', (sgn, 0, 0))
        m.box(bcx - 3.5, bcx + 3.5, Y0 - 0.64, Y0 - 0.34, zs1, zs1 + 0.55, ('planter', 0.5, 1.0), ('planter', 0.0, 0.5),
              ('planter', 0.5, 1.0), skip=('+Y', '-Z'))
        for wpx in (8, 24):                                # storey-3 window boxes
            wcx = hx(x0 + wpx)
            m.box(wcx - 1.35, wcx + 1.35, Y0 - 0.45, Y0, 10.55, 11.15, ('planter', 0.5, 1.0), ('planter', 0.0, 0.5),
                  ('planter', 0.5, 1.0), skip=('+Y', '-Z'))
        if hs['shop']:
            xl, xr = hx(x0 + 1.4), hx(x0 + 30.6)
            ya, za, zb, zv = Y0 - 0.8, 3.30, 3.84, 2.90
            m.quad([(xl, ya, za), (xr, ya, za), (xr, Y0, zb), (xl, Y0, zb)], 'awning', (0, -0.55, 0.83), (0.0, 0.69))
            m.quad([(xl, ya, zv), (xr, ya, zv), (xr, ya, za), (xl, ya, za)], 'awning', (0, -1, 0), (0.7, 1.0))
            for x, d in ((xl, -1), (xr, 1)):
                m.tri([(x, Y0, zb), (x, ya, za), (x, Y0, za)], 'awning', (d, 0, 0))
        else:
            px = x0 + (DPX['left_x'] if hs['door'] == 'left' else DPX['right_x'])
            dcx = hx(px + DPX['w'] / 2)
            m.box(dcx - 2.2, dcx + 2.2, Y0 - 0.8, Y0, 4.30, 4.72, 'balcony_front', 'white', 'white_mid')
            m.box(dcx - 1.9, dcx + 1.9, Y0 - 0.8, Y0, 0.0, 0.28, 'white_mid', 'marble', 'white_mid', skip=('+Y', '-Z'))
            m.box(dcx - 1.6, dcx + 1.6, Y0 - 0.45, Y0, 0.28, 0.52, 'white_mid', 'marble', 'white_mid', skip=('+Y', '-Z'))
    return m


def finish(m):
    bmesh.ops.translate(m.bm, verts=m.bm.verts, vec=SHIFT)
    uvmax = max((max(abs(l[m.uv].uv[0] - 0.5), abs(l[m.uv].uv[1] - 0.5)) for f in m.bm.faces for l in f.loops))
    print('UV extent (max |uv-0.5|, must be <= 0.5):', round(uvmax, 4))
    mats = [dt.material(t, os.path.join(TEXDIR, t + '.png')) for t in m.mats]
    ob = dt.mesh_object(NAME, m.bm, mats)
    path = dt.export_glb([ob], os.path.join(OUTDIR, NAME + '.glb'))
    print('BLD_TERRACE_RICH tris', dt.tri_count([ob]), 'materials', m.mats, 'outward-normal smoke', round(dt.outward_normal_report(ob), 3))
    return path


# ---------------------------------------------------------------------------------------------------------
# verification and previews

def import_glb(path, unit_fix=False):
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
            for mt in o.data.materials:
                if mt and mt.use_nodes:
                    for n in mt.node_tree.nodes:
                        if n.type == 'TEX_IMAGE':
                            n.interpolation = 'Closest'
    return objs


def verify():
    out = {}
    for nm in ('env_bld_terrace_normal', NAME):
        dt.reset()
        objs = import_glb(os.path.join(OUTDIR, nm + '.glb'))
        mn, mx = dt.bounds(objs)
        out[nm] = (mn * 1000.0, mx * 1000.0, dt.tri_count(objs),
                   sorted({mt.name for o in objs if o.type == 'MESH' for mt in o.data.materials}))
        print('VERIFY', nm, 'tris', out[nm][2], 'min', tuple(round(v, 3) for v in out[nm][0]),
              'max', tuple(round(v, 3) for v in out[nm][1]), 'mats', out[nm][3])
    rn, nn = out[NAME], out['env_bld_terrace_normal']
    gz = abs(rn[0].z - nn[0].z)
    prot = (-9.7) - rn[0].y
    print('VERIFY ground z rich', round(rn[0].z, 4), 'normal', round(nn[0].z, 4), 'diff', round(gz, 4),
          'OK' if gz <= 0.05 else 'PROBLEM')
    print('VERIFY max front protrusion past facade plane (y -9.7):', round(prot, 3), 'OK' if prot <= 0.8 + 1e-3 else 'PROBLEM')
    print('VERIFY tris', rn[2], 'OK' if rn[2] <= LAYOUT['model']['tris_max'] else 'PROBLEM')
    print('VERIFY height rich', round(rn[1].z - rn[0].z, 3), 'normal', round(nn[1].z - nn[0].z, 3))


def look_at(cam, target):
    cam.rotation_euler = (V(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()


def setup_render(res, flat=True):
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
    sh.show_backface_culling = True
    sh.show_shadows = False
    sc.render.resolution_x, sc.render.resolution_y = res
    w = bpy.data.worlds.new('w') if not sc.world else sc.world
    sc.world = w
    w.color = (0.62, 0.70, 0.78)
    sc.render.image_settings.file_format = 'PNG'


def ground_plane(z, size=900):
    me = bpy.data.meshes.new('ground')
    s = size / 2
    me.from_pydata([(-s, -s, z), (s, -s, z), (s, s, z), (-s, s, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new('ground', me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('ground_mat')
    mat.diffuse_color = (0.33, 0.33, 0.34, 1)
    me.materials.append(mat)


def render(path, cam_loc, target, lens=50.0):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('cam')
    cd.lens = lens
    cd.clip_end = 3000
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.location = V(cam_loc)
    look_at(cam, target)
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def previews(outdir):
    os.makedirs(outdir, exist_ok=True)
    elev = V((0.0, -math.cos(math.radians(25)), math.sin(math.radians(25))))   # Street camera direction
    for flat, tag in ((True, 'flat'),):
        dt.reset()
        setup_render((2200, 760), flat)
        ground_plane(-10.5)
        for nm, ox in (('env_bld_terrace_normal', -52.0), (NAME, 52.0)):
            for o in import_glb(os.path.join(OUTDIR, nm + '.glb'), unit_fix=True):
                if o.parent is None:
                    o.location = V((ox, 0, 0))
        render(os.path.join(outdir, 'side_by_side_street.png'), V((0, 0, 3)) + elev * 330, (0, 0, 3), lens=50)
        setup_render((1800, 900), True)
        for nm, ox, tag2 in (('env_bld_terrace_normal', -52.0, 'normal'), (NAME, 52.0, 'rich')):
            for cxo, part in ((-25.0, 'left'), (25.0, 'right')):
                render(os.path.join(outdir, f'{tag2}_{part}_street.png'),
                       V((ox + cxo, 0, 3)) + elev * 62, (ox + cxo, 0, 3), lens=50)
        # close details of the rich model: two houses, door + balcony
        render(os.path.join(outdir, 'rich_detail.png'), V((52 - 36, -10, 0)) + elev * 26, (52 - 36, -10, 5), lens=50)
        setup_render((1800, 900), False)
        render(os.path.join(outdir, 'rich_3q_studio.png'), V((52, 0, 0)) + V((0.75, -1.0, 0.55)).normalized() * 125, (52, 0, 2), lens=50)
        render(os.path.join(outdir, 'rich_3q_studio_l.png'), V((52, 0, 0)) + V((-0.75, -1.0, 0.55)).normalized() * 125, (52, 0, 2), lens=50)
        render(os.path.join(outdir, 'normal_3q_studio.png'), V((-52, 0, 0)) + V((0.75, -1.0, 0.55)).normalized() * 125, (-52, 0, 2), lens=50)
        render(os.path.join(outdir, 'rich_back_studio.png'), V((52, 0, 0)) + V((0.5, 1.0, 0.5)).normalized() * 125, (52, 0, 2), lens=50)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    dt.reset()
    finish(build())
    verify()
    if '--preview' in argv:
        previews(os.path.abspath(argv[argv.index('--preview') + 1]))


main()
