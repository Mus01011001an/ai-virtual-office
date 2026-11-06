export type EmployeeStatus =
  | 'IDLE' | 'WORKING' | 'THINKING' | 'TOOL_EXECUTING' | 'WAITING'
  | 'ON_BREAK' | 'IN_MEETING' | 'COLLABORATING' | 'OFFLINE'

export const STATUS_META: Record<EmployeeStatus, { label: string; color: string }> = {
  IDLE: { label: 'Idle', color: '#94a3b8' },
  WORKING: { label: 'Working', color: '#22c55e' },
  THINKING: { label: 'Thinking', color: '#a855f7' },
  TOOL_EXECUTING: { label: 'Running tool', color: '#06b6d4' },
  WAITING: { label: 'Waiting', color: '#f59e0b' },
  ON_BREAK: { label: 'On break', color: '#fb923c' },
  IN_MEETING: { label: 'In meeting', color: '#3b82f6' },
  COLLABORATING: { label: 'Collaborating', color: '#ec4899' },
  OFFLINE: { label: 'Offline', color: '#52525b' },
}

export interface Appearance {
  skin: string; hair: string; hairStyle: 0 | 1 | 2 | 3
  top: string; bottom: string; shoes: string
  height: number; glasses: boolean; jacket: boolean
}

export type SlotZone = 'break' | 'meeting' | 'collab'

export interface Employee {
  id: string
  officeId: string
  name: string
  role: string
  department: string
  provider: string
  /** AiProvider di backend (null = belum memilih model) */
  providerId?: string | null
  model: string
  skills: string[]
  systemPrompt: string
  deskIndex: number
  status: EmployeeStatus
  slot: number | null
  currentTask: string | null
  currentTool: string | null
  progress: number
  appearance: Appearance
  voiceProfile?: {
    pitch?: number
    rate?: number
    gender?: 'male' | 'female' | 'neutral'
    preferredVoice?: string
  }
  /** true = data simulasi Demo Mode, bukan eksekusi nyata */
  isDemo: boolean
  createdAt: number
}

export type ActivityKind = 'status' | 'info' | 'tool' | 'output' | 'ai' | 'warn' | 'error' | 'instruction' | 'done'

export interface ActivityEvent { id: string; at: number; kind: ActivityKind; text: string }

export type TaskStatus = 'QUEUED' | 'EXECUTING' | 'COMPLETED' | 'FAILED'
export interface TaskItem {
  id: string; employeeId: string; title: string; status: TaskStatus
  createdAt: number; finishedAt?: number; isDemo: boolean
}

export interface Office {
  id: string; name: string; template: 'demo-team' | 'empty'
  timezone: string; createdAt: number
  employeeCount?: number
  role?: string | null
  isOwner?: boolean
  voiceRadius?: number
  voiceProximityEnabled?: boolean
}

/** User login + konteks office aktif (hasil customSession backend). */
export interface Me {
  id: string; name: string; email: string
  isSuperAdmin: boolean
  mustChangePassword: boolean
  activeCompanyId: string | null
  activeRole: { id: string; name: string; permissions: string[] } | null
}

export type CameraMode = 'fps' | 'tps' | 'iso'

export type Quality = 'low' | 'medium' | 'high'
export type Ambience = 'night' | 'day' | 'auto'

export type MessageStance = 'PROPOSE' | 'CRITIQUE' | 'SUPPORT' | 'SYNTHESIZE' | 'QUESTION' | 'NEUTRAL'

export interface WhiteboardPoint {
  speaker: string
  stance: MessageStance | string
  text: string
}

export interface WhiteboardActionItem {
  assigneeName: string
  title: string
  status?: string
}

export interface WhiteboardState {
  topic: string
  consensusScore: number
  points: WhiteboardPoint[]
  actionItems: WhiteboardActionItem[]
  summary: string
}

/** Pesan di panel diskusi. from = 'me' (CEO), 'system', atau id employee. */
export interface ChatMsg {
  id: string
  at: number
  from: string
  text: string
  stance?: MessageStance | string
  demo?: boolean
}

// ----------------- PHASE 6: PRESENCE & SCHEDULE -----------------
export interface RemoteUserData {
  userId: string
  name: string
  role: string
  x: number
  y: number
  z: number
  yaw: number
  anim: 'idle' | 'walk' | 'run'
  isSpeaking?: boolean
  lastSeen?: number
}

export interface ShiftState {
  kind: 'work' | 'break' | 'closed'
  label: string
  nextEvent: string
  currentBreakName?: string
}

export interface OfficeSchedule {
  id?: string
  companyId?: string
  timezone: string
  workStart: string
  workEnd: string
  workdays: number[]
  breaks: Array<{ name: string; start: string; end: string }>
  standupTime: string
  autoStandupEnabled: boolean
  proactiveEnabled: boolean
  clock: string
  currentShift: ShiftState
}

export interface StandupReportData {
  id: string
  companyId: string
  date: string
  summary: string
  attendees: string[]
  reports: Array<{
    employeeId: string
    name: string
    yesterday: string
    today: string
    blockers: string
  }>
  createdAt: string
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type ApprovalRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type WebhookChannel = 'TELEGRAM' | 'DISCORD' | 'SLACK' | 'GENERIC_HTTP'

export interface ApprovalRequestData {
  id: string
  companyId: string
  taskId?: string | null
  employeeId?: string | null
  toolName: string
  riskLevel: ApprovalRiskLevel
  status: ApprovalStatus
  title: string
  description?: string | null
  inputPayload: Record<string, unknown>
  outputResult?: Record<string, unknown> | null
  reviewerId?: string | null
  reviewNote?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt?: string
  task?: { id: string; title: string; status: string } | null
  employee?: { id: string; name: string; role: string } | null
}

export interface WebhookConfigData {
  id: string
  companyId: string
  channel: WebhookChannel
  name: string
  url: string
  secret?: string | null
  events: string[]
  isActive: boolean
  metadata?: Record<string, unknown>
  createdById?: string | null
  createdAt: string
  updatedAt?: string
}

export interface GithubIntegrationEvent {
  source: string
  event: string
  actor: string
  description: string
  timestamp: string
}

