#!/usr/bin/env node
// Mixamo (motion capture) → rig blocky Office Baru.
//
//   node tools/office-new/mocap/build-mocap.mjs <Xbot.glb | klip Mixamo .glb> [out.json]
//
// Input: glb ber-skeleton Mixamo (`mixamorig:*`, T-pose, menghadap +z), mis. Xbot.glb dari repo three.js
// (examples/models/gltf, r170) yang berisi klip Mixamo idle / walk / run. File .glb TIDAK di-commit; yang di-commit
// hanya kurva hasil konversi (frontend/src/office-new/scene/mocap/clips.json).
//
// Retarget: rotasi global tiap tulang Mixamo (dari akar adegan) dipetakan ke 11 tulang rig blocky
// (characters/Humanoid.tsx). Lengan rig blocky istirahat ke bawah, lengan Mixamo ke samping (T-pose), jadi
// global_target = global_sumber × R (R memutar arah istirahat target ke arah istirahat sumber). Rotasi lokal =
// global_induk⁻¹ × global. Pinggul ikut naik-turun (diskalakan ke tinggi pinggul blocky); maju/samping dibuang.
import fs from 'node:fs';
import path from 'node:path';

const [, , src, outArg] = process.argv;
if (!src) { console.error('usage: build-mocap.mjs <mixamo.glb> [out.json]'); process.exit(1); }
const out = outArg ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../frontend/src/office-new/scene/mocap/clips.json');

const CLIPS = { idle: 'idle', walk: 'walk', run: 'run' };
const FPS = 30;
const BLOCKY_HIP_Y = 0.64;

// ---------------------------------------------------------------- quaternion [x,y,z,w]
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((v) => v / l); };
function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = b.map((v) => -v); }
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (bb[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (v * Math.sin((1 - t) * th) + bb[i] * Math.sin(t * th)) / s);
}
const qaxis = (ax, ang) => [ax[0] * Math.sin(ang / 2), ax[1] * Math.sin(ang / 2), ax[2] * Math.sin(ang / 2), Math.cos(ang / 2)];
const vrot = (q, v) => { const p = qmul(qmul(q, [...v, 0]), qinv(q)); return [p[0], p[1], p[2]]; };

// ---------------------------------------------------------------- glb
const buf = fs.readFileSync(src);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb');
const jsonLen = buf.readUInt32LE(12);
const gl = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;
const SIZE = { SCALAR: 1, VEC3: 3, VEC4: 4 };
function accessor(i) {
  const a = gl.accessors[i], bv = gl.bufferViews[a.bufferView];
  if (a.componentType !== 5126) throw new Error('float accessors only');
  const n = SIZE[a.type], off = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const f = new Float32Array(a.count * n);
  for (let k = 0; k < a.count * n; k++) f[k] = buf.readFloatLE(off + k * 4);
  return { n, f, count: a.count };
}
const byName = new Map(gl.nodes.map((n, i) => [n.name, i]));
const parent = new Map();
gl.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));

/** Sampled local TRS of every node at time t for one clip (rest pose where the clip has no track). */
function sampler(anim) {
  const tracks = new Map();
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    tracks.set(`${ch.target.node}/${ch.target.path}`, { t: accessor(s.input), v: accessor(s.output) });
  }
  const at = (node, p, time) => {
    const tr = tracks.get(`${node}/${p}`);
    if (!tr) return null;
    const T = tr.t.f, n = tr.v.n, V = tr.v.f;
    let k = 0;
    while (k < T.length - 2 && T[k + 1] < time) k++;
    const u = T[k + 1] > T[k] ? Math.min(1, Math.max(0, (time - T[k]) / (T[k + 1] - T[k]))) : 0;
    const a = Array.from(V.subarray(k * n, k * n + n)), b = Array.from(V.subarray((k + 1) * n, (k + 1) * n + n));
    return n === 4 ? qslerp(a, b, u) : a.map((v, i) => v + (b[i] - v) * u);
  };
  const duration = Math.max(...[...tracks.values()].map((tr) => tr.t.f[tr.t.f.length - 1]));
  return { at, duration };
}

function globalRot(node, local) {
  let q = [0, 0, 0, 1];
  for (let i = node; i !== undefined; i = parent.get(i)) q = qmul(local(i), q);
  return q;
}
function globalPos(node, localR, localT) {
  // p_world = R_parent(...)(t_node) chained from the root
  const chain = [];
  for (let i = node; i !== undefined; i = parent.get(i)) chain.unshift(i);
  let R = [0, 0, 0, 1], P = [0, 0, 0], S = 1;
  for (const i of chain) {
    const t = localT(i), s = gl.nodes[i].scale?.[0] ?? 1;
    P = P.map((v, k) => v + vrot(R, t)[k] * S);
    R = qmul(R, localR(i));
    S *= s;
  }
  return P;
}

// target bone ← source bone, rest-direction fix (target rest dir → source rest dir)
const DOWN_TO_LEFT = qaxis([0, 0, 1], Math.PI / 2); // (0,-1,0) → (+1,0,0): left arm points +x in T-pose
const DOWN_TO_RIGHT = qaxis([0, 0, 1], -Math.PI / 2);
const I = [0, 0, 0, 1];
const MAP = {
  hips: ['Hips', I], spine: ['Spine2', I], head: ['Head', I],
  lS: ['LeftArm', DOWN_TO_LEFT], lE: ['LeftForeArm', DOWN_TO_LEFT], rS: ['RightArm', DOWN_TO_RIGHT], rE: ['RightForeArm', DOWN_TO_RIGHT],
  lH: ['LeftUpLeg', I], lK: ['LeftLeg', I], rH: ['RightUpLeg', I], rK: ['RightLeg', I],
};
const PARENT = { hips: null, spine: 'hips', head: 'spine', lS: 'spine', lE: 'lS', rS: 'spine', rE: 'rS', lH: 'hips', lK: 'lH', rH: 'hips', rK: 'rH' };
const BONES = Object.keys(MAP);
const nodeOf = (name) => { const i = byName.get(`mixamorig:${name}`); if (i === undefined) throw new Error(`missing mixamorig:${name}`); return i; };
const hipsNode = nodeOf('Hips');
const restHipsY = gl.nodes[hipsNode].translation[1];
const armatureScale = (() => { let s = 1; for (let i = parent.get(hipsNode); i !== undefined; i = parent.get(i)) s *= gl.nodes[i].scale?.[1] ?? 1; return s; })();
const hipScale = BLOCKY_HIP_Y / (restHipsY * armatureScale);

const result = { source: path.basename(src), fps: FPS, bones: BONES, clips: {} };
for (const [key, animName] of Object.entries(CLIPS)) {
  const anim = gl.animations.find((a) => a.name === animName);
  if (!anim) { console.warn(`skip ${animName}: not in file`); continue; }
  const { at, duration } = sampler(anim);
  const frames = Math.max(2, Math.round(duration * FPS));
  const q = [], dy = [], footY = { l: [], r: [] };
  for (let f = 0; f < frames; f++) {
    const time = (f / frames) * duration; // loop: last frame wraps to the first
    const localR = (i) => at(i, 'rotation', time) ?? gl.nodes[i].rotation ?? [0, 0, 0, 1];
    const localT = (i) => at(i, 'translation', time) ?? gl.nodes[i].translation ?? [0, 0, 0];
    const G = {};
    for (const b of BONES) G[b] = qmul(globalRot(nodeOf(MAP[b][0]), localR), MAP[b][1]);
    const row = [];
    for (const b of BONES) {
      const p = PARENT[b];
      const local = qnorm(p ? qmul(qinv(G[p]), G[b]) : G[b]);
      row.push(...local.map((v) => Math.round(v * 1e4) / 1e4));
    }
    q.push(row);
    dy.push(Math.round(((localT(hipsNode)[1] - restHipsY) * armatureScale * hipScale) * 1e4) / 1e4);
    footY.l.push(globalPos(nodeOf('LeftToeBase'), localR, localT)[1]);
    footY.r.push(globalPos(nodeOf('RightToeBase'), localR, localT)[1]);
  }
  // footsteps: one landing per foot per cycle — the frame where the toe drops back under 20 % of its lift
  const steps = [];
  for (const side of ['l', 'r']) {
    const y = footY[side], lo = Math.min(...y), hi = Math.max(...y);
    if (hi - lo < 0.03) continue; // standing still
    const th = lo + (hi - lo) * 0.2;
    for (let f = 0; f < frames; f++) {
      if (y[f] <= th && y[(f - 1 + frames) % frames] > th) { steps.push(Math.round((f / frames) * 1e3) / 1e3); break; }
    }
  }
  result.clips[key] = { duration: Math.round(duration * 1e4) / 1e4, frames, q, dy, steps: steps.sort((a, b) => a - b) };
  console.log(`${key}: ${duration.toFixed(2)} s, ${frames} frames, steps at ${steps.join(', ') || '—'}`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
