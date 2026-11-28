// Live data source for the premium office inside the Agent Office plugin.
// It reads the plugin server's event stream (GET /events, same origin) — the same Claude Code hook
// events the free office shows — or a recorded session (?replay=file.json).
// The main session is the Manager; each sub-agent's tool calls show on its own seat (see team.ts).
import type { AdapterContext, AgentDataAdapter } from '../adapter';
import type { AgentId, Lang, Project, Task } from '../types';
import { uid } from '../types';
import { PROFILES } from '../agents';
import { applyTeam, isVacant, roleOf, seatFor, type TeamRole } from './team';
import { hqIngest, resetHq } from '../../hq/claudeHq';

/**
 * Sumber event hook selain server plugin (Office Baru: backend AVO, SSE `claude.event`).
 * open() mengembalikan fungsi penutup.
 */
export interface HookTransport {
  label: string;
  team(): Promise<TeamRole[]>;
  open(onEvents: (evs: HookEvent[]) => void, onStatus: (s: 'connecting' | 'open' | 'error') => void, onControl?: (kind: 'command' | 'reply' | 'runner', data: unknown) => void): () => void;
  /** Dua arah (opsional): status runner di komputer pemilik, dan kirim tugas/chat ke Claude Code lewat runner. */
  runner?(): Promise<RunnerStatus>;
  send?(cmd: { kind: 'task' | 'chat'; text: string; to?: string; toName?: string }): Promise<ClaudeCommand>;
}

/** `node .claude/avo-office-hook.mjs listen` di komputer seseorang (docs/ai-office-claude-code.md §Dua arah). */
export interface RunnerStatus { online: boolean; busy: boolean; host?: string; mine: boolean; allowTeam: boolean; queued: number }
export interface ClaudeCommand { id: string; ts: number; kind: 'task' | 'chat'; text: string; to?: string; toName?: string; from?: { id: string; name?: string }; status: 'queued' | 'running' | 'done' | 'error'; reply?: string }

const RUNNER_HINT = 'node .claude/avo-office-hook.mjs listen';
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Prompt dari runner office ("[Agent Office] Tugas dari X:\n<teks>\n…") → teks permintaannya saja. */
const officePrompt = (p?: string) => {
  const t = String(p ?? '');
  if (!t.startsWith('[Agent Office]')) return t;
  const [head, ...rest] = t.split('\n');
  const body = rest.find((l) => l.trim()) ?? '';
  return /^\[Agent Office\] Pesan/.test(head) ? `${head.replace(/^\[Agent Office\] Pesan dari (.+?) untuk (.+?)(?: \(.*\))?:$/, '$1 → $2')}: ${body}` : body || head.replace('[Agent Office] ', '');
};

export interface HookEvent {
  hook: string;
  tool?: string;
  input?: Record<string, unknown>;
  prompt?: string;
  agent_type?: string;
  tool_use_id?: string;
  error?: string;
  team?: TeamRole[];
  skills?: { id: string; description?: string }[];
  tokens?: number;
  message?: string;
  last_message?: string;
  project?: string;
  text?: string;
  severity?: string;
  level?: string;
  name?: string;
  state?: string;
  agent?: string;
  ts?: number;
  async?: boolean;
}

const SPAWN = new Set(['Task', 'Agent']);
const short = (s: unknown, n: number) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const base = (p: unknown) => String(p ?? '').split('/').pop();
function describe(tool = '', input: Record<string, unknown> = {}) {
  if (input.file_path) return `${tool} ${base(input.file_path)}`;
  if (input.command) return `${tool} ${short(input.command, 60)}`;
  if (input.pattern) return `${tool} "${short(input.pattern, 30)}"`;
  if (input.url) return `${tool} ${short(input.url, 40)}`;
  return tool || 'action';
}

export const replayUrl = () => { try { return new URLSearchParams(location.search).get('replay'); } catch { return null; } };

// In render mode (?render=…, frames stepped by hand) a recording plays on the render clock instead of
// real timers, so every video frame shows exactly the events that happened by then.
const RENDER_MODE = (() => { try { return new URLSearchParams(location.search).has('render'); } catch { return false; } })();
const queue: { at: number; fire: () => void }[] = [];
const later: { at: number; fire: () => void }[] = [];
let renderMs = 0, recordedAt = 0;
/** The adapter's clock: real time, or in render mode the recording's own time (so a slow render changes nothing). */
const now = () => (RENDER_MODE ? recordedAt + renderMs : Date.now());
/** A timer on the adapter's clock. */
function after(ms: number, fn: () => void) {
  if (!RENDER_MODE) { setTimeout(fn, ms); return; }
  later.push({ at: renderMs + ms, fire: fn });
  later.sort((a, b) => a.at - b.at);
}
/** Called by RenderController with the render time in seconds. */
export function replayAdvance(t: number) {
  renderMs = t * 1000;
  for (;;) {
    const q = queue[0], l = later[0];
    const next = q && q.at <= renderMs && (!l || l.at > renderMs || q.at <= l.at) ? queue : l && l.at <= renderMs ? later : null;
    if (!next) break;
    next.shift()!.fire();
  }
}

export class PluginAdapter implements AgentDataAdapter {
  readonly kind = 'claude-code' as const;
  readonly label: string;
  readonly isSimulated = false;
  /** submit/assign/chat menyala selama runner pemilik office online (dua arah); selain itu hanya menonton. */
  readonly can = { submit: false, assign: false, pause: false, chat: false, speed: false };
  onRunner?: (r: RunnerStatus | null) => void;
  private runnerTimer: ReturnType<typeof setInterval> | null = null;
  /** chat yang menunggu jawaban Claude: id perintah → kursi (resolve hilang = jawaban datang terlambat) */
  private waiting = new Map<string, { seat: AgentId; resolve?: (text: string) => void }>();
  private reported = new Set<string>();

  private ctx!: AdapterContext;
  private es: EventSource | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private project: Project | null = null;
  private open = new Map<AgentId, Task & { toolUseId?: string; startedReal: number }>();
  private calm = new Map<AgentId, object>();
  onStatus?: (s: 'connecting' | 'open' | 'error') => void;
  onTeam?: () => void;
  private closeTransport: (() => void) | null = null;

  constructor(private readonly transport?: HookTransport) {
    this.label = transport?.label ?? 'Claude Code (Agent Office plugin)';
  }

  connect(ctx: AdapterContext) {
    this.ctx = ctx;
    ctx.emit({ type: 'reset' });
    resetHq();
    this.onStatus?.('connecting');
    const replay = replayUrl();
    if (replay) { this.replay(replay); return; }
    if (this.transport) {
      this.transport.team().then((t) => { if (t.length) this.team(t); }).catch(() => {});
      this.closeTransport = this.transport.open((evs) => evs.forEach((ev) => this.handle(ev)), (st) => this.onStatus?.(st), (kind, data) => this.control(kind, data));
      if (this.transport.runner) {
        this.refreshRunner();
        this.runnerTimer = setInterval(() => this.refreshRunner(), 30_000);
      }
      return;
    }
    fetch('/team').then((r) => r.json()).then((j) => { if (Array.isArray(j.team)) this.team(j.team); }).catch(() => {});
    this.es = new EventSource('/events');
    this.es.onopen = () => this.onStatus?.('open');
    this.es.onerror = () => this.onStatus?.('error');
    this.es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        for (const ev of Array.isArray(data) ? data : [data]) this.handle(ev);
      } catch { /* ignore malformed */ }
    };
  }

  private async replay(file: string) {
    try {
      const rec = await fetch(file).then((r) => r.json());
      recordedAt = Date.parse(rec.recordedAt) || Date.now();
      this.onStatus?.('open');
      // real gaps can be milliseconds; stretch them so people have time to walk
      let at = 0, prev = 0;
      for (const { t, ev } of rec.events as { t: number; ev: HookEvent }[]) {
        const gap = Math.min(Math.max(t - prev, ev.hook === 'PreToolUse' ? 900 : 300), 6000);
        prev = t; at += gap;
        if (RENDER_MODE) queue.push({ at, fire: () => this.handle(ev) });
        else this.timers.push(setTimeout(() => this.handle(ev), at));
      }
    } catch { this.onStatus?.('error'); }
  }

  disconnect() {
    if (this.runnerTimer) clearInterval(this.runnerTimer);
    this.runnerTimer = null;
    for (const w of this.waiting.values()) w.resolve?.('');
    this.waiting.clear();
    this.closeTransport?.();
    this.closeTransport = null;
    this.es?.close();
    this.es = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // ---------------------------------------------------------------- office → Claude Code (dua arah)
  private refreshRunner() {
    this.transport?.runner?.().then((r) => this.applyRunner(r)).catch(() => this.applyRunner(null));
  }

  private applyRunner(r: RunnerStatus | null) {
    const ok = !!r?.online && (r.mine || r.allowTeam);
    this.can.submit = this.can.assign = this.can.chat = ok;
    this.onRunner?.(r);
  }

  private control(kind: 'command' | 'reply' | 'runner', data: unknown) {
    if (kind === 'runner') { this.refreshRunner(); return; }
    const c = data as ClaudeCommand;
    if (!c?.id) return;
    if (kind === 'command') {
      if (c.kind === 'task' && c.status === 'queued') this.log('manager', 'task', `Task for Claude Code${c.from?.name ? ` from ${c.from.name}` : ''}: ${short(c.text, 80)}`);
      return;
    }
    // reply
    const text = short(c.reply || (c.status === 'error' ? 'Claude Code could not finish this.' : 'Done.'), 1500);
    const w = this.waiting.get(c.id);
    if (w) {
      this.waiting.delete(c.id);
      if (w.resolve) w.resolve(text);
      else this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: now(), from: w.seat, to: 'user', text, channel: 'direct' } });
      return;
    }
    if (c.kind === 'task' && !this.reported.has(c.id)) {
      this.reported.add(c.id);
      this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: now(), from: 'manager', to: 'user', text, channel: 'team' } });
      this.log('manager', c.status === 'error' ? 'error' : 'result', `${c.status === 'error' ? 'Failed' : 'Done'}: ${short(c.text, 60)}`);
    }
  }

  private send(cmd: { kind: 'task' | 'chat'; text: string; to?: string; toName?: string }) {
    if (!this.transport?.send) return Promise.reject(new Error('This office is read-only'));
    return this.transport.send(cmd);
  }

  submitProject(title: string) {
    if (!this.can.submit) return;
    this.send({ kind: 'task', text: title }).catch((e) => this.log('manager', 'error', `Couldn't send to Claude Code: ${errText(e)}`));
  }

  assignTask(agent: AgentId, title: string) {
    if (!this.can.assign) return;
    const role = agent === 'manager' ? null : roleOf(agent);
    this.send({ kind: 'task', text: title, to: role ?? undefined, toName: this.ctx.getState().agents[agent].name })
      .catch((e) => this.log(agent, 'error', `Couldn't send to Claude Code: ${errText(e)}`));
  }

  pauseAgent() {}
  resumeAgent() {}

  async ask(id: AgentId, text: string, lang: Lang) {
    const a = this.ctx.getState().agents[id];
    // runner online: pesan sungguhan ke Claude Code, dijawab sebagai karyawan ini
    if (this.can.chat && this.transport?.send) {
      try {
        const role = id === 'manager' ? null : roleOf(id);
        const c = await this.send({ kind: 'chat', text, to: role ?? undefined, toName: a.name });
        return await new Promise<string>((resolve) => {
          const entry: { seat: AgentId; resolve?: (t: string) => void } = { seat: id, resolve };
          this.waiting.set(c.id, entry);
          setTimeout(() => {
            if (!entry.resolve) return;
            entry.resolve = undefined; // jawaban yang datang nanti masuk sebagai pesan baru
            resolve(/\b(dan|yang|tolong|apa|saya|kamu|sudah)\b/i.test(text) ? 'Masih saya kerjakan — jawabannya muncul di sini begitu selesai.' : "Still on it — my answer will show up here as soon as I'm done.");
          }, 4 * 60_000);
        });
      } catch (e) {
        return `Couldn't reach Claude Code: ${errText(e)}`;
      }
    }
    const t = a.currentTaskId ? this.ctx.getState().tasks[a.currentTaskId] : null;
    if (/\b(apa|sedang|kamu|sudah|masalah|berikutnya|lagi)\b/i.test(text)) return (t ? `Saya ${a.name}. Sedang mengerjakan "${t.title}".` : `Saya ${a.name}. Sedang kosong.`) + ` Untuk mengobrol sungguhan, nyalakan runner di komputer Anda: ${RUNNER_HINT}`;
    if (lang === 'uz') return t ? `Men ${a.name}. Hozir "${t.title}" ustida ishlayapman. Buyruqlar terminaldagi Claude Code’dan keladi.` : `Men ${a.name}. Hozir bo‘shman: vazifani terminaldagi Claude Code beradi.`;
    return (t ? `I'm ${a.name}. I'm working on "${t.title}" right now.` : `I'm ${a.name}. I'm free right now.`) + ` To really talk to me, start the runner on your computer: ${RUNNER_HINT}`;
  }

  private lastTeam = '';
  private team(team: TeamRole[]) {
    this.lastTeam = JSON.stringify(team.map((t) => t.id));
    const seats = applyTeam(team);
    for (const id of seats) {
      const p = PROFILES[id];
      this.ctx.emit({ type: 'agent.patch', id, patch: { name: p.name, role: p.role, color: p.color, bio: p.bio, vacant: isVacant(id) } });
    }
    this.onTeam?.();
  }

  /** a sub-agent the team file did not list just got a seat: show it */
  private fill(seat: AgentId) {
    const a = this.ctx.getState().agents[seat];
    if (!a.vacant) return;
    const p = PROFILES[seat];
    this.patch(seat, { name: p.name, role: p.role, color: p.color, bio: p.bio, vacant: false });
    this.onTeam?.();
  }

  private log(agentId: AgentId, kind: 'action' | 'task' | 'result' | 'status' | 'error', text: string) {
    this.ctx.emit({ type: 'log', entry: { id: uid('log'), ts: now(), agentId, kind, text } });
  }
  private patch(id: AgentId, patch: Record<string, unknown>) { this.ctx.emit({ type: 'agent.patch', id, patch }); }
  private say(from: AgentId, text: string, to: AgentId | 'all' | 'user' = 'all') {
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: now(), from, to, text, channel: 'team' } });
  }
  private settle(id: AgentId, ms: number, patch: Record<string, unknown>) {
    const token = {};
    this.calm.set(id, token);
    after(ms, () => { if (this.calm.get(id) === token) this.patch(id, patch); });
  }

  private finish(seat: AgentId, ok = true) {
    const t = this.open.get(seat);
    if (!t) return;
    this.open.delete(seat);
    const { toolUseId: _a, startedReal: _b, ...task } = t;
    this.ctx.emit({ type: 'task.upsert', task: { ...task, status: ok ? 'completed' : 'error', progress: 100, completedAt: now() } });
    this.patch(seat, { status: ok ? 'completed' : 'error', currentTaskId: null, place: 'desk' });
    this.log(seat, ok ? 'result' : 'error', `${ok ? 'Done' : 'Failed'}: ${t.title}`);
    this.say(seat, ok ? `Done: ${t.title} ✅` : `I hit a problem on "${t.title}".`, 'manager');
    // after a finished job: a coffee, then back to the desk
    if (ok) this.settle(seat, 2500, { status: 'idle', place: 'coffee' });
    if (this.project && !this.open.size) {
      this.project.progress = 100;
      this.ctx.emit({ type: 'project.upsert', project: { ...this.project } });
    }
  }

  private handle(ev: HookEvent) {
    const { emit } = this.ctx;
    const tool = ev.tool ?? '';
    hqIngest(ev);
    // Hook mengirim .claude/agents saat sesi mulai & tiap prompt: kursi ikut berubah begitu /office-setup selesai.
    if (ev.hook !== 'Snapshot' && ev.hook !== 'Team' && Array.isArray(ev.team) && ev.team.length && JSON.stringify(ev.team.map((t) => t.id)) !== this.lastTeam) this.team(ev.team);
    switch (ev.hook) {
      case 'Snapshot':
      case 'Team':
        if (Array.isArray(ev.team)) this.team(ev.team);
        return;
      case 'SessionStart':
        this.patch('manager', { status: 'idle', place: 'desk' });
        this.log('manager', 'status', 'Session started');
        return;
      case 'SessionEnd':
        this.patch('manager', { status: 'idle' });
        this.log('manager', 'status', 'Session closed');
        return;
      case 'UserPromptSubmit': {
        // a background sub-agent reporting back arrives as a prompt; it is not a new request
        if (/^\s*<(task-notification|agent-message)\b/.test(ev.prompt ?? '')) { this.log('manager', 'status', 'A sub-agent reported back'); return; }
        const title = short(officePrompt(ev.prompt), 90) || 'New request';
        this.project = { id: uid('prj'), title, status: 'running', progress: 0, createdAt: now(), taskIds: [] };
        emit({ type: 'project.upsert', project: { ...this.project } });
        emit({ type: 'message', message: { id: uid('msg'), ts: now(), from: 'user', to: 'manager', text: title, channel: 'team' } });
        this.patch('manager', { status: 'thinking', place: 'desk' });
        this.log('manager', 'task', `Request: ${title}`);
        return;
      }
      case 'PreToolUse': {
        if (SPAWN.has(tool)) {
          const seat = seatFor(String(ev.input?.subagent_type ?? ''));
          this.fill(seat);
          const title = short(ev.input?.description ?? ev.input?.prompt, 70) || 'Sub-agent task';
          const task: Task & { toolUseId?: string; startedReal: number } = {
            id: uid('task'), projectId: this.project?.id ?? null, title, assignee: seat, status: 'running', progress: 10,
            dependsOn: [], effort: 0, createdAt: now(), startedAt: now(), source: 'plan', toolUseId: ev.tool_use_id, startedReal: now(),
          };
          this.open.set(seat, task);
          if (this.project) { this.project.taskIds.push(task.id); this.project.status = 'running'; emit({ type: 'project.upsert', project: { ...this.project } }); }
          const { toolUseId: _a, startedReal: _b, ...plain } = task;
          emit({ type: 'task.upsert', task: plain });
          this.calm.delete(seat);
          this.patch(seat, { status: 'working', currentTaskId: task.id, place: 'desk' });
          this.patch('manager', { status: 'working' });
          this.say('manager', `${PROFILES[seat].name}, ${title}`, seat);
          this.log('manager', 'task', `→ ${PROFILES[seat].name}: ${title}`);
          return;
        }
        const who = seatFor(ev.agent_type);
        this.fill(who);
        const t = this.open.get(who);
        if (t) {
          t.progress = Math.min(92, t.progress + 9);
          const { toolUseId: _a, startedReal: _b, ...plain } = t;
          emit({ type: 'task.upsert', task: plain });
        }
        this.calm.delete(who);
        this.patch(who, { status: 'working', place: 'desk' });
        this.log(who, 'action', describe(tool, ev.input));
        return;
      }
      case 'PostToolUse': {
        if (SPAWN.has(tool)) {
          // a foreground sub-agent returns here; a background one returns at once (async) and ends with SubagentStop
          if (ev.async) return;
          const seat = seatFor(String(ev.input?.subagent_type ?? ''));
          const t = this.open.get(seat);
          if (t && now() - t.startedReal > 2500) this.finish(seat, true);
        }
        return;
      }
      case 'PostToolUseFailure': {
        const who = seatFor(ev.agent_type);
        const err = short(String(ev.error ?? '').split('\n').find((l) => l.trim()) ?? '', 90);
        this.patch(who, { status: 'error' });
        this.log(who, 'error', `${tool} failed${err ? `: ${err}` : ''}`);
        this.settle(who, 4000, { status: 'working' });
        return;
      }
      case 'SubagentStop': {
        const seat = seatFor(ev.agent_type);
        if (this.open.has(seat)) this.finish(seat, true);
        // its task was already closed: just make sure nobody is left "working"
        else if (seat !== 'manager') this.settle(seat, 800, { status: 'idle' });
        return;
      }
      case 'Stop':
        if (!this.open.size) {
          if (this.project) {
            this.project.status = 'completed'; this.project.progress = 100; this.project.completedAt = now();
            emit({ type: 'project.upsert', project: { ...this.project } });
          }
          this.patch('manager', { status: 'completed' });
          this.log('manager', 'result', 'Answer ready');
          this.settle('manager', 3000, { status: 'idle' });
        }
        return;
      case 'Log':
      case 'Service': {
        const who = seatFor(ev.agent);
        const bad = /major|critical|moderate|error/.test(`${ev.severity ?? ''} ${ev.level ?? ''}`) || (ev.state && ev.state !== 'up');
        const text = ev.hook === 'Service' ? `${ev.name}: ${ev.state}` : short(ev.text, 110);
        this.log(who, bad ? 'error' : 'status', text);
        return;
      }
    }
  }
}
