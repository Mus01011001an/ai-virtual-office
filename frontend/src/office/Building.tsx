import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { buildColliders, buildStatic } from './architecture'
import { matFor, NO_CAST, NO_SHADOW } from './materials'
import { BUILDING, MEZZ_Y, MEZZANINE, ZONES, type FloorKind } from './layout'
import { runtime } from '../state/runtime'
import { useOffice } from '../state/store'

const TEX = '/assets/textures/'

/** Marmer gelap prosedural (canvas) — urat terang tipis + garis nat ubin besar. */
function marbleTexture() {
  const S = 1024
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = '#2c2c30'; g.fillRect(0, 0, S, S)
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = 40 + rnd() * 160
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    const v = rnd() < 0.5 ? '255,255,255' : '0,0,0'
    gr.addColorStop(0, `rgba(${v},${0.025 + rnd() * 0.03})`); gr.addColorStop(1, `rgba(${v},0)`)
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let k = 0; k < 16; k++) {
    let x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2
    g.strokeStyle = `rgba(220,215,205,${0.08 + rnd() * 0.18})`; g.lineWidth = 0.6 + rnd() * 1.8
    g.beginPath(); g.moveTo(x, y)
    for (let i = 0; i < 90; i++) { a += (rnd() - 0.5) * 0.5; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y) }
    g.stroke()
  }
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3
  for (const p of [0, S / 2, S]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke() }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

function useFloorMaterials() {
  const [wd, wn, wr, cd, cn, cr] = useTexture([
    `${TEX}wood_floor_worn_diff.jpg`, `${TEX}wood_floor_worn_nor_gl.jpg`, `${TEX}wood_floor_worn_rough.jpg`,
    `${TEX}concrete_floor_painted_diff.jpg`, `${TEX}concrete_floor_painted_nor_gl.jpg`, `${TEX}concrete_floor_painted_rough.jpg`,
  ])
  return useMemo(() => {
    for (const t of [wd, wn, wr, cd, cn, cr]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4 }
    wd.colorSpace = cd.colorSpace = THREE.SRGBColorSpace
    const m: Record<FloorKind | 'paving', THREE.Material> = {
      wood: new THREE.MeshStandardMaterial({ map: wd, normalMap: wn, roughnessMap: wr, color: '#e0c8a8', roughness: 0.75, normalScale: new THREE.Vector2(0.6, 0.6) }),
      concrete: new THREE.MeshStandardMaterial({ map: cd, normalMap: cn, roughnessMap: cr, color: '#d8d6d2', roughness: 0.6 }),
      paving: new THREE.MeshStandardMaterial({ map: cd, normalMap: cn, roughnessMap: cr, color: '#b9b4ab', roughness: 0.9 }),
      carpet: new THREE.MeshStandardMaterial({ color: '#3b4458', roughness: 1 }),
      carpetBlue: new THREE.MeshStandardMaterial({ color: '#2d5079', roughness: 1 }),
      carpetGreen: new THREE.MeshStandardMaterial({ color: '#3e6a58', roughness: 1 }),
      tile: new THREE.MeshStandardMaterial({ map: cd, color: '#eeeeea', roughness: 0.35 }),
      // marmer gelap mengilap: pantulan dari environment map (murah, tanpa render pass tambahan)
      marble: new THREE.MeshStandardMaterial({ map: marbleTexture(), color: '#ffffff', roughness: 0.3, metalness: 0.05, envMapIntensity: 0.9 }),
      tileDark: new THREE.MeshStandardMaterial({ map: cd, color: '#4a4f57', roughness: 0.4, metalness: 0.2 }),
    }
    return m
  }, [wd, wn, wr, cd, cn, cr])
}

function floorGeo(w: number, d: number, tile = 2.5) {
  const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile))
  return g
}

export function Building() {
  const { main, upper } = useMemo(() => buildStatic(), [])
  const iso = useOffice((s) => s.cameraMode === 'iso')
  const paverTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#b8b3aa'; g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3) }
    g.strokeStyle = '#8f8a82'; g.lineWidth = 3
    for (let i = 0; i <= 256; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke() }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })
  }, [])
  const floors = useFloorMaterials()
  const zoneGeos = useMemo(() => ZONES.map((z) => ({ z, g: floorGeo(z.x1 - z.x0, z.z1 - z.z0, z.floor === 'marble' ? 4.8 : 2.5) })), [])
  const mezzGeos = useMemo(() => MEZZANINE.map((m) => ({ m, g: floorGeo(m.x1 - m.x0, m.z1 - m.z0) })), [])
  const terrace = useMemo(() => floorGeo(76, 18, 1.6), [])

  return (
    <group>
      {main.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} material={matFor(key)}
          castShadow={!NO_SHADOW.has(key) && !NO_CAST.has(key)} receiveShadow={!NO_SHADOW.has(key)} />
      ))}
      <group visible={!iso}>
        {upper.map(({ key, geometry }) => (
          <mesh key={key} geometry={geometry} material={matFor(key)} castShadow={false} receiveShadow={!NO_SHADOW.has(key)} />
        ))}
      </group>
      {zoneGeos.map(({ z, g }) => (
        <mesh key={z.id} geometry={g} material={floors[z.floor]} position={[(z.x0 + z.x1) / 2, 0.004, (z.z0 + z.z1) / 2]} receiveShadow />
      ))}
      {mezzGeos.map(({ m, g }, i) => (
        <mesh key={i} geometry={g} material={floors.wood} position={[(m.x0 + m.x1) / 2, MEZZ_Y + 0.003, (m.z0 + m.z1) / 2]} receiveShadow />
      ))}
      <mesh geometry={terrace} material={paverTex} position={[0, 0.002, 20 + 9]} receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#6d9150" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[BUILDING.x1 - BUILDING.x0 + 8, BUILDING.z1 - BUILDING.z0 + 8]} />
        <meshStandardMaterial color="#8d8a84" roughness={0.95} />
      </mesh>
    </group>
  )
}

export function Colliders() {
  const list = useMemo(() => buildColliders(), [])
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[60, 0.5, 60]} position={[0, -0.5, 5]} />
      {list.map((c, i) => (
        <CuboidCollider
          key={i} args={c.half} position={c.pos} rotation={[0, 0, c.rotZ ?? 0]}
          ref={c.glass ? (col) => { if (col) runtime.glassHandles.add(col.handle) } : undefined}
        />
      ))}
    </RigidBody>
  )
}
