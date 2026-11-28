import { create } from 'zustand';
import { loadWeather, saveWeather, type Weather } from '../scene/weather';
import { saveMode, savedMode } from '../world/spawn';
import { ZOOM, clampZoom, loadZoom, saveZoom } from '../scene/zoom';
import { sfx } from '../scene/sfx';
import type { AgentDataAdapter, OfficeSnapshot } from '../core/adapter';
import type { Agent, AgentId, Lang, LogEntry, Message, OfficeEvent, Project, Task } from '../core/types';
import { uid } from '../core/types';
import { initialAgents } from '../core/agents';
import { SimulationAdapter } from '../core/simulation/SimulationAdapter';
import { PluginAdapter, replayUrl, type RunnerStatus } from '../core/plugin/PluginAdapter';
import { BackendAdapter, type AvoEmployee } from '../core/avo/BackendAdapter';
import { claudeTransport } from '../core/avo/claudeTransport';
import { getToken, list, one } from '../core/avo/api';

/** Served by the Agent Office plugin (or replaying a recording): show its live Claude Code events by default. */
export const IN_PLUGIN = location.pathname.startsWith('/premium') || !!replayUrl();
import { detectLang } from '../core/simulation/dialogue';

/** hq = Agent HQ (referensi v2 5:48). */
export type ViewMode = 'overview' | 'life' | 'hq';
export type CameraStyle = 'third' | 'first';
export type PanelTab = 'overview' | 'tasks' | 'activity' | 'comms';
/** avo = AI employee backend (default bila sudah login), claude-code = hook Claude Code, demo = simulasi berlabel DEMO. */
export type SourceKind = 'avo' | 'demo' | 'claude-code';
export type CameraPreset = 'overview' | 'workspace' | 'meeting' | 'manager' | 'lounge' | 'kitchen' | 'security';
/** Panel yang bisa dibuka dari dock kiri. */
export type DockPanel = 'task' | 'team' | 'tasks' | 'comms' | 'log';
export type Modal = null | 'whiteboard' | 'manager' | 'assign' | 'meeting' | 'hire' | 'reception';

interface OfficeState extends OfficeSnapshot {
  adapter: AgentDataAdapter;
  source: SourceKind;
  liveStatus: 'connecting' | 'open' | 'error' | null;
  /** Claude Code runner di komputer pemilik (dua arah): null = belum diketahui / bukan sumber Claude Code */
  runner: RunnerStatus | null;
  speed: number;
  running: boolean;

  mode: ViewMode;
  /** cuaca & waktu (☰ → Weather & time) */
  weather: Weather;
  setWeather(w: Partial<Weather>): void;
  cameraStyle: CameraStyle;
  /** jarak kamera Walk in (m): 0 = orang pertama, besar = pandangan atas ala Dota (scroll) */
  zoom: number;
  preset: CameraPreset;
  presetNonce: number;
  /** A camera shot for recording video (id from scene/shots.ts), playing in Overview. */
  shot: string | null;
  selectedId: AgentId | null;
  tab: PanelTab;
  chatWith: AgentId | null;
  chatPending: boolean;
  modal: Modal;
  assignFor: AgentId | null;
  menuOpen: boolean;
  hint: string | null;
  voiceOn: boolean;
  dashboardOpen: boolean;
  /** Panel dock yang terbuka (satu saja), null = layar bersih. */
  panel: DockPanel | null;
  /** H: sembunyikan semua UI (layar bersih total). */
  uiHidden: boolean;
  /** Semua AI employee office (kursi hanya 5, sisanya tetap terlihat di daftar). */
  roster: AvoEmployee[];
  /** Nama office aktif (sesi login), null bila belum login/demo. */
  officeName: string | null;
  /** Persetujuan tool yang menunggu OK (approval gate backend). */
  approvals: { id: string; employeeId: string; toolName?: string; title?: string }[];

  dispatch(ev: OfficeEvent): void;
  setSource(kind: SourceKind): void;
  submitProject(title: string): void;
  assignTask(agent: AgentId, title: string): void;
  togglePause(agent: AgentId): void;
  ask(agent: AgentId, text: string): Promise<void>;

  setSpeed(x: number): void;
  setRunning(r: boolean): void;
  setLang(l: Lang): void;
  setMode(m: ViewMode): void;
  setCameraStyle(c: CameraStyle): void;
  setZoom(z: number): void;
  goPreset(p: CameraPreset): void;
  playShot(id: string | null): void;
  select(id: AgentId | null, tab?: PanelTab): void;
  setTab(t: PanelTab): void;
  openChat(id: AgentId | null): void;
  openModal(m: Modal, assignFor?: AgentId | null): void;
  setMenu(open: boolean): void;
  setHint(h: string | null): void;
  setVoice(on: boolean): void;
  setDashboard(open: boolean): void;
  setPanel(p: DockPanel | null): void;
  toggleUi(): void;
}

const MAX_LOGS = 500;
const MAX_MESSAGES = 400;

function speak(text: string, lang: Lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[✅"]/g, ''));
  u.lang = lang === 'uz' ? 'uz-UZ' : 'en-US';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === 'uz' ? 'uz' : 'en'));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return u;
}

/** Jarak orang ketiga terakhir: V / tombol 1st-3rd kembali ke sini dari orang pertama. */
let lastThird = loadZoom() || ZOOM.DEFAULT;

export const useOffice = create<OfficeState>((set, get) => {
  const blank = () => ({ agents: initialAgents(), tasks: {} as Record<string, Task>, projects: {} as Record<string, Project>, messages: [] as Message[], logs: [] as LogEntry[], activeProjectId: null as string | null });

  const ctx = {
    emit: (ev: OfficeEvent) => get().dispatch(ev),
    getState: (): OfficeSnapshot => {
      const s = get();
      return { agents: s.agents, tasks: s.tasks, projects: s.projects, messages: s.messages, logs: s.logs, activeProjectId: s.activeProjectId, lang: s.lang };
    },
  };

  const makeAdapter = (kind: SourceKind): AgentDataAdapter => {
    if (kind === 'demo') return new SimulationAdapter();
    if (kind === 'avo') {
      const be = new BackendAdapter();
      be.onStatus = (st) => set({ liveStatus: st });
      be.onTeam = (_seated, all) => set({ roster: all });
      be.onApproval = (a, open) => set((s) => ({ approvals: open ? [...s.approvals.filter((x) => x.id !== a.id), a] : s.approvals.filter((x) => x.id !== a.id) }));
      return be;
    }
    const live = new PluginAdapter(IN_PLUGIN ? undefined : claudeTransport);
    live.onStatus = (st) => set({ liveStatus: st });
    live.onRunner = (r) => set({ runner: r });
    return live;
  };

  // Fokus Claude: otak = Claude Code (seperti video). AI team / Demo tidak tampil di UI; hanya lewat ?source=avo|demo
  // untuk admin/uji (docs/ai-office-product-spec.md).
  const KINDS: SourceKind[] = ['avo', 'demo', 'claude-code'];
  const wanted = new URLSearchParams(location.search).get('source') as SourceKind | null;
  const start: SourceKind = IN_PLUGIN ? 'claude-code' : wanted && KINDS.includes(wanted) ? wanted : getToken() ? 'claude-code' : 'demo';
  const adapter = makeAdapter(start);
  queueMicrotask(() => adapter.connect(ctx));
  // refresh di Walk in = kembali ke Walk in (posisi terakhir dipulihkan oleh Player); hujan menyala lagi bila dipilih
  queueMicrotask(() => { if (savedMode() === 'life' && !new URLSearchParams(location.search).has('render')) get().setMode('life'); sfx.setRain(get().weather.rain); });

  return {
    ...blank(),
    lang: 'en',
    adapter,
    source: start,
    liveStatus: start === 'demo' ? null : 'connecting',
    runner: null,
    roster: [],
    approvals: [],
    officeName: null,
    speed: 1,
    running: true,
    mode: 'overview',
    weather: loadWeather(),
    zoom: loadZoom(),
    cameraStyle: loadZoom() === 0 ? 'first' : 'third',
    preset: 'overview',
    presetNonce: 0,
    shot: null,
    selectedId: null,
    tab: 'overview',
    chatWith: null,
    chatPending: false,
    modal: null,
    assignFor: null,
    menuOpen: false,
    hint: null,
    voiceOn: false,
    dashboardOpen: true,
    panel: null,
    uiHidden: false,

    dispatch(ev) {
      set((s) => {
        switch (ev.type) {
          case 'reset':
            return { ...blank() };
          case 'agent.patch': {
            const prev = s.agents[ev.id];
            const next: Agent = { ...prev, ...ev.patch };
            return { agents: { ...s.agents, [ev.id]: next } };
          }
          case 'task.upsert':
            return { tasks: { ...s.tasks, [ev.task.id]: ev.task } };
          case 'project.upsert':
            return { projects: { ...s.projects, [ev.project.id]: ev.project }, activeProjectId: ev.project.id };
          case 'message':
            return { messages: [...s.messages, ev.message].slice(-MAX_MESSAGES) };
          case 'log':
            return { logs: [...s.logs, ev.entry].slice(-MAX_LOGS) };
        }
      });
    },

    setSource(kind) {
      const s = get();
      if (kind === s.source) return;
      s.adapter.disconnect();
      const next = makeAdapter(kind);
      set({ adapter: next, source: kind, liveStatus: kind === 'demo' ? null : 'connecting', runner: null, chatWith: null, approvals: [], roster: [] });
      next.connect(ctx);
      next.setSpeed?.(s.speed);
    },

    submitProject(title) { get().adapter.submitProject(title.trim()); },
    assignTask(agent, title) { get().adapter.assignTask(agent, title.trim()); },
    togglePause(agent) {
      const s = get();
      if (s.agents[agent].status === 'paused') s.adapter.resumeAgent(agent);
      else s.adapter.pauseAgent(agent);
    },

    async ask(agent, text) {
      const s = get();
      const lang = detectLang(text, s.lang);
      const q: Message = { id: uid('msg'), ts: Date.now(), from: 'user', to: agent, text, channel: 'direct' };
      set({ messages: [...s.messages, q], chatPending: true });
      get().dispatch({ type: 'agent.patch', id: agent, patch: { speaking: false } });
      const answer = await s.adapter.ask(agent, text, lang);
      const a: Message = { id: uid('msg'), ts: Date.now(), from: agent, to: 'user', text: answer, channel: 'direct' };
      set((st) => ({ messages: [...st.messages, a], chatPending: false }));
      get().dispatch({ type: 'agent.patch', id: agent, patch: { speaking: true } });
      const done = () => get().dispatch({ type: 'agent.patch', id: agent, patch: { speaking: false } });
      const u = get().voiceOn ? speak(answer, lang) : undefined;
      if (u) u.onend = done;
      else setTimeout(done, 1800);
    },

    setSpeed(x) { get().adapter.setSpeed?.(x); set({ speed: x }); },
    setRunning(r) { get().adapter.setRunning?.(r); set({ running: r }); },
    setLang(l) { set({ lang: l }); },
    setMode(m) { saveMode(m); set({ mode: m, menuOpen: false, hint: null, modal: null, dashboardOpen: m === 'overview' }); },
    setWeather(w) { const next = { ...get().weather, ...w }; saveWeather(next); sfx.setRain(next.rain); set({ weather: next }); },
    setCameraStyle(c) { get().setZoom(c === 'first' ? 0 : lastThird); },
    setZoom(z) {
      const v = clampZoom(z);
      if (v > 0) lastThird = v;
      saveZoom(v);
      set({ zoom: v, cameraStyle: v === 0 ? 'first' : 'third' });
    },
    goPreset(p) { set((s) => ({ preset: p, presetNonce: s.presetNonce + 1 })); },
    playShot(id) { set({ shot: id, selectedId: null, modal: null, chatWith: null }); },
    select(id, tab) { set({ selectedId: id, tab: tab ?? 'overview' }); },
    setTab(t) { set({ tab: t }); },
    openChat(id) { set({ chatWith: id }); },
    openModal(m, assignFor = null) { set({ modal: m, assignFor }); },
    setMenu(open) { set({ menuOpen: open }); },
    setHint(h) { if (get().hint !== h) set({ hint: h }); },
    setVoice(on) { set({ voiceOn: on }); if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); },
    setDashboard(open) { set({ dashboardOpen: open }); },
    setPanel(p) { set((s) => ({ panel: s.panel === p ? null : p })); },
    toggleUi() { set((s) => ({ uiHidden: !s.uiHidden })); },
  };
});

/** Helpers for components. */
export const selectProject = (s: OfficeState) => (s.activeProjectId ? s.projects[s.activeProjectId] : null);

/** Nama office aktif untuk menu ⚙ (semua sumber). */
if (getToken()) {
  void Promise.all([one<{ activeCompanyId?: string | null }>('GET', '/auth/me'), list<{ companyId: string; name: string }>('/auth/workspaces')])
    .then(([me, ws]) => useOffice.setState({ officeName: ws.find((w) => w.companyId === me?.activeCompanyId)?.name ?? null }))
    .catch(() => {});
}
