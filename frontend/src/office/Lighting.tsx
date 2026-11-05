import { Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { runtime } from '../state/runtime'
import { useOffice } from '../state/store'
import { MATS } from './materials'
import { QUALITY } from '../lib/quality'

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const DAY = new THREE.Color('#fff1dc'), NIGHT = new THREE.Color('#ffd7a8')

/** Langit malam polos (gradasi senja gelap) — tanpa lampu gedung yang menyilaukan. */
function NightSky({ on }: { on: boolean }) {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!on) return
    const c = document.createElement('canvas'); c.width = 4; c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#070912'); gr.addColorStop(0.55, '#141629'); gr.addColorStop(0.8, '#2a2238'); gr.addColorStop(1, '#3a2a35')
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256)
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
    const prev = scene.background
    scene.background = tex
    return () => { scene.background = prev; tex.dispose() }
  }, [on, scene])
  return null
}

/** Lighting mengikuti jam kantor: siang (matahari masuk lewat kaca), sore hangat, malam lampu interior. */
export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const q = QUALITY[useOffice((s) => s.quality)]
  const ambience = useOffice((s) => s.ambience)
  const [night, setNight] = useState(ambience !== 'day')
  const lamps = useRef<THREE.Group>(null!)

  useEffect(() => {
    setNight(runtime.time.dayFactor < 0.35 || ambience === 'night')
    const id = setInterval(() => setNight(runtime.time.dayFactor < 0.35), 3000)
    return () => clearInterval(id)
  }, [ambience])

  useFrame(() => {
    const t = runtime.time
    const hr = t.h + t.m / 60 + t.s / 3600
    const amb = useOffice.getState().ambience
    const day = amb === 'night' ? 0 : amb === 'day' ? 1 : smooth(5.5, 7.5, hr) * (1 - smooth(17.3, 19.3, hr))
    runtime.time.dayFactor = day
    const az = ((hr - 6) / 12) * Math.PI
    const dx = Math.cos(az) * 45, dy = 18 + Math.max(0, Math.sin(az)) * 55
    // Frustum bayangan mengikuti player (di-snap per 4 m agar tidak shimmer) → map kecil tetap tajam.
    const iso = useOffice.getState().cameraMode === 'iso'
    const p = runtime.player
    const cx = iso ? 0 : Math.round(p.x / 4) * 4, cz = iso ? 4 : Math.round(p.z / 4) * 4
    const sc = sun.current.shadow.camera
    const ext = iso ? 48 : 30
    if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix() }
    sun.current.position.set(cx + dx * day + 4 * (1 - day), dy * day + 60 * (1 - day), cz + 28 * day + 6 * (1 - day))
    sun.current.target.position.set(cx, 0, cz)
    sun.current.target.updateMatrixWorld()
    sun.current.intensity = 0.7 + day * 2.25
    sun.current.color.copy(NIGHT).lerp(DAY, day)
    hemi.current.intensity = 0.5 + (1 - day) * 0.2
    MATS.lamp.emissiveIntensity = 0.9 + (1 - day) * 2.4
    MATS.ledWarm.emissiveIntensity = 1.4 + (1 - day) * 2.2
    MATS.ledRing.emissiveIntensity = 2.0 + (1 - day) * 2.5
    if (lamps.current) for (const l of lamps.current.children) (l as THREE.PointLight).intensity = (1 - day) * 18 + 3
    MATS.skylight.emissiveIntensity = 0.1 + day * 0.7
  })

  return (
    <>
      {/* langit sedikit biru, pantulan lantai hangat → kontras warna ala game stylized */}
      <hemisphereLight ref={hemi} args={['#d6e6ff', '#b08a66', 0.5]} />
      {/* cahaya hangat dari lampu gantung cincin (tanpa bayangan → murah); dimatikan di kualitas Rendah */}
      {q.post && (
        <group ref={lamps}>
          {([[0, 6.6, -11.75], [-9.5, 7.2, -11.75], [9.5, 7.2, -11.75], [0, 5.8, 7.5], [-9, 7.5, 16.5], [6, 8, 16.5]] as const).map((p, i) => (
            <pointLight key={i} position={p} color="#ffb877" distance={20} decay={1.6} intensity={30} />
          ))}
        </group>
      )}
      {/* bounce light dari lantai → plafon tinggi tidak gelap saat dilihat dari bawah */}
      <directionalLight position={[0, -10, 2]} intensity={0.9} color="#fff1e0" />
      <directionalLight
        ref={sun} castShadow={q.shadows} intensity={2} position={[30, 50, 28]}
        shadow-mapSize={[q.shadowMap, q.shadowMap]} shadow-radius={3} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}
        shadow-camera-near={1} shadow-camera-far={220}
      />
      <NightSky on={night} />
      <Suspense fallback={null}>
        <Environment
          files={night ? '/assets/hdri/shanghai_bund.hdr' : '/assets/hdri/rooftop_day.hdr'}
          background={!night} backgroundIntensity={0.6} backgroundBlurriness={0.08} environmentIntensity={night ? 0.2 : 0.55}
          backgroundRotation={[0, Math.PI / 2, 0]} environmentRotation={[0, Math.PI / 2, 0]}
        />
      </Suspense>
    </>
  )
}
