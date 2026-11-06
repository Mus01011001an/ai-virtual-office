import { useEffect, useState, useRef } from 'react'
import { fetchConversationTraces, type WorkstationTrace } from '../../lib/api'
import { Btn, DemoBadge, fmtTime } from '../ui'

interface Props {
  employeeId: string
  employeeName: string
  isDemo?: boolean
}

type FilterType = 'ALL' | 'INSTRUCTION' | 'DISCUSSION' | 'TOOL'

export function AiConversationTab({ employeeId, employeeName, isDemo }: Props) {
  const [traces, setTraces] = useState<WorkstationTrace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchConversationTraces(employeeId, 150)
      setTraces(data || [])
    } catch (err: any) {
      setError(err.message || 'Gagal memuat percakapan AI')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [employeeId])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [traces.length, filter])

  const filtered = traces.filter((t) => {
    if (filter === 'INSTRUCTION' && t.type !== 'instruction' && t.type !== 'ai_reply') return false
    if (filter === 'DISCUSSION' && t.type !== 'discussion') return false
    if (filter === 'TOOL' && t.type !== 'tool_call' && t.type !== 'tool_output') return false
    if (search && !t.text.toLowerCase().includes(search.toLowerCase()) && !t.senderName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-full min-h-[300px] flex-1 flex-col">
      {isDemo && (
        <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-demo/10 px-2.5 py-1 text-[11px] text-demo">
          <DemoBadge /> Mode Demo — percakapan disimulasikan
        </div>
      )}
      {/* Header filter & search */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-1.5">
          {(
            [
              ['ALL', 'Semua'],
              ['INSTRUCTION', 'Instruksi CEO'],
              ['DISCUSSION', 'Diskusi Tim'],
              ['TOOL', 'Tool & Output'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === key ? 'bg-accent text-ink' : 'bg-white/[0.05] text-bone/70 hover:bg-white/[0.1] hover:text-bone'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari pesan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-36 rounded-xl border border-line bg-ink-2 px-2.5 py-1 text-xs text-bone placeholder:text-bone/30 focus:border-accent/60 outline-none"
          />
          <Btn onClick={loadData} size="sm" variant="ghost">
            ↻
          </Btn>
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {loading && (
          <div className="flex h-48 items-center justify-center text-sm text-bone/50">
            <span className="animate-spin mr-2">⟳</span> Mengambil riwayat percakapan...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex h-48 flex-col items-center justify-center text-center text-bone/40">
            <div className="text-2xl mb-1">💬</div>
            <div className="text-xs">Belum ada percakapan atau trace kognitif terekam untuk {employeeName}.</div>
            <div className="mt-1 text-[11px] text-bone/30">
              Instruksi langsung di panel atau task yang dieksekusi akan tercatat otomatis di sini.
            </div>
          </div>
        )}

        {!loading &&
          filtered.map((item) => {
            const isUser = item.role === 'user'
            const isAssistant = item.role === 'assistant'
            const isTool = item.role === 'tool'

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3 text-xs transition-colors ${
                  isUser
                    ? 'border-accent/30 bg-accent/[0.08] ml-6'
                    : isAssistant
                    ? 'border-emerald-500/25 bg-emerald-500/[0.05] mr-6'
                    : isTool
                    ? 'border-sky-500/20 bg-sky-500/[0.06] font-mono'
                    : 'border-line bg-white/[0.03]'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isUser
                          ? 'bg-accent/20 text-accent'
                          : isAssistant
                          ? 'bg-emerald-400/20 text-emerald-300'
                          : isTool
                          ? 'bg-sky-400/20 text-sky-300'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {item.senderName}
                    </span>
                    {item.senderRole && <span className="text-[10px] text-bone/50">· {item.senderRole}</span>}
                    {item.type === 'discussion' && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-[9px] font-medium text-purple-300">
                        Diskusi Tim
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-bone/40">{fmtTime(new Date(item.createdAt).getTime())}</span>
                </div>
                <div className={`whitespace-pre-wrap leading-relaxed ${isTool ? 'text-sky-200/90' : 'text-bone/90'}`}>
                  {item.text}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
