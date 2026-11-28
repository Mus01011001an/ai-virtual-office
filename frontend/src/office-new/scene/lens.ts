// Kamera terasa dipegang tangan: goyang halus + ayunan kepala saat berjalan (Walk in & rekaman kamera; Overview stabil).
// Depth of field (latar blur) dihapus 2026-11-28: di High semua terlihat kabur.
import * as THREE from 'three';

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
