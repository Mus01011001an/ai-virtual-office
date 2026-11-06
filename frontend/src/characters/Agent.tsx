import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { STATUS_META, type Employee, type EmployeeStatus } from '../state/types'
import { DESKS, EXIT_POINT, SLOTS, type V2 } from '../office/layout'
import { findPath } from '../office/pathfinding'
import { hashStr } from '../lib/rng'
import { Humanoid } from './Humanoid'
import { NameTag } from './NameTag'
import type { PoseName } from './poses'

interface Target { key: string; x: number; z: number; y: number; yaw: number; sit: boolean; hide: boolean }

function targetFor(e: Employee): Target {
  const zone = e.status === 'ON_BREAK' ? 'break' : e.status === 'IN_MEETING' ? 'meeting' : e.status === 'COLLABORATING' ? 'collab' : null
  if (zone) {
    const list = SLOTS[zone]
    const s = list[(e.slot ?? hashStr(e.id)) % list.length]
    return { key: `${zone}:${e.slot}`, x: s.x, z: s.z, y: s.y ?? 0, yaw: s.yaw, sit: s.sit, hide: false }
  }
  if (e.status === 'OFFLINE') return { key: 'exit', x: EXIT_POINT[0], z: EXIT_POINT[1], y: 0, yaw: 0, sit: false, hide: true }
  const d = DESKS[e.deskIndex % DESKS.length]
  return { key: `desk:${d.index}`, x: d.seat[0], z: d.seat[1], y: 0, yaw: d.seatYaw, sit: true, hide: false }
}

function poseFor(s: EmployeeStatus, sit: boolean): PoseName {
  switch (s) {
    case 'WORKING': return 'type'
    case 'TOOL_EXECUTING': return 'typeFast'
    case 'THINKING': return 'think'
    case 'WAITING': return 'wait'
    case 'ON_BREAK': return sit ? 'sitRelax' : 'standCup'
    case 'IN_MEETING': return 'sitTalk'
    case 'COLLABORATING': return sit ? 'sitTalk' : 'standTalk'
    case 'OFFLINE': return 'stand'
    default: return sit ? 'sitIdle' : 'stand'
  }
}

const angDamp = (a: number, b: number, k: number, dt: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-k * dt))
}
const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2)
const SPEED = 1.45

export function Agent({ id }: { id: string }) {
  const e = useOffice((s) => s.employees.find((x) => x.id === id))!
  const selected = useOffice((s) => s.selectedId === id)
  const hovered = useOffice((s) => s.hoveredId === id)
  const nearby = useOffice((s) => s.nearbyId === id)
  const showNames = useOffice((s) => s.showNames)
  const root = useRef<THREE.Group>(null!)
  const poseRef = useRef<PoseName>('sitIdle')
  const target = useMemo(() => targetFor(e), [e.status, e.slot, e.deskIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  const [hidden, setHidden] = useState(e.status === 'OFFLINE')
  const nav = useRef({ x: 0, y: 0, z: 0, yaw: 0, path: [] as V2[], i: 0, key: '', arrived: true, init: false })
  const seed = useMemo(() => (hashStr(id) % 1000) / 100, [id])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.85, depthWrite: false }), [])

  useEffect(() => {
    root.current.userData = { kind: 'agent', employeeId: id }
    runtime.agentObjects.set(id, root.current)
    return () => { runtime.agentObjects.delete(id); runtime.agents.delete(id) }
  }, [id])

  const bubble = useOffice((s) => s.bubbles[id])
  const talking = useRef(false)
  talking.current = !!bubble && bubble !== '…'

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const n = nav.current
    // Dipanggil CEO → target = posisi kumpul (kursi terdekat / setengah lingkaran di depan CEO)
    const g = runtime.gather.get(id)
    const tg: Target = g
      ? { key: `g:${g.x.toFixed(2)}:${g.z.toFixed(2)}:${g.sit ? 1 : 0}`, x: g.x, z: g.z, y: g.y, yaw: n.yaw, sit: g.sit, hide: false }
      : target
    if (!n.init) {
      Object.assign(n, { x: tg.x, z: tg.z, y: tg.y, yaw: tg.yaw, key: tg.key, arrived: true, init: true })
    }
    if (n.key !== tg.key) {
      if (hidden) { n.x = EXIT_POINT[0]; n.z = EXIT_POINT[1]; n.y = 0; setHidden(false) }
      n.key = tg.key
      n.path = findPath([n.x, n.z], [tg.x, tg.z])
      n.i = 0; n.arrived = false
    }
    if (!n.arrived) {
      const wp = n.path[n.i]
      const dx = wp[0] - n.x, dz = wp[1] - n.z
      const dist = Math.hypot(dx, dz)
      // menyusul CEO: lari bila masih jauh
      const remain = Math.hypot(tg.x - n.x, tg.z - n.z)
      const run = !!g && remain > 5
      const step = (run ? 3.6 : g ? 1.7 : SPEED) * dt
      n.y += (0 - n.y) * Math.min(1, dt * 8)
      if (dist <= step) {
        n.x = wp[0]; n.z = wp[1]; n.i++
        if (n.i >= n.path.length) n.arrived = true
      } else {
        n.x += (dx / dist) * step; n.z += (dz / dist) * step
        n.yaw = angDamp(n.yaw, Math.atan2(dx, dz), 10, dt)
      }
      poseRef.current = run ? 'run' : 'walk'
    } else if (g) {
      // sudah sampai: hadapkan badan ke CEO (kursi putar / berdiri), dengarkan
      const p = runtime.player
      n.yaw = angDamp(n.yaw, Math.atan2(p.x - n.x, p.z - n.z), 6, dt)
      n.y += (tg.y - n.y) * Math.min(1, dt * 6)
      poseRef.current = g.sit ? (talking.current ? 'sitTalk' : 'sitIdle') : (talking.current ? 'standTalk' : 'stand')
    } else {
      n.yaw = angDamp(n.yaw, tg.yaw, 8, dt)
      n.y += (tg.y - n.y) * Math.min(1, dt * 6)
      poseRef.current = poseFor(e.status, tg.sit)
      if (tg.hide && !hidden) setHidden(true)
    }
    root.current.position.set(n.x, n.y, n.z)
    root.current.rotation.y = n.yaw
    const rt = runtime.agents.get(id)
    if (rt) { rt.x = n.x; rt.y = n.y; rt.z = n.z; rt.yaw = n.yaw; rt.visible = !hidden } else runtime.agents.set(id, { x: n.x, y: n.y, z: n.z, yaw: n.yaw, visible: !hidden })
  })

  const meta = STATUS_META[e.status]
  ringMat.color.set(meta.color)
  const s = e.appearance.height
  return (
    <group ref={root} visible={!hidden}>
      <group scale={s}>
        <Humanoid appearance={e.appearance} poseRef={poseRef} seed={seed} />
      </group>
      {(selected || hovered || nearby) && !hidden && <mesh geometry={ringGeo} material={ringMat} position={[0, 0.03, 0]} />}
      {(showNames || !!bubble) && !hidden && (
        <NameTag y={2.05 * s} name={e.name} role={e.role} status={e.status} tool={e.currentTool} progress={e.progress}
          highlight={selected || hovered || nearby} demo={e.isDemo} bubble={bubble} />
      )}
    </group>
  )
}
