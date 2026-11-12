"""Tier lineup renderer: poor | normal | rich side by side, same camera, same scale.

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" -b --factory-startup ^
        --python tools/blender/tier_preview.py -- <out.png> <label>=<model.glb> [<label>=<model.glb> ...] ^
        [--res 1600x700] [--views 3q,front,top] [--bg sky|grey] [--person] [--gap 1.25]

Each model is imported, dropped so its lowest point sits on z = 0, centred on its own footprint and
placed left to right in argument order with a gap proportional to the widest model. A model given as
`-` leaves an empty labelled slot (a tier that does not exist). Every view is one PNG per view
(`<out>_<view>.png`) plus the stacked sheet `<out>.png` with the labels burnt in.

Textures: the GLBs embed their albedo (the game's exporter and our own scripts both do), so the preview
reads those, forced to Closest interpolation to match the game's NearestFilter. `--person` stands a 1.8 m
x 3.7 (the game's ped scale) grey capsule beside the first slot for scale.

Renders with Workbench (flat studio light, textured colour, shadows on): headless-safe and quick.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

PED_WORLD_SCALE = 3.7  # src/3d/CitizenModels.tsx: 1 m of person = 3.7 world units


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = argv[0]
    slots, opts = [], {'res': '1600x700', 'views': '3q', 'bg': 'sky', 'person': False, 'gap': '1.25'}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a.startswith('--'):
            key = a[2:]
            if key == 'person':
                opts['person'] = True
            else:
                opts[key] = argv[i + 1]
                i += 1
        else:
            label, _, path = a.partition('=')
            slots.append((label, path))
        i += 1
    return out, slots, opts


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    for o in objs:
        if o.type == 'MESH':
            for m in o.data.materials:
                if m and m.use_nodes:
                    for n in m.node_tree.nodes:
                        if n.type == 'TEX_IMAGE':
                            n.interpolation = 'Closest'
    return objs


def world_bounds(objs):
    mn = Vector((1e18, 1e18, 1e18))
    mx = -mn
    for o in objs:
        if o.type != 'MESH':
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    return mn, mx


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


def make_person(x, y):
    h = 1.8 * PED_WORLD_SCALE
    r = 0.22 * PED_WORLD_SCALE
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=h - 2 * r, location=(x, y, h / 2))
    body = bpy.context.object
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=r, location=(x, y, h - r * 0.6))
    mat = bpy.data.materials.new('person_grey')
    mat.diffuse_color = (0.55, 0.55, 0.6, 1)
    for o in (body, bpy.context.object):
        o.data.materials.append(mat)
    return h


def setup_render(res, bg):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    w, h = (int(v) for v in res.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_shadows = True
    sh.shadow_intensity = 0.35
    sh.show_cavity = False
    col = (0.62, 0.72, 0.84) if bg == 'sky' else (0.32, 0.32, 0.34)
    world = bpy.data.worlds.new('bg')
    world.color = col
    sc.world = world
    sc.display.shadow_focus = 0.2
    sc.display.light_direction = (0.45, -0.35, 0.82)
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False


def add_ground(cx, width, depth):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, 0, -0.02))
    g = bpy.context.object
    g.scale = (width, depth, 1)
    mat = bpy.data.materials.new('ground')
    mat.diffuse_color = (0.42, 0.41, 0.39, 1)
    g.data.materials.append(mat)


def camera_for(view, cx, span_x, span_y, height):
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_data.type = 'ORTHO'
    target = Vector((cx, 0, height * 0.42))
    if view == '3q':  # from the camera side (-Y) and +X: sees -Y and +X faces
        d = Vector((0.62, -1.0, 0.55)).normalized()
    elif view == '3ql':  # from the camera side and -X: sees -Y and -X faces (right-hand street slots)
        d = Vector((-0.62, -1.0, 0.55)).normalized()
    elif view == 'front':
        d = Vector((0, -1.0, 0.08)).normalized()
    elif view == 'back':
        d = Vector((-0.62, 1.0, 0.55)).normalized()
    elif view == 'top':
        d = Vector((0.0, -0.001, 1.0)).normalized()
        target = Vector((cx, 0, 0))
    elif view == 'street':
        # roughly the game's Street camera: low, looking slightly down from the plaza side
        d = Vector((0.25, -1.0, 0.28)).normalized()
    else:
        raise SystemExit('unknown view ' + view)
    dist = max(span_x, span_y, height) * 4 + 50
    cam.location = target + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    aspect = bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y
    need_w = span_x * 1.08
    need_h = (height if view != 'top' else span_y) * 1.25
    if view == '3q' or view == 'back' or view == 'street':
        need_h = height * 1.05 + span_y * 0.55
    cam_data.ortho_scale = max(need_w, need_h * aspect)
    cam_data.clip_end = dist * 4
    return cam


def label_image(path, labels, xs_frac, extra):
    """Burn the slot labels (and tri counts) into the PNG with Blender's own image API."""
    # Blender has no text-on-image API; write a sidecar the stacker (Pillow, outside Blender) uses.
    with open(path + '.labels.txt', 'w', encoding='utf-8') as fh:
        for lab, xf, ex in zip(labels, xs_frac, extra):
            fh.write(f'{xf:.4f}\t{lab}\t{ex}\n')


def main():
    out, slots, opts = parse_args()
    out = os.path.abspath(out)  # Blender resolves relative render paths against the (absent) .blend
    slots = [(lab, p if p == '-' else os.path.abspath(p)) for lab, p in slots]
    reset()
    setup_render(opts['res'], opts['bg'])
    placed = []  # (label, objs, width, depth, height, tris)
    for label, path in slots:
        if path == '-' or not os.path.exists(path):
            placed.append((label, [], 0, 0, 0, 0, path))
            continue
        objs = import_glb(path)
        # The game multiplies every street GLB's placement scale by GLB_UNIT_FIX (StreetView.tsx):
        # the exporter's mesh nodes carry a 0.001 mm->m scale. Undo it the same way here, through one
        # holder over every root, so multi-root files (the junker's offset dummies) keep their layout.
        holder = bpy.data.objects.new('holder_' + label, None)
        bpy.context.scene.collection.objects.link(holder)
        holder.scale = (float(opts.get('unitfix', '1000')),) * 3
        for r in [o for o in objs if o.parent is None]:
            r.parent = holder
        objs.append(holder)
        roots = [holder]
        bpy.context.view_layer.update()
        mn, mx = world_bounds(objs)
        shift = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))
        for r in roots:
            r.location += shift
        bpy.context.view_layer.update()
        size = mx - mn
        placed.append((label, objs, size.x, size.y, size.z, tri_count(objs), path))

    widths = [p[2] for p in placed if p[1]] or [10]
    gap = max(widths) * (float(opts['gap']) - 1.0) + max(widths) * 0.15
    slot_w = max(widths)
    x = 0.0
    centres = []
    for label, objs, w, d, h, tris, path in placed:
        cx = x + slot_w / 2
        centres.append(cx)
        for r in [o for o in objs if o.parent is None]:
            r.location.x += cx
        x += slot_w + gap
    total_w = x - gap
    max_h = max([p[4] for p in placed if p[1]] or [10])
    max_d = max([p[3] for p in placed if p[1]] or [10])
    if opts['person']:
        ph = make_person(centres[0] - slot_w / 2 - 2.0, -max_d * 0.25)
        max_h = max(max_h, ph)
    add_ground(total_w / 2, total_w + slot_w, max_d * 2 + 10)
    bpy.context.view_layer.update()

    views = opts['views'].split(',')
    base, _ = os.path.splitext(out)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    for view in views:
        cam = camera_for(view, total_w / 2, total_w + (2.5 if opts['person'] else 0) * 2, max_d, max_h)
        if opts['person']:
            cam.location.x -= 0
        path = f'{base}_{view}.png'
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        # x fraction of each slot centre across the frame (ortho: linear)
        ow = cam.data.ortho_scale
        right = Vector((1, 0, 0))
        right = cam.matrix_world.to_3x3() @ right
        xf = []
        for cx in centres:
            p = Vector((cx, 0, 0)) - cam.location
            xf.append(0.5 + p.dot(right) / ow)
        extra = [f'{p[5]} tris  {p[2]:.0f}x{p[3]:.0f}x{p[4]:.0f}' if p[1] else 'missing' for p in placed]
        label_image(path, [p[0] for p in placed], xf, extra)
        bpy.data.objects.remove(cam)
    print('TIER_PREVIEW_DONE', base)


main()
