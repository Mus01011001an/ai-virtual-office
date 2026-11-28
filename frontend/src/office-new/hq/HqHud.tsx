// HUD Agent HQ (referensi v2 5:48–7:51): judul + pill sumber, orb "CLAUDE · 1 agent · N skills", tile
// TIME / TOOL CALLS / SKILLS OPEN / TOKENS, prompt yang sedang dikerjakan, live log tool call, dan WAITING FOR YOUR OK.
import { useEffect, useMemo, useState } from 'react';
import { useOffice, selectProject } from '../store/useOffice';
import { useDesks } from './HqScene';
import { useHqClaude } from './claudeHq';
import { one } from '../core/avo/api';

const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const kfmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Tile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-[78px] rounded-lg border border-white/10 bg-black/55 px-3 py-1.5 text-right font-mono">
      <div className={`text-[19px] font-bold leading-tight ${accent ? 'text-[#f5c518]' : 'text-white'}`}>{value}</div>
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-white/45">{label}</div>
    </div>
  );
}

interface LogRow { id: string; n: number; text: string; who?: string; color?: string }

export function HqHud() {
  const s = useOffice();
  const project = useOffice(selectProject);
  const hq = useHqClaude();
  const desks = useDesks();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const claude = s.source === 'claude-code';

  // Angka & log: run Claude Code (hook) atau project AI team/demo.
  const since = project?.createdAt ?? 0;
  const agentCalls = useMemo(() => s.logs.filter((l) => l.kind === 'action' && l.ts >= since), [s.logs, since]);
  const rows: LogRow[] = claude
    ? hq.calls.slice(-6).map((c) => ({ id: `${c.n}`, n: c.n, text: c.text }))
    : agentCalls.slice(-6).map((l, i, arr) => ({ id: l.id, n: agentCalls.length - arr.length + i + 1, text: l.text, who: s.agents[l.agentId]?.name, color: s.agents[l.agentId]?.color }));
  const total = claude ? hq.calls.length : agentCalls.length;
  const elapsed = claude
    ? (hq.startedAt ? (hq.endedAt ?? now) - hq.startedAt : 0)
    : (project ? (project.completedAt ?? now) - project.createdAt : 0);
  const open = desks.filter((d) => d.state !== 'asleep').length;
  const skillsMode = claude && hq.skills.length > 0;

  const decide = async (id: string, ok: boolean) => {
    try { await one('POST', `/office/approvals/${id}/${ok ? 'approve' : 'reject'}`, {}); } catch { /* status kembali lewat SSE */ }
  };
  const live = s.source === 'demo' ? 'DEMO · SIMULATED' : `LIVE · ${claude ? 'CLAUDE CODE' : 'AI TEAM'}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-white">
      <div className="absolute left-4 top-16 flex items-center gap-3">
        <span className="font-sans text-[22px] font-extrabold tracking-wide">AGENT HQ</span>
        <span className="flex items-center gap-1.5 rounded-full border border-[#ef5a4f]/60 bg-black/50 px-3 py-1 text-[12px] font-bold tracking-wider">
          <span className={`h-2 w-2 rounded-full ${s.source === 'demo' ? 'bg-demo' : 'bg-[#ef5a4f]'}`} />{live}
        </span>
      </div>

      {claude && hq.prompt && (
        <div className="absolute bottom-4 left-4 w-[420px] rounded-xl border border-white/10 bg-black/75 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-wider text-white/55">
            <span className="h-2 w-2 rounded-full bg-[#ff5f57]" /><span className="h-2 w-2 rounded-full bg-[#febc2e]" /><span className="h-2 w-2 rounded-full bg-[#28c840]" />
            <span className="ml-1">CLAUDE CODE · THE TASK</span>
          </div>
          <div className="line-clamp-3 text-[13px] font-bold leading-snug">&gt; {hq.prompt}</div>
        </div>
      )}

      <div className="absolute left-1/2 top-[64px] -translate-x-1/2 text-center text-[11px] leading-tight">
        <div className="font-bold tracking-widest text-[#e8896a]">{claude ? 'CLAUDE' : (s.agents.manager?.name ?? 'TEAM').toUpperCase()}</div>
        <div className="text-white/45">
          {claude ? `1 agent · ${hq.skills.length} skill${hq.skills.length === 1 ? '' : 's'}` : `${desks.length} agent${desks.length === 1 ? '' : 's'} · ${open} awake`}
        </div>
      </div>

      <div className="absolute right-4 top-16 flex gap-2">
        <Tile value={mmss(elapsed)} label="Time" />
        <Tile value={String(total)} label="Tool calls" accent />
        <Tile value={`${open}/${desks.length}`} label={skillsMode ? 'Skills open' : 'Agents awake'} accent />
        {claude && <Tile value={kfmt(hq.tokens)} label="Tokens" />}
      </div>

      <div className="absolute bottom-4 right-4 w-[440px] rounded-xl border border-white/10 bg-black/75 p-3">
        <div className="mb-2 flex items-center justify-between text-[13px] font-bold tracking-wider">
          <span className="text-[#ef8a5a]">TOOL CALLS · LIVE LOG</span><span className="text-[#f5c518]">{total}</span>
        </div>
        <div className="space-y-0.5 text-[14px]">
          {rows.map((r, i) => (
            <div key={r.id} className={`truncate rounded px-2 py-0.5 ${i === rows.length - 1 ? 'bg-[#f5c518]/20 text-white' : 'text-white/80'}`}>
              <span className="text-white/40">{String(r.n).padStart(2, '0')}</span>{' '}
              {r.who && <><span style={{ color: r.color }}>{r.who}</span> · </>}{r.text}
            </div>
          ))}
          {!rows.length && <div className="px-2 text-white/40">No tool calls yet. Every line here will be a real one.</div>}
        </div>
      </div>

      {claude && hq.waiting && (
        <div className={`absolute left-4 w-[420px] rounded-xl border-2 border-[#ef5a4f] bg-black/80 p-3 font-sans ${hq.prompt ? 'bottom-[118px]' : 'bottom-4'}`}>
          <div className="mb-1 text-[15px] font-extrabold tracking-wide text-[#ef5a4f]">WAITING FOR YOUR OK</div>
          <div className="text-[12.5px] text-white/80">{hq.waiting}</div>
          <div className="mt-1 text-[11px] text-white/45">Answer Claude in your terminal.</div>
        </div>
      )}
      {!claude && s.approvals.length > 0 && (
        <div className="pointer-events-auto absolute bottom-4 left-4 w-[360px] rounded-xl border-2 border-[#ef5a4f] bg-black/80 p-3 font-sans">
          <div className="mb-2 text-[15px] font-extrabold tracking-wide text-[#ef5a4f]">WAITING FOR YOUR OK</div>
          {s.approvals.map((a) => (
            <div key={a.id} className="mb-2 flex items-center justify-between gap-2 text-[13px]">
              <span className="truncate">{a.title ?? a.toolName}</span>
              <span className="flex gap-1">
                <button onClick={() => void decide(a.id, true)} className="rounded-md bg-emerald-500 px-2.5 py-1 text-[12px] font-bold text-slate-950">OK</button>
                <button onClick={() => void decide(a.id, false)} className="rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-bold">Reject</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
