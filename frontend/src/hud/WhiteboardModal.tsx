import { useOffice } from '../state/store'
import { Modal, Btn } from './ui'

export function WhiteboardModal() {
  const open = useOffice((s) => s.whiteboardOpen)
  const wb = useOffice((s) => s.whiteboard)
  const set = useOffice((s) => s.set)

  if (!open) return null
  const close = () => set({ whiteboardOpen: false })

  return (
    <Modal title={`Papan Tulis Rapat · ${wb.topic || 'Whiteboard'}`} onClose={close} wide>
      <div className="space-y-5 p-5 text-sm">
        {/* Top KPI & Consensus Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.04] p-4">
          <div>
            <div className="text-[11px] font-semibold text-bone/50 uppercase tracking-wider">Topik Diskusi</div>
            <div className="text-lg font-bold text-bone">{wb.topic || 'Diskusi Tim'}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-bone/50 uppercase tracking-wider">Skor Konsensus</div>
            <div className="flex items-center gap-3 mt-1">
              <div className="h-3 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${wb.consensusScore || 0}%` }}
                />
              </div>
              <span className="text-sm font-bold text-emerald-400">{wb.consensusScore || 0}%</span>
            </div>
          </div>
        </div>

        {/* 2 Columns: Points and Action Items */}
        <div className="grid grid-cols-5 gap-4">
          {/* Left: Points */}
          <div className="col-span-3 space-y-3">
            <div className="text-xs font-semibold text-bone/70 uppercase tracking-wider">
              📌 Poin-Poin Argumen Tim ({wb.points.length})
            </div>
            {wb.points.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-xs text-bone/40">
                Belum ada poin debat tercatat.
              </div>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {wb.points.map((p, idx) => {
                  const s = (p.stance || 'NEUTRAL').toUpperCase()
                  const badgeColor =
                    s === 'PROPOSE'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      : s === 'CRITIQUE'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : s === 'SUPPORT'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : s === 'SYNTHESIZE'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-white/10 text-bone/70 border-white/15'

                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-line bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                            {s}
                          </span>
                          <span className="font-semibold text-bone">{p.speaker}</span>
                        </div>
                      </div>
                      <div className="text-xs text-bone/85 leading-relaxed">{p.text}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: Action Items */}
          <div className="col-span-2 space-y-3">
            <div className="text-xs font-semibold text-bone/70 uppercase tracking-wider">
              ✅ Action Items Disepakati ({wb.actionItems.length})
            </div>
            {wb.actionItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-xs text-bone/40">
                Action items akan diekstrak otomatis saat rapat ditutup.
              </div>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {wb.actionItems.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-line bg-white/[0.03] p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                      <span>✓</span>
                      <span>@{item.assigneeName}</span>
                    </div>
                    <div className="mt-1 text-xs text-bone/85">{item.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Summary */}
        {wb.summary && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3.5 text-xs text-emerald-200">
            <span className="font-bold">Ringkasan Eksekutif: </span>
            {wb.summary}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Btn variant="solid" onClick={close}>
            Tutup
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
