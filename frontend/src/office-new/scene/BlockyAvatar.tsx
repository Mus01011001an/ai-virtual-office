// Karakter blocky ala Roblox dari office lama (characters/Humanoid.tsx: geometri & pose yang sama), dibangun
// sebagai SATU SkinnedMesh per orang: 1 draw call (versi lama ±11, avatar prosedural referensi ±15).
// Dengan ±40 orang di gedung ini menurunkan draw call dari ±600 ke ±40 → render lebih mulus (video: 2.269 → 174).
import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BODY_MAT, buildBody, ELBOW_Y, HIP_X, HIP_Y, NECK_Y, SHOULDER_X, SHOULDER_Y, SPINE_Y, THIGH_L, setBlockyLowDetail } from '../../characters/Humanoid';

// ±40 orang sekaligus: geometri ringan (bentuk sama, segitiga ±6× lebih sedikit).
setBlockyLowDetail();
import { poseAt, type Pose as JointPose, type PoseName } from '../../characters/poses';
import type { Appearance } from '../../state/types';
import type { Pose } from './Avatar';

// tulang: indeks = urutan di array
const BONES = ['hips', 'spine', 'head', 'lS', 'lE', 'rS', 'rE', 'lH', 'lK', 'rH', 'rK'] as const;
type BoneName = (typeof BONES)[number];
const PARENT: Record<BoneName, BoneName | null> = { hips: null, spine: 'hips', head: 'spine', lS: 'spine', lE: 'lS', rS: 'spine', rE: 'rS', lH: 'hips', lK: 'lH', rH: 'hips', rK: 'rH' };
const LOCAL: Record<BoneName, [number, number, number]> = {
  hips: [0, HIP_Y, 0], spine: [0, SPINE_Y, 0], head: [0, NECK_Y, 0],
  lS: [SHOULDER_X, SHOULDER_Y, 0], lE: [0, ELBOW_Y, 0], rS: [-SHOULDER_X, SHOULDER_Y, 0], rE: [0, ELBOW_Y, 0],
  lH: [HIP_X, -0.02, 0], lK: [0, -THIGH_L, 0], rH: [-HIP_X, -0.02, 0], rK: [0, -THIGH_L, 0],
};
/** Posisi dunia tiap tulang saat bind (semua rotasi nol = jumlah offset lokal). */
const BIND = (() => {
  const out = {} as Record<BoneName, THREE.Vector3>;
  for (const b of BONES) {
    const p = new THREE.Vector3(...LOCAL[b]);
    const parent = PARENT[b];
    out[b] = parent ? p.add(out[parent]) : p;
  }
  return out;
})();

const geoCache = new Map<string, THREE.BufferGeometry>();
function skinnedGeometry(ap: Appearance) {
  const key = JSON.stringify(ap);
  let g = geoCache.get(key);
  if (g) return g;
  const b = buildBody(ap);
  const seg: [THREE.BufferGeometry, BoneName][] = [
    [b.hips, 'hips'], [b.spine, 'spine'], [b.head, 'head'], [b.upperL, 'lS'], [b.foreL, 'lE'], [b.upperR, 'rS'], [b.foreR, 'rE'],
    [b.thigh, 'lH'], [b.shin, 'lK'], [b.thigh, 'rH'], [b.shin, 'rK'],
  ];
  const parts = seg.map(([src, bone]) => {
    const x = src.clone();
    x.translate(BIND[bone].x, BIND[bone].y, BIND[bone].z);
    const n = x.attributes.position.count;
    const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
    const bi = BONES.indexOf(bone);
    for (let i = 0; i < n; i++) { idx[i * 4] = bi; w[i * 4] = 1; }
    x.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    x.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    return x;
  });
  g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  g.computeBoundingBox();
  geoCache.set(key, g);
  return g;
}

function makeRig(geo: THREE.BufferGeometry) {
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const name of BONES) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(...LOCAL[name]);
    bones[name] = bone;
    const parent = PARENT[name];
    if (parent) bones[parent].add(bone);
  }
  const mesh = new THREE.SkinnedMesh(geo, BODY_MAT);
  mesh.add(bones.hips);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(BONES.map((n) => bones[n])));
  return { mesh, bones };
}

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Pose Office Baru (mode + bicara + gestur) → pose karakter lama. */
function poseName(p: Pose): PoseName {
  switch (p.mode) {
    case 'walk': return 'walk';
    case 'run': case 'air': return 'run';
    case 'type': return 'type';
    case 'sit': return p.talking ? 'sitTalk' : 'sitIdle';
    default: return p.gesture === 'drink' ? 'standCup' : p.talking ? 'standTalk' : 'stand';
  }
}

export const hashSeed = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function BlockyAvatar({ appearance, pose, seed, visible = true }: { appearance: Appearance; pose: MutableRefObject<Pose>; seed: number; visible?: boolean }) {
  const rig = useMemo(() => makeRig(skinnedGeometry(appearance)), [appearance]);
  const cur = useRef<JointPose | null>(null);
  const target = useMemo(() => ({}) as JointPose, []);
  useFrame((state, dtRaw) => {
    if (!visible) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    const name = poseName(pose.current);
    poseAt(name, t, seed, target);
    if (!cur.current) cur.current = { ...target };
    const c = cur.current;
    const k = name === 'walk' || name === 'run' ? 18 : 9;
    for (const key in target) { const kk = key as keyof JointPose; c[kk] = damp(c[kk], target[kk], k, dt); }
    const b = rig.bones;
    const breath = 1 + Math.sin(t * 1.7 + seed) * 0.006;
    b.hips.position.y = c.y;
    b.spine.rotation.x = c.spineX;
    b.spine.scale.set(1, breath, 1);
    b.head.rotation.set(c.headX, c.headY, Math.sin(t * 0.9 + seed) * 0.015);
    b.lS.rotation.set(c.lSx, 0, c.lSz); b.rS.rotation.set(c.rSx, 0, c.rSz);
    b.lE.rotation.x = c.lEx; b.rE.rotation.x = c.rEx;
    b.lH.rotation.x = c.lHx; b.rH.rotation.x = c.rHx;
    b.lK.rotation.x = c.lKx; b.rK.rotation.x = c.rKx;
  });
  return <primitive object={rig.mesh} visible={visible} />;
}
