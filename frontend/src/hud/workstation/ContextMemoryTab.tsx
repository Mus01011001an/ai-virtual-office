import { useEffect, useState } from 'react'
import { ApiContextStatus, compactAgentContext, getAgentContext } from '../../state/remote'
import { Btn } from '../ui'

export function ContextMemoryTab({ employeeId }: { employeeId: string }) {
  const [status, setStatus] = useState<ApiContextStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    try {
      const data = await getAgentContext(employeeId)
      setStatus(data)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [employeeId])

  const handleCompact = async () => {
    if (!confirm('Rangkum milestone sesi ini ke memori permanen dan mulai sesi baru? Riwayat kerja tidak akan hilang.')) {
      return
    }
    setCompacting(true)
    setErr('')
    setNotice('')
    try {
      const res = await compactAgentContext(employeeId, 'manual_reset')
      setNotice(res.message)
      await loadStatus()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setCompacting(false)
    }
  }

  if (loading && !status) {
    return <div className="p-8 text-center text-xs text-bone/40">Memeriksa status context window agen…</div>
  }

  if (!status) {
    return (
      <div className="p-6 text-center text-xs text-red-300">
        Gagal memuat context window status: {err || 'Terjadi kesalahan'}
      </div>
    )
  }

  const barColor =
    status.statusLevel === 'CRITICAL'
      ? 'bg-rose-500'
      : status.statusLevel === 'HIGH'
      ? 'bg-amber-400'
      : status.statusLevel === 'MODERATE'
      ? 'bg-sky-400'
      : 'bg-emerald-400'

  return (
    <div className="space-y-4 text-xs text-bone">
      {notice && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-300">
          {notice}
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-3.5 py-2.5 text-xs text-red-300">
          {err}
        </div>
      )}

      {/* Context Window Gauge Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-bone/40">
              Kapasitas Context Window · Sesi #{status.sessionIndex}
            </div>
            <div className="mt-0.5 text-base font-bold text-bone flex items-center gap-2">
              <span>{status.totalTokensUsed.toLocaleString()} tokens</span>
              <span className="text-xs text-bone/45 font-normal">/ {status.maxContextTokens.toLocaleString()} max</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                status.statusLevel === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                  : status.statusLevel === 'HIGH'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : status.statusLevel === 'MODERATE'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {status.usagePercentage}% Terpakai ({status.statusLevel})
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.max(4, status.usagePercentage)}%` }}
          />
        </div>

        {/* Rekomendasi Reset Sesi */}
        {status.shouldReset ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-amber-200 text-xs flex items-start gap-2.5">
            <span className="text-base">⚠️</span>
            <div className="space-y-1">
              <div className="font-semibold">Saatnya Merangkum & Memulai Sesi Baru!</div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Konteks aktif sudah tinggi. Melakukan kompresi akan membersihkan memori kerja tanpa melupakan apa yang telah dikerjakan, menjaga akurasi penalaran agen tetap tajam.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-bone/45">
            Kapasitas konteks masih optimal. Sesi kerja berjalan lancar tanpa penurunan efisiensi token.
          </p>
        )}

        <div className="pt-1 flex items-center justify-between border-t border-white/[0.06]">
          <span className="text-[11px] text-bone/45">
            Menyimpan histori permanen ({status.pastMemoriesCount} milestone tercatat)
          </span>
          <Btn
            variant={status.shouldReset ? 'primary' : 'ghost'}
            size="sm"
            onClick={handleCompact}
            disabled={compacting}
          >
            {compacting ? 'Merangkum…' : '🧹 Rangkum & Mulai Sesi Baru'}
          </Btn>
        </div>
      </div>

      {/* Apa yang sedang & telah dikerjakan (Harus Jelas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Status Pekerjaan Saat Ini */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
            🛠️ Sedang Dikerjakan Saat Ini
          </div>
          {status.currentActiveTask ? (
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-2.5 space-y-1.5">
              <div className="font-semibold text-bone">{status.currentActiveTask.title}</div>
              <div className="flex items-center justify-between text-[11px] text-bone/60">
                <span>Status: <strong className="text-accent">{status.currentActiveTask.status}</strong></span>
                <span>{Math.round(status.currentActiveTask.progress || 0)}%</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-bone/40 py-3 text-center rounded-xl bg-white/[0.02]">
              Tidak ada tugas aktif (Agent sedang Standby / IDLE).
            </div>
          )}
        </div>

        {/* Pencapaian Terbaru di Sesi Ini */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            ✅ Tugas Selesai di Sesi #{status.sessionIndex}
          </div>
          {status.recentAchievements.length === 0 ? (
            <div className="text-xs text-bone/40 py-3 text-center rounded-xl bg-white/[0.02]">
              Belum ada tugas selesai di sesi ini.
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-bone/80">
              {status.recentAchievements.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-400">✓</span>
                  <span className="line-clamp-1">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Riwayat Memori Jangka Panjang Permanen (Episodic Memory) */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-bone/50 flex items-center gap-1.5">
            <span>💾</span> Memori Jangka Panjang Permanen (Episodic Memory)
          </div>
          <span className="text-[10px] text-accent font-semibold">Tersimpan Selamanya</span>
        </div>
        <p className="text-[11px] text-bone/45 leading-relaxed">
          Semua ringkasan sesi lampau di bawah ini otomatis diinjeksikan ke dalam tag <code className="text-accent">&lt;episodic_memory&gt;</code> prompt agen pada setiap tugas baru:
        </p>
        <div className="max-h-56 overflow-y-auto rounded-xl bg-black/40 border border-white/[0.06] p-3 font-mono text-[11px] leading-relaxed text-bone/70 whitespace-pre-wrap">
          {status.accumulatedSummaryPreview}
        </div>
      </div>
    </div>
  )
}
