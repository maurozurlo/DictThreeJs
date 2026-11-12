"""Shared helpers for dict-three's procedural POC models (Blender 5.1, headless).

Import from a model script next to it:

    import sys, os; sys.path.insert(0, os.path.dirname(__file__))
    import dt_common as dt

Conventions (match the 3ds Max exporter's street GLBs, so StreetView.tsx renders ours unchanged):

- Build in Blender, Z-up, in GAME WORLD UNITS (1 Blender metre = 1 game unit). The street is drawn
  oversized: a citizen is 1.8 m x 3.7 = 6.66 units tall (PED_WORLD_SCALE), a streetlight 16.7, a park
  bench 6.4 long, a storey of the existing facades about 5 units.
- Blender -Y is the game's +Z, i.e. toward the Street camera (game (8, 61, 124) looking -Z, pitched
  25 degrees down). Blender +X is game +X.
- `export_glb` writes what the Max exporter writes: a mesh node with a 0.001 scale and vertices x1000
  (StreetView's GLB_UNIT_FIX multiplies the placement by 1000 to undo it), Y-up, albedo embedded.
- One material per texture, named after the texture's basename (no extension): StreetView matches a
  material to `public/textures/map/<name>.png` by that name, falling back to the embedded image.
- Textures are tiny (16-128 px) and drawn with NearestFilter in the game: every image node here is
  set to Closest.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
PED_WORLD_SCALE = 3.7
PERSON_HEIGHT = 1.8 * PED_WORLD_SCALE  # 6.66 units

# ---------------------------------------------------------------------------------------------------
# Building slots: the five street plots. Bounds are the NORMAL model's, in Blender axes and game
# units, relative to the IPL pivot (the slot's position in street-placement.ipl.ts). `fronts` are the
# sides the Street camera sees; the existing models leave the other sides open or bare.
SLOTS = {
    'apartment':   dict(ipl=(-70.5091, 12.1701, 6.2423), min=(-15.46, -25.71, -12.17), max=(15.46, 25.71, 12.17),
                        fronts=('+X', '-Y'), note='left side of the street, faces the road (+X) and the camera (-Y)'),
    'civic':       dict(ipl=(-25.9581, 13.3443, -66.44), min=(-24.49, -15.25, -13.34), max=(24.49, 15.25, 13.34),
                        fronts=('-Y', '+X', '-X'), note='back row centre-left, faces the camera'),
    'commercial':  dict(ipl=(28.9129, 7.6798, -61.6309), min=(-25.99, -8.74, -8.90), max=(25.99, 8.74, 8.90),
                        fronts=('-Y', '+X', '-X'), note='back row centre-right, faces the camera'),
    'residential': dict(ipl=(72.7167, 3.8065, 9.7592), min=(-6.20, -13.50, -4.69), max=(6.20, 13.50, 4.69),
                        fronts=('-X', '-Y'), note='right side, front, faces the road (-X) and the camera (-Y)'),
    'mixeduse':    dict(ipl=(73.2308, 8.5841, -15.381), min=(-8.06, -11.35, -8.58), max=(9.46, 11.35, 8.58),
                        fronts=('-X', '-Y'), note='right side, behind residential, faces the road (-X) and camera (-Y)'),
}


def slot_ground_z(slot):
    """z of the street surface in the slot's pivot frame (the normal model's lowest point)."""
    return SLOTS[slot]['min'][2]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------------------------------------------
# Materials

def material(name, image_path=None, colour=None):
    """Principled material named after its texture; Closest-sampled image if given, else flat colour."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.9
    if image_path:
        img = bpy.data.images.load(os.path.abspath(image_path), check_existing=True)
        tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.interpolation = 'Closest'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        # Blender reports 4 channels for RGB PNGs too; only a 32-bit (RGBA) file has real alpha.
        # Linking alpha on an opaque image exports alphaMode BLEND, which three.js sorts as transparent.
        if img.depth in (32, 64) and img.alpha_mode != 'NONE':
            # Alpha through a ROUND math node is the glTF exporter's alpha-clip pattern: it writes
            # alphaMode MASK, alphaCutoff 0.5 — what the game does for `transparent: true` slots.
            rnd = nt.nodes.new('ShaderNodeMath')
            rnd.operation = 'ROUND'
            nt.links.new(tex.outputs['Alpha'], rnd.inputs[0])
            nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
        elif bsdf.inputs['Alpha'].is_linked:
            for link in list(bsdf.inputs['Alpha'].links):
                nt.links.remove(link)
    elif colour:
        bsdf.inputs['Base Color'].default_value = (*colour, 1)
    return mat


# ---------------------------------------------------------------------------------------------------
# Mesh helpers

def mesh_object(name, bm, mats=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


def bounds(objs):
    mn = Vector((1e18,) * 3)
    mx = -mn
    for o in objs:
        if o.type != 'MESH':
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    return mn, mx


def outward_normal_report(obj, samples=None):
    """Fraction of faces whose normal points away from the object's bbox centre (closed-ish props).

    Not exact for concave shapes; use it as a smoke test, and look at a back-face render as well
    (the game culls back faces; Workbench does not, unless `show_backface_culling` is on).
    """
    me = obj.data
    c = sum((v.co for v in me.vertices), Vector()) / max(1, len(me.vertices))
    good = sum(1 for p in me.polygons if (p.center - c).dot(p.normal) >= 0)
    return good / max(1, len(me.polygons))


# ---------------------------------------------------------------------------------------------------
# Export

def export_glb(objs, path, node_name=None):
    """Writes `objs` as one GLB the way the Max exporter does (mesh x1000 under a 0.001 node scale).

    The objects are joined into one mesh node named `node_name` (default: file stem) unless they are
    parented (vehicles keep wheel nodes: pass the root and its children; each keeps its own node).
    Transforms are applied first, so build anywhere and place with the object transform.
    """
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stem = os.path.splitext(os.path.basename(path))[0]
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in objs if o.type == 'MESH']
    parented = any(o.parent is not None for o in objs)
    if not parented and len(meshes) > 1:
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        meshes = [bpy.context.view_layer.objects.active]
        objs = meshes
    # The Max exporter keeps vertices in game units and puts a stray 0.001 scale on the mesh node;
    # StreetView multiplies the placement by 1000 to cancel it. Do exactly the same.
    if not parented:
        ob = meshes[0]
        ob.name = node_name or stem
        ob.data.transform(ob.matrix_world)
        ob.matrix_world = Matrix.Identity(4)
        ob.scale = (0.001, 0.001, 0.001)
    else:
        # Keep the hierarchy (vehicle wheels); the ROOT takes the 0.001 so children stay in game units.
        for r in [o for o in objs if o.parent is None]:
            r.scale = (0.001, 0.001, 0.001)
    bpy.context.view_layer.update()
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
        export_animations=False, export_skins=False, export_morph=False, export_cameras=False,
        export_lights=False, export_extras=False,
    )
    print('EXPORTED', path, tri_count(objs), 'tris')
    return path


def render_check(glb_paths, out_png, extra=()):
    """Shell line for tools/blender/tier_preview.py (run it as its own Blender process)."""
    args = ' '.join(f'{lab}={p}' for lab, p in glb_paths)
    return f'& "{BLENDER}" -b --factory-startup --python tools/blender/tier_preview.py -- {out_png} {args} {" ".join(extra)}'
