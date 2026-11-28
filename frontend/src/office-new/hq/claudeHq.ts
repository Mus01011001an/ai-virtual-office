// Agent HQ untuk sumber Claude Code (referensi v2 5:48–7:51): satu agen Claude, satu meja per skill.
// Skill tidur sampai Claude benar-benar membukanya (tool `Skill`); tool call sesudahnya tercatat di layar skill itu
// dan di live log. Semua dari event hook nyata (PluginAdapter memanggil hqIngest).
import { create } from 'zustand';
import type { HookEvent } from '../core/plugin/PluginAdapter';

export type SkillState = 'asleep' | 'working' | 'ready' | 'waiting';
export interface HqSkill { id: string; description: string; state: SkillState; lines: string[] }
export interface HqCall { n: number; text: string; skill: string | null; ts: number }

interface HqClaudeState {
  skills: HqSkill[];
  active: string | null;
  prompt: string | null;
  startedAt: number | null;
  endedAt: number | null;
  calls: HqCall[];
  tokens: number;
  /** Claude berhenti menunggu persetujuan (Notification / pertanyaan di akhir jawaban). */
  waiting: string | null;
}

export const useHqClaude = create<HqClaudeState>(() => ({
  skills: [], active: null, prompt: null, startedAt: null, endedAt: null, calls: [], tokens: 0, waiting: null,
}));

const base = (p: unknown) => String(p ?? '').split('/').pop() ?? '';
const short = (s: unknown, n: number) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Satu baris log seperti referensi: "Bash · list folder", "Read · file". */
export function callText(tool = '', input: Record<string, unknown> = {}) {
  if (tool === 'Skill') return `open skill · ${input.skill ?? input.command ?? ''}`;
  if (tool === 'Bash') return `Bash · ${short(input.description || input.command, 40)}`;
  if (/^(Read|Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return `${tool} · ${base(input.file_path ?? input.notebook_path) || 'file'}`;
  if (/^(Grep|Glob)$/.test(tool)) return `${tool} · ${short(input.pattern, 30)}`;
  if (/^(Task|Agent)$/.test(tool)) return `${tool} · ${short(input.description ?? input.subagent_type, 36)}`;
  if (/^Web/.test(tool)) return `${tool} · ${short(input.url ?? input.query, 36)}`;
  return short(tool, 44);
}

const ASKS = /\?\s*["')\]]*\s*$|\b(approve|approval|confirm|go ahead|your ok|ok\?|persetujuan|konfirmasi|izin)\b/i;

function patchSkill(id: string, fn: (s: HqSkill) => HqSkill) {
  useHqClaude.setState((st) => {
    const has = st.skills.some((s) => s.id === id);
    const list = has ? st.skills : [...st.skills, { id, description: '', state: 'asleep' as SkillState, lines: [] }];
    return { skills: list.map((s) => (s.id === id ? fn(s) : s)) };
  });
}

export function setHqSkills(list: { id: string; description?: string }[] | undefined) {
  if (!list?.length) return;
  useHqClaude.setState((st) => ({
    skills: list.map((k): HqSkill => {
      const cur = st.skills.find((s) => s.id === k.id);
      return cur ? { ...cur, description: k.description || cur.description } : { id: k.id, description: k.description ?? '', state: 'asleep', lines: [] };
    }),
  }));
}

export function resetHq() {
  useHqClaude.setState({ skills: [], active: null, prompt: null, startedAt: null, endedAt: null, calls: [], tokens: 0, waiting: null });
}

export function hqIngest(ev: HookEvent & { skills?: { id: string; description?: string }[]; tokens?: number; message?: string; last_message?: string }) {
  const st = useHqClaude.getState();
  if (ev.skills) setHqSkills(ev.skills);
  if (typeof ev.tokens === 'number' && ev.tokens > 0) useHqClaude.setState({ tokens: ev.tokens });
  switch (ev.hook) {
    case 'UserPromptSubmit': {
      if (/^\s*<(task-notification|agent-message)\b/.test(ev.prompt ?? '')) return;
      // run baru: semua skill tidur lagi, hitungan dari nol
      useHqClaude.setState((s) => ({
        prompt: short(ev.prompt, 240), startedAt: Date.now(), endedAt: null, calls: [], tokens: 0, waiting: null, active: null,
        skills: s.skills.map((k) => ({ ...k, state: 'asleep', lines: [] })),
      }));
      return;
    }
    case 'PreToolUse': {
      const tool = ev.tool ?? '';
      const input = (ev.input ?? {}) as Record<string, unknown>;
      const text = callText(tool, input);
      if (tool === 'Skill') {
        const id = String(input.skill ?? input.command ?? '').replace(/^\//, '').split(/\s/)[0] || 'skill';
        if (st.active && st.active !== id) patchSkill(st.active, (s) => ({ ...s, state: 'ready' }));
        patchSkill(id, (s) => ({ ...s, state: 'working', lines: [...s.lines, `${text} ✓`].slice(-3) }));
        useHqClaude.setState({ active: id });
      } else if (st.active) {
        patchSkill(st.active, (s) => ({ ...s, state: 'working', lines: [...s.lines, text].slice(-3) }));
      }
      useHqClaude.setState((s) => ({
        waiting: null,
        startedAt: s.startedAt ?? Date.now(),
        calls: [...s.calls, { n: s.calls.length + 1, text, skill: useHqClaude.getState().active, ts: Date.now() }].slice(-200),
      }));
      return;
    }
    case 'Notification': {
      const who = st.active;
      if (who) patchSkill(who, (s) => ({ ...s, state: 'waiting' }));
      useHqClaude.setState({ waiting: short(ev.message, 120) || 'Claude is waiting for you' });
      return;
    }
    case 'Stop': {
      const asks = ASKS.test(ev.last_message ?? '');
      if (st.active) patchSkill(st.active, (s) => ({ ...s, state: asks ? 'waiting' : 'ready' }));
      useHqClaude.setState({ endedAt: Date.now(), waiting: asks ? short(ev.last_message, 120) : null });
      return;
    }
  }
}
