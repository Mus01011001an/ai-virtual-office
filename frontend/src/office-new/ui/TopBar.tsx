// Top bar ringkas: logo + status live, pilihan mode (ikon), ruangan / kamera dalam satu tombol, sembunyikan UI, menu ☰.
// Semua menu tetap ada, tapi hanya muncul saat diklik (layar bersih).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useOffice, type CameraPreset } from '../store/useOffice';
import { ClaudeHookHelp } from './ClaudeHookHelp';
import { getToken } from '../core/avo/api';
import { api, setToken } from '../../lib/api';
import { SHOTS } from '../scene/shots';
import { AGENT_IDS } from '../core/types';
import { Icon } from './common';
import { AUTO_LEVEL, GFX_CHOICE, setGfx, type GfxChoice } from '../scene/quality';
import { sfx } from '../scene/sfx';
import { perf, usePerf } from '../scene/perf';
import { placePlayer } from '../world/spawn';
import type { TimeOfDay } from '../scene/weather';

async function signOut() {
  try { await api('POST', '/auth/signout'); } catch { /* token mungkin sudah tidak valid */ }
  setToken(null);
  location.href = '/office-new/';
}

const PRESET_LABEL: Record<CameraPreset, string> = { overview: 'Whole building', workspace: 'Workspace', meeting: 'Meeting room', manager: 'Manager office', lounge: 'Lounge', kitchen: 'Kitchen', security: 'Cyber Security' };
const chip = 'flex h-8 items-center gap-1.5 rounded-xl border border-line bg-[rgb(14_17_26/0.72)] px-2 text-[12px] font-semibold text-ink/85 hover:bg-white/10 hover:text-ink';

/** Menu tarik-turun kecil: tertutup saat klik di luar. */
function Menu({ button, children, width = 'w-56', title }: { button: ReactNode; children: (close: () => void) => ReactNode; width?: string; title: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} className={`${chip} ${open ? 'bg-white/12 text-ink' : ''}`} title={title} aria-label={title}>{button}</button>
      {open && <div className={`panel absolute right-0 top-10 z-50 p-2 text-[12.5px] ${width}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

const GFX_OPTIONS: { id: GfxChoice; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Picks for this device' },
  { id: 'low', label: 'Low', hint: 'Smooth on iPad & phones: 1× resolution, 4 lights, flat colours, no glow or lens blur, fewer staff' },
  { id: 'medium', label: 'Medium', hint: 'Balanced: 1.25× resolution, 6 lights, real textures, glow, lens blur, all staff' },
  { id: 'high', label: 'High', hint: 'Best look: 1.5× resolution, all 10 lights, real textures, glow, lens blur, anti-aliasing, sharp shadows' },
];

/** Kualitas grafis: Auto (default) / Low / Medium / High. Menyimpan pilihan lalu memuat ulang office. */
function GraphicsSetting() {
  const [busy, setBusy] = useState(false);
  const pick = (c: GfxChoice) => { if (c === GFX_CHOICE) return; setBusy(true); setTimeout(() => setGfx(c), 50); };
  const cur = GFX_OPTIONS.find((o) => o.id === GFX_CHOICE)!;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wider text-muted">Graphics</span>
        <span className="text-muted">{busy ? 'Applying…' : GFX_CHOICE === 'auto' ? `Auto → ${AUTO_LEVEL[0].toUpperCase()}${AUTO_LEVEL.slice(1)}` : ''}</span>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/25 p-0.5">
        {GFX_OPTIONS.map((o) => (
          <button key={o.id} onClick={() => pick(o.id)} disabled={busy} title={o.hint}
            className={`rounded-md py-1 text-[11.5px] font-semibold transition ${GFX_CHOICE === o.id ? 'bg-white/16 text-ink' : 'text-muted hover:bg-white/8 hover:text-ink'}`}>{o.label}</button>
        ))}
      </div>
      <div className="mt-1 text-[10.5px] leading-snug text-muted">{GFX_CHOICE === 'auto' ? GFX_OPTIONS.find((o) => o.id === AUTO_LEVEL)!.hint : cur.hint}</div>
    </div>
  );
}

/** Efek suara (langkah, ketikan, pintu, notifikasi) — disimpan per perangkat. */
function SoundToggle() {
  const [on, setOn] = useState(sfx.enabled);
  return (
    <label className="flex cursor-pointer items-center justify-between py-1">
      <span>Sound effects</span>
      <input type="checkbox" checked={on} onChange={(e) => { sfx.setEnabled(e.target.checked); setOn(e.target.checked); }} />
    </label>
  );
}

/** Penghitung FPS & draw call seperti di video (pojok kanan bawah). */
function PerfToggle() {
  const on = usePerf().on;
  return (
    <label className="flex cursor-pointer items-center justify-between py-1">
      <span>Show FPS &amp; draw calls</span>
      <input type="checkbox" checked={on} onChange={(e) => perf.setOn(e.target.checked)} />
    </label>
  );
}

const TIMES: { id: TimeOfDay; label: string }[] = [
  { id: 'morning', label: 'Morning' }, { id: 'noon', label: 'Noon' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'night', label: 'Night' },
];

/** Cuaca & waktu: langit, matahari/bulan, kabut; hujan dengan suara yang menenangkan. */
function WeatherSetting() {
  const w = useOffice((s) => s.weather);
  const setWeather = useOffice((s) => s.setWeather);
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Weather &amp; time</div>
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/25 p-0.5">
        {TIMES.map((t) => (
          <button key={t.id} onClick={() => setWeather({ time: t.id })}
            className={`rounded-md py-1 text-[11px] font-semibold transition ${w.time === t.id ? 'bg-white/16 text-ink' : 'text-muted hover:bg-white/8 hover:text-ink'}`}>{t.label}</button>
        ))}
      </div>
      <label className="mt-1.5 flex cursor-pointer items-center justify-between py-0.5">
        <span>Rain <span className="text-muted">· calm rain sound</span></span>
        <input type="checkbox" checked={w.rain} onChange={(e) => setWeather({ rain: e.target.checked })} />
      </label>
    </div>
  );
}

/** Menu ☰ (kanan atas): satu-satunya tempat menu "pause" di Walk in, plus semua pengaturan. Esc tidak membukanya. */
function MainMenu() {
  const open = useOffice((s) => s.menuOpen);
  const setMenu = useOffice((s) => s.setMenu);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open, setMenu]);
  const toggle = () => {
    if (!open && document.pointerLockElement) document.exitPointerLock();
    setMenu(!open);
  };
  return (
    <div ref={box} className="relative">
      <button onClick={toggle} className={`${chip} ${open ? 'bg-white/12 text-ink' : ''}`} title="Menu" aria-label="Menu"><Icon name="menu" /></button>
      {open && <div className="panel scroll-thin absolute right-0 top-10 z-50 max-h-[calc(100vh-70px)] w-72 overflow-y-auto p-2 text-[12.5px]"><MenuBody close={() => setMenu(false)} /></div>}
    </div>
  );
}

function MenuBody({ close }: { close: () => void }) {
  const s = useOffice();
  const playShot = useOffice((x) => x.playShot);
  return (
        <div className="p-1">
          {s.mode === 'life' && (
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              <button onClick={close} className="rounded-md bg-accent px-2 py-1.5 font-semibold text-slate-950 hover:brightness-110">Resume</button>
              <button onClick={() => { placePlayer(true); close(); }} className="rounded-md bg-white/6 px-2 py-1.5 font-semibold hover:bg-white/12" title="Back to the entrance">Respawn</button>
              <button onClick={() => s.setCameraStyle(s.cameraStyle === 'third' ? 'first' : 'third')} className="rounded-md bg-white/6 px-2 py-1.5 font-semibold hover:bg-white/12">{s.cameraStyle === 'third' ? '1st person' : '3rd person'}</button>
              <button onClick={() => s.setMode('overview')} className="rounded-md bg-white/6 px-2 py-1.5 font-semibold hover:bg-white/12">Overview</button>
            </div>
          )}
          <WeatherSetting />
          {s.officeName && <div className="mb-2 truncate text-[12px]"><span className="text-muted">Office · </span><span className="font-semibold">{s.officeName}</span></div>}
          <div className="mb-3 flex gap-1.5">
            <a href="/office-new/?offices" className="flex-1 rounded-md bg-white/6 px-2 py-1.5 text-center font-semibold hover:bg-white/12">Switch office</a>
            <button onClick={() => void signOut()} className="flex-1 rounded-md bg-white/6 px-2 py-1.5 font-semibold hover:bg-white/12">Sign out</button>
          </div>
          <GraphicsSetting />
          {s.source === 'claude-code' && <ClaudeHookHelp />}
          {s.adapter.can.speed && (
            <div className="mb-3 flex gap-1">
              {[1, 2, 4].map((x) => (
                <button key={x} onClick={() => s.setSpeed(x)} className={`flex-1 rounded-md py-1 font-semibold ${s.speed === x ? 'bg-white/14' : 'bg-white/5 text-muted hover:bg-white/10'}`}>{x}×</button>
              ))}
            </div>
          )}
          {s.mode === 'overview' && (
            <details className="mb-2">
              <summary className="cursor-pointer select-none py-1 text-muted hover:text-ink">Camera shots (recording)</summary>
              {SHOTS.map((sh) => (
                <button key={sh.id} onClick={() => { close(); playShot(sh.id); }} className="flex w-full justify-between rounded-md px-2 py-1 text-left hover:bg-white/10">
                  <span>{sh.label}</span><span className="text-muted">{sh.seconds}s</span>
                </button>
              ))}
            </details>
          )}
          <SoundToggle />
          <PerfToggle />
          <label className="flex cursor-pointer items-center justify-between py-1">
            <span>Read replies aloud</span>
            <input type="checkbox" checked={s.voiceOn} onChange={(e) => s.setVoice(e.target.checked)} />
          </label>
          <div className="mt-1 text-[11px] text-muted">H hides the interface · N T P C L open panels · Esc frees the cursor</div>
        </div>
  );
}

const MODES = [
  { id: 'overview', icon: 'overview', label: 'Overview' },
  { id: 'life', icon: 'walk', label: 'Walk in' },
  { id: 'hq', icon: 'hq', label: 'Agent HQ' },
] as const;

export function TopBar() {
  const s = useOffice();
  const staffed = AGENT_IDS.filter((id) => !s.agents[id].vacant).length;
  const working = AGENT_IDS.filter((id) => !s.agents[id].vacant && (s.agents[id].status === 'working' || s.agents[id].status === 'thinking')).length;
  const live = !s.adapter.isSimulated;
  const dot = !live ? 'bg-demo' : s.liveStatus === 'open' ? 'bg-emerald-400' : s.liveStatus === 'error' ? 'bg-red-400' : 'bg-amber-300';
  return (
    <header className="pointer-events-auto flex items-center gap-2 px-3 pt-3">
      {/* logo + status: satu pil kecil */}
      <div className="flex h-8 items-center gap-2 rounded-xl border border-line bg-[rgb(14_17_26/0.72)] pl-1 pr-2.5"
        title={live ? `${s.source === 'avo' ? 'AI team' : 'Claude Code'} · ${s.liveStatus ?? ''}` : 'Demo (simulated)'}>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-[10px] font-black text-slate-950">AI</span>
        <span className={`h-1.5 w-1.5 rounded-full ${dot} ${live && s.liveStatus === 'open' ? 'animate-pulse' : ''}`} />
        <span className="text-[12px] font-semibold tabular-nums text-ink/85">{working}<span className="text-muted">/{staffed}</span></span>
        {!live && <span className="text-[10px] font-bold tracking-wide text-demo">DEMO</span>}
        {!live && !getToken() && <a href="/office-new/" className="text-[11px] font-semibold text-accent">Sign in</a>}
      </div>

      {/* mode: ikon, label hanya untuk yang aktif */}
      <div className="flex h-8 items-center gap-0.5 rounded-xl border border-line bg-[rgb(14_17_26/0.72)] p-0.5">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => s.setMode(m.id)} title={m.label} aria-label={m.label}
            className={`flex h-7 items-center gap-1.5 rounded-[9px] px-2 text-[12px] font-semibold transition ${s.mode === m.id ? 'bg-accent text-slate-950' : 'text-ink/70 hover:bg-white/8 hover:text-ink'}`}>
            <Icon name={m.icon} size={15} />{s.mode === m.id && <span>{m.label}</span>}
          </button>
        ))}
      </div>

      {s.mode === 'overview' && (
        <Menu title="Go to a room" width="w-44" button={<><Icon name="pin" size={15} /><span className="hidden sm:inline">{s.preset === 'overview' ? 'Rooms' : PRESET_LABEL[s.preset]}</span></>}>
          {(close) => (Object.keys(PRESET_LABEL) as CameraPreset[]).map((p) => (
            <button key={p} onClick={() => { s.goPreset(p); close(); }}
              className={`block w-full rounded-md px-2 py-1.5 text-left hover:bg-white/10 ${s.preset === p ? 'font-semibold text-ink' : 'text-ink/80'}`}>{PRESET_LABEL[p]}</button>
          ))}
        </Menu>
      )}
      {s.mode === 'life' && (
        <button onClick={() => s.setCameraStyle(s.cameraStyle === 'third' ? 'first' : 'third')} className={chip} title="1st / 3rd person (V)">
          <Icon name={s.cameraStyle === 'third' ? 'person' : 'eye'} size={15} /><span className="hidden sm:inline">{s.cameraStyle === 'third' ? '3rd' : '1st'}</span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={() => s.toggleUi()} className={chip} title="Hide interface (H)" aria-label="Hide interface"><Icon name="eyeOff" size={15} /></button>
        <MainMenu />
      </div>
    </header>
  );
}
