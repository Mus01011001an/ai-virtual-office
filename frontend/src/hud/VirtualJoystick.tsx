import { useRef, useState } from 'react'
import { runtime } from '../state/runtime'
import { isTouchOrIPad } from '../camera/CameraRig'
import { isUiBlocking, useOffice } from '../state/store'

const MAX_RADIUS = 46
const DEADZONE = 0.08

export function VirtualJoystick() {
  const entered = useOffice((s) => s.entered)
  const isBlocking = isUiBlocking()
  const [active, setActive] = useState(false)
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const baseRef = useRef<HTMLDivElement>(null)
  const touchIdRef = useRef<number | null>(null)
  const centerRef = useRef({ x: 0, y: 0 })

  // Tampil jika perangkat layar sentuh / mobile atau iPad saat masuk kantor dan tidak ada modal fullscreen memblokir
  const isTouchDevice = typeof window !== 'undefined' && (isTouchOrIPad() || window.innerWidth < 1024)
  if (!entered || !isTouchDevice || isBlocking) return null

  const handlePointerDown = (e: React.PointerEvent) => {
    if (touchIdRef.current !== null) return
    touchIdRef.current = e.pointerId
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    setActive(true)

    if (baseRef.current) {
      const rect = baseRef.current.getBoundingClientRect()
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
    }
    updateKnob(e.clientX, e.clientY)
  }

  const updateKnob = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x
    const dy = clientY - centerRef.current.y
    const dist = Math.hypot(dx, dy)
    const clampedDist = Math.min(dist, MAX_RADIUS)
    const angle = Math.atan2(dy, dx)

    const knobX = Math.cos(angle) * clampedDist
    const knobY = Math.sin(angle) * clampedDist
    setKnobPos({ x: knobX, y: knobY })

    // Normalisasi vector
    const normDist = clampedDist / MAX_RADIUS
    if (normDist < DEADZONE) {
      runtime.virtualJoystick = { x: 0, y: 0 }
    } else {
      const scaled = (normDist - DEADZONE) / (1 - DEADZONE)
      const nx = Math.cos(angle) * scaled
      const ny = -Math.sin(angle) * scaled // Balik Y karena pada Three.js maju adalah koordinat positif
      runtime.virtualJoystick = { x: nx, y: ny }
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (touchIdRef.current !== e.pointerId) return
    updateKnob(e.clientX, e.clientY)
  }

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (touchIdRef.current !== e.pointerId) return
    touchIdRef.current = null
    setActive(false)
    setKnobPos({ x: 0, y: 0 })
    runtime.virtualJoystick = { x: 0, y: 0 }
  }

  const triggerJump = (ev: React.MouseEvent | React.TouchEvent) => {
    ev.stopPropagation()
    const p = runtime.player
    if (p.grounded) {
      // Simulate space jump in Player.tsx
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 80)
    }
  }

  return (
    <>
      {/* Base Joystick Lingkaran Kiri Bawah */}
      <div
        className="pointer-events-auto fixed bottom-6 left-6 z-40 touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={baseRef}
          className={`relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-md shadow-2xl transition-opacity ${
            active ? 'opacity-95' : 'opacity-75'
          }`}
        >
          {/* Arah Mata Angin Halus */}
          <span className="pointer-events-none absolute top-2 text-[10px] font-bold text-white/40">▲</span>
          <span className="pointer-events-none absolute bottom-2 text-[10px] font-bold text-white/40">▼</span>
          <span className="pointer-events-none absolute left-2 text-[10px] font-bold text-white/40">◀</span>
          <span className="pointer-events-none absolute right-2 text-[10px] font-bold text-white/40">▶</span>

          {/* Knob Thumbstick */}
          <div
            className="pointer-events-none absolute h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-white/50 bg-gradient-to-br from-accent to-[#e76f51] shadow-[0_4px_16px_rgba(244,162,89,0.55)] transition-transform duration-75"
            style={{
              transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
            }}
          >
            <div className="absolute inset-1.5 rounded-full border border-white/25 bg-white/10" />
          </div>
        </div>
      </div>

      {/* Mobile Action Cluster Kanan Bawah (Lompat & Kamera) */}
      <div className="pointer-events-auto fixed bottom-6 right-6 z-40 flex items-center gap-2 touch-none">
        <button
          onClick={triggerJump}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/45 backdrop-blur-md text-bone active:scale-90 transition-transform shadow-xl font-bold text-lg"
          title="Lompat"
        >
          ⏫
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            useOffice.getState().cycleCamera()
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/45 backdrop-blur-md text-bone active:scale-90 transition-transform shadow-xl text-base"
          title="Ganti Mode Kamera"
        >
          📷
        </button>
      </div>
    </>
  )
}
