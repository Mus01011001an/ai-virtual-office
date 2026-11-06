import { useOffice, currentOffice } from '../state/store'
import { signOut, enterOffice } from '../state/remote'
import { useState } from 'react'

export function EscapeMenu() {
  const open = useOffice((s) => s.escapeMenuOpen)
  const st = useOffice()
  const office = currentOffice()
  const [showRealms, setShowRealms] = useState(false)
  const [busyRealm, setBusyRealm] = useState<string | null>(null)

  if (!open) return null

  const close = () => st.set({ escapeMenuOpen: false })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0c101c]/90 p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] text-bone">
        {/* Header Pause Menu */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-0.5 text-[11px] font-mono font-bold tracking-wider text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>GAME PAUSED</span>
            </div>
            <h2 className="mt-2 text-xl font-bold font-mono text-white">
              {office?.name || 'VIRTUAL OFFICE'}
            </h2>
            <p className="text-xs text-bone/50">
              Operator: <span className="text-cyan-300 font-semibold">{st.me?.name || 'User'}</span>
            </p>
          </div>

          <button
            onClick={close}
            className="flex h-10 items-center gap-1.5 rounded-2xl bg-cyan-400 px-4 text-xs font-mono font-bold text-slate-950 hover:bg-cyan-300 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,245,212,0.3)]"
          >
            <span>▶</span>
            <span>LANJUT (ESC)</span>
          </button>
        </div>

        {/* Sub-tampilan ganti Realm jika dipilih */}
        {showRealms ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-300">PILIH REALM KANTOR:</span>
              <button
                onClick={() => setShowRealms(false)}
                className="text-xs text-bone/50 hover:text-bone"
              >
                ← Kembali ke Menu
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {st.offices.map((o) => (
                <button
                  key={o.id}
                  disabled={busyRealm === o.id}
                  onClick={async () => {
                    setBusyRealm(o.id)
                    try {
                      await enterOffice(o.id)
                      setShowRealms(false)
                      close()
                    } catch (e) {
                      alert((e as Error).message)
                    }
                    setBusyRealm(null)
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                    o.id === office?.id
                      ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05] text-bone'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm">{o.name}</div>
                    <div className="text-[11px] text-bone/45">
                      {o.employeeCount ?? 0} AI Agents · {o.timezone}
                    </div>
                  </div>
                  <span className="text-xs font-mono">
                    {busyRealm === o.id ? 'Loading…' : o.id === office?.id ? 'Aktif' : 'Pindah →'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Grid Menu 8 Aksi Utama */
          <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Undang Teman */}
            <button
              onClick={() => {
                close()
                st.set({ membersOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3.5 text-left hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-lg">
                👥
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Undang Teman
                </div>
                <div className="text-[11px] text-bone/50">
                  Buatkan username & password untuk teman
                </div>
              </div>
            </button>

            {/* 2. Suara Proximity & Audio */}
            <button
              onClick={() => {
                close()
                st.set({ audioSettingsOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                🎙️
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Spatial Voice Chat
                </div>
                <div className="text-[11px] text-bone/50">
                  Atur radius suara Roblox (3m–30m) & Mic
                </div>
              </div>
            </button>

            {/* 3. Hubungkan ke IDE */}
            <button
              onClick={() => {
                close()
                st.set({ ideModalOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                💻
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Hubungkan ke IDE
                </div>
                <div className="text-[11px] text-bone/50">
                  Antigravity, Cursor, Codex CLI
                </div>
              </div>
            </button>

            {/* 4. Model Context Protocol (MCP) */}
            <button
              onClick={() => {
                close()
                st.set({ mcpOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                🔌
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  MCP Tools
                </div>
                <div className="text-[11px] text-bone/50">
                  Integrasikan tool & server external
                </div>
              </div>
            </button>

            {/* 5. Ganti Office / Realm */}
            <button
              onClick={() => setShowRealms(true)}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                🏢
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Pindah Realm / Office
                </div>
                <div className="text-[11px] text-bone/50">
                  Beralih ke ruangan kantor lain
                </div>
              </div>
            </button>

            {/* 6. Jadwal Kantor */}
            <button
              onClick={() => {
                close()
                st.set({ scheduleConfigOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                ⏰
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Jadwal & Shift Kerja
                </div>
                <div className="text-[11px] text-bone/50">
                  Waktu kerja, istirahat & standup
                </div>
              </div>
            </button>

            {/* 7. Pengaturan Grafis */}
            <button
              onClick={() => {
                close()
                st.set({ settingsOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                ⚙️
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Pengaturan Grafis & Kontrol
                </div>
                <div className="text-[11px] text-bone/50">
                  Sensitivitas mouse, bayangan, FPS
                </div>
              </div>
            </button>

            {/* 8. Webhooks & Integrations */}
            <button
              onClick={() => {
                close()
                st.set({ integrationsOpen: true })
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-left hover:border-white/20 hover:bg-white/[0.06] transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                🔔
              </div>
              <div>
                <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                  Webhooks & Notifikasi
                </div>
                <div className="text-[11px] text-bone/50">
                  Telegram, Discord, Slack bridge
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Footer: Logout */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <div className="text-[11px] font-mono text-white/40">
            Tekan <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">ESC</kbd> untuk menutup menu
          </div>
          <button
            onClick={() => {
              close()
              void signOut()
            }}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-1.5 text-xs font-mono font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <span>🚪</span>
            <span>KELUAR / LOGOUT</span>
          </button>
        </div>
      </div>
    </div>
  )
}

