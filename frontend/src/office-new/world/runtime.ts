// Per-frame shared state between 3D components (kept out of React state on purpose).
import type { AgentId } from '../core/types';
import { PLAYER_SPAWN, deskSeat } from './layout';
import { AGENT_IDS } from '../core/types';

export interface Body { x: number; z: number; rot: number; }

export const agentBodies = Object.fromEntries(AGENT_IDS.map((id) => {
  const s = deskSeat(id);
  return [id, { x: s.x, z: s.z, rot: s.rot }];
})) as Record<AgentId, Body>;

export const player = {
  x: PLAYER_SPAWN.x,
  y: 0,
  z: PLAYER_SPAWN.z,
  vy: 0,
  yaw: PLAYER_SPAWN.rot,
  pitch: -0.12,
  facing: PLAYER_SPAWN.rot,
  moving: false,
  running: false,
  /** Where the player is sitting, if anywhere. */
  seat: null as null | { x: number; z: number; rot: number },
};

/** Staff who walk around (agents are in agentBodies); doors open for them. */
export const walkers = new Set<{ x: number; z: number; rot: number }>();
/**
 * Orang tidak saling tembus: apakah ada orang lain (pemain, agen, staf yang berjalan) tepat di depan `self` yang
 * bergerak ke arah (dx, dz)? Yang berjalan lalu menunggu sebentar / bergeser, bukan menembus.
 */
export function personAhead(self: object, x: number, z: number, dx: number, dz: number, reach = 0.62): { x: number; z: number } | null {
  const l = Math.hypot(dx, dz) || 1;
  const check = (o: { x: number; z: number }) => {
    const ox = o.x - x, oz = o.z - z, d = Math.hypot(ox, oz);
    return d > 0.01 && d < reach && (ox * dx + oz * dz) / (d * l) > 0.35;
  };
  if (self !== player && player.y < 0.5 && check(player)) return player;
  for (const b of Object.values(agentBodies)) if (b !== self && check(b)) return b;
  for (const w of walkers) if (w !== self && check(w)) return w;
  return null;
}

/** The camera during a recorded shot, so doors open as it flies through them. */
export const shotCamera = { active: false, x: 0, z: 0, rot: 0 };

export const keys = new Set<string>();
export const look = {
  locked: false,
  /** iPad/Safari tanpa Pointer Lock: kamera mengikuti posisi kursor mouse (kiri/kanan = menoleh). */
  steer: false,
  /** posisi kursor relatif tengah layar, -1..1 */
  cx: 0, cy: 0, hover: false,
};
/** Joystick layar sentuh: x kanan, y maju (-1..1). */
export const touchMove = { x: 0, y: 0 };
/** What the player would interact with by pressing E. */
export const nearby: { kind: 'agent' | 'object' | null; id: string | null } = { kind: null, id: null };
