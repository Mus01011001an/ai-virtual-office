// Kit 3D CC0 buatan sendiri: pengganti prop Synty POLYGON Office saat pack berbayar belum dipasang.
// Satu builder per nama prop Synty (regex), ukuran meter, depan = +z lokal, pivot di lantai.
// Konvensi potongan bangunan mengikuti layout.ts: dinding x 0..2.5 (lebar 5 m untuk varian besar),
// muka ke +z, tebal z 0..0.15; lantai/plafon 2.5×2.5 dari pojok (x,z) ke (+x,+z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blobTexture, brick, carpet, chartTexture, detailTexture, marble, pbrTexture, screenTexture, signTexture, tiles } from './textures';
import { Q } from '../quality';
import { kitModel } from './kitModels';

type V3 = [number, number, number];
const mats = new Map<string, THREE.Material>();

/** Material datar bersama (StaticBatch menggabung per material). */
export function mat(color: string, o: { emissive?: string; ei?: number; rough?: number; metal?: number; map?: THREE.Texture; name?: string; glass?: boolean; smooth?: boolean; double?: boolean } = {}) {
  const key = `${color}|${o.emissive ?? ''}|${o.ei ?? ''}|${o.rough ?? ''}|${o.metal ?? ''}|${o.map?.uuid ?? ''}|${o.name ?? ''}|${o.glass ? 1 : 0}|${o.smooth ? 's' : ''}|${o.double ? 'd' : ''}`;
  let m = mats.get(key);
  if (!m) {
    const s = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, flatShading: !o.smooth, map: o.map ?? null });
    if (o.emissive) { s.emissive = new THREE.Color(o.emissive); s.emissiveIntensity = o.ei ?? 1; if (o.map) s.emissiveMap = o.map; }
    if (o.glass) { s.transparent = true; s.opacity = 0.22; s.roughness = 0.05; s.depthWrite = false; s.name = 'Glass'; s.flatShading = false; }
    if (o.name) s.name = o.name;
    if (o.double) s.side = THREE.DoubleSide;
    mats.set(key, (m = s));
  }
  return m;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CONE = new THREE.CylinderGeometry(0.18, 0.5, 1, 10, 1, true);
const SPH = new THREE.IcosahedronGeometry(0.5, 1);

/**
 * Tepi miring (chamfer) untuk kotak prop: tepi menangkap cahaya → tidak terlihat seperti balok mainan. Hanya prop
 * (bukan dinding/lantai: sambungan antar potongan akan tampak beralur) dan bukan Low (hemat segitiga di iPad).
 */
let BEVEL = false;
const chamferCache = new Map<string, THREE.BufferGeometry>();
/** Kotak w×h×d (berpusat) dengan tepi miring `c` m: 6 muka + 12 tepi + 8 sudut = 44 segitiga, normal per muka. */
function chamferBox(w: number, h: number, d: number, c: number) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${c.toFixed(4)}`;
  const hit = chamferCache.get(key);
  if (hit) return hit;
  const hx = w / 2, hy = h / 2, hz = d / 2, ix = hx - c, iy = hy - c, iz = hz - c;
  const pos: number[] = [];
  const tri = (a: V3, b: V3, q: V3, n: V3) => {
    const cx = (b[1] - a[1]) * (q[2] - a[2]) - (b[2] - a[2]) * (q[1] - a[1]);
    const cy = (b[2] - a[2]) * (q[0] - a[0]) - (b[0] - a[0]) * (q[2] - a[2]);
    const cz = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) pos.push(...a, ...q, ...b); else pos.push(...a, ...b, ...q);
  };
  const quad = (a: V3, b: V3, q: V3, e: V3, n: V3) => { tri(a, b, q, n); tri(a, q, e, n); };
  for (const s of [-1, 1]) {
    quad([s * hx, -iy, -iz], [s * hx, iy, -iz], [s * hx, iy, iz], [s * hx, -iy, iz], [s, 0, 0]);
    quad([-ix, s * hy, -iz], [ix, s * hy, -iz], [ix, s * hy, iz], [-ix, s * hy, iz], [0, s, 0]);
    quad([-ix, -iy, s * hz], [ix, -iy, s * hz], [ix, iy, s * hz], [-ix, iy, s * hz], [0, 0, s]);
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    quad([-ix, a * hy, b * iz], [ix, a * hy, b * iz], [ix, a * iy, b * hz], [-ix, a * iy, b * hz], [0, a, b]);
    quad([a * hx, -iy, b * iz], [a * hx, iy, b * iz], [a * ix, iy, b * hz], [a * ix, -iy, b * hz], [a, 0, b]);
    quad([a * hx, b * iy, -iz], [a * hx, b * iy, iz], [a * ix, b * hy, iz], [a * ix, b * hy, -iz], [a, b, 0]);
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const q of [-1, 1]) tri([a * hx, b * iy, q * iz], [a * ix, b * hy, q * iz], [a * ix, b * iy, q * hz], [a, b, q]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  chamferCache.set(key, g);
  return g;
}
const bevelable = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial;
  return !s.transparent && s.name !== 'Screen' && (!s.map || !!s.userData.boxUV);
};

/** Kotak dari rentang [x0,x1] [y0,y1] [z0,z1]. */
function r(g: THREE.Object3D, m: THREE.Material, x: [number, number], y: [number, number], z: [number, number]) {
  const w = Math.max(x[1] - x[0], 0.001), h = Math.max(y[1] - y[0], 0.001), d = Math.max(z[1] - z[0], 0.001);
  const min = Math.min(w, h, d);
  const c = BEVEL && min >= 0.012 && bevelable(m) ? Math.min(0.012, min * 0.22) : 0;
  const mesh = new THREE.Mesh(c ? chamferBox(w, h, d, c) : BOX, m);
  if (!c) mesh.scale.set(w, h, d);
  mesh.position.set((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2);
  g.add(mesh);
  return mesh;
}
/** Kotak berpusat (x,z) di lantai y0..y0+h. */
function b(g: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x = 0, y0 = 0, z = 0) {
  return r(g, m, [x - w / 2, x + w / 2], [y0, y0 + h], [z - d / 2, z + d / 2]);
}
function cyl(g: THREE.Object3D, m: THREE.Material, rad: number, h: number, x = 0, y0 = 0, z = 0, geo = CYL) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(rad * 2, h, rad * 2);
  mesh.position.set(x, y0 + h / 2, z);
  g.add(mesh);
  return mesh;
}
function ball(g: THREE.Object3D, m: THREE.Material, s: V3, p: V3) {
  const mesh = new THREE.Mesh(SPH, m);
  mesh.scale.set(...s);
  mesh.position.set(...p);
  g.add(mesh);
  return mesh;
}
/** Bidang tipis menghadap +z (poster, layar, tanda). */
function plane(g: THREE.Object3D, m: THREE.Material, w: number, h: number, x: number, y: number, z: number) {
  return r(g, m, [x - w / 2, x + w / 2], [y - h / 2, y + h / 2], [z, z + 0.01]);
}

// ------------------------------------------------------------------ palet
const WALL: Record<string, string> = { '01': '#ad9881', '02': '#8f877b', '03': '#6a2b21', '04': '#3c3a3b' };
const C = {
  wood: '#a9774a', woodDark: '#5b3a24', woodLight: '#c9a26e', white: '#e8e4da', grey: '#8d9096', dark: '#26282d', black: '#16171a',
  metal: '#6f7378', teal: '#5a7a7a', cream: '#d8cdb4', leather: '#1d1d20', green: '#2f7a46', red: '#b8352b', glassTint: '#c7e0f4',
};
// ------------------------------------------------------------------ bahan Poly Haven (CC0, public/assets/textures)
type PbrKind = 'fabric' | 'leather' | 'wood' | 'wall' | 'ceiling';
/** `size` = meter per ulangan tekstur (UV diproyeksikan dari posisi, jadi tidak melar di kotak panjang). */
const PBR: Record<PbrKind, { file: string; diff: boolean; size: number; normal: number }> = {
  fabric: { file: 'fabric_pattern_07', diff: false, size: 0.45, normal: 0.9 },
  leather: { file: 'brown_leather', diff: true, size: 0.5, normal: 0.8 },
  wood: { file: 'wood_table_001', diff: true, size: 1.1, normal: 0.6 },
  wall: { file: 'beige_wall_001', diff: true, size: 2.5, normal: 0.9 },
  ceiling: { file: 'ceiling_interior', diff: false, size: 1.25, normal: 0.7 },
};
const pbrMats = new Map<string, THREE.Material>();
/** Bahan bertekstur asli (kain, kulit, kayu, dinding, plafon) dengan warna palet kita. Grafis Low: warna polos. */
function pbr(kind: PbrKind, color: string, map?: THREE.Texture) {
  if (!Q.pbr) return map ? mat('#ffffff', { map }) : mat(color);
  const key = `${kind}|${color}|${map?.uuid ?? ''}`;
  let m = pbrMats.get(key);
  if (!m) {
    const s = PBR[kind];
    const sm = new THREE.MeshStandardMaterial({
      color, roughness: 1, metalness: 0,
      map: map ?? (s.diff ? detailTexture(`${s.file}_diff.jpg`) : null),
      normalMap: pbrTexture(`${s.file}_nor_gl.jpg`, false), roughnessMap: pbrTexture(`${s.file}_rough.jpg`, false),
      normalScale: new THREE.Vector2(s.normal, s.normal),
    });
    sm.userData.boxUV = map ? 0 : s.size;
    sm.userData.pbrKind = kind;
    pbrMats.set(key, (m = sm));
  }
  return m;
}
/**
 * Satu material per jenis bahan (+ peta), warna palet pindah ke vertex color saat prop digabung: semua kain, semua kayu,
 * dst. jadi satu draw call per sel, bukan satu per warna.
 */
const pbrShared = new Map<string, THREE.MeshStandardMaterial>();
function pbrSharedFor(m: THREE.MeshStandardMaterial) {
  const key = `${m.userData.pbrKind}|${m.map?.uuid ?? ''}`;
  let s = pbrShared.get(key);
  if (!s) {
    s = m.clone();
    s.color.set('#ffffff');
    s.vertexColors = true;
    s.userData = { boxUV: m.userData.boxUV, pbrKind: m.userData.pbrKind, shared: true };
    pbrShared.set(key, s);
  }
  return s;
}
/** UV kotak (proyeksi per sumbu dari posisi, satuan meter) — tekstur sama besarnya di semua sisi & ukuran. */
function boxUV(g: THREE.BufferGeometry, size: number) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / size, z / size);
    else if (ax >= az) uv.setXY(i, z / size, y / size);
    else uv.setXY(i, x / size, y / size);
  }
  uv.needsUpdate = true;
}
/** Karpet: motif & warna kita + serat (normal/kekasaran) karpet Poly Haven, 1 ulangan per meter. */
const carpetMats = new Map<string, THREE.Material>();
function carpetMat(color: string) {
  if (!Q.pbr) return mat('#ffffff', { map: carpet(color), rough: 1 });
  let m = carpetMats.get(color);
  if (!m) {
    const rep = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(2.5, 2.5); return c; };
    m = new THREE.MeshStandardMaterial({ color: '#ffffff', map: carpet(color), roughness: 1, normalMap: rep(pbrTexture('dirty_carpet_nor_gl.jpg', false)), roughnessMap: rep(pbrTexture('dirty_carpet_rough.jpg', false)), normalScale: new THREE.Vector2(1.2, 1.2) });
    carpetMats.set(color, m);
  }
  return m;
}

const SKIN_SCREEN = (k: number) => mat('#ffffff', { map: screenTexture(k), emissive: '#ffffff', ei: 0.55, name: 'Screen' });

function floorMat(name: string, pal: string): THREE.Material {
  const m = floorMatRaw(name, pal);
  m.name = 'Floor';
  return m;
}
function floorMatRaw(name: string, pal: string) {
  if (/Grass/.test(name)) return mat('#2e4a2a', { rough: 1 });
  if (/Concrete/.test(name)) return mat('#7d7d78', { map: tiles('#8a8a84', 2) });
  if (/Panel/.test(name)) return mat('#ffffff', { map: tiles('#2c3a31', 4) });
  if (/Tiles/.test(name)) return mat('#ffffff', { map: tiles(pal === '01' ? '#cfcbc2' : '#8f8d87', 6), rough: 0.5 });
  if (/Carpet/.test(name)) return carpetMat(pal === '02' ? '#5e2620' : pal === '04' ? '#363942' : pal === '03' ? '#4b2a2a' : '#5a6070');
  if (/Stone/.test(name)) return stoneFloor(pal === '04' ? '#5b5650' : pal === '03' ? '#8e8274' : '#c9bfb2');
  // kayu: papan PBR (dulu 03/04 herringbone kanvas → tampak seperti balok-balok/petak mainan)
  return woodPbr(pal === '02' ? '#a87c55' : pal === '03' ? '#a87a52' : pal === '04' ? '#7a5638' : '#c29766');
}

/** Lantai batu poles (lobi): ubin besar 1,25 m, urat halus, pantulan lingkungan (kekasaran rendah). */
const stoneMats = new Map<string, THREE.MeshStandardMaterial>();
function stoneFloor(tint: string) {
  let m = stoneMats.get(tint);
  if (!m) stoneMats.set(tint, (m = new THREE.MeshStandardMaterial({ color: '#ffffff', map: marble(tint), roughness: Q.pbr ? 0.16 : 0.4, metalness: 0 })));
  return m;
}
/** Batu (puncak meja resepsionis, meja kopi): marmer tanpa nat, UV diproyeksikan per 1,2 m. */
function stoneMat(tint: string) {
  const key = `stone|${tint}`;
  let m = stoneMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: '#ffffff', map: marble(tint, false), roughness: 0.2, metalness: 0 });
    m.userData.boxUV = 1.2;
    stoneMats.set(key, m);
  }
  return m;
}

/** Lantai kayu papan dengan tekstur PBR CC0 (warna, normal, kekasaran) — jauh lebih nyata dari warna datar. */
const woodMats = new Map<string, THREE.MeshStandardMaterial>();
function woodPbr(tint: string) {
  let m = woodMats.get(tint);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: tint, map: pbrTexture('wood_floor_worn_diff.jpg', true), normalMap: pbrTexture('wood_floor_worn_nor_gl.jpg', false),
      roughnessMap: pbrTexture('wood_floor_worn_rough.jpg', false), roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8),
    });
    woodMats.set(tint, m);
  }
  return m;
}

/** Satu material bayangan kontak untuk semua prop & karakter (StaticBatch menggabungnya jadi 1 draw call). */
// Di atas karpet (puncak ≤ 2,3 cm) dengan jarak aman: dulu 1 mm di bawah puncak karpet + polygonOffset → berkedip.
export const BLOB_MAT = new THREE.MeshBasicMaterial({ color: '#000000', map: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false });
BLOB_MAT.name = 'Blob';
const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/** Bayangan lembut di lantai sesuai tapak prop yang berdiri di lantai (meja, kursi, sofa, rak, …). */
function addContactShadow(o: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(o);
  if (box.isEmpty() || box.min.y > 0.05 || box.max.y < 0.3) return;
  const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
  if (w * d < 0.04 || w * d > 14) return;
  const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
  blob.scale.set(w * 1.3 + 0.15, 1, d * 1.3 + 0.15);
  blob.position.set((box.min.x + box.max.x) / 2, 0.028, (box.min.z + box.max.z) / 2);
  o.add(blob);
}

// ------------------------------------------------------------------ bangunan
interface Hole { x0: number; x1: number; y0: number; y1: number }
const WIN: Record<string, Hole> = {
  '01': { x0: 0.35, x1: 2.15, y0: 0.9, y1: 2.4 }, '02': { x0: 0.25, x1: 2.25, y0: 0.6, y1: 2.5 },
  '04': { x0: 0.75, x1: 1.75, y0: 1.0, y1: 2.3 }, '03': { x0: 0.35, x1: 4.65, y0: 0.9, y1: 2.4 },
};

function wallSurface(style: string, pal: string) {
  if (style === 'Brick') return mat('#ffffff', { map: brick('#8e4630') });
  return pbr('wall', WALL[pal] ?? WALL['01']);
}

/** Dinding dengan satu lubang (jendela/pintu/lift). */
function wall(name: string, pal: string, len: number, hole?: Hole, kind?: 'window' | 'door' | 'elevator') {
  const g = new THREE.Group();
  const style = /Brick/.test(name) ? 'Brick' : /Trim/.test(name) ? 'Trim' : /Baseboard/.test(name) ? 'Baseboard' : 'Blank';
  const m = wallSurface(style, pal);
  const T: [number, number] = [0, 0.15];
  if (!hole) r(g, m, [0, len], [0, 3], T);
  else {
    r(g, m, [0, hole.x0], [0, 3], T);
    r(g, m, [hole.x1, len], [0, 3], T);
    if (hole.y0 > 0) r(g, m, [hole.x0, hole.x1], [0, hole.y0], T);
    r(g, m, [hole.x0, hole.x1], [hole.y1, 3], T);
    const frame = mat(kind === 'elevator' ? '#9aa0a6' : '#e6e0d2');
    const f = 0.06;
    // Kusen menutupi sisi dalam lubang 3 mm: tanpa itu muka kusen sebidang persis dengan ujung dinding (x0/x1/y1)
    // dan GPU bergantian menggambar keduanya → berkedip (z-fighting) saat kamera bergerak.
    const e = 0.003;
    r(g, frame, [hole.x0 - f, hole.x0 + e], [hole.y0, hole.y1 + f], [-0.01, 0.17]);
    r(g, frame, [hole.x1 - e, hole.x1 + f], [hole.y0, hole.y1 + f], [-0.01, 0.17]);
    r(g, frame, [hole.x0 - e, hole.x1 + e], [hole.y1 - e, hole.y1 + f], [-0.01, 0.17]);
    if (kind === 'window') {
      // ambang jendela sedikit di atas & di luar puncak dinding bawah (juga sebidang sebelumnya)
      r(g, frame, [hole.x0 - 0.05, hole.x1 + 0.05], [hole.y0 - 0.04, hole.y0 + e], [-0.03, 0.22]);
      r(g, mat(C.glassTint, { glass: true }), [hole.x0, hole.x1], [hole.y0, hole.y1], [0.07, 0.08]);
      r(g, frame, [(hole.x0 + hole.x1) / 2 - 0.025, (hole.x0 + hole.x1) / 2 + 0.025], [hole.y0, hole.y1], [0.06, 0.09]);
    }
    if (kind === 'elevator') {
      const steel = mat('#b8bcc2', { metal: 0.6, rough: 0.35 });
      r(g, steel, [hole.x0, (hole.x0 + hole.x1) / 2 - 0.01], [0, hole.y1], [0.05, 0.09]);
      r(g, steel, [(hole.x0 + hole.x1) / 2 + 0.01, hole.x1], [0, hole.y1], [0.05, 0.09]);
    }
  }
  if (style === 'Trim' || style === 'Baseboard') {
    const base = mat(style === 'Trim' ? '#4a2c1c' : '#3a2f28');
    const segs: [number, number][] = hole && hole.y0 === 0 ? [[0, hole.x0 - 0.06], [hole.x1 + 0.06, len]] : [[0, len]];
    for (const s of segs) r(g, base, s, [0, 0.12], [0.15, 0.17]);
  }
  if (style === 'Trim') r(g, mat('#efe6d2'), [0, len], [2.86, 3], [0.15, 0.19]);
  return g;
}

function blinds(state: string, h: Hole) {
  const g = new THREE.Group();
  const m = mat('#b3a58e', { rough: 0.9 });
  const z: [number, number] = [0.17, 0.19];
  if (state === 'Up') { r(g, m, [h.x0, h.x1], [h.y1 - 0.14, h.y1], [0.16, 0.22]); return g; }
  const bottom = state === 'Down' || state === 'Closed' ? h.y0 : h.y0 + (h.y1 - h.y0) * 0.15;
  const n = Math.round((h.y1 - bottom) / 0.07);
  for (let i = 0; i < n; i++) {
    const y = bottom + i * 0.07;
    r(g, m, [h.x0, h.x1], [y, y + (state === 'Open' ? 0.025 : 0.062)], z);
  }
  r(g, m, [h.x0, h.x1], [h.y1 - 0.08, h.y1], [0.16, 0.21]);
  return g;
}

function glassWall(len: number, door?: [number, number], doorH = 2.2) {
  const g = new THREE.Group();
  const frame = mat('#2b2b2f', { metal: 0.3, rough: 0.5 });
  const glass = mat(C.glassTint, { glass: true });
  r(g, frame, [0, len], [0, 0.08], [0.02, 0.13]);
  r(g, frame, [0, len], [2.92, 3], [0.02, 0.13]);
  r(g, frame, [0, 0.06], [0, 3], [0.02, 0.13]);
  r(g, frame, [len - 0.06, len], [0, 3], [0.02, 0.13]);
  // mullion tiap 1.25 m, seperti panel kaca kantor
  for (let x = 1.25; x < len - 0.1; x += 1.25) if (!door || x < door[0] - 0.05 || x > door[1] + 0.05) r(g, frame, [x - 0.025, x + 0.025], [0, 3], [0.03, 0.12]);
  if (!door) r(g, glass, [0.06, len - 0.06], [0.08, 2.92], [0.07, 0.08]);
  else {
    if (door[0] > 0.07) r(g, glass, [0.06, door[0]], [0.08, 2.92], [0.07, 0.08]);
    r(g, glass, [door[1], len - 0.06], [0.08, 2.92], [0.07, 0.08]);
    r(g, glass, [door[0], door[1]], [doorH, 2.92], [0.07, 0.08]);
    r(g, frame, [door[0], door[1]], [doorH, doorH + 0.06], [0.02, 0.13]);
    r(g, frame, [door[0] - 0.05, door[0]], [0, doorH], [0.02, 0.13]);
    r(g, frame, [door[1], door[1] + 0.05], [0, doorH], [0.02, 0.13]);
  }
  return g;
}

function doorLeaf(name: string) {
  const g = new THREE.Group();
  if (/Glass_Door/.test(name)) {
    const frame = mat('#2b2b2f', { metal: 0.3 });
    r(g, mat(C.glassTint, { glass: true }), [0.17, 1.13], [0.05, 2.15], [0.11, 0.13]);
    r(g, frame, [0.15, 1.15], [0, 0.06], [0.1, 0.14]);
    r(g, frame, [0.15, 1.15], [2.14, 2.2], [0.1, 0.14]);
    r(g, frame, [0.15, 0.19], [0, 2.2], [0.1, 0.14]);
    r(g, frame, [1.11, 1.15], [0, 2.2], [0.1, 0.14]);
    r(g, mat('#c9ccd0', { metal: 0.7 }), [1.0, 1.04], [0.9, 1.3], [0.06, 0.18]);
    return g;
  }
  if (/Large/.test(name)) {
    const dir = /_R$/.test(name) ? -1 : 1;
    const w = 0.95;
    const x = (a: number, c: number): [number, number] => (dir > 0 ? [a, c] : [-c, -a]);
    const frame = mat('#2b2b2f', { metal: 0.3 });
    r(g, mat(C.glassTint, { glass: true }), x(0.06, w - 0.06), [0.08, 2.24], [-0.01, 0.01]);
    r(g, frame, x(0, w), [0, 0.08], [-0.03, 0.03]);
    r(g, frame, x(0, w), [2.24, 2.32], [-0.03, 0.03]);
    r(g, frame, x(0, 0.06), [0, 2.32], [-0.03, 0.03]);
    r(g, frame, x(w - 0.06, w), [0, 2.32], [-0.03, 0.03]);
    r(g, mat('#c9ccd0', { metal: 0.7 }), x(w - 0.16, w - 0.12), [0.8, 1.6], [-0.08, 0.08]);
    return g;
  }
  const n = Number(name.slice(-2));
  const col = ['#cfd2cf', '#8a5a36', '#9c6c43', '#2f5a5c', '#7d8187'][(n - 1) % 5];
  const m = mat(col);
  r(g, m, [0, 1.1], [0, 2.15], [-0.025, 0.025]);
  if (n === 3) r(g, mat(C.glassTint, { glass: true }), [0.35, 0.75], [1.1, 1.9], [-0.03, 0.03]);
  r(g, mat('#c9ccd0', { metal: 0.7 }), [0.92, 1.02], [0.98, 1.03], [-0.07, 0.07]);
  return g;
}

function building(short: string, pal: string): THREE.Object3D | null {
  const n = short;
  if (n.startsWith('Floor_')) {
    const g = new THREE.Group();
    const m = floorMat(n, pal);
    r(g, m, [0, 2.5], [-0.04, 0], [0, 2.5]);
    return g;
  }
  if (/^Ceiling_(0\d)$/.test(n) || /^Ceiling_Panel_0\d$/.test(n)) {
    const g = new THREE.Group();
    const m = /Panel/.test(n) ? pbr('ceiling', '#ffffff', tiles('#6f675c', 4)) : pbr('ceiling', n.endsWith('02') ? '#4a3022' : '#5f5446');
    r(g, m, [0, 2.5], [0, 0.03], [0, 2.5]);
    return g;
  }
  if (/^Ceiling_Panel_Light/.test(n)) { const g = new THREE.Group(); b(g, mat('#3a3a3c'), 0.66, 0.02, 0.66, 0, -0.025); b(g, mat('#e9dcc4', { emissive: '#ffe2b8', ei: 0.42 }), 0.58, 0.02, 0.58, 0, -0.035); return g; }
  if (/^Ceiling_Aircon/.test(n)) { const g = new THREE.Group(); b(g, mat('#e9e7e1'), 0.9, 0.12, 0.9, 0, -0.12); b(g, mat('#9a9a96'), 0.6, 0.01, 0.6, 0, -0.13); return g; }
  if (/^Roof_Side_Corner/.test(n)) { const g = new THREE.Group(); b(g, mat('#d8d2c4'), 0.36, 0.28, 0.36, 0, 0); return g; }
  // tutup parapet di atas dinding, simetris (dulu menjorok 14 cm ke dalam ruang & sebidang dengan video wall → kedip)
  if (/^Roof_Side/.test(n)) { const g = new THREE.Group(); r(g, mat('#d8d2c4'), [0, 2.5], [0, 0.28], [-0.11, 0.11]); return g; }
  if (/^Roof/.test(n)) { const g = new THREE.Group(); r(g, mat('#3a3d44'), [0, 2.5], [0, 0.2], [-2.5, 0]); return g; }
  if (/^Elevator_01/.test(n)) { const g = new THREE.Group(); r(g, mat('#8d9299', { metal: 0.5 }), [0.1, 2.4], [0, 2.95], [-2.4, -0.1]); return g; }
  if (/^Door_/.test(n)) return doorLeaf(n);
  if (/^Glass_Door/.test(n)) return doorLeaf(n);
  if (/^Wall_Glass_Pillar/.test(n)) { const g = new THREE.Group(); r(g, mat('#2b2b2f'), [-0.05, 0.05], [0, 3.004], [-0.004, 0.154]); return g; }
  if (/^Wall_Glass_Large_Window_Blinds_(\w+)_01/.test(n)) return blinds(RegExp.$1, { x0: 0.06, x1: 4.94, y0: 0.08, y1: 2.9 });
  if (/^Wall_Glass_Window_Blinds_(\w+)_01/.test(n)) return blinds(RegExp.$1, { x0: 0.06, x1: 2.44, y0: 0.08, y1: 2.9 });
  if (/^Wall_Glass_Large_Door/.test(n)) return glassWall(5, [2.5 - 0.95, 2.5 + 0.95], 2.32);
  if (/^Wall_Glass_Large/.test(n)) return glassWall(5);
  if (/^Wall_Glass_Door/.test(n)) return glassWall(2.5, [0.15, 1.15]);
  if (/^Wall_Glass/.test(n)) return glassWall(2.5);
  if (/^Wall_Window_Blinds_(\w+)_(\d\d)/.test(n)) return blinds(RegExp.$1, WIN[RegExp.$2] ?? WIN['01']);
  if (/^Wall_\w+_Window_(\d\d)/.test(n)) { const k = RegExp.$1; return wall(n, pal, k === '03' ? 5 : 2.5, WIN[k] ?? WIN['01'], 'window'); }
  if (/^Wall_\w+_Door_Large/.test(n)) return wall(n, pal, 5, { x0: 1.55, x1: 3.45, y0: 0, y1: 2.35 }, 'door');
  if (/^Wall_\w+_Door_01/.test(n)) return wall(n, pal, 2.5, { x0: 0.7, x1: 1.8, y0: 0, y1: 2.2 }, 'door');
  if (/^Wall_\w+_Elevator/.test(n)) return wall(n, pal, 2.5, { x0: 0.7, x1: 1.8, y0: 0, y1: 2.2 }, 'elevator');
  if (/^Wall_(Blank|Trim|Baseboard|Brick)_01$/.test(n)) return wall(n, pal, 2.5);
  if (/^FeatureWall_Wood/.test(n)) {
    const g = new THREE.Group();
    // 5 mm di bawah puncak dinding: dulu puncaknya sebidang dengan list atas (crown) → garis berkedip di atas
    r(g, mat('#22150e'), [0, 2.5], [0, 2.995], [0, 0.03]);
    // bilah walnut gelap: logo kuningan bercahaya di depannya terbaca jelas
    for (let x = 0.04; x < 2.5; x += 0.125) r(g, pbr('wood', '#7e5235'), [x, x + 0.08], [0, 2.995], [0.03, 0.09]);
    return g;
  }
  if (/^FeatureWall/.test(n)) { const g = new THREE.Group(); r(g, mat(/Slate/.test(n) ? '#3e4247' : '#6d5b4a'), [0, 2.5], [0, 2.995], [0, 0.06]); return g; }
  if (/^Pillar_Metal/.test(n)) { const g = new THREE.Group(); b(g, mat('#2b2b2f'), 0.1, 3.0, 0.1); return g; }
  if (/^Pillar/.test(n)) { const g = new THREE.Group(); b(g, mat(/Exterior/.test(n) ? '#d8d2c4' : WALL['01']), 0.4, 3.28, 0.4); return g; }
  if (/^GardenEdge/.test(n)) { const g = new THREE.Group(); r(g, mat('#8a8780'), [0, 2.5], [0, 0.25], [0, 0.2]); return g; }
  if (/^WeatherCover/.test(n)) { const g = new THREE.Group(); r(g, mat('#e3ded3'), [-2.7, 2.7], [2.95, 3.2], [-1.4, 1.45]); r(g, mat('#2f6fb0'), [-2.7, 2.7], [2.9, 2.95], [1.3, 1.45]); return g; }
  if (/^Window_Awning/.test(n)) {
    const g = new THREE.Group();
    const len = /Half|Corner/.test(n) ? 2.5 : 5;
    const a = r(g, mat('#cfc9bd'), [0, len], [0, 0.05], [0, 0.7]);
    a.rotation.x = 0.25;
    return g;
  }
  // penutup jendela luar Synty (kaca, tiang, jaring): di kit ini jatuh di dalam dinding → tidak digambar
  if (/^Window_(Net|Cover)/.test(n)) return new THREE.Group();
  if (/^Stairs/.test(n)) { const g = new THREE.Group(); for (let i = 0; i < 6; i++) r(g, mat('#8a6a4a'), [0, 2.5], [0, (i + 1) * 0.18], [-i * 0.3 - 0.3, -i * 0.3]); return g; }
  return null;
}

// ------------------------------------------------------------------ furnitur
/** Bahan untuk model Blender: nama material Blender → bahan kit (Poly Haven + warna). */
const MODEL_METAL = () => mat('#26282c', { metal: 0.6, rough: 0.45, smooth: true });
const MODEL_CHROME = () => mat('#c9ccd0', { metal: 0.9, rough: 0.25, smooth: true });
const MODEL_PLASTIC = () => mat('#1d1e22', { rough: 0.55, smooth: true });
const GLOW = () => mat('#ffe9c8', { emissive: '#ffcf8f', ei: 2.4 });
const BRASS = () => mat('#b48f58', { metal: 0.9, rough: 0.3, smooth: true });
type ModelMat = 'Fabric' | 'Fabric2' | 'Leather' | 'Wood' | 'WoodDark' | 'Laminate' | 'Stone' | 'Metal' | 'Chrome' | 'Plastic' | 'Keys' | 'Brass'
  | 'Steel' | 'Glow' | 'GlowBlue' | 'Screen' | 'Glass' | 'Leaf' | 'Leaf2' | 'Pot' | 'Soil' | 'Trunk' | 'Shell';
const MODEL_DEFAULT: Record<ModelMat, () => THREE.Material> = {
  Fabric: () => pbr('fabric', '#3a3d45'), Fabric2: () => pbr('fabric', '#b9a58a'), Leather: () => pbr('leather', '#4a3022'),
  Wood: () => pbr('wood', C.wood), WoodDark: () => pbr('wood', '#4a2e1e'), Laminate: () => mat('#d9d4cb', { smooth: true }),
  Stone: () => stoneMat('#d6cec3'), Metal: MODEL_METAL, Chrome: MODEL_CHROME, Plastic: MODEL_PLASTIC,
  Keys: () => mat('#2c2e33', { rough: 0.6, smooth: true }), Brass: BRASS, Steel: () => mat('#a9adb2', { metal: 0.75, rough: 0.32, smooth: true }),
  Glow: GLOW, GlowBlue: () => mat('#9ec2ff', { emissive: '#4a7aff', ei: 1.8 }), Screen: () => SKIN_SCREEN(1),
  Glass: () => mat(C.glassTint, { glass: true }), Leaf: () => mat('#2c5a2c', { rough: 0.45, smooth: true, double: true }),
  Leaf2: () => mat('#5f7d33', { rough: 0.5, smooth: true, double: true }), Pot: () => mat('#cfc9c0', { rough: 0.7, smooth: true }),
  Soil: () => mat('#2b2018', { rough: 1 }), Trunk: () => mat('#5a4030', { rough: 0.9, smooth: true }),
  Shell: () => mat('#e4dfd5', { rough: 0.42, smooth: true }),
};
/** Bahan untuk model Blender per nama material; `m` menimpa bawaan (warna kain, kayu, layar, pot, …). */
function modelMaterials(m: Partial<Record<ModelMat, THREE.Material>>) {
  return (name: string): THREE.Material => m[name as ModelMat] ?? (MODEL_DEFAULT[name as ModelMat] ?? MODEL_METAL)();
}
/** Model Blender dengan bahan bawaan + timpaan; null bila GLB belum termuat. */
const kit = (name: string, m: Partial<Record<ModelMat, THREE.Material>> = {}) => kitModel(name, modelMaterials(m));

/** Warna cangkang kursi per jenis: 03/04 arang (teras, cetak), 09 mustard (ruang game), lainnya putih hangat. */
const SHELL: Record<number, string> = { 3: '#3b3e43', 4: '#3b3e43', 9: '#c49b45' };
function chair(kind: number) {
  const g = new THREE.Group();
  const office = kind === 5 || kind === 6 || kind === 1 || kind === 2;
  const exec = kind === 8 || kind === 10;
  // model Blender: kursi kerja beroda / direktur kulit / kursi cangkang lengkung berkaki kayu (dapur, studio, teras, game)
  if (office || exec) {
    const colM = [C.leather, '#2d2f36', C.leather, '#5b3a24', '#22252b', '#3a3d45', C.leather, '#7a4b2c', '#30343a', '#6e3b2e', '#2c4e5a'][(kind - 1) % 11];
    const model = kitModel(exec ? 'chair_exec' : 'chair_office',
      modelMaterials({ Fabric: pbr('fabric', colM), Leather: pbr('leather', exec ? (kind === 10 ? '#5a2f26' : '#6a4430') : colM === C.leather ? '#3a2a24' : colM) }));
    if (model) return model;
  } else {
    const shell = kit('chair_shell', { Shell: mat(SHELL[kind] ?? '#e4dfd5', { rough: 0.42, smooth: true }), Wood: pbr('wood', '#b0844f') });
    if (shell) return shell;
  }
  const col = [C.leather, '#2d2f36', C.leather, '#5b3a24', '#22252b', '#3a3d45', C.leather, '#7a4b2c', '#30343a', '#6e3b2e', '#2c4e5a'][(kind - 1) % 11];
  // kursi kantor: kain jaring; kursi rapat/makan/lounge: kulit
  const seat = office ? pbr('fabric', col) : pbr('leather', col);
  if (office) {
    const base = mat('#1b1c20', { metal: 0.4 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const leg = b(g, base, 0.05, 0.04, 0.32, Math.sin(a) * 0.16, 0.05, Math.cos(a) * 0.16); leg.rotation.y = a; }
    cyl(g, base, 0.03, 0.4, 0, 0.06);
    b(g, seat, 0.5, 0.09, 0.48, 0, 0.42);
    b(g, seat, 0.46, 0.62, 0.08, 0, 0.55, -0.24);
    if (kind === 5 || kind === 6) { b(g, base, 0.05, 0.04, 0.3, 0.27, 0.62, -0.02); b(g, base, 0.05, 0.04, 0.3, -0.27, 0.62, -0.02); }
    return g;
  }
  // kursi rapat / makan / lounge
  const leg = mat(kind === 8 ? C.woodDark : '#1b1c20');
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b(g, leg, 0.04, 0.44, 0.04, x, 0, z);
  b(g, seat, 0.48, 0.08, 0.48, 0, 0.44);
  b(g, seat, 0.48, 0.5, 0.07, 0, 0.5, -0.22);
  return g;
}

/**
 * Konter resepsionis (Desk_06, L): meja kerja 0,75 m di sisi resepsionis, konter tamu 0,93 m di depan (+z) dan di sisi
 * lobi (-x), panel depan kayu beralur + plint gelap. Ukuran = kotak tabrak di layout.ts (3,2 × 0,9 m + sayap 0,8 × 1,0).
 */
function receptionDesk() {
  const g = new THREE.Group();
  const front = pbr('wood', '#c08050'), top = pbr('wood', '#7a4a2e'), work = pbr('wood', '#d0a070'), kick = mat('#2a1d16');
  r(g, work, [-1.56, 1.64], [0.71, 0.75], [-0.2, 0.5]);
  r(g, work, [-1.56, -0.74], [0.71, 0.75], [-1.1, -0.2]);
  // konter tamu depan + sisi lobi
  r(g, front, [-1.56, 1.64], [0.06, 0.89], [0.52, 0.7]);
  r(g, kick, [-1.5, 1.6], [0, 0.06], [0.5, 0.66]);
  r(g, top, [-1.62, 1.7], [0.89, 0.93], [0.47, 0.75]);
  r(g, front, [-1.56, -1.38], [0.06, 0.89], [-1.1, 0.52]);
  r(g, kick, [-1.52, -1.4], [0, 0.06], [-1.06, 0.5]);
  r(g, top, [-1.62, -1.34], [0.89, 0.93], [-1.16, 0.75]);
  for (let x = -1.2; x < 1.6; x += 0.4) r(g, kick, [x, x + 0.015], [0.12, 0.83], [0.7, 0.706]);
  for (let z = -0.8; z < 0.5; z += 0.4) r(g, kick, [-1.566, -1.56], [0.12, 0.83], [z, z + 0.015]);
  // ujung & laci
  r(g, front, [1.6, 1.64], [0, 0.71], [-0.2, 0.52]);
  r(g, front, [-1.38, -0.74], [0, 0.71], [-1.12, -1.08]);
  r(g, top, [0.95, 1.5], [0.05, 0.7], [-0.15, 0.4]);
  for (const y of [0.25, 0.47]) r(g, kick, [1.0, 1.45], [y, y + 0.012], [-0.155, -0.15]);
  return g;
}

/** Kursi kulit sandaran tinggi (Chair_08, tamu resepsionis di video). */
function execChair() {
  const fromBlender = kitModel('chair_exec', modelMaterials({ Leather: pbr('leather', '#6a4430') }));
  if (fromBlender) return fromBlender;
  const g = new THREE.Group();
  const leather = pbr('leather', '#6a4430'), base = mat('#1b1c20', { metal: 0.5, rough: 0.4 });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const leg = b(g, base, 0.05, 0.04, 0.34, Math.sin(a) * 0.17, 0.05, Math.cos(a) * 0.17); leg.rotation.y = a; }
  cyl(g, base, 0.03, 0.38, 0, 0.06);
  b(g, leather, 0.56, 0.12, 0.52, 0, 0.42);
  b(g, leather, 0.52, 0.86, 0.1, 0, 0.5, -0.24);
  b(g, leather, 0.44, 0.12, 0.06, 0, 1.2, -0.22);
  for (const x of [-0.3, 0.3]) { b(g, leather, 0.07, 0.07, 0.42, x, 0.62, -0.02); b(g, base, 0.03, 0.12, 0.03, x, 0.5, 0.05); }
  return g;
}

function desk(n: number) {
  const g = new THREE.Group();
  const topCol = [C.woodLight, '#e6e1d6', C.wood, '#d8cdb4', '#cfc8bb', '#e6e1d6'][(n - 1) % 6];
  const top = n === 1 || n === 3 ? pbr('wood', topCol) : mat(topCol);
  const side = mat(n === 3 ? C.woodDark : '#b9b2a6');
  const w = n === 4 ? 1.6 : n === 5 ? 1.8 : 1.5, d = n === 4 ? 0.8 : 0.75;
  // model Blender: daun meja bertepi bulat, rangka besi, panel modesti (+ laci untuk Desk_03/04)
  const model = kitModel(n === 4 ? 'desk_160x80' : n === 5 ? 'desk_180x75' : 'desk_150x75',
    modelMaterials({ Wood: n === 1 || n === 3 ? pbr('wood', topCol) : mat(topCol, { smooth: true }), Laminate: mat('#cfcac0', { smooth: true }) }));
  if (model) {
    if (n === 4 || n === 3) { b(model, mat('#a59e92'), 0.42, 0.6, d - 0.14, w / 2 - 0.34, 0.06); for (let i = 0; i < 3; i++) b(model, mat('#2b2d31'), 0.12, 0.012, 0.012, w / 2 - 0.34, 0.2 + i * 0.18, d / 2 - 0.06); }
    return model;
  }
  b(g, top, w, 0.04, d, 0, 0.72);
  b(g, side, 0.05, 0.72, d - 0.05, -w / 2 + 0.05);
  b(g, side, 0.05, 0.72, d - 0.05, w / 2 - 0.05);
  b(g, side, w - 0.1, 0.4, 0.03, 0, 0.3, -d / 2 + 0.05);
  if (n === 4 || n === 3) b(g, mat('#a59e92'), 0.42, 0.62, d - 0.1, w / 2 - 0.3, 0.05);
  return g;
}

function monitor(g: THREE.Object3D, x: number, k: number, w = 0.55, curved = false) {
  const m = kit('monitor', { Screen: SKIN_SCREEN(k) });
  if (m) {
    m.position.x = x;
    if (w !== 0.55) m.scale.set(w / 0.556, curved ? 1.15 : 1, 1);
    g.add(m);
    return;
  }
  const body = mat('#1c1d21');
  b(g, body, 0.18, 0.015, 0.14, x, 0);
  b(g, body, 0.04, 0.16, 0.04, x, 0.01, -0.02);
  const s = r(g, body, [x - w / 2, x + w / 2], [0.12, 0.47], [-0.03, 0.0]);
  if (curved) s.rotation.y = 0;
  r(g, SKIN_SCREEN(k), [x - w / 2 + 0.015, x + w / 2 - 0.015], [0.135, 0.455], [0.0, 0.004]);
}

const PILLOW = ['#c9b48f', '#d8cdb4', '#b98a5a', '#d8cdb4', '#9aa3ad', '#3d4f47'];
function couch(n: number) {
  const g = new THREE.Group();
  const col = ['#5e6672', '#6b4a35', '#2f5a5c', '#7a2f2a', '#3d3f45', '#8a8f96'][(n - 1) % 6];
  const sofa = kit('sofa_3', { Fabric: pbr('fabric', col), Fabric2: pbr('fabric', PILLOW[(n - 1) % 6]) });
  if (sofa) { sofa.scale.x = (n === 6 ? 2.4 : 2.0) / 2.25; return sofa; }
  const m = pbr('fabric', col);
  const w = n === 6 ? 2.4 : 2.0;
  b(g, mat('#1b1c20'), w - 0.2, 0.1, 0.75, 0, 0);
  b(g, m, w, 0.3, 0.85, 0, 0.1);
  b(g, m, w, 0.45, 0.2, 0, 0.4, -0.33);
  b(g, m, 0.2, 0.25, 0.85, -w / 2 + 0.1, 0.4);
  b(g, m, 0.2, 0.25, 0.85, w / 2 - 0.1, 0.4);
  const cushion = pbr('fabric', new THREE.Color(col).offsetHSL(0, 0, 0.06).getStyle());
  b(g, cushion, w / 2 - 0.25, 0.08, 0.6, -w / 4 + 0.05, 0.4, 0.05);
  b(g, cushion, w / 2 - 0.25, 0.08, 0.6, w / 4 - 0.05, 0.4, 0.05);
  return g;
}

const POT = ['#d8d2c8', '#34363b', '#a65a3a', '#cfc6b6'];
/** Tanaman Blender: 12–14 pohon tinggi (fiddle leaf), 03/06 lidah mertua, 09/11 kecil (di rak), lainnya rimbun. */
function plant(n: number) {
  const kind = n >= 12 ? 'plant_tall' : n === 3 || n === 6 ? 'plant_snake' : n === 9 || n === 11 ? 'plant_desk' : 'plant_bush';
  const model = kit(kind, { Pot: mat(POT[n % 4], { rough: 0.7, smooth: true }) });
  if (model) {
    if (kind === 'plant_desk') model.scale.setScalar(2.0);
    else if (kind === 'plant_tall' && n === 13) model.scale.setScalar(1.08);
    return model;
  }
  const g = new THREE.Group();
  const big = n % 3 === 0 || n > 10;
  const pot = mat(['#e8e4da', '#3a3d45', '#a65a3a', '#d8cdb4'][n % 4]);
  const leaf = mat(['#3f7a3a', '#2f6a34', '#4c8a3e', '#356b40'][n % 4]);
  const h = big ? 1.4 : 0.6;
  cyl(g, pot, big ? 0.22 : 0.13, big ? 0.4 : 0.22);
  for (let i = 0; i < (big ? 7 : 5); i++) {
    const a = (i / (big ? 7 : 5)) * Math.PI * 2;
    const l = ball(g, leaf, [0.18 * (big ? 1.5 : 1), h * 0.5, 0.08], [Math.sin(a) * 0.12 * (big ? 1.6 : 1), (big ? 0.4 : 0.22) + h * 0.35, Math.cos(a) * 0.12 * (big ? 1.6 : 1)]);
    l.rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5);
  }
  return g;
}

// Lebar, tinggi papan & atap rak = ukuran model Synty (Furniture.tsx SHELF, Fitout supply rack): isi rak
// (buku/tanaman dari fillShelf) duduk tepat di papan, tidak melayang di luar rak.
const SHELF_SPEC: Record<number, [number, number[], number]> = {
  1: [1.05, [0.04, 0.45, 0.9, 1.36], 1.81], 2: [2.05, [0.36, 0.78, 1.19], 1.6], 3: [1.2, [0.03, 0.43, 0.93, 1.43], 1.93],
  4: [0.95, [0.27, 0.68], 1.09], 5: [1.2, [0.63, 0.93, 1.23], 1.52], 6: [1.25, [0.06, 0.34, 0.62], 0.89], 7: [2.95, [0.04, 0.44, 0.85, 1.25], 1.67],
};
function shelf(n: number) {
  const g = new THREE.Group();
  const m = n % 2 ? mat('#e8e4da') : pbr('wood', C.wood);
  const spec = SHELF_SPEC[n];
  const w = spec?.[0] ?? 0.9 + (n % 3) * 0.3, h = spec?.[2] ?? (n === 6 ? 1.0 : 1.9), d = 0.38;
  b(g, m, 0.03, h, d, -w / 2);
  b(g, m, 0.03, h, d, w / 2);
  // panel belakang: dari lantai ke atas, 2 mm masuk dari sisi belakang (tidak sebidang dengan panel samping)
  r(g, m, [-w / 2, w / 2], [0, h], [-d / 2 + 0.002, -d / 2 + 0.02]);
  if (spec) {
    // papan berakhir tepat di tiap level (isi rak duduk di atasnya), papan atas = atap rak
    for (const y of [...spec[1], h]) b(g, m, w - 0.004, 0.03, d - 0.004, 0, Math.max(0, y - 0.03));
    if (spec[1][0] > 0.1) b(g, m, w, 0.05, d, 0, 0);
    // Shelf_07: bilik-bilik (cubbies)
    if (n === 7) for (let i = 1; i < 6; i++) b(g, m, 0.025, h, d, -w / 2 + (i * w) / 6);
    return g;
  }
  const rows = Math.round(h / 0.38);
  for (let i = 0; i <= rows; i++) b(g, m, w - 0.004, 0.03, d - 0.004, 0, (i * (h - 0.03)) / rows);
  const cols = ['#2f5fa8', '#b8352b', '#e0b04a', '#2f7a46', '#e8e4da', '#5b3a24'];
  for (let i = 0; i < rows; i++) {
    let x = -w / 2 + 0.05;
    let k = i * 3 + n;
    while (x < w / 2 - 0.15) {
      const bw = 0.04 + ((k * 7) % 5) * 0.012;
      if ((k * 13) % 9 !== 0) b(g, mat(cols[k % cols.length]), bw, 0.22 + ((k * 5) % 4) * 0.025, 0.2, x + bw / 2, (i * (h - 0.03)) / rows + 0.03, 0.02);
      x += bw + 0.005; k++;
    }
  }
  return g;
}

function screenBoard(w: number, h: number, k: number, y: number) {
  const g = new THREE.Group();
  r(g, mat('#121316'), [-w / 2, w / 2], [y, y + h], [0, 0.06]);
  r(g, SKIN_SCREEN(k), [-w / 2 + 0.03, w / 2 - 0.03], [y + 0.03, y + h - 0.03], [0.06, 0.065]);
  return g;
}

function sign(text: string, bg: string, fg: string, w = 0.6, h = 0.16, stand = false) {
  const g = new THREE.Group();
  const m = mat('#ffffff', { map: signTexture(text, bg, fg), emissive: text === 'EXIT' ? '#ffffff' : undefined, ei: 0.6 });
  if (stand) { b(g, mat('#6b3a22'), w, h, 0.06, 0, 0); r(g, m, [-w / 2 + 0.02, w / 2 - 0.02], [0.02, h - 0.02], [0.03, 0.035]); r(g, m, [-w / 2 + 0.02, w / 2 - 0.02], [0.02, h - 0.02], [-0.035, -0.03]).rotation.y = Math.PI; }
  else r(g, m, [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.02]);
  return g;
}

function lamp(n: number) {
  const g = new THREE.Group();
  const glow = mat('#fff2d8', { emissive: '#ffd8a0', ei: 2.2 });
  if (n === 8) { b(g, mat('#2b2b2f'), 0.1, 0.25, 0.08, 0, -0.12); ball(g, glow, [0.12, 0.12, 0.12], [0, 0.05, 0.08]); return g; }
  if (n === 6 || n === 7) { cyl(g, mat('#3a3330'), 0.2, 0.06, 0, -0.06); cyl(g, mat('#fff2d8', { emissive: '#ffd8a0', ei: 1.1 }), 0.15, 0.01, 0, -0.07); return g; }
  // lampu gantung kubah (Blender), kap hitam / putih (04) / kuningan (05)
  const dome = kit('pendant_dome', { Metal: n === 4 ? mat('#e8e4da', { rough: 0.5, smooth: true }) : n === 5 ? BRASS() : MODEL_METAL() });
  if (dome) return dome;
  // lampu gantung kerucut (ikon kantor referensi)
  const shade = mat(n === 4 ? '#e8e4da' : n === 5 ? '#c9a26e' : '#2b2d31', { rough: 0.6 });
  const drop = n === 2 ? 0.9 : 0.7;
  cyl(g, mat('#111'), 0.006, drop, 0, -drop);
  const c = cyl(g, shade, 0.26, 0.3, 0, -drop - 0.3, 0, CONE);
  c.material = shade;
  cyl(g, glow, 0.12, 0.04, 0, -drop - 0.28);
  return g;
}

function pool(n: number) {
  const g = new THREE.Group();
  const wood = mat(n === 2 ? '#3b2416' : '#6b3a22');
  for (const [x, z] of [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]]) b(g, wood, 0.14, 0.62, 0.14, x, 0, z);
  b(g, wood, 2.5, 0.16, 1.4, 0, 0.62);
  b(g, mat('#2f7a46', { rough: 1 }), 2.24, 0.02, 1.14, 0, 0.78);
  return g;
}

/** Barang kecil di meja: kotak/silinder berwarna sesuai jenisnya. */
function small(n: string): THREE.Object3D | null {
  const g = new THREE.Group();
  const hit = (re: RegExp) => re.test(n);
  if (hit(/^Cup_Coffee|^Cup_(Paper|Styrofoam|Lid)/)) { cyl(g, mat('#efe9dd'), 0.04, 0.13); cyl(g, mat('#2c2c2c'), 0.042, 0.02, 0, 0.12); return g; }
  if (hit(/^Cup_Red/)) { cyl(g, mat('#c3322b'), 0.045, 0.12); return g; }
  if (hit(/^Cup|^Mug|^Can_|^EnergyDrink|^Bottle|^Milk/)) { cyl(g, mat(hit(/Boss/) ? '#e0b04a' : '#e8e4da'), 0.04, 0.1); return g; }
  if (hit(/^FruitBowl/)) { cyl(g, mat('#e8e2d6', { rough: 0.4, smooth: true }), 0.13, 0.06, 0, 0, 0, CONE); for (const [x, z, c] of [[-0.05, 0, '#b8352b'], [0.05, 0.03, '#d98a2b'], [0.01, -0.06, '#7a9a3a'], [0.04, -0.03, '#b8352b']] as [number, number, string][]) ball(g, mat(c, { rough: 0.5, smooth: true }), [0.07, 0.07, 0.07], [x, 0.07, z]); return g; }
  if (hit(/^Dishes/)) { for (let i = 0; i < 3; i++) cyl(g, mat('#efebe4', { rough: 0.35, smooth: true }), 0.12, 0.012, 0, i * 0.014); return g; }
  if (hit(/^Coffee_Tray/)) { b(g, mat('#a8875e'), 0.3, 0.02, 0.3); for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) { cyl(g, mat('#efe9dd'), 0.045, 0.16, x, 0.02, z); cyl(g, mat('#2a3b5a'), 0.047, 0.05, x, 0.08, z); } return g; }
  if (hit(/^Donut_Box|^Box_01|^Pizza/)) { b(g, mat('#e9d9b8'), 0.4, 0.07, 0.4); return g; }
  if (hit(/^Donut/)) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.025, 6, 10), mat('#d79a5b')); t.rotation.x = Math.PI / 2; t.position.y = 0.025; g.add(t); return g; }
  if (hit(/^Note_\d/)) { r(g, mat(['#f2d74e', '#f2a65a', '#f28fb0', '#8fd0f0', '#a8e07a'][Number(n.slice(-1)) % 5], { rough: 0.9 }), [-0.038, 0.038], [-0.038, 0.038], [0, 0.003]); return g; }
  if (hit(/^(Papers?|Paper_Pile|Paper_0|Note|NotePad|Folder|Clipboard|Book_Magazine|Calender|Certificate)/)) { b(g, mat(hit(/Folder_Manila/) ? '#e2c27a' : hit(/Note_/) ? '#f2e36b' : '#f2efe8'), 0.22, hit(/Pile/) ? 0.08 : 0.012, 0.3); return g; }
  if (hit(/^Book_Group/)) { const cols = ['#2f5fa8', '#b8352b', '#e0b04a', '#2f7a46', '#5b3a24']; for (let i = 0; i < 5; i++) b(g, mat(cols[i]), 0.045, 0.24, 0.17, -0.1 + i * 0.05, 0); return g; }
  if (hit(/^Computer_Keyboard/)) { const k = kit('keyboard'); if (k) return k; b(g, mat('#202126'), 0.44, 0.02, 0.14); return g; }
  if (hit(/^Computer_Mouse$|^Computer_Mouse_/)) { const m = kit('mouse'); if (m) return m; b(g, mat('#202126'), 0.06, 0.025, 0.1); return g; }
  if (hit(/^Computer_Mousepad/)) { b(g, mat('#2e3440'), 0.24, 0.004, 0.2); return g; }
  if (hit(/^(Phone_Desk|Phone_Conference|Phone_Rotary|Phone_Portable|Radio|Speaker|Modem|HDD|Calculator|FaxMachine|Typewriter|Stapler|HolePunch|Card_|Keypad|Console|Controller|VCR|Dvd|Cd_|Projector|Webcam|Headphones|Headset|Cellphone|Pencil_Sharp|JellyStapler|Lunchbox|Toaster|Kettle|Blender|Microwave|CoffeeMachine|Printer_Mini|Printer_3D|Fan_Desk|Fan_USB|Globe|Trophy|Figure|DeskToy|PuzzleCube|Sculpture|Spaceship|Flash|SD_|Floppy|Eraser|Ruler|Pen|Pencil|Scissors|Cellotape|Mints|Pills|Inhaler|ID_Card|Napkins|Soap|Snack|Sandwich|Toast|Fruit|Jellybeans|Dishes|Knife|Chopping|Pan_|Pot_|Bucket|SprayBottle|Alcohol|Party_Hat|Xmas_Present|Microphone_0[23]|Air_Horn|Prank|HDD_Dock|NetCable|Cord|Socket|Elevator_Button|Fire_Detector|FireAlarm|Security_Camera|Sprinkler|Toilet_Paper|PaperTowel|HandDryer|Folder_Holder|FolderTray|PaperTray|Cup_Pens|PencilCup|NamePlate|Desklamp|DeskLamp|LaptopStand|GraphicsTablet|Wep_|Briefcase|Container|Propane|PowerBox|Powerbox|Wall_Electronics|Guillotine|PaperRoll|CardRoller|Photo_0|Child_Art|Inbox)/)) {
    const SIZE: [RegExp, V3, string][] = [
      [/Toaster|Kettle|Blender|CoffeeMachine/, [0.28, 0.3, 0.22], '#c9ccd0'], [/Microwave/, [0.5, 0.3, 0.38], '#e8e4da'], [/Printer_Mini|Printer_3D/, [0.4, 0.4, 0.4], '#3a3d45'],
      [/Typewriter/, [0.4, 0.15, 0.35], '#3a4a5a'], [/Globe/, [0.3, 0.42, 0.3], '#3f7fb0'], [/Trophy/, [0.14, 0.34, 0.14], '#e0b04a'], [/Figure|Sculpture|Spaceship/, [0.1, 0.22, 0.1], '#7a6a8a'],
      [/Briefcase/, [0.45, 0.33, 0.12], '#4a2c1c'], [/Desklamp|DeskLamp/, [0.14, 0.45, 0.14], '#2b2d31'], [/Fan_Desk/, [0.3, 0.4, 0.2], '#d8d4cc'], [/Wall_Electronics|PowerBox|Powerbox/, [0.6, 0.8, 0.15], '#7d8187'],
      [/Security_Camera/, [0.12, 0.12, 0.25], '#e8e4da'], [/HandDryer|PaperTowel/, [0.3, 0.35, 0.18], '#e8e4da'], [/Phone_Conference/, [0.24, 0.05, 0.24], '#1c1d21'],
      [/Container|Propane|Bucket/, [0.35, 0.4, 0.35], '#3f6fa8'], [/Photo_0|Child_Art/, [0.18, 0.22, 0.03], '#e8e4da'], [/Headphones|Headset/, [0.18, 0.2, 0.08], '#202126'],
      [/Lunchbox|Snack|Sandwich|Fruit/, [0.16, 0.08, 0.12], '#d79a5b'], [/Xmas_Present|Party_Hat/, [0.2, 0.18, 0.2], '#c3322b'],
    ];
    const s = SIZE.find(([re]) => re.test(n));
    const [w, h, d] = s?.[1] ?? [0.12, 0.06, 0.1];
    b(g, mat(s?.[2] ?? '#5a5e66'), w, h, d);
    return g;
  }
  return null;
}

function furniture(n: string): THREE.Object3D | null {
  const g = new THREE.Group();
  const num = Number((n.match(/_(\d\d)/) ?? [0, '1'])[1]);
  // Alas patung lobi (1,2 × 1,2 m, tinggi 0,31) + patung abstrak perunggu di atasnya (dulu kotak ungu 10 cm).
  if (/^Sculpture_Base/.test(n)) { b(g, mat('#2f3238', { rough: 0.6 }), 1.2, 0.05, 1.2); b(g, mat('#d9d5cc', { rough: 0.45 }), 1.1, 0.26, 1.1, 0, 0.05); return g; }
  if (/^Sculpture_\d/.test(n)) { const sc = kit('sculpture_rings'); if (sc) { sc.scale.setScalar(1.25); return sc; } }
  // lobi baru (2026-11-28): konter resepsionis stadion, sofa & kursi lounge, meja kopi/samping, lampu cincin, karpet
  if (/^Reception_Desk/.test(n)) { const d = kit('reception_desk', { Stone: stoneMat('#cfc6ba') }); if (d) return d; return receptionDesk(); }
  if (/^Lobby_Sofa/.test(n)) { const s2 = kit('sofa_3', { Fabric: pbr('fabric', '#3f5249'), Fabric2: pbr('fabric', '#c9a978') }); if (s2) return s2; return couch(3); }
  if (/^Lobby_Armchair/.test(n)) { const a = kit('armchair', { Fabric: pbr('leather', '#8a5232') }); if (a) return a; return chair(8); }
  if (/^Lobby_CoffeeTable/.test(n)) { const t = kit('coffee_round', { Stone: stoneMat('#d9d1c6') }); if (t) return t; }
  if (/^Lobby_SideTable/.test(n)) { const t = kit('side_table', { Stone: stoneMat('#d9d1c6') }); if (t) return t; }
  if (/^Lobby_Pendant/.test(n)) { const l = kit('pendant_ring'); if (l) return l; return lamp(4); }
  if (/^Lobby_Rug/.test(n)) { r(g, pbr('fabric', '#8a8074'), [-1.7, 1.7], [0, 0.014], [-1.4, 1.4]); r(g, pbr('fabric', '#5e554c'), [-1.7, 1.7], [0.0005, 0.0145], [-1.4, -1.3]); r(g, pbr('fabric', '#5e554c'), [-1.7, 1.7], [0.0005, 0.0145], [1.3, 1.4]); return g; }
  if (/^Lobby_Mat/.test(n)) { r(g, mat('#2a2826', { rough: 1 }), [-1.2, 1.2], [0, 0.014], [-0.7, 0.7]); return g; }
  if (/^Sculpture_\d/.test(n)) {
    const br = mat('#b07a48', { metal: 0.7, rough: 0.35 });
    cyl(g, mat('#2b2d31'), 0.18, 0.06);
    cyl(g, br, 0.045, 0.42, 0, 0.06);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 28), br); ring.position.y = 0.82; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 24), br); ring2.position.y = 0.82; ring2.rotation.y = Math.PI / 2; g.add(ring2);
    ball(g, br, [0.16, 0.16, 0.16], [0, 0.82, 0]);
    return g;
  }
  if (/^Janitor_Bucket/.test(n)) { cyl(g, mat('#e0b43a'), 0.2, 0.32); cyl(g, mat('#2b2d31'), 0.21, 0.04, 0, 0.32); cyl(g, mat(C.woodLight), 0.015, 1.1, 0.08, 0.2); return g; }
  if (/^Desk_06/.test(n)) return receptionDesk();
  if (/^Chair_\d/.test(n) && num === 8) return execChair();
  if (/^Chair_BeanBag/.test(n)) { ball(g, pbr('fabric', ['#c3322b', '#e0a43a', '#2f6fb0', '#e07a3a'][(num - 1) % 4]), [0.9, 0.55, 0.9], [0, 0.26, 0]); return g; }
  if (/^Chair_\d/.test(n)) return chair(num);
  if (/^Desk_Treadmill/.test(n)) { b(g, mat('#2b2d31'), 0.7, 0.12, 1.5); return g; }
  if (/^Desk_Standing/.test(n)) { const d = desk(2); d.scale.y = 1.45; g.add(d); return g; }
  if (/^Desk_\d/.test(n)) return desk(num);
  if (/^Table_Conference/.test(n)) {
    const tc = kitModel('table_conference', modelMaterials({ Wood: pbr('wood', num === 2 ? '#6a4128' : '#9a6a44') }));
    if (tc) return tc;
    const top = pbr('wood', num === 2 ? '#6a4128' : '#9a6a44');
    b(g, top, 4.4, 0.06, 1.4, 0, 0.72);
    b(g, mat('#2b2d31'), 0.5, 0.72, 0.5, -1.3);
    b(g, mat('#2b2d31'), 0.5, 0.72, 0.5, 1.3);
    return g;
  }
  if (/^Table_Round/.test(n)) { const tr = kitModel('table_round', modelMaterials({ Wood: pbr('wood', C.wood) })); if (tr) return tr; }
  if (/^Table_Round/.test(n)) { cyl(g, pbr('wood', C.wood), 0.45, 0.04, 0, 0.72); cyl(g, mat('#2b2d31'), 0.05, 0.72); cyl(g, mat('#2b2d31'), 0.25, 0.03); return g; }
  if (/^Table_Drafting/.test(n)) { const t = b(g, mat('#e8e4da'), 1.2, 0.03, 0.8, 0, 0.9); t.rotation.x = -0.3; b(g, mat('#2b2d31'), 0.05, 0.9, 0.05); return g; }
  if (/^Table_0/.test(n)) { const ts = kitModel('table_small', modelMaterials({ Wood: pbr('wood', C.woodLight) })); if (ts) return ts; }
  if (/^Table_0/.test(n)) { b(g, pbr('wood', C.woodLight), 1.2, 0.04, 0.75, 0, 0.72); for (const [x, z] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) b(g, mat('#2b2d31'), 0.04, 0.72, 0.04, x, 0, z); return g; }
  if (/^CoffeeTable/.test(n)) { const ct = kitModel('table_coffee', modelMaterials({ Wood: pbr('wood', num === 2 ? '#6a4128' : C.wood) })); if (ct) return ct; }
  if (/^CoffeeTable/.test(n)) { b(g, pbr('wood', num === 2 ? '#6a4128' : C.wood), 1.1, 0.05, 0.6, 0, 0.38); b(g, mat('#1b1c20'), 1.0, 0.38, 0.5, 0, 0); return g; }
  if (/^Couch/.test(n)) return couch(num);
  if (/^Benchseat|^Outdoor_Seat/.test(n)) { b(g, mat(C.wood), 1.6, 0.06, 0.45, 0, 0.42); b(g, mat('#2b2d31'), 0.06, 0.42, 0.4, -0.7); b(g, mat('#2b2d31'), 0.06, 0.42, 0.4, 0.7); return g; }
  if (/^Computer_Monitor_Double/.test(n)) { monitor(g, -0.3, 1); monitor(g, 0.3, 2); return g; }
  if (/^Computer_Monitor_Triple/.test(n)) { monitor(g, -0.58, 0); monitor(g, 0, 1); monitor(g, 0.58, 2); return g; }
  if (/^Computer_Monitor_Curved/.test(n)) { monitor(g, 0, 3, 0.8, true); return g; }
  if (/^Monitor_Crt/.test(n)) { b(g, mat('#d8d2c4'), 0.42, 0.38, 0.42, 0, 0); plane(g, SKIN_SCREEN(2), 0.32, 0.26, 0, 0.2, 0.21); return g; }
  if (/^Computer_Monitor/.test(n)) { monitor(g, 0, num % 4); return g; }
  if (/^Computer_Setup/.test(n)) { monitor(g, 0, num); b(g, mat('#202126'), 0.44, 0.02, 0.14, 0, 0, 0.25); return g; }
  if (/^Computer_Tower/.test(n)) { const t = kit('pc_tower'); if (t) return t; }
  if (/^Computer_Tower/.test(n)) { b(g, mat('#1c1d21'), 0.2, 0.45, 0.45); plane(g, mat('#4a7aff', { emissive: '#4a7aff', ei: 1.5 }), 0.02, 0.3, 0.05, 0.25, 0.226); return g; }
  if (/^Laptop/.test(n)) { b(g, mat('#b9bcc2', { metal: 0.4 }), 0.34, 0.015, 0.24); const lid = new THREE.Group(); lid.position.set(0, 0.015, -0.12); lid.rotation.x = -0.25; r(lid, mat('#b9bcc2', { metal: 0.4 }), [-0.17, 0.17], [0, 0.23], [-0.012, 0]); r(lid, SKIN_SCREEN(num), [-0.155, 0.155], [0.015, 0.215], [0, 0.003]); g.add(lid); return g; }
  if (/^TV_Wall|^Rolling_TV/.test(n)) { g.add(screenBoard(1.2, 0.7, 1, /Rolling/.test(n) ? 1.0 : 0)); if (/Rolling/.test(n)) b(g, mat('#2b2d31'), 0.06, 1.0, 0.06); return g; }
  if (/^ArcadeMachine/.test(n)) { b(g, mat('#3a1f6a'), 0.7, 1.8, 0.75); const s = plane(g, SKIN_SCREEN(3), 0.5, 0.4, 0, 1.35, 0.376); s.rotation.x = -0.2; b(g, mat('#2b2d31'), 0.6, 0.06, 0.25, 0, 0.95, 0.45); return g; }
  if (/^Jukebox/.test(n)) { b(g, mat('#8a2b2b'), 0.8, 1.5, 0.6); ball(g, mat('#ffcf7a', { emissive: '#ffb347', ei: 1.2 }), [0.7, 0.5, 0.3], [0, 1.5, 0.05]); return g; }
  if (/^VendingMachine/.test(n)) {
    // mesin minuman: rangka arang, etalase kaca berlampu berisi rak & produk, kolom tombol, slot ambil, strip merek
    const body = mat('#2a2d33', { rough: 0.45 }), steel = mat('#b9bcc2', { metal: 0.6, rough: 0.35 });
    r(g, body, [-0.45, -0.42], [0, 1.9], [-0.4, 0.4]); r(g, body, [0.42, 0.45], [0, 1.9], [-0.4, 0.4]);
    r(g, body, [-0.42, 0.42], [1.75, 1.9], [-0.4, 0.4]); r(g, body, [-0.42, 0.42], [0, 0.3], [-0.4, 0.4]);
    r(g, body, [-0.42, 0.42], [0.3, 1.75], [-0.4, -0.37]); r(g, body, [0.18, 0.42], [0.3, 1.75], [-0.37, 0.4]);
    r(g, mat('#eef3f8', { emissive: '#dbe8f5', ei: 0.5 }), [-0.42, 0.18], [0.3, 1.75], [-0.37, -0.355]);
    const goods = ['#b8352b', '#2f5fa8', '#e0b04a', '#3d7a4f', '#e8e4da', '#7a3a6a'];
    for (let i = 0; i < 5; i++) {
      const y = 0.42 + i * 0.27;
      r(g, steel, [-0.42, 0.18], [y - 0.012, y], [-0.355, 0.36]);
      for (let j = 0; j < 5; j++) b(g, mat(goods[(i * 2 + j) % goods.length], { rough: 0.4 }), 0.075, 0.17, 0.09, -0.36 + j * 0.11, y, 0.2);
    }
    r(g, mat(C.glassTint, { glass: true }), [-0.42, 0.18], [0.3, 1.75], [0.37, 0.38]);
    r(g, mat('#14161a'), [-0.36, 0.1], [0.08, 0.22], [0.4, 0.41]);
    r(g, mat('#3a3d45', { rough: 0.5 }), [0.22, 0.38], [0.95, 1.35], [0.4, 0.412]);
    r(g, mat('#9fd0ff', { emissive: '#6fb0ff', ei: 0.9 }), [0.24, 0.36], [1.25, 1.32], [0.412, 0.416]);
    r(g, mat('#c23a2f', { emissive: '#c23a2f', ei: 0.5 }), [-0.4, 0.4], [1.78, 1.87], [0.4, 0.408]);
    return g;
  }
  if (/^WaterCooler/.test(n)) { const w = kit('water_cooler'); if (w) return w; }
  if (/^WaterCooler/.test(n)) { b(g, mat('#e8e4da'), 0.32, 1.0, 0.32); cyl(g, mat('#8fc3ef', { glass: true }), 0.14, 0.42, 0, 1.0); return g; }
  if (/^Fishtank/.test(n)) { b(g, mat('#2b2d31'), 1.2, 0.8, 0.45); b(g, mat('#4aa3d8', { emissive: '#1e6fa0', ei: 0.6 }), 1.15, 0.5, 0.4, 0, 0.8); return g; }
  if (/^Kitchen_CounterSink/.test(n)) { b(g, mat('#e8e4da'), 1.0, 0.86, 0.62); b(g, mat('#3a3d45'), 1.02, 0.04, 0.64, 0, 0.86); b(g, mat('#c9ccd0', { metal: 0.6 }), 0.5, 0.02, 0.35, 0, 0.9); cyl(g, mat('#c9ccd0', { metal: 0.6 }), 0.015, 0.3, 0, 0.9, -0.22); return g; }
  if (/^Kitchen_Counter/.test(n)) { b(g, mat('#e8e4da'), 1.0, 0.86, 0.62); b(g, mat('#3a3d45'), 1.02, 0.04, 0.64, 0, 0.86); b(g, mat('#2b2d31'), 0.02, 0.02, 0.2, 0, 0.7, 0.32); return g; }
  if (/^Kitchen_Cabinet/.test(n)) { b(g, mat('#e8e4da'), 1.0, 0.7, 0.35); return g; }
  if (/^Fridge/.test(n)) { const f = kit('fridge'); if (f) return f; }
  if (/^Fridge/.test(n)) { b(g, mat('#1e1f23'), 0.85, 1.9, 0.72); b(g, mat('#c9ccd0', { metal: 0.6 }), 0.03, 0.5, 0.04, -0.04, 0.9, 0.37); b(g, mat('#c9ccd0', { metal: 0.6 }), 0.03, 0.5, 0.04, 0.04, 0.9, 0.37); return g; }
  if (/^MiniFridge/.test(n)) { b(g, mat('#2b2d31'), 0.5, 0.85, 0.5); return g; }
  if (/^Server_Cabinet/.test(n)) {
    b(g, mat('#17181b'), 0.62, 2.0, 1.0);
    const led = mat('#3dff7a', { emissive: '#3dff7a', ei: 2 });
    for (let i = 0; i < 9; i++) { b(g, mat('#2a2c31'), 0.54, 0.16, 0.02, 0, 0.15 + i * 0.2, 0.5); b(g, led, 0.03, 0.03, 0.01, -0.2 + (i % 3) * 0.05, 0.22 + i * 0.2, 0.51); }
    return g;
  }
  if (/^Server_Node/.test(n)) { b(g, mat('#2a2c31'), 0.45, 0.09, 0.6); return g; }
  if (/^Photocopier|^Printer_0|^Printer$/.test(n)) { b(g, mat('#d8d4cc'), 0.7, 1.0, 0.6); b(g, mat('#3a3d45'), 0.5, 0.05, 0.4, 0, 1.0); return g; }
  if (/^PaperShredder/.test(n)) { b(g, mat('#3a3d45'), 0.4, 0.6, 0.3); return g; }
  if (/^(Trashbin|Bin_|Bin$|Bin_Rubbish)/.test(n)) { cyl(g, mat('#3a3d45'), 0.16, 0.38); return g; }
  if (/^Fire_Extinguisher/.test(n)) { cyl(g, mat('#c3322b', { rough: 0.4 }), 0.07, 0.5); return g; }
  if (/^CardboardBox|^Pallet|^Box_/.test(n)) { if (/Pallet/.test(n)) b(g, mat('#a8875e'), 1.2, 0.14, 1.0); else if (/Stack/.test(n)) { b(g, mat('#b98d5a'), 0.5, 0.35, 0.4); b(g, mat('#a9804f'), 0.45, 0.3, 0.38, 0.02, 0.35); } else b(g, mat('#b98d5a'), 0.45, 0.32, 0.38); return g; }
  if (/^Cabinets/.test(n)) { const cb = kit(num === 3 ? 'cabinet_low' : 'cabinet_tall', { Laminate: num === 2 ? pbr('wood', C.wood) : mat('#b9bcc2', { rough: 0.5, smooth: true }) }); if (cb) return cb; }
  if (/^Cabinets/.test(n)) { b(g, mat(num === 2 ? C.wood : '#b9bcc2'), 0.45, num === 3 ? 0.75 : 1.3, 0.6); for (let i = 0; i < 3; i++) b(g, mat('#2b2d31'), 0.12, 0.02, 0.02, 0, 0.3 + i * 0.38, 0.31); return g; }
  if (/^Shelf_Wall/.test(n)) { b(g, mat(C.wood), 0.9, 0.03, 0.22); return g; }
  if (/^Shelf/.test(n)) return shelf(num);
  if (/^CoatRack/.test(n)) { cyl(g, mat(C.woodDark), 0.025, 1.8); cyl(g, mat(C.woodDark), 0.22, 0.03); return g; }
  if (/^Plant_Flowers|^Flowers/.test(n)) { const pd = kit('plant_desk', { Pot: mat('#e8e4da', { rough: 0.4, smooth: true }) }); if (pd) { pd.scale.setScalar(1.5); return pd; } }
  if (/^Plant_Flowers|^Flowers/.test(n)) { cyl(g, mat('#e8e4da'), 0.06, 0.18); for (let i = 0; i < 5; i++) ball(g, mat(['#d9473a', '#f2c94c', '#e86a92'][i % 3]), [0.06, 0.06, 0.06], [Math.sin(i) * 0.05, 0.3 + (i % 2) * 0.05, Math.cos(i) * 0.05]); return g; }
  if (/^Plant|^Tree_Round|^Small_Hedge|^Neon_Cactus/.test(n)) { if (/Tree/.test(n)) { cyl(g, mat('#5a3d28'), 0.1, 1.2); ball(g, mat('#3f7a3a'), [1.6, 1.4, 1.6], [0, 1.9, 0]); return g; } if (/Hedge/.test(n)) { b(g, mat('#2f6a34'), 1.2, 0.6, 0.5); return g; } return plant(num); }
  if (/^Rug/.test(n)) {
    // karpet merah tua seperti video (koridor & lounge); dulu panel tengah krem `.visible = false` tetap ikut tergabung
    // (mergeByMaterial tidak melihat visible) → semua karpet berpusat krem terang
    const cols = ['#7a2f2a', '#7c2a26', '#8a5a3a', '#3d5a3f', '#8a2b2b']; const w = [3, 2.4, 2, 3.2, 2.6][(num - 1) % 5], d = [2, 1.6, 1.4, 2.2, 1.8][(num - 1) % 5];
    b(g, mat(cols[(num - 1) % 5], { rough: 1 }), w, 0.012, d);
    if (num === 1) b(g, mat('#9a7c5e', { rough: 1 }), w - 0.2, 0.017, d - 0.2);
    return g;
  }
  if (/^Whiteboard|^Darkboard|^Blackboard/.test(n)) {
    const board = mat(/Dark|Black/.test(n) ? '#2a3a34' : '#f6f6f2', { rough: 0.3 });
    if (num === 2 || /Darkboard/.test(n)) { b(g, mat('#9aa0a6'), 0.05, 1.9, 0.5, -0.8); b(g, mat('#9aa0a6'), 0.05, 1.9, 0.5, 0.8); r(g, board, [-0.78, 0.78], [0.8, 1.85], [-0.02, 0.02]); }
    else r(g, board, [-0.9, 0.9], [-0.55, 0.55], [0, 0.03]);
    return g;
  }
  if (/^CorkBoard/.test(n)) { r(g, mat('#5b3a24'), [-0.63, 0.63], [-0.03, 0.83], [0, 0.025]); r(g, mat('#b07a4a', { rough: 1 }), [-0.6, 0.6], [0, 0.8], [0.025, 0.035]); for (let i = 0; i < 6; i++) r(g, mat(['#f2e36b', '#f2efe8', '#8fd0f0'][i % 3]), [-0.5 + (i % 3) * 0.35, -0.3 + (i % 3) * 0.35], [0.1 + Math.floor(i / 3) * 0.35, 0.32 + Math.floor(i / 3) * 0.35], [0.035, 0.04]); return g; }
  if (/^Presentation_Chart/.test(n)) { b(g, mat(C.woodDark), 0.04, 1.8, 0.04, -0.35, 0, 0.1); b(g, mat(C.woodDark), 0.04, 1.8, 0.04, 0.35, 0, 0.1); const p = r(g, mat('#ffffff', { map: chartTexture('PROFITS') }), [-0.4, 0.4], [0.9, 1.9], [0.06, 0.07]); p.rotation.x = -0.08; return g; }
  if (/^Poster_Stocks/.test(n)) { r(g, mat('#ffffff', { map: chartTexture('STOCKS') }), [-0.4, 0.4], [-0.5, 0.5], [0, 0.02]); return g; }
  if (/^(Poster|WallDressing|Certificate|Employee_Wall)/.test(n)) { const w = /Employee/.test(n) ? 1.6 : /Certificate/.test(n) ? 0.3 : 0.6; const h = /Employee/.test(n) ? 0.8 : /Certificate/.test(n) ? 0.4 : 0.8; r(g, mat('#2b2d31'), [-w / 2, w / 2], [-h / 2, h / 2], [0, 0.02]); r(g, mat(['#d9473a', '#2f5fa8', '#e0b04a', '#f2efe8', '#3d7a4f'][num % 5]), [-w / 2 + 0.03, w / 2 - 0.03], [-h / 2 + 0.03, h / 2 - 0.03], [0.02, 0.025]); return g; }
  if (/^Clock/.test(n)) { const c = cyl(g, mat('#f2efe8'), 0.16, 0.04); c.rotation.x = Math.PI / 2; c.position.set(0, 0, 0.02); return g; }
  if (/^Minigolf_Green/.test(n)) { b(g, mat('#3f8a3a', { rough: 1 }), 3, 0.04, 1.1); return g; }
  if (/^Minigolf_Flag/.test(n)) { cyl(g, mat('#e8e4da'), 0.008, 0.6); r(g, mat('#d9473a'), [0, 0.18], [0.45, 0.58], [0, 0.005]); return g; }
  if (/^GreenScreen/.test(n)) { b(g, mat('#2b2d31'), 0.04, 2.6, 0.04, -1.5); b(g, mat('#2b2d31'), 0.04, 2.6, 0.04, 1.5); r(g, mat(num === 2 ? '#f2f2ee' : '#3fb05a', { rough: 1 }), [-1.5, 1.5], [0, 2.5], [-0.02, 0]); return g; }
  if (/^Camera_Tripod/.test(n)) { for (let i = 0; i < 3; i++) { const l = b(g, mat('#1b1c20'), 0.03, 1.4, 0.03, Math.sin(i * 2.1) * 0.2, 0, Math.cos(i * 2.1) * 0.2); l.rotation.set(Math.cos(i * 2.1) * -0.15, 0, Math.sin(i * 2.1) * 0.15); } b(g, mat('#1b1c20'), 0.25, 0.22, 0.4, 0, 1.4); return g; }
  if (/^Microphone/.test(n)) { cyl(g, mat('#1b1c20'), 0.012, 1.4); cyl(g, mat('#1b1c20'), 0.15, 0.02); ball(g, mat('#3a3d45'), [0.07, 0.11, 0.07], [0, 1.45, 0]); return g; }
  if (/^TableTennis_01/.test(n)) { for (const [x, z] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]]) b(g, mat('#2b2d31'), 0.06, 0.74, 0.06, x, 0, z); b(g, mat('#2f5f8a'), 2.74, 0.03, 1.52, 0, 0.74); b(g, mat('#f2f2ee'), 2.74, 0.031, 0.02, 0, 0.74); b(g, mat('#f2f2ee'), 0.02, 0.15, 1.6, 0, 0.77); return g; }
  if (/^TableFootball_01/.test(n)) { b(g, mat(C.woodDark), 1.2, 0.2, 0.75, 0, 0.7); b(g, mat('#2f7a46'), 1.1, 0.02, 0.65, 0, 0.9); for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.3]) b(g, mat(C.woodDark), 0.06, 0.7, 0.06, x, 0, z); const rod = mat('#c9ccd0', { metal: 0.7 }); for (let i = 0; i < 6; i++) { const x = -0.45 + i * 0.18; r(g, rod, [x - 0.012, x + 0.012], [0.93, 0.955], [-0.5, 0.5]); r(g, mat('#2b2d31'), [x - 0.012, x + 0.012], [0.93, 0.955], [-0.62, -0.5]); r(g, mat(i % 2 ? '#c3322b' : '#2f5fa8'), [x - 0.025, x + 0.025], [0.9, 0.98], [-0.08, 0.08]); } return g; }
  if (/^PoolTable/.test(n)) return pool(num);
  if (/^(Toilet_01|Urinal)/.test(n)) { b(g, mat('#f2f2ee'), 0.4, 0.42, 0.55); if (/Toilet/.test(n)) b(g, mat('#f2f2ee'), 0.4, 0.4, 0.15, 0, 0.42, -0.22); return g; }
  if (/^ToiletStalls/.test(n)) { for (const x of [-0.95, 0.95]) b(g, mat('#a8a194'), 0.04, 2.0, 1.5, x, 0.12); b(g, mat('#a8a194'), 1.9, 2.0, 0.04, 0, 0.12, 0.75); return g; }
  if (/^Bathroom_Sink|^Sink/.test(n)) { b(g, mat('#f2f2ee'), 0.55, 0.15, 0.45, 0, 0.75); b(g, mat('#c9ccd0'), 0.08, 0.75, 0.08); return g; }
  if (/^Bathroom_Mirror/.test(n)) { r(g, mat('#cfe0ea', { rough: 0.05, metal: 0.8 }), [-0.35, 0.35], [1.2, 1.9], [0, 0.02]); return g; }
  if (/^Bathroom_Light/.test(n)) return lamp(6);
  if (/^Light_Fluorescent/.test(n)) { b(g, mat('#fff8ea', { emissive: '#fff1d6', ei: 1.6 }), 1.2, 0.05, 0.2, 0, -0.06); return g; }
  if (/^Light_0/.test(n)) return lamp(num);
  if (/^LampPost/.test(n)) { cyl(g, mat('#1b1c20'), 0.06, 3.8); ball(g, mat('#fff2d8', { emissive: '#ffd8a0', ei: 3 }), [0.35, 0.25, 0.35], [0, 3.85, 0]); return g; }
  if (/^CeilingFan/.test(n)) { cyl(g, mat('#e8e4da'), 0.02, 0.4, 0, -0.4); for (let i = 0; i < 4; i++) { const bl = b(g, mat('#e8e4da'), 0.12, 0.01, 0.6, 0, -0.42, 0); bl.rotation.y = (i * Math.PI) / 2; bl.position.set(Math.sin((i * Math.PI) / 2) * 0.32, -0.42, Math.cos((i * Math.PI) / 2) * 0.32); } return g; }
  if (/^(Divider|CubicalWall)/.test(n)) {
    const tall = /Tall/.test(n);
    const h = tall ? 1.7 : 1.38;
    if (/Pillar/.test(n)) { b(g, mat(C.cream), 0.07, h + 0.03, 0.07); return g; }
    const half = /Half/.test(n);
    const len = /Divider_Half/.test(n) ? 1 : half ? 1 : 2;
    // CubicalWall_01 membentang ke -x dari pivot (lihat Furniture.tsx), varian Half ke +x.
    const x0 = half ? 0 : -len, x1 = half ? len : 0;
    const frame = mat(C.cream);
    r(g, pbr('fabric', /Divider/.test(n) ? '#6d7480' : C.teal), [x0, x1], [0.05, h - 0.05], [-0.025, 0.025]);
    r(g, frame, [x0, x1], [h - 0.05, h], [-0.035, 0.035]);
    r(g, frame, [x0, x1], [0, 0.05], [-0.035, 0.035]);
    return g;
  }
  if (/^BikeStand/.test(n)) { for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 12, Math.PI), mat('#9aa0a6', { metal: 0.6 })); t.position.set(-0.75 + i * 0.5, 0, 0); g.add(t); } return g; }
  if (/^Concrete_Cube/.test(n)) { b(g, mat('#9a9a94'), 0.6, 0.45, 0.6); return g; }
  if (/^Janitor_Cart/.test(n)) { b(g, mat('#e0a43a'), 0.9, 0.9, 0.5); return g; }
  if (/^(Mop|Broom)/.test(n)) { cyl(g, mat(C.woodLight), 0.015, 1.3); b(g, mat('#e8e4da'), 0.25, 0.08, 0.08); return g; }
  if (/^Vacuum/.test(n)) { b(g, mat('#c3322b'), 0.3, 0.3, 0.4); return g; }
  if (/^Sign_Wetfloor/.test(n)) { const a = b(g, mat('#f2c94c'), 0.3, 0.6, 0.02, 0, 0, 0.08); a.rotation.x = -0.25; const c2 = b(g, mat('#f2c94c'), 0.3, 0.6, 0.02, 0, 0, -0.08); c2.rotation.x = 0.25; return g; }
  if (/^Bunting|^Streamer/.test(n)) { const cols = ['#d9473a', '#f2c94c', '#2f6fb0', '#3d9a5a', '#e86a92']; for (let i = 0; i < 9; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 3), mat(cols[i % cols.length])); t.rotation.x = Math.PI; t.position.set(-1.2 + i * 0.3, -0.12 - Math.sin((i / 8) * Math.PI) * 0.15, 0); g.add(t); } return g; }
  if (/^Balloon/.test(n)) { ball(g, mat(num === 2 ? '#2f6fb0' : '#d9473a', { rough: 0.3 }), [0.3, 0.36, 0.3], [0, 1.6, 0]); return g; }
  if (/^Xmas_Tree/.test(n)) { cyl(g, mat('#2f6a34'), 0.5, 1.6, 0, 0.1, 0, CONE); return g; }
  if (/^Ducting|^Pipe_|^CableTray/.test(n)) { const m = mat(/Cable/.test(n) ? '#4a4d52' : '#9aa0a6', { metal: 0.4 }); const len = /Long/.test(n) ? 2.5 : 1.25; b(g, m, len, /Ducting_02/.test(n) ? 0.5 : 0.25, /Ducting/.test(n) ? 0.4 : 0.15, len / 2, -0.25); return g; }
  if (/^(AirVent|Aircon)/.test(n)) { b(g, mat('#e8e4da'), 0.5, 0.25, 0.1); return g; }
  if (/^Fan_Pedistal/.test(n)) { cyl(g, mat('#2b2d31'), 0.02, 1.2); ball(g, mat('#e8e4da'), [0.4, 0.4, 0.12], [0, 1.25, 0]); return g; }
  if (/^SwissBall/.test(n)) { ball(g, mat('#2f6fb0', { rough: 0.4 }), [0.6, 0.6, 0.6], [0, 0.3, 0]); return g; }
  if (/^(Cart_0|FootRest|OHP_01)/.test(n)) { b(g, mat('#5a5e66'), 0.6, 0.8, 0.5); return g; }
  if (/^ProjectorScreen/.test(n)) { r(g, mat('#f2f2ee'), [-1, 1], [0.8, 2.4], [0, 0.02]); return g; }
  return null;
}

function signs(n: string): THREE.Object3D | null {
  const map: Record<string, [string, string, string, number?, number?, boolean?]> = {
    Sign_Receptionist_01: ['RECEPTIONIST', '#6b3a22', '#f2e2c4', 0.75, 0.2, true],
    Sign_Manager_01: ['MANAGER', '#2b2d31', '#f2efe8'], Sign_Director_01: ['DIRECTOR', '#2b2d31', '#f2efe8'],
    Sign_Kitchen_01: ['KITCHEN', '#2b2d31', '#f2efe8'], Sign_Sales_01: ['SALES', '#2b2d31', '#f2efe8'], Sign_HR_Dep_01: ['HR', '#2b2d31', '#f2efe8'],
    Sign_Exit_01: ['EXIT', '#1f8a4a', '#ffffff', 0.45, 0.18], Sign_Stairs_01: ['STAIRS', '#1f8a4a', '#ffffff'],
    Sign_OutofOrder_01: ['OUT OF ORDER', '#f2efe8', '#c3322b', 0.4, 0.22],
    Sign_Toilets_Male_01: ['MEN', '#2f5fa8', '#ffffff', 0.3, 0.3], Sign_Toilets_Female_01: ['WOMEN', '#c3322b', '#ffffff', 0.3, 0.3],
    Sign_Toilets_Disabled_01: ['♿', '#2f5fa8', '#ffffff', 0.22, 0.22], Sign_Toilets_01: ['WC', '#2b2d31', '#ffffff'], Sign_Toilets_02: ['WC', '#2b2d31', '#ffffff'],
  };
  const s = map[n];
  if (!s) return n.startsWith('Sign_') ? sign(n.replace(/^Sign_|_\d+$/g, '').toUpperCase(), '#2b2d31', '#f2efe8') : null;
  return sign(s[0], s[1], s[2], s[3], s[4], s[5]);
}

const cache = new Map<string, THREE.Object3D>();

/**
 * Material polos (tanpa tekstur/emissive/kaca) dibagi per kelompok kekasaran: warnanya dipindah ke vertex color,
 * sehingga ratusan warna prop = beberapa material saja → StaticBatch menggabung hampir semua prop jadi sedikit draw call.
 */
const plainMats = new Map<string, THREE.MeshStandardMaterial>();
/** Material polos dibagi per kelas: 3 kekasaran × 2 logam = maks 6 material (dulu tiap pasangan → banyak draw call). */
function plainMaterial(m: THREE.MeshStandardMaterial) {
  const rough = m.roughness < 0.45 ? 0.35 : m.roughness < 0.75 ? 0.6 : 0.9;
  const metal = m.metalness < 0.25 ? 0 : m.metalness < 0.75 ? 0.5 : 0.9;
  const key = `${rough}|${metal}|${m.flatShading ? 'f' : 's'}|${m.side}`;
  let p = plainMats.get(key);
  if (!p) {
    p = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: m.flatShading, side: m.side });
    plainMats.set(key, p);
  }
  return p;
}
const isPlain = (m: THREE.Material): m is THREE.MeshStandardMaterial => {
  const s = m as THREE.MeshStandardMaterial;
  return !!s.isMeshStandardMaterial && !s.map && !s.normalMap && !s.transparent && (!s.emissive || s.emissive.getHex() === 0) && s.name !== 'Screen';
};

/** Satu mesh per material di dalam satu prop (pintu, monitor, rak: 5–40 kotak → 1–3 mesh). */
function mergeByMaterial(root: THREE.Object3D): THREE.Object3D {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g = g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    let material: THREE.Material = m.material;
    const uvSize = (material.userData as { boxUV?: number }).boxUV;
    if (uvSize) boxUV(g, uvSize);
    if ((material.userData as { pbrKind?: string; shared?: boolean }).pbrKind && !material.userData.shared) {
      const c = (material as THREE.MeshStandardMaterial).color;
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      material = pbrSharedFor(material as THREE.MeshStandardMaterial);
    } else if (isPlain(material)) {
      const c = material.color;
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      material = plainMaterial(material);
    }
    const list = groups.get(material) ?? [];
    list.push(g);
    groups.set(material, list);
  });
  const out = new THREE.Group();
  for (const [material, geos] of groups) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    out.add(new THREE.Mesh(merged, material));
  }
  return out;
}

/** Template prop pengganti (di-cache; pemanggil meng-clone). null = sengaja tidak digambar. */
export function fallbackProp(full: string, palette: string): THREE.Object3D {
  const pal = palette.slice(0, 2);
  const key = `${full}|${pal}`;
  let o = cache.get(key);
  if (o) return o;
  const short = full.replace(/^SM_(Prop|Bld)_/, '');
  BEVEL = Q.pbr && !full.startsWith('SM_Bld_');
  o = (full.startsWith('SM_Bld_') ? building(short, pal) : null)
    ?? (full === 'SM_Bld_Glass_Door_01' ? doorLeaf(short) : null)
    ?? signs(short) ?? furniture(short) ?? small(short) ?? new THREE.Group();
  BEVEL = false;
  if (!full.startsWith('SM_Bld_')) addContactShadow(o);
  o = mergeByMaterial(o);
  o.name = full;
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    mesh.castShadow = name !== 'Glass' && name !== 'Blob';
    mesh.receiveShadow = name !== 'Blob';
  });
  cache.set(key, o);
  return o;
}
