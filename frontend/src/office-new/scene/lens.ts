// "Kamera kayak lensa beneran": titik fokus untuk depth of field (latar blur) + goyang tangan halus dan ayunan kepala
// saat berjalan. Hanya di Walk in dan rekaman kamera; Overview tetap stabil.
import * as THREE from 'three';
import { OBSTACLES } from '../world/layout';
import { agentBodies, walkers } from '../world/runtime';

/** Titik fokus lensa (koordinat dunia) — diisi CameraDirector tiap frame, dibaca DepthOfField. */
export const FOCUS = new THREE.Vector3(0, 1.2, 0);

const n = (t: number, f: number, p: number) => Math.sin(t * f + p);

/**
 * Goyang tangan: rotasi kecil yang berubah halus (beberapa sinus tak sebanding, terasa acak) dan, saat berjalan di
 * orang pertama, ayunan kepala seirama langkah. Mengembalikan offset tinggi kamera agar bisa dibatalkan frame berikutnya.
 */
export function handheld(cam: THREE.Camera, t: number, amount: number, walk: number, run: boolean): number {
  const yaw = (n(t, 0.63, 1.3) * 0.6 + n(t, 1.71, 4.1) * 0.3 + n(t, 3.1, 0.2) * 0.1) * 0.004 * amount;
  const pitch = (n(t, 0.71, 2.2) * 0.6 + n(t, 1.93, 0.7) * 0.3 + n(t, 2.7, 5.0) * 0.1) * 0.003 * amount;
  const roll = (n(t, 0.47, 3.3) * 0.7 + n(t, 1.3, 1.1) * 0.3) * 0.002 * amount;
  const freq = run ? 2.8 : 1.9;
  const step = Math.sin(t * Math.PI * 2 * freq);
  const dy = walk * (Math.abs(step) * (run ? 0.04 : 0.022) - (run ? 0.02 : 0.011));
  cam.position.y += dy;
  cam.rotateY(yaw);
  cam.rotateX(pitch - Math.abs(step) * 0.004 * walk);
  cam.rotateZ(roll + Math.sin(t * Math.PI * freq) * 0.005 * walk);
  return dy;
}

/**
 * Autofokus seperti kamera sungguhan: jarak ke benda pertama di tengah layar (dinding, perabot, orang, lantai, plafon).
 * Cukup murah untuk tiap frame: uji sinar 2D terhadap kotak tabrak (±600) + lingkaran orang.
 */
export function autoFocus(o: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3) {
  let t = 25;
  if (d.y < -0.01) t = Math.min(t, o.y / -d.y);
  if (d.y > 0.01) t = Math.min(t, (3 - o.y) / d.y);
  const ix = 1 / (d.x || 1e-9), iz = 1 / (d.z || 1e-9);
  for (const b of OBSTACLES) {
    const tx1 = (b.minX - o.x) * ix, tx2 = (b.maxX - o.x) * ix, tz1 = (b.minZ - o.z) * iz, tz2 = (b.maxZ - o.z) * iz;
    const tn = Math.max(Math.min(tx1, tx2), Math.min(tz1, tz2)), tf = Math.min(Math.max(tx1, tx2), Math.max(tz1, tz2));
    if (tf < 0 || tn > tf || tn > t) continue;
    const hit = Math.max(0, tn), y = o.y + d.y * hit;
    if (y > -0.05 && y < 2.4) t = hit;
  }
  const circle = (c: { x: number; z: number }) => {
    const cx = c.x - o.x, cz = c.z - o.z, along = cx * d.x + cz * d.z, h2 = d.x * d.x + d.z * d.z;
    if (along <= 0 || h2 < 1e-6) return;
    const ta = along / h2, px = o.x + d.x * ta - c.x, pz = o.z + d.z * ta - c.z;
    if (px * px + pz * pz < 0.09 && ta < t && o.y + d.y * ta < 1.9) t = ta;
  };
  for (const b of Object.values(agentBodies)) circle(b);
  for (const w of walkers) circle(w);
  return out.copy(o).addScaledVector(d, Math.max(0.4, t));
}
