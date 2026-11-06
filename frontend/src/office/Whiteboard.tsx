import { useRef } from 'react'
import * as THREE from 'three'
import { useOffice } from '../state/store'
import { useCanvasTexture } from '../lib/canvas'

const font = (weight: number, size: number) =>
  `${weight} ${size}px Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif`

export function Whiteboard() {
  const wb = useOffice((s) => s.whiteboard)
  const set = useOffice((s) => s.set)
  const ref = useRef<THREE.Mesh>(null!)

  const tex = useCanvasTexture(
    1280,
    720,
    (g, W, H) => {
      // 1. Background Canvas
      g.fillStyle = '#0a0e17'
      g.fillRect(0, 0, W, H)

      // Background subtle grid lines
      g.strokeStyle = '#151e2e'
      g.lineWidth = 1
      for (let x = 0; x < W; x += 40) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke()
      }
      for (let y = 0; y < H; y += 40) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
      }

      // 2. Top Header Bar
      g.fillStyle = '#111827'
      g.fillRect(0, 0, W, 80)
      g.strokeStyle = '#1f2937'
      g.lineWidth = 2
      g.beginPath(); g.moveTo(0, 80); g.lineTo(W, 80); g.stroke()

      // Header Icon & Title
      g.fillStyle = '#38bdf8'
      g.beginPath(); g.arc(36, 40, 12, 0, Math.PI * 2); g.fill()

      g.fillStyle = '#f9fafb'
      g.font = font(700, 26)
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(`🏛️ RUANG RAPAT · ${wb.topic || 'Diskusi Tim'}`, 60, 40)

      // Consensus Meter on Top Right
      const score = Math.min(100, Math.max(0, wb.consensusScore || 0))
      const meterW = 200
      const meterH = 22
      const meterX = W - meterW - 40
      const meterY = 29

      g.fillStyle = '#1f2937'
      g.fillRect(meterX, meterY, meterW, meterH)
      const gradient = g.createLinearGradient(meterX, 0, meterX + meterW, 0)
      gradient.addColorStop(0, '#38bdf8')
      gradient.addColorStop(0.5, '#818cf8')
      gradient.addColorStop(1, '#34d399')
      g.fillStyle = gradient
      g.fillRect(meterX, meterY, (meterW * score) / 100, meterH)

      g.strokeStyle = '#374151'
      g.lineWidth = 1
      g.strokeRect(meterX, meterY, meterW, meterH)

      g.fillStyle = '#f3f4f6'
      g.font = font(700, 14)
      g.textAlign = 'right'
      g.fillText(`KONSENSUS: ${score}%`, meterX - 12, 40)

      // 3. Split Panels (Left: Debate Points, Right: Action Items)
      const splitX = W * 0.64
      g.strokeStyle = '#1f2937'
      g.beginPath(); g.moveTo(splitX, 80); g.lineTo(splitX, H - 50); g.stroke()

      // --- Left Column: Key Debate Points ---
      g.fillStyle = '#9ca3af'
      g.font = font(600, 17)
      g.textAlign = 'left'
      g.fillText('📌 POIN-POIN KUNCI PERDEBATAN', 40, 115)

      const points = wb.points.slice(-5)
      if (points.length === 0) {
        g.fillStyle = '#4b5563'
        g.font = font(400, 18)
        g.fillText('Belum ada poin debat tercatat. Mulai debat otonom via HUD.', 40, 160)
      } else {
        points.forEach((p, i) => {
          const y = 150 + i * 95

          // Stance Badge
          const s = (p.stance || 'NEUTRAL').toUpperCase()
          const color =
            s === 'PROPOSE'
              ? '#38bdf8'
              : s === 'CRITIQUE'
              ? '#fb923c'
              : s === 'SUPPORT'
              ? '#34d399'
              : s === 'SYNTHESIZE'
              ? '#c084fc'
              : '#94a3b8'

          g.fillStyle = `${color}25`
          g.fillRect(40, y - 14, 110, 24)
          g.strokeStyle = color
          g.lineWidth = 1
          g.strokeRect(40, y - 14, 110, 24)

          g.fillStyle = color
          g.font = font(700, 13)
          g.textAlign = 'center'
          g.fillText(s, 95, y)

          // Speaker Name
          g.fillStyle = '#e5e7eb'
          g.font = font(700, 17)
          g.textAlign = 'left'
          g.fillText(p.speaker, 165, y)

          // Point Content Snippet
          g.fillStyle = '#d1d5db'
          g.font = font(400, 16)
          const text = p.text.length > 72 ? p.text.slice(0, 70) + '…' : p.text
          g.fillText(text, 40, y + 30)
        })
      }

      // --- Right Column: Action Items & Decisions ---
      g.fillStyle = '#9ca3af'
      g.font = font(600, 17)
      g.textAlign = 'left'
      g.fillText('✅ ACTION ITEMS & TUGAS', splitX + 30, 115)

      const items = wb.actionItems.slice(-6)
      if (items.length === 0) {
        g.fillStyle = '#4b5563'
        g.font = font(400, 18)
        g.fillText('Tugas akan diekstrak otomatis saat rapat selesai.', splitX + 30, 160)
      } else {
        items.forEach((item, idx) => {
          const iy = 155 + idx * 68

          g.fillStyle = '#10b981'
          g.fillRect(splitX + 30, iy - 10, 18, 18)
          g.fillStyle = '#ffffff'
          g.font = font(800, 13)
          g.textAlign = 'center'
          g.fillText('✓', splitX + 39, iy)

          g.fillStyle = '#38bdf8'
          g.font = font(600, 15)
          g.textAlign = 'left'
          g.fillText(`@${item.assigneeName}`, splitX + 58, iy)

          g.fillStyle = '#e5e7eb'
          g.font = font(400, 15)
          const title = item.title.length > 36 ? item.title.slice(0, 34) + '…' : item.title
          g.fillText(title, splitX + 58, iy + 24)
        })
      }

      // 4. Footer Bar
      g.fillStyle = '#0f172a'
      g.fillRect(0, H - 48, W, 48)
      g.strokeStyle = '#1e293b'
      g.beginPath(); g.moveTo(0, H - 48); g.lineTo(W, H - 48); g.stroke()

      g.fillStyle = '#94a3b8'
      g.font = font(500, 14)
      g.textAlign = 'left'
      g.fillText(
        wb.summary ||
          `Status: Sesi Rapat Aktif · Klik Whiteboard untuk Memperbesar · Conclude untuk Terbitkan MoM`,
        40,
        H - 24,
      )

      g.textAlign = 'right'
      g.fillStyle = '#38bdf8'
      g.fillText('AI VIRTUAL OFFICE ENGINE v0.5', W - 40, H - 24)
    },
    [wb.topic, wb.consensusScore, wb.points, wb.actionItems, wb.summary],
  )

  return (
    <mesh
      ref={ref}
      position={[-29.74, 1.8, -3.5]}
      rotation-y={Math.PI / 2}
      onClick={() => set({ whiteboardOpen: true })}
    >
      <planeGeometry args={[3.2, 1.8]} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#ffffff"
        emissiveIntensity={0.88}
        toneMapped={false}
        roughness={0.25}
      />
    </mesh>
  )
}
