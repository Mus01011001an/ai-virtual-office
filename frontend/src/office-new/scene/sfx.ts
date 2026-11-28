// Efek suara Office Baru, dibunyikan tepat pada momennya (langkah kaki saat kaki menapak di rekaman gerak, ketikan,
// kursi diduduki, cangkir, pintu, notifikasi). Semua bunyi disintesis dengan Web Audio — tanpa file audio.
// Posisi: volume turun dengan jarak ke kamera (senyap > 14 m), kiri/kanan mengikuti arah pandang.
import { roomAt } from '../world/layout';

const KEY = 'avo-office-new-sfx';
const MAX_DIST = 14;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
const listener = { x: 0, y: 1.6, z: 0, fx: 0, fz: -1 };
/** batas bunyi per detik (puluhan orang berjalan sekaligus) */
let budget = 0, budgetT = 0;

function boot() {
  if (ctx || typeof window === 'undefined') return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
// Browser hanya mengizinkan audio setelah interaksi pengguna.
if (typeof window !== 'undefined') {
  const unlock = () => { boot(); void ctx?.resume(); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

/** Output untuk satu bunyi di (x, z): gain sesuai jarak + pan kiri/kanan. null = terlalu jauh / mati. */
function voice(x: number, z: number, vol: number): AudioNode | null {
  if (!enabled || !ctx || !master || ctx.state !== 'running') return null;
  const dx = x - listener.x, dz = z - listener.z;
  const d = Math.hypot(dx, dz, listener.y - 1.0);
  if (d > MAX_DIST) return null;
  const now = ctx.currentTime;
  if (now - budgetT > 1) { budgetT = now; budget = 0; }
  if (++budget > 40) return null;
  const g = ctx.createGain();
  g.gain.value = vol / (1 + (d / 2.2) ** 2);
  const pan = ctx.createStereoPanner();
  // kanan kamera = (-fz, fx)
  pan.pan.value = d > 0.01 ? Math.max(-0.85, Math.min(0.85, (dx * -listener.fz + dz * listener.fx) / Math.hypot(dx, dz))) : 0;
  g.connect(pan).connect(master);
  return g;
}

function noiseBurst(out: AudioNode, { type, freq, q = 1, attack = 0.002, decay, gain = 1, at = 0, sweepTo }: { type: BiquadFilterType; freq: number; q?: number; attack?: number; decay: number; gain?: number; at?: number; sweepTo?: number }) {
  const c = ctx!, t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + attack + decay);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  src.connect(f).connect(g).connect(out);
  src.start(t0, Math.random() * 0.5, attack + decay + 0.05);
}

function tone(out: AudioNode, { freq, to, type = 'sine', decay, gain = 1, at = 0 }: { freq: number; to?: number; type?: OscillatorType; decay: number; gain?: number; at?: number }) {
  const c = ctx!, t0 = c.currentTime + at;
  const o = c.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + decay);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  o.connect(g).connect(out);
  o.start(t0); o.stop(t0 + decay + 0.02);
}

type Surface = 'carpet' | 'wood' | 'tile' | 'outside';
function surfaceAt(x: number, z: number): Surface {
  const f = roomAt(x, z)?.floor ?? '';
  return /Carpet/.test(f) ? 'carpet' : /Tiles|Panel/.test(f) ? 'tile' : /Wood/.test(f) ? 'wood' : 'outside';
}

export const sfx = {
  get enabled() { return enabled; },
  setEnabled(on: boolean) { enabled = on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* mode privat */ } if (on) { boot(); void ctx?.resume(); } },
  /** dipanggil tiap frame dari kamera */
  setListener(x: number, y: number, z: number, fx: number, fz: number) {
    const l = Math.hypot(fx, fz) || 1;
    Object.assign(listener, { x, y, z, fx: fx / l, fz: fz / l });
  },
  /** langkah kaki — bunyinya mengikuti lantai: karpet empuk, kayu, ubin, luar */
  footstep(x: number, z: number, run = false) {
    const out = voice(x, z, run ? 0.5 : 0.36);
    if (!out) return;
    const s = surfaceAt(x, z);
    if (s === 'carpet') noiseBurst(out, { type: 'lowpass', freq: 380, q: 0.7, decay: 0.09, gain: 0.9 });
    else if (s === 'wood') { noiseBurst(out, { type: 'bandpass', freq: 1100 + Math.random() * 300, q: 1.4, decay: 0.06, gain: 0.8 }); tone(out, { freq: 95, to: 60, decay: 0.08, gain: 0.5 }); }
    else if (s === 'tile') noiseBurst(out, { type: 'bandpass', freq: 2400 + Math.random() * 500, q: 2, decay: 0.045, gain: 0.7 });
    else noiseBurst(out, { type: 'bandpass', freq: 700, q: 0.9, decay: 0.08, gain: 0.7 });
  },
  /** satu tuts keyboard */
  key(x: number, z: number) {
    const out = voice(x, z, 0.12);
    if (out) noiseBurst(out, { type: 'highpass', freq: 3200 + Math.random() * 1500, q: 0.8, decay: 0.022, gain: 1 });
  },
  /** duduk di kursi: dudukan empuk + derit */
  chair(x: number, z: number) {
    const out = voice(x, z, 0.3);
    if (!out) return;
    noiseBurst(out, { type: 'lowpass', freq: 260, decay: 0.16, gain: 0.9 });
    tone(out, { freq: 210, to: 150, type: 'sawtooth', decay: 0.22, gain: 0.08, at: 0.05 });
  },
  /** cangkir diletakkan / diangkat: denting keramik */
  cup(x: number, z: number) {
    const out = voice(x, z, 0.22);
    if (!out) return;
    tone(out, { freq: 2650, decay: 0.28, gain: 0.5 });
    tone(out, { freq: 4180, decay: 0.16, gain: 0.3 });
  },
  /** pintu membuka (desis + klik grendel) / menutup (debum + klik) */
  door(x: number, z: number, open: boolean) {
    const out = voice(x, z, 0.3);
    if (!out) return;
    noiseBurst(out, { type: 'highpass', freq: 3000, decay: 0.012, gain: 0.8 });
    if (open) noiseBurst(out, { type: 'lowpass', freq: 400, sweepTo: 1300, attack: 0.08, decay: 0.45, gain: 0.25, at: 0.02 });
    else { tone(out, { freq: 75, to: 50, decay: 0.16, gain: 0.7, at: 0.02 }); noiseBurst(out, { type: 'lowpass', freq: 320, decay: 0.12, gain: 0.6, at: 0.02 }); }
  },
  /** notifikasi UI (tidak berposisi): tugas selesai / pesan baru */
  chime(kind: 'done' | 'message' = 'message') {
    if (!enabled || !ctx || !master || ctx.state !== 'running') return;
    const g = ctx.createGain(); g.gain.value = 0.12; g.connect(master);
    if (kind === 'done') { tone(g, { freq: 880, decay: 0.18 }); tone(g, { freq: 1320, decay: 0.3, at: 0.12 }); }
    else tone(g, { freq: 1046, decay: 0.2 });
  },
};
