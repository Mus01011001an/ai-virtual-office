/**
 * Client API backend (pola frontend-admin Musyan): token sesi better-auth disimpan di localStorage
 * dan dikirim sebagai `Authorization: Bearer <token>`. Respons di-unwrap dari envelope
 * `{ status, success, message, data, meta }`.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8010/api/v1'
const TOKEN_KEY = 'avo-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ data: T; meta?: { total: number } }> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Server backend tidak bisa dihubungi. Pastikan backend jalan (npm run backend:dev).', 0)
  }
  let json: any = null
  try { json = await res.json() } catch { /* body kosong */ }
  if (!res.ok || json?.status === false || json?.success === false) {
    const msg = Array.isArray(json?.message) ? json.message.join(', ') : (json?.message ?? `HTTP ${res.status}`)
    if (res.status === 401 && token) onUnauthorized?.()
    throw new ApiError(msg, res.status)
  }
  return { data: json?.data as T, meta: json?.meta }
}

export const get = <T,>(p: string) => api<T>('GET', p).then((r) => r.data)
export const post = <T,>(p: string, b?: unknown) => api<T>('POST', p, b ?? {}).then((r) => r.data)
export const patch = <T,>(p: string, b: unknown) => api<T>('PATCH', p, b).then((r) => r.data)
export const del = <T,>(p: string) => api<T>('DELETE', p).then((r) => r.data)

/** EventSource tidak bisa set header → token lewat query (backend: SseTokenMiddleware). */
export const streamUrl = () => `${API_URL}/office/stream?token=${encodeURIComponent(getToken() ?? '')}`

// ── Workstation Inspection API (Phase 4) ──
export interface WorkstationTrace {
  id: string
  type: 'instruction' | 'ai_reply' | 'discussion' | 'tool_call' | 'tool_output' | 'system' | 'activity'
  role: 'user' | 'assistant' | 'tool' | 'system'
  senderName: string
  senderRole?: string
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface WorkstationArtifact {
  id: string
  companyId: string
  employeeId?: string | null
  taskId?: string | null
  name: string
  mimeType: string
  size: number
  s3Key: string
  url?: string | null
  downloadUrl?: string
  createdAt: string
  employee?: { id: string; name: string; role: string } | null
  task?: { id: string; title: string } | null
}

export interface WorkstationPerformance {
  tokens: { prompt: number; completion: number; total: number }
  cost: { usd: number; idr: number }
  latency: { avgDurationMs: number; totalInvocations: number }
  tasks: { total: number; completed: number; failed: number; executing: number; successRate: number }
  byModel: Array<{ model: string; totalTokens: number; cost: number; count: number }>
  recentRecords: Array<{
    id: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
    durationMs: number
    createdAt: string
    employee?: { name: string; role: string }
    task?: { title: string }
  }>
}

export const fetchConversationTraces = (employeeId: string, limit = 100) =>
  get<WorkstationTrace[]>(`/office/workstation/traces/${employeeId}?limit=${limit}`)

export const fetchArtifacts = (params?: { employeeId?: string; taskId?: string; q?: string }) => {
  const q = new URLSearchParams()
  if (params?.employeeId) q.set('employeeId', params.employeeId)
  if (params?.taskId) q.set('taskId', params.taskId)
  if (params?.q) q.set('q', params.q)
  const qs = q.toString()
  return get<WorkstationArtifact[]>(`/office/workstation/artifacts${qs ? `?${qs}` : ''}`)
}

export const fetchArtifactContent = (id: string) =>
  get<{ id: string; name: string; mimeType: string; size: number; content: string; downloadUrl: string }>(
    `/office/workstation/artifacts/${id}`,
  )

export const createArtifact = (dto: { employeeId?: string; taskId?: string; name: string; content: string }) =>
  post<WorkstationArtifact>('/office/workstation/artifacts', dto)

export const fetchPerformance = (employeeId?: string) =>
  get<WorkstationPerformance>(`/office/workstation/performance${employeeId ? `?employeeId=${employeeId}` : ''}`)

// ── Debate & 3D Meeting Whiteboard API (Phase 5) ──
export interface WhiteboardResponse {
  topic: string
  consensusScore: number
  points: Array<{ speaker: string; stance: string; text: string }>
  actionItems: Array<{ assigneeName: string; title: string; status?: string }>
  summary: string
}

export const startAutonomousDebate = (discussionId: string, topic: string, maxRounds = 3) =>
  post<{ discussionId: string; topic: string; status: string }>(
    `/office/discussions/${discussionId}/debate`,
    { topic, maxRounds, mode: 'AUTONOMOUS_DEBATE' },
  )

export const fetchWhiteboard = (discussionId: string) =>
  get<WhiteboardResponse>(`/office/discussions/${discussionId}/whiteboard`)

export const patchWhiteboard = (discussionId: string, data: Partial<WhiteboardResponse>) =>
  patch<WhiteboardResponse>(`/office/discussions/${discussionId}/whiteboard`, data)

export const concludeMeeting = (
  discussionId: string,
  dto: { generateTasks?: boolean; saveMoMToS3?: boolean } = { generateTasks: true, saveMoMToS3: true },
) =>
  post<{
    discussionId: string
    endedAt: string
    artifact?: { id: string; name: string; downloadUrl?: string }
    dispatchedTasks: Array<{ id: string; title: string }>
  }>(`/office/discussions/${discussionId}/conclude`, dto)

// ── Presence & Schedule API (Phase 6) ──
export const sendPresence = (pos: { x: number; y: number; z: number; yaw: number; anim?: 'idle' | 'walk' | 'run'; isSpeaking?: boolean }) =>
  post<{ onlineCount: number }>('/office/presence', pos)

export const fetchOnlineUsers = () =>
  get<Array<{ userId: string; name: string; role: string; x: number; y: number; z: number; yaw: number; anim: 'idle' | 'walk' | 'run'; lastSeen: number }>>(
    '/office/presence/online',
  )

export const leavePresence = () =>
  post<{ success: boolean }>('/office/presence/leave')

export const fetchSchedule = () =>
  get<any>('/office/schedule')

export const patchSchedule = (dto: any) =>
  patch<any>('/office/schedule', dto)

export const fastForwardSchedule = (clock: string) =>
  post<any>('/office/schedule/fast-forward', { clock })

export const triggerStandupNow = () =>
  post<any>('/office/schedule/standup/trigger')

export const fetchLatestStandup = () =>
  get<any>('/office/schedule/standup/latest')

export const fetchStandupHistory = (limit = 10) =>
  get<any[]>(`/office/schedule/standup/history?limit=${limit}`)

// ── Approvals & Integrations API (Phase 7) ──
import type { ApprovalRequestData, WebhookConfigData } from '../state/types'

export const fetchApprovals = (status?: string) =>
  get<ApprovalRequestData[]>(`/office/approvals${status ? `?status=${status}` : ''}`)

export const fetchPendingApprovalsCount = () =>
  get<{ count: number }>('/office/approvals/count').then((r) => r.count)

export const approveRequest = (id: string, note?: string) =>
  post<ApprovalRequestData>(`/office/approvals/${id}/approve`, { note })

export const rejectRequest = (id: string, note?: string) =>
  post<ApprovalRequestData>(`/office/approvals/${id}/reject`, { note })

export const fetchWebhooks = () =>
  get<WebhookConfigData[]>('/office/integrations/webhooks')

export const createWebhook = (data: Partial<WebhookConfigData>) =>
  post<WebhookConfigData>('/office/integrations/webhooks', data)

export const deleteWebhook = (id: string) =>
  del<{ success: boolean }>(`/office/integrations/webhooks/${id}`)

export const testWebhook = (id: string) =>
  post<{ success: boolean; message: string }>(`/office/integrations/webhooks/${id}/test`)

export const executeSandboxCode = (data: { language: 'javascript' | 'typescript' | 'python'; code: string; inputPayload?: Record<string, unknown> }) =>
  post<{ success: boolean; stdout: string; stderr: string; executionTimeMs: number; exitCode: number; timedOut: boolean }>('/office/sandbox/execute', data)

// ── Voice & Spatial Audio API (Phase 8) ──
export const fetchVoiceProfiles = () =>
  get<Array<{ employeeId: string; name: string; role: string; department: string; profile: any }>>('/office/voice/profiles')

export const updateVoiceProfile = (employeeId: string, data: { pitch?: number; rate?: number; gender?: string; preferredVoice?: string }) =>
  patch<{ id: string; name: string; voiceProfile: any }>(`/office/voice/profiles/${employeeId}`, data)




