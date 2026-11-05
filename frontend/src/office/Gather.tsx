import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import type { EmployeeStatus } from '../state/types'
import { DESKS, SLOTS } from './layout'
import { isFree } from './pathfinding'

interface Seat { x: number; z: number; y: number; desk?: number; zone?: 'break' | 'meeting' | 'collab'; idx?: number }

/** Semua kursi yang bisa diduduki saat kumpul: kursi meja + slot duduk (sofa, meeting, kitchen). */
const SEATS: Seat[] = [
  ...DESKS.map((d) => ({ x: d.seat[0], z: d.seat[1], y: 0, desk: d.index })),
  ...(Object.keys(SLOTS) as (keyof typeof SLOTS)[]).flatMap((zone) =>
    SLOTS[zone].map((s, idx) => ({ x: s.x, z: s.z, y: s.y ?? 0, zone, idx, sit: s.sit })).filter((s) => s.sit)),
]

const zoneOf = (s: EmployeeStatus) => (s === 'ON_BREAK' ? 'break' : s === 'IN_MEETING' ? 'meeting' : s === 'COLLABORATING' ? 'collab' : null)
const SEAT_RADIUS = 6
const REPLAN_DIST = 2.5

/**
 * Menghitung posisi kumpul untuk employee yang dipanggil:
 *  1. kursi kosong dalam radius 6 m dari CEO → duduk (Agent memutar badan menghadap CEO)
 *  2. sisanya berdiri setengah lingkaran di depan CEO
 * Dihitung ulang tiap CEO berpindah > 2.5 m → mereka mengikuti.
 */
export function GatherController() {
  const plan = useRef({ cx: Infinity, cz: Infinity, key: '', next: 0 })

  useFrame((state) => {
    const st = useOffice.getState()
    const ids = st.summoned
    const g = runtime.gather
    const pl = plan.current
    if (!ids.length) { if (g.size) g.clear(); pl.key = ''; return }
    const t = state.clock.elapsedTime
    if (t < pl.next) return
    pl.next = t + 0.3
    const p = runtime.player
    const key = ids.join('|')
    if (key === pl.key && Math.hypot(p.x - pl.cx, p.z - pl.cz) < REPLAN_DIST) return
    Object.assign(pl, { cx: p.x, cz: p.z, key })

    // kursi yang dipakai employee lain (yang tidak ikut kumpul)
    const others = st.employees.filter((e) => !ids.includes(e.id) && e.status !== 'OFFLINE')
    const takenDesk = new Set(others.map((e) => e.deskIndex))
    const takenSlot = new Set(others.map((e) => { const z = zoneOf(e.status); return z && e.slot !== null ? `${z}:${e.slot}` : '' }))
    const onGround = p.y < 2
    const seats = onGround
      ? SEATS.filter((s) => {
        const d = Math.hypot(s.x - p.x, s.z - p.z)
        if (d > SEAT_RADIUS || d < 1.0) return false
        return s.desk !== undefined ? !takenDesk.has(s.desk) : !takenSlot.has(`${s.zone}:${s.idx}`)
      }).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
      : []

    const pos = (id: string) => runtime.agents.get(id) ?? { x: p.x, z: p.z }
    const left = new Set(ids)
    const next = new Map<string, { x: number; z: number; y: number; sit: boolean }>()
    const pickNearest = (x: number, z: number) => {
      let best: string | null = null, bd = Infinity
      for (const id of left) { const a = pos(id); const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = id } }
      return best
    }
    for (const s of seats) {
      if (!left.size) break
      const id = pickNearest(s.x, s.z)!
      left.delete(id); next.set(id, { x: s.x, z: s.z, y: s.y, sit: true })
    }

    // berdiri: setengah lingkaran di depan CEO (baris 2.0 / 2.9 / 3.8 m), lalu lingkaran penuh bila kurang
    if (left.size) {
      const fy = p.yaw
      const spots: [number, number][] = []
      const taken = [...next.values()]
      const okSpot = (x: number, z: number) => isFree(x, z) && taken.every((o) => Math.hypot(o.x - x, o.z - z) > 0.75) && spots.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > 0.75)
      for (const [radius, arc] of [[2.0, 1.35], [2.9, 1.45], [3.8, 1.55], [2.4, Math.PI], [3.4, Math.PI]] as const) {
        const n = Math.max(1, Math.floor((2 * arc * radius) / 0.85))
        for (let i = 0; i <= n && spots.length < left.size; i++) {
          // urutan dari tengah ke samping supaya yang pertama tepat di depan CEO
          const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2)
          const a = fy + (k * 2 * arc) / n
          if (Math.abs(k * 2 * arc / n) > arc + 1e-3) continue
          const x = p.x + Math.sin(a) * radius, z = p.z + Math.cos(a) * radius
          if (okSpot(x, z)) spots.push([x, z])
        }
        if (spots.length >= left.size) break
      }
      for (const [x, z] of spots) {
        const id = pickNearest(x, z)
        if (!id) break
        left.delete(id); next.set(id, { x, z, y: 0, sit: false })
      }
      // fallback (ruang sempit): dekati CEO sebisanya
      for (const id of left) next.set(id, { x: p.x + 1.5, z: p.z + 1.5, y: 0, sit: false })
    }
    g.clear()
    for (const [id, v] of next) g.set(id, v)
  })
  return null
}
