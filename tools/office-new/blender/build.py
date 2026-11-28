# Bangun semua model kit Office Baru (furniture.py + props.py) jadi satu GLB.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#     --python tools/office-new/blender/build.py -- frontend/public/office-new/kit/furniture.glb [preview.png]
#
# Argumen kedua (opsional): render pratinjau model (Workbench) untuk dicek sebelum dipakai; argumen ketiga (opsional):
# nama model dipisah koma = hanya model itu yang dirender (dekat).
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import furniture  # noqa: E402
import lib  # noqa: E402
import props  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'furniture.glb'

lib.reset()
furniture.build()
props.build()

for o in sorted(bpy.data.objects, key=lambda o: o.name):
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    print(f'MODEL {o.name}: {tris} tris, dims {tuple(round(v, 3) for v in o.dimensions)}')

if len(argv) > 1:
    scene = bpy.context.scene
    only = set(argv[2].split(',')) if len(argv) > 2 else None
    objs = sorted((o for o in bpy.data.objects if not only or o.name in only), key=lambda o: o.name)
    for o in bpy.data.objects:
        o.hide_render = o not in objs
    cols, cell = (6, 2.6) if not only else (len(objs), 1.2)
    for i, o in enumerate(objs):
        o.location = ((i % cols) * cell, (i // cols) * cell * 0.9, 0)
        if o.name.startswith('pendant'):
            o.location.z = 1.6
    rows = (len(objs) + cols - 1) // cols
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = cols * cell + 0.6 if not only else cols * cell + 0.3
    cam.location = ((cols - 1) * cell / 2, -9 + rows * 0.0, 7.5) if not only else ((cols - 1) * cell / 2, -4, 3.2)
    cam.rotation_euler = (math.radians(58 if not only else 62), 0, 0)
    cam.location.y += (rows - 1) * cell * 0.45
    scene.camera = cam
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.display.shading.show_shadows = True
    scene.render.resolution_x, scene.render.resolution_y = (2400, 1700) if not only else (1400, 900)
    scene.render.filepath = argv[1]
    bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        o.location = (0, 0, 0)
        o.hide_render = False
    bpy.data.objects.remove(cam)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_texcoords=True, export_normals=True)
print('WROTE', OUT)
