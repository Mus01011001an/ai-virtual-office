// Layar bersih: semua panel HUD jadi dock ikon kecil di kiri. Satu panel terbuka sekaligus (klik ikon lagi / Esc
// untuk menutup). Badge kecil menjaga info penting tetap terlihat tanpa panel; pesan tim baru muncul sebagai toast singkat.
import { useEffect, useRef, useState } from 'react';
import { useOffice, type DockPanel } from '../store/useOffice';
import { AGENT_IDS } from '../core/types';
import { Icon, Section, clock, speakerColor, speakerName } from './common';
import { AgentActivity, RecentLog, Stats, TaskInput, Timeline } from './Dashboard';
import { CommsFeed } from './CommsPanel';

const ITEMS: { id: DockPanel; icon: string; label: string; key: string }[] = [
  { id: 'task', icon: 'plus', label: 'New task', key: 'N' },
  { id: 'team', icon: 'team', label: 'Team', key: 'T' },
  { id: 'tasks', icon: 'tasks', label: 'Tasks & progress', key: 'P' },
  { id: 'comms', icon: 'chat', label: 'Team channel', key: 'C' },
  { id: 'log', icon: 'pulse', label: 'Recent activity', key: 'L' },
];

function useBadges() {
  const agents = useOffice((s) => s.agents);
  const tasks = useOffice((s) => s.tasks);
  const messages = useOffice((s) => s.messages);
  const panel = useOffice((s) => s.panel);
  const seen = useRef(0);
  const team = messages.filter((m) => m.channel === 'team').length;
  if (panel === 'comms') seen.current = team;
  const working = AGENT_IDS.filter((id) => !agents[id].vacant && (agents[id].status === 'working' || agents[id].status === 'thinking')).length;
  const errors = AGENT_IDS.some((id) => !agents[id].vacant && agents[id].status === 'error');
  const running = Object.values(tasks).filter((t) => t.status === 'running').length;
  return { team: working, error: errors, tasks: running, comms: Math.max(0, team - seen.current) } as Record<string, number | boolean>;
}

function PanelBody({ id, close }: { id: DockPanel; close: () => void }) {
  if (id === 'task') return <div className="flex flex-col gap-2"><TaskInput /><Close close={close} /></div>;
  if (id === 'team') return <div className="relative"><AgentActivity /><Close close={close} /></div>;
  if (id === 'tasks') return <div className="flex flex-col gap-2"><Stats /><Timeline /><Close close={close} /></div>;
  if (id === 'log') return <div className="relative"><RecentLog /><Close close={close} /></div>;
  return (
    <Section title="Team channel" onClose={close}
      right={<span className="flex items-center gap-1 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />live</span>}>
      <CommsFeed height="max-h-[60vh]" />
    </Section>
  );
}

/** Tombol tutup kecil di pojok panel. */
function Close({ close }: { close: () => void }) {
  return <button onClick={close} className="absolute right-2 top-2 rounded-md px-1.5 text-[13px] leading-5 text-muted hover:bg-white/8 hover:text-ink" title="Close (Esc)">✕</button>;
}

/** Pesan tim terbaru muncul 4 detik di bawah dock (hanya bila panel komunikasi tertutup). */
function CommsToast() {
  const messages = useOffice((s) => s.messages);
  const panel = useOffice((s) => s.panel);
  const last = [...messages].reverse().find((m) => m.channel === 'team');
  const [shown, setShown] = useState<string | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!last) return;
    if (first.current) { first.current = false; return; }
    setShown(last.id);
    const t = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!last || shown !== last.id || panel === 'comms') return null;
  return (
    <button onClick={() => useOffice.getState().setPanel('comms')}
      className="pointer-events-auto mt-1 w-[260px] rounded-xl border border-line bg-slate-950/80 px-2.5 py-1.5 text-left text-[11.5px] shadow-lg transition-opacity">
      <span className="font-bold" style={{ color: speakerColor(last.from) }}>{speakerName(last.from)}</span>
      {last.to && last.to !== 'all' && <span className="text-muted"> → {last.to === 'user' ? 'You' : speakerName(last.to)}</span>}
      <span className="float-right font-mono text-[10px] text-muted">{clock(last.ts)}</span>
      <span className="mt-0.5 line-clamp-2 block text-ink/90">{last.text}</span>
    </button>
  );
}

export function Dock() {
  const panel = useOffice((s) => s.panel);
  const setPanel = useOffice((s) => s.setPanel);
  const badges = useBadges();
  const [hover, setHover] = useState<DockPanel | null>(null);

  // Pintasan: N T P C L membuka panel (tidak saat mengetik / berjalan dengan WASD di walk-in)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (useOffice.getState().mode !== 'overview' || e.metaKey || e.ctrlKey) return;
      const it = ITEMS.find((i) => i.key.toLowerCase() === e.key.toLowerCase());
      if (it) setPanel(it.id);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [setPanel]);

  return (
    <div className="pointer-events-none flex min-h-0 items-start gap-2">
      <div className="pointer-events-auto flex flex-col gap-1.5">
        {ITEMS.map((it) => {
          const b = badges[it.id];
          const active = panel === it.id;
          return (
            <div key={it.id} className="relative" onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)}>
              <button onClick={() => setPanel(it.id)} aria-label={it.label}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${active ? 'border-accent/60 bg-accent text-slate-950' : 'border-line bg-[rgb(14_17_26/0.72)] text-ink/80 hover:bg-white/10 hover:text-ink'}`}>
                <Icon name={it.icon} />
              </button>
              {!!b && !active && (
                <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-slate-950 ${it.id === 'team' && badges.error ? 'bg-red-400' : it.id === 'comms' ? 'bg-sky-300' : 'bg-emerald-300'}`}>
                  {typeof b === 'number' ? b : ''}
                </span>
              )}
              {hover === it.id && !active && (
                <span className="pointer-events-none absolute left-11 top-1/2 z-40 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950/90 px-2 py-1 text-[11px] font-semibold">
                  {it.label} <span className="ml-1 text-muted">{it.key}</span>
                </span>
              )}
            </div>
          );
        })}
        <CommsToast />
      </div>
      {panel && (
        <div className="scroll-thin pointer-events-auto relative max-h-[calc(100vh-110px)] w-[320px] overflow-y-auto">
          <PanelBody id={panel} close={() => setPanel(null)} />
        </div>
      )}
    </div>
  );
}
