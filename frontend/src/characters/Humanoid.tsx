import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Appearance } from '../state/types'
import { poseAt, type Pose, type PoseName } from './poses'

/*
 * Karakter blocky (gaya avatar mainan): kepala kotak membulat yang besar, badan & tungkai berupa balok,
 * wajah sederhana (mata kapsul, senyum), rambut/aksesori berupa blok. Tiap segmen tubuh = SATU mesh
 * hasil merge dengan vertex color; semua karakter berbagi SATU material → ~11 draw call/karakter.
 * Proporsi blocky klasik: kaki ≈ tinggi badan, badan lebar, kepala besar (tinggi total ±1.7 m).
 * Pivot sendi sinkron dengan poses.ts: hips HIP_Y (0.64, = STAND/SIT y), spine +0.06, bahu (±0.36, 0.50),
 * siku -0.26, pinggul ±0.1275, lutut -0.31, leher 0.56. Telapak kaki tepat di y=0 saat berdiri.
 */

// ---------- material bersama: plastik halus + rim light lembut ----------
const RIM = { value: new THREE.Color('#dfeeff').multiplyScalar(0.35) }
const BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 })
BODY_MAT.onBeforeCompile = (sh) => {
  sh.uniforms.rimColor = RIM
  sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
  float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
  totalEmissiveRadiance += rimColor * rimF * (diffuseColor.rgb * 1.2 + 0.12);`,
  )
}
BODY_MAT.customProgramCacheKey = () => 'avo-blocky-rim'

// ---------- geometri dasar ----------
type V3 = [number, number, number]

const rbCache = new Map<string, THREE.BufferGeometry>()
/** Balok membulat dengan dimensi asli (radius tidak ikut terdistorsi skala). */
function rbox(w: number, h: number, d: number, r = 0.025, seg = 3) {
  const k = `${w}|${h}|${d}|${r}|${seg}`
  let g = rbCache.get(k)
  if (!g) { g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) - 1e-4); rbCache.set(k, g) }
  return g
}

const G = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  capsule: new THREE.CapsuleGeometry(1, 1.2, 4, 10),
  smile: new THREE.TorusGeometry(1, 0.17, 6, 16, Math.PI),
  band: new THREE.TorusGeometry(1, 0.06, 6, 24, Math.PI),
  disc: new THREE.CircleGeometry(1, 16, 0, Math.PI),
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
    // RoundedBoxGeometry tidak ber-index → samakan semua jadi non-indexed agar bisa di-merge
    let x = g.index ? g.toNonIndexed() : g.clone()
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

// ---------- dimensi ----------
const TORSO = { w: 0.5, h: 0.56, d: 0.26 }
const HEAD = { w: 0.44, h: 0.4, d: 0.4, r: 0.12, y: 0.22 }
const ARM = { w: 0.22, d: 0.24 }
const LEG = { w: 0.245, d: 0.25 }
export const SHOULDER_X = TORSO.w / 2 + ARM.w / 2
export const SHOULDER_Y = TORSO.h - 0.06
export const NECK_Y = TORSO.h
export const HIP_Y = 0.64
const SPINE_Y = 0.06
const HIP_X = LEG.w / 2 + 0.005
const THIGH_L = 0.31
const ELBOW_Y = -0.26
const INK = '#1d1a20'

// ---------- perakitan tubuh per appearance (di-cache) ----------
interface BodyGeos {
  hips: THREE.BufferGeometry; spine: THREE.BufferGeometry; head: THREE.BufferGeometry
  upperL: THREE.BufferGeometry; upperR: THREE.BufferGeometry; foreL: THREE.BufferGeometry; foreR: THREE.BufferGeometry
  thigh: THREE.BufferGeometry; shin: THREE.BufferGeometry
}
const bodyCache = new Map<string, BodyGeos>()

function buildFace(ap: Appearance, h: number): Part[] {
  const fz = HEAD.d / 2 + 0.002 // permukaan depan kepala
  const y = HEAD.y
  const face = (ap.face ?? h) % 4
  const parts: Part[] = []
  // mata: kapsul vertikal + kilau
  for (const sx of [1, -1]) {
    parts.push(
      { g: G.capsule, c: INK, p: [sx * 0.08, y + 0.025, fz], s: [0.022, 0.02, 0.008] },
      { g: G.sphere, c: '#ffffff', p: [sx * 0.08 - 0.007, y + 0.045, fz + 0.007], s: 0.0075 },
      { g: rbox(0.07, 0.014, 0.01, 0.006, 2), c: shade(ap.hair, 0.85), p: [sx * 0.082, y + 0.1 + (face === 3 ? -0.006 : 0), fz], r: [0, 0, face === 3 ? sx * 0.12 : sx * -0.05] }, // alis
    )
  }
  // pipi merona tipis
  for (const sx of [1, -1]) parts.push({ g: G.sphere, c: shade(ap.skin, 0.9).lerp(new THREE.Color('#ff8f8f'), 0.35), p: [sx * 0.13, y - 0.03, fz - 0.004], s: [0.03, 0.018, 0.006] })
  // mulut
  if (face === 1) {
    parts.push({ g: G.disc, c: '#5a2330', p: [0, y - 0.06, fz + 0.001], r: [0, 0, Math.PI], s: [0.052, 0.046, 1] })
  } else if (face === 2) {
    parts.push({ g: rbox(0.058, 0.013, 0.01, 0.006, 2), c: INK, p: [0, y - 0.06, fz] })
  } else {
    parts.push({ g: G.smile, c: INK, p: [0, y - 0.042, fz], r: [0, 0, Math.PI], s: [0.05, 0.036, 0.03] })
  }
  return parts
}

function buildHair(ap: Appearance): Part[] {
  const hair = ap.hair
  const top = HEAD.y + HEAD.h / 2
  const W = HEAD.w + 0.024, D = HEAD.d + 0.024
  const acc = ap.accessory ?? 'none'
  const parts: Part[] = []
  const covered = acc === 'cap' || acc === 'beanie'
  if (ap.hairStyle === 3) {
    // cepak: lapisan tipis di atas & belakang
    parts.push({ g: rbox(W - 0.01, 0.07, D - 0.01, 0.04), c: hair, p: [0, top - 0.025, -0.004] })
  } else {
    parts.push(
      { g: rbox(W, 0.1, D, 0.05), c: hair, p: [0, top - 0.02, 0] },                         // mahkota
      { g: rbox(W, 0.2, 0.08, 0.035), c: hair, p: [0, top - 0.12, -D / 2 + 0.035] },          // belakang
      { g: rbox(0.03, 0.13, D * 0.7, 0.012), c: hair, p: [W / 2 - 0.012, top - 0.1, -0.03] },  // samping
      { g: rbox(0.03, 0.13, D * 0.7, 0.012), c: hair, p: [-W / 2 + 0.012, top - 0.1, -0.03] },
    )
    if (!covered) {
      // poni miring
      parts.push({ g: rbox(W * 0.62, 0.06, 0.05, 0.025), c: shade(hair, 1.05), p: [0.05, top - 0.045, D / 2 - 0.02], r: [0.25, 0, -0.12] })
    }
    if (ap.hairStyle === 1) {
      parts.push(
        { g: rbox(W, 0.3, 0.07, 0.03), c: hair, p: [0, HEAD.y - 0.12, -D / 2 + 0.02] },            // jatuh ke punggung
        { g: rbox(0.05, 0.26, 0.1, 0.02), c: hair, p: [W / 2 - 0.01, HEAD.y - 0.06, 0.04] },
        { g: rbox(0.05, 0.26, 0.1, 0.02), c: hair, p: [-W / 2 + 0.01, HEAD.y - 0.06, 0.04] },
      )
    } else if (ap.hairStyle === 2 && !covered) {
      parts.push({ g: rbox(0.14, 0.12, 0.12, 0.05), c: hair, p: [0, top + 0.04, -0.06] })     // cepol
    }
  }
  return parts
}

function buildAccessory(ap: Appearance, h: number): Part[] {
  const acc = ap.accessory ?? 'none'
  const top = HEAD.y + HEAD.h / 2
  const W = HEAD.w + 0.03, D = HEAD.d + 0.03
  const accent = ['#e4572e', '#3a86ff', '#17a398', '#1d1a20'][h % 4]
  const parts: Part[] = []
  if (acc === 'cap') {
    parts.push(
      { g: rbox(W, 0.11, D, 0.05), c: accent, p: [0, top + 0.005, 0] },
      { g: rbox(W * 0.86, 0.022, 0.13, 0.01), c: shade(accent, 0.8), p: [0, top - 0.04, D / 2 + 0.05], r: [-0.12, 0, 0] },
      { g: G.sphere, c: shade(accent, 1.2), p: [0, top + 0.062, 0], s: 0.018 },
    )
  } else if (acc === 'beanie') {
    parts.push(
      { g: rbox(W, 0.13, D, 0.06), c: accent, p: [0, top + 0.01, 0] },
      { g: rbox(W + 0.01, 0.05, D + 0.01, 0.02), c: shade(accent, 0.8), p: [0, top - 0.055, 0] },
    )
  } else if (acc === 'headphones' || acc === 'headset') {
    const cup = '#26242a'
    parts.push({ g: G.band, c: cup, p: [0, HEAD.y + 0.02, 0], s: [W / 2 + 0.012, W / 2 + 0.02, 0.4] })
    for (const sx of acc === 'headset' ? [1] : [1, -1]) {
      parts.push(
        { g: rbox(0.05, 0.11, 0.1, 0.02), c: cup, p: [sx * (W / 2 + 0.012), HEAD.y, 0] },
        { g: rbox(0.012, 0.075, 0.07, 0.006), c: accent, p: [sx * (W / 2 + 0.04), HEAD.y, 0] },
      )
    }
    if (acc === 'headset') {
      parts.push(
        { g: rbox(0.014, 0.014, 0.17, 0.006), c: cup, p: [W / 2 - 0.01, HEAD.y - 0.06, 0.09], r: [0, -0.35, 0] },
        { g: G.sphere, c: INK, p: [W / 2 - 0.045, HEAD.y - 0.06, 0.17], s: 0.016 },
      )
    }
  }
  if (ap.glasses) {
    const fz = HEAD.d / 2 + 0.012, y = HEAD.y + 0.025
    for (const sx of [1, -1]) {
      const cx = sx * 0.08
      parts.push(
        { g: G.box, c: INK, p: [cx, y + 0.04, fz], s: [0.09, 0.012, 0.01] },
        { g: G.box, c: INK, p: [cx, y - 0.04, fz], s: [0.09, 0.012, 0.01] },
        { g: G.box, c: INK, p: [cx + 0.04, y, fz], s: [0.012, 0.09, 0.01] },
        { g: G.box, c: INK, p: [cx - 0.04, y, fz], s: [0.012, 0.09, 0.01] },
        { g: G.box, c: INK, p: [sx * (HEAD.w / 2 + 0.004), y + 0.02, 0.02], s: [0.008, 0.011, HEAD.d * 0.8] },
      )
    }
    parts.push({ g: G.box, c: INK, p: [0, y + 0.02, fz], s: [0.04, 0.01, 0.01] })
  }
  return parts
}

function buildBody(ap: Appearance): BodyGeos {
  const key = JSON.stringify(ap)
  const hit = bodyCache.get(key)
  if (hit) return hit

  const h = [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const skin = ap.skin, top = ap.top, bottom = ap.bottom
  const shirt = '#f3f4f6'
  const tie = ['#c0392b', '#1f2a44', '#17a398', '#f2c14e'][h % 4]
  const longSleeve = ap.jacket || h % 3 === 0
  const sole = ap.shoes === '#f2f2f2' || ap.shoes === '#e9e9e9' ? '#c9c9c9' : '#1a1a1c'

  // --- hips ---
  const hips = merge([
    { g: rbox(TORSO.w - 0.01, 0.14, TORSO.d - 0.005, 0.03), c: bottom, p: [0, 0.0, 0] },
    { g: rbox(TORSO.w + 0.004, 0.035, TORSO.d + 0.008, 0.012), c: '#1c1b1f', p: [0, 0.05, 0] },
    { g: rbox(0.06, 0.03, 0.01, 0.006), c: '#d6b46a', p: [0, 0.05, TORSO.d / 2 + 0.006] },
  ])

  // --- spine (badan) ---
  const fz = TORSO.d / 2
  const spineParts: Part[] = [
    { g: rbox(TORSO.w, TORSO.h, TORSO.d, 0.04), c: top, p: [0, TORSO.h / 2, 0] },
    { g: rbox(0.13, 0.06, 0.12, 0.02), c: skin, p: [0, TORSO.h + 0.01, -0.005] }, // leher
  ]
  if (ap.jacket) {
    spineParts.push(
      { g: rbox(0.15, 0.32, 0.012, 0.004), c: shirt, p: [0, TORSO.h - 0.15, fz + 0.002] },
      { g: rbox(0.04, 0.22, 0.01, 0.004), c: tie, p: [0, TORSO.h - 0.17, fz + 0.009] },
      { g: rbox(0.05, 0.035, 0.012, 0.006), c: tie, p: [0, TORSO.h - 0.045, fz + 0.01] },
      { g: rbox(0.06, 0.26, 0.012, 0.004), c: shade(top, 0.78), p: [0.075, TORSO.h - 0.14, fz + 0.006], r: [0, 0, 0.2] },
      { g: rbox(0.06, 0.26, 0.012, 0.004), c: shade(top, 0.78), p: [-0.075, TORSO.h - 0.14, fz + 0.006], r: [0, 0, -0.2] },
      { g: G.sphere, c: shade(top, 0.6), p: [0, 0.14, fz + 0.004], s: [0.012, 0.012, 0.006] },
      { g: G.sphere, c: shade(top, 0.6), p: [0, 0.08, fz + 0.004], s: [0.012, 0.012, 0.006] },
    )
  } else {
    spineParts.push(
      { g: rbox(0.16, 0.05, 0.012, 0.006), c: skin, p: [0, TORSO.h - 0.02, fz + 0.001] },                 // kerah V
      { g: rbox(TORSO.w + 0.004, 0.035, TORSO.d + 0.006, 0.012), c: shade(top, 0.85), p: [0, 0.02, 0] }, // jahitan bawah
    )
    // grafis kaos: lingkaran / garis / kantong
    const deco = h % 3
    if (deco === 0) spineParts.push({ g: G.cyl, c: shade(top, 1.35), p: [0, 0.3, fz + 0.003], r: [Math.PI / 2, 0, 0], s: [0.065, 0.006, 0.065] })
    else if (deco === 1) spineParts.push({ g: rbox(TORSO.w + 0.004, 0.05, TORSO.d + 0.006, 0.01), c: shade(top, 1.3), p: [0, 0.3, 0] })
    else spineParts.push({ g: rbox(0.08, 0.08, 0.012, 0.01), c: shade(top, 0.82), p: [0.09, 0.36, fz + 0.003] })
  }
  const spine = merge(spineParts)

  // --- head ---
  const head = merge([
    { g: rbox(HEAD.w, HEAD.h, HEAD.d, HEAD.r, 4), c: skin, p: [0, HEAD.y, 0] },
    ...buildFace(ap, h),
    ...buildHair(ap),
    ...buildAccessory(ap, h),
  ])

  // --- lengan (pivot di atas-tengah) ---
  // lengan atas: +0.06 (rata bahu) → siku; lengan bawah: siku → ujung tangan (-0.30)
  const upperLen = 0.06 - ELBOW_Y
  const sleeveLen = longSleeve ? upperLen : 0.13
  const upper = () => merge([
    { g: rbox(ARM.w, upperLen, ARM.d, 0.04), c: skin, p: [0, 0.06 - upperLen / 2, 0] },
    { g: rbox(ARM.w + 0.006, sleeveLen, ARM.d + 0.006, 0.04), c: top, p: [0, 0.06 - sleeveLen / 2, 0] },
  ])
  const fore = () => merge([
    { g: rbox(ARM.w - 0.004, 0.22, ARM.d - 0.004, 0.035), c: longSleeve ? top : skin, p: [0, -0.11, 0] },
    ...(ap.jacket ? [{ g: rbox(ARM.w + 0.002, 0.03, ARM.d + 0.002, 0.01), c: shirt, p: [0, -0.205, 0] as V3 }] : []),
    { g: rbox(ARM.w - 0.012, 0.09, ARM.d - 0.012, 0.035), c: skin, p: [0, -0.255, 0.004] }, // tangan
  ])

  // --- kaki ---
  const thigh = merge([{ g: rbox(LEG.w, THIGH_L + 0.02, LEG.d, 0.035), c: bottom, p: [0, 0.01 - THIGH_L / 2, 0] }])
  const shin = merge([
    { g: rbox(LEG.w - 0.004, 0.22, LEG.d - 0.004, 0.035), c: bottom, p: [0, -0.11, 0] },
    { g: rbox(LEG.w + 0.01, 0.09, LEG.d + 0.05, 0.035), c: ap.shoes, p: [0, -0.26, 0.025] },
    { g: rbox(LEG.w + 0.014, 0.022, LEG.d + 0.056, 0.01), c: sole, p: [0, -0.299, 0.025] },
  ])

  const out = { hips, spine, head, upperL: upper(), upperR: upper(), foreL: fore(), foreR: fore(), thigh, shin }
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
    // napas halus + sedikit bounce kepala khas avatar mainan
    const breath = 1 + Math.sin(t * 1.7 + seed) * 0.006
    r.hips.current.position.y = c.y
    r.spine.current.rotation.x = c.spineX
    r.spine.current.scale.set(1, breath, 1)
    r.head.current.rotation.set(c.headX, c.headY, Math.sin(t * 0.9 + seed) * 0.015)
    r.lS.current.rotation.set(c.lSx, 0, c.lSz); r.rS.current.rotation.set(c.rSx, 0, c.rSz)
    r.lE.current.rotation.x = c.lEx; r.rE.current.rotation.x = c.rEx
    r.lH.current.rotation.x = c.lHx; r.rH.current.rotation.x = c.rHx
    r.lK.current.rotation.x = c.lKx; r.rK.current.rotation.x = c.rKx
  })

  const arm = (side: 1 | -1) => (
    <group ref={side === 1 ? r.lS : r.rS} position={[side * SHOULDER_X, SHOULDER_Y, 0]}>
      <mesh geometry={side === 1 ? b.upperL : b.upperR} material={BODY_MAT} castShadow />
      <group ref={side === 1 ? r.lE : r.rE} position={[0, ELBOW_Y, 0]}>
        <mesh geometry={side === 1 ? b.foreL : b.foreR} material={BODY_MAT} castShadow />
      </group>
    </group>
  )
  const leg = (side: 1 | -1) => (
    <group ref={side === 1 ? r.lH : r.rH} position={[side * HIP_X, -0.02, 0]}>
      <mesh geometry={b.thigh} material={BODY_MAT} castShadow />
      <group ref={side === 1 ? r.lK : r.rK} position={[0, -THIGH_L, 0]}>
        <mesh geometry={b.shin} material={BODY_MAT} castShadow />
      </group>
    </group>
  )

  return (
    <group ref={r.hips} position={[0, HIP_Y, 0]}>
      <mesh geometry={b.hips} material={BODY_MAT} castShadow />
      {leg(1)}{leg(-1)}
      <group ref={r.spine} position={[0, SPINE_Y, 0]}>
        <mesh geometry={b.spine} material={BODY_MAT} castShadow />
        <group ref={r.head} position={[0, NECK_Y, 0]} visible={!hideHead}>
          <mesh geometry={b.head} material={BODY_MAT} castShadow />
        </group>
        {arm(1)}{arm(-1)}
      </group>
    </group>
  )
}
