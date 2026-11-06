import { useEffect, useState } from 'react'
import { useOffice } from '../state/store'
import { fetchApprovals, approveRequest, rejectRequest } from '../lib/api'
import type { ApprovalRequestData, ApprovalRiskLevel } from '../state/types'
import { Btn, Modal, inputCls } from './ui'

export function ApprovalModal() {
  const open = useOffice((s) => s.approvalOpen)
  const setStore = useOffice((s) => s.set)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [approvals, setApprovals] = useState<ApprovalRequestData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [err, setErr] = useState('')

  const loadData = async () => {
    setLoading(true)
    setErr('')
    try {
      const data = await fetchApprovals(tab === 'pending' ? 'PENDING' : undefined)
      setApprovals(data)
      if (tab === 'pending') {
        setStore({ pendingApprovalsCount: data.length })
      }
      if (data.length > 0 && (!selectedId || !data.some((d) => d.id === selectedId))) {
        setSelectedId(data[0].id)
      }
    } catch (e: any) {
      setErr(e.message || 'Gagal memuat daftar otorisasi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, tab])

  if (!open) return null

  const close = () => {
    setStore({ approvalOpen: false })
    setErr('')
    setReviewNote('')
  }

  const handleApprove = async () => {
    if (!selectedId) return
    setActionBusy(true)
    setErr('')
    try {
      await approveRequest(selectedId, reviewNote.trim() || undefined)
      setReviewNote('')
      await loadData()
    } catch (e: any) {
      setErr(e.message || 'Gagal menyetujui request')
    } finally {
      setActionBusy(false)
    }
  }

  const handleReject = async () => {
    if (!selectedId) return
    setActionBusy(true)
    setErr('')
    try {
      await rejectRequest(selectedId, reviewNote.trim() || undefined)
      setReviewNote('')
      await loadData()
    } catch (e: any) {
      setErr(e.message || 'Gagal menolak request')
    } finally {
      setActionBusy(false)
    }
  }

  const selectedItem = approvals.find((a) => a.id === selectedId)

  const getRiskBadge = (level: ApprovalRiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400 ring-1 ring-rose-500/30 animate-pulse">
            🚨 CRITICAL RISK
          </span>
        )
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/30">
            ⚠️ HIGH RISK
          </span>
        )
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-300 ring-1 ring-blue-500/30">
            ℹ️ MEDIUM RISK
          </span>
        )
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            ✓ LOW RISK
          </span>
        )
    }
  }

  return (
    <Modal title="Pusat Otorisasi Tindakan Agent (Human-In-The-Loop)" onClose={close}>
      <div className="flex h-[560px] flex-col text-sm text-bone">
        {/* Tab Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'text-bone/60 hover:bg-white/5 hover:text-bone'
              }`}
            >
              Menunggu Persetujuan ({approvals.filter((a) => a.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'history'
                  ? 'bg-white/10 text-bone ring-1 ring-white/20'
                  : 'text-bone/60 hover:bg-white/5 hover:text-bone'
              }`}
            >
              Riwayat Keputusan
            </button>
          </div>
          <button
            onClick={loadData}
            className="text-xs text-bone/50 hover:text-bone transition-colors"
            title="Muat ulang"
          >
            ↻ Refresh
          </button>
        </div>

        {err && (
          <div className="mx-5 mt-3 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">
            {err}
          </div>
        )}

        {/* Content Body: Split view */}
        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          {/* Kolom Kiri: List Items */}
          <div className="col-span-5 border-r border-line overflow-y-auto p-3 space-y-2">
            {loading && approvals.length === 0 ? (
              <div className="p-8 text-center text-xs text-bone/40">Memuat data otorisasi...</div>
            ) : approvals.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-bone/40">
                <span className="text-2xl mb-2">🛡️</span>
                Tidak ada permintaan otorisasi {tab === 'pending' ? 'yang tertunda' : ''}.
              </div>
            ) : (
              approvals.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                    selectedId === item.id
                      ? 'border-accent bg-accent/10 shadow-sm'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    {getRiskBadge(item.riskLevel)}
                    <span className="text-[10px] text-bone/40">
                      {new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs font-semibold truncate text-bone/90">{item.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-bone/50">
                    <span className="font-mono text-cyan-400 font-medium">{item.toolName}</span>
                    <span>•</span>
                    <span className="truncate">{item.employee?.name || 'Agent'}</span>
                  </div>
                  {item.status !== 'PENDING' && (
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider">
                      Status:{' '}
                      <span className={item.status === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}>
                        {item.status}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Kolom Kanan: Detail & Aksi */}
          <div className="col-span-7 flex flex-col justify-between overflow-y-auto p-5">
            {selectedItem ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-accent">ID: {selectedItem.id.slice(0, 8)}...</span>
                    {getRiskBadge(selectedItem.riskLevel)}
                  </div>
                  <h3 className="text-base font-bold text-bone">{selectedItem.title}</h3>
                  <p className="mt-1 text-xs text-bone/70 leading-relaxed">
                    {selectedItem.description || 'Tidak ada deskripsi risiko tambahan.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white/[0.03] p-2.5 border border-white/5">
                    <div className="text-[10px] uppercase text-bone/40 font-semibold">Agent Pemohon</div>
                    <div className="font-medium text-bone/90 mt-0.5">{selectedItem.employee?.name || '-'}</div>
                    <div className="text-[10px] text-bone/50">{selectedItem.employee?.role || '-'}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2.5 border border-white/5">
                    <div className="text-[10px] uppercase text-bone/40 font-semibold">Tugas Terkait</div>
                    <div className="font-medium text-bone/90 mt-0.5 truncate">{selectedItem.task?.title || '-'}</div>
                    <div className="text-[10px] text-bone/50">Status Task: {selectedItem.task?.status || '-'}</div>
                  </div>
                </div>

                {/* Payload parameters view */}
                <div>
                  <div className="text-xs font-semibold text-bone/80 mb-1 flex items-center justify-between">
                    <span>Tool Arguments / Payload:</span>
                    <span className="font-mono text-[11px] text-cyan-300">{selectedItem.toolName}</span>
                  </div>
                  <pre className="max-h-48 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-[11px] text-emerald-300/90 border border-white/10 select-text">
                    {JSON.stringify(selectedItem.inputPayload, null, 2)}
                  </pre>
                </div>

                {/* Review Note / Decision details if already decided */}
                {selectedItem.status !== 'PENDING' ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                    <div className="font-semibold text-bone/70">Keputusan:</div>
                    <div className="mt-1 text-sm font-bold">
                      {selectedItem.status === 'APPROVED' ? (
                        <span className="text-emerald-400">✓ Disetujui</span>
                      ) : (
                        <span className="text-rose-400">✕ Ditolak</span>
                      )}
                    </div>
                    {selectedItem.reviewNote && (
                      <div className="mt-1 text-xs text-bone/60 italic">"{selectedItem.reviewNote}"</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-xs font-medium text-bone/70 block mb-1">
                        Catatan Otorisasi (Opsional):
                      </label>
                      <input
                        className={inputCls}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="mis. Otorisasi disetujui setelah verifikasi kueri aman."
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
                      <Btn
                        variant="ghost"
                        size="md"
                        onClick={handleReject}
                        className="!text-rose-400 hover:!bg-rose-500/20"
                      >
                        {actionBusy ? 'Memproses...' : 'Tolak & Batalkan Task'}
                      </Btn>
                      <Btn
                        variant="primary"
                        size="md"
                        onClick={handleApprove}
                        className="!bg-emerald-600 hover:!bg-emerald-500 !text-white"
                      >
                        {actionBusy ? 'Mengeksekusi...' : '✓ Setujui & Lanjutkan Task'}
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-bone/40">
                Pilih permintaan otorisasi di sebelah kiri untuk melihat rincian
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
