import { useEffect, useMemo, useState } from 'react'
import { can, useOffice } from '../../state/store'
import { fetchCatalog, type CatalogAgent } from '../../state/catalog'
import { hireFromCatalog } from '../../state/remote'
import { Btn, Modal } from '../ui'
import { BlockyAvatar } from '../BlockyAvatar'

/**
 * Katalog AI: AI disiapkan administrator platform; office cukup memilih "Pakai".
 * Tidak ada form persona/prompt di sini — persona, model & tool dikelola terpusat.
 */
export function CatalogModal() {
  const open = useOffice((s) => s.createEmployeeOpen)
  const set = useOffice((s) => s.set)
  const me = useOffice((s) => s.me)
  const [list, setList] = useState<CatalogAgent[] | null>(null)
  const [dept, setDept] = useState('Semua')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = () => fetchCatalog().then(setList).catch((e) => { setErr((e as Error).message); setList([]) })
  useEffect(() => { if (open) { setErr(''); void load() } }, [open])

  const depts = useMemo(() => ['Semua', ...Array.from(new Set((list ?? []).map((a) => a.department).filter(Boolean)))], [list])
  if (!open) return null
  const close = () => set({ createEmployeeOpen: false })
  const allowed = can('employee:write') || !!me?.isSuperAdmin
  const shown = (list ?? []).filter((a) => dept === 'Semua' || a.department === dept)
  const used = (list ?? []).filter((a) => a.employeeId).length

  const hire = async (a: CatalogAgent) => {
    setBusy(a.id); setErr('')
    try {
      const emp = await hireFromCatalog(a.id)
      setList((l) => (l ?? []).map((x) => (x.id === a.id ? { ...x, employeeId: emp.id } : x)))
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <Modal title="Tim AI" onClose={close} wide>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <p className="mr-auto text-[12.5px] text-bone/55">
          {used} dari {list?.length ?? 0} AI bekerja di kantor ini. Semua AI berbagi satu Otak Kantor.
        </p>
        {depts.length > 2 && depts.map((d) => (
          <button key={d} onClick={() => setDept(d)}
            className={`h-7 rounded-full px-3 text-[12px] font-semibold transition-colors ${dept === d ? 'bg-bone text-ink' : 'bg-white/[0.05] text-bone/60 hover:text-bone'}`}>{d}</button>
        ))}
      </div>
      {err && <div className="mx-5 mt-3 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {list === null && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[168px] animate-pulse rounded-2xl bg-white/[0.04]" />)}
        {shown.map((a) => {
          const hired = !!a.employeeId
          return (
            <div key={a.id} className={`flex flex-col rounded-2xl border p-4 transition-colors ${hired ? 'border-accent/30 bg-accent/[0.05]' : 'border-line bg-white/[0.025] hover:bg-white/[0.045]'}`}>
              <div className="flex items-center gap-3">
                <BlockyAvatar ap={a.appearance} size={52} />
                <div className="min-w-0">
                  <div className="display truncate text-[15px]">{a.name}</div>
                  <div className="truncate text-[12px] text-bone/55">{a.role}</div>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-[34px] text-[12.5px] leading-snug text-bone/70">{a.tagline}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className="flex items-center gap-1.5 text-[11px] text-bone/45">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.ready ? 'bg-mint' : 'bg-amber-400'}`} />
                  {a.ready ? 'Siap' : 'Menunggu model'}
                </span>
                {hired
                  ? <Btn variant="ghost" onClick={() => set({ createEmployeeOpen: false, selectedId: a.employeeId })}>Di kantor ›</Btn>
                  : <Btn variant="primary" disabled={!allowed || busy === a.id} onClick={() => void hire(a)} title={allowed ? undefined : 'Butuh izin mengelola AI'}>
                      {busy === a.id ? 'Menyiapkan…' : 'Pakai'}
                    </Btn>}
              </div>
            </div>
          )
        })}
        {list && !list.length && (
          <div className="col-span-full py-10 text-center text-[13px] text-bone/50">Katalog AI masih kosong. Administrator menambahkan AI dari Admin → Katalog AI.</div>
        )}
      </div>
    </Modal>
  )
}
