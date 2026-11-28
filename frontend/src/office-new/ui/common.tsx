import type { ReactNode } from 'react';
import type { AgentId, AgentStatus, Speaker } from '../core/types';
import { PROFILES, STATUS_COLOR, STATUS_LABEL } from '../core/agents';

export function StatusPill({ status }: { status: AgentStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${c}22`, color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AgentBadge({ id, size = 28 }: { id: AgentId; size?: number }) {
  const p = PROFILES[id];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: p.color, fontSize: size * 0.42 }}>
      {p.name[0]}
    </span>
  );
}

export function speakerName(s: Speaker) {
  if (s === 'user') return 'You';
  if (s === 'system') return 'System';
  return PROFILES[s].name;
}
export function speakerColor(s: Speaker) {
  if (s === 'user') return '#38bdf8';
  if (s === 'system') return '#8b93a7';
  return PROFILES[s].color;
}

export function Progress({ value, color = '#7c9cff', h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/8" style={{ height: h }}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Section({ title, right, children, className = '', onClose }: { title: string; right?: ReactNode; children: ReactNode; className?: string; onClose?: () => void }) {
  return (
    <section className={`panel p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
        <span className="flex items-center gap-2">
          {right}
          {onClose && <button onClick={onClose} className="-mr-1 rounded-md px-1.5 text-[13px] leading-5 text-muted hover:bg-white/8 hover:text-ink" title="Close (Esc)">✕</button>}
        </span>
      </div>
      {children}
    </section>
  );
}

export function Btn({ children, onClick, variant = 'ghost', disabled, title, className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; title?: string; className?: string;
}) {
  const styles = {
    primary: 'bg-accent text-slate-950 hover:brightness-110',
    ghost: 'bg-white/6 text-ink hover:bg-white/12 border border-line',
    danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30',
  }[variant];
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  );
}

export const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Ikon garis kecil (gaya lucide), 16 px. */
const ICONS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  team: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.6c2.3.1 3.9 1.5 4.5 4.4" /></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  pulse: <path d="M3 12h4l2.5-6 4 12L16 12h5" />,
  pin: <><path d="M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.2" /></>,
  eye: <><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4M6.4 6.5C3.9 8.2 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.4-1.2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6 3 3v3M9 11l3-3 3 3 3 1M12 8l-1 5" /></>,
  hq: <><circle cx="12" cy="9" r="4" /><path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5" /><path d="M12 3V1.8" /></>,
  camera: <><rect x="3" y="6.5" width="13" height="11" rx="2" /><path d="M16 10.5l5-3v9l-5-3z" /></>,
  person: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" /></>,
  keys: <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>,
};
export function Icon({ name, size = 16 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
