"""plaza_features: the plaza's centrepiece props per infrastructure tier, plus the poor-tier scorch decal.

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/plaza_features.py -- [model ...] [--preview build/visual_gaps/plaza_features/model]

Models (public/models/map/<name>.glb), all origin at the footprint centre, ground z = 0, -Y toward the camera:
  env_trashcan_burning  poor: dented rusty drum, trash, crossed flame cut-out cards, soot plume card
  env_fountain_normal   normal: round precast concrete basin, one column with a weak jet
  env_fountain_rich     rich: tiered pink/white marble and gold fountain, gilded fish, gilded leader on top
  env_burned_decal      poor: one 14 x 14 quad 0.05 above the ground, soot cut-out

Run the texture script first (python tools/texgen/plaza_features.py): the GLBs embed those PNGs. Every rect and
size comes from tools/texgen/plaza_features_layout.json. The game clamps textures (no repeat), so every UV stays
in 0..1 and a strip repeats around a ring face by face. RGBA materials get an alpha Round node so the exporter
writes alphaMode MASK (the game re-creates them as alphaTest 0.5, double-sided, from the IDE's transparent flag).
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
CONTRACT = os.path.join(ROOT, 'tools', 'texgen', 'plaza_features_layout.json')
MODELS = os.path.join(ROOT, 'public', 'models', 'map')
TAU = 2 * math.pi
INSET = 0.3  # px kept inside a region's edge (NearestFilter, clamp)

with open(CONTRACT, encoding='utf-8') as _fh:
    LAYOUT = json.load(_fh)


# ---------------------------------------------------------------------------------------------------------
# Regions and materials

class Region:
    """A contract rect as UV bounds. fu/fv in 0..1 across the rect (fv 0 = the rect's top row)."""

    def __init__(self, tex, name=None):
        spec = LAYOUT['textures'][tex]
        self.W, self.H = spec['size']
        x, y, w, h = spec['regions'][name]['rect'] if name else (0, 0, self.W, self.H)
        self.tiles_u = bool(name) and spec['regions'][name].get('tiles') == 'u'
        ix = 0.0 if (self.tiles_u and w == self.W) else INSET
        self.u0, self.u1 = (x + ix) / self.W, (x + w - ix) / self.W
        self.v0, self.v1 = 1.0 - (y + INSET) / self.H, 1.0 - (y + h - INSET) / self.H
        self.tex = tex

    def uv(self, fu, fv):
        return (self.u0 + (self.u1 - self.u0) * fu, self.v0 + (self.v1 - self.v0) * fv)


def make_material(tex):
    spec = LAYOUT['textures'][tex]
    mat = dt.material(tex, os.path.join(ROOT, spec['file']))
    if spec.get('alpha'):
        nt = mat.node_tree
        img = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        rnd = nt.nodes.new('ShaderNodeMath')
        rnd.operation = 'ROUND'
        nt.links.new(img.outputs['Alpha'], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
        for attr, val in (('blend_method', 'CLIP'), ('surface_render_method', 'DITHERED'), ('alpha_threshold', 0.5)):
            try:
                setattr(mat, attr, val)
            except (AttributeError, TypeError):
                pass
        mat.use_backface_culling = False
    else:
        mat.use_backface_culling = True
    return mat


class Builder:
    """One bmesh per model; faces carry a material index and per-loop UVs."""

    def __init__(self, name, textures):
        self.name = name
        self.bm = bmesh.new()
        self.uvl = self.bm.loops.layers.uv.new('UVMap')
        self.textures = list(textures)
        self.mats = [make_material(t) for t in self.textures]

    def mi(self, tex):
        return self.textures.index(tex)

    def face(self, pts, uvs, tex, want=None):
        """Adds a polygon; flips it if its normal disagrees with `want` (a direction vector)."""
        vs = [self.bm.verts.new(Vector(p)) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(tex)
        f.normal_update()
        if want is not None and f.normal.dot(Vector(want)) < 0:
            f.normal_flip()
        lut = {v: uv for v, uv in zip(vs, uvs)}
        for loop in f.loops:
            loop[self.uvl].uv = lut[loop.vert]
        return f

    def finish(self):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        ob = dt.mesh_object(self.name, self.bm, self.mats)
        return ob


def ring_pt(r, a, z, c=(0.0, 0.0)):
    return (c[0] + r * math.cos(a), c[1] + r * math.sin(a), z)


def lathe(b, rings, n, reg, reps=1, phase=0.0, centre=(0.0, 0.0), u_flip=False):
    """Surface of revolution between consecutive rings. rings: [(radius or [n radii], z, fv), ...]. The visible
    side of each band A -> B is its (-dz, dr) side in the (r, z) plane: walk walls top to bottom, flat tops inner
    to outer, undersides outer to inner. U runs once over each repeat of n / reps segments."""
    per = n / reps
    for k in range(len(rings) - 1):
        (ra, za, fa), (rb, zb, fb) = rings[k], rings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            a0, a1 = phase + TAU * i / n, phase + TAU * (i + 1) / n
            rai = ra[i] if isinstance(ra, (list, tuple)) else ra
            raj = ra[j] if isinstance(ra, (list, tuple)) else ra
            rbi = rb[i] if isinstance(rb, (list, tuple)) else rb
            rbj = rb[j] if isinstance(rb, (list, tuple)) else rb
            pts = [ring_pt(rai, a0, za, centre), ring_pt(raj, a1, za, centre),
                   ring_pt(rbj, a1, zb, centre), ring_pt(rbi, a0, zb, centre)]
            s0 = (i % per) / per
            s1 = s0 + 1.0 / per
            if u_flip:
                s0, s1 = 1 - s0, 1 - s1
            uvs = [reg.uv(s0, fa), reg.uv(s1, fa), reg.uv(s1, fb), reg.uv(s0, fb)]
            am = (a0 + a1) / 2
            dr = (rbi + rbj - rai - raj) / 2
            dz = zb - za
            want = (math.cos(am) * -dz, math.sin(am) * -dz, dr)
            if abs(dr) < 1e-9 and abs(dz) < 1e-9:
                continue
            b.face(pts, uvs, reg.tex, want)


def disc(b, r, z, n, reg, phase=0.0, centre=(0.0, 0.0), down=False, r_map=None):
    """Flat n-gon, planar-mapped into a square region (rect centre = disc centre, radius r_map -> half the rect)."""
    r_map = r_map or r
    pts, uvs = [], []
    for i in range(n):
        a = phase + TAU * i / n
        x, y = r * math.cos(a), r * math.sin(a)
        pts.append((centre[0] + x, centre[1] + y, z))
        uvs.append(reg.uv(0.5 + 0.5 * x / r_map, 0.5 - 0.5 * y / r_map))
    b.face(pts, uvs, reg.tex, (0, 0, -1 if down else 1))


def card(b, centre, width, height, yaw, reg, flip_u=False, tilt=0.0):
    """Vertical quad, base centre at `centre`, facing -Y rotated by yaw (radians, about Z)."""
    cx, cy, cz = centre
    ax, ay = math.cos(yaw), math.sin(yaw)
    hw = width / 2
    top = Vector((0, 0, height))
    if tilt:
        top = Matrix.Rotation(tilt, 3, Vector((ax, ay, 0))) @ top
    p0 = Vector((cx - ax * hw, cy - ay * hw, cz))
    p1 = Vector((cx + ax * hw, cy + ay * hw, cz))
    pts = [p0, p1, p1 + top, p0 + top]
    u0, u1 = (1.0, 0.0) if flip_u else (0.0, 1.0)
    uvs = [reg.uv(u0, 1), reg.uv(u1, 1), reg.uv(u1, 0), reg.uv(u0, 0)]
    b.face([tuple(p) for p in pts], uvs, reg.tex, (ay, -ax, 0))


def ground_card(b, centre, length, width, yaw, reg, z=0.04):
    cx, cy = centre
    ax, ay = math.cos(yaw), math.sin(yaw)
    bx, by = -ay, ax
    hl, hw = length / 2, width / 2
    pts = [(cx - ax * hl - bx * hw, cy - ay * hl - by * hw, z), (cx + ax * hl - bx * hw, cy + ay * hl - by * hw, z),
           (cx + ax * hl + bx * hw, cy + ay * hl + by * hw, z), (cx - ax * hl + bx * hw, cy - ay * hl + by * hw, z)]
    uvs = [reg.uv(0, 1), reg.uv(1, 1), reg.uv(1, 0), reg.uv(0, 0)]
    b.face(pts, uvs, reg.tex, (0, 0, 1))


def loft(b, sections, n, reg, mapping, cap_top=False, phase=math.pi / 2):
    """Generic tube through sections [(centre Vector, rx, ry), ...] (axis = section to section, ring in the
    plane perpendicular to the world-up-ish frame). mapping(point) -> (fu, fv) gives the UVs (box/planar
    mapping for gilt parts). Faces oriented away from the local axis."""
    rings = []
    for k, (c, rx, ry) in enumerate(sections):
        c = Vector(c)
        nxt = Vector(sections[min(k + 1, len(sections) - 1)][0])
        prv = Vector(sections[max(k - 1, 0)][0])
        axis = (nxt - prv).normalized()
        ref = Vector((0, 1, 0)) if abs(axis.y) < 0.9 else Vector((1, 0, 0))
        e1 = ref.cross(axis).normalized()  # roughly X for a vertical axis
        e2 = axis.cross(e1).normalized()   # roughly Y
        ring = [c + e1 * (rx * math.cos(phase + TAU * i / n)) + e2 * (ry * math.sin(phase + TAU * i / n))
                for i in range(n)]
        rings.append((c, ring))
    for k in range(len(rings) - 1):
        (ca, ra), (cb, rb) = rings[k], rings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            pts = [ra[i], ra[j], rb[j], rb[i]]
            mid = sum(pts, Vector()) / 4
            want = mid - (ca + cb) / 2
            b.face([tuple(p) for p in pts], [reg.uv(*mapping(p)) for p in pts], reg.tex, want)
    if cap_top:
        c, ring = rings[-1]
        axis = (c - rings[-2][0]).normalized()
        b.face([tuple(p) for p in ring], [reg.uv(*mapping(p)) for p in ring], reg.tex, axis)


def box_map(lo, hi):
    """Planar map over the XZ extent of a part (front view), for gilt where only the noise matters."""
    def f(p):
        u = (p.x - lo[0]) / (hi[0] - lo[0])
        v = 1.0 - (p.z - lo[2]) / (hi[2] - lo[2])
        return (min(1.0, max(0.0, u)), min(1.0, max(0.0, v)))  # never sample a neighbouring region
    return f


def rnd(seed):
    import random
    return random.Random(seed)


# ---------------------------------------------------------------------------------------------------------
# env_trashcan_burning

def build_trashcan():
    T, TF = 'env_trashcan_burning', 'env_trashcan_burning_fire'
    b = Builder('env_trashcan_burning', [T, TF])
    R = rnd(41)
    n, r, top, mid, coal_z = 8, 1.55, 4.4, 2.2, 3.3
    ph = math.pi / 8
    r_top = [r + R.uniform(-0.06, 0.04) for _ in range(n)]
    r_mid = [r + R.uniform(-0.08, 0.05) for _ in range(n)]
    r_bot = [r + R.uniform(-0.03, 0.03) for _ in range(n)]
    r_mid[6] -= 0.32  # the big dent, on the camera side (segment facing -Y)
    r_top[2] -= 0.12
    side = Region(T, 'drum_side')
    lathe(b, [(r_top, top, 0.0), (r_mid, mid, 0.5), (r_bot, 0.0, 1.0)], n, side, phase=ph)
    r_in = [x - 0.13 for x in r_top]
    lathe(b, [(r_in, top, 1.0), (r_top, top, 0.0)], n, Region(T, 'lip'), phase=ph)
    # the inner wall and the coals stay inside the dented outer wall (at coal_z it is halfway top -> mid)
    tc = (coal_z - mid) / (top - mid)
    r_coal = [min(ri - 0.02, rt * tc + rm * (1 - tc) - 0.12) for ri, rt, rm in zip(r_in, r_top, r_mid)]
    lathe(b, [(r_coal, coal_z, 1.0), (r_in, top, 0.0)], n, Region(T, 'inner_wall'), phase=ph)
    coals = Region(T, 'coals')
    pts = [ring_pt(rc, ph + TAU * i / n, coal_z) for i, rc in enumerate(r_coal)]
    b.face(pts, [coals.uv(0.5 + 0.5 * p[0] / r, 0.5 - 0.5 * p[1] / r) for p in pts], T, (0, 0, 1))
    # two lumps at the drum's foot: a black bag (camera side, +X) and a cardboard heap (-X)
    trash = Region(T, 'trash')
    for (cx, cy, rad, ht, fu0, fu1, seed) in ((1.9, -1.35, 0.95, 1.25, 0.0, 0.5, 5), (-2.0, -0.7, 1.0, 0.9, 0.5, 1.0, 9)):
        rr = rnd(seed)
        m = 5
        base = [(cx + rad * rr.uniform(0.85, 1.15) * math.cos(TAU * i / m), cy + rad * rr.uniform(0.85, 1.15) * math.sin(TAU * i / m), 0.0) for i in range(m)]
        midr = [(cx + (p[0] - cx) * 0.8, cy + (p[1] - cy) * 0.8, ht * rr.uniform(0.5, 0.65)) for p in base]
        apex = (cx + rr.uniform(-0.15, 0.15), cy + rr.uniform(-0.15, 0.15), ht)
        for i in range(m):
            j = (i + 1) % m
            a = TAU * (i + 0.5) / m
            fa, fb = fu0 + (fu1 - fu0) * i / m, fu0 + (fu1 - fu0) * (i + 1) / m
            b.face([base[i], base[j], midr[j], midr[i]],
                   [trash.uv(fa, 1), trash.uv(fb, 1), trash.uv(fb, 0.4), trash.uv(fa, 0.4)], T,
                   (math.cos(a), math.sin(a), 0.3))
            b.face([midr[i], midr[j], apex], [trash.uv(fa, 0.4), trash.uv(fb, 0.4), trash.uv((fa + fb) / 2, 0.0)], T,
                   (math.cos(a), math.sin(a), 1.0))
    # litter and ash on the ground, camera side
    ground_card(b, (0.6, -2.3), 6.0, 2.0, math.radians(-8), Region(TF, 'litter'))
    # flames: two crossed cards at +-40 deg to the camera plus a smaller one facing it, base inside the drum
    fa_, fb_ = Region(TF, 'flame_a'), Region(TF, 'flame_b')
    card(b, (0.0, 0.05, coal_z - 0.2), 2.7, 5.4, math.radians(40), fa_)
    card(b, (0.0, 0.05, coal_z - 0.2), 2.7, 5.4, math.radians(-40), fb_)
    card(b, (0.05, -0.25, coal_z - 0.2), 2.3, 4.6, 0.0, fa_, flip_u=True)
    # soot plume, facing the camera, leaning a little with the wind
    card(b, (0.25, 0.35, 6.2), 1.9, 7.2, 0.0, Region(TF, 'smoke'), tilt=math.radians(-6))
    return b.finish()


# ---------------------------------------------------------------------------------------------------------
# env_burned_decal

def build_burned_decal():
    D = 'env_burned_decal'
    b = Builder(D, [D])
    reg = Region(D)
    ground_card(b, (0.0, 0.0), 14.0, 14.0, 0.0, reg, z=0.05)
    return b.finish()


# ---------------------------------------------------------------------------------------------------------
# env_fountain_normal

def fan(b, r, z, n, reg, fv_rim, fv_centre, phase=0.0, centre=(0.0, 0.0), zc=None):
    """Disc (or low cone, centre at zc) as a triangle fan mapped like a strip: U around, V rim -> centre."""
    c = (centre[0], centre[1], z if zc is None else zc)
    for i in range(n):
        a0, a1 = phase + TAU * i / n, phase + TAU * (i + 1) / n
        b.face([ring_pt(r, a0, z, centre), ring_pt(r, a1, z, centre), c],
               [reg.uv(i / n, fv_rim), reg.uv((i + 1) / n, fv_rim), reg.uv((i + 0.5) / n, fv_centre)], reg.tex,
               (0, 0, 1))


def build_fountain_normal():
    N = 'env_fountain_normal'
    W_ = 'plaza_features_water'
    b = Builder(N, [N, W_])
    n, ph = 16, math.pi / 16
    ro, ri, zr, zw = 5.0, 4.5, 1.2, 0.8
    lathe(b, [(ro, zr, 0.0), (ro, 0.0, 1.0)], n, Region(N, 'wall_out'), reps=4, phase=ph)
    lathe(b, [(ri, zr, 1.0), (ro, zr, 0.0)], n, Region(N, 'rim_top'), reps=4, phase=ph)
    lathe(b, [(ri, zw, 1.0), (ri, zr, 0.0)], n, Region(N, 'wall_in'), reps=4, phase=ph)
    disc(b, ri, zw, n, Region(N, 'water'), phase=ph)
    rc, zc = 0.5, 3.0
    lathe(b, [(rc, zc, 0.0), (rc, zw, 1.0)], 8, Region(N, 'column'), phase=math.pi / 8)
    cap = Region(N, 'cap')
    lathe(b, [(0.78, zc + 0.28, 0.0), (rc, zc, 0.45)], 8, cap, phase=math.pi / 8)
    fan(b, 0.78, zc + 0.28, 8, cap, 0.5, 1.0, phase=math.pi / 8)
    # the weak jet: a small spray crown on the cap and thin streams spilling from its rim into the basin
    spray = Region(W_, 'spray')
    card(b, (0.0, 0.0, zc + 0.25), 2.2, 1.3, math.radians(45), spray)
    card(b, (0.0, 0.0, zc + 0.25), 2.2, 1.3, math.radians(-45), spray, flip_u=True)
    lathe(b, [(0.82, zc + 0.26, 0.0), (1.0, zw, 1.0)], 8, Region(W_, 'sheet'), reps=4, phase=math.pi / 8)
    return b.finish()


# ---------------------------------------------------------------------------------------------------------
# env_fountain_rich

def build_leader(b, z0, gold, face):
    """Gilded generic leader: greatcoat, boots, peaked cap, right arm raised (his right = -X, he faces -Y)."""
    m = box_map((-1.3, 0, z0), (1.3, 0, z0 + 5.3))
    for sx in (-1, 1):  # boots and trousers
        loft(b, [((0.27 * sx, 0.0, z0), 0.22, 0.26), ((0.25 * sx, 0.0, z0 + 1.3), 0.2, 0.22)], 4, gold, m)
    loft(b, [((0, 0.03, z0 + 0.95), 0.8, 0.62), ((0, 0, z0 + 2.0), 0.58, 0.42), ((0, 0, z0 + 2.95), 0.82, 0.47),
             ((0, 0, z0 + 3.24), 0.48, 0.34)], 6, gold, m, cap_top=True)
    hz0, hz1, hr = z0 + 3.17, z0 + 3.86, 0.3
    for i in range(6):
        a0 = math.radians(120 + 60 * i)
        a1 = a0 + math.radians(60)
        am = (a0 + a1) / 2
        pts = [(hr * math.cos(a0), hr * 1.05 * math.sin(a0), hz0), (hr * math.cos(a1), hr * 1.05 * math.sin(a1), hz0),
               (hr * math.cos(a1), hr * 1.05 * math.sin(a1), hz1), (hr * math.cos(a0), hr * 1.05 * math.sin(a0), hz1)]
        if math.sin(am) < 0:  # front half: the face region from his right cheek (-X) to his left
            f0, f1 = (math.degrees(a0) - 180) / 180, (math.degrees(a1) - 180) / 180
            uvs = [face.uv(f0, 1), face.uv(f1, 1), face.uv(f1, 0), face.uv(f0, 0)]
            b.face(pts, uvs, face.tex, (math.cos(am), math.sin(am), 0))
        else:
            b.face(pts, [gold.uv(*m(Vector(p))) for p in pts], gold.tex, (math.cos(am), math.sin(am), 0))
    loft(b, [((0, 0.0, z0 + 3.76), 0.33, 0.34), ((0, 0.02, z0 + 4.12), 0.47, 0.45)], 6, gold, m, cap_top=True)
    vz = z0 + 3.86
    b.face([(-0.3, -0.24, vz), (0.3, -0.24, vz), (0.24, -0.62, vz - 0.08), (-0.24, -0.62, vz - 0.08)],
           [face.uv(0.1, 0.0), face.uv(0.9, 0.0), face.uv(0.9, 0.15), face.uv(0.1, 0.15)], face.tex, (0, -0.2, 1))
    loft(b, [((-0.66, 0.0, z0 + 2.88), 0.19, 0.19), ((-1.5, -0.62, z0 + 4.45), 0.14, 0.14)], 4, gold, m,
         cap_top=True)  # pointing the way: out, forward and up
    loft(b, [((0.68, 0.0, z0 + 2.85), 0.18, 0.18), ((1.0, -0.08, z0 + 2.08), 0.16, 0.16),
             ((0.6, -0.32, z0 + 1.78), 0.14, 0.14)], 4, gold, m, cap_top=True)


def build_fish(b, theta, fish, arc):
    """A gilded fish standing on its tail on the rim, mouth up and inward, spouting an arc into the basin."""
    rad = Vector((math.cos(theta), math.sin(theta), 0.0))
    up = Vector((0, 0, 1))
    tail = rad * 9.7 + up * 2.0
    mid = rad * 9.42 + up * 2.95
    head = rad * 8.9 + up * 3.75
    axis = tail - head
    dors = axis.cross(rad.cross(up)).normalized()
    if dors.dot(rad) < 0:
        dors = -dors

    def m(p):
        t = (p - head).dot(axis) / axis.length_squared
        s = (p - head).dot(dors)
        return (min(1.0, max(0.0, t)), min(1.0, max(0.0, 0.5 - s / 0.9)))
    loft(b, [(tail, 0.12, 0.1), (mid, 0.44, 0.34), (head, 0.2, 0.19)], 4, fish, m, cap_top=True)
    tan = rad.cross(up).normalized()
    base = rad * 9.75
    fin = [base + tan * 0.15, base + rad * 0.3 + tan * 0.6, base + rad * 0.45, base + rad * 0.3 - tan * 0.6]
    fin = [(p.x, p.y, 2.03) for p in fin]
    b.face(fin, [fish.uv(1, 0.5), fish.uv(0.9, 0.0), fish.uv(1.0, 0.5), fish.uv(0.9, 1.0)], fish.tex, (0, 0, 1))
    top = head.z + 0.62
    p0 = head - rad * 0.12
    p1 = p0 - rad * 2.4
    pts = [(p0.x, p0.y, top - 3.0), (p1.x, p1.y, top - 3.0), (p1.x, p1.y, top), (p0.x, p0.y, top)]
    b.face(pts, [arc.uv(0, 1), arc.uv(1, 1), arc.uv(1, 0), arc.uv(0, 0)], arc.tex, -tan)


def build_fountain_rich():
    R_, W_ = 'env_fountain_rich', 'plaza_features_water'
    b = Builder(R_, [R_, W_])
    n, ph = 16, math.pi / 16
    lathe(b, [(10.6, 0.4, 0.0), (10.6, 0.0, 1.0)], n, Region(R_, 'step'), reps=4, phase=ph)
    lathe(b, [(10.0, 0.4, 1.0), (10.6, 0.4, 0.0)], n, Region(R_, 'step_top'), reps=4, phase=ph)
    lathe(b, [(10.0, 2.0, 0.0), (10.0, 0.4, 1.0)], n, Region(R_, 'wall'), reps=4, phase=ph)
    lathe(b, [(9.2, 2.0, 1.0), (10.0, 2.0, 0.0)], n, Region(R_, 'rim_top'), reps=4, phase=ph)
    lathe(b, [(9.2, 1.5, 1.0), (9.2, 2.0, 0.0)], n, Region(R_, 'inner_wall'), reps=4, phase=ph)
    disc(b, 9.2, 1.5, n, Region(R_, 'water'), phase=ph)
    stem, under, lip, rim = Region(R_, 'stem'), Region(R_, 'bowl_under'), Region(R_, 'lip'), Region(R_, 'rim_top')
    wtier, sheet = Region(R_, 'water_tier'), Region(W_, 'sheet')
    p8 = math.pi / 8
    lathe(b, [(1.2, 6.35, 0.0), (0.9, 5.3, 1.0)], 8, stem, phase=p8)  # stem 1, a baluster
    lathe(b, [(0.9, 5.3, 0.0), (1.9, 3.3, 1.0)], 8, stem, phase=p8)
    lathe(b, [(1.9, 3.3, 0.0), (1.4, 1.5, 1.0)], 8, stem, phase=p8)
    p12 = math.pi / 12  # tier 1
    lathe(b, [(5.5, 7.0, 0.0), (1.2, 6.35, 1.0)], 12, under, reps=4, phase=p12)
    lathe(b, [(5.5, 7.6, 0.0), (5.5, 7.0, 1.0)], 12, lip, reps=4, phase=p12)
    lathe(b, [(5.05, 7.45, 1.0), (5.5, 7.6, 0.0)], 12, rim, reps=4, phase=p12)
    disc(b, 5.05, 7.45, 12, wtier, phase=p12)
    lathe(b, [(5.62, 7.3, 0.0), (5.9, 1.5, 1.0)], 12, sheet, reps=4, phase=p12)
    lathe(b, [(0.7, 10.5, 0.0), (1.05, 9.0, 1.0)], 8, stem, phase=p8)  # stem 2
    lathe(b, [(1.05, 9.0, 0.0), (0.75, 7.45, 1.0)], 8, stem, phase=p8)
    lathe(b, [(3.0, 11.0, 0.0), (0.7, 10.5, 1.0)], 8, under, reps=2, phase=p8)  # tier 2
    lathe(b, [(3.0, 11.5, 0.0), (3.0, 11.0, 1.0)], 8, lip, reps=2, phase=p8)
    lathe(b, [(2.7, 11.38, 1.0), (3.0, 11.5, 0.0)], 8, rim, reps=2, phase=p8)
    disc(b, 2.7, 11.38, 8, wtier, phase=p8)
    lathe(b, [(3.1, 11.25, 0.0), (3.45, 7.45, 1.0)], 8, sheet, reps=4, phase=p8)
    z_ped = 12.6
    lathe(b, [(0.85, z_ped, 0.0), (0.85, 11.38, 1.0)], 8, Region(R_, 'pedestal'), reps=8, phase=p8)
    gold = Region(R_, 'gold')
    disc(b, 0.85, z_ped, 8, gold, phase=p8)
    spray = Region(W_, 'spray')
    card(b, (0.0, 0.0, 11.36), 3.4, 1.7, math.radians(45), spray)
    card(b, (0.0, 0.0, 11.36), 3.4, 1.7, math.radians(-45), spray, flip_u=True)
    b.bm.verts.ensure_lookup_table()
    n0 = len(b.bm.verts)
    build_leader(b, z_ped, gold, Region(R_, 'face'))
    b.bm.verts.ensure_lookup_table()
    for v in b.bm.verts[n0:]:  # a size up so he reads from the Street camera (top stays about 18)
        v.co = Vector((0, 0, z_ped)) + (v.co - Vector((0, 0, z_ped))) * 1.12
    fish, arc = Region(R_, 'fish'), Region(W_, 'arc')
    for k in range(4):
        build_fish(b, math.radians(45 + 90 * k), fish, arc)
    return b.finish()


# ---------------------------------------------------------------------------------------------------------
# Main and checks

BUILDERS = {
    'env_trashcan_burning': (build_trashcan, 120),
    'env_fountain_normal': (build_fountain_normal, 200),
    'env_fountain_rich': (build_fountain_rich, 700),
    'env_burned_decal': (build_burned_decal, 2),
}


def check(ob, budget):
    me = ob.data
    tris = dt.tri_count([ob])
    mn, mx = dt.bounds([ob])
    uv = me.uv_layers[0].data
    us = [d.uv.x for d in uv]
    vs = [d.uv.y for d in uv]
    print(f'CHECK {ob.name}: {tris} tris (budget {budget}), bounds {tuple(round(x, 2) for x in mn)} .. '
          f'{tuple(round(x, 2) for x in mx)}, uv u {min(us):.3f}..{max(us):.3f} v {min(vs):.3f}..{max(vs):.3f}, '
          f'materials {[m.name for m in me.materials]}')
    assert tris <= budget, f'{ob.name} over budget'
    assert min(us) >= 0 and max(us) <= 1 and min(vs) >= 0 and max(vs) <= 1, 'UV out of 0..1 (the game clamps)'
    assert mn.z >= -1e-4, 'geometry below ground'


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    keep = None
    if '--preview' in argv:
        i = argv.index('--preview')
        keep = os.path.abspath(argv[i + 1])
        del argv[i:i + 2]
    for name in argv or list(BUILDERS):
        fn, budget = BUILDERS[name]
        dt.reset()
        ob = fn()
        check(ob, budget)
        if keep:
            os.makedirs(keep, exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(keep, name + '.blend'))
        dt.export_glb([ob], os.path.join(MODELS, name + '.glb'))


main()
