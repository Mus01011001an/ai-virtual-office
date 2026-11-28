// Sumber data utama Office Baru: AI employee nyata dari backend AVO.
// Status/progress/tool berasal dari AgentRuntimeService (SSE employee.updated, task.event, activity.created,
// approval.*). Tidak ada simulasi: agen hanya bergerak kalau backend benar-benar bekerja.
import type { AdapterContext, AgentDataAdapter } from '../adapter';
import type { Agent, AgentId, AgentStatus, Lang, PlaceId, Project, Task, TaskStatus } from '../types';
import { AGENT_IDS, uid } from '../types';
import { PROFILES } from '../agents';
import { SEAT_MODEL } from '../plugin/team';
import { list, one, officeStream } from './api';

export interface AvoEmployee {
  id: string; name: string; role: string; department?: string; skills?: string[];
  status: string; slot?: string | null; currentTask?: string | null; currentTool?: string | null; progress?: number;
  isDemo?: boolean; model?: string; providerId?: string | null;
}
interface AvoTask { id: string; employeeId: string; title: string; description?: string | null; status: string; source?: string | null; createdAt: string; startedAt?: string | null; finishedAt?: string | null }
interface AvoActivity { id: string; employeeId: string; kind: string; text: string; createdAt?: string }
interface AvoApproval { id: string; employeeId: string; taskId?: string; toolName?: string; title?: string; status?: string }

/** Kursi referensi → pola peran yang paling cocok. */
const SEAT_FIT: [AgentId, RegExp][] = [
  ['manager', /chief|manager|lead|kepala|head|direktur|director|coordinator|koordinator|pm\b|owner/i],
  ['research', /research|riset|analy|data|strateg|insight/i],
  ['designer', /design|visual|video|creative|kreatif|ui|ux|front|social/i],
  ['developer', /develop|engineer|code|program|backend|ads|iklan|tech|devops/i],
  ['qa', /qa|test|quality|care|support|copy|writer|review/i],
];
const COLORS: Record<AgentId, string> = { manager: '#f59e0b', research: '#22c55e', developer: '#3b82f6', designer: '#ec4899', qa: '#a855f7' };
const MODELS_F = ['SK_Chr_Boss_Female_01', 'SK_Chr_Developer_Female_01', 'SK_Chr_Business_Female_02', 'SK_Chr_Developer_Female_02', 'SK_Chr_Business_Female_01'];
const MODELS_M = ['SK_Chr_Boss_Male_01', 'SK_Chr_Business_Male_02', 'SK_Chr_Developer_Male_01', 'SK_Chr_Developer_Male_02', 'SK_Chr_Business_Male_01'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const FEMALE = /a$|i$|e$|ia$|ah$|sari|dewi|putri|nur|siti|ayu|rina|olivia|mia|emma|sophia|grace|chloe|lily|zoe|nora/i;

const TASK_STATUS: Record<string, TaskStatus> = { QUEUED: 'queued', EXECUTING: 'running', WAITING: 'paused', COMPLETED: 'completed', FAILED: 'error', CANCELLED: 'error' };

function agentState(e: AvoEmployee): { status: AgentStatus; place: PlaceId } {
  switch (e.status) {
    case 'WORKING': case 'TOOL_EXECUTING': return { status: 'working', place: 'desk' };
    case 'THINKING': return { status: 'thinking', place: 'desk' };
    case 'WAITING': return { status: 'paused', place: 'desk' };
    case 'ON_BREAK': return { status: 'idle', place: 'coffee' };
    case 'IN_MEETING': case 'COLLABORATING': return { status: 'idle', place: 'meeting' };
    default: return { status: 'idle', place: 'desk' };
  }
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const isId = (t: string) => /\b(apa|sedang|kamu|sudah|masalah|kendala|berikutnya|selanjutnya|progres|berapa|tugas)\b/i.test(t);

/** Pilih maksimal 5 AI untuk 5 kursi referensi; sisanya tetap tercatat di log/komunikasi. */
export function seatTeam(emps: AvoEmployee[], pinned?: string[]): Map<AgentId, AvoEmployee> {
  const out = new Map<AgentId, AvoEmployee>();
  const free = emps.filter((e) => e.status !== 'OFFLINE' || true);
  const take = (seat: AgentId, e?: AvoEmployee) => { if (e && !out.has(seat) && ![...out.values()].includes(e)) out.set(seat, e); };
  if (pinned?.length) pinned.forEach((id, i) => take(AGENT_IDS[i], free.find((e) => e.id === id)));
  for (const [seat, re] of SEAT_FIT) take(seat, free.find((e) => ![...out.values()].includes(e) && re.test(`${e.role} ${e.department ?? ''} ${e.name}`)));
  for (const seat of AGENT_IDS) take(seat, free.find((e) => ![...out.values()].includes(e)));
  return out;
}

export class BackendAdapter implements AgentDataAdapter {
  readonly kind = 'claude-code' as const;
  readonly label = 'AI team (backend)';
  readonly isSimulated = false;
  readonly can = { submit: true, assign: true, pause: false, chat: true, speed: false };

  onStatus?: (s: 'connecting' | 'open' | 'error') => void;
  onTeam?: (seated: Map<AgentId, AvoEmployee>, all: AvoEmployee[]) => void;
  /** Persetujuan yang menunggu "OK" pimpinan (dipakai panel & Agent HQ). */
  onApproval?: (a: AvoApproval, open: boolean) => void;

  private ctx!: AdapterContext;
  private close: (() => void) | null = null;
  private emps = new Map<string, AvoEmployee>();
  private seatOf = new Map<string, AgentId>();
  private empOf = new Map<AgentId, AvoEmployee>();
  private project: (Project & { rootTaskId?: string }) | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly pinned?: string[]) {}

  connect(ctx: AdapterContext) {
    this.ctx = ctx;
    ctx.emit({ type: 'reset' });
    this.onStatus?.('connecting');
    void this.load();
    this.close = officeStream({
      'employee.updated': (d) => this.onEmployee(d as Partial<AvoEmployee> & { id: string }),
      'employee.created': () => void this.load(),
      'employee.deleted': () => void this.load(),
      'task.event': (d) => this.onTask(d as { task: AvoTask; to: string; from?: string }),
      'activity.created': (d) => this.onActivity(d as AvoActivity),
      'approval.requested': (d) => this.onApprovalEvent(d as AvoApproval, true),
      'approval.decided': (d) => this.onApprovalEvent(d as AvoApproval, false),
    }, (st) => this.onStatus?.(st));
  }

  disconnect() {
    this.close?.();
    this.close = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** Karyawan + task terbaru → kursi, status, timeline. */
  private async load() {
    try {
      const emps = (await list<AvoEmployee>('/office/employees')).filter((e) => !e.isDemo);
      this.emps = new Map(emps.map((e) => [e.id, e]));
      const seated = seatTeam(emps, this.pinned);
      this.seatOf.clear();
      this.empOf = seated;
      for (const [seat, e] of seated) this.seatOf.set(e.id, seat);
      AGENT_IDS.forEach((seat, i) => {
        const e = seated.get(seat);
        if (!e) { this.patch(seat, { vacant: true }); return; }
        const f = FEMALE.test(e.name.split(' ')[0]);
        const pool = f ? MODELS_F : MODELS_M;
        SEAT_MODEL[seat] = seat === 'manager' ? pool[0] : pool[1 + ((hash(e.name) + i) % (pool.length - 1))];
        Object.assign(PROFILES[seat], { name: e.name.split(' ')[0], role: e.role || 'AI', color: COLORS[seat], bio: `${e.role}${e.department ? ` · ${e.department}` : ''}. ${(e.skills ?? []).slice(0, 4).join(', ')}` });
        const st = agentState(e);
        this.patch(seat, { name: PROFILES[seat].name, role: PROFILES[seat].role, color: COLORS[seat], bio: PROFILES[seat].bio, vacant: false, ...st });
      });
      this.onTeam?.(seated, emps);
      const tasks = await list<AvoTask>('/office/tasks?limit=40');
      for (const t of tasks.reverse()) this.upsertTask(t, false);
    } catch {
      this.onStatus?.('error');
    }
  }

  private patch(id: AgentId, patch: Partial<Agent>) { this.ctx.emit({ type: 'agent.patch', id, patch }); }
  private log(agentId: AgentId, kind: 'action' | 'task' | 'result' | 'status' | 'error', text: string) {
    this.ctx.emit({ type: 'log', entry: { id: uid('log'), ts: Date.now(), agentId, kind, text } });
  }
  private say(from: AgentId | 'user', text: string, to: AgentId | 'all' | 'user' = 'all') {
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from, to, text, channel: 'team' } });
  }
  private nameOf(empId: string) { return this.emps.get(empId)?.name.split(' ')[0] ?? 'AI'; }

  private onEmployee(d: Partial<AvoEmployee> & { id: string }) {
    const prev = this.emps.get(d.id);
    if (!prev) return;
    const e = { ...prev, ...d };
    this.emps.set(e.id, e);
    const seat = this.seatOf.get(e.id);
    if (!seat) return;
    const st = agentState(e);
    this.patch(seat, st);
    if (d.currentTool && d.currentTool !== prev.currentTool) this.log(seat, 'action', `${d.currentTool}`);
    // progress dari runtime ke task yang sedang jalan
    const a = this.ctx.getState().agents[seat];
    const t = a.currentTaskId ? this.ctx.getState().tasks[a.currentTaskId] : null;
    if (t && typeof d.progress === 'number' && d.progress > 0) this.ctx.emit({ type: 'task.upsert', task: { ...t, progress: d.progress } });
  }

  private upsertTask(t: AvoTask, live: boolean) {
    const seat = this.seatOf.get(t.employeeId);
    const status = TASK_STATUS[t.status] ?? 'queued';
    const prev = this.ctx.getState().tasks[t.id];
    const delegated = !!t.source?.startsWith('delegation');
    // Task delegasi masuk ke project yang sedang berjalan (manager memecah pekerjaan).
    const projectId = prev?.projectId ?? (this.project && (delegated || t.id === this.project.rootTaskId) ? this.project.id : null);
    const task: Task = {
      id: t.id, projectId, title: t.title, assignee: seat ?? 'manager', status,
      progress: status === 'completed' ? 100 : status === 'running' ? Math.max(prev?.progress ?? 10, 10) : prev?.progress ?? 0,
      dependsOn: [], effort: 0, createdAt: Date.parse(t.createdAt) || Date.now(),
      startedAt: t.startedAt ? Date.parse(t.startedAt) : prev?.startedAt, completedAt: t.finishedAt ? Date.parse(t.finishedAt) : undefined,
      source: delegated ? 'plan' : 'user',
    };
    this.ctx.emit({ type: 'task.upsert', task });
    if (projectId && this.project && !this.project.taskIds.includes(t.id)) {
      this.project.taskIds.push(t.id);
      this.ctx.emit({ type: 'project.upsert', project: { ...this.project } });
    }
    if (!seat) return;
    if (status === 'running') this.patch(seat, { currentTaskId: t.id });
    if (!live) return;

    const who = this.nameOf(t.employeeId);
    // Laporan ke atasan: manager melapor ke user, rekan melapor ke manager (seperti referensi).
    const boss: AgentId | 'user' = seat === 'manager' || !this.empOf.has('manager') ? 'user' : 'manager';
    // QUEUED datang dua kali (respons POST + SSE): cukup sekali.
    if (status === 'queued' && !prev) {
      if (delegated) {
        this.say(this.empOf.has('manager') ? 'manager' : 'user', `${who}, ${t.title}`, seat);
        this.log('manager', 'task', `→ ${who}: ${t.title}`);
      } else this.log(seat, 'task', `Task: ${t.title}`);
    }
    if (status === 'completed' && prev?.status !== 'completed') {
      this.patch(seat, { currentTaskId: null, status: 'completed' });
      this.say(seat, `Done: ${t.title} ✅`, boss);
      this.log(seat, 'result', `Done: ${t.title}`);
      this.later(2500, () => this.patch(seat, { status: 'idle' }));
    }
    if (status === 'error' && prev?.status !== 'error') {
      this.patch(seat, { currentTaskId: null, status: 'error' });
      this.say(seat, `I hit a problem on "${t.title}".`, boss);
      this.later(6000, () => this.patch(seat, { status: 'idle' }));
    }
    this.refreshProject();
  }

  private onTask(d: { task: AvoTask; to: string }) {
    if (!d?.task) return;
    this.upsertTask({ ...d.task, status: d.to ?? d.task.status }, true);
  }

  private onActivity(a: AvoActivity) {
    const seat = this.seatOf.get(a.employeeId);
    if (!seat) return;
    const text = short(a.text.replace(/\s+/g, ' '), 140);
    const kind = a.kind === 'tool' ? 'action' : a.kind === 'error' ? 'error' : a.kind === 'warn' ? (/gagal|belum|error/i.test(text) ? 'error' : 'status') : a.kind === 'done' || a.kind === 'output' || a.kind === 'result' ? 'result' : a.kind === 'instruction' ? 'task' : 'status';
    if (a.kind === 'output') return; // ringkasan panjang tampil di panel agen (riwayat), bukan di log ringkas
    this.log(seat, kind, text);
    if (kind === 'error') { this.patch(seat, { status: 'error' }); this.later(5000, () => this.patch(seat, agentState(this.emps.get(a.employeeId)!))); }
  }

  private onApprovalEvent(a: AvoApproval, open: boolean) {
    const seat = this.seatOf.get(a.employeeId);
    if (seat) {
      this.log(seat, open ? 'status' : 'result', open ? `Waiting for your OK: ${a.toolName ?? a.title ?? 'action'}` : `Approval ${a.status?.toLowerCase() ?? 'decided'}`);
      this.patch(seat, { status: open ? 'paused' : 'working' });
    }
    this.onApproval?.(a, open);
  }

  private refreshProject() {
    const p = this.project;
    if (!p) return;
    const tasks = p.taskIds.map((id) => this.ctx.getState().tasks[id]).filter(Boolean);
    if (!tasks.length) return;
    const done = tasks.filter((t) => t.status === 'completed' || t.status === 'error').length;
    // Task gagal tidak dihitung sebagai kemajuan: project yang gagal tidak tampil 100 %.
    p.progress = Math.round(tasks.reduce((s, t) => s + (t.status === 'completed' ? 100 : t.status === 'error' ? 0 : t.progress), 0) / tasks.length);
    if (done === tasks.length) { p.status = 'completed'; p.completedAt = Date.now(); }
    this.ctx.emit({ type: 'project.upsert', project: { ...p } });
  }

  private later(ms: number, fn: () => void) { this.timers.push(setTimeout(fn, ms)); }

  /** Kickoff nyata: satu task ke manager (AI-nya memecah lewat delegate_task), tim berkumpul sebentar di ruang rapat. */
  async submitProject(title: string) {
    const boss = this.empOf.get('manager');
    if (!title || !boss) return;
    this.project = { id: uid('prj'), title: short(title, 90), status: 'meeting', progress: 0, createdAt: Date.now(), taskIds: [] };
    this.ctx.emit({ type: 'project.upsert', project: { ...this.project } });
    this.say('user', title, 'manager');
    this.say('manager', 'Kickoff. Everybody in.', 'all');
    AGENT_IDS.forEach((seat, i) => { if (this.empOf.has(seat)) this.patch(seat, { place: 'meeting', seat: i }); });
    this.later(9000, () => AGENT_IDS.forEach((seat) => { if (this.empOf.has(seat)) this.patch(seat, { place: 'desk', seat: undefined }); }));
    try {
      const t = await one<AvoTask>('POST', `/office/employees/${boss.id}/tasks`, {
        title: short(title, 200),
        description: `${title}\n\nKamu manager tim. Pecah pekerjaan ini menjadi task untuk rekan yang cocok memakai tool delegate_task (satu task per orang, jelas & bisa dikerjakan), lalu rangkum rencana dan hasilnya.`,
        source: 'panel',
      });
      this.project.rootTaskId = t.id;
      this.project.status = 'running';
      // SSE bisa lebih dulu dari respons POST: jangan turunkan status (EXECUTING → QUEUED), cukup tempelkan ke project.
      const existing = this.ctx.getState().tasks[t.id];
      if (!existing) this.upsertTask(t, true);
      else {
        this.ctx.emit({ type: 'task.upsert', task: { ...existing, projectId: this.project.id } });
        if (!this.project.taskIds.includes(t.id)) this.project.taskIds.push(t.id);
        this.ctx.emit({ type: 'project.upsert', project: { ...this.project } });
        this.refreshProject();
      }
    } catch (e) {
      this.log('manager', 'error', `Project could not start: ${(e as Error).message}`);
      this.project.status = 'completed';
      this.ctx.emit({ type: 'project.upsert', project: { ...this.project } });
    }
  }

  async assignTask(agent: AgentId, title: string) {
    const e = this.empOf.get(agent);
    if (!e || !title) return;
    try { await one('POST', `/office/employees/${e.id}/tasks`, { title: short(title, 200), source: 'panel' }); }
    catch (err) { this.log(agent, 'error', (err as Error).message); }
  }

  pauseAgent() {}
  resumeAgent() {}

  /** Jawaban dari task live agen (seperti referensi); pertanyaan bebas → model agen itu sendiri bila terhubung. */
  async ask(id: AgentId, text: string, _lang: Lang) {
    const s = this.ctx.getState();
    const a = s.agents[id];
    const e = this.empOf.get(id);
    const t = a.currentTaskId ? s.tasks[a.currentTaskId] : null;
    const queued = Object.values(s.tasks).filter((x) => x.assignee === id && x.status === 'queued').length;
    const last = [...s.logs].reverse().find((l) => l.agentId === id);
    const id_ = isId(text);
    const stateLine = t
      ? (id_ ? `Saya sedang mengerjakan "${t.title}" (${t.progress}%).${e?.currentTool ? ` Tool sekarang: ${e.currentTool}.` : ''}` : `I'm on "${t.title}" (${t.progress}%).${e?.currentTool ? ` Current tool: ${e.currentTool}.` : ''}`)
      : (id_ ? `Tidak ada task aktif (${a.status}). ${queued} task antre.` : `No active task (${a.status[0].toUpperCase()}${a.status.slice(1)}). ${queued} task(s) queued${queued ? ', waiting for the previous step' : ''}.`);
    const q = text.toLowerCase();
    if (/doing now|sedang apa|working on|lagi apa/.test(q)) return stateLine;
    if (/problem|blocker|masalah|kendala/.test(q)) {
      const err = [...s.logs].reverse().find((l) => l.agentId === id && l.kind === 'error');
      return err ? (id_ ? `Ada kendala terakhir: ${err.text}` : `Last problem: ${err.text}`) : (id_ ? 'Tidak ada kendala.' : 'No problems right now.');
    }
    if (/how far|progres|sejauh/.test(q)) return stateLine;
    if (/what's next|next|berikutnya|selanjutnya/.test(q)) {
      const nx = Object.values(s.tasks).find((x) => x.assignee === id && x.status === 'queued');
      return nx ? (id_ ? `Berikutnya: "${nx.title}".` : `Next up: "${nx.title}".`) : (id_ ? 'Belum ada task berikutnya.' : 'Nothing queued after this.');
    }
    if (!e) return stateLine;
    try {
      const prompt = `Rekan kerja manusia bertanya: "${text}"\nStatus kamu saat ini: ${stateLine}${last ? `\nAktivitas terakhir: ${last.text}` : ''}\nJawab singkat (maks 2 kalimat), jujur sesuai status, dalam bahasa yang sama dengan pertanyaan.`;
      const r = await one<{ content?: string; text?: string }>('POST', '/office/ai-engine/generate', { employeeId: e.id, prompt });
      const out = (r?.content ?? r?.text ?? '').replace(/\n?-{3,}\n?/g, ' ').trim();
      return out || stateLine;
    } catch {
      return stateLine;
    }
  }
}
