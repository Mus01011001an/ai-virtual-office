import { useEffect, useState } from 'react'
import { fetchPerformance, type WorkstationPerformance } from '../../lib/api'
import { Btn, fmtTime } from '../ui'

interface Props {
  employeeId: string
  employeeName: string
}

export function PerformanceTab({ employeeId, employeeName }: Props) {
  const [data, setData] = useState<WorkstationPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchPerformance(employeeId)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Gagal memuat analitik performa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [employeeId])

  return (
    <div className="flex h-full min-h-[300px] flex-1 flex-col space-y-4 overflow-y-auto pr-1">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div>
          <div className="text-xs font-semibold text-bone">Metrik Penggunaan Token & Efisiensi AI</div>
          <div className="text-[11px] text-bone/50">Ledger audit inferensi LLM dan biaya riil {employeeName}</div>
        </div>
        <Btn onClick={loadData} size="sm" variant="ghost">
          ↻ Segarkan
        </Btn>
      </div>

      {loading && (
        <div className="flex h-48 items-center justify-center text-sm text-bone/50">
          <span className="animate-spin mr-2">⟳</span> Mengkalkulasi data performa...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Summary 4 Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl border border-line bg-white/[0.04] p-3">
              <div className="text-[10px] font-semibold text-bone/45 uppercase tracking-wider">Total Token</div>
              <div className="mt-1 text-lg font-bold text-bone">
                {data.tokens.total.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[10px] text-bone/50">
                P: {data.tokens.prompt.toLocaleString()} · C: {data.tokens.completion.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white/[0.04] p-3">
              <div className="text-[10px] font-semibold text-bone/45 uppercase tracking-wider">Estimasi Biaya</div>
              <div className="mt-1 text-lg font-bold text-accent">
                ${data.cost.usd.toFixed(4)}
              </div>
              <div className="mt-0.5 text-[10px] text-bone/50">
                Rp {data.cost.idr.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white/[0.04] p-3">
              <div className="text-[10px] font-semibold text-bone/45 uppercase tracking-wider">Rata-rata Latensi</div>
              <div className="mt-1 text-lg font-bold text-sky-300">
                {data.latency.avgDurationMs} ms
              </div>
              <div className="mt-0.5 text-[10px] text-bone/50">
                {data.latency.totalInvocations} inferensi
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white/[0.04] p-3">
              <div className="text-[10px] font-semibold text-bone/45 uppercase tracking-wider">Success Rate</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">
                {data.tasks.successRate}%
              </div>
              <div className="mt-0.5 text-[10px] text-bone/50">
                {data.tasks.completed}/{data.tasks.total} task tuntas
              </div>
            </div>
          </div>

          {/* Model Breakdown */}
          {data.byModel.length > 0 && (
            <div className="rounded-2xl border border-line bg-white/[0.03] p-3.5">
              <div className="mb-2 text-xs font-semibold text-bone">Distribusi per Model AI</div>
              <div className="space-y-2">
                {data.byModel.map((m) => (
                  <div key={m.model} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      <span className="font-mono font-medium text-bone/90">{m.model}</span>
                      <span className="text-[10px] text-bone/45">({m.count}x call)</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="font-mono text-bone/70">{m.totalTokens.toLocaleString()} tokens</span>
                      <span className="font-semibold text-accent">${m.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Token Invocations Table */}
          <div className="rounded-2xl border border-line bg-black/30 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-xs font-semibold text-bone">Riwayat Eksekusi Inferensi Terakhir</div>
              <span className="text-[10px] text-bone/40">{data.recentRecords.length} rekaman</span>
            </div>

            {data.recentRecords.length === 0 ? (
              <div className="py-6 text-center text-xs text-bone/35">
                Belum ada rekaman eksekusi token untuk employee ini.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto font-mono text-[11px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-bone/40">
                      <th className="pb-1.5 font-medium">Waktu</th>
                      <th className="pb-1.5 font-medium">Model</th>
                      <th className="pb-1.5 font-medium">Task</th>
                      <th className="pb-1.5 text-right font-medium">Tokens</th>
                      <th className="pb-1.5 text-right font-medium">Durasi</th>
                      <th className="pb-1.5 text-right font-medium">Biaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.recentRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.03]">
                        <td className="py-1.5 text-bone/45">{fmtTime(new Date(r.createdAt).getTime())}</td>
                        <td className="py-1.5 text-bone/80">{r.model}</td>
                        <td className="py-1.5 text-bone/60 truncate max-w-[140px]">
                          {r.task?.title || 'Direct Prompt'}
                        </td>
                        <td className="py-1.5 text-right text-sky-300">{r.totalTokens}</td>
                        <td className="py-1.5 text-right text-bone/50">{r.durationMs}ms</td>
                        <td className="py-1.5 text-right text-accent">${r.estimatedCost.toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
