# Helper bpy bersama untuk model kit Office Baru (furniture.py, props.py). Satuan meter, Z ke atas,
# depan model = -Y Blender (= +Z glTF, konvensi kit). Nama material = kunci bahan di kit (scene/fallback/kit.ts).
import math
import random

import bmesh
import bpy
import mathutils

COL = {
    'Fabric': (0.25, 0.27, 0.30), 'Fabric2': (0.55, 0.45, 0.35), 'Leather': (0.30, 0.18, 0.12), 'Wood': (0.55, 0.38, 0.22),
    'WoodDark': (0.22, 0.14, 0.09), 'Laminate': (0.85, 0.83, 0.80), 'Metal': (0.10, 0.10, 0.11), 'Chrome': (0.80, 0.80, 0.82),
    'Plastic': (0.08, 0.08, 0.09), 'Keys': (0.16, 0.16, 0.18), 'Stone': (0.82, 0.79, 0.74), 'Brass': (0.70, 0.53, 0.28),
    'Glow': (1.0, 0.85, 0.6), 'GlowBlue': (0.3, 0.5, 1.0), 'Screen': (0.1, 0.15, 0.25), 'Glass': (0.75, 0.85, 0.9),
    'Leaf': (0.16, 0.32, 0.15), 'Leaf2': (0.36, 0.45, 0.18), 'Pot': (0.78, 0.76, 0.72), 'Soil': (0.16, 0.11, 0.08),
    'Trunk': (0.35, 0.25, 0.17), 'Steel': (0.70, 0.71, 0.72), 'Shell': (0.88, 0.86, 0.82),
}
TWO_SIDED = {'Leaf', 'Leaf2'}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*COL[name], 1)
        m.use_backface_culling = name not in TWO_SIDED
    return m


def finish(o, mat, bevel=0.0, seg=2, smooth=True):
    """Bevel (meter) → halus + weighted normal (muka datar tetap datar) → modifier diterapkan."""
    o.data.materials.clear()
    o.data.materials.append(material(mat))
    if bevel > 0:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(40)
    if smooth:
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        w = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        w.weight = 50
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = o.data
    o.modifiers.clear()
    o.data = me
    bpy.data.meshes.remove(old)
    return o


def place(o, loc, rot):
    o.rotation_euler = rot
    o.location = loc
    return o


def box(size, loc, mat, bevel=0.0, seg=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.active_object
    o.data.transform(mathutils.Matrix.Diagonal((*size, 1)))
    finish(o, mat, bevel, seg)
    return place(o, loc, rot)


def cyl(r, depth, loc, mat, verts=20, rot=(0, 0, 0), bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(0, 0, 0))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=(0, 0, 0))
    o = bpy.context.active_object
    finish(o, mat, bevel, 2)
    return place(o, loc, rot)


def sphere(r, loc, mat, scale=(1, 1, 1), segs=16, rings=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=r, location=(0, 0, 0))
    o = bpy.context.active_object
    o.data.transform(mathutils.Matrix.Diagonal((*scale, 1)))
    finish(o, mat, 0)
    return place(o, loc, rot)


def torus(major, minor, loc, mat, rot=(0, 0, 0), seg=48, ring=10):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg, minor_segments=ring, location=(0, 0, 0))
    o = bpy.context.active_object
    finish(o, mat, 0)
    return place(o, loc, rot)


def prism(pts, z0, z1, mat, bevel=0.0, seg=2, name='prism'):
    """Poligon 2D (urutan berlawanan jarum jam dilihat dari atas) diekstrusi dari z0 ke z1."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in pts]
    top = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bottom)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return finish(o, mat, bevel, seg)


def stadium(w, d, cx=0.0, cy=0.0, steps=10):
    """Garis luar 'stadion' (persegi panjang berujung setengah lingkaran) lebar w (X), dalam d (Y)."""
    r = d / 2
    pts = []
    for k in range(steps + 1):  # ujung kanan, dari bawah ke atas
        a = -math.pi / 2 + math.pi * k / steps
        pts.append((cx + w / 2 - r + math.cos(a) * r, cy + math.sin(a) * r))
    for k in range(steps + 1):  # ujung kiri, dari atas ke bawah
        a = math.pi / 2 + math.pi * k / steps
        pts.append((cx - w / 2 + r + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def rounded_rect(w, d, r, cx=0.0, cy=0.0, steps=6):
    pts = []
    for ox, oy, a0 in ((w / 2 - r, -d / 2 + r, -90), (w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180)):
        for k in range(steps + 1):
            a = math.radians(a0 + k * 90 / steps)
            pts.append((cx + ox + math.cos(a) * r, cy + oy + math.sin(a) * r))
    return pts


def screen(w, h, loc, mat='Screen'):
    """Bidang layar menghadap -Y dengan UV 0..1 (kit memasang tekstur layar)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    o = bpy.context.active_object
    o.data.transform(mathutils.Matrix.Diagonal((w, h, 1, 1)))
    finish(o, mat, 0, smooth=False)
    return place(o, loc, (math.pi / 2, 0, 0))


def leaf(length, width, mat, loc, yaw, pitch, roll=0.0, bend=0.25, fold=0.18, name='leaf', shape='oval'):
    """Daun: tulang tengah terlipat (V) dan melengkung ke bawah ke ujung. Pangkal di loc, arah tumbuh dari yaw/pitch."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = 6
    rows = []
    for i in range(n + 1):
        t = i / n
        y = t * length
        if shape == 'blade':
            half = width / 2 * (1 - t ** 3) * (0.6 + 0.4 * math.sin(math.pi * min(1, t + 0.15)))
        else:
            half = width / 2 * math.sin(math.pi * (0.06 + 0.94 * t)) ** 0.8
        z = -bend * length * t * t
        mid = bm.verts.new((0, y, z + fold * half))
        left = bm.verts.new((-half, y, z))
        right = bm.verts.new((half, y, z))
        rows.append((left, mid, right))
    for i in range(n):
        a, b = rows[i], rows[i + 1]
        bm.faces.new((a[0], b[0], b[1], a[1]))
        bm.faces.new((a[1], b[1], b[2], a[2]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    finish(o, mat, 0)
    o.rotation_euler = (pitch, roll, yaw)  # XYZ: angguk, miring, lalu putar di sumbu tegak
    o.location = loc
    return o


def rod(p0, p1, r, mat, verts=10, r2=None):
    """Silinder dari titik p0 ke p1 (kaki miring, kawat penyangga)."""
    a, b = mathutils.Vector(p0), mathutils.Vector(p1)
    d = b - a
    o = cyl(r, d.length, (0, 0, 0), mat, verts, r2=r2)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    o.location = (a + b) / 2
    return o


def surface(name, rows, mat, thickness=0.012, subd=1):
    """Permukaan dari grid titik (baris × kolom) → tebal (solidify) + halus (subdivision) → diterapkan."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    grid = [[bm.verts.new(p) for p in row] for row in rows]
    for i in range(len(grid) - 1):
        for j in range(len(grid[i]) - 1):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material(mat))
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = -1
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = subd
    sub.render_levels = subd
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = o.data
    o.modifiers.clear()
    o.data = me2
    bpy.data.meshes.remove(old)
    return o


def model(name, parts):
    """Gabungkan bagian jadi satu objek bernama `name` (slot material tetap), pivot di titik asal."""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def rng(seed):
    return random.Random(seed)
