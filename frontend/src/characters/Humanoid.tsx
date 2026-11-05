import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Appearance } from '../state/types'
import { poseAt, type Pose, type PoseName } from './poses'

/*
 * Karakter stylized prosedural.
 * Tiap segmen tubuh (per sendi) = SATU mesh hasil merge dengan vertex color, dan semua karakter
 * berbagi SATU material → detail tinggi (wajah, rambut, jas, sepatu) dengan ~11 draw call/karakter.
 * Pivot sendi identik dengan poses.ts (hips 0.95, bahu ±0.215, siku -0.29, lutut -0.43).
 */

// ---------- material bersama (vertex color + rim light fresnel) ----------
const RIM = { value: new THREE.Color('#cfe8ff').multiplyScalar(0.5) }
const BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 })
BODY_MAT.onBeforeCompile = (sh) => {
  sh.uniforms.rimColor = RIM
  sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
  float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
  totalEmissiveRadiance += rimColor * rimF * (diffuseColor.rgb * 1.5 + 0.18);`,
  )
}
BODY_MAT.customProgramCacheKey = () => 'avo-body-rim'

// ---------- geometri dasar ----------
type V3 = [number, number, number]
const lathe = (pts: [number, number][], seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)

/** Tungkai meruncing dengan ujung membulat, dari y=0 (atas, rTop) ke y=-len (bawah, rBot). */
const limbCache = new Map<string, THREE.BufferGeometry>()
function limb(rTop: number, rBot: number, len: number) {
  const k = `${rTop}|${rBot}|${len}`
  let g = limbCache.get(k)
  if (g) return g
  const pts: [number, number][] = []
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2); pts.push([Math.max(1e-4, rBot * Math.cos(a)), -len + rBot * Math.sin(a)]) }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push([Math.max(1e-4, rTop * Math.cos(a)), rTop * Math.sin(a)]) }
  g = lathe(pts, 14)
  limbCache.set(k, g)
  return g
}

const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 18),
  hairCap: new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
  // badan: pinggang → dada → bahu (V-shape), dilihat dari samping dipipihkan
  torso: lathe([[0.001, -0.06], [0.145, -0.05], [0.15, 0.06], [0.165, 0.17], [0.188, 0.29], [0.196, 0.37], [0.18, 0.43], [0.125, 0.48], [0.06, 0.505], [0.001, 0.51]]),
  pelvis: lathe([[0.001, -0.09], [0.1, -0.085], [0.155, -0.04], [0.162, 0.03], [0.15, 0.1], [0.001, 0.11]]),
  shoe: new THREE.CapsuleGeometry(1, 1.6, 6, 12),
  head: headGeometry(),
}

/** Kepala dari satu sphere yang dideformasi: rahang meruncing, dagu sedikit maju, belakang kepala penuh. */
function headGeometry() {
  const g = new THREE.SphereGeometry(1, 28, 22)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    if (y < 0.1) {
      const t = (0.1 - y) / 1.1 // 0 di pipi → 1 di dagu
      x *= 1 - 0.34 * t * t
      if (z > 0) z = z * (1 - 0.12 * t) + 0.1 * t * z
      else z *= 1 - 0.3 * t
    }
    if (z < 0 && y > -0.2) z *= 1.06 // tengkorak belakang
    p.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

// ---------- utilitas warna ----------
const shade = (hex: string, f: number) => {
  const c = new THREE.Color(hex)
  return f < 1 ? c.multiplyScalar(f) : c.lerp(new THREE.Color('#ffffff'), f - 1)
}
type Col = string | THREE.Color

interface Part { g: THREE.BufferGeometry; c: Col; p?: V3; r?: V3; s?: V3 | number }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3()

function merge(parts: Part[]) {
  const geos = parts.map(({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = 1 }) => {
    const x = g.clone()
    for (const name of Object.keys(x.attributes)) if (name !== 'position' && name !== 'normal') x.deleteAttribute(name)
    const sc = typeof s === 'number' ? [s, s, s] as V3 : s
    _m.compose(_v.set(...p), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(...sc))
    x.applyMatrix4(_m)
    const col = typeof c === 'string' ? new THREE.Color(c) : c
    const n = x.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b }
    x.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return x
  })
  const out = mergeGeometries(geos, false)!
  geos.forEach((g) => g.dispose())
  out.computeBoundingSphere()
  return out
}

// ---------- perakitan tubuh per appearance (di-cache) ----------
interface BodyGeos {
  hips: THREE.BufferGeometry; spine: THREE.BufferGeometry; head: THREE.BufferGeometry
  upperL: THREE.BufferGeometry; upperR: THREE.BufferGeometry; foreL: THREE.BufferGeometry; foreR: THREE.BufferGeometry
  thigh: THREE.BufferGeometry; shin: THREE.BufferGeometry
}
const bodyCache = new Map<string, BodyGeos>()

function buildBody(ap: Appearance): BodyGeos {
  const key = JSON.stringify(ap)
  const hit = bodyCache.get(key)
  if (hit) return hit

  // variasi deterministik dari warna (tanpa mengubah tipe Appearance)
  const h = [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const skin = ap.skin, hair = ap.hair, top = ap.top, bottom = ap.bottom
  const skinShadow = shade(skin, 0.82)
  const lips = shade(skin, 0.68).lerp(new THREE.Color('#a0524a'), 0.25)
  const shirt = ap.jacket ? '#eef0f2' : top
  const tie = ['#7a2e3a', '#1f2a44', '#2f6f73', '#3b3b3f'][h % 4]
  const longSleeve = ap.jacket || h % 3 === 0
  const belt = '#1b1c1f'
  const sole = ap.shoes === '#e9e9e9' ? '#bdbdbd' : '#2a2a2c'
  const torsoZ = 0.64

  // --- hips (pinggul + ikat pinggang) ---
  const hips = merge([
    { g: G.pelvis, c: bottom, s: [1, 1, 0.7] },
    { g: G.cyl, c: belt, p: [0, 0.075, 0], s: [0.158, 0.035, 0.158 * 0.76] },
    { g: G.box, c: '#b9a27a', p: [0, 0.075, 0.118], s: [0.035, 0.026, 0.01] }, // gesper
  ])

  // --- spine (badan + leher + pakaian) ---
  const spineParts: Part[] = [
    { g: G.torso, c: top, s: [1, 1, torsoZ] },
    { g: limb(0.055, 0.058, 0.07), c: skin, p: [0, 0.575, -0.008] }, // leher
  ]
  if (ap.jacket) {
    // kemeja + dasi terlihat di bukaan jas, kerah jas (lapel) membentuk V
    spineParts.push(
      { g: G.box, c: shirt, p: [0, 0.385, 0.127], r: [-0.22, 0, 0], s: [0.085, 0.2, 0.012] },
      { g: G.box, c: tie, p: [0, 0.36, 0.136], r: [-0.2, 0, 0], s: [0.028, 0.17, 0.008] },
      { g: G.box, c: tie, p: [0, 0.455, 0.122], r: [-0.4, 0, 0.785], s: [0.03, 0.03, 0.016] },
      { g: G.box, c: shade(top, 0.82), p: [0.05, 0.37, 0.133], r: [-0.2, 0, 0.32], s: [0.035, 0.21, 0.012] },
      { g: G.box, c: shade(top, 0.82), p: [-0.05, 0.37, 0.133], r: [-0.2, 0, -0.32], s: [0.035, 0.21, 0.012] },
      { g: G.torus, c: shirt, p: [0, 0.49, -0.004], r: [Math.PI / 2 - 0.2, 0, 0], s: [0.062, 0.058, 0.09] },
      { g: G.box, c: shade(top, 0.75), p: [0, 0.08, 0.103], s: [0.01, 0.2, 0.006] }, // garis kancing
    )
  } else {
    // kaos/sweater: kerah bulat + jahitan bawah
    spineParts.push(
      { g: G.torus, c: shade(top, 0.78), p: [0, 0.485, 0], r: [Math.PI / 2 - 0.15, 0, 0], s: [0.07, 0.066, 0.08] },
      { g: G.cyl, c: shade(top, 0.88), p: [0, -0.035, 0], s: [0.149, 0.03, 0.149 * torsoZ] },
    )
    if (h % 2 === 0) spineParts.push({ g: G.box, c: shade(top, 1.25), p: [0.075, 0.33, 0.126], r: [-0.15, 0, 0], s: [0.045, 0.045, 0.006] }) // badge/logo
  }
  const spine = merge(spineParts)

  // --- head (di-pivot leher, origin = pangkal kepala) ---
  const eyeY = 0.108
  const headParts: Part[] = [
    { g: G.head, c: skin, p: [0, 0.1, 0.004], s: [0.1, 0.128, 0.108] },          // kepala + rahang
    { g: G.sphereLo, c: skinShadow, p: [0, 0.082, 0.111], r: [0.3, 0, 0], s: [0.0095, 0.017, 0.012] }, // hidung
    { g: G.sphereLo, c: skin, p: [0.099, 0.095, -0.005], s: [0.014, 0.026, 0.02] }, // telinga
    { g: G.sphereLo, c: skin, p: [-0.099, 0.095, -0.005], s: [0.014, 0.026, 0.02] },
    { g: G.box, c: lips, p: [0, 0.047, 0.099], r: [-0.3, 0, 0], s: [0.03, 0.006, 0.01] },          // mulut
  ]
  for (const sx of [1, -1]) {
    headParts.push(
      { g: G.sphereLo, c: '#f6f4ef', p: [sx * 0.036, eyeY, 0.097], s: [0.018, 0.015, 0.012] },       // sklera
      { g: G.sphereLo, c: '#2a1d16', p: [sx * 0.035, eyeY, 0.1055], s: [0.0105, 0.0115, 0.006] },        // iris
      { g: G.sphereLo, c: '#ffffff', p: [sx * 0.031, eyeY + 0.004, 0.1105], s: 0.003 },               // kilau
      { g: G.box, c: shade(hair, 0.9), p: [sx * 0.037, eyeY + 0.028, 0.1025], r: [-0.25, 0, sx * -0.1], s: [0.036, 0.008, 0.012] }, // alis
    )
  }
  // rambut
  const capR: V3 = [0.108, 0.13, 0.118]
  if (ap.hairStyle === 3) {
    headParts.push({ g: G.hairCap, c: shade(hair, 1.0), p: [0, 0.122, -0.004], r: [-0.3, 0, 0], s: [0.104, 0.124, 0.115] })
  } else {
    headParts.push(
      { g: G.hairCap, c: hair, p: [0, 0.122, -0.01], r: [-0.55, 0, 0], s: capR },
      { g: G.sphere, c: hair, p: [0, 0.13, -0.03], s: [0.106, 0.108, 0.108] }, // volume belakang-atas
    )
    if (ap.hairStyle === 0) {
      // potongan pendek dengan jambul ke samping
      headParts.push(
        { g: G.sphere, c: hair, p: [0.022, 0.215, 0.05], r: [0.3, 0, -0.35], s: [0.085, 0.035, 0.06] },
        { g: G.sphere, c: hair, p: [-0.05, 0.2, 0.06], r: [0.4, 0, 0.2], s: [0.05, 0.03, 0.05] },
      )
    } else if (ap.hairStyle === 1) {
      // panjang: poni samping + jatuh di punggung
      headParts.push(
        { g: G.sphere, c: hair, p: [0, 0.035, -0.06], s: [0.108, 0.15, 0.07] },
        { g: G.sphere, c: hair, p: [0.085, 0.07, 0.0], s: [0.035, 0.12, 0.07] },
        { g: G.sphere, c: hair, p: [-0.085, 0.07, 0.0], s: [0.035, 0.12, 0.07] },
        { g: G.sphere, c: hair, p: [0.035, 0.2, 0.07], r: [0.4, 0, -0.5], s: [0.08, 0.03, 0.05] },
      )
    } else if (ap.hairStyle === 2) {
      // cepol
      headParts.push(
        { g: G.sphere, c: hair, p: [0, 0.2, -0.105], s: 0.052 },
        { g: G.torus, c: shade(hair, 0.7), p: [0, 0.19, -0.075], r: [0.9, 0, 0], s: 0.03 },
      )
    }
  }
  if (ap.glasses) {
    for (const sx of [1, -1]) headParts.push({ g: G.torus, c: '#18191c', p: [sx * 0.037, eyeY, 0.116], s: [0.025, 0.02, 0.03] })
    headParts.push(
      { g: G.box, c: '#18191c', p: [0, eyeY + 0.004, 0.119], s: [0.022, 0.005, 0.005] },
      { g: G.box, c: '#18191c', p: [0.075, eyeY + 0.004, 0.06], r: [0, -0.15, 0], s: [0.004, 0.005, 0.1] },
      { g: G.box, c: '#18191c', p: [-0.075, eyeY + 0.004, 0.06], r: [0, 0.15, 0], s: [0.004, 0.005, 0.1] },
    )
  }
  const head = merge(headParts)

  // --- lengan ---
  const sleeve = top
  const upper = (sx: number) => merge([
    { g: G.sphere, c: sleeve, p: [sx * -0.018, -0.03, 0], s: [0.054, 0.058, 0.054] },        // bahu (deltoid)
    { g: limb(0.058, 0.047, 0.27), c: longSleeve ? sleeve : skin, p: [0, -0.02, 0] },
    ...(!longSleeve ? [{ g: limb(0.062, 0.058, 0.12), c: sleeve, p: [0, -0.01, 0] as V3 }] : []), // lengan pendek
  ])
  const fore = (sx: number) => merge([
    { g: limb(0.048, 0.039, 0.22), c: longSleeve ? sleeve : skin },
    ...(ap.jacket ? [{ g: G.cyl, c: shirt, p: [0, -0.215, 0] as V3, s: [0.042, 0.02, 0.042] as V3 }] : []), // manset
    { g: G.sphere, c: skin, p: [0, -0.275, 0.005], s: [0.03, 0.05, 0.042] },                  // telapak
    { g: G.sphere, c: skin, p: [0, -0.315, 0.012], s: [0.027, 0.032, 0.036] },                // jari
    { g: G.sphere, c: skin, p: [sx * -0.018, -0.26, 0.035], r: [0.5, 0, sx * 0.4], s: [0.014, 0.03, 0.014] }, // jempol
  ])

  // --- kaki ---
  const thigh = merge([
    { g: limb(0.088, 0.064, 0.43), c: bottom },
  ])
  const shin = merge([
    { g: limb(0.064, 0.056, 0.4), c: bottom },
    { g: G.cyl, c: shade(bottom, 0.85), p: [0, -0.395, 0], s: [0.058, 0.025, 0.058] },     // ujung celana
    { g: G.shoe, c: ap.shoes, p: [0, -0.452, 0.04], r: [Math.PI / 2, 0, 0], s: [0.05, 0.068, 0.036] },
    { g: G.box, c: sole, p: [0, -0.483, 0.042], s: [0.098, 0.016, 0.25] },
  ])

  const out = { hips, spine, head, upperL: upper(1), upperR: upper(-1), foreL: fore(1), foreR: fore(-1), thigh, shin }
  bodyCache.set(key, out)
  return out
}

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))

export function Humanoid({ appearance: ap, poseRef, seed, hideHead = false }: {
  appearance: Appearance; poseRef: MutableRefObject<PoseName>; seed: number; hideHead?: boolean
}) {
  const r = {
    hips: useRef<THREE.Group>(null!), spine: useRef<THREE.Group>(null!), head: useRef<THREE.Group>(null!),
    lS: useRef<THREE.Group>(null!), rS: useRef<THREE.Group>(null!), lE: useRef<THREE.Group>(null!), rE: useRef<THREE.Group>(null!),
    lH: useRef<THREE.Group>(null!), rH: useRef<THREE.Group>(null!), lK: useRef<THREE.Group>(null!), rK: useRef<THREE.Group>(null!),
  }
  const cur = useRef<Pose | null>(null)
  const target = useMemo(() => ({}) as Pose, [])
  const b = useMemo(() => buildBody(ap), [ap])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    poseAt(poseRef.current, t, seed, target)
    if (!cur.current) cur.current = { ...target }
    const c = cur.current
    const k = poseRef.current === 'walk' || poseRef.current === 'run' ? 18 : 9
    for (const key in target) {
      const kk = key as keyof Pose
      c[kk] = damp(c[kk], target[kk], k, Math.min(dt, 0.05))
    }
    // napas halus di dada
    const breath = 1 + Math.sin(t * 1.7 + seed) * 0.008
    r.hips.current.position.y = c.y
    r.spine.current.rotation.x = c.spineX
    r.spine.current.scale.set(1, breath, breath)
    r.head.current.rotation.set(c.headX, c.headY, 0)
    r.lS.current.rotation.set(c.lSx, 0, c.lSz); r.rS.current.rotation.set(c.rSx, 0, c.rSz)
    r.lE.current.rotation.x = c.lEx; r.rE.current.rotation.x = c.rEx
    r.lH.current.rotation.x = c.lHx; r.rH.current.rotation.x = c.rHx
    r.lK.current.rotation.x = c.lKx; r.rK.current.rotation.x = c.rKx
  })

  const arm = (side: 1 | -1) => (
    <group ref={side === 1 ? r.lS : r.rS} position={[side * 0.2, 0.43, 0]}>
      <mesh geometry={side === 1 ? b.upperL : b.upperR} material={BODY_MAT} castShadow />
      <group ref={side === 1 ? r.lE : r.rE} position={[0, -0.29, 0]}>
        <mesh geometry={side === 1 ? b.foreL : b.foreR} material={BODY_MAT} castShadow />
      </group>
    </group>
  )
  const leg = (side: 1 | -1) => (
    <group ref={side === 1 ? r.lH : r.rH} position={[side * 0.09, -0.04, 0]}>
      <mesh geometry={b.thigh} material={BODY_MAT} castShadow />
      <group ref={side === 1 ? r.lK : r.rK} position={[0, -0.43, 0]}>
        <mesh geometry={b.shin} material={BODY_MAT} castShadow />
      </group>
    </group>
  )

  return (
    <group ref={r.hips} position={[0, 0.95, 0]}>
      <mesh geometry={b.hips} material={BODY_MAT} castShadow />
      {leg(1)}{leg(-1)}
      <group ref={r.spine} position={[0, 0.08, 0]}>
        <mesh geometry={b.spine} material={BODY_MAT} castShadow />
        <group ref={r.head} position={[0, 0.562, 0]} visible={!hideHead}>
          <mesh geometry={b.head} material={BODY_MAT} castShadow />
        </group>
        {arm(1)}{arm(-1)}
      </group>
    </group>
  )
}
