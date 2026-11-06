import * as THREE from 'three'
import { Batcher } from './batch'
import { buildItem, footprint, SPECS } from './furniture'
import { BOUNDS, BUILDING, EAST_ROOF, ITEMS, MEZZ_Y, MEZZANINE, RAMP, WALLS, WING_H, type WallSeg } from './layout'

export interface ColliderDesc { pos: [number, number, number]; half: [number, number, number]; rotZ?: number; glass?: boolean }
export interface Rect { x0: number; z0: number; x1: number; z1: number }

const RAMP_LEN = Math.hypot(RAMP.xLow - RAMP.xHigh, MEZZ_Y)
const RAMP_ANG = Math.atan2(MEZZ_Y, RAMP.xLow - RAMP.xHigh)
const RAMP_CX = (RAMP.xLow + RAMP.xHigh) / 2

function wallBox(w: WallSeg) {
  const t = w.t ?? (w.kind === 'glass' ? 0.12 : 0.2)
  const alongX = w.a[1] === w.b[1]
  const len = alongX ? Math.abs(w.b[0] - w.a[0]) : Math.abs(w.b[1] - w.a[1])
  const cx = (w.a[0] + w.b[0]) / 2, cz = (w.a[1] + w.b[1]) / 2
  const y0 = w.y0 ?? 0
  return { alongX, len, cx, cz, y0, t, sx: alongX ? len : t, sz: alongX ? t : len }
}

// ---------------- VISUAL ----------------
function buildWall(b: Batcher, w: WallSeg) {
  const { alongX, len, cx, cz, y0, t } = wallBox(w)
  const yaw = alongX ? 0 : Math.PI / 2
  b.push(cx, y0, cz, yaw)
  switch (w.kind) {
    case 'ext': b.box('ext', len, w.h, t, 0, w.h / 2, 0); b.box('wallAccent', len, 0.12, t + 0.02, 0, 0.06, 0); break
    case 'solid':
      b.box('wall', len, w.h, t, 0, w.h / 2, 0); b.box('wallAccent', len, 0.1, t + 0.02, 0, 0.05, 0)
      b.box('ledWarm', len, 0.015, t + 0.03, 0, 0.11, 0)
      break
    case 'extGlass': {
      const base = y0 > 0 ? 0 : 0.5
      if (base) b.box('ext', len, base, t, 0, base / 2, 0)
      b.box('glass', len, w.h - base - 0.4, 0.03, 0, base + (w.h - base - 0.4) / 2, 0)
      b.box('ext', len, 0.4, t, 0, w.h - 0.2, 0)
      for (const hy of [4.2 - y0, 9 - y0]) if (hy > 0.3 && hy < w.h - 0.4) b.box('steel', len, 0.1, t * 0.6, 0, hy, 0)
      const n = Math.max(1, Math.round(len / 3))
      for (let i = 0; i <= n; i++) b.box('steel', 0.09, w.h, t * 0.7, -len / 2 + (len / n) * i, w.h / 2, 0)
      break
    }
    case 'glass': {
      b.box('glass', len, w.h - 0.1, 0.02, 0, (w.h - 0.1) / 2, 0)
      b.box('steel', len, 0.06, t, 0, 0.03, 0); b.box('steel', len, 0.08, t, 0, w.h - 0.04, 0)
      // bingkai kaca bercahaya (ruang kaca seperti referensi)
      b.box('ledWarm', len, 0.02, t + 0.02, 0, 0.07, 0); b.box('ledWarm', len, 0.02, t + 0.02, 0, w.h - 0.09, 0)
      const n = Math.max(1, Math.round(len / 2.2))
      for (let i = 0; i <= n; i++) b.box('steel', 0.05, w.h, t, -len / 2 + (len / n) * i, w.h / 2, 0)
      break
    }
    case 'rail': {
      b.box('railGlass', len, w.h - 0.1, 0.02, 0, (w.h - 0.1) / 2, 0)
      b.cyl('chrome', 0.03, 0.03, len, 0, w.h, 0, 10, [0, 0, Math.PI / 2])
      break
    }
  }
  b.pop()
}

function buildRamp(b: Batcher) {
  const steps = 18
  const run = (RAMP.xLow - RAMP.xHigh) / steps
  const zc = (RAMP.z0 + RAMP.z1) / 2, zw = RAMP.z1 - RAMP.z0
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) * MEZZ_Y) / steps
    const x = RAMP.xLow - run * (i + 0.5)
    b.boxB('woodDeep', run, h - 0.03, zw, x, 0, zc)
    b.boxB('wood', run + 0.02, 0.03, zw, x, h - 0.03, zc)
    b.box('ledWarm', 0.015, 0.012, zw - 0.1, x + run / 2 + 0.005, h - 0.05, zc)
  }
  for (const z of [RAMP.z0 + 0.05, RAMP.z1 - 0.05]) {
    b.add('railGlass', boxGeo(RAMP_LEN, 1.0, 0.02), [RAMP_CX, MEZZ_Y / 2 + 0.55, z], [0, 0, -RAMP_ANG])
    b.add('chrome', cylGeo(0.03, RAMP_LEN), [RAMP_CX, MEZZ_Y / 2 + 1.08, z], [0, 0, Math.PI / 2 - RAMP_ANG])
  }
}

const boxGeo = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cylGeo = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 10)

function buildCeilingAndRoof(b: Batcher) {
  const { x0, x1, z0, z1, height: H } = BUILDING
  // roof dengan 3 skylight strip
  const strips = [[-15, -13], [-6, -4], [3, 5]]
  let z = z0
  for (const [s0, s1] of strips) {
    b.boxB('ceiling', x1 - x0, 0.4, s0 - z, 0, H, (z + s0) / 2)
    b.boxB('ceiling', -14 - x0, 0.4, s1 - s0, (x0 - 14) / 2, H, (s0 + s1) / 2)
    b.boxB('ceiling', x1 - 14, 0.4, s1 - s0, (14 + x1) / 2, H, (s0 + s1) / 2)
    b.plane('skylight', 28, s1 - s0, [0, H + 0.2, (s0 + s1) / 2], [Math.PI / 2, 0, 0])
    for (let x = -14; x <= 14; x += 2) b.box('steel', 0.06, 0.06, s1 - s0, x, H + 0.2, (s0 + s1) / 2)
    z = s1
  }
  b.boxB('ceiling', x1 - x0, 0.4, z1 - z, 0, H, (z + z1) / 2)
  // balok baja
  for (const x of [-24, -18, -12, -6, 0, 6, 12, 18, 24]) b.box('steel', 0.3, 0.6, z1 - z0, x, H - 0.3, 0)
  for (const zz of [-10, 0, 10]) b.box('steel', x1 - x0, 0.4, 0.25, 0, H - 0.5, zz)
  // plafon bilah kayu bergelombang (wavy slat ceiling) di atas workspace & kolaborasi
  for (let x = -15.4; x <= 15.4; x += 0.34) {
    for (let zz = -19.4; zz < 11.6; zz += 1.55) {
      const h = 0.25 + 0.95 * (0.5 + 0.5 * Math.sin(zz * 0.21 + x * 0.13) * Math.cos(x * 0.09))
      b.box('woodSlat', 0.07, h, 1.56, x, 12.6 - h / 2, zz + 0.775)
    }
  }
  b.boxB('woodDeep', 31.2, 0.05, 31.2, 0, 12.6, -4)
  // lampu gantung cincin (ring chandelier)
  const ring = (x: number, zz: number, y: number, radii: number[]) => {
    radii.forEach((rr, i) => {
      const yy = y + i * 0.55
      b.add('ledRing', new THREE.TorusGeometry(rr, 0.045, 8, 72), [x, yy, zz], [Math.PI / 2 + (i % 2 ? 0.1 : -0.08), 0, i * 0.15])
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + i
        b.cyl('black', 0.005, 0.005, 12.6 - yy, x + Math.cos(a) * rr, yy + (12.6 - yy) / 2, zz + Math.sin(a) * rr, 4)
      }
    })
  }
  ring(0, -11.75, 7.2, [2.4, 1.8, 1.2])
  ring(-9.5, -11.75, 7.9, [1.4, 0.95])
  ring(9.5, -11.75, 7.9, [1.4, 0.95])
  ring(0, 7.5, 6.6, [2.0, 1.5, 1.0])
  ring(-9, 16.5, 6.4, [1.5, 1.0])
  // pendant lights
  const pend = (x: number, zz: number, y = 9.2) => {
    b.cyl('black', 0.006, 0.006, H - y, x, y + (H - y) / 2, zz, 4)
    b.cyl('black', 0.32, 0.5, 0.35, x, y, zz, 20)
    b.cyl('lamp', 0.46, 0.46, 0.02, x, y - 0.17, zz, 20)
  }
  for (const zz of [-14, -4, 6]) pend(-23, zz, 9.5)
  for (const zz of [-14, -4, 6]) pend(23, zz, 9.5)
}

function buildWingLamps(b: Batcher) {
  for (const zc of [-14.5, -3.5, 7]) for (const xc of [-26, -20, 20, 26]) b.plane('lamp', 1.6, 0.6, [xc, WING_H - 0.01, zc], [Math.PI / 2, 0, 0])
  for (const xc of [-26, -20]) b.plane('lamp', 1.6, 0.6, [xc, MEZZ_Y - 0.31, 13.25], [Math.PI / 2, 0, 0])
}

function buildSlabs(b: Batcher) {
  for (const m of MEZZANINE) b.boxB('ceiling', m.x1 - m.x0, 0.3, m.z1 - m.z0, (m.x0 + m.x1) / 2, MEZZ_Y - 0.3, (m.z0 + m.z1) / 2)
  const e = EAST_ROOF
  b.boxB('ceiling', e.x1 - e.x0, 0.3, e.z1 - e.z0, (e.x0 + e.x1) / 2, WING_H, (e.z0 + e.z1) / 2)
  // green roof di atas sayap timur
  for (let x = 18; x <= 28; x += 3.3) for (const zz of [-17, -9.5, -2, 5.5]) {
    b.box('concrete', 2.6, 0.5, 1.2, x, WING_H + 0.55, zz)
    b.sphere('plant', 0.5, x - 0.6, WING_H + 0.95, zz, [1, 0.7, 1]); b.sphere('plantDark', 0.45, x + 0.6, WING_H + 0.95, zz, [1, 0.7, 1])
  }
  // fascia tepi mezzanine
  b.box('woodDark', 0.1, 0.3, 32, -15.95, MEZZ_Y - 0.15, -4)
  b.box('ledWarm', 0.03, 0.02, 32, -15.88, MEZZ_Y - 0.31, -4)
  b.box('ledWarm', 0.03, 0.02, 32, -15.88, MEZZ_Y + 0.02, -4)
}

function buildEntrance(b: Batcher) {
  b.box('steel', 0.2, 4.2, 0.4, -3.05, 2.1, 20); b.box('steel', 0.2, 4.2, 0.4, 3.05, 2.1, 20); b.box('steel', 6.3, 0.2, 0.4, 0, 4.2, 20)
  // pintu geser terbuka
  b.box('glass', 1.5, 4.0, 0.03, -3.9, 2.0, 19.75); b.box('glass', 1.5, 4.0, 0.03, 3.9, 2.0, 19.75)
  // kanopi
  b.boxB('ext', 10, 0.3, 4, 0, 4.6, 22); b.plane('lamp', 6, 0.3, [0, 4.59, 22], [Math.PI / 2, 0, 0])
  b.box('#26303d', 4, 0.02, 2, 0, 0.012, 21.2)
  b.box('#26303d', 4, 0.02, 2, 0, 0.012, 18.8)
  // dinding utara: batu gelap + panel bilah kayu di tengah + LED vertikal (seperti referensi)
  b.box('stoneDark', 31.8, 12.4, 0.05, 0, 6.3, -19.72)
  b.box('woodDeep', 14, 11, 0.06, 0, 7.5, -19.68)
  for (let x = -6.8; x <= 6.8; x += 0.4) b.box('woodSlat', 0.12, 11, 0.06, x, 7.5, -19.62)
  for (const x of [-7.25, 7.25, -15.6, 15.6]) b.box('ledWarm', 0.04, 11, 0.04, x, 7.5, -19.62)
  b.box('ledWarm', 14.5, 0.04, 0.04, 0, 13.02, -19.62)
}

/** main = semua yang selalu terlihat; upper = atap/plafon atrium (disembunyikan di mode isometric → cutaway). */
export function buildStatic() {
  const b = new Batcher(), up = new Batcher()
  WALLS.forEach((w) => buildWall(b, w))
  buildRamp(b)
  buildCeilingAndRoof(up)
  buildSlabs(b)
  buildWingLamps(b)
  buildEntrance(b)
  ITEMS.filter((it) => it.type !== 'chair').forEach((it) => buildItem(b, it))
  return { main: b.build(), upper: up.build() }
}

// ---------------- COLLIDERS ----------------
export function buildColliders(): ColliderDesc[] {
  const out: ColliderDesc[] = []
  for (const w of WALLS) {
    const { cx, cz, y0, sx, sz } = wallBox(w)
    out.push({ pos: [cx, y0 + w.h / 2, cz], half: [sx / 2, w.h / 2, sz / 2], glass: w.kind !== 'solid' && w.kind !== 'ext' })
  }
  for (const m of [...MEZZANINE]) out.push({ pos: [(m.x0 + m.x1) / 2, MEZZ_Y - 0.15, (m.z0 + m.z1) / 2], half: [(m.x1 - m.x0) / 2, 0.15, (m.z1 - m.z0) / 2] })
  const e = EAST_ROOF
  out.push({ pos: [(e.x0 + e.x1) / 2, WING_H + 0.15, (e.z0 + e.z1) / 2], half: [(e.x1 - e.x0) / 2, 0.15, (e.z1 - e.z0) / 2] })
  // ramp + rails (miring)
  const zc = (RAMP.z0 + RAMP.z1) / 2
  const nx = Math.sin(RAMP_ANG), ny = Math.cos(RAMP_ANG)
  out.push({ pos: [RAMP_CX - 0.1 * nx, MEZZ_Y / 2 - 0.1 * ny, zc], half: [RAMP_LEN / 2 + 0.1, 0.1, (RAMP.z1 - RAMP.z0) / 2], rotZ: -RAMP_ANG })
  for (const z of [RAMP.z0 + 0.05, RAMP.z1 - 0.05]) out.push({ pos: [RAMP_CX, MEZZ_Y / 2 + 0.55, z], half: [RAMP_LEN / 2, 0.55, 0.05], rotZ: -RAMP_ANG, glass: true })
  // blok di bawah tangga (agar tidak bisa masuk kolong)
  out.push({ pos: [RAMP_CX, 0.6, zc], half: [(RAMP.xLow - RAMP.xHigh) / 2 - 1.5, 0.6, (RAMP.z1 - RAMP.z0) / 2 - 0.1] })
  for (const it of ITEMS) {
    const s = SPECS[it.type]
    if (!s.collide) continue
    const f = footprint(it)
    out.push({ pos: [(f.x0 + f.x1) / 2, (it.y ?? 0) + s.h / 2, (f.z0 + f.z1) / 2], half: [(f.x1 - f.x0) / 2, s.h / 2, (f.z1 - f.z0) / 2] })
  }
  // batas area luar (tak terlihat)
  const { x0, x1, z0, z1 } = BOUNDS
  out.push({ pos: [x0, 3, (z0 + z1) / 2], half: [0.5, 3, (z1 - z0) / 2] }, { pos: [x1, 3, (z0 + z1) / 2], half: [0.5, 3, (z1 - z0) / 2] })
  out.push({ pos: [0, 3, z0], half: [(x1 - x0) / 2, 3, 0.5] }, { pos: [0, 3, z1], half: [(x1 - x0) / 2, 3, 0.5] })
  return out
}

/** Rintangan 2D lantai dasar untuk pathfinding agent. */
export function groundObstacles(): Rect[] {
  const out: Rect[] = []
  for (const w of WALLS) {
    if ((w.y0 ?? 0) > 1.5) continue
    const { cx, cz, sx, sz } = wallBox(w)
    out.push({ x0: cx - sx / 2, x1: cx + sx / 2, z0: cz - sz / 2, z1: cz + sz / 2 })
  }
  out.push({ x0: RAMP.xHigh, x1: RAMP.xLow, z0: RAMP.z0, z1: RAMP.z1 })
  for (const it of ITEMS) {
    if (!SPECS[it.type].collide || (it.y ?? 0) > 0.5) continue
    out.push(footprint(it))
  }
  return out
}
