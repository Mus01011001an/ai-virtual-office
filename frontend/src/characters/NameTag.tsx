import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { runtime } from '../state/runtime'
import { useOffice } from '../state/store'
import { STATUS_META, type EmployeeStatus } from '../state/types'
import { MarkdownView } from '../hud/MarkdownView'

const v = new THREE.Vector3()
const dir = new THREE.Vector3()

export function NameTag({ y, name, role, status, tool, progress, badge, highlight, demo, bubble }: {
  y: number; name: string; role?: string; status?: EmployeeStatus; tool?: string | null; progress?: number
  badge?: string; highlight?: boolean; demo?: boolean; bubble?: string
}) {
  const anchor = useRef<THREE.Group>(null!)
  const el = useRef<HTMLDivElement>(null!)
  const { world, rapier } = useRapier()
  const occl = useRef({ next: Math.random() * 0.3, hidden: false })

  useFrame((state) => {
    if (!el.current || !anchor.current) return
    anchor.current.getWorldPosition(v)
    const cam = state.camera.position
    const d = v.distanceTo(cam)
    const o = occl.current
    const t = state.clock.elapsedTime
    if (t > o.next) {
      o.next = t + 0.25
      dir.copy(v).sub(cam).normalize()
      const ray = new rapier.Ray(cam, dir)
      const hit = world.castRay(ray, Math.max(0, d - 0.4), true, undefined, undefined, undefined, undefined,
        (c) => !runtime.glassHandles.has(c.handle) && c.handle !== runtime.playerColliderHandle)
      o.hidden = !!hit
    }
    const iso = useOffice.getState().cameraMode === 'iso'
    const fadeStart = iso ? 80 : 26, fadeLen = iso ? 20 : 12
    const op = o.hidden && !iso ? 0 : d > fadeStart ? Math.max(0, 1 - (d - fadeStart) / fadeLen) : 1
    el.current.style.opacity = String(highlight || bubble ? Math.max(op, o.hidden ? 0.35 : 1) : op)
    el.current.dataset.compact = !highlight && (iso || d > 4.5) ? '1' : '0'
  })

  const meta = status ? STATUS_META[status] : null
  return (
    <group ref={anchor} position={[0, y, 0]}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={el} className="nametag group flex flex-col items-center" style={{ opacity: 0 }}>
          {bubble && (
            <div className="relative mb-1.5 w-max max-w-[230px] whitespace-normal rounded-2xl bg-[#f6f1ea] px-3 py-1.5 text-[12px] leading-snug text-[#1b1918] shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
              {bubble === '…' ? (
                <span className="font-bold tracking-widest text-[#1b1918]/60 animate-pulse">
                  • • •
                </span>
              ) : (
                <MarkdownView content={bubble} compact className="text-[#1b1918]" />
              )}
              <span className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-[#f6f1ea]" />
            </div>
          )}
          <div className={`flex items-center gap-1.5 rounded-full py-[3px] pl-1.5 pr-2.5 text-[12.5px] font-semibold text-[#f6f1ea] shadow-[0_2px_10px_rgba(0,0,0,0.35)] ${highlight ? 'bg-[#1b1918] ring-2 ring-[#f4a259]/70' : 'bg-[#1b1918]/80'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: meta?.color ?? '#f4a259', boxShadow: `0 0 6px ${meta?.color ?? '#f4a259'}` }} />
            {name}
            {badge && <span className="rounded-full bg-[#f4a259] px-1.5 text-[9.5px] font-bold leading-[15px] text-[#1b1918]">{badge}</span>}
            {demo && <span className="rounded-full bg-[#ffd166]/20 px-1.5 text-[9.5px] leading-[15px] text-[#ffd166]">demo</span>}
          </div>
          {role && (
            <div className="mt-0.5 rounded-full bg-[#1b1918]/60 px-2 text-[10px] leading-[16px] text-[#f6f1ea]/80 group-data-[compact=1]:hidden">
              {role}{meta ? ` · ${meta.label}` : ''}
            </div>
          )}
          {tool && (
            <div className="mt-0.5 max-w-[220px] truncate rounded-full bg-cyan-950/85 px-2 font-mono text-[10px] leading-[16px] text-cyan-200 group-data-[compact=1]:hidden">
              $ {tool}
            </div>
          )}
          {progress !== undefined && progress > 0 && (
            <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/20 group-data-[compact=1]:hidden">
              <div className="h-full rounded-full bg-[#7fd1b9] transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
