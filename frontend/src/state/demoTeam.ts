import type { Employee } from './types'
import { appearanceFromSeed } from '../lib/appearance'

/** DATA DEMO — bukan employee produksi. Selalu ditandai isDemo=true dan badge "DEMO" di UI. */
const TEAM: Array<Pick<Employee, 'name' | 'role' | 'department' | 'provider' | 'model' | 'skills'> & { desk: number; offline?: boolean }> = [
  { name: 'Alex', role: 'Senior DevOps Engineer', department: 'Infrastructure', provider: 'Anthropic', model: 'Claude Sonnet', skills: ['Docker', 'Linux', 'Kubernetes', 'Nginx', 'PostgreSQL', 'Cloudflare', 'CI/CD'], desk: 0 },
  { name: 'Sarah', role: 'Frontend Engineer', department: 'Product Engineering', provider: 'Google', model: 'Gemini Pro', skills: ['React', 'Next.js', 'TailwindCSS', 'Accessibility'], desk: 1 },
  { name: 'David', role: 'Backend Engineer', department: 'Product Engineering', provider: 'DeepSeek', model: 'DeepSeek Chat', skills: ['Node.js', 'NestJS', 'Prisma', 'Redis', 'REST API'], desk: 2 },
  { name: 'Michael', role: 'QA Engineer', department: 'Quality', provider: 'OpenRouter', model: 'openrouter/auto', skills: ['E2E Testing', 'Regression', 'Bug Investigation'], desk: 3 },
  { name: 'Nadia', role: 'Project Manager', department: 'Delivery', provider: 'Anthropic', model: 'Claude Opus', skills: ['Project Planning', 'Task Decomposition'], desk: 4 },
  { name: 'Raka', role: 'Code Reviewer', department: 'Quality', provider: 'OpenAI', model: 'GPT', skills: ['Code Review', 'Security Auditing'], desk: 5 },
  { name: 'Putri', role: 'Data Analyst', department: 'Analytics', provider: 'Google', model: 'Gemini Flash', skills: ['PostgreSQL', 'Web Research', 'Documentation'], desk: 6 },
  { name: 'Bima', role: 'Security Engineer', department: 'Infrastructure', provider: 'Anthropic', model: 'Claude Sonnet', skills: ['Security Auditing', 'Incident Response', 'Linux'], desk: 7 },
  { name: 'Laras', role: 'Technical Writer', department: 'Delivery', provider: 'Anthropic', model: 'Claude Haiku', skills: ['Technical Writing', 'Documentation'], desk: 8 },
  { name: 'Kevin', role: 'Mobile Engineer', department: 'Product Engineering', provider: 'OpenAI', model: 'GPT', skills: ['React Native', 'TypeScript'], desk: 12 },
  { name: 'Dewi', role: 'UI/UX Designer', department: 'Design', provider: 'Google', model: 'Gemini Pro', skills: ['UI/UX Implementation', 'Accessibility'], desk: 13 },
  { name: 'Yusuf', role: 'Site Reliability Engineer', department: 'Infrastructure', provider: 'DeepSeek', model: 'DeepSeek Reasoner', skills: ['Server Monitoring', 'Incident Response', 'Docker'], desk: 14, offline: true },
]

export function createDemoTeam(officeId: string): Employee[] {
  return TEAM.map((t, i) => ({
    id: `demo-${officeId}-${i}`,
    officeId,
    name: t.name, role: t.role, department: t.department, provider: t.provider, model: t.model, skills: t.skills,
    systemPrompt: `You are ${t.name}, a ${t.role}.`,
    deskIndex: t.desk,
    status: t.offline ? 'OFFLINE' : 'IDLE',
    slot: null, currentTask: null, currentTool: null, progress: 0,
    appearance: appearanceFromSeed(`${t.name}-${i}`),
    isDemo: true,
    createdAt: Date.now(),
  }))
}
