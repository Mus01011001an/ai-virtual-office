import type { Batcher } from './batch'
import type { MatKey } from './materials'
import type { FurnitureType, Item } from './layout'
import * as THREE from 'three'
import { mulberry32 } from '../lib/rng'

const torusGeo = (R: number, t: number, ts = 12) => new THREE.TorusGeometry(R, t, ts, 72)

interface Spec { w: number; d: number; h: number; collide: boolean }
export const SPECS: Record<FurnitureType, Spec> = {
  desk: { w: 1.6, d: 0.8, h: 0.75, collide: true },
  chair: { w: 0.55, d: 0.55, h: 1.0, collide: false },
  sofa: { w: 2.2, d: 0.9, h: 0.8, collide: true },
  sofa2: { w: 1.6, d: 0.9, h: 0.8, collide: true },
  armchair: { w: 0.95, d: 0.9, h: 0.8, collide: true },
  coffeeTable: { w: 1.2, d: 0.7, h: 0.42, collide: true },
  plant: { w: 0.5, d: 0.5, h: 1.0, collide: true },
  plantLarge: { w: 0.8, d: 0.8, h: 2.1, collide: true },
  tree: { w: 1.4, d: 1.4, h: 5, collide: true },
  meetingTable: { w: 6, d: 1.6, h: 0.75, collide: true },
  whiteboard: { w: 2.1, d: 0.5, h: 2.0, collide: true },
  rack: { w: 0.62, d: 1.0, h: 2.1, collide: true },
  counter: { w: 8, d: 0.7, h: 0.92, collide: true },
  island: { w: 3.4, d: 1.1, h: 0.92, collide: true },
  fridge: { w: 0.9, d: 0.75, h: 2.0, collide: true },
  stool: { w: 0.4, d: 0.4, h: 0.78, collide: false },
  diningTable: { w: 1.8, d: 0.9, h: 0.75, collide: true },
  bookshelf: { w: 3, d: 0.4, h: 2.2, collide: true },
  tv: { w: 3, d: 0.1, h: 1.7, collide: false },
  beanbag: { w: 0.9, d: 0.9, h: 0.55, collide: true },
  execDesk: { w: 2.2, d: 1.0, h: 0.76, collide: true },
  reception: { w: 4.4, d: 1.0, h: 1.12, collide: true },
  rug: { w: 4, d: 3, h: 0.01, collide: false },
  divider: { w: 5, d: 0.06, h: 1.2, collide: true },
  planter: { w: 2.6, d: 0.8, h: 0.7, collide: true },
  bench: { w: 1.8, d: 0.5, h: 0.45, collide: true },
  acUnit: { w: 0.8, d: 0.6, h: 2.0, collide: true },
  waterCooler: { w: 0.4, d: 0.4, h: 1.3, collide: true },
  sculpture: { w: 3.2, d: 3.2, h: 2.6, collide: true },
}

/** Footprint dunia (AABB) item, memperhitungkan rotasi 90° dan override w/d. */
export function footprint(it: Item) {
  const s = SPECS[it.type]
  let w = it.w ?? s.w, d = it.d ?? s.d
  if (((it.r ?? 0) % 2 + 2) % 2 === 1) [w, d] = [d, w]
  return { x0: it.x - w / 2, x1: it.x + w / 2, z0: it.z - d / 2, z1: it.z + d / 2, h: s.h }
}

const BOOK_MATS: MatKey[] = ['fabricBlue', 'fabricOrange', 'fabricGreen', 'fabricCream', 'black', 'wallAccent', 'white']
let seedCounter = 1

export function buildItem(b: Batcher, it: Item) {
  const w = it.w ?? SPECS[it.type].w
  const d = it.d ?? SPECS[it.type].d
  b.push(it.x, it.y ?? 0, it.z, ((it.r ?? 0) * Math.PI) / 2)
  const r = mulberry32(seedCounter++)
  switch (it.type) {
    case 'desk': {
      // meja kayu hangat, kaki gelap, LED hangat di bawah tepi depan (seperti referensi)
      b.box('wood', 1.6, 0.045, 0.8, 0, 0.73, 0)
      b.box('woodDeep', 0.42, 0.7, 0.7, -0.57, 0.35, 0)
      b.box('black', 0.04, 0.71, 0.66, 0.76, 0.355, 0)
      b.box('woodDeep', 1.1, 0.35, 0.02, 0.15, 0.52, -0.36)
      b.box('ledWarm', 1.5, 0.012, 0.012, 0, 0.7, 0.385)
      // monitor
      b.cyl('metal', 0.09, 0.1, 0.015, 0, 0.758, -0.27, 20)
      b.box('metal', 0.04, 0.22, 0.03, 0, 0.87, -0.285)
      b.box('black', 0.58, 0.36, 0.03, 0, 1.03, -0.25)
      b.plane('screenOff', 0.54, 0.32, [0, 1.03, -0.2345], [0, 0, 0])
      b.box('black', 0.44, 0.018, 0.14, 0, 0.759, 0.1)
      b.box('black', 0.06, 0.02, 0.1, 0.32, 0.76, 0.1)
      if (r() < 0.5) b.cyl('white', 0.04, 0.035, 0.1, -0.55, 0.8, 0.05, 12)
      if (r() < 0.35) { b.cyl('brass', 0.035, 0.035, 0.22, 0.62, 0.86, -0.25, 10); b.cyl('lamp', 0.06, 0.09, 0.07, 0.62, 0.98, -0.25, 12) }
      break
    }
    case 'chair': {
      b.box('fabric', 0.5, 0.08, 0.48, 0, 0.46, 0)
      b.box('fabric', 0.46, 0.52, 0.06, 0, 0.8, -0.23)
      b.box('black', 0.05, 0.04, 0.3, 0.26, 0.64, 0); b.box('black', 0.05, 0.04, 0.3, -0.26, 0.64, 0)
      b.cyl('metal', 0.03, 0.03, 0.34, 0, 0.27, 0, 10)
      for (let i = 0; i < 5; i++) b.box('metal', 0.04, 0.03, 0.3, Math.sin((i * 2 * Math.PI) / 5) * 0.14, 0.06, Math.cos((i * 2 * Math.PI) / 5) * 0.14, (i * 2 * Math.PI) / 5)
      break
    }
    case 'sofa': case 'sofa2': case 'armchair': {
      const mat: MatKey = it.type === 'sofa' ? (it.z > 3 && it.z < 12 && Math.abs(it.x) < 16 ? 'fabricBlue' : 'fabric') : it.type === 'sofa2' ? 'fabricCream' : 'fabricOrange'
      const sw = it.type === 'sofa' ? 2.2 : it.type === 'sofa2' ? 1.6 : 0.95
      b.box(mat, sw - 0.3, 0.2, 0.7, 0, 0.36, 0.05)
      b.box(mat, sw, 0.26, 0.9, 0, 0.17, 0)
      b.box(mat, sw, 0.5, 0.2, 0, 0.6, -0.35)
      b.box(mat, 0.16, 0.36, 0.9, sw / 2 - 0.08, 0.44, 0); b.box(mat, 0.16, 0.36, 0.9, -sw / 2 + 0.08, 0.44, 0)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', 0.05, 0.06, 0.05, sx * (sw / 2 - 0.1), 0.0, sz * 0.38)
      break
    }
    case 'coffeeTable': {
      // meja kopi bundar kuningan
      b.cyl('brass', 0.42, 0.42, 0.05, 0, 0.4, 0, 28)
      b.cyl('woodDeep', 0.36, 0.36, 0.34, 0, 0.2, 0, 28)
      b.cyl('ledWarm', 0.37, 0.37, 0.01, 0, 0.02, 0, 28)
      if (r() < 0.6) b.box('fabricCream', 0.25, 0.04, 0.2, 0.1, 0.445, 0)
      break
    }
    case 'plant': {
      b.cyl('pot', 0.22, 0.17, 0.4, 0, 0.2, 0, 16); b.cyl('soil', 0.2, 0.2, 0.02, 0, 0.39, 0, 16)
      b.sphere('plant', 0.28, 0, 0.72, 0, [1, 1.1, 1]); b.sphere('plantDark', 0.2, 0.12, 0.92, 0.05); b.sphere('plant', 0.18, -0.12, 0.88, -0.06)
      break
    }
    case 'plantLarge': {
      b.cyl('potDark', 0.36, 0.3, 0.6, 0, 0.3, 0, 18); b.cyl('soil', 0.33, 0.33, 0.02, 0, 0.59, 0, 18)
      b.cyl('trunk', 0.035, 0.05, 1.1, 0, 1.1, 0, 8)
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2, rr = 0.15 + r() * 0.2
        b.sphere(i % 2 ? 'plant' : 'plantDark', 0.32 + r() * 0.12, Math.cos(a) * rr, 1.35 + r() * 0.7, Math.sin(a) * rr, [1, 0.9, 1])
      }
      break
    }
    case 'tree': {
      b.cyl('concrete', 0.75, 0.75, 0.5, 0, 0.25, 0, 20); b.cyl('soil', 0.7, 0.7, 0.02, 0, 0.5, 0, 20)
      b.cyl('trunk', 0.12, 0.18, 2.8, 0, 1.9, 0, 10)
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, rr = r() * 0.8
        b.sphere(i % 2 ? 'plant' : 'plantDark', 0.9 + r() * 0.5, Math.cos(a) * rr, 3.4 + r() * 1.2, Math.sin(a) * rr, [1, 0.85, 1])
      }
      break
    }
    case 'meetingTable': {
      b.box('woodDark', w, 0.06, d, 0, 0.73, 0)
      b.box('steel', 0.5, 0.7, d * 0.5, -w / 3, 0.35, 0); b.box('steel', 0.5, 0.7, d * 0.5, w / 3, 0.35, 0)
      b.box('black', 0.3, 0.02, 0.2, 0, 0.77, 0)
      break
    }
    case 'whiteboard': {
      b.box('white', 2.0, 1.2, 0.04, 0, 1.4, 0); b.box('metal', 2.06, 0.04, 0.06, 0, 0.78, 0.02)
      b.box('metal', 0.04, 1.9, 0.04, -1.0, 0.95, 0); b.box('metal', 0.04, 1.9, 0.04, 1.0, 0.95, 0)
      b.box('metal', 0.04, 0.03, 0.5, -1.0, 0.02, 0); b.box('metal', 0.04, 0.03, 0.5, 1.0, 0.02, 0)
      // coretan (cosmetic)
      for (let i = 0; i < 5; i++) b.box(i % 2 ? 'fabricBlue' : 'fabricOrange', 0.3 + r() * 0.8, 0.02, 0.005, -0.5 + r() * 0.6, 1.2 + i * 0.16, 0.023)
      break
    }
    case 'rack': {
      b.box('rack', 0.6, 2.1, 1.0, 0, 1.05, 0)
      for (let i = 0; i < 10; i++) b.box('steel', 0.52, 0.012, 0.01, 0, 0.2 + i * 0.18, 0.505)
      break
    }
    case 'counter': {
      b.box('white', w, 0.86, 0.66, 0, 0.43, 0)
      b.box('counter', w + 0.04, 0.05, 0.7, 0, 0.885, 0)
      b.box('white', w, 0.7, 0.36, 0, 1.95, -0.17)
      b.box('offwhite', w, 0.5, 0.02, 0, 1.15, -0.33)
      b.box('black', 0.35, 0.45, 0.35, -w / 2 + 1.2, 1.135, -0.1); b.box('chrome', 0.25, 0.05, 0.12, -w / 2 + 1.2, 1.0, 0.08)
      b.box('chrome', 0.6, 0.02, 0.4, w / 2 - 2, 0.912, 0); b.cyl('chrome', 0.015, 0.015, 0.3, w / 2 - 2, 1.05, -0.18, 8)
      b.box('black', 0.5, 0.3, 0.35, w / 2 - 3.2, 1.06, -0.1)
      break
    }
    case 'island': {
      b.box('woodDark', w, 0.86, 1.0, 0, 0.43, 0); b.box('counter', w + 0.1, 0.05, 1.1, 0, 0.885, 0)
      b.box('fabricOrange', 0.25, 0.08, 0.25, -0.6, 0.95, 0); b.sphere('fabricOrange', 0.06, 0.6, 0.97, 0.1); b.sphere('plant', 0.06, 0.72, 0.97, 0.0)
      break
    }
    case 'fridge': {
      b.box('chrome', 0.9, 2.0, 0.72, 0, 1.0, 0); b.box('steel', 0.02, 0.6, 0.03, 0.3, 1.3, 0.37)
      break
    }
    case 'stool': {
      b.cyl('leather', 0.2, 0.2, 0.06, 0, 0.75, 0, 16); b.cyl('metal', 0.025, 0.025, 0.72, 0, 0.37, 0, 8); b.cyl('metal', 0.18, 0.2, 0.02, 0, 0.01, 0, 16)
      break
    }
    case 'diningTable': {
      b.box('wood', 1.8, 0.05, 0.9, 0, 0.74, 0)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('woodDark', 0.05, 0.72, 0.05, sx * 0.82, 0.36, sz * 0.38)
      break
    }
    case 'bookshelf': {
      b.box('woodDark', w, 2.2, 0.04, 0, 1.1, -0.18)
      b.box('woodDark', 0.04, 2.2, 0.4, -w / 2, 1.1, 0); b.box('woodDark', 0.04, 2.2, 0.4, w / 2, 1.1, 0)
      for (let s = 0; s < 5; s++) {
        const y = 0.05 + s * 0.52
        b.box('woodDark', w, 0.03, 0.4, 0, y, 0)
        if (s === 4) continue
        let x = -w / 2 + 0.06
        while (x < w / 2 - 0.1) {
          const bw = 0.03 + r() * 0.05, bh = 0.25 + r() * 0.17
          if (r() < 0.85) b.box(BOOK_MATS[Math.floor(r() * BOOK_MATS.length)], bw, bh, 0.24, x + bw / 2, y + 0.015 + bh / 2, 0.02)
          x += bw + 0.005 + (r() < 0.08 ? 0.25 : 0)
        }
      }
      break
    }
    case 'tv': {
      const h = w * 0.5625
      b.box('black', w, h, 0.06, 0, 1.65, 0)
      b.plane('tvScreen', w - 0.06, h - 0.06, [0, 1.65, 0.031], [0, 0, 0])
      break
    }
    case 'beanbag': b.sphere('fabricOrange', 0.45, 0, 0.26, 0, [1, 0.6, 1], 2); break
    case 'execDesk': {
      b.box('woodDark', 2.2, 0.05, 1.0, 0, 0.75, 0)
      b.box('woodDark', 0.5, 0.72, 0.9, -0.82, 0.36, 0); b.box('woodDark', 0.5, 0.72, 0.9, 0.82, 0.36, 0)
      b.box('steel', 0.36, 0.015, 0.25, 0, 0.785, 0.1); b.box('steel', 0.36, 0.22, 0.01, 0, 0.89, -0.03)
      b.cyl('metal', 0.08, 0.1, 0.02, -0.8, 0.785, -0.3, 12); b.cyl('metal', 0.012, 0.012, 0.4, -0.8, 0.98, -0.3, 6); b.cyl('lamp', 0.07, 0.11, 0.1, -0.8, 1.2, -0.3, 12)
      break
    }
    case 'reception': {
      b.box('woodDark', 4.2, 1.08, 0.12, 0, 0.54, 0.44)
      b.box('woodDark', 0.12, 1.08, 0.9, -2.04, 0.54, 0); b.box('woodDark', 0.12, 1.08, 0.9, 2.04, 0.54, 0)
      b.box('counter', 4.4, 0.05, 0.42, 0, 1.105, 0.36)
      b.box('white', 3.9, 0.04, 0.6, 0, 0.75, -0.1)
      b.box('lamp', 4.0, 0.03, 0.02, 0, 0.12, 0.505)
      b.box('black', 0.5, 0.32, 0.03, -0.8, 0.98, -0.2); b.box('black', 0.5, 0.32, 0.03, 0.8, 0.98, -0.2)
      break
    }
    case 'rug': {
      const key = (it.color ?? '#3a4a63') as MatKey
      b.box(key, w, 0.012, d, 0, 0.006, 0)
      if (it.glow) {
        // garis LED tertanam di lantai mengelilingi zona
        const m = 0.35
        b.box('ledWarm', w + 2 * m, 0.006, 0.03, 0, 0.004, -d / 2 - m); b.box('ledWarm', w + 2 * m, 0.006, 0.03, 0, 0.004, d / 2 + m)
        b.box('ledWarm', 0.03, 0.006, d + 2 * m, -w / 2 - m, 0.004, 0); b.box('ledWarm', 0.03, 0.006, d + 2 * m, w / 2 + m, 0.004, 0)
      }
      break
    }
    case 'divider': {
      b.box('fabric', w, 0.4, 0.04, 0, 0.95, 0); b.box('metal', w, 0.02, 0.05, 0, 1.16, 0)
      break
    }
    case 'planter': {
      b.box('concrete', w, 0.6, 0.8, 0, 0.3, 0); b.box('soil', w - 0.1, 0.02, 0.7, 0, 0.6, 0)
      const n = Math.max(2, Math.round(w / 0.6))
      for (let i = 0; i < n; i++) b.sphere(i % 2 ? 'plant' : 'plantDark', 0.32 + r() * 0.1, -w / 2 + 0.35 + (i * (w - 0.7)) / Math.max(1, n - 1), 0.78, (r() - 0.5) * 0.2, [1, 0.8, 1])
      break
    }
    case 'bench': {
      for (let i = 0; i < 4; i++) b.box('wood', 1.8, 0.04, 0.1, 0, 0.45, -0.17 + i * 0.115)
      b.box('steel', 0.06, 0.44, 0.45, -0.75, 0.22, 0); b.box('steel', 0.06, 0.44, 0.45, 0.75, 0.22, 0)
      break
    }
    case 'acUnit': {
      b.box('white', 0.8, 2.0, 0.6, 0, 1.0, 0)
      for (let i = 0; i < 8; i++) b.box('offwhite', 0.65, 0.02, 0.01, 0, 1.2 + i * 0.08, 0.305)
      break
    }
    case 'sculpture': {
      // patung dua cincin chrome saling mengunci di atas taman batu, dengan cincin LED di lantai
      b.cyl('stoneDark', 1.45, 1.55, 0.35, 0, 0.175, 0, 40)
      b.cyl('ledWarm', 1.56, 1.56, 0.02, 0, 0.35, 0, 40)
      b.cyl('moss', 1.3, 1.3, 0.06, 0, 0.36, 0, 36)
      for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, rr = 0.3 + r() * 0.8; b.sphere(i % 3 ? 'rock' : 'moss', 0.18 + r() * 0.2, Math.cos(a) * rr, 0.42, Math.sin(a) * rr, [1, 0.6, 1]) }
      b.add('chrome', torusGeo(0.95, 0.075), [0, 1.55, 0], [0, 0.5, 0])
      b.add('chrome', torusGeo(0.8, 0.075), [0.12, 1.42, 0], [Math.PI / 2, 0.35, 0.4])
      b.add('ledWarm', torusGeo(2.3, 0.02, 6), [0, 0.006, 0], [Math.PI / 2, 0, 0])
      b.add('ledWarm', torusGeo(2.7, 0.015, 6), [0, 0.006, 0], [Math.PI / 2, 0, 0])
      break
    }
    case 'waterCooler': {
      b.box('white', 0.36, 1.0, 0.36, 0, 0.5, 0); b.cyl('glass', 0.15, 0.15, 0.4, 0, 1.2, 0, 16)
      break
    }
  }
  b.pop()
}
