// Kualitas grafis Office Baru. Default "auto": Low di iPad/iPhone & perangkat lemah (≤4 core / ≤4 GB), High di
// komputer. Pilihan disimpan per perangkat (⚙ → Graphics); ?lite / ?full memaksa Low / High untuk uji.
export type GfxChoice = 'auto' | 'low' | 'medium' | 'high';
export type GfxLevel = Exclude<GfxChoice, 'auto'>;

const KEY = 'avo-office-new-gfx';
const qs = new URLSearchParams(location.search);
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const weak = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

/** Level yang dipilih "auto" di perangkat ini. */
export const AUTO_LEVEL: GfxLevel = IOS || weak ? 'low' : 'high';

const saved = (() => { try { return localStorage.getItem(KEY) as GfxChoice | null; } catch { return null; } })();
export const GFX_CHOICE: GfxChoice = qs.has('lite') ? 'low' : qs.has('full') ? 'high'
  : saved && ['auto', 'low', 'medium', 'high'].includes(saved) ? saved : 'auto';
export const GFX: GfxLevel = GFX_CHOICE === 'auto' ? AUTO_LEVEL : GFX_CHOICE;

/** Pengaturan per level. */
export const Q = {
  low: { dpr: [1, 1] as [number, number], msaa: 0, bloom: false, shadow: 2048, lights: 4, allStaff: false, doorsOverview: false },
  medium: { dpr: [1, 1.25] as [number, number], msaa: 0, bloom: true, shadow: 2048, lights: 6, allStaff: true, doorsOverview: true },
  high: { dpr: [1, 1.5] as [number, number], msaa: 2, bloom: true, shadow: 4096, lights: 10, allStaff: true, doorsOverview: true },
}[GFX];

/** Mode ringan (dipakai NPC & pintu). */
export const LITE = GFX === 'low';
/** Jumlah lampu ruangan yang dihitung per piksel (lampu terdekat kamera; jumlah tetap → tanpa kompilasi ulang). */
export const LIGHT_POOL = Q.lights;

/** Simpan pilihan lalu muat ulang (resolusi, bayangan & daftar NPC dibangun saat mulai). */
export function setGfx(choice: GfxChoice) {
  try { localStorage.setItem(KEY, choice); } catch { /* mode privat: hanya berlaku sampai reload */ }
  const url = new URL(location.href);
  url.searchParams.delete('lite');
  url.searchParams.delete('full');
  location.replace(url.toString());
}
