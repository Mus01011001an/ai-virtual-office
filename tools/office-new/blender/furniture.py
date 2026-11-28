# Kursi & meja Office Baru, dibuat dengan Blender (bpy) — bukan kotak polos: tepi membulat (bevel), bantal empuk,
# kaki bintang 5 dengan roda, rangka besi, sandaran melengkung. Semua buatan sendiri (CC0 milik project).
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#     --python tools/office-new/blender/furniture.py -- frontend/public/office-new/kit/furniture.glb
#
# Satuan meter. Depan kursi/meja = -Y Blender (= +Z glTF, konvensi kit). Nama material dipakai kit untuk memberi bahan
# Poly Haven & warna: Fabric, Leather, Wood, Laminate, Metal, Chrome, Plastic.
import math
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'furniture.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)

COL = {
    'Fabric': (0.25, 0.27, 0.30), 'Leather': (0.30, 0.18, 0.12), 'Wood': (0.55, 0.38, 0.22), 'Laminate': (0.85, 0.83, 0.80),
    'Metal': (0.10, 0.10, 0.11), 'Chrome': (0.80, 0.80, 0.82), 'Plastic': (0.08, 0.08, 0.09),
}


def material(name):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*COL[name], 1)
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


def box(size, loc, mat, bevel=0.0, seg=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.active_object
    o.data.transform(__import__('mathutils').Matrix.Diagonal((*size, 1)))
    finish(o, mat, bevel, seg)
    o.rotation_euler = rot
    o.location = loc
    return o


def cyl(r, depth, loc, mat, verts=20, rot=(0, 0, 0), bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(0, 0, 0))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=(0, 0, 0))
    o = bpy.context.active_object
    finish(o, mat, bevel, 2)
    o.rotation_euler = rot
    o.location = loc
    return o


def model(name, parts):
    """Gabungkan bagian jadi satu objek bernama `name` (slot material tetap)."""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    # pivot di lantai, tengah
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


# ------------------------------------------------------------------ dasar kursi beroda (bintang 5)
def star_base(mat_spoke='Metal', radius=0.30, hub_z=0.10):
    parts = [cyl(0.05, 0.05, (0, 0, hub_z), 'Plastic', 12)]
    for k in range(5):
        a = k * 2 * math.pi / 5
        cx, cy = math.sin(a) * radius / 2, -math.cos(a) * radius / 2
        parts.append(box((0.045, radius, 0.034), (cx, cy, hub_z - 0.012), mat_spoke, 0.008, 1, rot=(-0.10, 0, a)))
        ex, ey = math.sin(a) * radius, -math.cos(a) * radius
        parts.append(box((0.034, 0.05, 0.03), (ex, ey, 0.068), 'Plastic', 0, 1, rot=(0, 0, a)))
        # roda ganda
        for s in (-1, 1):
            ox, oy = math.cos(a) * 0.013 * s, math.sin(a) * 0.013 * s
            parts.append(cyl(0.027, 0.016, (ex + ox, ey + oy, 0.029), 'Plastic', 8, rot=(0, math.pi / 2, a)))
    parts.append(cyl(0.036, 0.12, (0, 0, 0.17), 'Plastic', 12, r2=0.03))   # selubung
    parts.append(cyl(0.023, 0.22, (0, 0, 0.26), 'Chrome', 12))             # gas lift
    return parts


# ------------------------------------------------------------------ kursi kerja (Chair_01/02/05/06)
def chair_office():
    p = star_base()
    p.append(box((0.20, 0.18, 0.05), (0, 0.02, 0.375), 'Metal', 0.01))            # mekanisme
    p.append(box((0.46, 0.44, 0.03), (0, 0.0, 0.405), 'Plastic', 0.012))           # dudukan keras
    p.append(box((0.50, 0.48, 0.085), (0, -0.01, 0.462), 'Fabric', 0.034, 3))       # bantal duduk
    # tulang punggung & braket
    p.append(box((0.05, 0.14, 0.03), (0, 0.19, 0.41), 'Metal', 0.008))
    p.append(box((0.055, 0.03, 0.34), (0, 0.255, 0.58), 'Metal', 0.008, rot=(0.12, 0, 0)))
    # sandaran: panel tengah + dua sayap menekuk ke depan (melengkung mengikuti punggung)
    p.append(box((0.34, 0.05, 0.56), (0, 0.27, 0.86), 'Fabric', 0.026, 3, rot=(0.10, 0, 0)))
    for s in (-1, 1):
        p.append(box((0.09, 0.05, 0.54), (s * 0.205, 0.245, 0.86), 'Fabric', 0.024, 3, rot=(0.10, 0, -s * 0.42)))
    p.append(box((0.30, 0.03, 0.10), (0, 0.24, 0.66), 'Plastic', 0.012, rot=(0.10, 0, 0)))  # penyangga lumbar
    # sandaran tangan
    for s in (-1, 1):
        p.append(box((0.03, 0.05, 0.05), (s * 0.235, 0.03, 0.43), 'Metal', 0.006))
        p.append(box((0.034, 0.05, 0.22), (s * 0.268, 0.03, 0.56), 'Plastic', 0.01))
        p.append(box((0.07, 0.25, 0.035), (s * 0.268, 0.0, 0.685), 'Plastic', 0.015, 3))
    return model('chair_office', p)


# ------------------------------------------------------------------ kursi direktur kulit (Chair_08/10)
def chair_exec():
    p = star_base('Chrome', 0.33)
    p.append(box((0.22, 0.20, 0.05), (0, 0.02, 0.38), 'Metal', 0.01))
    p.append(box((0.56, 0.52, 0.11), (0, -0.01, 0.47), 'Leather', 0.045, 3))
    # cangkang belakang + tiga bantal bertingkat + sandaran kepala
    p.append(box((0.54, 0.05, 0.86), (0, 0.33, 0.95), 'Leather', 0.03, 3, rot=(0.12, 0, 0)))
    for i, z in enumerate((0.66, 0.91, 1.16)):
        p.append(box((0.50, 0.10, 0.26), (0, 0.285 + i * 0.03, z), 'Leather', 0.045, 3, rot=(0.12, 0, 0)))
    p.append(box((0.42, 0.09, 0.16), (0, 0.38, 1.36), 'Leather', 0.04, 3, rot=(0.12, 0, 0)))
    for s in (-1, 1):
        p.append(box((0.025, 0.04, 0.2), (s * 0.31, 0.04, 0.55), 'Chrome', 0.006))
        p.append(box((0.085, 0.32, 0.06), (s * 0.31, 0.0, 0.68), 'Leather', 0.025, 3))
    return model('chair_exec', p)


# ------------------------------------------------------------------ kursi rapat berlapis (lainnya)
def chair_meeting():
    p = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl(0.016, 0.44, (sx * 0.2, sy * 0.19, 0.21), 'Chrome', 12, rot=(sy * 0.06, -sx * 0.06, 0), r2=0.011))
    p.append(box((0.44, 0.42, 0.03), (0, 0, 0.415), 'Metal', 0.008))
    p.append(box((0.48, 0.47, 0.08), (0, -0.01, 0.465), 'Leather', 0.032, 4))
    for s in (-1, 1):
        p.append(box((0.02, 0.03, 0.30), (s * 0.17, 0.235, 0.56), 'Chrome', 0.005, rot=(0.14, 0, 0)))
    p.append(box((0.46, 0.06, 0.40), (0, 0.255, 0.76), 'Leather', 0.03, 4, rot=(0.14, 0, 0)))
    return model('chair_meeting', p)


# ------------------------------------------------------------------ meja kerja (rangka besi, panel modesti)
def desk(w, d, name):
    p = [box((w, d, 0.03), (0, 0, 0.735), 'Wood', 0.005, 2)]
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.08)
        for sy in (-1, 1):
            p.append(box((0.05, 0.05, 0.69), (x, sy * (d / 2 - 0.08), 0.365), 'Metal', 0.006))
            p.append(cyl(0.02, 0.012, (x, sy * (d / 2 - 0.08), 0.006), 'Plastic', 12))
        p.append(box((0.05, d - 0.08, 0.045), (x, 0, 0.04), 'Metal', 0.006))
        p.append(box((0.05, d - 0.12, 0.04), (x, 0, 0.70), 'Metal', 0.006))
    p.append(box((w - 0.21, 0.04, 0.06), (0, d / 2 - 0.1, 0.665), 'Metal', 0.006))
    p.append(box((w - 0.24, 0.015, 0.38), (0, d / 2 - 0.09, 0.44), 'Laminate', 0.004))
    return model(name, p)


# ------------------------------------------------------------------ meja rapat besar (Table_Conference)
def table_conference(w=4.4, d=1.4, r=0.32):
    import bmesh
    me = bpy.data.meshes.new('tc')
    bm = bmesh.new()
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for k in range(9):
            a = math.radians(a0 + k * 90 / 8)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    bottom = [bm.verts.new((x, y, 0.705)) for x, y in pts]
    top = [bm.verts.new((x, y, 0.75)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bottom)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('tc', me)
    bpy.context.collection.objects.link(o)
    finish(o, 'Wood', 0.008, 2)
    p = [o]
    for sx in (-1, 1):
        x = sx * 1.3
        p.append(box((0.34, 0.9, 0.02), (x, 0, 0.695), 'Metal', 0.004))
        p.append(box((0.16, 0.56, 0.66), (x, 0, 0.36), 'Metal', 0.012))
        p.append(box((0.26, 0.86, 0.03), (x, 0, 0.015), 'Metal', 0.008))
    return model('table_conference', p)


def table_small(w=1.2, d=0.75):
    p = [box((w, d, 0.035), (0, 0, 0.7325), 'Wood', 0.006, 2)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl(0.028, 0.715, (sx * (w / 2 - 0.06), sy * (d / 2 - 0.06), 0.3575), 'Wood', 12, r2=0.02))
    for sy in (-1, 1):
        p.append(box((w - 0.16, 0.02, 0.07), (0, sy * (d / 2 - 0.06), 0.68), 'Wood', 0.004))
    for sx in (-1, 1):
        p.append(box((0.02, d - 0.16, 0.07), (sx * (w / 2 - 0.06), 0, 0.68), 'Wood', 0.004))
    return model('table_small', p)


def table_round(r=0.45):
    p = [cyl(r, 0.03, (0, 0, 0.735), 'Wood', 40, bevel=0.006)]
    p.append(cyl(0.035, 0.69, (0, 0, 0.375), 'Metal', 16))
    p.append(cyl(0.24, 0.025, (0, 0, 0.0125), 'Metal', 32, bevel=0.006))
    return model('table_round', p)


def table_coffee(w=1.1, d=0.6):
    # puncak 0,50 m: tinggi tempat majalah/cangkir di layout (ikut model Synty)
    p = [box((w, d, 0.04), (0, 0, 0.48), 'Wood', 0.01, 2)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(box((0.03, 0.03, 0.46), (sx * (w / 2 - 0.05), sy * (d / 2 - 0.05), 0.23), 'Metal', 0.004))
    p.append(box((w - 0.12, d - 0.12, 0.018), (0, 0, 0.14), 'Wood', 0.004))
    return model('table_coffee', p)


chair_office()
chair_exec()
chair_meeting()
desk(1.5, 0.75, 'desk_150x75')
desk(1.6, 0.8, 'desk_160x80')
desk(1.8, 0.75, 'desk_180x75')
table_conference()
table_small()
table_round()
table_coffee()

for o in bpy.data.objects:
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    dims = tuple(round(v, 3) for v in o.dimensions)
    print(f'MODEL {o.name}: {tris} tris, dims {dims}')

if len(argv) > 1:
    import mathutils
    scene = bpy.context.scene
    x = 0.0
    objs = sorted(bpy.data.objects, key=lambda o: o.name)
    for o in objs:
        o.location.x = x + o.dimensions.x / 2
        x += o.dimensions.x + 0.35
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.location = (x / 2, -7.5, 3.2)
    cam.rotation_euler = (math.radians(70), 0, 0)
    cam.data.lens = 26
    scene.camera = cam
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 1800, 700
    scene.render.filepath = argv[1]
    bpy.ops.render.render(write_still=True)
    for o in objs:
        o.location.x = 0
    bpy.data.objects.remove(cam)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_texcoords=True, export_normals=True)
print('WROTE', OUT)
