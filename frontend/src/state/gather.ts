/**
 * Panggil / kumpulkan employee ke CEO.
 * Posisi kumpul dihitung per-frame oleh `office/Gather.tsx` (GatherController) ke `runtime.gather`;
 * Agent.tsx memakai posisi itu sebagai target (duduk di kursi terdekat atau berdiri menghadap CEO).
 */
import { useOffice } from './store'
import { holdDemo, releaseDemo } from './demoEngine'
import { uid } from '../lib/rng'
import { startDiscussion, endDiscussion } from './remote'

export function systemMsg(text: string) {
  const st = useOffice.getState()
  st.set({ chat: [...st.chat, { id: uid(), at: Date.now(), from: 'system', text }].slice(-80) })
}

export function summon(ids: string[]) {
  const st = useOffice.getState()
  const add = ids.filter((id) => {
    const e = st.employees.find((x) => x.id === id)
    return e && e.status !== 'OFFLINE' && !st.summoned.includes(id)
  })
  if (!add.length) return
  for (const id of add) {
    const e = st.employees.find((x) => x.id === id)!
    if (e.isDemo) {
      holdDemo(id)
      st.patchEmployee(id, { status: 'IN_MEETING', slot: null, currentTask: 'Diskusi dengan CEO', currentTool: null, progress: 0 })
      st.pushActivity(id, 'status', 'Status → IN_MEETING')
    }
    st.pushActivity(id, 'instruction', 'Dipanggil CEO — menuju ke CEO')
  }
  useOffice.getState().set({ summoned: [...useOffice.getState().summoned, ...add] })
  void startDiscussion(useOffice.getState().summoned)
  const names = add.map((id) => st.employees.find((x) => x.id === id)!.name)
  systemMsg(names.length > 3 ? `${names.length} orang dipanggil ke diskusi` : `${names.join(', ')} dipanggil ke diskusi`)
}

export function dismiss(ids?: string[]) {
  const st = useOffice.getState()
  const out = ids ?? st.summoned
  if (!out.length) return
  for (const id of out) {
    const e = st.employees.find((x) => x.id === id)
    if (!e) continue
    if (e.isDemo) {
      releaseDemo(id)
      st.patchEmployee(id, { status: 'IDLE', currentTask: null })
    }
    st.pushActivity(id, 'info', 'Selesai diskusi dengan CEO, kembali bekerja')
  }
  const left = useOffice.getState().summoned.filter((x) => !out.includes(x))
  const bubbles = { ...useOffice.getState().bubbles }
  out.forEach((id) => delete bubbles[id])
  useOffice.getState().set({ summoned: left, bubbles })
  if (!left.length) void endDiscussion()
  systemMsg(left.length ? `${out.length} orang kembali ke meja` : 'Diskusi selesai — semua kembali bekerja')
}

/** Kumpulkan semua employee yang hadir; kalau sudah ada yang dipanggil → bubarkan. */
export function toggleGatherAll() {
  const st = useOffice.getState()
  if (st.summoned.length) dismiss()
  else summon(st.employees.filter((e) => e.status !== 'OFFLINE').map((e) => e.id))
}

export function toggleSummon(id: string) {
  if (useOffice.getState().summoned.includes(id)) dismiss([id])
  else summon([id])
}
