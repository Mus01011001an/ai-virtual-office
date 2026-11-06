import { useEffect, useState, useRef, useMemo } from 'react'
import { fetchConversationTraces, type WorkstationTrace } from '../../lib/api'
import { Btn, DemoBadge, fmtTime } from '../ui'

interface Props {
  employeeId: string
  employeeName: string
  isDemo?: boolean
}

type FilterType = 'ALL' | 'INSTRUCTION' | 'DISCUSSION' | 'TOOL'

interface DailyFolder {
  dateKey: string
  label: string
  fullDateStr: string
  isToday: boolean
  isYesterday: boolean
  totalCount: number
  instructionCount: number
  toolCount: number
  discussionCount: number
  traces: WorkstationTrace[]
}

export function AiConversationTab({ employeeId, employeeName, isDemo }: Props) {
  const [traces, setTraces] = useState<WorkstationTrace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [search, setSearch] = useState('')
  const [selectedDateKey, setSelectedDateKey] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchConversationTraces(employeeId, 250)
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

  // Partisi traces ke folder berbasis tanggal
  const folders = useMemo<DailyFolder[]>(() => {
    const map = new Map<string, DailyFolder>()
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterdayDate = new Date(Date.now() - 86400000)
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

    for (const t of traces) {
      const d = new Date(t.createdAt)
      const key = isNaN(d.getTime()) ? todayStr : d.toISOString().split('T')[0]

      if (!map.has(key)) {
        const isToday = key === todayStr
        const isYesterday = key === yesterdayStr
        const dObj = new Date(key + 'T00:00:00')
        const fullDateStr = isNaN(dObj.getTime())
          ? key
          : dObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        const shortDateStr = isNaN(dObj.getTime())
          ? key
          : dObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

        map.set(key, {
          dateKey: key,
          label: isToday ? 'Hari Ini' : isYesterday ? 'Kemarin' : shortDateStr,
          fullDateStr,
          isToday,
          isYesterday,
          totalCount: 0,
          instructionCount: 0,
          toolCount: 0,
          discussionCount: 0,
          traces: [],
        })
      }

      const folder = map.get(key)!
      folder.traces.push(t)
      folder.totalCount++
      if (t.type === 'instruction' || t.role === 'user') folder.instructionCount++
      if (t.type === 'tool_call' || t.type === 'tool_output' || t.role === 'tool') folder.toolCount++
      if (t.type === 'discussion') folder.discussionCount++
    }

    // Urutkan traces di setiap folder dari lama ke baru (kronologis natural)
    for (const folder of map.values()) {
      folder.traces.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    // Urutkan daftar folder dari tanggal paling baru ke tanggal lama
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [traces])

  // Pilih folder tanggal pertama secara default jika belum dipilih
  useEffect(() => {
    if (folders.length > 0 && (!selectedDateKey || !folders.some((f) => f.dateKey === selectedDateKey))) {
      setSelectedDateKey(folders[0].dateKey)
    }
  }, [folders, selectedDateKey])

  const activeFolder = folders.find((f) => f.dateKey === selectedDateKey) ?? folders[0]

  // Filter pesan di dalam folder aktif
  const filtered = useMemo(() => {
    if (!activeFolder) return []
    return activeFolder.traces.filter((t) => {
      if (filter === 'INSTRUCTION' && t.type !== 'instruction' && t.type !== 'ai_reply' && t.role !== 'user') return false
      if (filter === 'DISCUSSION' && t.type !== 'discussion') return false
      if (filter === 'TOOL' && t.type !== 'tool_call' && t.type !== 'tool_output' && t.role !== 'tool') return false
      if (
        search &&
        !t.text.toLowerCase().includes(search.toLowerCase()) &&
        !t.senderName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [activeFolder, filter, search])

  // Scroll otomatis ke bawah folder saat berganti tanggal atau filter
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [selectedDateKey, filtered.length, filter])

  return (
    <div className="flex h-full min-h-[460px] flex-1 flex-col">
      {isDemo && (
        <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-demo/10 px-2.5 py-1 text-[11px] text-demo">
          <DemoBadge /> Mode Demo — percakapan disimulasikan
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center text-sm text-bone/50">
          <span className="animate-spin mr-2">⟳</span> Mengambil riwayat percakapan...
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && folders.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center text-center text-bone/40">
          <div className="text-3xl mb-2">📁</div>
          <div className="text-xs font-medium">Belum ada folder riwayat terekam untuk {employeeName}.</div>
          <div className="mt-1 text-[11px] text-bone/30 max-w-sm">
            Instruksi langsung di panel atau tugas yang dieksekusi oleh agen akan otomatis diarsipkan per hari di sini.
          </div>
        </div>
      )}

      {!loading && !error && folders.length > 0 && (
        <div className="flex flex-1 flex-col md:flex-row gap-3 min-h-0 overflow-hidden">
          {/* PANEL KIRI: FOLDER EXPLORER BERBASIS TANGGAL */}
          <div className="w-full md:w-56 shrink-0 flex flex-col rounded-2xl border border-line bg-black/20 p-2 overflow-hidden">
            <div className="mb-2 flex items-center justify-between px-2 py-1 border-b border-line/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-bone/60">📁 Folder Harian</span>
              <span className="text-[10px] font-mono rounded bg-white/[0.08] px-1.5 py-0.5 text-bone/50">
                {folders.length} hari
              </span>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto pr-1">
              {folders.map((folder) => {
                const isSelected = folder.dateKey === activeFolder?.dateKey
                return (
                  <button
                    key={folder.dateKey}
                    onClick={() => setSelectedDateKey(folder.dateKey)}
                    className={`w-full text-left rounded-xl p-2 transition-all flex items-start gap-2 ${
                      isSelected
                        ? 'bg-accent/15 border border-accent/40 text-accent font-semibold shadow-sm'
                        : 'hover:bg-white/[0.05] text-bone/70 border border-transparent'
                    }`}
                  >
                    <span className="text-sm leading-none mt-0.5">{isSelected ? '📂' : '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs truncate">{folder.label}</span>
                        <span className="text-[10px] font-mono opacity-60 ml-1">{folder.totalCount}</span>
                      </div>
                      <div className="text-[10px] opacity-45 truncate mt-0.5 font-mono">{folder.dateKey}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PANEL KANAN: REKAPITULASI HARIAN & CHAT KRONOLOGIS */}
          <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-line bg-black/15 p-3 overflow-hidden">
            {/* Kartu Ringkasan Harian (Daily Summary Card) */}
            {activeFolder && (
              <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🗓️</span>
                    <div>
                      <div className="font-bold text-xs text-bone flex items-center gap-2">
                        <span>{activeFolder.fullDateStr}</span>
                        {activeFolder.isToday && (
                          <span className="rounded bg-mint/20 px-1.5 py-0.2 text-[9px] font-semibold text-mint">
                            Hari Ini
                          </span>
                        )}
                        {activeFolder.isYesterday && (
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-sky-300">
                            Kemarin
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-bone/50 font-mono mt-0.5 flex flex-wrap gap-x-2.5">
                        <span>👔 {activeFolder.instructionCount} Instruksi CEO</span>
                        <span>•</span>
                        <span>⚙️ {activeFolder.toolCount} Eksekusi Tool</span>
                        <span>•</span>
                        <span>💬 {activeFolder.discussionCount} Diskusi Tim</span>
                      </div>
                    </div>
                  </div>

                  <Btn onClick={loadData} size="sm" variant="ghost" title="Segarkan data">
                    ↻
                  </Btn>
                </div>
              </div>
            )}

            {/* Filter Pills & Pencarian */}
            <div className="mb-2.5 flex items-center justify-between gap-2 pb-2 border-b border-line/60">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {(
                  [
                    ['ALL', 'Semua'],
                    ['INSTRUCTION', 'Instruksi'],
                    ['DISCUSSION', 'Diskusi'],
                    ['TOOL', 'Tools'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`rounded-lg px-2 py-0.8 text-[11px] font-semibold transition-colors shrink-0 ${
                      filter === key
                        ? 'bg-accent text-ink'
                        : 'bg-white/[0.05] text-bone/70 hover:bg-white/[0.1] hover:text-bone'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative w-36 sm:w-44">
                <input
                  type="text"
                  placeholder="Cari di hari ini..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-line bg-ink-2 px-2 py-1 text-[11px] text-bone placeholder:text-bone/30 focus:border-accent/60 outline-none"
                />
              </div>
            </div>

            {/* Daftar Percakapan Kronologis (Paling baru di bawah) */}
            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto pr-1">
              {filtered.length === 0 && (
                <div className="flex h-36 flex-col items-center justify-center text-center text-bone/35">
                  <div className="text-xl mb-1">🔍</div>
                  <div className="text-xs">Tidak ada riwayat yang cocok dengan filter pada tanggal ini.</div>
                </div>
              )}

              {filtered.map((item) => {
                const isUser = item.role === 'user' || item.type === 'instruction'
                const isAssistant = item.role === 'assistant' || item.type === 'ai_reply'
                const isTool = item.role === 'tool' || item.type === 'tool_call' || item.type === 'tool_output'

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 text-xs transition-colors ${
                      isUser
                        ? 'border-accent/30 bg-accent/[0.08] ml-4'
                        : isAssistant
                        ? 'border-emerald-500/25 bg-emerald-500/[0.05] mr-4'
                        : isTool
                        ? 'border-sky-500/20 bg-sky-500/[0.06] font-mono'
                        : 'border-line bg-white/[0.03]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
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
                        {item.senderRole && <span className="text-[10px] text-bone/45">· {item.senderRole}</span>}
                        {item.type === 'discussion' && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-[9px] font-medium text-purple-300">
                            Diskusi Tim
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-bone/40">{fmtTime(new Date(item.createdAt).getTime())}</span>
                    </div>
                    <div className={`whitespace-pre-wrap leading-relaxed ${isTool ? 'text-sky-200/90 text-[11px]' : 'text-bone/90'}`}>
                      {item.text}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
