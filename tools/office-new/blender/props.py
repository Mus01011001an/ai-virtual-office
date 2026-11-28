# Prop Office Baru dari Blender (bpy): lobi (meja resepsionis, sofa, kursi lounge, meja kopi, patung, lampu gantung),
# tanaman berdaun asli, perangkat meja (monitor, keyboard, mouse, PC), lemari arsip, kulkas, dispenser.
# Semua buatan sendiri (CC0 milik project). Dibangun lewat build.py.
import math

from lib import box, cyl, leaf, model, prism, rng, rounded_rect, screen, sphere, stadium, torus


# ------------------------------------------------------------------ lobi
def reception_desk(W=3.6, D=1.0):
    """Konter tamu berbentuk stadion: bilah kayu vertikal, puncak batu, garis LED di bawah puncak & di kaki (melayang)."""
    p = []
    fd = 0.44
    y0 = -D / 2
    cy = y0 + fd / 2
    p.append(prism(stadium(W - 0.12, fd - 0.12, 0, cy), 0.0, 0.085, 'Metal', name='plinth'))
    p.append(prism(stadium(W - 0.09, fd - 0.09, 0, cy), 0.085, 0.097, 'Glow', name='glow_low'))
    p.append(prism(stadium(W, fd, 0, cy), 0.097, 1.03, 'WoodDark', bevel=0.004, name='body'))
    p.append(prism(stadium(W + 0.012, fd + 0.012, 0, cy), 1.03, 1.042, 'Glow', name='glow_top'))
    p.append(prism(stadium(W + 0.07, fd + 0.07, 0, cy, 14), 1.042, 1.09, 'Stone', bevel=0.008, seg=3, name='top'))
    r = fd / 2
    sw, sd, gap, sh = 0.032, 0.022, 0.07, 0.9
    x = -W / 2 + r + 0.035
    while x < W / 2 - r - 0.02:
        p.append(box((sw, sd, sh), (x, y0 - sd / 2 + 0.004, 0.565), 'Wood', 0.004, 1))
        x += gap
    for sx in (-1, 1):
        cx = sx * (W / 2 - r)
        n = int(math.pi * r / gap)
        rr = r + sd / 2 - 0.004
        for k in range(1, n):
            a = -math.pi / 2 + math.pi * k / n
            nx, ny = sx * math.cos(a), math.sin(a)
            p.append(box((sw, sd, sh), (cx + nx * rr, cy + ny * rr, 0.565), 'Wood', 0.004, 1, rot=(0, 0, math.atan2(-nx, ny))))
    # meja kerja resepsionis di belakang konter
    p.append(box((W - 0.5, 0.56, 0.03), (0, y0 + fd + 0.27, 0.735), 'Laminate', 0.004))
    for sx in (-1, 1):
        p.append(box((0.04, 0.54, 0.72), (sx * (W / 2 - 0.27), y0 + fd + 0.27, 0.36), 'WoodDark', 0.004))
    return model('reception_desk', p)


def sofa_3(W=2.25, D=0.92):
    p = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl(0.022, 0.13, (sx * (W / 2 - 0.12), sy * (D / 2 - 0.12), 0.065), 'Wood', 12, r2=0.016))
    p.append(box((W - 0.02, D - 0.04, 0.17), (0, 0, 0.215), 'Fabric', 0.03, 3))
    aw = 0.17
    for sx in (-1, 1):
        p.append(box((aw, D, 0.50), (sx * (W / 2 - aw / 2), 0, 0.38), 'Fabric', 0.055, 4))
    p.append(box((W - 0.04, 0.2, 0.56), (0, D / 2 - 0.1, 0.41), 'Fabric', 0.05, 4))
    inner = W - 2 * aw
    cw = inner / 3
    for i in range(3):
        x = -inner / 2 + cw / 2 + i * cw
        p.append(box((cw - 0.012, D - 0.26, 0.15), (x, -0.1, 0.375), 'Fabric', 0.05, 4))
        p.append(box((cw - 0.02, 0.2, 0.44), (x, D / 2 - 0.27, 0.66), 'Fabric', 0.07, 4, rot=(-0.2, 0, 0)))
    for sx in (-1, 1):
        p.append(box((0.42, 0.13, 0.40), (sx * (inner / 2 - 0.26), D / 2 - 0.42, 0.62), 'Fabric2', 0.06, 4, rot=(-0.25, 0, sx * 0.35)))
    return model('sofa_3', p)


def armchair(W=0.8, D=0.82):
    p = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl(0.02, 0.17, (sx * (W / 2 - 0.09), sy * (D / 2 - 0.09), 0.085), 'Wood', 12, r2=0.014, rot=(sy * 0.12, -sx * 0.12, 0)))
    p.append(box((W, D - 0.02, 0.16), (0, 0, 0.24), 'Fabric', 0.04, 3))
    for sx in (-1, 1):
        p.append(box((0.12, D - 0.04, 0.30), (sx * (W / 2 - 0.06), 0, 0.45), 'Fabric', 0.05, 4))
    p.append(box((W - 0.02, 0.16, 0.50), (0, D / 2 - 0.1, 0.55), 'Fabric', 0.06, 4, rot=(-0.18, 0, 0)))
    p.append(box((W - 0.26, D - 0.24, 0.13), (0, -0.07, 0.385), 'Fabric', 0.05, 4))
    return model('armchair', p)


def coffee_round(R=0.47, H=0.42):
    p = [cyl(R, 0.035, (0, 0, H - 0.0175), 'Stone', 48, bevel=0.01)]
    p.append(cyl(0.30, H - 0.035, (0, 0, (H - 0.035) / 2), 'Metal', 40, r2=0.26))
    return model('coffee_round', p)


def side_table(R=0.24, H=0.55):
    p = [cyl(R, 0.03, (0, 0, H - 0.015), 'Stone', 40, bevel=0.008)]
    p.append(cyl(0.018, H - 0.05, (0, 0, (H - 0.03) / 2 + 0.01), 'Brass', 16))
    p.append(cyl(0.17, 0.02, (0, 0, 0.01), 'Brass', 32, bevel=0.005))
    return model('side_table', p)


def sculpture_rings():
    p = []
    for k, (rx, ry) in enumerate([(0, 0), (math.pi / 2, 0.6), (0.9, -0.8)]):
        p.append(torus(0.26 - k * 0.03, 0.022, (0, 0, 0.34), 'Brass', rot=(rx, ry, k * 0.7)))
    p.append(cyl(0.05, 0.08, (0, 0, 0.04), 'Metal', 16))
    return model('sculpture_rings', p)


def pendant_ring(R=0.75, drop=0.55):
    """Cincin cahaya besar (pusat di plafon, menggantung ke -Z)."""
    p = []
    for k in range(3):
        a = k * 2 * math.pi / 3
        p.append(cyl(0.0025, drop, (math.cos(a) * R, math.sin(a) * R, -drop / 2), 'Metal', 4))
        p.append(cyl(0.03, 0.012, (math.cos(a) * R, math.sin(a) * R, -0.006), 'Brass', 12))
    p.append(torus(R, 0.035, (0, 0, -drop), 'Brass', seg=72, ring=10))
    p.append(torus(R, 0.016, (0, 0, -drop - 0.03), 'Glow', seg=72, ring=8))
    return model('pendant_ring', p)


def pendant_dome(R=0.2, drop=0.75):
    p = [cyl(0.003, drop, (0, 0, -drop / 2), 'Metal', 6)]
    p.append(cyl(0.05, 0.02, (0, 0, -0.01), 'Metal', 20))
    p.append(cyl(0.03, 0.05, (0, 0, -drop + 0.02), 'Brass', 16))
    p.append(cyl(R, 0.24, (0, 0, -drop - 0.12), 'Metal', 32, r2=0.06, bevel=0.004))
    p.append(cyl(R - 0.012, 0.004, (0, 0, -drop - 0.243), 'Glow', 32))
    return model('pendant_dome', p)


# ------------------------------------------------------------------ tanaman
def pot_round(rb, rt, h, mat='Pot'):
    return [cyl(rb, h, (0, 0, h / 2), mat, 32, r2=rt, bevel=0.008), torus(rt - 0.008, 0.012, (0, 0, h), mat, seg=32, ring=6),
            cyl(rt - 0.016, 0.01, (0, 0, h - 0.002), 'Soil', 24)]


def plant_tall(seed=3):
    """Fiddle leaf fig ±1,9 m: tiga batang, daun besar mengilap."""
    R = rng(seed)
    p = pot_round(0.22, 0.27, 0.5)
    tops = []
    for k in range(3):
        a = k * 2.1 + 0.3
        lean = 0.09 + 0.05 * k
        h = 1.0 + 0.22 * k
        tx, ty = math.cos(a) * lean, math.sin(a) * lean
        tilt = math.atan2(lean, h)
        p.append(cyl(0.02, h, (tx / 2, ty / 2, 0.5 + h / 2), 'Trunk', 8, rot=(-math.sin(a) * tilt, math.cos(a) * tilt, 0), r2=0.011))
        tops.append((tx, ty, 0.5 + h))
    for tx, ty, tz in tops:
        for i in range(17):
            f = R.uniform(0.35, 1.0)
            z = 0.5 + (tz - 0.5) * f
            L = R.uniform(0.2, 0.3)
            p.append(leaf(L, L * 0.66, 'Leaf' if R.random() > 0.2 else 'Leaf2', (tx * f, ty * f, z), R.uniform(0, 6.28),
                          R.uniform(-0.1, 0.8) + (0.5 if f > 0.95 else 0), R.uniform(-0.4, 0.4), bend=0.3, fold=0.14))
    return model('plant_tall', p)


def plant_snake(seed=5):
    """Sansevieria ±0,95 m di pot kotak."""
    R = rng(seed)
    p = [box((0.30, 0.30, 0.34), (0, 0, 0.17), 'Pot', 0.02, 2), box((0.26, 0.26, 0.012), (0, 0, 0.343), 'Soil')]
    for i in range(16):
        a = R.uniform(0, 2 * math.pi)
        rr = R.uniform(0, 0.08)
        L = R.uniform(0.42, 0.72)
        p.append(leaf(L, R.uniform(0.05, 0.075), 'Leaf' if i % 3 else 'Leaf2', (math.cos(a) * rr, math.sin(a) * rr, 0.34),
                      a + R.uniform(-0.6, 0.6), math.pi / 2 - R.uniform(0.04, 0.3), R.uniform(-0.3, 0.3), bend=0.04, fold=0.3, shape='blade'))
    return model('plant_snake', p)


def plant_bush(seed=7):
    """Tanaman daun rimbun ±0,85 m (pot bulat)."""
    R = rng(seed)
    p = pot_round(0.17, 0.2, 0.36)
    for i in range(72):
        a = R.uniform(0, 2 * math.pi)
        rr = R.uniform(0, 0.11)
        z = 0.36 + R.uniform(0.02, 0.42)
        L = R.uniform(0.13, 0.2)
        p.append(leaf(L, L * 0.55, 'Leaf' if i % 4 else 'Leaf2', (math.cos(a) * rr, math.sin(a) * rr, z), a,
                      R.uniform(-0.2, 0.9), R.uniform(-0.5, 0.5), bend=0.35, fold=0.12))
    return model('plant_bush', p)


def plant_desk(seed=9):
    R = rng(seed)
    p = pot_round(0.055, 0.065, 0.09)
    for i in range(18):
        a = i * 2.4 + R.uniform(-0.2, 0.2)
        L = R.uniform(0.06, 0.09)
        p.append(leaf(L, L * 0.7, 'Leaf' if i % 3 else 'Leaf2', (math.cos(a) * 0.015, math.sin(a) * 0.015, 0.093), a,
                      R.uniform(0.1, 0.9), 0, bend=0.3, fold=0.15))
    return model('plant_desk', p)


# ------------------------------------------------------------------ perangkat meja
def monitor():
    p = [prism(rounded_rect(0.22, 0.16, 0.03, 0, 0.02), 0.0, 0.012, 'Metal', bevel=0.004, name='base')]
    p.append(box((0.045, 0.018, 0.21), (0, 0.045, 0.115), 'Metal', 0.006, rot=(0.08, 0, 0)))
    p.append(box((0.556, 0.014, 0.33), (0, 0, 0.295), 'Plastic', 0.004))
    p.append(box((0.30, 0.03, 0.18), (0, 0.022, 0.28), 'Plastic', 0.012))
    p.append(screen(0.538, 0.302, (0, -0.010, 0.299)))
    return model('monitor', p)


def keyboard():
    tilt = 0.05
    p = [box((0.44, 0.14, 0.014), (0, 0, 0.009), 'Metal', 0.004, rot=(tilt, 0, 0))]
    for row in range(5):
        y = -0.048 + row * 0.024
        z = 0.0195 + y * tilt
        if row == 0:
            keys = [0.03, 0.03, 0.03, 0.15, 0.03, 0.03, 0.03, 0.03]
        else:
            keys = [0.022] * 16
        total = sum(keys) + 0.004 * (len(keys) - 1)
        x = -total / 2
        for kw in keys:
            p.append(box((kw, 0.019, 0.007), (x + kw / 2, y, z), 'Keys'))
            x += kw + 0.004
    return model('keyboard', p)


def mouse():
    return model('mouse', [sphere(0.5, (0, 0, 0.012), 'Plastic', scale=(0.062, 0.105, 0.036), segs=14, rings=7)])


def pc_tower():
    p = [box((0.2, 0.45, 0.45), (0, 0, 0.225), 'Plastic', 0.01, 2)]
    p.append(box((0.17, 0.006, 0.40), (0, -0.226, 0.225), 'Metal', 0.002))
    p.append(box((0.006, 0.004, 0.30), (0.07, -0.230, 0.225), 'GlowBlue'))
    return model('pc_tower', p)


# ------------------------------------------------------------------ lemari & dapur
def cabinet(h, drawers, name, W=0.45, D=0.6):
    p = [box((W, D, h), (0, 0, h / 2), 'Laminate', 0.006)]
    dh = (h - 0.06) / drawers
    for i in range(drawers):
        z = 0.04 + dh * i + dh / 2
        p.append(box((W - 0.03, 0.012, dh - 0.014), (0, -D / 2 - 0.004, z), 'Laminate', 0.003))
        p.append(box((0.14, 0.022, 0.014), (0, -D / 2 - 0.02, z + dh * 0.25), 'Metal', 0.004))
    return model(name, p)


def fridge(W=0.85, D=0.72, H=1.9):
    p = [box((W, D, H), (0, 0, H / 2), 'Steel', 0.015, 2)]
    p.append(box((W - 0.02, 0.02, 0.6), (0, -D / 2 - 0.006, 0.37), 'Steel', 0.006))
    for sx in (-1, 1):
        p.append(box((W / 2 - 0.014, 0.02, 1.17), (sx * (W / 4 + 0.002), -D / 2 - 0.006, 1.27), 'Steel', 0.006))
        p.append(cyl(0.012, 0.55, (sx * 0.035, -D / 2 - 0.05, 1.25), 'Metal', 12))
        for z in (0.98, 1.52):
            p.append(box((0.02, 0.05, 0.02), (sx * 0.035, -D / 2 - 0.03, z), 'Metal', 0.004))
    p.append(box((0.5, 0.05, 0.02), (0, -D / 2 - 0.035, 0.6), 'Metal', 0.006))
    return model('fridge', p)


def water_cooler():
    p = [box((0.32, 0.32, 1.0), (0, 0, 0.5), 'Laminate', 0.02, 2)]
    p.append(box((0.2, 0.02, 0.24), (0, -0.157, 0.82), 'Plastic', 0.006))
    for sx, c in ((-1, 'Metal'), (1, 'Metal')):
        p.append(cyl(0.012, 0.04, (sx * 0.05, -0.18, 0.82), c, 10, rot=(math.pi / 2, 0, 0)))
    p.append(box((0.18, 0.12, 0.012), (0, -0.2, 0.71), 'Plastic', 0.004))
    p.append(cyl(0.135, 0.36, (0, 0, 1.2), 'Glass', 24, bevel=0.03))
    p.append(cyl(0.045, 0.06, (0, 0, 1.03), 'Glass', 16))
    return model('water_cooler', p)


def build():
    reception_desk()
    sofa_3()
    armchair()
    coffee_round()
    side_table()
    sculpture_rings()
    pendant_ring()
    pendant_dome()
    plant_tall()
    plant_snake()
    plant_bush()
    plant_desk()
    monitor()
    keyboard()
    mouse()
    pc_tower()
    cabinet(1.3, 4, 'cabinet_tall')
    cabinet(0.75, 2, 'cabinet_low')
    fridge()
    water_cooler()
