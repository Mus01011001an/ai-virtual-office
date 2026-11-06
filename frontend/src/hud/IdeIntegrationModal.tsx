import { useState } from 'react'
import { useOffice } from '../state/store'
import { getToken } from '../lib/api'
import { Modal } from './ui'

export function IdeIntegrationModal() {
  const open = useOffice((s) => s.ideModalOpen)
  const set = useOffice((s) => s.set)
  const [tab, setTab] = useState<'antigravity' | 'cursor' | 'codex'>('antigravity')
  const [copied, setCopied] = useState<string | null>(null)

  if (!open) return null

  const close = () => set({ ideModalOpen: false })
  const token = getToken() || '<TOKEN_SESI_ANDA>'
  const sseEndpoint = 'https://office-api.musyan.my.id/api/v1/office/mcp/server/sse'

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const antigravitySnippet = `{
  "mcpServers": {
    "virtual-office": {
      "url": "${sseEndpoint}",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}`

  const cursorSnippet = `{
  "mcpServers": {
    "ai-virtual-office": {
      "url": "${sseEndpoint}",
      "headers": {
        "Authorization": "Bearer ${token}"
      }
    }
  }
}`

  const codexCliSnippet = `# Tes koneksi MCP via curl:
curl -N -H "Authorization: Bearer ${token}" \\
  "${sseEndpoint}"`

  return (
    <Modal title="Hubungkan ke IDE (Antigravity, Cursor, Codex)" onClose={close}>
      <div className="flex h-[520px] flex-col p-5 text-sm text-bone overflow-y-auto space-y-4 max-w-xl">
        {/* Banner Penjelasan */}
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-4">
          <div className="flex items-center gap-2 text-cyan-300 font-bold font-mono text-xs uppercase">
            <span>🔌</span> Model Context Protocol (MCP) Server Endpoint
          </div>
          <p className="mt-1 text-xs text-bone/70 leading-relaxed">
            Kantor virtual menyediakan MCP Server bawaan yang memungkinkan AI di IDE Anda (seperti Google Antigravity, Cursor, dan Codex) untuk langsung melihat agen, mendelegasikan tugas kode, dan memantau status kantor.
          </p>
        </div>

        {/* Tab Pemilihan IDE */}
        <div className="flex gap-2 border-b border-white/[0.08] pb-2">
          {[
            { id: 'antigravity', label: 'Google Antigravity' },
            { id: 'cursor', label: 'Cursor IDE' },
            { id: 'codex', label: 'Codex / OpenCode' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40'
                  : 'text-bone/50 hover:bg-white/[0.04] hover:text-bone'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Konten Tab */}
        {tab === 'antigravity' && (
          <div className="space-y-3 animate-in fade-in">
            <h4 className="font-bold text-xs text-white">Panduan Integrasi Google Antigravity:</h4>
            <ol className="list-decimal list-inside text-xs text-bone/70 space-y-1.5">
              <li>
                Buka file konfigurasi Antigravity Anda atau tambahkan MCP server di pengaturan.
              </li>
              <li>Tempelkan konfigurasi JSON di bawah ini:</li>
            </ol>
            <div className="relative">
              <pre className="rounded-2xl border border-white/10 bg-black/60 p-3.5 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
                {antigravitySnippet}
              </pre>
              <button
                onClick={() => copyToClipboard(antigravitySnippet, 'antigravity')}
                className="absolute top-2.5 right-2.5 rounded-lg bg-cyan-400/20 border border-cyan-400/30 px-2.5 py-1 text-[11px] font-mono font-bold text-cyan-300 hover:bg-cyan-400/30 transition-all"
              >
                {copied === 'antigravity' ? '✓ Tersalin!' : 'Salin JSON'}
              </button>
            </div>
            <p className="text-[11px] text-bone/50">
              Antigravity sekarang dapat memanggil tool: <code className="text-white">list_office_agents</code>, <code className="text-white">delegate_task_to_agent</code>, dan <code className="text-white">get_office_status</code>.
            </p>
          </div>
        )}

        {tab === 'cursor' && (
          <div className="space-y-3 animate-in fade-in">
            <h4 className="font-bold text-xs text-white">Panduan Integrasi Cursor IDE:</h4>
            <ol className="list-decimal list-inside text-xs text-bone/70 space-y-1.5">
              <li>Buka <b>Cursor Settings → Features → MCP</b>.</li>
              <li>Atau tambahkan ke file <code className="text-white">~/.cursor/mcp.json</code>:</li>
            </ol>
            <div className="relative">
              <pre className="rounded-2xl border border-white/10 bg-black/60 p-3.5 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
                {cursorSnippet}
              </pre>
              <button
                onClick={() => copyToClipboard(cursorSnippet, 'cursor')}
                className="absolute top-2.5 right-2.5 rounded-lg bg-cyan-400/20 border border-cyan-400/30 px-2.5 py-1 text-[11px] font-mono font-bold text-cyan-300 hover:bg-cyan-400/30 transition-all"
              >
                {copied === 'cursor' ? '✓ Tersalin!' : 'Salin JSON'}
              </button>
            </div>
            <p className="text-[11px] text-bone/50">
              Ketik instruksi di Cursor Composer: <i>"Cek agen virtual office yang sedang idle dan delegasikan tugas refactor ini ke mereka."</i>
            </p>
          </div>
        )}

        {tab === 'codex' && (
          <div className="space-y-3 animate-in fade-in">
            <h4 className="font-bold text-xs text-white">Panduan Integrasi Codex / OpenCode CLI:</h4>
            <p className="text-xs text-bone/70 leading-relaxed">
              Codex dan OpenCode CLI dapat terhubung via protokol SSE standar. Jalankan perintah ini di terminal Anda untuk memeriksa koneksi:
            </p>
            <div className="relative">
              <pre className="rounded-2xl border border-white/10 bg-black/60 p-3.5 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
                {codexCliSnippet}
              </pre>
              <button
                onClick={() => copyToClipboard(codexCliSnippet, 'codex')}
                className="absolute top-2.5 right-2.5 rounded-lg bg-cyan-400/20 border border-cyan-400/30 px-2.5 py-1 text-[11px] font-mono font-bold text-cyan-300 hover:bg-cyan-400/30 transition-all"
              >
                {copied === 'codex' ? '✓ Tersalin!' : 'Salin Perintah'}
              </button>
            </div>
          </div>
        )}

        {/* Token Rahasia */}
        <div className="pt-2 border-t border-white/[0.08]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-mono text-bone/60">Token Sesi Aktif:</span>
            <button
              onClick={() => copyToClipboard(token, 'token')}
              className="text-cyan-400 font-mono text-[11px] hover:underline"
            >
              {copied === 'token' ? '✓ Token Tersalin' : 'Salin Token Saja'}
            </button>
          </div>
          <div className="rounded-xl bg-black/40 border border-white/5 px-3 py-2 font-mono text-[11px] text-bone/50 truncate">
            {token}
          </div>
        </div>
      </div>
    </Modal>
  )
}

