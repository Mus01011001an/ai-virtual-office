// Penghitung performa seperti di video referensi ("28 FPS · draw calls per frame"): ⚙ → Show FPS & draw calls.
// Disimpan per perangkat. Nilai diperbarui 2× per detik oleh <PerfMeter/> di kanvas office.
import { useSyncExternalStore } from 'react';

const KEY = 'avo-office-new-perf';
let state = {
  on: (() => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } })(),
  fps: 0, calls: 0, tris: 0,
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const perf = {
  get: () => state,
  set(p: Partial<typeof state>) { state = { ...state, ...p }; emit(); },
  setOn(on: boolean) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* mode privat */ }
    this.set({ on });
  },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};

export const usePerf = () => useSyncExternalStore(perf.subscribe, perf.get);
