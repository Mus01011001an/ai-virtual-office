import { useEffect, useState } from 'react'
import { useOffice } from '../state/store'
import { Btn, Field, Modal, inputCls } from './ui'
import {
  ApiMcpServer,
  createMcpServer,
  deleteMcpServer,
  listMcpServers,
  syncMcpTools,
  updateMcpServer,
} from '../state/remote'

const PRESETS = [
  {
    name: 'brave-search',
    label: 'Brave Search MCP',
    url: 'https://mcp.brave.com/v1/sse',
    description: 'Pencarian web real-time tanpa pelacak dengan hasil organik.',
  },
  {
    name: 'github-mcp',
    label: 'GitHub Tool Server',
    url: 'http://localhost:3001/sse',
    description: 'Akses repositori GitHub, commit, pull request, dan issue tracker.',
  },
  {
    name: 'browser-tools',
    label: 'Puppeteer Browser MCP',
    url: 'http://localhost:3002/sse',
    description: 'Automasi browser web, web scraping, dan tangkapan layar dinamis.',
  },
]

export function McpModal() {
  const open = useOffice((s) => s.mcpOpen)
  const st = useOffice()

  const [servers, setServers] = useState<ApiMcpServer[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [authHeader, setAuthHeader] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadServers = async () => {
    setLoading(true)
    try {
      const data = await listMcpServers()
      setServers(data)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadServers()
      setErr('')
      setNotice('')
    }
  }, [open])

  if (!open) return null
  const close = () => st.set({ mcpOpen: false })

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name)
    setUrl(preset.url)
    setDescription(preset.description)
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setNotice('')
    try {
      if (!name.trim() || !url.trim()) {
        throw new Error('Nama server dan URL endpoint wajib diisi')
      }

      const headers: Record<string, string> = {}
      if (authHeader.trim()) {
        headers['Authorization'] = authHeader.trim().startsWith('Bearer ')
          ? authHeader.trim()
          : `Bearer ${authHeader.trim()}`
      }

      await createMcpServer({
        name: name.trim(),
        url: url.trim(),
        description: description.trim(),
        headers: Object.keys(headers).length ? headers : undefined,
      })

      setNotice(`Server MCP "${name.trim()}" berhasil dihubungkan! Semua agent sekarang dapat menggunakan tools ini.`)
      setName('')
      setUrl('')
      setDescription('')
      setAuthHeader('')
      setShowAdd(false)
      await loadServers()
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (s: ApiMcpServer) => {
    try {
      await updateMcpServer(s.id, { isEnabled: !s.isEnabled })
      await loadServers()
    } catch (ex) {
      alert((ex as Error).message)
    }
  }

  const handleSync = async (s: ApiMcpServer) => {
    setNotice('')
    try {
      const res = await syncMcpTools(s.id)
      setNotice(`Berhasil sinkronisasi ${res.toolsCount} tools dari server ${s.name}!`)
      await loadServers()
    } catch (ex) {
      alert((ex as Error).message)
    }
  }

  const handleDelete = async (s: ApiMcpServer) => {
    if (!confirm(`Hapus server MCP "${s.name}"? Agent tidak akan bisa memanggil tool dari server ini lagi.`)) return
    try {
      await deleteMcpServer(s.id)
      await loadServers()
    } catch (ex) {
      alert((ex as Error).message)
    }
  }

  const totalTools = servers.reduce((acc, s) => acc + (s.toolsCache?.length || 0), 0)

  return (
    <Modal title="Model Context Protocol (MCP) Hub" onClose={close}>
      <div className="space-y-4 p-5 text-sm max-h-[85vh] overflow-y-auto w-[min(680px,94vw)]">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div>
            <p className="text-xs text-bone/55">
              Hubungkan server tools MCP (SSE/HTTP). Seluruh AI Employee di kantor berhak memanggil tools ini secara otonom.
            </p>
          </div>
          <Btn
            variant={showAdd ? 'ghost' : 'primary'}
            size="sm"
            onClick={() => {
              setShowAdd(!showAdd)
              setErr('')
              setNotice('')
            }}
          >
            {showAdd ? 'Tutup' : '+ Hubungkan MCP'}
          </Btn>
        </div>

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

        {/* Form Tambah MCP Server */}
        {showAdd && (
          <form
            onSubmit={handleConnect}
            className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4 space-y-3.5 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-accent uppercase tracking-wider">
                🔌 Sambungkan Server MCP Baru
              </h4>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-bone/50 block">Preset Cepat:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-bone/70 hover:border-accent hover:text-accent transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Identifier Server (slug)">
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. github atau brave-search"
                  required
                />
              </Field>
              <Field label="URL Server (SSE / HTTP)">
                <input
                  className={inputCls}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mcp.domain.com/sse"
                  required
                />
              </Field>
            </div>

            <Field label="Deskripsi (Opsional)">
              <input
                className={inputCls}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="mis. Kumpulan tool analisis kode dan web search"
              />
            </Field>

            <Field label="Bearer Token / API Key (Opsional)">
              <input
                type="password"
                className={inputCls}
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                placeholder="Bearer token jika endpoint memerlukan autentikasi"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Batal
              </Btn>
              <Btn variant="primary" size="sm" type="submit">
                {busy ? 'Menghubungkan…' : 'Hubungkan & Temukan Tools'}
              </Btn>
            </div>
          </form>
        )}

        {/* Daftar Server MCP */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-bone/70 uppercase tracking-wider">
            <span>Server Terhubung ({servers.length})</span>
            <span className="text-accent lowercase">{totalTools} tools aktif</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-bone/40">Memuat server MCP…</div>
          ) : servers.length === 0 ? (
            <div className="py-8 text-center text-xs text-bone/40 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              Belum ada server MCP terhubung. Klik "+ Hubungkan MCP" di atas.
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((s) => {
                const tools = s.toolsCache || []
                const isExpanded = expandedId === s.id

                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border transition-all ${
                      s.isEnabled ? 'border-white/[0.08] bg-white/[0.03]' : 'border-white/[0.04] bg-white/[0.01] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between p-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                            s.isEnabled ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/10 text-bone/40'
                          }`}
                        >
                          🔌
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-bone">{s.name}</span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-bone/60 uppercase">
                              {s.transport}
                            </span>
                            <span className="text-[11px] text-accent font-medium">
                              {tools.length} tools
                            </span>
                          </div>
                          <div className="text-[11px] text-bone/40 font-mono truncate max-w-[280px] sm:max-w-[380px]">
                            {s.url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggle(s)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            s.isEnabled
                              ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-white/10 text-bone/50 hover:bg-white/15'
                          }`}
                        >
                          {s.isEnabled ? 'Aktif' : 'Nonaktif'}
                        </button>

                        <button
                          onClick={() => handleSync(s)}
                          title="Sync tools ulang"
                          className="p-1.5 rounded-lg text-bone/60 hover:text-accent hover:bg-white/[0.08] transition-colors"
                        >
                          🔄
                        </button>

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="p-1.5 rounded-lg text-bone/60 hover:text-bone hover:bg-white/[0.08] transition-colors text-xs"
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>

                        <button
                          onClick={() => handleDelete(s)}
                          title="Hapus server"
                          className="p-1.5 rounded-lg text-red-400/60 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Expanded Tool Definitions List */}
                    {isExpanded && (
                      <div className="p-3 border-t border-white/[0.06] bg-ink/40 rounded-b-2xl space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-bone/50">
                          Tools Tersedia dari {s.name}:
                        </div>
                        {tools.length === 0 ? (
                          <div className="text-xs text-bone/40 py-2">
                            Belum ada tool terdeteksi. Klik tombol 🔄 untuk sinkronisasi.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {tools.map((t) => (
                              <div
                                key={t.name}
                                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs space-y-1"
                              >
                                <div className="font-mono font-semibold text-accent">
                                  mcp__{s.name}__{t.name}
                                </div>
                                <div className="text-[11px] text-bone/60 line-clamp-2">
                                  {t.description || 'Tidak ada deskripsi'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
