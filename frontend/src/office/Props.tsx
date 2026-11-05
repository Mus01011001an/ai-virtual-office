import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useOffice, currentOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { STATUS_META, type EmployeeStatus } from '../state/types'
import { useCanvasTexture } from '../lib/canvas'
import { scheduleState } from '../lib/time'
import { CLOCKS, DESKS, ITEMS, ROOM_SIGNS } from './layout'

// ---------------- WALL CLOCK ----------------
let faceTex: THREE.CanvasTexture | null = null
function clockFace() {
  if (faceTex) return faceTex
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#fbfaf7'; g.beginPath(); g.arc(256, 256, 256, 0, Math.PI * 2); g.fill()
  g.translate(256, 256)
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0
    g.save(); g.rotate((i / 60) * Math.PI * 2)
    g.fillStyle = big ? '#15171b' : '#6b6f76'
    g.fillRect(big ? -5 : -1.5, -238, big ? 10 : 3, big ? 34 : 14)
    g.restore()
  }
  g.fillStyle = '#15171b'; g.font = '600 52px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(String(i), Math.sin(a) * 168, -Math.cos(a) * 168) }
  g.font = '500 20px Inter, system-ui, sans-serif'; g.fillStyle = '#8a8e95'; g.fillText('VIRTUAL AI OFFICE', 0, 80)
  faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8
  return faceTex
}
const faceGeo = new THREE.CircleGeometry(0.5, 64)
const rimGeo = new THREE.TorusGeometry(0.5, 0.025, 12, 64)
const rimMat = new THREE.MeshStandardMaterial({ color: '#202327', metalness: 0.7, roughness: 0.35 })
const handMat = new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.5 })
const secMat = new THREE.MeshStandardMaterial({ color: '#e0443a', roughness: 0.5 })

function WallClock({ x, y, z, yaw, size }: (typeof CLOCKS)[number]) {
  const hr = useRef<THREE.Group>(null!), mn = useRef<THREE.Group>(null!), sc = useRef<THREE.Group>(null!)
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.6 }), [])
  useFrame(() => {
    const t = runtime.time
    const sec = t.s + t.ms / 1000, min = t.m + sec / 60, h = (t.h % 12) + min / 60
    sc.current.rotation.z = -(sec / 60) * Math.PI * 2
    mn.current.rotation.z = -(min / 60) * Math.PI * 2
    hr.current.rotation.z = -(h / 12) * Math.PI * 2
  })
  return (
    <group position={[x, y, z]} rotation-y={yaw} scale={size}>
      <mesh geometry={faceGeo} material={faceMat} />
      <mesh geometry={rimGeo} material={rimMat} castShadow />
      <group ref={hr} position-z={0.012}><mesh material={handMat} position-y={0.12}><boxGeometry args={[0.035, 0.28, 0.01]} /></mesh></group>
      <group ref={mn} position-z={0.02}><mesh material={handMat} position-y={0.17}><boxGeometry args={[0.024, 0.4, 0.01]} /></mesh></group>
      <group ref={sc} position-z={0.028}><mesh material={secMat} position-y={0.15}><boxGeometry args={[0.008, 0.46, 0.006]} /></mesh></group>
      <mesh material={secMat} position-z={0.034} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.02, 0.02, 0.01, 16]} /></mesh>
    </group>
  )
}

export function Clocks() { return <>{CLOCKS.map((c, i) => <WallClock key={i} {...c} />)}</> }

// ---------------- SIGNS ----------------
function Sign({ w, h, pos, yaw, draw, deps = [], interval }: {
  w: number; h: number; pos: [number, number, number]; yaw: number
  draw: (g: CanvasRenderingContext2D, W: number, H: number) => void; deps?: unknown[]; interval?: number
}) {
  const tex = useCanvasTexture(Math.round(w * 256), Math.round(h * 256), draw, deps, interval)
  return (
    <mesh position={pos} rotation-y={yaw}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.55} toneMapped={false} roughness={0.4} />
    </mesh>
  )
}

const font = (wgt: number, px: number) => `${wgt} ${px}px Inter, system-ui, -apple-system, sans-serif`

export function Signs() {
  const office = useOffice((s) => s.offices.find((o) => o.id === s.currentOfficeId))
  return (
    <>
      {ROOM_SIGNS.map((r) => (
        <Sign key={r.id} w={2.2} h={0.42} pos={[r.x, r.y, r.z]} yaw={r.yaw} draw={(g, W, H) => {
          g.fillStyle = '#1b222c'; g.fillRect(0, 0, W, H)
          g.fillStyle = '#e8b04a'; g.fillRect(0, 0, 10, H)
          g.fillStyle = '#f4f4f2'; g.font = font(600, 54); g.textBaseline = 'middle'; g.fillText(r.name, 40, H / 2 + 2)
        }} />
      ))}
      <Sign w={6} h={1.1} pos={[8, 2.75, 12.62]} yaw={0} deps={[office?.name]} draw={(g, W, H) => {
        g.clearRect(0, 0, W, H); g.fillStyle = '#20262f'; g.fillRect(0, 0, W, H)
        g.fillStyle = '#f5f3ee'; g.font = font(700, 120); g.textBaseline = 'middle'; g.textAlign = 'center'
        g.fillText('VIRTUAL AI OFFICE', W / 2, H * 0.42)
        g.fillStyle = '#e8b04a'; g.font = font(500, 52); g.fillText(office?.name ?? '', W / 2, H * 0.8)
      }} />
      <Sign w={2.6} h={0.6} pos={[8, 3.95, 12.62]} yaw={0} interval={1000} draw={(g, W, H) => {
        const t = runtime.time
        g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H)
        g.fillStyle = '#7cf0c0'; g.font = `700 108px ui-monospace, Menlo, monospace`; g.textBaseline = 'middle'; g.textAlign = 'center'
        g.fillText(`${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}:${String(t.s).padStart(2, '0')}`, W / 2, H * 0.42)
        g.fillStyle = '#8aa'; g.font = font(500, 30)
        g.fillText(`${currentOffice().timezone} · ${scheduleState(t).label}`, W / 2, H * 0.85)
      }} />
      <mesh position={[-8, 1.5, 23.2]} castShadow>
        <boxGeometry args={[2.2, 3, 0.4]} />
        <meshStandardMaterial color="#1f252d" roughness={0.6} />
      </mesh>
      <Sign w={1.9} h={2.4} pos={[-8, 1.6, 23.41]} yaw={0} deps={[office?.name]} draw={(g, W, H) => {
        g.fillStyle = '#1f252d'; g.fillRect(0, 0, W, H)
        g.fillStyle = '#e8b04a'; g.fillRect(W * 0.1, H * 0.1, W * 0.18, 12)
        g.fillStyle = '#f5f3ee'; g.font = font(700, 76); g.textBaseline = 'top'
        ;['VIRTUAL', 'AI', 'OFFICE'].forEach((l, i) => g.fillText(l, W * 0.1, H * 0.16 + i * 90))
        g.fillStyle = '#aab'; g.font = font(500, 34); g.fillText(office?.name ?? '', W * 0.1, H * 0.75)
        g.fillText('Main Entrance →', W * 0.1, H * 0.84)
      }} />
    </>
  )
}

// ---------------- DESK SCREENS (live dari activity) ----------------
function DeskScreen({ id }: { id: string }) {
  const e = useOffice((s) => s.employees.find((x) => x.id === id))!
  const acts = useOffice((s) => s.activity[id])
  const d = DESKS[e.deskIndex % DESKS.length]
  const ref = useRef<THREE.Mesh>(null!)
  useEffect(() => {
    ref.current.userData = { kind: 'monitor', employeeId: id }
    runtime.monitorObjects.set(id, ref.current)
    return () => { runtime.monitorObjects.delete(id) }
  }, [id])
  const tex = useCanvasTexture(512, 304, (g, W, H) => {
    const meta = STATUS_META[e.status]
    const off = e.status === 'OFFLINE' || e.status === 'ON_BREAK' || e.status === 'IN_MEETING' || e.status === 'COLLABORATING'
    g.fillStyle = off ? '#06080b' : '#0b1018'; g.fillRect(0, 0, W, H)
    if (off) {
      g.fillStyle = '#2a3442'; g.font = font(700, 30); g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(e.status === 'OFFLINE' ? '— locked —' : `${meta.label}…`, W / 2, H / 2 - 10)
      g.fillStyle = '#1e2733'; g.font = font(500, 18); g.fillText(e.name, W / 2, H / 2 + 24)
      g.textAlign = 'left'
      return
    }
    g.fillStyle = '#151c27'; g.fillRect(0, 0, W, 44)
    g.fillStyle = meta.color; g.beginPath(); g.arc(22, 22, 8, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#e6edf5'; g.font = font(600, 22); g.textBaseline = 'middle'; g.textAlign = 'left'
    g.fillText(`${e.name} · ${meta.label}`, 40, 23)
    if (e.isDemo) { g.fillStyle = '#ffffff30'; g.fillRect(W - 78, 10, 66, 24); g.fillStyle = '#fff'; g.font = font(700, 14); g.fillText('DEMO', W - 64, 23) }
    g.fillStyle = '#9fb0c5'; g.font = font(500, 17)
    g.fillText(e.currentTask ? `▸ ${e.currentTask}`.slice(0, 44) : '▸ Tidak ada task aktif', 14, 64)
    const lines = (acts ?? []).slice(-9)
    g.font = '15px ui-monospace, Menlo, monospace'
    lines.forEach((a, i) => {
      g.fillStyle = a.kind === 'tool' ? '#7dd3fc' : a.kind === 'output' ? '#a7f3d0' : a.kind === 'warn' ? '#fcd34d' : a.kind === 'error' ? '#fca5a5' : a.kind === 'done' ? '#86efac' : '#8b9bb0'
      g.fillText(a.text.slice(0, 52), 14, 92 + i * 23)
    })
    if (e.progress > 0) { g.fillStyle = '#1f2937'; g.fillRect(14, H - 14, W - 28, 6); g.fillStyle = '#34d399'; g.fillRect(14, H - 14, (W - 28) * e.progress, 6) }
  }, [e.status, e.currentTask, e.progress, acts])
  return (
    <mesh ref={ref} position={[d.screen.x, d.screen.y, d.screen.z]} rotation-y={d.screen.yaw}>
      <planeGeometry args={[0.54, 0.32]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.9} toneMapped={false} />
    </mesh>
  )
}

export function DeskScreens() {
  const ids = useOffice((s) => s.employees.map((e) => e.id).join('|'))
  return <>{ids.split('|').filter(Boolean).map((id) => <DeskScreen key={id} id={id} />)}</>
}

// ---------------- STATUS BOARD (menggantung di atrium) ----------------
export function StatusBoard() {
  const tex = useCanvasTexture(1280, 720, (g, W, H) => {
    const st = useOffice.getState()
    const counts = new Map<EmployeeStatus, number>()
    st.employees.forEach((e) => counts.set(e.status, (counts.get(e.status) ?? 0) + 1))
    g.fillStyle = '#0b0f15'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#e8b04a'; g.fillRect(0, 0, W, 8)
    g.fillStyle = '#f2f4f7'; g.font = font(700, 54); g.textBaseline = 'top'; g.textAlign = 'left'
    g.fillText('Company Status', 50, 40)
    g.fillStyle = '#8b98a9'; g.font = font(500, 30); g.fillText(`${currentOffice().name} · ${st.employees.length} employees`, 50, 108)
    const demo = st.employees.some((e) => e.isDemo)
    if (demo) { g.fillStyle = '#f59e0b'; g.font = font(700, 26); g.fillText('DEMO MODE — data simulasi', W - 430, 50) }
    const list = Object.keys(STATUS_META) as EmployeeStatus[]
    list.forEach((s, i) => {
      const col = i % 3, row = Math.floor(i / 3)
      const x = 50 + col * 400, y = 190 + row * 150
      g.fillStyle = '#121a24'; g.beginPath(); g.roundRect(x, y, 370, 125, 18); g.fill()
      g.fillStyle = STATUS_META[s].color; g.beginPath(); g.arc(x + 40, y + 62, 14, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#f2f4f7'; g.font = font(700, 64); g.fillText(String(counts.get(s) ?? 0), x + 75, y + 22)
      g.fillStyle = '#93a1b3'; g.font = font(500, 26); g.fillText(STATUS_META[s].label, x + 175, y + 50)
    })
    const done = st.tasks.filter((t) => t.status === 'COMPLETED').length
    const run = st.tasks.filter((t) => t.status === 'EXECUTING').length
    g.fillStyle = '#93a1b3'; g.font = font(500, 28)
    g.fillText(`Tasks berjalan: ${run}   ·   Selesai (sesi ini): ${done}`, 50, H - 70)
  }, [], 1000)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#fff', emissiveIntensity: 0.8, toneMapped: false }), [tex])
  return (
    <group position={[0, 6.4, 3.2]}>
      <mesh><boxGeometry args={[6.5, 3.75, 0.12]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position-z={0.061} material={mat}><planeGeometry args={[6.3, 3.55]} /></mesh>
      <mesh position-z={-0.061} rotation-y={Math.PI} material={mat}><planeGeometry args={[6.3, 3.55]} /></mesh>
      {[-2.8, 2.8].map((x) => <mesh key={x} position={[x, 4.7, 0]}><cylinderGeometry args={[0.01, 0.01, 5.7, 4]} /><meshStandardMaterial color="#222" /></mesh>)}
    </group>
  )
}

// ---------------- SERVER LEDs ----------------
export function ServerLeds() {
  const racks = useMemo(() => ITEMS.filter((i) => i.type === 'rack'), [])
  const count = racks.length * 20
  const ref = useRef<THREE.InstancedMesh>(null!)
  const colors = useMemo(() => [new THREE.Color('#22ff88'), new THREE.Color('#38bdf8'), new THREE.Color('#ffb020'), new THREE.Color('#0a1a10')], [])
  useEffect(() => {
    const m = new THREE.Matrix4()
    racks.forEach((r, ri) => {
      const front = (r.r ?? 0) === 0 ? 1 : -1
      for (let k = 0; k < 20; k++) {
        const col = k % 2, row = Math.floor(k / 2)
        m.makeTranslation(r.x + (col ? 0.2 : -0.2) * front, 0.25 + row * 0.18, r.z + 0.507 * front)
        ref.current.setMatrixAt(ri * 20 + k, m)
        ref.current.setColorAt(ri * 20 + k, colors[3])
      }
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [racks, colors])
  const next = useRef(0)
  useFrame((s) => {
    if (s.clock.elapsedTime < next.current) return
    next.current = s.clock.elapsedTime + 0.2
    const active = useOffice.getState().employees.filter((e) => e.status === 'TOOL_EXECUTING' || e.status === 'WORKING').length
    const load = Math.min(1, 0.25 + active * 0.08)
    for (let i = 0; i < count; i++) {
      const r = Math.random()
      ref.current.setColorAt(i, r < load * 0.6 ? colors[0] : r < load * 0.8 ? colors[1] : r < load * 0.85 ? colors[2] : colors[3])
    }
    ref.current.instanceColor!.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.05, 0.018, 0.006]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

// ---------------- VIDEO WALL (dinding utara, gaya command-center) ----------------
/** Dashboard besar dari state frontend yang nyata: aktivitas, status, dan task per employee. */
export function VideoWall() {
  const tex = useCanvasTexture(2048, 640, (g, W, H) => {
    const st = useOffice.getState()
    const acts = Object.values(st.activity).flat()
    const now = Date.now()
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H)
    const panel = (x: number, w: number, title: string) => {
      const gr = g.createLinearGradient(0, 30, 0, H - 30)
      gr.addColorStop(0, '#0d1424'); gr.addColorStop(1, '#090d17')
      g.fillStyle = gr; g.beginPath(); g.roundRect(x, 30, w, H - 60, 14); g.fill()
      g.strokeStyle = '#1f2b44'; g.lineWidth = 2; g.stroke()
      g.fillStyle = '#8fa3c7'; g.font = font(600, 26); g.textAlign = 'left'; g.textBaseline = 'top'
      g.fillText(title, x + 26, 52)
    }
    // 1) area chart aktivitas 5 menit terakhir
    const P1 = { x: 30, w: 900 }
    panel(P1.x, P1.w, 'Aktivitas tim · 5 menit terakhir')
    const N = 30, span = 300_000
    const buckets = new Array(N).fill(0)
    for (const a of acts) { const k = Math.floor((now - a.at) / (span / N)); if (k >= 0 && k < N) buckets[N - 1 - k]++ }
    const mx = Math.max(4, ...buckets)
    const cx0 = P1.x + 30, cx1 = P1.x + P1.w - 30, cy0 = 120, cy1 = H - 70
    const pt = (i: number) => [cx0 + ((cx1 - cx0) * i) / (N - 1), cy1 - ((cy1 - cy0) * buckets[i]) / mx] as const
    const area = g.createLinearGradient(0, cy0, 0, cy1)
    area.addColorStop(0, 'rgba(99,140,255,0.55)'); area.addColorStop(1, 'rgba(99,140,255,0)')
    g.beginPath(); g.moveTo(cx0, cy1)
    for (let i = 0; i < N; i++) { const [x, y] = pt(i); g.lineTo(x, y) }
    g.lineTo(cx1, cy1); g.closePath(); g.fillStyle = area; g.fill()
    g.beginPath(); for (let i = 0; i < N; i++) { const [x, y] = pt(i); if (i) g.lineTo(x, y); else g.moveTo(x, y) }
    g.strokeStyle = '#7aa2ff'; g.lineWidth = 4; g.stroke()
    g.fillStyle = '#e8eefc'; g.font = font(700, 64); g.textAlign = 'right'
    g.fillText(String(buckets.reduce((a, b) => a + b, 0)), cx1, 40)
    // 2) donut status
    const P2 = { x: 960, w: 520 }
    panel(P2.x, P2.w, 'Status employee')
    const counts = new Map<EmployeeStatus, number>()
    st.employees.forEach((e) => counts.set(e.status, (counts.get(e.status) ?? 0) + 1))
    const total = Math.max(1, st.employees.length)
    let a0 = -Math.PI / 2
    const dx = P2.x + 170, dy = H / 2 + 30
    for (const [s, n] of counts) {
      const a1 = a0 + (n / total) * Math.PI * 2
      g.beginPath(); g.arc(dx, dy, 120, a0, a1); g.strokeStyle = STATUS_META[s].color; g.lineWidth = 44; g.stroke()
      a0 = a1
    }
    g.fillStyle = '#e8eefc'; g.font = font(700, 56); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(st.employees.length), dx, dy)
    g.textAlign = 'left'; g.font = font(500, 22)
    ;[...counts].slice(0, 7).forEach(([s, n], i) => {
      g.fillStyle = STATUS_META[s].color; g.fillRect(P2.x + 330, 140 + i * 50, 16, 16)
      g.fillStyle = '#b8c4dc'; g.fillText(`${STATUS_META[s].label} · ${n}`, P2.x + 356, 148 + i * 50)
    })
    // 3) bar chart task per employee
    const P3 = { x: 1510, w: 508 }
    panel(P3.x, P3.w, 'Task per employee')
    const per = st.employees.map((e) => ({ e, n: st.tasks.filter((t) => t.employeeId === e.id && t.status !== 'QUEUED').length })).sort((a, b) => b.n - a.n).slice(0, 8)
    const bm = Math.max(1, ...per.map((p) => p.n))
    per.forEach(({ e, n }, i) => {
      const bx = P3.x + 40 + i * 56, bh = (n / bm) * 330
      const gr = g.createLinearGradient(0, H - 100 - bh, 0, H - 100)
      gr.addColorStop(0, '#b06bff'); gr.addColorStop(1, '#5b4bff')
      g.fillStyle = gr; g.beginPath(); g.roundRect(bx, H - 100 - bh, 36, Math.max(4, bh), 6); g.fill()
      g.fillStyle = '#8fa3c7'; g.font = font(600, 20); g.textAlign = 'center'; g.fillText(e.name.slice(0, 4), bx + 18, H - 78)
    })
    if (st.employees.some((e) => e.isDemo)) {
      g.fillStyle = '#f5c542'; g.font = font(700, 22); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('DEMO MODE · data simulasi', P1.x + 26, 92)
    }
  }, [], 2000)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#fff', emissiveIntensity: 0.95, toneMapped: false }), [tex])
  const office = useOffice((s) => s.offices.find((o) => o.id === s.currentOfficeId))
  return (
    <group position={[0, 3.7, -19.5]}>
      <mesh position-z={-0.05}><boxGeometry args={[12.6, 4.2, 0.08]} /><meshStandardMaterial color="#0b0c0f" roughness={0.4} /></mesh>
      <mesh material={mat}><planeGeometry args={[12.2, 3.81]} /></mesh>
      <Sign w={6} h={0.9} pos={[0, 2.75, 0.02]} yaw={0} deps={[office?.name]} draw={(g, W, H) => {
        g.fillStyle = '#0b0c0f'; g.fillRect(0, 0, W, H)
        g.fillStyle = '#ffcf96'; g.font = font(600, 130); g.textBaseline = 'middle'; g.textAlign = 'center'
        g.fillText(`◆  ${(office?.name ?? 'OFFICE HQ').toUpperCase()}`, W / 2, H / 2 + 6)
      }} />
    </group>
  )
}
