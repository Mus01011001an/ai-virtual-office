import * as THREE from 'three'

const std = (color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

export const MATS = {
  wood: std('#8f6544', 0.5),
  woodLight: std('#d7b48a', 0.5),
  woodDark: std('#5a3d2a', 0.5),
  white: std('#eceae6', 0.45),
  offwhite: std('#d9d6cf', 0.8),
  wall: std('#a99a88', 0.75),
  wallAccent: std('#1c2635', 0.8),
  ext: std('#c9c6c0', 0.85),
  concrete: std('#9a9893', 0.9),
  ceiling: std('#f1efea', 0.95),
  steel: std('#3a3d42', 0.4, 0.8),
  metal: std('#a9adb3', 0.3, 0.9),
  chrome: std('#d6d9de', 0.15, 1),
  black: std('#1a1b1e', 0.5),
  screenOff: std('#08090b', 0.25, 0.2),
  fabric: std('#4a4f57', 0.95),
  fabricBlue: std('#1d5560', 0.85),
  fabricOrange: std('#e0633f', 0.95),
  fabricGreen: std('#2f7d68', 0.95),
  fabricCream: std('#cfc2a8', 0.95),
  leather: std('#3b2a22', 0.55),
  plant: std('#4f9b3e', 0.8),
  plantDark: std('#2e6f3a', 0.8),
  trunk: std('#5b4330', 0.9),
  pot: std('#d8d2c6', 0.7),
  potDark: std('#2d2f33', 0.6),
  soil: std('#3a2c22', 1),
  counter: std('#f3f1ec', 0.3),
  rack: std('#17191c', 0.45, 0.6),
  grass: std('#5d7d47', 1),
  paving: std('#a8a39a', 0.95),
  rugA: std('#2c4566', 1),
  brass: std('#c79a5b', 0.28, 1),
  stoneDark: std('#2a2a2d', 0.35, 0.05),
  woodSlat: std('#9a6a42', 0.55),
  woodDeep: std('#3b281c', 0.5),
  moss: std('#4d7a32', 0.95),
  rock: std('#3d3b39', 0.8),
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
