import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ITEMS } from './layout'
import { runtime } from '../state/runtime'

const angDamp = (a: number, b: number, k: number, dt: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-k * dt))
}

// Geometri bersama untuk efisiensi render Three.js
const cushionGeo = new THREE.BoxGeometry(0.5, 0.08, 0.48)
const backrestGeo = new THREE.BoxGeometry(0.46, 0.52, 0.06)
const armrestGeo = new THREE.BoxGeometry(0.05, 0.04, 0.3)
const columnGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10)
const legGeo = new THREE.BoxGeometry(0.04, 0.03, 0.3)

// Material bersama
const fabricMat = new THREE.MeshStandardMaterial({ color: '#252e3d', roughness: 0.65, metalness: 0.1 })
const metalMat = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.35, metalness: 0.8 })
const blackMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.5, metalness: 0.2 })

interface ChairData {
  id: string
  x: number
  y: number
  z: number
  baseYaw: number
}

/**
 * Komponen kursi kantor putar dinamis (Swivel Chairs).
 * Bagian kaki roda statis menghadap orientasi awal meja, sedangkan unit dudukan + sandaran
 * memutar orientasi yaw-nya secara halus mengikuti agen atau pemain yang mendudukinya.
 */
export function SwivelChairs() {
  const chairs = useMemo<ChairData[]>(() => {
    return ITEMS.filter((it) => it.type === 'chair').map((it, idx) => ({
      id: `swivel-chair-${idx}`,
      x: it.x,
      y: it.y ?? 0,
      z: it.z,
      baseYaw: ((it.r ?? 0) * Math.PI) / 2,
    }))
  }, [])

  const topRefs = useRef<(THREE.Group | null)[]>([])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = runtime.player

    chairs.forEach((chair, i) => {
      const top = topRefs.current[i]
      if (!top) return

      let occupantYaw: number | null = null

      // 1. Cek apakah diduduki pemain manusia
      if (p.sitting && p.seatedInfo && Math.hypot(p.x - chair.x, p.z - chair.z) < 0.45) {
        occupantYaw = p.yaw
      }

      // 2. Jika tidak, cek apakah diduduki oleh salah satu agen AI
      if (occupantYaw === null) {
        for (const [, ag] of runtime.agents) {
          if (ag.visible && Math.hypot(ag.x - chair.x, ag.z - chair.z) < 0.45) {
            occupantYaw = ag.yaw
            break
          }
        }
      }

      // 3. Arahkan putaran dudukan kursi ke penghuninya, atau kembali ke orientasi default meja
      const targetYaw = occupantYaw !== null ? occupantYaw : chair.baseYaw
      top.rotation.y = angDamp(top.rotation.y, targetYaw, 10, dt)
    })
  })

  return (
    <group name="SwivelChairs">
      {chairs.map((chair, i) => (
        <group key={chair.id} position={[chair.x, chair.y, chair.z]}>
          {/* BAGIAN 1: KAKI BINTANG 5 & HIDROLIK (STATIS MENGHADAP BASE YAW) */}
          <group rotation={[0, chair.baseYaw, 0]}>
            <mesh geometry={columnGeo} material={metalMat} position={[0, 0.27, 0]} />
            {[0, 1, 2, 3, 4].map((idx) => {
              const a = (idx * 2 * Math.PI) / 5
              return (
                <mesh
                  key={idx}
                  geometry={legGeo}
                  material={metalMat}
                  position={[Math.sin(a) * 0.14, 0.06, Math.cos(a) * 0.14]}
                  rotation={[0, a, 0]}
                />
              )
            })}
          </group>

          {/* BAGIAN 2: BANTALAN DUDUKAN & SANDARAN (DINAMIS BERPUTAR MENGIKUTI OCCUPANT YAW) */}
          <group
            ref={(el) => { topRefs.current[i] = el }}
            position={[0, 0, 0]}
            rotation={[0, chair.baseYaw, 0]}
          >
            {/* Bantalan busa dudukan */}
            <mesh geometry={cushionGeo} material={fabricMat} position={[0, 0.46, 0]} castShadow receiveShadow />
            {/* Sandaran punggung ergonomis */}
            <mesh geometry={backrestGeo} material={fabricMat} position={[0, 0.8, -0.23]} castShadow />
            {/* Sandaran tangan kiri & kanan */}
            <mesh geometry={armrestGeo} material={blackMat} position={[0.26, 0.64, 0]} />
            <mesh geometry={armrestGeo} material={blackMat} position={[-0.26, 0.64, 0]} />
          </group>
        </group>
      ))}
    </group>
  )
}
