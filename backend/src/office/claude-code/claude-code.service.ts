import { Injectable } from '@nestjs/common';
import { OfficeEventsService } from '../realtime/office-events.service';

/** Event hook Claude Code yang sudah dirampingkan (bentuk sama dengan plugin Agent-Office, MIT). */
export interface ClaudeHookEvent {
  hook: string;
  ts: number;
  tool?: string;
  input?: Record<string, string>;
  tool_use_id?: string;
  prompt?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  error?: string;
  async?: boolean;
  severity?: string;
  team?: { id: string; name?: string }[];
  /** Skill project/user (.claude/skills) — Agent HQ menampilkan satu meja per skill. */
  skills?: { id: string; description?: string }[];
  /** Total token run ini (dihitung hook dari transcript, sejak prompt terakhir). */
  tokens?: number;
  /** Notification: "Claude needs your permission…" / Stop: kalimat terakhir Claude. */
  message?: string;
  last_message?: string;
}

const MAX_PER_OFFICE = 400;
const KEEP_INPUT = ['file_path', 'command', 'pattern', 'url', 'query', 'description', 'subagent_type', 'path', 'prompt', 'skill', 'args', 'notebook_path'];
const trim = (v: unknown, n: number) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/**
 * Office Baru (docs/ai-office-architecture.md §4): menerima event hook Claude Code dan menyiarkannya ke SSE office
 * sebagai `claude.event`. Disimpan di memori (ring buffer per office) — tidak memakai token model, tanpa tabel baru.
 */
@Injectable()
export class ClaudeCodeService {
  private readonly buffers = new Map<string, ClaudeHookEvent[]>();

  constructor(private readonly events: OfficeEventsService) {}

  /** Terima JSON mentah stdin hook (hook_event_name, tool_name, …) atau event yang sudah ramping. */
  normalize(raw: Record<string, any>): ClaudeHookEvent | null {
    const hook = trim(raw.hook_event_name ?? raw.hook, 40);
    if (!hook) return null;
    const src = raw.tool_input ?? raw.input;
    let input: Record<string, string> | undefined;
    if (src && typeof src === 'object') {
      input = {};
      for (const k of KEEP_INPUT) if (src[k] !== undefined) input[k] = trim(src[k], k === 'prompt' ? 160 : 200)!;
    }
    const resp = raw.tool_response;
    const failed = hook === 'PostToolUseFailure';
    const ev: ClaudeHookEvent = {
      hook,
      ts: Date.now(),
      tool: trim(raw.tool_name ?? raw.tool, 60),
      input,
      tool_use_id: trim(raw.tool_use_id, 80),
      prompt: trim(raw.prompt, 200),
      session_id: trim(raw.session_id, 80),
      agent_id: trim(raw.agent_id, 80),
      agent_type: trim(raw.agent_type, 60),
      error: trim(raw.error, 300),
      async: hook === 'PostToolUse' && resp && typeof resp === 'object' && (resp.isAsync === true || resp.status === 'async_launched') ? true : undefined,
      severity: failed ? (raw.tool_name === 'Bash' && /^Exit code [1-9]/.test(String(raw.error ?? '')) ? 'major' : 'moderate') : undefined,
      team: Array.isArray(raw.team) ? raw.team.slice(0, 12).map((t: any) => ({ id: trim(t?.id, 40) ?? 'agent', name: trim(t?.name, 40) })) : undefined,
      skills: Array.isArray(raw.skills) ? raw.skills.slice(0, 12).map((k: any) => ({ id: trim(k?.id, 40) ?? 'skill', description: trim(k?.description, 80) })) : undefined,
      tokens: Number.isFinite(Number(raw.tokens)) && raw.tokens !== null && raw.tokens !== undefined ? Math.max(0, Math.round(Number(raw.tokens))) : undefined,
      message: trim(raw.message, 200),
      last_message: trim(raw.last_message, 240),
    };
    return ev;
  }

  ingest(companyId: string, body: unknown): number {
    const list = Array.isArray(body) ? body : [body];
    let n = 0;
    for (const raw of list.slice(0, 50)) {
      if (!raw || typeof raw !== 'object') continue;
      const ev = this.normalize(raw as Record<string, any>);
      if (!ev) continue;
      const buf = this.buffers.get(companyId) ?? [];
      buf.push(ev);
      if (buf.length > MAX_PER_OFFICE) buf.splice(0, buf.length - MAX_PER_OFFICE);
      this.buffers.set(companyId, buf);
      this.events.emit(companyId, 'claude.event', ev);
      n++;
    }
    return n;
  }

  recent(companyId: string, since?: number) {
    const buf = this.buffers.get(companyId) ?? [];
    return since ? buf.filter((e) => e.ts > since) : buf;
  }

  /** Tim terakhir yang dikirim hook (SessionStart membawa daftar .claude/agents). */
  team(companyId: string) {
    const buf = this.buffers.get(companyId) ?? [];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].team) return buf[i].team!;
    return [];
  }

  /** Skill terakhir yang dikirim hook (untuk Agent HQ saat office dibuka). */
  skills(companyId: string) {
    const buf = this.buffers.get(companyId) ?? [];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].skills) return buf[i].skills!;
    return [];
  }
}
