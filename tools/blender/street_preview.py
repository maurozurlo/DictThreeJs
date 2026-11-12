"""Whole-street tier preview: the Street tab rebuilt in Blender from the IDE/IPL data, seen through the
game's Street camera, once per infrastructure tier (poor | normal | rich).

    python tools/blender/street_layout_dump.py build/visual_gaps/street_layout.json
    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/street_preview.py -- <layout.json> <out_dir> [--tiers poor,normal,rich] ^
        [--light ambient|flat|studio] [--res 1600x900] [--no-extras] [--today] [--service]

What it mirrors from the game (src/Hooks/useStreetLayout.ts, src/3d/StreetView.tsx):
- visibleIf filtering by tab / infrastructure / security (modifier-gated entries are skipped);
- building slots pick poor / normal / rich by conditionStage (-5 / 0 / +5 here: every slot flips), rich
  falling back to normal when no rich GLB exists, exactly as the game does today;
- env_roads / env_plaza swap to their `_poor` textures when conditionStage < 0;
- materials re-textured by name from the IDE's texture list, embedded albedo otherwise, Closest sampling;
- placement: game (x, y, z) -> Blender (x, -z, y), x1000 placement scale (GLB_UNIT_FIX);
- the Street camera: game (8.116, 60.961, 124.141), pitch -0.4364 rad, 60 degree horizontal FOV;
- light: the game has one ambient light and no sun, so `--light flat` (default) shows albedo only.

Security is held at 5 (Controlled) for every tier so only the infrastructure axis changes.

`EXTRAS` (preview only, NOT in the game yet) puts this batch's new tier models into the street so the
evolution can be judged in context: tier swaps of existing props (palm for tree, luxury lamp for lamp,
...) at the existing placements, and the new prop types at hand-picked plaza spots. A missing GLB is
skipped, so the script runs at any stage of the batch.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUB = os.path.join(ROOT, 'public')
GLB_UNIT_FIX = 1000.0

TIERS = {
    #        infrastructure, conditionStage, world colour (sky stand-in per GDD: overcast / grey / sunny)
    'poor':   (2, -5, (0.50, 0.50, 0.50)),
    'normal': (5, 0, (0.62, 0.66, 0.72)),
    'rich':   (9, 5, (0.50, 0.70, 0.95)),
}
SECURITY = 5  # Controlled; `--service` raises it to 9 (Militarised) for the service-vehicle shot

# `--service`: the budget-gated vehicles (security >= 8: military jeep; health >= 8: ambulance) on the
# roads, with security at Militarised so the tanks and gun nests show too. Game (x, y, z, yaw degrees).
SERVICE = [
    ('models/vehicles/car_jeep_military.glb', (-47.1, 0.0, 6.0), 90),
    ('models/vehicles/car_ambulance.glb', (-16.0, 0.0, 27.6), 180),
]

BUILDING_SLOTS = [
    ('env_bld_mixeduse_normal', 'env_bld_mixeduse_poor', 'env_bld_mixeduse_rich'),
    ('env_bld_apartment_normal', 'env_bld_apartment_poor', 'env_bld_apartment_rich'),
    ('env_bld_commercial_normal', 'env_bld_commercial_poor', 'env_bld_commercial_rich'),
    ('env_bld_civic_normal', 'env_bld_civic_poor', 'env_bld_civic_rich'),
    ('env_bld_residential_normal', 'env_bld_residential_poor', 'env_bld_residential_rich'),
]
GROUND_MODELS = {'env_roads', 'env_plaza'}

# Preview-only: tier swaps of existing props (same placements as the normal prop) ...
SWAPS = {
    'poor': {'env_streetlight_standard_medium': 'env_streetlight_poor', 'env_parkbench_medium': 'env_parkbench_poor'},
    'rich': {'env_tree_medium': 'env_tree_rich', 'env_streetlight_standard_medium': 'env_streetlight_rich',
             'env_parkbench_medium': 'env_parkbench_rich'},
}
# Normal-only props that the game hides below infrastructure 4: their poor swap must still be placed.
SWAP_IGNORE_VISIBILITY = {'env_streetlight_poor', 'env_parkbench_poor'}

# ... and new prop types at plaza spots (game x, y, z, yaw degrees). Plaza spans x -37..45, z -30..23.
# Statue row along the plaza's back: clear of the flagpole (8, -10), the guard post (37.6, -15.4) and
# the gold group's 5.4-unit wing overhang on -X. Slot 0 = gold, 1 = bronze (first purchase), 2 = silver.
PEDESTALS = [(-24.0, 0.0, -18.0), (-2.0, 0.0, -18.0), (20.0, 0.0, -18.0)]
# The junker as the game assembles it (root dummies composed, back wheels sharing the front axle mesh,
# scaled to CAR_LENGTH_M x VEHICLE_WORLD_SCALE): written by `tools/blender/vehicles.py -- --lineup`.
JUNKER_INGAME = os.path.join(ROOT, 'build', 'visual_gaps', 'vehicles', 'scratch', 'junker_ingame.glb')
EXTRAS = {
    'poor': [
        ('models/map/env_trashcan_burning.glb', (-6.0, 0.0, 8.0), 20),
        ('models/map/env_trashcan_burning.glb', (27.0, 0.0, -6.0), -35),
        ('models/map/env_burned_decal.glb', (-9.0, 0.02, 10.0), 0),
        ('models/map/env_burned_decal.glb', (20.0, 0.02, 4.0), 60),
        ('models/map/env_planter_poor.glb', (-30.0, 0.0, 10.0), 0),
        ('models/map/env_planter_poor.glb', (40.0, 0.0, 10.0), 0),
        *[('models/map/env_statue_pedestal.glb', p, 0) for p in PEDESTALS],
        (JUNKER_INGAME if os.path.exists(JUNKER_INGAME) else 'models/vehicles/car_junker.glb', (12.0, 0.0, 31.4), 0),
    ],
    'normal': [
        ('models/map/env_fountain_normal.glb', (8.0, 0.0, 4.0), 0),
        ('models/map/env_planter_normal.glb', (-30.0, 0.0, 10.0), 0),
        ('models/map/env_planter_normal.glb', (40.0, 0.0, 10.0), 0),
        ('models/map/env_statue_pedestal.glb', PEDESTALS[0], 0),
        ('models/map/env_statue_bronze.glb', PEDESTALS[1], 0),
        ('models/map/env_statue_pedestal.glb', PEDESTALS[2], 0),
        ('models/vehicles/car_sedan.glb', (12.0, 0.0, 31.4), 0),
    ],
    'rich': [
        ('models/map/env_fountain_rich.glb', (8.0, 0.0, 4.0), 0),
        ('models/map/env_planter_rich.glb', (-30.0, 0.0, 10.0), 0),
        ('models/map/env_planter_rich.glb', (40.0, 0.0, 10.0), 0),
        ('models/map/env_bush_rich.glb', (-22.0, 0.0, 12.0), 0),
        ('models/map/env_bush_rich.glb', (32.0, 0.0, 12.0), 0),
        ('models/map/env_statue_gold.glb', PEDESTALS[0], 0),
        ('models/map/env_statue_bronze.glb', PEDESTALS[1], 0),
        ('models/map/env_statue_silver.glb', PEDESTALS[2], 0),
        ('models/vehicles/car_limo.glb', (12.0, 0.0, 31.4), 0),
    ],
}

STREET_CAMERA = dict(pos=(8.116, 60.961, 124.141), pitch=-0.4364, yaw=0.0, hfov=60.0)


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:]
    opts = {'tiers': 'poor,normal,rich', 'light': 'ambient', 'res': '1600x900', 'extras': True}
    pos = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--no-extras':
            opts['extras'] = False
        elif a == '--service':
            opts['service'] = True
        elif a == '--today':  # the game as it is: no extras, buildings from the IDE only
            opts['extras'] = False
            opts['today'] = True
        elif a.startswith('--'):
            opts[a[2:]] = argv[i + 1]
            i += 1
        else:
            pos.append(a)
        i += 1
    return pos[0], pos[1], opts


def norm_tex(name):
    """StreetView.normalizeTexName: basename, extension dropped, lower-cased, trailing _png dropped."""
    base = name.split('/')[-1]
    import re
    n = re.sub(r'\.[^.]+$', '', base).lower()
    return re.sub(r'_(png|jpg|jpeg|bmp|tga|gif)$', '', n)


def game_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def game_quat_to_blender(q):
    x, y, z, w = q
    return Quaternion((w, x, -z, y))


def yaw_quat(deg):
    a = math.radians(deg)
    return Quaternion((math.cos(a / 2), 0, 0, math.sin(a / 2)))


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


def import_placed(asset, loc, quat, scale, textures, suffix):
    path = os.path.join(PUB, asset)
    if not os.path.exists(path):
        return False
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
            hit = (key + suffix) if suffix and (key + suffix) in textures.slots else key
            if hit in textures.slots:
                o.data.materials[i] = textures.material(hit)
                continue
            # the game culls back faces (MeshStandardMaterial FrontSide) unless the slot is transparent;
            # an embedded image with an alpha-linked BSDF is the GLB's alphaMode MASK: treat it as cut-out
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
    return True


def visible(def_, tier):
    infra, stage, _ = TIERS[tier]
    v = def_.get('visibleIf') or {}
    if 'tab' in v and v['tab'] != 'Street':
        return False
    if 'infrastructure' in v and not (v['infrastructure'][0] <= infra <= v['infrastructure'][1]):
        return False
    if 'security' in v and not (v['security'][0] <= SECURITY <= v['security'][1]):
        return False
    if 'modifier' in v:
        return False
    return True


def setup(tier, light, res):
    """`ambient` (default): EEVEE lit by a uniform warm world only — the game's single ambientLight —
    with the tier's sky colour seen by camera rays; honours alpha cut-outs (Workbench in 5.1 ignores
    texture alpha). `flat` / `studio`: Workbench, quick, cut-outs drawn solid."""
    sc = bpy.context.scene
    w, h = (int(v) for v in res.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    if light == 'ambient':
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
        amb.inputs[0].default_value = (0.886, 0.847, 0.745, 1)  # #e2d8be, the game's ambient colour
        amb.inputs[1].default_value = 1.0
        sky = nt.nodes.new('ShaderNodeBackground')
        sky.inputs[0].default_value = (*TIERS[tier][2], 1)
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
    else:
        try:
            sc.render.engine = 'BLENDER_WORKBENCH'
        except TypeError:
            pass
        sh = sc.display.shading
        sh.light = 'FLAT' if light == 'flat' else 'STUDIO'
        sh.color_type = 'TEXTURE'
        sh.show_backface_culling = True
        sh.show_shadows = light != 'flat'
        sh.shadow_intensity = 0.3
        sc.display.light_direction = (0.45, -0.35, 0.82)
        world = bpy.data.worlds.new('sky')
        world.color = TIERS[tier][2]
        sc.world = world
    cam_data = bpy.data.cameras.new('street')
    cam_data.sensor_fit = 'HORIZONTAL'
    cam_data.angle = math.radians(STREET_CAMERA['hfov'])
    cam_data.clip_start = 0.5
    cam_data.clip_end = 3000
    cam = bpy.data.objects.new('street', cam_data)
    sc.collection.objects.link(cam)
    cam.location = game_to_blender(STREET_CAMERA['pos'])
    cam.rotation_mode = 'XYZ'
    cam.rotation_euler = (math.pi / 2 + STREET_CAMERA['pitch'], 0, STREET_CAMERA['yaw'])
    sc.camera = cam


def build(tier, layout, textures, extras, today=False, service=False):
    infra, stage, _ = TIERS[tier]
    ide = {o['modelName']: o for o in layout['ide']}
    variants = {s[1] for s in BUILDING_SLOTS} | {s[2] for s in BUILDING_SLOTS}
    swaps = SWAPS.get(tier, {}) if extras else {}
    suffix = '_poor' if stage < 0 else ''
    placed, missing = 0, set()
    for inst in layout['ipl']:
        name = inst['modelName']
        loc = game_to_blender(inst['pos'])
        quat = game_quat_to_blender(inst['rot'])
        scale = GLB_UNIT_FIX * (inst.get('scale') or [1, 1, 1])[0]
        slot = next((s for s in BUILDING_SLOTS if s[0] == name), None)
        if slot:
            want = slot[1] if stage < 0 else slot[2] if stage > 0 else slot[0]
            asset = f'models/map/{want}.glb'
            if today:  # exactly what the game loads now: the IDE's asset, rich falling back to normal
                asset = ide[slot[1] if stage < 0 else slot[0]]['asset']
            elif not os.path.exists(os.path.join(PUB, asset)):
                missing.add(want)
                asset = ide[name]['asset'] if want != slot[1] else ide[slot[1]]['asset']
            placed += import_placed(asset, loc, quat, scale, textures, '')
            continue
        if name in variants:
            continue
        d = ide.get(name)
        if d is None:
            continue
        swap = swaps.get(name)
        if swap and os.path.exists(os.path.join(PUB, f'models/map/{swap}.glb')):
            if visible(d, tier) or swap in SWAP_IGNORE_VISIBILITY:
                placed += import_placed(f'models/map/{swap}.glb', loc, quat, scale, textures, '')
            continue
        if swap:
            missing.add(swap)
        if not visible(d, tier):
            continue
        sfx = suffix if name in GROUND_MODELS else ''
        placed += import_placed(d['asset'], loc, quat, scale, textures, sfx)
    if service:
        for asset, pos, yaw in SERVICE:
            ok = import_placed(asset, game_to_blender(pos), yaw_quat(yaw), GLB_UNIT_FIX, textures, '')
            if not ok:
                missing.add(os.path.basename(asset))
            placed += ok
    if extras:
        for asset, pos, yaw in EXTRAS.get(tier, []):
            ok = import_placed(asset, game_to_blender(pos), yaw_quat(yaw), GLB_UNIT_FIX, textures, '')
            if not ok:
                missing.add(os.path.basename(asset))
            placed += ok
    return placed, sorted(missing)


def main():
    layout_path, out_dir, opts = parse_args()
    layout = json.load(open(layout_path, encoding='utf-8'))
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    for tier in opts['tiers'].split(','):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        textures = Textures(layout['ide'])
        global SECURITY
        if opts.get('service'):
            SECURITY = 9
        placed, missing = build(tier, layout, textures, opts['extras'], opts.get('today', False),
                                opts.get('service', False))
        setup(tier, opts['light'], opts['res'])
        tag = '_service' if opts.get('service') else ''
        path = os.path.join(out_dir, f'street_{tier}{tag}_{opts["light"]}.png')
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        with open(path + '.txt', 'w', encoding='utf-8') as fh:
            fh.write(f'{tier}\t{placed} placed\tmissing: {", ".join(missing) or "none"}\n')
        print('STREET_PREVIEW', tier, placed, 'placed; missing', missing)


main()
