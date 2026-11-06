import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { isTyping } from '../camera/input'
import { toggleGatherAll, toggleSummon } from '../state/gather'
import { enterOffice, signOut } from '../state/remote'
import { AuthCard } from './Auth'
import { speechRecognizer } from '../audio/speech-recognition'
import { isTouchOrIPad } from '../camera/CameraRig'
import { GameTitleScene } from './game/GameTitleScene'

const anyPanel = (s: ReturnType<typeof useOffice.getState>) =>
  !!s.workstationId || s.newOfficeOpen || s.createEmployeeOpen

/** Titik tengah sederhana (bukan crosshair bidik). Sedikit membesar saat mengarah ke orang. */
export function Crosshair() {
  const locked = useOffice((s) => s.locked)
  const mode = useOffice((s) => s.cameraMode)
  const onTarget = useOffice((s) => !!s.hoveredId)
  if (!locked || mode === 'iso') return null
  const size = onTarget ? 7 : 5
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_0_1.5px_rgba(0,0,0,0.35)] transition-all"
      style={{ width: size, height: size }} />
  )
}

/** Ajakan klik untuk mengaktifkan kontrol mouse (mode Mata / Bahu dengan mouse-look). */
export function ClickToPlay() {
  const locked = useOffice((s) => s.locked)
  const mode = useOffice((s) => s.cameraMode)
  const mouseLook = useOffice((s) => s.mouseLook)
  const busy = useOffice((s) => anyPanel(s) || !!s.selectedId || s.settingsOpen || s.directoryOpen)
  if (locked || busy || mode === 'iso' || (mode === 'tps' && !mouseLook)) return null
  return (
    <div className="pointer-events-none absolute bottom-[30%] left-1/2 z-20 -translate-x-1/2 text-center">
      <div className="flex items-center gap-2 rounded-full bg-ink/80 px-5 py-2.5 text-[13px] font-medium text-bone shadow-lg">
        <span>🖱️</span>Klik layar untuk mulai melihat-lihat
      </div>
    </div>
  )
}

export function InteractPrompt() {
  const id = useOffice((s) => s.nearbyId ?? (s.locked ? s.hoveredId : null))
  const e = useOffice((s) => s.employees.find((x) => x.id === id))
  const blocked = useOffice((s) => !!s.workstationId || s.selectedId === id)
  const summoned = useOffice((s) => !!id && s.summoned.includes(id))
  const nearbySeat = useOffice((s) => s.nearbySeat)
  const isSitting = useOffice((s) => s.isSitting)

  if (blocked) return null

  // 1. Jika sedang duduk
  if (isSitting) {
    return (
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 text-bone">
        <div className="panel-soft rise flex items-center gap-2 rounded-full py-2 px-4 shadow-xl border border-amber-500/30 bg-black/85 font-mono text-xs text-amber-200">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">E</kbd>
            <span>atau</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white">WASD</kbd>
            <span>Berdiri</span>
          </span>
        </div>
      </div>
    )
  }

  // 2. Jika sedang dekat agen AI
  if (e) {
    return (
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 text-bone">
        <div className="panel-soft rise flex items-center gap-4 rounded-full py-1.5 pl-1.5 pr-4 shadow-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ background: e.appearance.top }}>{e.name.slice(0, 1)}</div>
          <div>
            <div className="display text-[14px] leading-none">{e.name}</div>
            <div className="text-[11px] text-bone/50">{e.role}</div>
          </div>
          <div className="flex gap-3 text-[11px] text-bone/80"><span><kbd>Q</kbd> {summoned ? 'Lepas' : 'Panggil'}</span><span><kbd>E</kbd> Profil</span><span><kbd>F</kbd> Monitor</span></div>
        </div>
      </div>
    )
  }

  // 3. Jika sedang dekat kursi kosong
  if (nearbySeat) {
    return (
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 text-bone">
        <div className="panel-soft rise flex items-center gap-2 rounded-full py-2 px-4 shadow-xl border border-white/20 bg-black/85 font-mono text-xs text-bone">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-bold text-white">E</kbd>
            <span>Duduk di {nearbySeat.label}</span>
          </span>
        </div>
      </div>
    )
  }

  return null
}

export function ControlsHint() {
  const mode = useOffice((s) => s.cameraMode)
  const show = useOffice((s) => s.showHints)
  const locked = useOffice((s) => s.locked)
  const mouseLook = useOffice((s) => s.mouseLook)

  // Sembunyikan otomatis pada mobile/touch agar tidak menabrak virtual joystick
  const isTouch = typeof window !== 'undefined' && (isTouchOrIPad() || window.innerWidth < 1024)
  if (!show || isTouch) return null
  const items: [string, string][] = [['WASD', 'Gerak'], ['Shift', 'Lari'], ['V', 'Kamera'], ['Tab', 'Tim'], ['M', 'Peta'], ['G', 'Kumpulkan'], ['Enter', 'Chat']]
  if (mode === 'iso') items.push(['Klik', 'Jalan ke sana'], ['RMB', 'Putar'])
  else if (locked) items.push(['Klik', 'Pilih'], ['Alt', 'Lepas kursor'])
  else if (mode === 'tps' && !mouseLook) items.push(['RMB', 'Putar kamera'])
  items.push(['H', 'Sembunyikan'])
  return (
    <div className="panel-soft pointer-events-none absolute bottom-3 left-3 z-30 flex max-w-[calc(100vw-260px)] flex-wrap gap-x-3 gap-y-1 rounded-full px-4 py-1.5 text-[11px] text-bone/70">
      {items.map(([k, l]) => <span key={k} className="flex items-center gap-1"><kbd>{k}</kbd>{l}</span>)}
    </div>
  )
}

export function Hotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) return
      const st = useOffice.getState()
      if (e.code === 'Escape') {
        if (st.workstationId) return st.set({ workstationId: null })
        if (st.newOfficeOpen || st.createEmployeeOpen) return st.set({ newOfficeOpen: false, createEmployeeOpen: false })
        if (
          st.selectedId ||
          st.settingsOpen ||
          st.directoryOpen ||
          st.membersOpen ||
          st.mcpOpen ||
          st.approvalOpen ||
          st.scheduleConfigOpen ||
          st.integrationsOpen ||
          st.audioSettingsOpen ||
          st.standupOpen ||
          st.ideModalOpen
        ) {
          return st.set({
            selectedId: null,
            settingsOpen: false,
            directoryOpen: false,
            membersOpen: false,
            mcpOpen: false,
            approvalOpen: false,
            scheduleConfigOpen: false,
            integrationsOpen: false,
            audioSettingsOpen: false,
            standupOpen: false,
            ideModalOpen: false,
          })
        }
        if (st.entered) {
          return st.set({ escapeMenuOpen: !st.escapeMenuOpen })
        }
      }
      if (!st.entered || anyPanel(st)) return
      switch (e.code) {
        case 'AltLeft': case 'AltRight': e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); break
        case 'KeyC': st.cycleCamera(); break
        case 'KeyV': {
          e.preventDefault()
          if (!st.isRecordingVoice) {
            st.set({ isRecordingVoice: true })
            speechRecognizer.setCallbacks({
              onFinalResult: (text) => {
                st.set({ dictatedText: text })
              },
              onStateChange: (rec) => {
                st.set({ isRecordingVoice: rec })
              },
            })
            speechRecognizer.start()
          }
          break
        }
        case 'Digit1': st.set({ cameraMode: 'fps' }); break
        case 'Digit2': st.set({ cameraMode: 'tps' }); break
        case 'Digit3': st.set({ cameraMode: 'iso' }); break
        case 'Tab': st.set({ directoryOpen: !st.directoryOpen }); break
        case 'KeyN': st.set({ showNames: !st.showNames }); break
        case 'KeyH': st.set({ showHints: !st.showHints }); break
        case 'KeyM': st.set({ showMinimap: !st.showMinimap }); break
        case 'KeyW': case 'KeyS': case 'KeyA': case 'KeyD': case 'Space': {
          if (runtime.player.sitting) {
            runtime.player.sitting = false
            runtime.player.seatedInfo = null
            st.set({ isSitting: false })
          }
          break
        }
        case 'KeyG': toggleGatherAll(); break
        case 'KeyQ': { const id = st.nearbyId ?? (runtime.pointerLocked ? st.hoveredId : null) ?? st.selectedId; if (id) toggleSummon(id); break }
        case 'KeyE': {
          if (runtime.player.sitting) {
            runtime.player.sitting = false
            runtime.player.seatedInfo = null
            st.set({ isSitting: false })
            break
          }
          const id = st.nearbyId ?? (runtime.pointerLocked ? st.hoveredId : null)
          if (id) {
            document.exitPointerLock?.()
            st.set({ selectedId: id })
            break
          }
          if (runtime.nearbySeat) {
            runtime.player.sitting = true
            runtime.player.seatedInfo = runtime.nearbySeat
            st.set({ isSitting: true })
            break
          }
          break
        }
        case 'KeyF': { const id = st.nearbyId ?? (runtime.pointerLocked ? st.hoveredId : null) ?? st.selectedId; if (id) { document.exitPointerLock?.(); st.set({ workstationId: id, selectedId: id }) } break }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        const st = useOffice.getState()
        if (st.isRecordingVoice) {
          speechRecognizer.stop()
          st.set({ isRecordingVoice: false })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
  return null
}

export function LoadingBar() {
  const { progress, active } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-50 h-[2px] bg-white/10">
      <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
    </div>
  )
}

export function StartScreen() {
  const st = useOffice()
  const { progress } = useProgress()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  return (
    <div className="absolute inset-0 z-50 overflow-hidden text-bone bg-[#07080d]">
      {/* 3D Realtime Orbiting Cyber Island Scene */}
      <GameTitleScene />

      {/* Cyber Grid Lines Overlay & Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#07080deb_85%)]" />

      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-between p-6 sm:p-10 z-10 overflow-y-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/25 bg-black/50 px-3.5 py-1 text-xs font-mono font-bold tracking-wider text-cyan-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>AI VIRTUAL OFFICE SYSTEM v2.0</span>
          </div>

          {st.me && (
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 backdrop-blur-md">
              <span className="text-xs font-mono text-white/50">OPERATOR:</span>
              <span className="text-xs font-mono font-bold text-cyan-300">{st.me.name}</span>
              <button
                onClick={() => void signOut()}
                className="ml-2 rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-mono text-white/70 hover:border-rose-400 hover:text-rose-300 transition-colors"
              >
                LOGOUT
              </button>
            </div>
          )}
        </div>

        {/* Center Hero & Login or World Slots */}
        <div className="my-auto py-6 flex flex-col items-center text-center">
          <div className="mb-2 text-xs font-mono tracking-[0.3em] uppercase text-cyan-400/90 drop-shadow-[0_0_12px_rgba(0,245,212,0.6)]">
            ✦ AUTONOMOUS MULTI-AGENT VIRTUAL ENVIRONMENT ✦
          </div>
          <h1 className="font-mono font-black text-[clamp(32px,5.5vw,58px)] leading-[1.05] tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-cyan-300 drop-shadow-[0_4px_30px_rgba(0,245,212,0.35)]">
            VIRTUAL OFFICE
          </h1>
          <p className="mt-2.5 max-w-lg text-xs sm:text-sm font-sans text-white/60 leading-relaxed">
            Kantor simulasi 3D interaktif. Sapa dan bimbing agen AI, jalankan rapat strategi, dan pantau kemajuan kerja tim secara real-time.
          </p>

          {!st.authChecked && (
            <div className="mt-8 flex items-center gap-2 font-mono text-sm text-cyan-300/70 animate-pulse">
              <span>INITIALIZING SYSTEM PROTOCOLS…</span>
            </div>
          )}

          {st.authChecked && !st.me && <AuthCard />}

          {st.authChecked && st.me && (
            <div className="mt-6 w-full max-w-2xl">
              <div className="mb-3 flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold uppercase tracking-wider">
                  SELECT REALM / PILIH DUNIA KANTOR:
                </span>
                <span className="text-white/40">{st.offices.length} REALMS READY</span>
              </div>

              {err && (
                <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-xs font-mono text-rose-300">
                  ⚠️ {err}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {st.offices.map((o, idx) => (
                  <button
                    key={o.id}
                    disabled={!!busy}
                    onClick={async () => {
                      runtime.player.x = 0
                      setBusy(o.id)
                      setErr('')
                      try {
                        await enterOffice(o.id)
                      } catch (e) {
                        setErr((e as Error).message)
                      }
                      setBusy(null)
                    }}
                    className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 text-left backdrop-blur-xl transition-all hover:border-cyan-400 hover:bg-cyan-950/20 hover:shadow-[0_0_25px_rgba(0,245,212,0.2)] active:scale-[0.98] cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-white/40 mb-2">
                        <span>SLOT {String(idx + 1).padStart(2, '0')}</span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                          ONLINE
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono text-white group-hover:text-cyan-300 transition-colors">
                        {o.name}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {o.template === 'demo-team' ? 'Tim Demo · ' : ''}
                        {o.employeeCount ?? 0} AI Agents · {o.timezone}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs font-mono font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                      <span>{busy === o.id ? 'CONNECTING…' : 'ENTER REALM'}</span>
                      <span>➔</span>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => st.set({ newOfficeOpen: true })}
                  className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/30 p-5 text-center text-white/60 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/15 backdrop-blur-xl transition-all cursor-pointer min-h-[140px]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl font-bold mb-2">
                    ＋
                  </div>
                  <div className="font-mono text-xs font-bold uppercase tracking-wider">
                    CREATE NEW REALM
                  </div>
                  <div className="text-[11px] text-white/40 mt-1">
                    Buat ruang kantor terpisah
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] font-mono text-white/35 pt-4">
          <span>HOSTED ON PRIVATE ARM64 INSTANCE</span>
          <span>{progress < 100 ? `LOADING ASSETS: ${Math.round(progress)}%` : 'SYSTEM: ALL MODULES READY'}</span>
        </div>
      </div>
    </div>
  )
}
