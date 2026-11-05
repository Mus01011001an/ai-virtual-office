import { useEffect, useRef, useState } from 'react'
import { useOffice, currentOffice } from '../state/store'
import { officeNow, scheduleState } from '../lib/time'
import { DemoBadge, IconBtn, Segmented } from './ui'
import { toggleGatherAll } from '../state/gather'
import { archiveCurrentOffice, enterOffice } from '../state/remote'
import type { CameraMode } from '../state/types'

const MODES: { id: CameraMode; label: string; title: string }[] = [
  { id: 'fps', label: 'Mata', title: 'First-person (1)' },
  { id: 'tps', label: 'Bahu', title: 'Third-person, mouse-look (2)' },
  { id: 'iso', label: 'Atas', title: 'Isometric overview (3)' },
]

function Clock() {
  const tz = useOffice((s) => s.offices.find((o) => o.id === s.currentOfficeId)?.timezone ?? 'UTC')
  const [t, setT] = useState(() => officeNow(tz))
  useEffect(() => { const id = setInterval(() => setT(officeNow(tz)), 1000); return () => clearInterval(id) }, [tz])
  const s = scheduleState(t)
  const p = (n: number) => String(n).padStart(2, '0')
  const color = s.kind === 'work' ? '#22c55e' : s.kind === 'break' ? '#fb923c' : '#71717a'
  return (
    <div className="panel-soft flex items-center gap-3 rounded-full py-1.5 pl-4 pr-5" title={`${s.next} · ${tz}`}>
      <div className="display text-[22px] leading-none tabular-nums text-bone">{p(t.h)}:{p(t.m)}</div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-bone/90"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{s.label}</div>
        <div className="text-[10px] text-bone/45">{s.next}</div>
      </div>
    </div>
  )
}

function OfficeSwitcher() {
  const st = useOffice()
  const office = currentOffice()
  if (!office) return null
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const demo = st.employees.some((e) => e.isDemo)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="panel-soft flex h-12 items-center gap-3 rounded-full pl-1.5 pr-4 hover:bg-ink-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#e76f51] text-[15px]">🏢</div>
        <div className="text-left">
          <div className="label leading-none">Kantor</div>
          <div className="display mt-0.5 flex items-center gap-1.5 text-[15px] leading-none text-bone">{office.name}<span className="text-xs text-bone/40">▾</span></div>
        </div>
        {demo && <DemoBadge />}
      </button>
      {open && (
        <div className="panel rise absolute left-0 top-[56px] w-72 p-1.5 text-bone">
          {st.offices.map((o) => (
            <div key={o.id} className={`group flex items-center rounded-xl ${o.id === office.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
              <button className="flex-1 px-3 py-2 text-left" onClick={() => { setOpen(false); if (o.id !== office.id) void enterOffice(o.id).catch((e) => alert(e.message)) }}>
                <div className="text-[13px] font-medium">{o.name}</div>
                <div className="text-[11px] text-bone/45">{o.role ?? '—'} · {o.template === 'demo-team' ? 'tim demo' : `${o.employeeCount ?? 0} employee`} · {o.timezone}</div>
              </button>
              {o.id === office.id && o.isOwner && (
                <button className="mr-2 hidden rounded-full px-2 py-0.5 text-[11px] text-red-300/80 hover:bg-red-400/10 group-hover:block"
                  onClick={() => { if (confirm(`Arsipkan office "${o.name}"? Bisa dipulihkan lagi nanti.`)) void archiveCurrentOffice().catch((e) => alert(e.message)) }}>Arsipkan</button>
              )}
            </div>
          ))}
          <button className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-accent hover:bg-white/[0.05]"
            onClick={() => { setOpen(false); st.set({ newOfficeOpen: true }) }}>+ Sesi Baru</button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const mode = useOffice((s) => s.cameraMode)
  const count = useOffice((s) => s.employees.length)
  const dirOpen = useOffice((s) => s.directoryOpen)
  const setOpen = useOffice((s) => s.settingsOpen)
  const set = useOffice((s) => s.set)
  const gathered = useOffice((s) => s.summoned.length)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto"><OfficeSwitcher /></div>
      <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2"><Clock /></div>
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="panel-soft w-[186px] rounded-full p-0.5">
          <Segmented value={mode} options={MODES} onChange={(m) => set({ cameraMode: m })} />
        </div>
        <button onClick={toggleGatherAll} title="Semua employee datang ke kamu & mendengarkan (G)"
          className={`flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] font-semibold shadow-lg transition-colors ${gathered ? 'bg-bone text-ink hover:bg-white' : 'bg-accent text-ink hover:bg-accent-2'}`}>
          <span>{gathered ? '👋' : '📣'}</span>{gathered ? `Bubarkan (${gathered})` : 'Kumpulkan tim'}
        </button>
        <div className="panel-soft flex items-center gap-0.5 rounded-full p-0.5">
          <button onClick={() => set({ directoryOpen: !dirOpen })} title="Tab"
            className={`flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] font-semibold ${dirOpen ? 'bg-bone text-ink' : 'text-bone/80 hover:bg-white/[0.08]'}`}>
            Tim <span className={`rounded-full px-1.5 text-[11px] ${dirOpen ? 'bg-ink/10 text-ink/70' : 'bg-accent/20 text-accent'}`}>{count}</span>
          </button>
          <IconBtn title="Pengaturan" active={setOpen} onClick={() => set({ settingsOpen: !setOpen })}>⚙</IconBtn>
        </div>
      </div>
    </div>
  )
}
