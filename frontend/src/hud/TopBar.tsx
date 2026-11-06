import { useEffect, useRef, useState } from 'react'
import { useOffice, currentOffice } from '../state/store'
import { officeNow, scheduleState } from '../lib/time'
import { DemoBadge, IconBtn } from './ui'
import { toggleGatherAll } from '../state/gather'
import { archiveCurrentOffice, enterOffice } from '../state/remote'
import { speechRecognizer } from '../audio/speech-recognition'

function Clock({ compact }: { compact?: boolean }) {
  const tz = useOffice((s) => s.offices.find((o) => o.id === s.currentOfficeId)?.timezone ?? 'UTC')
  const shiftState = useOffice((s) => s.shiftState)
  const set = useOffice((s) => s.set)
  const [t, setT] = useState(() => officeNow(tz))
  useEffect(() => { const id = setInterval(() => setT(officeNow(tz)), 1000); return () => clearInterval(id) }, [tz])
  const s = scheduleState(t)
  const p = (n: number) => String(n).padStart(2, '0')
  const label = shiftState?.label ?? s.label
  const nextInfo = shiftState?.nextEvent ?? s.next
  const kind = shiftState?.kind ?? s.kind
  const color = kind === 'work' ? '#22c55e' : kind === 'break' ? '#fb923c' : '#71717a'

  if (compact) {
    return (
      <button
        onClick={() => set({ scheduleConfigOpen: true })}
        className="panel-soft flex h-10 items-center gap-2 rounded-full px-3 hover:bg-ink-2 transition-colors cursor-pointer text-left"
        title={`${label} · ${nextInfo} · Klik untuk atur jadwal`}
      >
        <div className="display text-[15px] leading-none tabular-nums text-bone">{p(t.h)}:{p(t.m)}</div>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      </button>
    )
  }

  return (
    <button
      onClick={() => set({ scheduleConfigOpen: true })}
      className="panel-soft flex items-center gap-3 rounded-full py-1.5 pl-4 pr-5 hover:bg-ink-2 transition-colors cursor-pointer text-left"
      title={`${nextInfo} · Klik untuk atur jadwal`}
    >
      <div className="display text-[20px] leading-none tabular-nums text-bone">{p(t.h)}:{p(t.m)}</div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-bone/90"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</div>
        <div className="text-[10px] text-bone/45">{nextInfo}</div>
      </div>
    </button>
  )
}

function OfficeSwitcher() {
  const st = useOffice()
  const office = currentOffice()
  if (!office) return null
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const demo = st.employees.some((e) => e.isDemo)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="panel-soft flex h-11 items-center gap-2.5 rounded-full pl-1.5 pr-3.5 hover:bg-ink-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#e76f51] text-[14px]">🏢</div>
        <div className="text-left">
          <div className="display flex items-center gap-1 text-[14px] leading-none text-bone">{office.name}<span className="text-xs text-bone/40">▾</span></div>
        </div>
        {demo && <DemoBadge />}
      </button>
      {open && (
        <div className="panel rise absolute left-0 top-[52px] w-72 p-1.5 text-bone z-50 shadow-2xl">
          {st.offices.map((o) => (
            <div key={o.id} className={`group flex items-center rounded-xl ${o.id === office.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}>
              <button className="flex-1 px-3 py-2 text-left" onClick={() => { setOpen(false); if (o.id !== office.id) void enterOffice(o.id).catch((e) => alert(e.message)) }}>
                <div className="text-[13px] font-medium">{o.name}</div>
                <div className="text-[11px] text-bone/45">{o.role ?? '—'} · {o.template === 'demo-team' ? 'tim demo' : `${o.employeeCount ?? 0} employee`} · {o.timezone}</div>
              </button>
              {o.id === office.id && o.isOwner && (
                <button className="mr-2 hidden rounded-full px-2 py-0.5 text-[11px] text-red-300/80 hover:bg-red-400/10 group-hover:block"
                  onClick={() => { if (confirm(`Arsipkan office "${o.name}"? Bisa dipulihkan lagi nanti.`)) void archiveCurrentOffice().catch((e) => alert(e.message)) }}>Arsipkan</button>
              )}
            </div>
          ))}
          <button className="mt-1 w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-accent hover:bg-white/[0.05]"
            onClick={() => { setOpen(false); st.set({ newOfficeOpen: true }) }}>+ Sesi Baru (Company)</button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const count = useOffice((s) => s.employees.length)
  const remoteCount = useOffice((s) => s.remoteUsers.length)
  const dirOpen = useOffice((s) => s.directoryOpen)
  const setOpen = useOffice((s) => s.settingsOpen)
  const pendingApprovals = useOffice((s) => s.pendingApprovalsCount)
  const approvalOpen = useOffice((s) => s.approvalOpen)
  const isRecordingVoice = useOffice((s) => s.isRecordingVoice)
  const set = useOffice((s) => s.set)
  const gathered = useOffice((s) => s.summoned.length)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3">
      {/* Sisi Kiri: Switcher & Jam Kantor */}
      <div className="pointer-events-auto flex items-center gap-2">
        <OfficeSwitcher />
        <div className="hidden sm:flex">
          <Clock compact />
        </div>
      </div>

      {/* Sisi Kanan: Kontrol Minimalis & Action Hub */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
        {/* Approvals Bell Alert */}
        <button
          onClick={() => set({ approvalOpen: !approvalOpen })}
          title={pendingApprovals > 0 ? `${pendingApprovals} permohonan otorisasi menunggu persetujuan` : 'Pusat Otorisasi Tindakan Agent'}
          className={`relative panel-soft flex h-9 items-center justify-center rounded-full px-2.5 sm:px-3 text-[13px] font-semibold transition-colors ${
            pendingApprovals > 0 ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' : 'text-bone hover:bg-ink-2'
          }`}
        >
          <span>🔔</span>
          {pendingApprovals > 0 && (
            <span className="ml-1 sm:ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white animate-pulse">
              {pendingApprovals}
            </span>
          )}
        </button>

        {/* Microphone / Speech Dictation */}
        <button
          onClick={() => {
            if (isRecordingVoice) {
              speechRecognizer.stop()
              set({ isRecordingVoice: false })
            } else {
              speechRecognizer.setCallbacks({
                onFinalResult: (text) => set({ dictatedText: text }),
                onStateChange: (listening) => set({ isRecordingVoice: listening }),
              })
              speechRecognizer.start()
              set({ isRecordingVoice: true })
            }
          }}
          title={isRecordingVoice ? 'Sedang merekam suara... Klik untuk berhenti' : "Bicara ke tim (Tahan 'V' atau klik)"}
          className={`panel-soft flex h-9 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-[12px] font-semibold transition-colors ${
            isRecordingVoice ? 'bg-rose-500/25 text-rose-300 ring-1 ring-rose-500/50 animate-pulse' : 'text-bone hover:bg-ink-2'
          }`}
        >
          <span>{isRecordingVoice ? '🔴' : '🎙️'}</span>
          <span className="hidden md:inline">{isRecordingVoice ? 'Merekam…' : 'Mic'}</span>
        </button>

        {/* Tombol Kumpulkan Tim */}
        <button
          onClick={toggleGatherAll}
          title="Semua employee datang ke kamu & mendengarkan (G)"
          className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 sm:px-3.5 text-[12px] font-semibold shadow-lg transition-colors ${
            gathered ? 'bg-bone text-ink hover:bg-white' : 'bg-accent text-ink hover:bg-accent-2'
          }`}
        >
          <span>{gathered ? '👋' : '📣'}</span>
          <span className="hidden sm:inline">{gathered ? `Bubarkan (${gathered})` : 'Kumpulkan'}</span>
        </button>

        {/* Tombol Tim (Directory) */}
        <button
          onClick={() => set({ directoryOpen: !dirOpen })}
          title="Buka daftar AI Employee kantor"
          className={`panel-soft flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
            dirOpen ? 'bg-bone text-ink' : 'text-bone hover:bg-ink-2'
          }`}
        >
          <span>Tim</span>
          <span className={`rounded-full px-1.5 text-[10.5px] ${dirOpen ? 'bg-ink/10 text-ink/70' : 'bg-accent/20 text-accent font-bold'}`}>
            {count}
          </span>
        </button>

        {/* Action Hub Popover (Semua fitur kantor rapi terpadu di satu menu) */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`panel-soft flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors ${
              menuOpen ? 'bg-bone text-ink' : 'text-bone hover:bg-ink-2'
            }`}
            title="Menu Fitur Kantor"
          >
            <span>⚡</span>
            <span className="hidden sm:inline">Menu</span>
            <span className="text-[10px] text-bone/40">▾</span>
          </button>

          {menuOpen && (
            <div className="panel rise absolute right-0 top-11 w-64 p-1.5 text-bone shadow-2xl z-50">
              <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-bone/40">
                🏢 Manajemen Kantor
              </div>

              <button
                onClick={() => { set({ membersOpen: true }); setMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span>👥</span>
                <div>
                  <div className="font-semibold">Anggota & Hak Akses</div>
                  <div className="text-[10px] text-bone/45">Kelola akun & RBAC per user</div>
                </div>
              </button>

              <button
                onClick={() => { set({ mcpOpen: true }); setMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span>🔌</span>
                <div>
                  <div className="font-semibold text-accent">Model Context Protocol (MCP)</div>
                  <div className="text-[10px] text-bone/45">Hubungkan tools MCP untuk semua agent</div>
                </div>
              </button>

              <div className="my-1 border-t border-line" />
              <div className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-bone/40">
                🚀 Kolaborasi & Otomasi
              </div>

              <button
                onClick={() => { set({ standupOpen: true }); setMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span>📋</span> Laporan Standup Harian
              </button>

              <button
                onClick={() => { set({ integrationsOpen: true }); setMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span>🐙</span> Webhook & Integrasi Eksternal
              </button>

              <button
                onClick={() => { set({ audioSettingsOpen: true }); setMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span>🎧</span> Audio Spasial 3D
              </button>

              <button
                onClick={() => { set({ scheduleConfigOpen: true }); setMenuOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span>⏰</span> Atur Jam Kerja & Jadwal Shift
              </button>

              <button
                onClick={() => { set({ showMinimap: !useOffice.getState().showMinimap }); setMenuOpen(false) }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.08]"
              >
                <span className="flex items-center gap-2.5"><span>🗺️</span> Radar Peta Minimap</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-accent border border-white/15">M</span>
              </button>

              <div className="my-1 border-t border-line" />
              <div className="px-3 py-1.5 text-[11px] text-bone/50 flex items-center justify-between">
                <span>Multiplayer Online</span>
                <span className="font-semibold text-emerald-400">👥 {remoteCount + 1} online</span>
              </div>
            </div>
          )}
        </div>

        {/* Pengaturan (Kamera, Sensitivitas, Grafis, Keluar) */}
        <IconBtn title="Pengaturan Kantor" active={setOpen} onClick={() => set({ settingsOpen: !setOpen })}>
          ⚙
        </IconBtn>
      </div>
    </div>
  )
}
