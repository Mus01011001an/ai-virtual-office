/**
 * Jembatan frontend ↔ backend. Semua data office/employee nyata lewat sini.
 * Realtime: SSE `office/stream` → menulis field Employee yang sama (status/slot/currentTask/…),
 * sehingga layer 3D tidak perlu tahu sumber datanya.
 */
import { del, get, getToken, patch, post, setToken, setUnauthorizedHandler, streamUrl } from '../lib/api'
import { appearanceFromSeed } from '../lib/appearance'
import { DESKS } from '../office/layout'
import { useOffice } from './store'
import type { ActivityKind, Appearance, Employee, Me, Office, TaskItem } from './types'

// ---------- tipe respons backend ----------
interface ApiWorkspace { companyId: string; name: string; template: 'EMPTY' | 'DEMO_TEAM'; timezone: string; employeeCount: number; role: { name: string } | null; isOwner: boolean }
export interface ApiEmployee {
  id: string; name: string; role: string; department: string; provider: string; providerId: string | null; model: string
  skills: string[]; systemPrompt: string; deskIndex: number; appearance: Partial<Appearance>; status: Employee['status']
  slot: number | null; currentTask: string | null; currentTool: string | null; progress: number; isDemo: boolean; createdAt: string
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

export function toEmployee(e: ApiEmployee, officeId: string): Employee {
  const hasLook = e.appearance && typeof e.appearance === 'object' && 'skin' in e.appearance
  return {
    id: e.id, officeId, name: e.name, role: e.role, department: e.department, provider: e.provider, providerId: e.providerId,
    model: e.model, skills: e.skills, systemPrompt: e.systemPrompt, deskIndex: e.deskIndex, status: e.status, slot: e.slot,
    currentTask: e.currentTask, currentTool: e.currentTool, progress: e.progress,
    appearance: hasLook ? (e.appearance as Appearance) : appearanceFromSeed(e.id),
    isDemo: false, createdAt: Date.parse(e.createdAt),
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

export async function signIn(email: string, password: string) {
  const r = await post<{ token: string }>('/auth/signin', { email, password })
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

export async function createOffice(name: string, template: 'empty' | 'demo-team', timezone: string) {
  const o = await post<{ id: string }>('/system/companies', { name, template: template === 'demo-team' ? 'DEMO_TEAM' : 'EMPTY', timezone })
  await loadWorkspaces()
  await enterOffice(o.id)
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
  return upsertEmployee(emp)
}

export async function updateEmployee(id: string, p: Partial<{ name: string; role: string; department: string; providerId: string; model: string; skills: string[]; systemPrompt: string }>) {
  return upsertEmployee(await patch<ApiEmployee>(`/office/employees/${id}`, p))
}

export async function assignTask(employeeId: string, title: string, source: 'panel' | 'discussion' = 'panel') {
  const t = await post<ApiTask>(`/office/employees/${employeeId}/tasks`, { title, source })
  upsertTask(toTask(t))
}

export const instruct = (employeeId: string, text: string) => post(`/office/employees/${employeeId}/instructions`, { text })

function upsertEmployee(e: ApiEmployee) {
  const st = useOffice.getState()
  const mapped = toEmployee(e, st.currentOfficeId)
  const exists = st.employees.some((x) => x.id === e.id)
  // jangan timpa tampilan & status lokal "dipanggil" untuk employee yang sudah ada
  st.set({ employees: exists ? st.employees.map((x) => (x.id === e.id ? { ...x, ...mapped, appearance: x.appearance } : x)) : [...st.employees, mapped] })
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

// ---------- realtime (SSE) ----------
let es: EventSource | null = null
let retry: number | undefined

export function closeStream() {
  window.clearTimeout(retry)
  es?.close(); es = null
}

function openStream() {
  closeStream()
  if (!getToken()) return
  es = new EventSource(streamUrl())
  const on = <T,>(type: string, fn: (d: T) => void) => es!.addEventListener(type, (ev) => { try { fn(JSON.parse((ev as MessageEvent).data)) } catch { /* abaikan */ } })
  on<ApiEmployee>('employee.created', (e) => upsertEmployee(e))
  on<ApiEmployee>('employee.updated', (e) => upsertEmployee(e))
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
  on<{ task: ApiTask }>('task.event', ({ task }) => upsertTask(toTask(task)))
  es.onerror = () => {
    // EventSource auto-reconnect; bila ditutup permanen (mis. 401) coba lagi pelan
    if (es?.readyState === EventSource.CLOSED) { closeStream(); retry = window.setTimeout(() => { if (useOffice.getState().entered) openStream() }, 5000) }
  }
}
