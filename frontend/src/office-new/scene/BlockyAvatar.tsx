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
import { CLIPS, MOCAP_BONES, NATURAL_SPEED, sampleClip, type ClipName } from './mocap/mocap';
import { sfx } from './sfx';

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

/** Klip mocap untuk pose ini, atau null (pose prosedural: duduk, mengetik, bicara, gestur). */
function clipFor(p: Pose): ClipName | null {
  if (p.mode === 'walk') return (p.speed ?? 0) > 2.8 ? 'run' : 'walk';
  if (p.mode === 'run') return 'run';
  if (p.mode === 'stand' && !p.talking && !p.gesture) return 'idle';
  return null;
}

const tmpE = new THREE.Euler();
const tmpQ = new THREE.Quaternion();
const IDENT = new THREE.Quaternion();
const wp = new THREE.Vector3();

export function BlockyAvatar({ appearance, pose, seed, visible = true }: { appearance: Appearance; pose: MutableRefObject<Pose>; seed: number; visible?: boolean }) {
  const rig = useMemo(() => makeRig(skinnedGeometry(appearance)), [appearance]);
  const cur = useRef<JointPose | null>(null);
  const target = useMemo(() => ({}) as JointPose, []);
  // mocap: bobot campuran (0 = rumus, 1 = rekaman gerak), fase tiap klip, keluaran per tulang
  const mo = useMemo(() => ({
    w: 0, clip: null as ClipName | null, phase: (seed % 17) / 17, out: MOCAP_BONES.map(() => new THREE.Quaternion()),
    lastPhase: 0, typeT: 0, lastName: '' as PoseName | '', lastGesture: null as Pose['gesture'],
  }), [seed]);
  const bones = useMemo(() => MOCAP_BONES.map((n) => rig.bones[n as BoneName]), [rig]);

  useFrame((state, dtRaw) => {
    if (!visible) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    const p = pose.current;
    const name = poseName(p);
    poseAt(name, t, seed, target);
    if (!cur.current) cur.current = { ...target };
    const c = cur.current;
    const k = name === 'walk' || name === 'run' ? 18 : 9;
    for (const key in target) { const kk = key as keyof JointPose; c[kk] = damp(c[kk], target[kk], k, dt); }
    const b = rig.bones;
    const breath = 1 + Math.sin(t * 1.7 + seed) * 0.006;

    // --- procedural pose (rumus) as quaternions
    const proc = (bone: THREE.Bone, x: number, y: number, z: number) => bone.quaternion.setFromEuler(tmpE.set(x, y, z));
    b.hips.quaternion.identity();
    proc(b.spine, c.spineX, 0, 0);
    proc(b.head, c.headX, c.headY, Math.sin(t * 0.9 + seed) * 0.015);
    proc(b.lS, c.lSx, 0, c.lSz); proc(b.rS, c.rSx, 0, c.rSz);
    proc(b.lE, c.lEx, 0, 0); proc(b.rE, c.rEx, 0, 0);
    proc(b.lH, c.lHx, 0, 0); proc(b.rH, c.rHx, 0, 0);
    proc(b.lK, c.lKx, 0, 0); proc(b.rK, c.rKx, 0, 0);
    b.spine.scale.set(1, breath, 1);
    let hipY = c.y;

    // --- motion capture (Mixamo), blended in/out so switching pose never pops
    const want = clipFor(p);
    const clip = want ? CLIPS[want] : undefined;
    if (clip && want !== mo.clip) { mo.clip = want; }
    mo.w = damp(mo.w, clip ? 1 : 0, 7, dt);
    const active = mo.clip ? CLIPS[mo.clip] : undefined;
    if (active && mo.w > 0.001) {
      const natural = NATURAL_SPEED[mo.clip!];
      const rate = natural > 0 ? THREE.MathUtils.clamp((p.speed ?? natural) / natural, 0.55, 2.6) : 1;
      mo.lastPhase = mo.phase;
      mo.phase = (mo.phase + (dt * rate) / active.duration) % 1;
      const dy = sampleClip(active, mo.phase, mo.out);
      for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        tmpQ.copy(bone === b.hips ? IDENT : bone.quaternion);
        bone.quaternion.slerpQuaternions(tmpQ, mo.out[i], mo.w);
      }
      hipY = c.y + (0.64 + dy - c.y) * mo.w;
      // footsteps exactly when a foot lands in the recording
      if (mo.w > 0.5 && active.steps.length) {
        const a = mo.lastPhase, z = mo.phase;
        for (const s of active.steps) {
          if (a <= z ? s > a && s <= z : s > a || s <= z) { rig.mesh.getWorldPosition(wp); sfx.footstep(wp.x, wp.z, mo.clip === 'run'); }
        }
      }
    }
    b.hips.position.y = hipY;

    // --- other sounds tied to the moment they happen
    if (name === 'type' || name === 'typeFast') {
      mo.typeT -= dt;
      if (mo.typeT <= 0) { mo.typeT = 0.07 + Math.random() * (name === 'typeFast' ? 0.12 : 0.28); rig.mesh.getWorldPosition(wp); sfx.key(wp.x, wp.z); }
    }
    if (mo.lastName && mo.lastName !== name && (name === 'sitIdle' || name === 'sitTalk' || name === 'type') && !/^sit|^type/.test(mo.lastName)) { rig.mesh.getWorldPosition(wp); sfx.chair(wp.x, wp.z); }
    if (p.gesture === 'drink' && mo.lastGesture !== 'drink') { rig.mesh.getWorldPosition(wp); sfx.cup(wp.x, wp.z); }
    mo.lastName = name;
    mo.lastGesture = p.gesture ?? null;
  });
  return <primitive object={rig.mesh} visible={visible} />;
}
