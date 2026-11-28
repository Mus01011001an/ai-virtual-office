// Zoom kamera Walk in (scroll mouse): 0 = orang pertama; 1,2–4,5 m = orang ketiga di belakang bahu (di bawah plafon);
// makin jauh kamera naik & menunduk sampai pandangan atas ala Dota (±54°, 24 m). Disimpan per perangkat.
const KEY = 'avo-office-new-zoom';

export const ZOOM = { MIN_THIRD: 1.2, MAX: 24, DEFAULT: 4.2, TOP_PITCH: -0.95 };

/** Jarak kamera sebenarnya (teredam menuju target di store) & bobot pandangan atas 0..1 — diisi Player tiap frame. */
export const camZoom = { dist: ZOOM.DEFAULT, top: 0 };

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 0 = orang ketiga biasa, 1 = pandangan atas penuh. */
export const topWeight = (dist: number) => smooth(4.5, 11, dist);

/** Zoom yang valid: 0 (orang pertama) atau MIN_THIRD..MAX. */
export const clampZoom = (z: number) => (z <= 0 ? 0 : Math.min(ZOOM.MAX, Math.max(ZOOM.MIN_THIRD, z)));

export function loadZoom() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return localStorage.getItem(KEY) !== null && Number.isFinite(v) ? clampZoom(v) : ZOOM.DEFAULT;
  } catch { return ZOOM.DEFAULT; }
}
export function saveZoom(z: number) {
  try { localStorage.setItem(KEY, String(z)); } catch { /* mode privat */ }
}
