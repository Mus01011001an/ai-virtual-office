/**
 * Jembatan frontend ↔ backend. Semua data office/employee nyata lewat sini.
 * Realtime: SSE `office/stream` → menulis field Employee yang sama (status/slot/currentTask/…),
 * sehingga layer 3D tidak perlu tahu sumber datanya.
 */
import { del, fetchPendingApprovalsCount, fetchSchedule, get, getToken, leavePresence, patch, post, sendPresence, setToken, setUnauthorizedHandler, streamUrl } from '../lib/api'
import { appearanceFromSeed } from '../lib/appearance'
import { DESKS } from '../office/layout'
import { useOffice } from './store'
import { runtime } from './runtime'
import { proceduralAudio } from '../audio/procedural-audio'
import { voiceEngine } from '../audio/voice-engine'
import { spatialVoice } from '../audio/spatial-voice'
import type { ActivityKind, Appearance, Employee, Me, Office, TaskItem } from './types'

// ---------- tipe respons backend ----------
interface ApiWorkspace { companyId: string; name: string; template: 'EMPTY' | 'DEMO_TEAM'; timezone: string; employeeCount: number; role: { name: string } | null; isOwner: boolean }
export interface ApiEmployee {
  id: string; name: string; role: string; department: string; provider: string; providerId: string | null; model: string
  skills: string[]; systemPrompt: string; deskIndex: number; appearance: Partial<Appearance>; status: Employee['status']
  slot: number | null; currentTask: string | null; currentTool: string | null; progress: number; isDemo: boolean; createdAt: string
  voiceProfile?: Employee['voiceProfile']
}
interface ApiActivity { id: string; employeeId: string; kind: string; text: string; createdAt: string }
interface ApiTask { id: string; employeeId: string; title: string; status: TaskItem['status'] | 'CANCELLED' | 'WAITING'; createdAt: string; finishedAt: string | null; isDemo: boolean }

export interface AiProvider {
  id: string; name: string; type: ProviderType; baseUrl: string; apiKeyHint: string | null; models: string[]; defaultModel: string | null
  isActive: boolean; lastTestedAt: string | null; lastTestOk: boolean | null; lastTestMessage: string | null; employeeCount: number
}
export type ProviderType = 'openai_compatible' | 'openai' | 'anthropic' | 'google' | 'deepseek'
export interface ProviderTypeInfo { id: ProviderType; label: string; defaultBaseUrl: string; needsBaseUrl: boolean }
export interface TestResult { ok: boolean; latencyMs: number; message: string; models: string[] }
export interface CatalogEntry { providerId: string; providerName: string; type: string; defaultModel: string | null; healthy: boolean | null; models: string[] }

// ---------- mapper ----------
const KINDS: ActivityKind[] = ['status', 'info', 'tool', 'output', 'ai', 'warn', 'error', 'instruction', 'done']
const toKind = (k: string): ActivityKind => (KINDS.includes(k as ActivityKind) ? (k as ActivityKind) : 'info')

export function toEmployee(e: Partial<ApiEmployee> & { id: string }, officeId: string): Employee {
  const hasLook = e.appearance && typeof e.appearance === 'object' && 'skin' in e.appearance
  return {
    id: e.id,
    officeId,
    name: (e.name && typeof e.name === 'string' && e.name.trim()) || 'AI Member',
    role: e.role || 'Assistant',
    department: e.department || 'Operations',
    provider: e.provider || '',
    providerId: e.providerId || '',
    model: e.model || '',
    skills: Array.isArray(e.skills) ? e.skills : [],
    systemPrompt: e.systemPrompt || '',
    deskIndex: typeof e.deskIndex === 'number' ? e.deskIndex : 0,
    status: e.status || 'IDLE',
    slot: e.slot ?? null,
    currentTask: e.currentTask ?? null,
    currentTool: e.currentTool ?? null,
    progress: typeof e.progress === 'number' ? e.progress : 0,
    appearance: hasLook ? (e.appearance as Appearance) : appearanceFromSeed(e.id || 'employee'),
    voiceProfile: e.voiceProfile,
    isDemo: false,
    createdAt: e.createdAt ? Date.parse(e.createdAt) : Date.now(),
  }
}
const toOffice = (w: ApiWorkspace): Office => ({
  id: w.companyId, name: w.name, template: w.template === 'DEMO_TEAM' ? 'demo-team' : 'empty', timezone: w.timezone,
  createdAt: 0, employeeCount: w.employeeCount, role: w.role?.name ?? null, isOwner: w.isOwner,
})
const toTask = (t: ApiTask): TaskItem => ({
  id: t.id, employeeId: t.employeeId, title: t.title, status: t.status === 'CANCELLED' ? 'FAILED' : t.status === 'WAITING' ? 'QUEUED' : t.status,
  createdAt: Date.parse(t.createdAt), finishedAt: t.finishedAt ? Date.parse(t.finishedAt) : undefined, isDemo: false,
})

// ---------- auth ----------
setUnauthorizedHandler(() => { closeStream(); setToken(null); useOffice.getState().set({ me: null, entered: false, offices: [] }) })

export async function bootstrapSession() {
  if (!getToken()) return useOffice.getState().set({ authChecked: true })
  try {
    await refreshMe()
    await loadWorkspaces()
  } catch { /* 401 ditangani handler */ }
  useOffice.getState().set({ authChecked: true })
}

export async function refreshMe() {
  const me = await get<Me>('/auth/me')
  useOffice.getState().set({ me })
  return me
}

export async function signIn(usernameOrEmail: string, password: string) {
  const r = await post<{ token: string }>('/auth/signin', {
    username: usernameOrEmail.trim(),
    email: usernameOrEmail.includes('@') ? usernameOrEmail.trim() : undefined,
    password,
  })
  setToken(r.token)
  await refreshMe()
  await loadWorkspaces()
}

export async function signUp(name: string, email: string, password: string) {
  await post('/auth/signup', { name, email, password })
  await signIn(email, password)
}

export async function signOut() {
  try { await post('/auth/signout') } catch { /* token mungkin sudah tidak valid */ }
  closeStream(); setToken(null)
  useOffice.getState().set({ me: null, entered: false, offices: [], currentOfficeId: '', settingsOpen: false })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await post('/auth/change-password', { currentPassword, newPassword })
  await refreshMe()
}

// ---------- office ----------
export async function loadWorkspaces() {
  const list = await get<ApiWorkspace[]>('/auth/workspaces')
  useOffice.getState().set({ offices: list.map(toOffice) })
  return list
}

export async function createOffice(
  name: string,
  template: 'empty' | 'demo-team',
  timezone: string,
  owner?: { name: string; email: string; password: string },
) {
  const payload: any = {
    name,
    template: template === 'demo-team' ? 'DEMO_TEAM' : 'EMPTY',
    timezone,
  }
  if (owner && owner.email) {
    payload.owner = owner
  }
  const o = await post<{ id: string }>('/system/companies', payload)
  await loadWorkspaces()
  if (!owner) {
    await enterOffice(o.id)
  }
  return o
}

export async function archiveCurrentOffice() {
  await del('/system/companies/current')
  closeStream()
  await refreshMe()
  await loadWorkspaces()
  useOffice.getState().set({ entered: false })
}

/** Pindah sesi ke office → muat employee + aktivitas + task → buka SSE → render 3D. */
export async function enterOffice(id: string) {
  await post('/auth/switch-company', { companyId: id })
  const me = await refreshMe()
  const [emps, tasks] = await Promise.all([
    get<ApiEmployee[]>('/office/employees?limit=200'),
    get<ApiTask[]>('/office/tasks?limit=200').catch(() => [] as ApiTask[]),
  ])
  const st = useOffice.getState()
  st.enterOffice(id, emps.map((e) => toEmployee(e, id)))
  useOffice.getState().set({ tasks: tasks.map(toTask) })
  void me
  // riwayat aktivitas (monitor & workstation) — paralel, tidak memblokir masuk
  void Promise.all(emps.map(async (e) => {
    const acts = await get<ApiActivity[]>(`/office/employees/${e.id}/activity?limit=60`).catch(() => [])
    const s = useOffice.getState()
    s.set({ activity: { ...s.activity, [e.id]: acts.map((a) => ({ id: a.id, at: Date.parse(a.createdAt), kind: toKind(a.kind), text: a.text })) } })
  }))
  openStream()
  fetchSchedule().then((sched) => {
    if (sched) {
      useOffice.getState().set({ officeSchedule: sched, shiftState: sched.currentShift })
    }
  }).catch(() => {})
  fetchPendingApprovalsCount().then((count) => {
    useOffice.getState().set({ pendingApprovalsCount: count })
  }).catch(() => {})
  startPresenceLoop()
}

// ---------- employee ----------
/** Office demo memakai meja tim DEMO → pilih meja kosong yang tidak bentrok dengan fixture. */
function suggestDesk(): number | undefined {
  const used = new Set(useOffice.getState().employees.map((e) => e.deskIndex))
  const i = DESKS.findIndex((_, k) => !used.has(k))
  return i >= 0 ? i : undefined
}

export async function recruit(input: { name: string; role: string; department: string; providerId?: string; model?: string; skills: string[]; systemPrompt: string }) {
  const seedLook = appearanceFromSeed(`${input.name}-${Date.now()}`)
  const emp = await post<ApiEmployee>('/office/employees', { ...input, appearance: seedLook, deskIndex: suggestDesk() })
  return patchOrUpsertEmployee(emp)
}

export async function updateEmployee(id: string, p: Partial<{ name: string; role: string; department: string; providerId: string; model: string; skills: string[]; systemPrompt: string }>) {
  return patchOrUpsertEmployee(await patch<ApiEmployee>(`/office/employees/${id}`, p))
}

export async function assignTask(employeeId: string, title: string, source: 'panel' | 'discussion' = 'panel') {
  const t = await post<ApiTask>(`/office/employees/${employeeId}/tasks`, { title, source })
  upsertTask(toTask(t))
}

export const instruct = (employeeId: string, text: string) => post(`/office/employees/${employeeId}/instructions`, { text })

/**
 * Patch parsial atau insert karyawan secara aman (Zero-Data-Loss Guaranteed).
 * Mencegah event SSE parsial menimpa atribut statis (name, role, appearance) dengan undefined.
 */
export function patchOrUpsertEmployee(e: Partial<ApiEmployee> & { id: string }): Employee {
  const st = useOffice.getState()
  const existing = st.employees.find((x) => x.id === e.id)

  if (existing) {
    const patch: Partial<Employee> = {}
    if (e.name !== undefined && e.name !== null && typeof e.name === 'string' && e.name.trim() !== '') {
      patch.name = e.name.trim()
    }
    if (e.role !== undefined && e.role !== null) patch.role = e.role
    if (e.department !== undefined && e.department !== null) patch.department = e.department
    if (e.provider !== undefined) patch.provider = e.provider
    if (e.providerId !== undefined) patch.providerId = e.providerId
    if (e.model !== undefined) patch.model = e.model
    if (e.skills !== undefined && Array.isArray(e.skills)) patch.skills = e.skills
    if (e.systemPrompt !== undefined) patch.systemPrompt = e.systemPrompt
    if (e.deskIndex !== undefined && typeof e.deskIndex === 'number') patch.deskIndex = e.deskIndex
    if (e.status !== undefined) patch.status = e.status
    if (e.slot !== undefined) patch.slot = e.slot
    if (e.currentTask !== undefined) patch.currentTask = e.currentTask
    if (e.currentTool !== undefined) patch.currentTool = e.currentTool
    if (e.progress !== undefined && typeof e.progress === 'number') patch.progress = e.progress
    if (e.voiceProfile !== undefined) patch.voiceProfile = e.voiceProfile

    if (e.appearance && typeof e.appearance === 'object' && 'skin' in e.appearance) {
      patch.appearance = e.appearance as Appearance
    }

    const updatedEmployee: Employee = { ...existing, ...patch }
    st.set({
      employees: st.employees.map((x) => (x.id === e.id ? updatedEmployee : x)),
    })
    return updatedEmployee
  }

  const mapped = toEmployee(e, st.currentOfficeId)
  st.set({ employees: [...st.employees, mapped] })
  return mapped
}
function upsertTask(t: TaskItem) {
  const st = useOffice.getState()
  st.set({ tasks: st.tasks.some((x) => x.id === t.id) ? st.tasks.map((x) => (x.id === t.id ? t : x)) : [...st.tasks, t] })
}

// ---------- AI provider ----------
export const providerTypes = () => get<ProviderTypeInfo[]>('/office/ai-providers/types')
export const listProviders = () => get<AiProvider[]>('/office/ai-providers')
export const providerCatalog = () => get<CatalogEntry[]>('/office/ai-providers/catalog')
export const testProviderDraft = (b: { type: ProviderType; baseUrl?: string; apiKey?: string; id?: string }) => post<TestResult>('/office/ai-providers/test', b)
export const testProvider = (id: string) => post<TestResult>(`/office/ai-providers/${id}/test`)
export const saveProvider = (b: { id?: string; name: string; type: ProviderType; baseUrl?: string; apiKey?: string; models: string[]; defaultModel?: string | null; isActive?: boolean }) => {
  const { id, ...body } = b
  const payload = { ...body, defaultModel: body.defaultModel ?? undefined, apiKey: body.apiKey || undefined }
  return id ? patch<AiProvider>(`/office/ai-providers/${id}`, payload) : post<AiProvider>('/office/ai-providers', payload)
}
export const deleteProvider = (id: string) => del(`/office/ai-providers/${id}`)

// ---------- discussion ----------
let activeDiscussionId: string | null = null
export const getActiveDiscussionId = () => activeDiscussionId

export async function startDiscussion(participantIds: string[]) {
  if (!getToken() || !participantIds.length) return null
  try {
    const res = await post<{ id: string }>('/office/discussions', { participantIds })
    activeDiscussionId = res.id
    return res.id
  } catch {
    return null
  }
}

export async function sendDiscussionMessage(text: string) {
  if (!getToken()) return null
  try {
    if (!activeDiscussionId) {
      const summoned = useOffice.getState().summoned
      if (summoned.length) {
        await startDiscussion(summoned)
      }
    }
    if (!activeDiscussionId) return null
    return await post(`/office/discussions/${activeDiscussionId}/messages`, { text })
  } catch {
    return null
  }
}

export async function triggerDebate(topic: string, maxRounds = 3) {
  if (!getToken()) return null
  if (!activeDiscussionId) {
    const summoned = useOffice.getState().summoned
    if (summoned.length) await startDiscussion(summoned)
  }
  if (!activeDiscussionId) return null
  return post(`/office/discussions/${activeDiscussionId}/debate`, { topic, maxRounds })
}

export async function concludeDiscussion() {
  if (!getToken() || !activeDiscussionId) return null
  const id = activeDiscussionId
  activeDiscussionId = null
  return post(`/office/discussions/${id}/conclude`, { generateTasks: true, saveMoMToS3: true })
}

export async function endDiscussion() {
  if (!getToken() || !activeDiscussionId) return
  const id = activeDiscussionId
  activeDiscussionId = null
  try {
    await post(`/office/discussions/${id}/end`)
  } catch { /* abaikan */ }
}

// ---------- realtime (SSE) ----------
let es: EventSource | null = null
let retry: number | undefined

// ---------- presence loop ----------
let presenceTimer: number | undefined
let lastSentX = 0, lastSentZ = 0, lastSentYaw = 0, lastSentAnim = ''
let lastSentTime = 0

export function startPresenceLoop() {
  stopPresenceLoop()
  presenceTimer = window.setInterval(() => {
    if (!getToken() || !useOffice.getState().entered) return
    const p = runtime.player
    const now = Date.now()
    const anim = p.running ? 'run' : p.moving ? 'walk' : 'idle'
    const isSpeaking = spatialVoice.isSpeakingLocal()
    const dist = Math.hypot(p.x - lastSentX, p.z - lastSentZ)
    const yawDiff = Math.abs(p.yaw - lastSentYaw)
    const animDiff = anim !== lastSentAnim
    const heartbeatNeeded = now - lastSentTime > 3000

    if (dist > 0.05 || yawDiff > 0.05 || animDiff || heartbeatNeeded || isSpeaking) {
      lastSentX = p.x
      lastSentZ = p.z
      lastSentYaw = p.yaw
      lastSentAnim = anim
      lastSentTime = now
      sendPresence({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, anim, isSpeaking }).catch(() => {})
    }
  }, 200)
}

export function stopPresenceLoop() {
  if (presenceTimer !== undefined) {
    window.clearInterval(presenceTimer)
    presenceTimer = undefined
  }
}

export function closeStream() {
  stopPresenceLoop()
  void leavePresence().catch(() => {})
  window.clearTimeout(retry)
  es?.close(); es = null
}

function openStream() {
  closeStream()
  if (!getToken()) return
  es = new EventSource(streamUrl())
  const on = <T,>(type: string, fn: (d: T) => void) => es!.addEventListener(type, (ev) => { try { fn(JSON.parse((ev as MessageEvent).data)) } catch { /* abaikan */ } })
  on<ApiEmployee>('employee.created', (e) => patchOrUpsertEmployee(e))
  on<Partial<ApiEmployee> & { id: string }>('employee.updated', (e) => patchOrUpsertEmployee(e))
  on<{ id: string }>('employee.deleted', ({ id }) => {
    const st = useOffice.getState()
    st.set({ employees: st.employees.filter((x) => x.id !== id), selectedId: st.selectedId === id ? null : st.selectedId })
  })
  on<ApiActivity>('activity.created', (a) => {
    const st = useOffice.getState()
    const list = st.activity[a.employeeId] ?? []
    if (list.some((x) => x.id === a.id)) return
    st.set({ activity: { ...st.activity, [a.employeeId]: [...list, { id: a.id, at: Date.parse(a.createdAt), kind: toKind(a.kind), text: a.text }].slice(-300) } })
  })
  on<{ task: ApiTask }>('task.event', ({ task }) => {
    if (task.status === 'COMPLETED') {
      proceduralAudio.playChime('done')
    }
    upsertTask(toTask(task))
  })
  on<{ id: string; discussionId: string; fromType: string; fromId: string; text: string; stance?: string; createdAt: string }>('discussion.message', (m) => {
    const st = useOffice.getState()
    if (m.fromType === 'employee' && m.fromId) {
      const emp = st.employees.find((e) => e.id === m.fromId)
      voiceEngine.speak(m.text, emp?.voiceProfile || { pitch: 1.0, rate: 1.0, gender: 'neutral' })
      const bubbles = { ...st.bubbles }
      bubbles[m.fromId] = m.text
      st.set({
        bubbles,
        chat: [...st.chat, { id: m.id, at: Date.parse(m.createdAt), from: m.fromId, text: m.text, stance: m.stance, demo: false }].slice(-80)
      })
      window.setTimeout(() => {
        const cur = { ...useOffice.getState().bubbles }
        if (cur[m.fromId] === m.text) {
          delete cur[m.fromId]
          useOffice.getState().set({ bubbles: cur })
        }
      }, Math.max(5000, m.text.length * 70))
    } else if (m.fromType === 'system') {
      st.set({
        chat: [...st.chat, { id: m.id, at: Date.parse(m.createdAt), from: 'system', text: m.text }].slice(-80)
      })
    }
  })
  on<{ discussionId: string; whiteboard: any }>('whiteboard.updated', ({ whiteboard }) => {
    if (whiteboard) {
      useOffice.getState().set({ whiteboard })
    }
  })
  on<{ discussionId: string; artifact?: any; tasksCount?: number }>('discussion.concluded', ({ artifact, tasksCount }) => {
    const st = useOffice.getState()
    st.set({
      chat: [...st.chat, {
        id: `sys-${Date.now()}`,
        at: Date.now(),
        from: 'system',
        text: `✅ Rapat selesai. Risalah (${artifact?.name || 'MoM'}) disimpan ke S3. ${tasksCount || 0} tugas didelegasikan ke tim!`
      }].slice(-80),
      debateMode: false,
    })
  })

  // ── Phase 6 & Phase 10: Presence & Roblox-Style Spatial Voice Signaling ──
  on<{ count: number; users: any[] }>('presence.update', ({ users }) => {
    const me = useOffice.getState().me
    const myId = me?.id
    // Saring user lain (tidak merender avatar diri sendiri sebagai remote player)
    const remotes = (users || []).filter((u) => u.userId !== myId)
    useOffice.getState().set({ remoteUsers: remotes })

    // Sinkronkan peers WebRTC untuk spatial voice chat
    spatialVoice.cleanupPeers(remotes.map((u) => u.userId))
    if (spatialVoice.isMicActive && myId) {
      for (const r of remotes) {
        if (myId < r.userId) {
          void spatialVoice.connectToPeer(r.userId)
        }
      }
    }
  })

  on<{ fromUserId: string; toUserId?: string; signal: any }>('presence.voice-signal', (data) => {
    const myId = useOffice.getState().me?.id
    if (!data.toUserId || data.toUserId === myId) {
      void spatialVoice.handleIncomingSignal(data.fromUserId, data.signal)
    }
  })

  on<{ clock: string; timezone: string; status: any }>('schedule.transition', ({ status }) => {
    if (status) {
      useOffice.getState().set({ shiftState: status })
    }
  })

  on<{ date: string; participantIds: string[]; location: string }>('standup.started', ({ date, participantIds }) => {
    const st = useOffice.getState()
    st.set({
      summoned: participantIds || [],
      chat: [...st.chat, {
        id: `sys-standup-${Date.now()}`,
        at: Date.now(),
        from: 'system',
        text: `📋 Daily Standup (${date}) dimulai di Collaboration Area! Seluruh tim berkumpul.`
      }].slice(-80)
    })
  })

  on<{ date: string; report: any }>('standup.item', ({ report }) => {
    if (!report?.employeeId) return
    const st = useOffice.getState()
    const emp = st.employees.find((e) => e.id === report.employeeId)
    voiceEngine.speak(
      `${report.name}. Kemarin: ${report.yesterday}. Hari ini: ${report.today}.`,
      emp?.voiceProfile || { pitch: 1.0, rate: 1.0, gender: 'neutral' }
    )
    const bubbles = { ...st.bubbles }
    const bubbleText = `Kemarin: ${report.yesterday}\nHari ini: ${report.today}`
    bubbles[report.employeeId] = bubbleText
    st.set({
      bubbles,
      chat: [...st.chat, {
        id: `standup-${report.employeeId}-${Date.now()}`,
        at: Date.now(),
        from: report.employeeId,
        text: `[STANDUP] ${report.name} — Kemarin: ${report.yesterday} | Hari ini: ${report.today} | Kendala: ${report.blockers}`,
        demo: false,
      }].slice(-80),
    })
    window.setTimeout(() => {
      const cur = { ...useOffice.getState().bubbles }
      if (cur[report.employeeId] === bubbleText) {
        delete cur[report.employeeId]
        useOffice.getState().set({ bubbles: cur })
      }
    }, 7000)
  })

  on<{ id: string; date: string; summary: string; reports: any[] }>('standup.completed', ({ date, reports }) => {
    const st = useOffice.getState()
    // Bubarkan agen kembali ke meja
    st.set({
      summoned: [],
      chat: [...st.chat, {
        id: `sys-standup-done-${Date.now()}`,
        at: Date.now(),
        from: 'system',
        text: `✅ Daily Standup (${date}) selesai untuk ${reports?.length || 0} karyawan. Semua kembali bekerja!`
      }].slice(-80)
    })
  })

  // ── Phase 7: Approvals & Real-World Integrations SSE Listeners ──
  on<{ id: string; toolName: string; riskLevel: string; title: string; employee?: any }>('approval.requested', (req) => {
    proceduralAudio.playChime('approval')
    const st = useOffice.getState()
    st.set({
      pendingApprovalsCount: st.pendingApprovalsCount + 1,
      chat: [...st.chat, {
        id: `sys-approval-req-${Date.now()}`,
        at: Date.now(),
        from: 'system',
        text: `🚨 PERMINTAAN OTORISASI: Agent [${req.employee?.name || 'AI'}] meminta izin mengeksekusi tool [${req.toolName}] (${req.riskLevel}). Periksa ikon lonceng!`
      }].slice(-80)
    })
  })

  on<{ id: string; toolName: string; status: string }>('approval.decided', (dec) => {
    fetchPendingApprovalsCount().then((count) => {
      useOffice.getState().set({ pendingApprovalsCount: count })
    }).catch(() => {})
    const st = useOffice.getState()
    st.set({
      chat: [...st.chat, {
        id: `sys-approval-dec-${Date.now()}`,
        at: Date.now(),
        from: 'system',
        text: `🛡️ Otorisasi [${dec.toolName}] telah ${dec.status === 'APPROVED' ? 'DISETUJUI ✅' : 'DITOLAK ❌'}.`
      }].slice(-80)
    })
  })

  on<{ source: string; event: string; description: string; actor: string }>('integration.event', (integ) => {
    const st = useOffice.getState()
    st.set({
      chat: [...st.chat, {
        id: `sys-integ-${Date.now()}`,
        at: Date.now(),
        from: 'system',
        text: `🐙 [GitHub] ${integ.description}`
      }].slice(-80)
    })
  })

  es.onerror = () => {
    // EventSource auto-reconnect; bila ditutup permanen (mis. 401) coba lagi pelan
    if (es?.readyState === EventSource.CLOSED) { closeStream(); retry = window.setTimeout(() => { if (useOffice.getState().entered) openStream() }, 5000) }
  }
}

export interface ApiMember {
  id: string
  userId: string
  companyId: string
  roleId: string | null
  isOwner: boolean
  user: { id: string; name: string; email: string; image?: string | null }
  role?: { id: string; name: string } | null
}

export async function listMembers(): Promise<ApiMember[]> {
  const res = await get<{ data: ApiMember[] }>('/system/memberships?limit=50')
  return res.data || []
}

export async function createMemberAccount(payload: {
  name?: string
  username?: string
  email?: string
  password: string
  roleId?: string
  permissions?: string[]
}) {
  return post('/system/memberships/create-account', payload)
}

export async function removeMember(userId: string) {
  return del(`/system/memberships/${userId}`)
}

export async function listCompanyRoles(): Promise<Array<{ id: string; name: string; description: string }>> {
  const res = await get<any>('/system/roles')
  return Array.isArray(res) ? res : (res?.data || [])
}

export async function getPermissionDefinitions(): Promise<Array<{ group: string; key: string; label: string; description: string }>> {
  const res = await get<{ success: boolean; data: Array<{ group: string; key: string; label: string; description: string }> }>('/system/role-permissions/definitions')
  return res.data || []
}

export interface ApiMcpServer {
  id: string
  companyId: string
  name: string
  description?: string | null
  transport: string
  url: string
  isEnabled: boolean
  toolsCache?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> | null
  lastSyncAt?: string | null
  createdAt: string
}

export async function listMcpServers(): Promise<ApiMcpServer[]> {
  const res = await get<ApiMcpServer[]>('/office/mcp')
  return Array.isArray(res) ? res : []
}

export async function createMcpServer(payload: {
  name: string
  url: string
  description?: string
  transport?: string
  headers?: Record<string, string>
}): Promise<ApiMcpServer> {
  return post('/office/mcp', payload)
}

export async function updateMcpServer(id: string, payload: Partial<{
  name: string
  url: string
  description: string
  isEnabled: boolean
}>): Promise<ApiMcpServer> {
  return patch(`/office/mcp/${id}`, payload)
}

export async function deleteMcpServer(id: string): Promise<{ success: boolean }> {
  return del(`/office/mcp/${id}`)
}

export async function syncMcpTools(id: string): Promise<{ success: boolean; toolsCount: number }> {
  return post(`/office/mcp/${id}/sync`, {})
}

export interface ApiAgentFile {
  id: string
  employeeId: string
  companyId: string
  path: string
  name: string
  content: string
  fileType: string
  isReadonly: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiContextStatus {
  employeeId: string
  sessionIndex: number
  totalTokensUsed: number
  maxContextTokens: number
  usagePercentage: number
  shouldReset: boolean
  statusLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  currentActiveTask: {
    id?: string
    title?: string
    status?: string
    progress?: number
  } | null
  recentAchievements: string[]
  pastMemoriesCount: number
  accumulatedSummaryPreview: string
}

export async function getAgentFiles(employeeId: string): Promise<ApiAgentFile[]> {
  const res = await get<ApiAgentFile[]>(`/office/workstation/files/${employeeId}`)
  return Array.isArray(res) ? res : []
}

export async function saveAgentFile(
  employeeId: string,
  path: string,
  content: string,
  name?: string,
): Promise<ApiAgentFile> {
  return post(`/office/workstation/files/${employeeId}`, { path, content, name })
}

export async function deleteAgentFile(employeeId: string, path: string): Promise<{ success: boolean }> {
  return del(`/office/workstation/files/${employeeId}?path=${encodeURIComponent(path)}`)
}

export async function getAgentContext(employeeId: string): Promise<ApiContextStatus> {
  return get<ApiContextStatus>(`/office/workstation/context/${employeeId}`)
}

export async function compactAgentContext(
  employeeId: string,
  reason?: string,
): Promise<{ success: boolean; message: string; newSessionIndex: number }> {
  return post(`/office/workstation/context/${employeeId}/compact`, { reason })
}

export interface SandboxResult {
  success: boolean
  stdout: string
  stderr: string
  error?: string
  executionTimeMs: number
}

export async function executeSandboxCode(
  language: 'javascript' | 'python',
  code: string,
): Promise<SandboxResult> {
  return post<SandboxResult>('/office/sandbox/execute', {
    language,
    code,
    timeoutMs: 5000,
  })
}
