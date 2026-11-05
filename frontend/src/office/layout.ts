/**
 * Layout office "Tech HQ" — satu sumber kebenaran untuk visual, collider, pathfinding, dan slot agent.
 * Konvensi: sumbu Y ke atas, satuan meter. Rotasi `r` = kelipatan 90° (yaw = r * PI/2).
 * "Depan" furnitur = +Z lokal (arah orang yang memakainya menghadap).
 */
export type V2 = [number, number]
export type WallKind = 'ext' | 'extGlass' | 'solid' | 'glass' | 'rail'

export interface WallSeg { a: V2; b: V2; h: number; y0?: number; t?: number; kind: WallKind }
export interface Zone { id: string; name: string; x0: number; z0: number; x1: number; z1: number; floor: FloorKind; room?: boolean }
export type FloorKind = 'wood' | 'concrete' | 'carpet' | 'carpetBlue' | 'carpetGreen' | 'tile' | 'tileDark' | 'marble'

export type FurnitureType =
  | 'desk' | 'chair' | 'sofa' | 'sofa2' | 'armchair' | 'coffeeTable' | 'plant' | 'plantLarge' | 'tree'
  | 'meetingTable' | 'whiteboard' | 'rack' | 'counter' | 'island' | 'fridge' | 'stool' | 'diningTable'
  | 'bookshelf' | 'tv' | 'beanbag' | 'execDesk' | 'reception' | 'rug' | 'divider' | 'planter' | 'bench'
  | 'acUnit' | 'waterCooler' | 'sculpture'

export interface Item { type: FurnitureType; x: number; z: number; r?: number; y?: number; w?: number; d?: number; color?: string; glow?: boolean }

export interface Desk { index: number; x: number; z: number; r: number; seat: V2; seatYaw: number; screen: { x: number; y: number; z: number; yaw: number } }
export interface Slot { x: number; z: number; yaw: number; sit: boolean; y?: number }

export const BUILDING = { x0: -30, x1: 30, z0: -20, z1: 20, height: 14 }
export const MEZZ_Y = 4.3
export const WING_H = 4.0
export const BOUNDS = { x0: -38, x1: 38, z0: -28, z1: 38 }

export const SPAWN: V2 = [0, 27]
export const EXIT_POINT: V2 = [0, 30]

const Y = (r: number) => (r * Math.PI) / 2
/** rotasi titik lokal (x,z) dengan yaw */
export function rot(x: number, z: number, yaw: number): V2 {
  const c = Math.cos(yaw), s = Math.sin(yaw)
  return [x * c + z * s, -x * s + z * c]
}

// ---------- ZONES ----------
export const ZONES: Zone[] = [
  { id: 'ceo', name: 'CEO Office', x0: -30, z0: -20, x1: -16, z1: -9, floor: 'wood', room: true },
  { id: 'meeting', name: 'Meeting Room', x0: -30, z0: -9, x1: -16, z1: 2, floor: 'carpet', room: true },
  { id: 'server', name: 'Server / DevOps', x0: -30, z0: 2, x1: -16, z1: 12, floor: 'tileDark', room: true },
  { id: 'break', name: 'Break Room', x0: 16, z0: -20, x1: 30, z1: -9, floor: 'wood', room: true },
  { id: 'kitchen', name: 'Kitchen', x0: 16, z0: -9, x1: 30, z1: 2, floor: 'tile', room: true },
  { id: 'rest', name: 'Rest Area', x0: 16, z0: 2, x1: 30, z1: 12, floor: 'carpetGreen', room: true },
  { id: 'work', name: 'Open Workspace', x0: -16, z0: -20, x1: 16, z1: 3, floor: 'marble' },
  { id: 'collab', name: 'Collaboration', x0: -16, z0: 3, x1: 16, z1: 12, floor: 'marble' },
  { id: 'lobby', name: 'Lobby & Reception', x0: -30, z0: 12, x1: 30, z1: 20, floor: 'marble' },
]

// ---------- WALLS ----------
const doorGapsZ = [[-11.8, -10.2], [-2.8, -1.2], [9.7, 11.3]] as const
function frontWall(x: number): WallSeg[] {
  const segs: WallSeg[] = []
  let z = -20
  for (const [g0, g1] of doorGapsZ) { segs.push({ a: [x, z], b: [x, g0], h: WING_H, kind: 'glass' }); z = g1 }
  segs.push({ a: [x, z], b: [x, 12], h: WING_H, kind: 'glass' })
  return segs
}
const partitions = (x0: number, x1: number): WallSeg[] =>
  [-9, 2, 12].map((z) => ({ a: [x0, z] as V2, b: [x1, z] as V2, h: WING_H, kind: 'solid' as const, t: 0.2 }))

export const WALLS: WallSeg[] = [
  { a: [-30, -20], b: [30, -20], h: 14, kind: 'ext', t: 0.5 },
  { a: [-30, 20], b: [-3, 20], h: 14, kind: 'extGlass', t: 0.3 },
  { a: [3, 20], b: [30, 20], h: 14, kind: 'extGlass', t: 0.3 },
  { a: [-3, 20], b: [3, 20], y0: 4.2, h: 9.8, kind: 'extGlass', t: 0.3 },
  { a: [-30, -20], b: [-30, 20], h: 14, kind: 'extGlass', t: 0.3 },
  { a: [30, -20], b: [30, 20], h: 14, kind: 'extGlass', t: 0.3 },
  ...frontWall(-16), ...frontWall(16),
  ...partitions(-30, -16), ...partitions(16, 30),
  // logo wall reception
  { a: [3, 12.4], b: [13, 12.4], h: 4.6, kind: 'solid', t: 0.4 },
  // mezzanine rails
  { a: [-16, -20], b: [-16, 12], y0: MEZZ_Y, h: 1.1, kind: 'rail', t: 0.08 },
  { a: [-30, 14.5], b: [-16, 14.5], y0: MEZZ_Y, h: 1.1, kind: 'rail', t: 0.08 },
]

/** Mezzanine (lantai 2 di atas sayap barat) + landing tangga */
export const MEZZANINE = [
  { x0: -30, x1: -16, z0: -20, z1: 12 },
  { x0: -30, x1: -16, z0: 12, z1: 14.5 },
]
export const EAST_ROOF = { x0: 16, x1: 30, z0: -20, z1: 12 }
/** Tangga landai: bawah di x0 (y=0), atas di x1 (y=MEZZ_Y) */
export const RAMP = { xLow: -6, xHigh: -16, z0: 12, z1: 14.5 }

// ---------- DESKS (open workspace) ----------
function buildDesks(): Desk[] {
  const desks: Desk[] = []
  const clustersX = [-9.5, 0, 9.5]
  const clustersZ = [-15.5, -8]
  for (const cz of clustersZ) for (const cx of clustersX) {
    for (const side of [0, 1]) for (let i = 0; i < 3; i++) {
      const r = side === 0 ? 2 : 0
      const x = cx + (i - 1) * 1.7
      const z = cz + (side === 0 ? -0.42 : 0.42)
      const yaw = Y(r)
      const [sx, sz] = rot(0, 0.72, yaw)
      const [mx, mz] = rot(0, -0.235, yaw)
      desks.push({
        index: desks.length, x, z, r, seat: [x + sx, z + sz], seatYaw: yaw + Math.PI,
        screen: { x: x + mx, y: 1.03, z: z + mz, yaw },
      })
    }
  }
  return desks
}
export const DESKS = buildDesks()

// ---------- FURNITURE ----------
const items: Item[] = []
const add = (...it: Item[]) => items.push(...it)

// meja + kursi workspace
for (const d of DESKS) add({ type: 'desk', x: d.x, z: d.z, r: d.r }, { type: 'chair', x: d.seat[0], z: d.seat[1], r: (d.r + 2) % 4 })

// workspace: karpet biru per cluster + divider. Tanaman hanya di pojok (tengah ruangan dibiarkan lega).
for (const cz of [-15.5, -8]) for (const cx of [-9.5, 0, 9.5]) add({ type: 'rug', x: cx, z: cz, w: 6.6, d: 3.9, color: '#1d3350', glow: true }, { type: 'divider', x: cx, z: cz, w: 5.2 })
add({ type: 'plantLarge', x: -15, z: -19 }, { type: 'plantLarge', x: 15, z: -19 })
// patung cincin di tengah area kolaborasi (titik fokus ruangan)
add({ type: 'sculpture', x: 0, z: 7.5 })
add({ type: 'waterCooler', x: 15.3, z: -4.5, r: 3 })

// collaboration pods
for (const cx of [-8, 8]) {
  const cz = 7.5
  add(
    { type: 'rug', x: cx, z: cz, w: 6, d: 5.2, color: '#1d3350', glow: true },
    { type: 'sofa', x: cx, z: cz - 1.6, r: 0 },
    { type: 'sofa', x: cx, z: cz + 1.6, r: 2 },
    { type: 'coffeeTable', x: cx, z: cz },
    { type: 'whiteboard', x: cx + (cx < 0 ? -3.2 : 3.2), z: cz, r: cx < 0 ? 1 : 3 },
  )
}

// lobby
add(
  { type: 'reception', x: 8, z: 15.2, r: 0 },
  { type: 'sofa', x: -9, z: 18.7, r: 2 }, { type: 'sofa', x: -12.8, z: 17, r: 1 },
  { type: 'coffeeTable', x: -9.5, z: 17 },
  { type: 'plantLarge', x: -4.3, z: 19.2 }, { type: 'plantLarge', x: 4.3, z: 19.2 },
  { type: 'plantLarge', x: 15, z: 18.8 }, { type: 'plantLarge', x: 28.6, z: 18.6 },
  { type: 'sofa', x: -23, z: 18.6, r: 2 }, { type: 'armchair', x: -26.5, z: 16.5, r: 1 },
  { type: 'coffeeTable', x: -23, z: 16.8 }, { type: 'plant', x: -29, z: 19 },
  { type: 'rug', x: -23, z: 17.2, w: 7, d: 4, color: '#5b4b3a' },
  { type: 'bench', x: 22, z: 18.9, r: 2 }, { type: 'bench', x: 22, z: 13.2, r: 0 },
)

// CEO office
add(
  { type: 'rug', x: -23, z: -14.5, w: 8, d: 6, color: '#6e5a48' },
  { type: 'execDesk', x: -25, z: -14.5, r: 1 },
  { type: 'chair', x: -26, z: -14.5, r: 1 },
  { type: 'bookshelf', x: -29.6, z: -14.5, r: 1, w: 4 },
  { type: 'sofa2', x: -20, z: -18.9, r: 0 }, { type: 'coffeeTable', x: -20, z: -17.3 },
  { type: 'plantLarge', x: -29, z: -19 }, { type: 'plantLarge', x: -17, z: -10 },
)

// meeting room
add({ type: 'meetingTable', x: -23, z: -3.5, w: 6.4, d: 1.6 }, { type: 'tv', x: -29.75, z: -3.5, r: 1, w: 3.2 }, { type: 'plant', x: -17, z: 1.2 })
const meetingSlots: Slot[] = []
for (const x of [-25.4, -23.8, -22.2, -20.6]) {
  add({ type: 'chair', x, z: -3.5 - 1.15, r: 0 }, { type: 'chair', x, z: -3.5 + 1.15, r: 2 })
  meetingSlots.push({ x, z: -3.5 - 1.15, yaw: 0, sit: true }, { x, z: -3.5 + 1.15, yaw: Math.PI, sit: true })
}

// server room
for (let i = 0; i < 12; i++) {
  const x = -28.4 + i * 0.75
  add({ type: 'rack', x, z: 5.2, r: 0 }, { type: 'rack', x, z: 8.6, r: 2 })
}
add({ type: 'acUnit', x: -29.4, z: 10.6, r: 1 }, { type: 'acUnit', x: -29.4, z: 3.2, r: 1 })

// break room
add(
  { type: 'rug', x: 23, z: -15, w: 7, d: 5.5, color: '#7a6a55' },
  { type: 'sofa', x: 23, z: -17.8, r: 0 }, { type: 'sofa2', x: 19.4, z: -14.6, r: 1 },
  { type: 'coffeeTable', x: 23, z: -14.8 }, { type: 'tv', x: 23, z: -9.25, r: 2, w: 2.6 },
  { type: 'beanbag', x: 26.6, z: -15.6, r: 3 }, { type: 'beanbag', x: 26.8, z: -13.4, r: 3 },
  { type: 'plantLarge', x: 29, z: -19 }, { type: 'plant', x: 17, z: -19.2 },
)
// kitchen
add(
  { type: 'counter', x: 29.3, z: -4, r: 3, w: 8 }, { type: 'fridge', x: 29.2, z: 1.0, r: 3 },
  { type: 'island', x: 24.6, z: -3.5, r: 1, w: 3.4 },
  { type: 'stool', x: 23.6, z: -4.7, r: 1 }, { type: 'stool', x: 23.6, z: -3.5, r: 1 }, { type: 'stool', x: 23.6, z: -2.3, r: 1 },
  { type: 'diningTable', x: 19.6, z: -5.6 },
  { type: 'chair', x: 19.0, z: -6.45, r: 0 }, { type: 'chair', x: 20.2, z: -6.45, r: 0 },
  { type: 'chair', x: 19.0, z: -4.75, r: 2 }, { type: 'chair', x: 20.2, z: -4.75, r: 2 },
  { type: 'plant', x: 17, z: 1.2 },
)
// rest area
add(
  { type: 'rug', x: 22.5, z: 7, w: 8, d: 6, color: '#4f5e4a' },
  { type: 'armchair', x: 19.6, z: 5.2, r: 1 }, { type: 'armchair', x: 19.6, z: 8.6, r: 1 },
  { type: 'armchair', x: 25.4, z: 5.2, r: 3 }, { type: 'armchair', x: 25.4, z: 8.6, r: 3 },
  { type: 'coffeeTable', x: 22.5, z: 6.9 }, { type: 'bookshelf', x: 29.6, z: 7, r: 3, w: 4 },
  { type: 'plantLarge', x: 29, z: 2.8 }, { type: 'plantLarge', x: 29, z: 11.2 }, { type: 'plant', x: 17, z: 11.2 },
)
// mezzanine lounge (lantai 2)
add(
  { type: 'rug', x: -23, z: -4, w: 9, d: 7, y: MEZZ_Y, color: '#424b59' },
  { type: 'armchair', x: -20, z: -6, r: 1, y: MEZZ_Y }, { type: 'armchair', x: -20, z: -2, r: 1, y: MEZZ_Y },
  { type: 'sofa', x: -26, z: -4, r: 1, y: MEZZ_Y }, { type: 'coffeeTable', x: -23, z: -4, y: MEZZ_Y },
  { type: 'plantLarge', x: -29, z: -19, y: MEZZ_Y }, { type: 'plantLarge', x: -17, z: -19, y: MEZZ_Y },
  { type: 'plantLarge', x: -29, z: 13.5, y: MEZZ_Y }, { type: 'bookshelf', x: -29.6, z: 5, r: 1, w: 4, y: MEZZ_Y },
  { type: 'beanbag', x: -24, z: 6, y: MEZZ_Y }, { type: 'beanbag', x: -22, z: 7, y: MEZZ_Y },
)
// terrace
for (const x of [-26, -18, -10, 10, 18, 26]) add({ type: 'tree', x, z: 27 })
for (const x of [-22, -14, 14, 22]) add({ type: 'bench', x, z: 24.5, r: 2 })
add({ type: 'planter', x: -8, z: 34, w: 10 }, { type: 'planter', x: 8, z: 34, w: 10 })

export const ITEMS = items

// ---------- SLOTS ----------
const sofaSeats = (x: number, z: number, r: number, n: number, span: number, y = 0): Slot[] => {
  const yaw = Y(r)
  return Array.from({ length: n }, (_, i) => {
    const off = n === 1 ? 0 : -span / 2 + (span / (n - 1)) * i
    const [dx, dz] = rot(off, 0.12, yaw)
    return { x: x + dx, z: z + dz, yaw, sit: true, y }
  })
}

export const SLOTS: Record<'break' | 'meeting' | 'collab', Slot[]> = {
  meeting: meetingSlots,
  collab: [-8, 8].flatMap((cx) => [...sofaSeats(cx, 7.5 - 1.6, 0, 3, 1.3), ...sofaSeats(cx, 7.5 + 1.6, 2, 3, 1.3)]),
  break: [
    ...sofaSeats(23, -17.8, 0, 3, 1.3), ...sofaSeats(19.4, -14.6, 1, 2, 0.7),
    { x: 26.6, z: -15.6, yaw: Y(3), sit: true, y: -0.15 }, { x: 26.8, z: -13.4, yaw: Y(3), sit: true, y: -0.15 },
    { x: 23.6, z: -4.7, yaw: Y(1), sit: true, y: 0.2 }, { x: 23.6, z: -3.5, yaw: Y(1), sit: true, y: 0.2 },
    { x: 23.6, z: -2.3, yaw: Y(1), sit: true, y: 0.2 },
    { x: 19.0, z: -6.45, yaw: 0, sit: true }, { x: 20.2, z: -6.45, yaw: 0, sit: true },
    { x: 19.0, z: -4.75, yaw: Math.PI, sit: true }, { x: 20.2, z: -4.75, yaw: Math.PI, sit: true },
    { x: 28.2, z: -6.2, yaw: Y(1), sit: false }, { x: 27.8, z: -1.6, yaw: Y(1), sit: false },
    ...sofaSeats(19.6, 5.2, 1, 1, 0), ...sofaSeats(19.6, 8.6, 1, 1, 0), ...sofaSeats(25.4, 5.2, 3, 1, 0), ...sofaSeats(25.4, 8.6, 3, 1, 0),
  ],
}

// ---------- CLOCKS & SIGNS ----------
export const CLOCKS = [
  { x: 0, y: 9.2, z: -19.58, yaw: 0, size: 4.2 },
  { x: -23, y: 3.0, z: -9.12, yaw: Math.PI, size: 0.7 },
  { x: -19, y: 3.0, z: 1.88, yaw: Math.PI, size: 0.7 },
  { x: -19, y: 3.0, z: 11.88, yaw: Math.PI, size: 0.7 },
  { x: 19, y: 3.0, z: -9.12, yaw: Math.PI, size: 0.7 },
  { x: 23, y: 3.0, z: 1.88, yaw: Math.PI, size: 0.7 },
  { x: 23, y: 3.0, z: 11.88, yaw: Math.PI, size: 0.7 },
  { x: -23, y: 2.8, z: 12.12, yaw: 0, size: 0.8 },
  { x: -23, y: 7.0, z: -19.72, yaw: 0, size: 1.0 },
]

export const ROOM_SIGNS = ZONES.filter((z) => z.room).map((z) => {
  const east = z.x0 > 0
  const doorZ = z.id === 'ceo' || z.id === 'break' ? -11 : z.id === 'meeting' || z.id === 'kitchen' ? -2 : 10.5
  return { id: z.id, name: z.name, x: east ? 15.88 : -15.88, y: 3.45, z: doorZ, yaw: east ? -Math.PI / 2 : Math.PI / 2 }
})
