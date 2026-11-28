import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
/** Perintah dari office (tugas baru / chat ke karyawan) untuk Claude Code di komputer pemilik runner. */
export interface ClaudeCommand {
  id: string;
  ts: number;
  kind: 'task' | 'chat';
  text: string;
  /** kursi/sub-agent tujuan (mis. "backend") dan namanya di office (mis. "Emma") */
  to?: string;
  toName?: string;
  from: { id: string; name?: string };
  status: 'queued' | 'running' | 'done' | 'error';
  reply?: string;
  doneAt?: number;
}

/** Runner = `node .claude/avo-office-hook.mjs listen` yang menyala di komputer seseorang (long-poll ke sini). */
interface Runner { userId: string; host?: string; allowTeam: boolean; lastSeen: number; busy: boolean; online: boolean }

export interface Sender { id: string; name?: string | null; email?: string | null; isSuperAdmin?: boolean }

const RUNNER_TTL = 45_000;
const MAX_QUEUE = 20;
const MAX_TEXT = 4000;

@Injectable()
export class ClaudeCodeService implements OnModuleDestroy {
  private readonly buffers = new Map<string, ClaudeHookEvent[]>();
  private readonly commands = new Map<string, ClaudeCommand[]>();
  private readonly runners = new Map<string, Runner>();
  /** long-poll runner yang sedang menunggu perintah (satu per office) */
  private readonly waiters = new Map<string, (c: ClaudeCommand | null) => void>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly events: OfficeEventsService) {
    // runner tidak ping lagi → offline; perintah yang macet → gagal
    this.sweeper = setInterval(() => this.sweep(), 10_000);
    this.sweeper.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }

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

  // ---------------------------------------------------------------- perintah dari office
  private queue(companyId: string) {
    let q = this.commands.get(companyId);
    if (!q) this.commands.set(companyId, (q = []));
    return q;
  }

  private publicCommand(c: ClaudeCommand) {
    return { id: c.id, ts: c.ts, kind: c.kind, text: c.text, to: c.to, toName: c.toName, from: c.from, status: c.status, reply: c.reply, doneAt: c.doneAt };
  }

  runnerStatus(companyId: string, userId: string): RunnerStatus {
    const queued = (this.commands.get(companyId) ?? []).filter((c) => c.status === 'queued').length;
    return runnerStatusOf(this.runners.get(companyId), userId, queued);
  }

  private emitRunner(companyId: string) {
    const r = this.runners.get(companyId);
    const queued = (this.commands.get(companyId) ?? []).filter((c) => c.status === 'queued').length;
    // `mine` dihitung di browser (ownerId), karena satu event dikirim ke semua anggota office
    this.events.emit(companyId, 'claude.runner', { ...runnerStatusOf(r, '', queued), ownerId: r?.userId ?? null });
  }

  /** Office → antrean. Hanya pemilik runner (atau semua anggota bila runner dinyalakan dengan --team). */
  enqueue(companyId: string, sender: Sender, body: { kind?: string; text?: string; to?: string; toName?: string }): ReturnType<ClaudeCodeService['publicCommand']> {
    const r = this.runners.get(companyId);
    const st = runnerStatusOf(r, sender.id, 0);
    if (!st.online) throw new ServiceUnavailableException('Claude Code runner is offline');
    if (!st.mine && !st.allowTeam) throw new ForbiddenException('Only the owner of this Claude Code runner can send it tasks');
    const text = String(body.text ?? '').trim().slice(0, MAX_TEXT);
    if (!text) throw new BadRequestException('Empty message');
    const q = this.queue(companyId);
    if (q.filter((c) => c.status === 'queued').length >= MAX_QUEUE) throw new ServiceUnavailableException('Too many queued tasks');
    const cmd: ClaudeCommand = {
      id: randomUUID(), ts: Date.now(), kind: body.kind === 'chat' ? 'chat' : 'task', text,
      to: trim(body.to, 40), toName: trim(body.toName, 40),
      from: { id: sender.id, name: trim(sender.name || sender.email || 'Office', 60) },
      status: 'queued',
    };
    q.push(cmd);
    if (q.length > 100) q.splice(0, q.length - 100);
    this.events.emit(companyId, 'claude.command', this.publicCommand(cmd));
    this.dispatch(companyId);
    return this.publicCommand(cmd);
  }

  /** Beri perintah antrean tertua ke runner yang sedang menunggu. */
  private dispatch(companyId: string) {
    const wake = this.waiters.get(companyId);
    if (!wake) return;
    const cmd = (this.commands.get(companyId) ?? []).find((c) => c.status === 'queued');
    if (!cmd) return;
    this.waiters.delete(companyId);
    this.claim(companyId, cmd);
    wake(cmd);
  }

  private claim(companyId: string, cmd: ClaudeCommand) {
    cmd.status = 'running';
    const r = this.runners.get(companyId);
    if (r) r.busy = true;
    this.events.emit(companyId, 'claude.command', this.publicCommand(cmd));
    this.emitRunner(companyId);
  }

  /** Runner menyatakan diri hidup (setiap poll / ping). */
  heartbeat(companyId: string, userId: string, info: { host?: string; team?: boolean; busy?: boolean }) {
    const prev = this.runners.get(companyId);
    const wasOnline = !!prev && Date.now() - prev.lastSeen < RUNNER_TTL && prev.online;
    const r: Runner = {
      userId, host: trim(info.host, 60) ?? prev?.host, allowTeam: !!info.team, lastSeen: Date.now(),
      busy: info.busy ?? (prev?.userId === userId ? prev.busy : false), online: true,
    };
    this.runners.set(companyId, r);
    if (!wasOnline || prev?.userId !== userId || prev?.allowTeam !== r.allowTeam || prev?.busy !== r.busy) this.emitRunner(companyId);
  }

  /** Long-poll runner: perintah berikutnya, atau null setelah `waitMs`. */
  next(companyId: string, userId: string, info: { host?: string; team?: boolean }, waitMs = 25_000): Promise<ReturnType<ClaudeCodeService['publicCommand']> | null> {
    this.heartbeat(companyId, userId, { ...info, busy: false });
    const ready = (this.commands.get(companyId) ?? []).find((c) => c.status === 'queued');
    if (ready) { this.claim(companyId, ready); return Promise.resolve(this.publicCommand(ready)); }
    this.waiters.get(companyId)?.(null); // satu penunggu per office
    return new Promise((resolve) => {
      const timer = setTimeout(() => { if (this.waiters.get(companyId) === done) this.waiters.delete(companyId); resolve(null); }, Math.min(Math.max(waitMs, 1000), 30_000));
      const done = (c: ClaudeCommand | null) => { clearTimeout(timer); resolve(c ? this.publicCommand(c) : null); };
      this.waiters.set(companyId, done);
    });
  }

  /** Runner mengirim hasil `claude -p` (balasan terakhir Claude). */
  complete(companyId: string, userId: string, id: string, body: { status?: string; reply?: string }) {
    const r = this.runners.get(companyId);
    if (!r || r.userId !== userId) throw new ForbiddenException('Not the runner of this office');
    const cmd = (this.commands.get(companyId) ?? []).find((c) => c.id === id);
    if (!cmd) throw new NotFoundException('Unknown command');
    cmd.status = body.status === 'error' ? 'error' : 'done';
    cmd.reply = String(body.reply ?? '').trim().slice(0, 6000) || undefined;
    cmd.doneAt = Date.now();
    r.busy = false;
    r.lastSeen = Date.now();
    this.events.emit(companyId, 'claude.reply', this.publicCommand(cmd));
    this.emitRunner(companyId);
    return { ok: true };
  }

  /** Runner berhenti (Ctrl+C): langsung offline, perintah yang belum jalan tetap di antrean. */
  bye(companyId: string, userId: string) {
    const r = this.runners.get(companyId);
    if (!r || r.userId !== userId) return { ok: true };
    r.lastSeen = 0;
    r.online = false;
    r.busy = false;
    this.waiters.get(companyId)?.(null);
    this.waiters.delete(companyId);
    this.emitRunner(companyId);
    return { ok: true };
  }

  recentCommands(companyId: string) {
    return (this.commands.get(companyId) ?? []).slice(-30).map((c) => this.publicCommand(c));
  }

  private sweep() {
    const now = Date.now();
    for (const [companyId, r] of this.runners) {
      if (r.online && now - r.lastSeen > RUNNER_TTL) { r.online = false; r.busy = false; this.emitRunner(companyId); }
    }
    for (const [companyId, q] of this.commands) {
      for (const c of q) {
        // runner mati di tengah tugas (lebih dari 40 menit tanpa hasil)
        if (c.status === 'running' && now - c.ts > 40 * 60_000) {
          c.status = 'error'; c.reply = 'The Claude Code runner stopped before finishing.'; c.doneAt = now;
          this.events.emit(companyId, 'claude.reply', this.publicCommand(c));
        }
      }
    }
  }

  /** Skill terakhir yang dikirim hook (untuk Agent HQ saat office dibuka). */
  skills(companyId: string) {
    const buf = this.buffers.get(companyId) ?? [];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].skills) return buf[i].skills!;
    return [];
  }
}

// ---------------------------------------------------------------- office → Claude Code (dua arah)
// Office mengirim perintah ke antrean; runner di komputer pemilik mengambilnya (long-poll), menjalankan
// `claude -p`, lalu mengirim balasan. Hook Claude Code tetap menyiarkan aktivitasnya seperti biasa.
export interface RunnerStatus { online: boolean; busy: boolean; host?: string; mine: boolean; allowTeam: boolean; queued: number }

export function runnerStatusOf(r: Runner | undefined, userId: string, queued: number): RunnerStatus {
  const online = !!r && Date.now() - r.lastSeen < RUNNER_TTL;
  return { online, busy: online && !!r?.busy, host: r?.host, mine: !!r && r.userId === userId, allowTeam: !!r?.allowTeam, queued };
}
