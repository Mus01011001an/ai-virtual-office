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

/** Pesan di panel diskusi. from = 'me' (CEO), 'system', atau id employee. */
export interface ChatMsg { id: string; at: number; from: string; text: string; demo?: boolean }
