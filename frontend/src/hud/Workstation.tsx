import { useEffect, useRef, useState } from 'react'
import { useOffice } from '../state/store'
import { STATUS_META } from '../state/types'
import { Avatar, DemoBadge, Modal, StatusPill, fmtTime } from './ui'
import { AiConversationTab } from './workstation/AiConversationTab'
import { FilesTab } from './workstation/FilesTab'
import { PerformanceTab } from './workstation/PerformanceTab'
import { AgentBrainStudioTab } from './workstation/AgentBrainStudioTab'
import { ContextMemoryTab } from './workstation/ContextMemoryTab'

const TABS = ['Overview', 'Brain Studio', 'Context & Memory', 'AI Conversation', 'Tasks', 'Files', 'Terminal', 'Activity', 'Performance'] as const
type Tab = (typeof TABS)[number]

export function Workstation() {
  const id = useOffice((s) => s.workstationId)
  const e = useOffice((s) => s.employees.find((x) => x.id === id))
  const acts = useOffice((s) => (id ? s.activity[id] : undefined)) ?? []
  const tasks = useOffice((s) => s.tasks).filter((t) => t.employeeId === id)
  const set = useOffice((s) => s.set)
  const [tab, setTab] = useState<Tab>('Overview')
  const term = useRef<HTMLDivElement>(null)
  useEffect(() => { term.current?.scrollTo(0, term.current.scrollHeight) }, [acts.length, tab])
  if (!e) return null
  const close = () => set({ workstationId: null })

  return (
    <Modal title={`Workstation · ${e.name}`} onClose={close} wide>
      <div className="flex flex-col md:flex-row h-[min(620px,calc(100dvh-120px))]">
        <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-line p-1.5 md:p-2 gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 md:w-full rounded-xl px-3 py-2 text-left text-[12.5px] sm:text-[13px] font-semibold transition-colors ${
                tab === t ? 'bg-white/[0.08] text-bone' : 'text-bone/50 hover:bg-white/[0.04] hover:text-bone/80'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-3 sm:p-5 overflow-y-auto">
          {e.isDemo && <div className="mb-4 flex items-center gap-2 rounded-2xl bg-demo/10 px-3 py-2 text-xs text-demo"><DemoBadge /> Employee demo — aktivitas di bawah adalah simulasi Demo Mode, bukan eksekusi AI nyata.</div>}
          {tab === 'Overview' && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <Avatar color={e.appearance.top} name={e.name} size={64} />
                <div>
                  <div className="display text-[24px] leading-none">{e.name}</div>
                  <div className="mt-1 text-bone/60">{e.role} · {e.department}</div>
                  <div className="mt-1"><StatusPill s={e.status} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[['Provider', e.provider], ['Model', e.model], ['Meja', `#${e.deskIndex + 1}`], ['Task saat ini', e.currentTask ?? '—'], ['Tool', e.currentTool ?? '—'], ['Progress', `${Math.round(e.progress * 100)}%`]].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-white/[0.05] p-3"><div className="label">{k}</div><div className="mt-0.5 truncate font-medium">{v}</div></div>
                ))}
              </div>
              <div><div className="label mb-1.5">Skills</div><div className="flex flex-wrap gap-1.5">{e.skills.map((s) => <span key={s} className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs text-bone/80">{s}</span>)}</div></div>
              <div><div className="label mb-1.5">System instructions</div><div className="rounded-2xl border border-line bg-black/30 p-3 font-mono text-xs text-bone/75">{e.systemPrompt || '—'}</div></div>
            </div>
          )}
          {tab === 'Terminal' && (
            <div ref={term} className="h-full min-h-[260px] max-h-[460px] overflow-y-auto rounded-2xl border border-line bg-black/60 p-4 font-mono text-[12px] leading-relaxed">
              {acts.filter((a) => a.kind === 'tool' || a.kind === 'output' || a.kind === 'error').map((a) => (
                <div key={a.id} className={a.kind === 'tool' ? 'mt-2 text-cyan-300' : a.kind === 'error' ? 'text-red-300' : 'whitespace-pre text-emerald-100/85'}>{a.text}</div>
              ))}
              {!acts.some((a) => a.kind === 'tool') && <div className="text-bone/35">Belum ada eksekusi tool.</div>}
            </div>
          )}
          {tab === 'Activity' && (
            <div className="space-y-1.5 font-mono text-xs">
              {[...acts].reverse().map((a) => (
                <div key={a.id} className="flex gap-3 px-2 py-1 hover:bg-white/[0.04]">
                  <span className="text-bone/35">{fmtTime(a.at)}</span><span className="w-20 shrink-0 text-bone/40">{a.kind}</span><span className="text-bone/85">{a.text}</span>
                </div>
              ))}
              {!acts.length && <div className="text-bone/35">Belum ada aktivitas.</div>}
            </div>
          )}
          {tab === 'Tasks' && (
            <div className="space-y-2 text-sm">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-2.5">
                  <div><div className="font-medium">{t.title}</div><div className="text-[11px] text-bone/45">{fmtTime(t.createdAt)}{t.finishedAt ? ` → ${fmtTime(t.finishedAt)}` : ''}</div></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t.status === 'COMPLETED' ? 'bg-emerald-400/15 text-emerald-300' : t.status === 'EXECUTING' ? 'bg-sky-400/15 text-sky-300' : t.status === 'FAILED' ? 'bg-red-400/15 text-red-300' : 'bg-white/10 text-white/70'}`}>{t.status}</span>
                </div>
              ))}
              {!tasks.length && <div className="text-bone/35">Belum ada task.</div>}
            </div>
          )}
          {tab === 'Brain Studio' && <AgentBrainStudioTab employeeId={e.id} />}
          {tab === 'Context & Memory' && <ContextMemoryTab employeeId={e.id} />}
          {tab === 'AI Conversation' && <AiConversationTab employeeId={e.id} employeeName={e.name} isDemo={e.isDemo} />}
          {tab === 'Files' && <FilesTab employeeId={e.id} employeeName={e.name} />}
          {tab === 'Performance' && <PerformanceTab employeeId={e.id} employeeName={e.name} />}
          <div className="mt-4 text-[11px]" style={{ color: STATUS_META[e.status].color }}>● {STATUS_META[e.status].label}</div>
        </div>
      </div>
    </Modal>
  )
}
