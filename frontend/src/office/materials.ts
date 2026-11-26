import * as THREE from 'three'

/** Palet terang & ceria (gaya kantor blocky): warna jenuh, permukaan plastik halus. */
const std = (color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

export const MATS = {
  wood: std('#c8915a', 0.45),
  woodLight: std('#ecc89a', 0.45),
  woodDark: std('#8a5a3a', 0.5),
  white: std('#fbfaf7', 0.4),
  offwhite: std('#efece6', 0.6),
  wall: std('#f3ede3', 0.65),
  wallAccent: std('#3a86ff', 0.6),
  ext: std('#e9e6df', 0.7),
  concrete: std('#9a9893', 0.9),
  ceiling: std('#fdfcfa', 0.9),
  steel: std('#5a606b', 0.4, 0.6),
  metal: std('#a9adb3', 0.3, 0.9),
  chrome: std('#d6d9de', 0.15, 1),
  black: std('#2b2d33', 0.45),
  screenOff: std('#08090b', 0.25, 0.2),
  fabric: std('#2f6fe0', 0.7),
  fabricBlue: std('#17a398', 0.7),
  fabricOrange: std('#ff7a45', 0.7),
  fabricGreen: std('#2ec27e', 0.7),
  fabricCream: std('#ffe2a8', 0.75),
  leather: std('#8b4a2b', 0.5),
  plant: std('#5cc24a', 0.7),
  plantDark: std('#2f9a45', 0.7),
  trunk: std('#5b4330', 0.9),
  pot: std('#ffffff', 0.5),
  potDark: std('#ff7a45', 0.55),
  soil: std('#3a2c22', 1),
  counter: std('#ffffff', 0.3),
  rack: std('#3a3f4a', 0.45, 0.5),
  grass: std('#6cc24a', 0.9),
  paving: std('#a8a39a', 0.95),
  rugA: std('#8338ec', 0.9),
  brass: std('#c79a5b', 0.28, 1),
  stoneDark: std('#6b7280', 0.4, 0.05),
  woodSlat: std('#e0ad74', 0.5),
  woodDeep: std('#9c6a45', 0.5),
  moss: std('#4d7a32', 0.95),
  rock: std('#8d8a86', 0.7),
  /** LED strip hangat — emissive kuat supaya tertangkap bloom */
  ledWarm: new THREE.MeshStandardMaterial({ color: '#ffd2a0', emissive: '#ffa860', emissiveIntensity: 3.2, roughness: 0.4, toneMapped: true }),
  ledRing: new THREE.MeshStandardMaterial({ color: '#fff0dc', emissive: '#ffcf96', emissiveIntensity: 4.0, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#a9bcc6', roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.3,
  }),
  railGlass: new THREE.MeshStandardMaterial({
    color: '#dbeef5', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
  }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff7e8', emissive: '#ffe6bd', emissiveIntensity: 1.6, roughness: 0.5 }),
  skylight: new THREE.MeshStandardMaterial({ color: '#dff3ff', emissive: '#cfeaff', emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false }),
  led: new THREE.MeshStandardMaterial({ color: '#0e2a1a', emissive: '#22ff88', emissiveIntensity: 2.5 }),
  tvScreen: new THREE.MeshStandardMaterial({ color: '#0b1220', emissive: '#1d3b66', emissiveIntensity: 0.6, roughness: 0.2 }),
} satisfies Record<string, THREE.Material>

export type MatKey = keyof typeof MATS | `#${string}`

const dyn = new Map<string, THREE.Material>()
/** Material dari key; key berawalan '#' = warna solid (dibuat sekali, di-cache). */
export function matFor(k: MatKey): THREE.Material {
  if (k in MATS) return MATS[k as keyof typeof MATS]
  let m = dyn.get(k)
  if (!m) { m = std(k, 1); dyn.set(k, m) }
  return m
}

/** Material yang TIDAK memberi bayangan (kaca, emissive) */
export const NO_SHADOW = new Set<string>(['glass', 'railGlass', 'skylight', 'lamp', 'led', 'tvScreen', 'ledWarm', 'ledRing'])
/** Material atap/eksterior yang tidak boleh memblokir matahari (agar interior tetap terang). */
export const NO_CAST = new Set<string>(['ceiling', 'ext', 'steel'])
