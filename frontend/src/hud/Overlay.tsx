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
        return st.set({ selectedId: null, settingsOpen: false, directoryOpen: false })
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
  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'
  return (
    <div className="absolute inset-0 z-50 overflow-hidden text-bone"
      style={{ background: 'radial-gradient(1200px 700px at 85% 15%, #5b3a6b 0%, transparent 60%), radial-gradient(900px 600px at 10% 100%, #7a4a2a 0%, transparent 55%), linear-gradient(160deg, #221c2b 0%, #1b1918 60%)' }}>
      {/* lampu-lampu bokeh hangat */}
      {[[12, 18, 140, '#f4a259'], [78, 70, 220, '#e76f51'], [62, 22, 90, '#ffd166'], [30, 80, 160, '#7fd1b9']].map(([x, y, r, c], i) => (
        <div key={i} className="floaty pointer-events-none absolute rounded-full opacity-25 blur-3xl"
          style={{ left: `${x}%`, top: `${y}%`, width: r as number, height: r as number, background: c as string, animationDelay: `${i * 1.3}s` }} />
      ))}

      <div className="relative mx-auto flex h-full max-w-5xl items-center gap-12 px-8">
        <div className="flex-1">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1 text-[12px] text-bone/70">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Virtual AI Office
          </div>
          <h1 className="display text-[clamp(36px,5vw,56px)] leading-[1.05]">
            {greet} 👋<br /><span className="text-bone/60">Mau ke kantor mana hari ini?</span>
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-bone/55">
            Jalan-jalan di kantormu, sapa tim AI, kumpulkan mereka untuk diskusi, dan lihat pekerjaan mereka langsung di layar.
          </p>

          {!st.authChecked && <div className="mt-8 text-sm text-bone/50">Menghubungkan ke server…</div>}
          {st.authChecked && !st.me && <AuthCard />}
          {st.me && (<>
          <div className="mt-6 flex items-center gap-2 text-[12px] text-bone/55">
            Masuk sebagai <b className="text-bone/80">{st.me.name}</b>
            <button onClick={() => void signOut()} className="rounded-full px-2 py-0.5 text-bone/50 hover:bg-white/10 hover:text-bone">Keluar</button>
          </div>
          {err && <div className="mt-3 max-w-xl rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
          <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
            {st.offices.map((o) => (
              <button key={o.id} disabled={!!busy} onClick={async () => {
                runtime.player.x = 0; setBusy(o.id); setErr('')
                try { await enterOffice(o.id) } catch (e) { setErr((e as Error).message) }
                setBusy(null)
              }}
                className="group rounded-3xl border border-white/[0.08] bg-white/[0.05] p-5 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-white/[0.08]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#e76f51] text-xl shadow-lg">
                  {o.template === 'demo-team' ? '🏢' : '🏠'}
                </div>
                <div className="display text-[17px]">{o.name}</div>
                <div className="mt-1 text-[12px] text-bone/50">{o.template === 'demo-team' ? 'Tim demo + ' : ''}{o.employeeCount ?? 0} employee · {o.role ?? '—'} · {o.timezone}</div>
                <div className="mt-4 text-[12.5px] font-semibold text-accent opacity-70 transition group-hover:opacity-100">{busy === o.id ? 'Masuk…' : 'Masuk kantor →'}</div>
              </button>
            ))}
            <button onClick={() => st.set({ newOfficeOpen: true })}
              className="flex flex-col items-start justify-center rounded-3xl border border-dashed border-white/15 p-5 text-left text-bone/60 transition hover:border-accent/60 hover:text-bone">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.07] text-xl">＋</div>
              <div className="display text-[16px]">Sesi baru</div>
              <div className="mt-1 text-[12px] text-bone/45">Buat kantor terpisah</div>
            </button>
          </div>
          </>)}

          <div className="mt-8 text-[11px] text-bone/35">
            Data tersimpan di server · multiplayer menyusul (Phase 5){progress < 100 && ` · memuat aset ${Math.round(progress)}%`}
          </div>
        </div>

        {/* ilustrasi kecil: kartu "tim" */}
        <div className="hidden w-[300px] shrink-0 lg:block">
          <div className="floaty rounded-[28px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between text-[12px] text-bone/60"><span>Tim hari ini</span><span>☕ 09:00–18:00</span></div>
            {[['Alex', 'DevOps', '#22c55e', 'Sedang deploy'], ['Sarah', 'Frontend', '#a855f7', 'Berpikir…'], ['Nadia', 'Project Manager', '#3b82f6', 'Meeting'], ['Dewi', 'UI/UX', '#fb923c', 'Istirahat']].map(([n, r, c, s]) => (
              <div key={n} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{n.slice(0, 1)}</div>
                <div className="flex-1"><div className="text-[13px] font-semibold">{n}</div><div className="text-[11px] text-bone/45">{r}</div></div>
                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-bone/70"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{s}</span>
              </div>
            ))}
            <div className="mt-2 rounded-2xl bg-accent/15 px-3 py-2 text-[11.5px] text-accent">Ilustrasi · data tim demo</div>
          </div>
        </div>
      </div>
    </div>
  )
}
