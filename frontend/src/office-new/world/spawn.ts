// Posisi terakhir pemain (Walk in) disimpan per perangkat: refresh = lanjut di tempat yang sama; ☰ → Respawn kembali
// ke pintu masuk. Mode terakhir (Walk in / Overview) juga diingat.
import { PLAYER_BOUNDS, PLAYER_SPAWN } from './layout';
import { player } from './runtime';

const POS = 'avo-office-new-pos';
const MODE = 'avo-office-new-mode';

interface Saved { x: number; z: number; yaw: number; facing: number }

export function savedPosition(): Saved | null {
  try {
    const p = JSON.parse(localStorage.getItem(POS) || 'null') as Saved | null;
    if (!p || ![p.x, p.z, p.yaw, p.facing].every(Number.isFinite)) return null;
    const b = PLAYER_BOUNDS;
    return p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ ? p : null;
  } catch { return null; }
}

export function savePosition() {
  try { localStorage.setItem(POS, JSON.stringify({ x: +player.x.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(3), facing: +player.facing.toFixed(3) })); } catch { /* mode privat */ }
}

/** Tempatkan pemain: posisi terakhir bila ada, selain itu pintu masuk. */
export function placePlayer(fresh = false) {
  const p = fresh ? null : savedPosition();
  Object.assign(player, p
    ? { x: p.x, z: p.z, y: 0, vy: 0, yaw: p.yaw, facing: p.facing, pitch: -0.12, seat: null }
    : { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, y: 0, vy: 0, yaw: PLAYER_SPAWN.rot, facing: PLAYER_SPAWN.rot, pitch: -0.12, seat: null });
  if (fresh) savePosition();
}

export const savedMode = (): 'life' | 'overview' => { try { return localStorage.getItem(MODE) === 'life' ? 'life' : 'overview'; } catch { return 'overview'; } };
export const saveMode = (m: string) => { try { localStorage.setItem(MODE, m === 'life' ? 'life' : 'overview'); } catch { /* mode privat */ } };
