import { can, useOffice } from '../state/store'
import { STATUS_META } from '../state/types'
import { Avatar, Btn, CloseBtn, PanelHead } from './ui'
import { toggleSummon } from '../state/gather'

export function Directory() {
  const open = useOffice((s) => s.directoryOpen)
  const employees = useOffice((s) => s.employees)
  const selectedId = useOffice((s) => s.selectedId)
  const set = useOffice((s) => s.set)
  const summoned = useOffice((s) => s.summoned)
  if (!open) return null
  const active = employees.filter((e) => e.status !== 'OFFLINE' && e.status !== 'IDLE').length
  return (
    <div className="panel rise pointer-events-auto absolute left-3 top-[68px] z-30 flex max-h-[calc(100vh-200px)] w-[290px] flex-col text-bone">
      <PanelHead title={`Tim · ${employees.length}`} sub={`${active} sedang aktif`}
        right={<div className="flex items-center gap-1">{(can('employee:write') || !useOffice.getState().me) && <Btn variant="primary" onClick={() => set({ createEmployeeOpen: true })}>+ Rekrut</Btn>}<CloseBtn onClick={() => set({ directoryOpen: false })} /></div>} />
      <div className="overflow-y-auto px-1.5 pb-2">
        {employees.map((e) => {
          const sel = selectedId === e.id
          return (
            <button key={e.id} onClick={() => set({ selectedId: sel ? null : e.id })}
              className={`group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors ${sel ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
              <Avatar color={e.appearance.top} name={e.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">{e.name}{e.isDemo && <span className="rounded-full bg-demo/15 px-1.5 text-[9.5px] font-semibold text-demo">demo</span>}</div>
                <div className="truncate text-[11px] text-bone/45">{e.role}</div>
              </div>
              {e.status !== 'OFFLINE' && (
                <span role="button" onClick={(ev) => { ev.stopPropagation(); toggleSummon(e.id) }}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${summoned.includes(e.id) ? 'bg-bone text-ink' : 'hidden bg-accent text-ink group-hover:inline'}`}>
                  {summoned.includes(e.id) ? 'Ikut' : 'Panggil'}
                </span>
              )}
              <span className="h-2 w-2 shrink-0 rounded-full" title={STATUS_META[e.status].label} style={{ background: STATUS_META[e.status].color }} />
            </button>
          )
        })}
        {!employees.length && <div className="p-6 text-center text-xs text-bone/45">Office ini masih kosong.<br />Klik <b className="text-accent">+ Rekrut</b> untuk menambah AI employee.</div>}
      </div>
    </div>
  )
}
