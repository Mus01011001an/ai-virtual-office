import { useEffect, useRef } from 'react'
import { useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { STATUS_META } from '../state/types'
import { BUILDING, WALLS, ZONES } from '../office/layout'

const W = 200, H = 150
const X0 = -34, X1 = 34, Z0 = -22, Z1 = 32
const sx = (x: number) => ((x - X0) / (X1 - X0)) * W
const sz = (z: number) => ((z - Z0) / (Z1 - Z0)) * H

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null!)
  const floor = useRef<HTMLSpanElement>(null!)
  useEffect(() => {
    const g = ref.current.getContext('2d')!
    let raf = 0
    let last = 0
    const draw = (now = 0) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 66) return // ~15 Hz cukup untuk peta
      last = now
      g.clearRect(0, 0, W, H)
      g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(sx(BUILDING.x0), sz(BUILDING.z0), sx(BUILDING.x1) - sx(BUILDING.x0), sz(BUILDING.z1) - sz(BUILDING.z0))
      for (const z of ZONES) {
        g.fillStyle = z.room ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'
        g.fillRect(sx(z.x0), sz(z.z0), sx(z.x1) - sx(z.x0), sz(z.z1) - sz(z.z0))
      }
      g.lineWidth = 1
      for (const w of WALLS) {
        if ((w.y0 ?? 0) > 1) continue
        g.strokeStyle = w.kind === 'glass' || w.kind === 'extGlass' ? 'rgba(140,200,255,0.45)' : 'rgba(255,255,255,0.55)'
        g.beginPath(); g.moveTo(sx(w.a[0]), sz(w.a[1])); g.lineTo(sx(w.b[0]), sz(w.b[1])); g.stroke()
      }
      const st = useOffice.getState()
      for (const e of st.employees) {
        const a = runtime.agents.get(e.id)
        if (!a || !a.visible) continue
        g.fillStyle = STATUS_META[e.status].color
        g.beginPath(); g.arc(sx(a.x), sz(a.z), e.id === st.selectedId ? 4.5 : 3, 0, Math.PI * 2); g.fill()
      }
      const p = runtime.player
      g.save(); g.translate(sx(p.x), sz(p.z)); g.rotate(-runtime.cam.yaw + Math.PI)
      g.fillStyle = '#f4a259'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill()
      g.restore()
      floor.current.textContent = p.y > 2 ? 'Lantai 2' : 'Lantai 1'
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="panel-soft pointer-events-auto absolute bottom-3 right-3 z-30 p-2.5">
      <div className="label mb-1 flex justify-between px-0.5"><span>Peta</span><span ref={floor} className="text-bone/70" /></div>
      <canvas ref={ref} width={W} height={H} className="block" />
    </div>
  )
}
