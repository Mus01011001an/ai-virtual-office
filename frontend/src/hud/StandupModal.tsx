import { useEffect, useState } from 'react'
import { useOffice } from '../state/store'
import { fetchLatestStandup, triggerStandupNow } from '../lib/api'
import { Btn, Modal } from './ui'

export function StandupModal() {
  const open = useOffice((s) => s.standupOpen)
  const set = useOffice((s) => s.set)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetchLatestStandup()
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void loadData()
  }, [open])

  if (!open) return null

  const handleManualTrigger = async () => {
    setTriggering(true)
    try {
      await triggerStandupNow()
      set({ standupOpen: false })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <Modal title="📋 Daily Standup Report" onClose={() => set({ standupOpen: false })}>
      <div className="p-6 space-y-5 max-w-2xl max-h-[80vh] overflow-y-auto text-sm text-bone/90">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <div className="text-xs text-bone/50 uppercase font-semibold">Tanggal Standup</div>
            <div className="text-base font-bold text-white">{data?.date || 'Hari Ini'}</div>
          </div>
          <Btn variant="primary" size="sm" onClick={handleManualTrigger}>
            {triggering ? 'Menjalankan...' : '⚡ Picu Standup Sekarang'}
          </Btn>
        </div>

        {loading ? (
          <div className="text-center py-10 text-bone/50">Memuat laporan standup tim...</div>
        ) : data && data.reports?.length ? (
          <div className="space-y-4">
            {data.reports.map((r: any, idx: number) => (
              <div key={idx} className="rounded-2xl border border-line bg-surface/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-base">{r.name}</div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    ATTENDEE
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="rounded-xl bg-black/20 p-2.5">
                    <div className="text-bone/45 font-semibold text-[10px] uppercase">Kemarin (Done)</div>
                    <div className="text-bone/90 mt-1">{r.yesterday}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2.5">
                    <div className="text-bone/45 font-semibold text-[10px] uppercase">Hari Ini (Focus)</div>
                    <div className="text-bone/90 mt-1">{r.today}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2.5">
                    <div className="text-bone/45 font-semibold text-[10px] uppercase">Kendala (Blocker)</div>
                    <div className="text-rose-300 mt-1">{r.blockers}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-bone/45 space-y-3">
            <p>Belum ada laporan standup untuk hari ini.</p>
            <p className="text-xs">Standup berjalan otomatis jam 09:00 WIB atau klik tombol di atas.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
