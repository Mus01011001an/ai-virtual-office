import type { Agent } from '../core/types';

export type HqState = 'asleep' | 'working' | 'ready' | 'waiting' | 'error';
export const HQ_LABEL: Record<HqState, string> = { asleep: 'ASLEEP', working: 'WORKING', ready: 'READY', waiting: 'WAITING FOR OK', error: 'ERROR' };

/** Status agen → status "skill" Agent HQ: tidur sampai benar-benar dipakai. */
export function hqState(a: Agent): HqState {
  if (a.status === 'paused') return 'waiting';
  if (a.status === 'error') return 'error';
  if (a.status === 'completed') return 'ready';
  if (a.status === 'thinking' || a.status === 'working') return 'working';
  return 'asleep';
}
