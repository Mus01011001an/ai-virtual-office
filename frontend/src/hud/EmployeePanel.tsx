import { useState, useEffect, useRef } from 'react'
import { useOffice } from '../state/store'
import { Avatar, Btn, CloseBtn, DemoBadge, StatusPill, fmtTime, inputCls } from './ui'
import { toggleSummon } from '../state/gather'
import { assignTask, instruct } from '../state/remote'

const KIND_CLS: Record<string, string> = {
  tool: 'text-cyan-300', output: 'text-emerald-200/80', warn: 'text-amber-300', done: 'text-emerald-300', instruction: 'text-accent-2', error: 'text-red-300',
}

export function EmployeePanel() {
  const id = useOffice((s) => s.selectedId)
  const e = useOffice((s) => s.employees.find((x) => x.id === id))
  const acts = useOffice((s) => (id ? s.activity[id] : undefined))
  const tasks = useOffice((s) => s.tasks)
  const set = useOffice((s) => s.set)
  const summoned = useOffice((s) => !!id && s.summoned.includes(id))
  const [text, setText] = useState('')
  const [asTask, setAsTask] = useState(true)
  const [err, setErr] = useState('')
  const activityScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activityScrollRef.current) {
      activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight
    }
  }, [acts?.length])

  if (!e) return null
  const st = useOffice.getState()
  const done = tasks.filter((t) => t.employeeId === e.id && t.status === 'COMPLETED').length

  const submit = async () => {
    const v = text.trim()
    if (!v) return
    setErr('')
    if (e.isDemo) {
      // employee DEMO: simulasi lokal (demoEngine)
      if (asTask) { st.addTask({ employeeId: e.id, title: v, status: 'QUEUED', isDemo: true }); st.pushActivity(e.id, 'instruction', `CEO assign task: ${v}`) }
      else st.pushActivity(e.id, 'instruction', `Instruksi CEO: ${v}`)
      return setText('')
    }
    try {
      if (asTask) await assignTask(e.id, v)
      else await instruct(e.id, v)
      setText('') // aktivitas masuk lewat SSE
    } catch (ex) { setErr((ex as Error).message) }
  }

  return (
    <div className="panel rise pointer-events-auto fixed sm:absolute right-3 top-[56px] sm:top-[68px] z-30 flex max-h-[calc(100dvh-130px)] w-[min(340px,calc(100vw-24px))] flex-col text-bone shadow-2xl">
      <div className="relative flex items-center gap-3 border-b border-line p-4">
                <Avatar color={e.appearance.top} name={e.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="display truncate text-[17px] leading-none">{e.name}</span>{e.isDemo && <DemoBadge />}</div>
          <div className="mt-1 truncate text-[11px] text-bone/55">{e.role} · {e.department}</div>
          <div className="mt-1"><StatusPill s={e.status} /></div>
        </div>
        <CloseBtn onClick={() => set({ selectedId: null })} />
      </div>

      <div className="space-y-4 overflow-y-auto p-4 text-xs">
        <div>
          <div className="label mb-1">Task saat ini</div>
          <div className="text-[13px] font-medium">{e.currentTask ?? '—'}</div>
          {e.currentTool && <div className="mt-1 truncate font-mono text-[11px] text-cyan-300">$ {e.currentTool}</div>}
          {e.progress > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-mint transition-all" style={{ width: `${e.progress * 100}%` }} /></div>}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[['Model', e.model || 'belum dipilih'], ['Provider', e.provider || '—'], ['Selesai', `${done} task`]].map(([k, v]) => (
            <div key={k} title={v} className="rounded-xl bg-white/[0.05] p-2"><div className="label">{k}</div><div className="mt-0.5 truncate text-[12px] font-medium">{v}</div></div>
          ))}
        </div>

        {e.skills.length > 0 && <div className="flex flex-wrap gap-1">{e.skills.map((s) => <span key={s} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-bone/75">{s}</span>)}</div>}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label">Aktivitas Terkini</span>
            <span className="text-[10px] text-bone/40 font-mono">Terbaru di Bawah ↓</span>
          </div>
          <div
            ref={activityScrollRef}
            className="space-y-1.5 font-mono text-[11px] leading-snug max-h-[145px] overflow-y-auto pr-1 rounded-xl bg-black/25 p-2.5 border border-white/[0.05]"
          >
            {(acts ?? []).slice(-12).map((a) => (
              <div key={a.id} className="flex gap-2 items-start py-0.5 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] px-1 rounded transition-colors">
                <span className="shrink-0 text-bone/35 text-[10px] mt-0.5">{fmtTime(a.at)}</span>
                <span className={`${KIND_CLS[a.kind] ?? 'text-bone/75'} break-words flex-1`}>{a.text}</span>
              </div>
            ))}
            {!acts?.length && <div className="text-bone/35 py-3 text-center text-xs">Belum ada aktivitas terekam hari ini.</div>}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-line p-3">
        <div className="flex text-[11px]">
          {([[true, 'Task'], [false, 'Instruksi']] as const).map(([v, l]) => (
            <button key={l} onClick={() => setAsTask(v)} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${asTask === v ? 'bg-white/[0.1] text-bone' : 'text-bone/45 hover:text-bone/80'}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            className={inputCls}
            placeholder={asTask ? 'Assign task baru…' : 'Kirim instruksi…'}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            onKeyDown={(ev) => {
              ev.stopPropagation()
              if (ev.key === 'Enter') submit()
            }}
            onKeyUp={(ev) => ev.stopPropagation()}
          />
          <Btn variant="primary" className="h-auto" onClick={submit}>Kirim</Btn>
        </div>
        <div className="flex gap-1.5">
          <Btn variant={summoned ? 'solid' : 'primary'} className="flex-1" onClick={() => toggleSummon(e.id)}>
            {e.status === 'OFFLINE' ? 'Sedang offline' : summoned ? 'Lepas' : 'Panggil ke saya'} <kbd className="bg-black/20">Q</kbd>
          </Btn>
          <Btn variant="light" className="flex-1" onClick={() => set({ workstationId: e.id })}>Workstation <kbd className="bg-ink/15 text-ink">F</kbd></Btn>
        </div>
        {err && <div className="rounded-xl bg-red-400/10 px-3 py-1.5 text-[11px] text-red-300">{err}</div>}
        <div className="text-center text-[10px] text-bone/35">
          {e.isDemo ? 'Aktivitas employee DEMO adalah simulasi' : 'Tersimpan di server · eksekusi AI nyata aktif di Phase 3'}
        </div>
      </div>
    </div>
  )
}
