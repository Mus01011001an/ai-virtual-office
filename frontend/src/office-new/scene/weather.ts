// Cuaca & waktu office (☰ → Weather & time): pagi / siang / sore / malam, plus hujan. Disimpan per perangkat.
// Hanya suasana luar (langit, matahari/bulan, kabut, hujan) — lampu ruangan tetap menyala.
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'night';
export interface Weather { time: TimeOfDay; rain: boolean }

const KEY = 'avo-office-new-weather';
export function loadWeather(): Weather {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) || 'null') as Weather | null;
    if (w && ['morning', 'noon', 'afternoon', 'night'].includes(w.time)) return { time: w.time, rain: !!w.rain };
  } catch { /* abaikan */ }
  return { time: 'night', rain: false };
}
export const saveWeather = (w: Weather) => { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* mode privat */ } };

export interface Sky {
  sky: string; fog: [number, number];
  hemiSky: string; hemiGround: string; hemi: number;
  sun: [number, number, number]; sunColor: string; sunIntensity: number;
  env: number;
}

const BASE: Record<TimeOfDay, Sky> = {
  morning: { sky: '#a9c9e6', fog: [70, 170], hemiSky: '#cfe2ff', hemiGround: '#6b5a45', hemi: 0.95, sun: [34, 16, 22], sunColor: '#ffd6a3', sunIntensity: 1.9, env: 0.7 },
  noon: { sky: '#8fc1ef', fog: [90, 200], hemiSky: '#d9ecff', hemiGround: '#7a6a55', hemi: 1.15, sun: [8, 42, 12], sunColor: '#fff6e6', sunIntensity: 2.5, env: 0.85 },
  afternoon: { sky: '#e3a57e', fog: [65, 160], hemiSky: '#f6c9a6', hemiGround: '#5a4535', hemi: 0.85, sun: [-34, 13, 16], sunColor: '#ffb070', sunIntensity: 1.7, env: 0.62 },
  night: { sky: '#0b1222', fog: [60, 150], hemiSky: '#4a5f8f', hemiGround: '#2a1d14', hemi: 0.6, sun: [22, 30, 18], sunColor: '#a9bcff', sunIntensity: 0.75, env: 0.4 },
};

/** Langit untuk cuaca ini (hujan: lebih kelabu & redup, kabut lebih dekat). */
export function skyFor(w: Weather): Sky {
  const b = BASE[w.time];
  if (!w.rain) return b;
  const night = w.time === 'night';
  return {
    ...b,
    sky: night ? '#0d1219' : w.time === 'afternoon' ? '#6f6a6e' : '#66717d',
    fog: [35, 120],
    hemiSky: night ? '#3c4860' : '#a7b2bf', hemi: b.hemi * 0.85,
    sunColor: night ? b.sunColor : '#dfe6ee', sunIntensity: b.sunIntensity * (night ? 0.6 : 0.35),
    env: b.env * 0.8,
  };
}
