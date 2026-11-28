// Gerak motion capture (Mixamo) untuk karakter blocky. Kurva dibuat oleh tools/office-new/mocap/build-mocap.mjs dari
// glb Mixamo (idle / walk / run) dan sudah di-retarget ke 11 tulang rig blocky (BlockyAvatar.tsx, urutan `bones`).
import * as THREE from 'three';
import data from './clips.json';

export type ClipName = 'idle' | 'walk' | 'run';
export interface MocapClip {
  duration: number;
  frames: number;
  /** frames × bones × 4 (x, y, z, w), rotasi lokal tiap tulang */
  q: Float32Array;
  /** naik-turun pinggul per frame (m, sudah diskalakan ke rig blocky) */
  dy: Float32Array;
  /** fase (0..1) saat kaki menapak — untuk suara langkah */
  steps: number[];
}

interface Raw { duration: number; frames: number; q: number[][]; dy: number[]; steps: number[] }
const raw = data as unknown as { bones: string[]; clips: Record<string, Raw> };

export const MOCAP_BONES = raw.bones;
export const CLIPS: Partial<Record<ClipName, MocapClip>> = {};
for (const [name, c] of Object.entries(raw.clips)) {
  CLIPS[name as ClipName] = { duration: c.duration, frames: c.frames, q: new Float32Array(c.q.flat()), dy: new Float32Array(c.dy), steps: c.steps };
}

/** Kecepatan jalan/lari alami klip pada skala rig blocky (m/s) — dipakai menyamakan langkah dengan gerak (tanpa "kaki meluncur"). */
export const NATURAL_SPEED: Record<ClipName, number> = { idle: 0, walk: 0.85, run: 2.3 };

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
/** Pose klip pada fase 0..1 (berulang) → out[bone] (quaternion), kembalikan naik-turun pinggul. */
export function sampleClip(clip: MocapClip, phase: number, out: THREE.Quaternion[]): number {
  const f = (((phase % 1) + 1) % 1) * clip.frames;
  const i0 = Math.floor(f) % clip.frames, i1 = (i0 + 1) % clip.frames, u = f - Math.floor(f);
  const nb = out.length;
  for (let b = 0; b < nb; b++) {
    const o0 = (i0 * nb + b) * 4, o1 = (i1 * nb + b) * 4;
    qa.set(clip.q[o0], clip.q[o0 + 1], clip.q[o0 + 2], clip.q[o0 + 3]);
    qb.set(clip.q[o1], clip.q[o1 + 1], clip.q[o1 + 2], clip.q[o1 + 3]);
    out[b].slerpQuaternions(qa, qb, u);
  }
  return clip.dy[i0] + (clip.dy[i1] - clip.dy[i0]) * u;
}
