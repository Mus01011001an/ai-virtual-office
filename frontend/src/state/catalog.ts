/**
 * Katalog AI (global, dikelola superadmin) + Otak Kantor (memori bersama per office).
 * Office tidak membuat persona AI sendiri — cukup "pakai" AI dari katalog.
 */
import { api, del, get, patch, post } from '../lib/api'
import type { Appearance } from './types'
import type { ProviderType, TestResult } from './remote'

export interface CatalogAgent {
  id: string; key: string; name: string; role: string; department: string; tagline: string
  skills: string[]; tools: string[]; appearance: Partial<Appearance>; model: string
  /** provider global aktif & model terisi */
  ready: boolean
  /** sudah dipakai di office ini */
  employeeId: string | null
}

export interface AgentTemplate {
  id: string; key: string; name: string; role: string; department: string; tagline: string
  skills: string[]; systemPrompt: string; tools: string[]; appearance: Partial<Appearance>
  providerId: string | null; model: string; isActive: boolean; sortOrder: number
  provider: { id: string; name: string } | null; usedBy: number
}
export type TemplateInput = Partial<Omit<AgentTemplate, 'id' | 'provider' | 'usedBy'>>

export interface GlobalProvider {
  id: string; name: string; type: ProviderType; baseUrl: string; apiKeyHint: string | null; models: string[]
  defaultModel: string | null; isActive: boolean; lastTestOk: boolean | null; lastTestMessage: string | null
}
export interface ProviderInput { name?: string; type?: ProviderType; baseUrl?: string; apiKey?: string; models?: string[]; defaultModel?: string; isActive?: boolean }

export interface HiggsfieldStatus {
  configured: boolean; source: 'admin' | 'env' | null; hint: string | null; updatedAt: string | null
  imageModel: string; videoModel: string; imageToVideoModel: string
}
export interface HiggsfieldInput { keyId?: string; keySecret?: string; imageModel?: string; videoModel?: string; imageToVideoModel?: string }

export type BrainKind = 'brief' | 'decision' | 'note' | 'result' | 'handoff' | 'asset'
export interface BrainEntry {
  id: string; companyId: string; employeeId: string | null; kind: BrainKind; title: string; content: string
  tags: string[]; pinned: boolean; createdAt: string; employee: { name: string; role: string } | null
}

// ---------- office ----------
export const fetchCatalog = () => get<CatalogAgent[]>('/office/agent-catalog')
export const hireAgent = (templateId: string) => post<{ id: string }>(`/office/agent-catalog/${templateId}/hire`)
export const dismissAgent = (employeeId: string) => del(`/office/employees/${employeeId}`)

// ---------- otak kantor ----------
export const fetchBrain = (p: { q?: string; kind?: string } = {}) => {
  const qs = new URLSearchParams()
  if (p.q) qs.set('q', p.q)
  if (p.kind) qs.set('kind', p.kind)
  return get<BrainEntry[]>(`/office/brain${qs.size ? `?${qs}` : ''}`)
}
export const addBrainNote = (b: { kind: 'brief' | 'decision' | 'note'; title: string; content: string; pinned?: boolean }) => post<BrainEntry>('/office/brain', b)
export const pinBrain = (id: string, pinned: boolean) => patch<BrainEntry>(`/office/brain/${id}`, { pinned })
export const deleteBrain = (id: string) => del(`/office/brain/${id}`)

// ---------- admin (superadmin) ----------
export const adminTemplates = () => get<AgentTemplate[]>('/admin/agent-templates')
export const adminTools = () => get<{ name: string; description: string }[]>('/admin/agent-templates/tools')
export const adminCreateTemplate = (b: TemplateInput) => post<AgentTemplate>('/admin/agent-templates', b)
export const adminUpdateTemplate = (id: string, b: TemplateInput) => patch<AgentTemplate & { synced: number }>(`/admin/agent-templates/${id}`, b)
export const adminRemoveTemplate = (id: string) => api<{ id: string }>('DELETE', `/admin/agent-templates/${id}`)

export const adminProviders = () => get<GlobalProvider[]>('/admin/ai-providers')
export const adminCreateProvider = (b: ProviderInput) => post<GlobalProvider>('/admin/ai-providers', b)
export const adminUpdateProvider = (id: string, b: ProviderInput) => patch<GlobalProvider>(`/admin/ai-providers/${id}`, b)
export const adminTestProvider = (id: string) => post<TestResult>(`/admin/ai-providers/${id}/test`)
export const adminRemoveProvider = (id: string) => del(`/admin/ai-providers/${id}`)

export const adminHiggsfield = () => get<HiggsfieldStatus>('/admin/integrations/higgsfield')
export const adminSaveHiggsfield = (b: HiggsfieldInput) => api<HiggsfieldStatus>('PUT', '/admin/integrations/higgsfield', b).then((r) => r.data)
export const adminTestHiggsfield = (b: HiggsfieldInput = {}) => post<{ ok: boolean; message: string; latencyMs?: number }>('/admin/integrations/higgsfield/test', b)

export const BRAIN_KIND_META: Record<BrainKind, { label: string; color: string }> = {
  brief: { label: 'Brief', color: '#f4a259' },
  decision: { label: 'Keputusan', color: '#7fd1b9' },
  note: { label: 'Catatan', color: '#9db4ff' },
  result: { label: 'Hasil', color: '#22c55e' },
  handoff: { label: 'Serah-terima', color: '#ec4899' },
  asset: { label: 'Aset', color: '#c084fc' },
}
