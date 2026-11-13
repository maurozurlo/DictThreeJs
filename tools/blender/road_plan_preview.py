"""Road-plan blockout preview: one candidate street layout (build/roadplan/<id>.json, produced by
tools/roadplan/build.ts) rebuilt in Blender and rendered through the game's Street camera plus a high
aerial overview.

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/road_plan_preview.py -- build/roadplan/avenida.json build/roadplan/renders ^
        [--layout build/visual_gaps/street_layout.json] [--res 1600x900] [--only street|aerial] [--buildings extra.json] [--tag name]

Writes <out_dir>/<id>_street.png and <out_dir>/<id>_aerial.png.

Conventions are those of tools/blender/street_preview.py (copied, not imported: that module renders on
import): game (x, y, z) -> Blender (x, -z, y); x1000 GLB unit fix; EEVEE lit by the game's single
ambient colour; Closest texture sampling; the Street camera at game (8.116, 60.961, 124.141), pitch
-0.4364 rad, 60 degree horizontal FOV. The plan's [x, z] ground coordinates map to Blender (x, -z).

Textures (public/textures/map, tiled with world-space UVs at the density env_roads.glb uses today):
  asphalt        road_centr.png        10.0 u / tile
  sidewalk band  sidewalk_str.png       6.5 u / tile   (kerb faces: sidewalk_crn.png)
  urban lot      concrete_buildings_base.png 10 u / tile
  esplanade      stone.png              6.5 u / tile
  park / median  park.png              65 u / tile     (the plaza grass density)
  ground         stone.png darkened     6.5 u / tile
"""
import json
import math
import os
import re
import subprocess
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Quaternion, Vector, geometry

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUB = os.path.join(ROOT, 'public')
GLB_UNIT_FIX = 1000.0

STREET_CAMERA = dict(pos=(8.116, 60.961, 124.141), pitch=-0.4364, yaw=0.0, hfov=60.0)
AERIAL_CAMERA = dict(pos=(8.0, 260.0, 230.0), target=(4.15, 0.0, -3.44), hfov=80.0)
SKY = (0.62, 0.66, 0.72)  # normal tier sky stand-in, as street_preview.py
AMBIENT = (0.886, 0.847, 0.745, 1)  # #e2d8be, the game's ambient colour

PLAZA_BOX = (-36.75, 45.05, -29.65, 22.77)  # x0, x1, z0, z1 of the plaza footprint
PLAZA_POS = (4.1503, -0.1285, -3.4297)  # env_plaza IPL position (GLB top face is local z = 0)
GROUND_Y = -0.05
MARK_Y = 0.02
BAND_EPS = 0.004
PLAZA_RAISE_EPS = 0.01

BUILDING_SLOTS = [
    ('env_bld_mixeduse_normal', 'env_bld_mixeduse_poor', 'env_bld_mixeduse_rich'),
    ('env_bld_apartment_normal', 'env_bld_apartment_poor', 'env_bld_apartment_rich'),
    ('env_bld_commercial_normal', 'env_bld_commercial_poor', 'env_bld_commercial_rich'),
    ('env_bld_civic_normal', 'env_bld_civic_poor', 'env_bld_civic_rich'),
    ('env_bld_residential_normal', 'env_bld_residential_poor', 'env_bld_residential_rich'),
]
INFRA, SECURITY = 5, 5  # normal tier, Controlled


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:]
    opts = {'res': '1600x900', 'layout': os.path.join(ROOT, 'build', 'visual_gaps', 'street_layout.json')}
    pos, i = [], 0
    while i < len(argv):
        if argv[i].startswith('--'):
            opts[argv[i][2:]] = argv[i + 1]
            i += 1
        else:
            pos.append(argv[i])
        i += 1
    return pos[0], pos[1], opts


# ---------------------------------------------------------------- helpers copied from street_preview.py

def norm_tex(name):
    base = name.split('/')[-1]
    n = re.sub(r'\.[^.]+$', '', base).lower()
    return re.sub(r'_(png|jpg|jpeg|bmp|tga|gif)$', '', n)


def game_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def game_quat_to_blender(q):
    x, y, z, w = q
    return Quaternion((w, x, -z, y))


def yaw_quat(rad):
    """Rotation about Blender +Z (== game +Y); takes +X to (cos, sin) in Blender XY."""
    return Quaternion((math.cos(rad / 2), 0, 0, math.sin(rad / 2)))


def clip(mat):
    for attr, val in (('blend_method', 'CLIP'), ('surface_render_method', 'DITHERED')):
        try:
            setattr(mat, attr, val)
        except (AttributeError, TypeError):
            pass
    try:
        mat.alpha_threshold = 0.5
    except AttributeError:
        pass
    mat.use_backface_culling = False


class Textures:
    def __init__(self, ide):
        self.slots = {}
        for o in ide:
            for t in o.get('textures', []) or []:
                key = norm_tex(t['texture'])
                prev = self.slots.get(key)
                self.slots[key] = (t['texture'], (prev[1] if prev else False) or t['transparent'])
        self.mats = {}

    def material(self, key):
        if key in self.mats:
            return self.mats[key]
        path, transparent = self.slots[key]
        img = bpy.data.images.load(os.path.join(PUB, path), check_existing=True)
        mat = bpy.data.materials.new('pv_' + key)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.interpolation = 'Closest'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if transparent:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            clip(mat)
        else:
            mat.use_backface_culling = True
        self.mats[key] = mat
        return mat


def import_placed(asset, loc, quat, scale, textures, drop_to=None):
    """Imports a GLB under a holder empty; returns the holder (None when the file is missing). When
    `drop_to` is a Blender Z, the holder is shifted so the model's lowest vertex sits at that Z."""
    path = asset if os.path.isabs(asset) else os.path.join(PUB, asset)
    if not os.path.exists(path):
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    holder = bpy.data.objects.new('place_' + os.path.basename(asset), None)
    bpy.context.scene.collection.objects.link(holder)
    holder.location = loc
    holder.rotation_mode = 'QUATERNION'
    holder.rotation_quaternion = quat
    holder.scale = (scale, scale, scale)
    for o in objs:
        if o.parent is None:
            o.parent = holder
    for o in objs:
        if o.type != 'MESH':
            continue
        for i, m in enumerate(o.data.materials):
            if m is None:
                continue
            key = norm_tex(m.name)
            if key in textures.slots:
                o.data.materials[i] = textures.material(key)
                continue
            cut = False
            if m.use_nodes:
                bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                cut = bool(bsdf and bsdf.inputs['Alpha'].is_linked)
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE':
                        n.interpolation = 'Closest'
            if cut:
                clip(m)
            else:
                m.use_backface_culling = True
    if drop_to is not None:
        bpy.context.view_layer.update()
        zs = [(o.matrix_world @ Vector(c)).z for o in objs if o.type == 'MESH' for c in o.bound_box]
        holder.location.z += drop_to - min(zs)
    return holder


def visible_normal(def_):
    v = def_.get('visibleIf') or {}
    if 'tab' in v and v['tab'] != 'Street':
        return False
    if 'infrastructure' in v and not (v['infrastructure'][0] <= INFRA <= v['infrastructure'][1]):
        return False
    if 'security' in v and not (v['security'][0] <= SECURITY <= v['security'][1]):
        return False
    return 'modifier' not in v


# ---------------------------------------------------------------- procedural geometry

class Mat:
    def __init__(self):
        self.cache = {}

    def tex(self, key, fname, tint=None):
        if key in self.cache:
            return self.cache[key]
        img = bpy.data.images.load(os.path.join(PUB, 'textures', 'map', fname), check_existing=True)
        mat = bpy.data.materials.new('rp_' + key)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        t.interpolation = 'Closest'
        src = t.outputs['Color']
        if tint is not None:
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs[0].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(src, mix.inputs[6])
            src = mix.outputs[2]
        nt.links.new(src, bsdf.inputs['Base Color'])
        mat.use_backface_culling = False
        self.cache[key] = mat
        return mat

    def flat(self, key, rgb):
        if key in self.cache:
            return self.cache[key]
        mat = bpy.data.materials.new('rp_' + key)
        mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        mat.use_backface_culling = False
        self.cache[key] = mat
        return mat


class Builder:
    """Accumulates flat-shaded faces (own vertices per face) with explicit UVs, one object per material."""

    def __init__(self, name, material):
        self.name, self.material = name, material
        self.verts, self.faces, self.uvs = [], [], []

    def face(self, pts, uvs):
        base = len(self.verts)
        self.verts.extend(pts)
        self.faces.append(tuple(range(base, base + len(pts))))
        self.uvs.extend(uvs)

    def up_tri(self, p0, p1, p2, size):
        """Triangle on a horizontal plane, wound so the normal points +Z; world-planar UVs."""
        if (p1 - p0).cross(p2 - p0).z < 0:
            p1, p2 = p2, p1
        self.face([p0, p1, p2], [(p.x / size[0], p.y / size[1]) for p in (p0, p1, p2)])

    def up_quad(self, pts, size):
        a, b, c, d = pts
        self.up_tri(a, b, c, size)
        self.up_tri(a, c, d, size)

    def build(self):
        if not self.faces:
            return None
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        uv = me.uv_layers.new(name='UVMap')
        for loop in me.loops:
            uv.data[loop.index].uv = self.uvs[loop.index]
        me.materials.append(self.material)
        me.update()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def b2(p, z=0.0):
    """Plan [x, z] -> Blender vector at height z."""
    return Vector((p[0], -p[1], z))


def clean_poly(pts):
    out = []
    for p in pts:
        if not out or (Vector(p) - Vector(out[-1])).length > 1e-4:
            out.append(p)
    if len(out) > 1 and (Vector(out[0]) - Vector(out[-1])).length < 1e-4:
        out.pop()
    return out


def signed_area(pts):
    return 0.5 * sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y
                     for i in range(len(pts)))


def fill_polygon(builder, outlines, z, size):
    """Tessellates one outer outline (+ optional hole outlines) at height z, correct for concave shapes."""
    polys = [[Vector((p.x, p.y, 0.0)) for p in o] for o in outlines]
    for tri in geometry.tessellate_polygon(polys):
        flat = [v for poly in polys for v in poly]
        a, b, c = (Vector((flat[i].x, flat[i].y, z)) for i in tri)
        builder.up_tri(a, b, c, size)


def build_plan(plan, mats):
    h = plan['heights']
    side_h = h['sidewalk']
    bx0, bz0 = plan['bounds']['min']
    bx1, bz1 = plan['bounds']['max']
    m = 40
    P = lambda x, z: Vector((x, -z, GROUND_Y))  # noqa: E731
    ground = Builder('ground', mats.tex('ground', 'stone.png', tint=(0.5, 0.5, 0.48)))
    ground.up_quad([P(bx0 - m, bz0 - m), P(bx1 + m, bz0 - m), P(bx1 + m, bz1 + m), P(bx0 - m, bz1 + m)], (6.5, 6.5))

    asphalt = Builder('asphalt', mats.tex('asphalt', 'road_centr.png'))
    for rb in plan['ribbons']:
        L, R = rb['left'], rb['right']
        n = len(L)
        for i in range(n if rb['closed'] else n - 1):
            j = (i + 1) % n
            asphalt.up_quad([b2(L[i], h['asphalt']), b2(L[j], h['asphalt']), b2(R[j], h['asphalt']),
                             b2(R[i], h['asphalt'])], (10.0, 10.0))

    band = Builder('sidewalk', mats.tex('sidewalk', 'sidewalk_str.png'))
    kerbf = Builder('kerb', mats.tex('kerb', 'sidewalk_crn.png'))
    fills = {
        'urban': Builder('lot', mats.tex('lot', 'concrete_buildings_base.png')),
        'park': Builder('park', mats.tex('park', 'park.png')),
        'esplanade': Builder('esplanade', mats.tex('esplanade', 'stone.png')),
        'median': Builder('median', mats.tex('park', 'park.png')),
    }
    fill_size = {'urban': (10.0, 10.0), 'park': (65.0, 65.0), 'esplanade': (6.5, 6.5), 'median': (65.0, 65.0)}
    for b in plan['blocks']:
        kerb = [b2(p) for p in clean_poly(b['kerb'])]
        inner = [b2(p) for p in clean_poly(b['inner'])]
        if signed_area(kerb) < 0:
            kerb.reverse()
        if signed_area(inner) < 0:
            inner.reverse()
        top = h['asphalt'] + side_h if b['kind'] != 'median' else h['asphalt'] + 0.25
        # vertical kerb faces, outward normal (kerb is CCW: outward is to the right of travel)
        for i in range(len(kerb)):
            a, c = kerb[i], kerb[(i + 1) % len(kerb)]
            ln = (c - a).length
            if ln < 1e-5:
                continue
            kerbf.face([Vector((a.x, a.y, h['asphalt'])), Vector((c.x, c.y, h['asphalt'])),
                        Vector((c.x, c.y, top)), Vector((a.x, a.y, top))],
                       [(0, 0), (ln / 6.5, 0), (ln / 6.5, (top - h['asphalt']) / 6.5), (0, (top - h['asphalt']) / 6.5)])
        if b['kind'] == 'median':
            fill_polygon(fills['median'], [kerb], top, fill_size['median'])
            continue
        # inner fill covers the whole kerb polygon: the plan's inset (`inner`) self-intersects at corners whose
        # radius is below the sidewalk width, which no triangulator survives. The sidewalk band is drawn as
        # index-aligned kerb[i]/inner[i] strips a hair above it (folded strips at those corners overdraw
        # harmlessly: same height, same material).
        if b['kind'] in fills:
            fill_polygon(fills[b['kind']], [kerb], top, fill_size[b['kind']])
        elif b['kind'] == 'plaza':  # env_plaza sits 1 cm above this; paving shows where the plan's inner is larger than the GLB
            fill_polygon(band, [kerb], top, (6.5, 6.5))
        raw_k, raw_i = clean_poly(b['kerb']), clean_poly(b['inner'])
        if len(raw_k) == len(raw_i):
            for i in range(len(raw_k)):
                j = (i + 1) % len(raw_k)
                band.up_quad([b2(raw_k[i], top + BAND_EPS), b2(raw_k[j], top + BAND_EPS),
                              b2(raw_i[j], top + BAND_EPS), b2(raw_i[i], top + BAND_EPS)], (6.5, 6.5))
        else:
            fill_polygon(band, [kerb, inner], top + BAND_EPS, (6.5, 6.5))

    white = Builder('mark_white', mats.flat('white', (0.82, 0.82, 0.8)))
    yellow = Builder('mark_yellow', mats.flat('yellow', (0.85, 0.66, 0.08)))
    for mk in plan['markings']:
        tgt = yellow if mk['kind'] == 'centre' else white
        tgt.up_quad([b2(p, h['asphalt'] + MARK_Y) for p in mk['quad']], (1, 1))

    for bld in (ground, asphalt, band, kerbf, *fills.values(), white, yellow):
        bld.build()


# ---------------------------------------------------------------- props

def kerb_streetlights(plan, ide, textures, spacing=26.0, inset=1.4):
    """Streetlights on the plaza (else esplanade) block sidewalk, arms toward the road."""
    block = next((b for b in plan['blocks'] if b['kind'] == 'plaza'), None) or \
        next((b for b in plan['blocks'] if b['kind'] == 'esplanade'), None)
    if block is None:
        return 0
    kerb = [b2(p) for p in clean_poly(block['kerb'])]
    if signed_area(kerb) < 0:
        kerb.reverse()
    # densify to ~0.5 u
    dense = []
    for i in range(len(kerb)):
        a, c = kerb[i], kerb[(i + 1) % len(kerb)]
        k = max(1, int((c - a).length / 0.5))
        dense.extend(a.lerp(c, t / k) for t in range(k))
    n = len(dense)
    tang = lambda i: (dense[(i + 1) % n] - dense[i - 1]).normalized()  # noqa: E731
    step = max(1, int(round(5.0 / 0.5)))
    zebra_pts = []
    for mk in plan['markings']:
        if mk['kind'] == 'zebra':
            q = [b2(p) for p in mk['quad']]
            zebra_pts.append(q)

    def near_zebra(p, d=6.0):
        for q in zebra_pts:
            # distance to the quad outline or inside
            if geometry.intersect_point_quad_2d(p.to_2d(), *(v.to_2d() for v in q)):
                return True
            for i in range(4):
                a, c = q[i], q[(i + 1) % 4]
                cp, _ = geometry.intersect_point_line(p, a, c)
                tt = max(0.0, min(1.0, (cp - a).dot(c - a) / max((c - a).length_squared, 1e-9)))
                if (a.lerp(c, tt) - p).length < d:
                    return True
        return False

    def ok(i):
        t0, t1 = tang(i - step), tang(i + step)
        if math.degrees(math.acos(max(-1, min(1, t0.dot(t1))))) > 12:  # corner / arc
            return False
        return not near_zebra(dense[i])

    placed, i0, acc = 0, 0, 0.0
    asset = ide['env_streetlight_standard_medium']['asset']
    i = 0
    last = -spacing
    arc = [0.0]
    for k in range(1, n):
        arc.append(arc[-1] + (dense[k] - dense[k - 1]).length)
    next_s = spacing * 0.5
    for i in range(n):
        if arc[i] < next_s:
            continue
        if not ok(i):
            continue
        t = tang(i)
        inward = Vector((-t.y, t.x, 0.0))  # left of a CCW polygon
        pos = dense[i] + inward * inset
        out = -inward
        hld = import_placed(asset, Vector((pos.x, pos.y, 0)), yaw_quat(math.atan2(out.y, out.x)), GLB_UNIT_FIX,
                            textures, drop_to=plan['heights']['sidewalk'])
        placed += hld is not None
        next_s = arc[i] + spacing
    return placed


def plaza_props(layout, textures, ide, have_plaza):
    raise_by = (plan_h_sidewalk + PLAZA_RAISE_EPS) - PLAZA_POS[1]
    skip_models = {s[k] for s in BUILDING_SLOTS for k in range(3)} | {'env_roads', 'env_plaza'}
    n = 0
    x0, x1, z0, z1 = PLAZA_BOX
    for inst in layout['ipl']:
        name = inst['modelName']
        d = ide.get(name)
        if d is None or name in skip_models or name.endswith(('_poor', '_rich')):
            continue
        px, py, pz = inst['pos']
        if name == 'env_skyline':
            n += bool(import_placed(d['asset'], game_to_blender(inst['pos']), game_quat_to_blender(inst['rot']),
                                    GLB_UNIT_FIX, textures))
            continue
        if not (x0 <= px <= x1 and z0 <= pz <= z1) or not visible_normal(d):
            continue
        n += bool(import_placed(d['asset'], game_to_blender((px, py + raise_by, pz)),
                                game_quat_to_blender(inst['rot']), GLB_UNIT_FIX * (inst.get('scale') or [1])[0],
                                textures))
    if have_plaza:
        d = ide['env_plaza']
        import_placed(d['asset'], game_to_blender((PLAZA_POS[0], PLAZA_POS[1] + raise_by, PLAZA_POS[2])),
                      Quaternion((1, 0, 0, 0)), GLB_UNIT_FIX, textures)
    return n


def plan_buildings(plan, layout, textures, ide, extra=()):
    """The plan's own buildings plus any `--buildings` extras: {model, pos: [x, z], y?, rotY? (deg)}.
    Y defaults to the model's current IPL entry (GLB pivots are bbox centres); models absent from the
    IDE (the new terrace) load public/models/map/<model>.glb with their embedded textures."""
    cur = {i['modelName']: i for i in layout['ipl']}
    for b in list(plan['buildings']) + list(extra):
        inst = cur.get(b['model'])
        y = b.get('y', inst['pos'][1] if inst else 0.0)
        rot = yaw_quat(math.radians(b['rotY'])) if b.get('rotY') else (
            game_quat_to_blender(inst['rot']) if inst else Quaternion((1, 0, 0, 0)))
        asset = ide[b['model']]['asset'] if b['model'] in ide else f"models/map/{b['model']}.glb"
        if import_placed(asset, game_to_blender((b['pos'][0], y, b['pos'][1])), rot, GLB_UNIT_FIX, textures) is None:
            print('missing building', asset)


def sample_cars(plan, textures, cam, scene, count=9):
    """Cars on `lane` paths, inside the Street camera frame, spread out, oriented along the lane."""
    sedan = 'models/vehicles/car_sedan.glb'
    junker_ingame = os.path.join(ROOT, 'build', 'visual_gaps', 'vehicles', 'scratch', 'junker_ingame.glb')
    junker = junker_ingame if os.path.exists(junker_ingame) else 'models/vehicles/car_junker.glb'
    models = [sedan, junker, 'models/vehicles/car_limo.glb', sedan, junker, sedan, 'models/vehicles/car_limo.glb']
    zebras = [sum((b2(p) for p in mk['quad']), Vector()) / 4 for mk in plan['markings'] if mk['kind'] == 'zebra']

    def in_frame(p):
        v = world_to_camera_view(scene, cam, Vector((p.x, p.y, 0.5)))
        return 0.08 < v.x < 0.92 and 0.14 < v.y < 0.80 and v.z > 0

    cands = []
    for path in plan['paths']:
        if path['kind'] != 'lane':
            continue
        pts = [b2(p) for p in path['pts']]
        for i in range(len(pts) - 1):
            seg = pts[i + 1] - pts[i]
            ln = seg.length
            if ln < 1e-6:
                continue
            d = seg / ln
            for t in range(max(1, int(ln / 3))):
                p = pts[i] + d * (t * 3.0)
                if all(in_frame(p + d * s) for s in (-6, 0, 6)) and all((p - z).length > 10 for z in zebras):
                    cands.append((p, d))
    chosen = []
    # farthest-point sampling over the candidates, starting from the one nearest the frame centre
    if not cands:
        return 0
    cands.sort(key=lambda c: (c[0] - Vector((4, 10, 0))).length)
    chosen.append(cands[0])
    while len(chosen) < count:
        best = max(cands, key=lambda c: min((c[0] - q[0]).length for q in chosen))
        if min((best[0] - q[0]).length for q in chosen) < 22:
            break
        chosen.append(best)
    for k, (p, d) in enumerate(chosen):
        hold = import_placed(models[k % len(models)], Vector((p.x, p.y, 0)), yaw_quat(math.atan2(d.y, d.x)),
                             GLB_UNIT_FIX, textures, drop_to=plan['heights']['asphalt'])
        if hold is None:
            print('missing car', models[k % len(models)])
    return len(chosen)


# ---------------------------------------------------------------- scene / camera / render

def add_camera(name, loc, hfov, rot=None, target=None):
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = 'HORIZONTAL'
    cd.angle = math.radians(hfov)
    cd.clip_start, cd.clip_end = 0.5, 3000
    cam = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_mode = 'XYZ'
    if rot is not None:
        cam.rotation_euler = rot
    else:
        direction = target - loc
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return cam


def setup_render(res):
    sc = bpy.context.scene
    w, h = (int(v) for v in res.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    world = bpy.data.worlds.new('ambient')
    world.use_nodes = True
    nt = world.node_tree
    amb = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    amb.inputs[0].default_value = AMBIENT
    amb.inputs[1].default_value = 1.0
    sky = nt.nodes.new('ShaderNodeBackground')
    sky.inputs[0].default_value = (*SKY, 1)
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
    nt.links.new(amb.outputs[0], mix.inputs[1])
    nt.links.new(sky.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    sc.world = world
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b is not None:
            b.inputs['Roughness'].default_value = 1.0
            if 'Specular IOR Level' in b.inputs:
                b.inputs['Specular IOR Level'].default_value = 0.0


plan_h_sidewalk = 0.25


def main():
    global plan_h_sidewalk
    plan_path, out_dir, opts = parse_args()
    plan = json.load(open(plan_path, encoding='utf-8'))
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    layout_path = opts['layout']
    if not os.path.exists(layout_path):
        os.makedirs(os.path.dirname(layout_path), exist_ok=True)
        subprocess.check_call([sys.executable if 'python' in os.path.basename(sys.executable).lower() else 'python',
                               os.path.join(ROOT, 'tools', 'blender', 'street_layout_dump.py'), layout_path])
    layout = json.load(open(layout_path, encoding='utf-8'))
    ide = {o['modelName']: o for o in layout['ide']}
    plan_h_sidewalk = plan['heights']['sidewalk']

    bpy.ops.wm.read_factory_settings(use_empty=True)
    textures = Textures(layout['ide'])
    mats = Mat()
    build_plan(plan, mats)
    have_plaza = True  # always placed, whatever the block kind
    n_props = plaza_props(layout, textures, ide, have_plaza)
    extra = json.load(open(opts['buildings'], encoding='utf-8')) if opts.get('buildings') else []
    plan_buildings(plan, layout, textures, ide, extra)
    n_lights = kerb_streetlights(plan, ide, textures)

    street = add_camera('street', game_to_blender(STREET_CAMERA['pos']), STREET_CAMERA['hfov'],
                        rot=(math.pi / 2 + STREET_CAMERA['pitch'], 0, STREET_CAMERA['yaw']))
    aerial = add_camera('aerial', game_to_blender(AERIAL_CAMERA['pos']), AERIAL_CAMERA['hfov'],
                        target=game_to_blender(AERIAL_CAMERA['target']))
    setup_render(opts['res'])
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    n_cars = sample_cars(plan, textures, street, sc)
    setup_render(opts['res'])  # re-run so late imports get the flat-roughness tweak
    print('ROADPLAN', plan['id'], 'props', n_props, 'lights', n_lights, 'cars', n_cars)
    for tag, cam in (('street', street), ('aerial', aerial)):
        if opts.get('only') and opts['only'] != tag:
            continue
        sc.camera = cam
        for ob in bpy.data.objects:  # the skyline is a curved wall: confusing from above, hidden in the aerial
            anc, sky = ob.parent, False
            while anc is not None:
                sky = sky or anc.name.startswith('place_env_skyline')
                anc = anc.parent
            if sky:
                ob.hide_render = tag == 'aerial'
        sc.render.filepath = os.path.join(out_dir, f'{plan["id"]}{opts.get("tag", "")}_{tag}.png')
        bpy.ops.render.render(write_still=True)


main()
