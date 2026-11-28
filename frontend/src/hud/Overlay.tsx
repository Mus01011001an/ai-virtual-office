import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { isTyping } from '../camera/input'
import { toggleGatherAll, toggleSummon } from '../state/gather'
import { enterOffice, openOfficeNew, signOut } from '../state/remote'
import { AuthCard } from './Auth'
import { speechRecognizer } from '../audio/speech-recognition'
import { isTouchOrIPad } from '../camera/CameraRig'
import { BlockyAvatar } from './BlockyAvatar'
import type { Appearance } from '../state/types'

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
    <div className="absolute inset-0 z-50 overflow-hidden bg-gradient-to-b from-[#5cb8ff] via-[#8fd0ff] to-[#d7f0ff] text-slate-800">
      <SkyDecor />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col overflow-y-auto p-5 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-[17px] font-semibold text-white drop-shadow-[0_2px_0_rgba(0,60,140,0.35)]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[18px] shadow-[0_4px_0_#9cc4ef]">🏢</span>
            AI Office
          </div>
          {st.me && (
            <div className="flex items-center gap-2 rounded-full bg-white/90 py-1 pl-4 pr-1 text-[13px] shadow-[0_4px_0_#9cc4ef]">
              <span className="font-semibold text-slate-700">{st.me.name}</span>
              <button onClick={() => void signOut()} className="rounded-full px-3 py-1 font-semibold text-slate-500 hover:bg-slate-100 hover:text-rose-500">Keluar</button>
            </div>
          )}
        </div>

        <div className="my-auto flex flex-col items-center py-8 text-center">
          <TeamParade />
          <h1 className="mt-5 font-display text-[clamp(36px,6vw,64px)] font-bold leading-none text-white drop-shadow-[0_5px_0_rgba(0,70,160,0.35)]">
            Kantor AI-mu
          </h1>
          <p className="mt-3 max-w-md text-[14px] text-slate-700/80">
            Masuk ke kantor 3D bersama tim AI, teman, dan dirimu sendiri. Semua AI berbagi satu otak.
          </p>

          {!st.authChecked && <div className="mt-8 font-display text-[16px] text-white">Memuat…</div>}
          {st.authChecked && !st.me && <AuthCard />}

          {st.authChecked && st.me && (
            <div className="mt-7 w-full max-w-2xl text-left">
              {err && <div className="mb-3 rounded-2xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-600">{err}</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {st.offices.map((o) => {
                  const isNew = o.experience === 'new'
                  // Dua pintu masuk: tombol hijau = jenis kantor yang dipilih saat dibuat, tombol putih = jenis lainnya.
                  const open = async (exp: 'classic' | 'new') => {
                    runtime.player.x = 0
                    setBusy(o.id); setErr('')
                    try { if (exp === 'new') await openOfficeNew(o.id); else await enterOffice(o.id) } catch (e) { setErr((e as Error).message) }
                    setBusy(null)
                  }
                  const primary = isNew ? 'new' : 'classic'
                  const secondary = isNew ? 'classic' : 'new'
                  const label = (exp: 'classic' | 'new') => (exp === 'new' ? 'Kantor baru' : 'Kantor lama')
                  return (
                    <div key={o.id} className="flex items-center gap-4 rounded-[24px] bg-white p-4 text-left shadow-[0_6px_0_#b9d3ee]">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-100 text-[26px]">🏢</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[18px] font-semibold text-slate-900">{o.name}</span>
                        <span className="block text-[12.5px] text-slate-500">{o.employeeCount ?? 0} AI · {o.timezone}</span>
                        <button disabled={!!busy} onClick={() => void open(secondary)} className="mt-0.5 text-[12px] font-semibold text-sky-600 hover:underline disabled:opacity-60">
                          Buka di {label(secondary)} →
                        </button>
                      </span>
                      <button disabled={!!busy} onClick={() => void open(primary)}
                        className="shrink-0 rounded-xl bg-[#22c55e] px-3.5 py-2 font-display text-[14px] font-semibold text-white shadow-[0_4px_0_#15803d] transition-transform hover:-translate-y-0.5 active:translate-y-[3px] disabled:opacity-60">
                        {busy === o.id ? '…' : isNew ? 'Masuk · baru' : 'Masuk'}
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={() => st.set({ newOfficeOpen: true })}
                  className="flex min-h-[88px] items-center justify-center gap-2 rounded-[24px] border-[3px] border-dashed border-white/80 bg-white/25 font-display text-[16px] font-semibold text-white transition-colors hover:bg-white/40"
                >
                  + Buat kantor
                </button>
              </div>
            </div>
          )}
        </div>

        {progress < 100 && <div className="pb-1 text-center text-[12px] text-slate-600/70">Memuat aset {Math.round(progress)}%</div>}
      </div>
    </div>
  )
}

/** Awan blok yang melayang pelan (CSS murni, tanpa WebGL). */
function SkyDecor() {
  const clouds = [[6, 14, 1], [70, 9, 1.3], [38, 72, 0.9], [84, 64, 1.1], [14, 80, 0.8]] as const
  return (
    <div className="pointer-events-none absolute inset-0">
      {clouds.map(([x, y, s], i) => (
        <div key={i} className="floaty absolute" style={{ left: `${x}%`, top: `${y}%`, transform: `scale(${s})`, animationDelay: `${i * -1.3}s` }}>
          <div className="relative h-10 w-36">
            <div className="absolute bottom-0 h-7 w-36 rounded-2xl bg-white/80" />
            <div className="absolute bottom-4 left-6 h-9 w-14 rounded-2xl bg-white/80" />
            <div className="absolute bottom-3 left-16 h-7 w-12 rounded-2xl bg-white/80" />
          </div>
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#7fd36a] to-[#9be07f]" />
      <div className="absolute inset-x-0 bottom-24 h-2 bg-[#6cc24a]" />
    </div>
  )
}

const PARADE: Partial<Appearance>[] = [
  { skin: '#e0ac85', hair: '#1c1714', hairStyle: 1, top: '#e4572e', face: 1 },
  { skin: '#c68b62', hair: '#120f0d', hairStyle: 3, top: '#17a398', accessory: 'cap' },
  { skin: '#f2c9a0', hair: '#2b2118', hairStyle: 0, top: '#2a3a5f', glasses: true, jacket: true },
  { skin: '#8d5a3b', hair: '#0f0d0c', hairStyle: 0, top: '#1b1b1e', accessory: 'headphones', face: 3 },
  { skin: '#f5d0b5', hair: '#6b3e26', hairStyle: 2, top: '#f2c14e', glasses: true, face: 2 },
]

function TeamParade() {
  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {PARADE.map((ap, i) => (
        <div key={i} className="floaty" style={{ animationDelay: `${i * -0.9}s`, animationDuration: '3.6s' }}>
          <div className="rounded-[18px] bg-white p-1 shadow-[0_5px_0_#9cc4ef]"><BlockyAvatar ap={ap} size={i === 2 ? 72 : 56} /></div>
        </div>
      ))}
    </div>
  )
}
