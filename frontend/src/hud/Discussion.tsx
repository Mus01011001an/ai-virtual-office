import { useEffect, useRef, useState } from 'react'
import { useOffice } from '../state/store'
import { dismiss } from '../state/gather'
import { sendMessage } from '../state/discussion'
import { triggerDebate, concludeDiscussion } from '../state/remote'
import { isTyping } from '../camera/input'
import { Btn, PanelHead } from './ui'

/** Panel diskusi: muncul saat ada employee yang dipanggil. Mendukung mode Terbimbing dan Debat Otonom. */
export function Discussion() {
  const summoned = useOffice((s) => s.summoned)
  const employees = useOffice((s) => s.employees)
  const chat = useOffice((s) => s.chat)
  const bubbles = useOffice((s) => s.bubbles)
  const wb = useOffice((s) => s.whiteboard)
  const debateMode = useOffice((s) => s.debateMode)
  const set = useOffice((s) => s.set)

  const [text, setText] = useState('')
  const [debateTopic, setDebateTopic] = useState('')
  const [debating, setDebating] = useState(false)
  const [concluding, setConcluding] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const active = summoned.length > 0
  const dictatedText = useOffice((s) => s.dictatedText)

  useEffect(() => {
    if (dictatedText) {
      setText((prev) => (prev ? `${prev} ${dictatedText}` : dictatedText))
      useOffice.getState().set({ dictatedText: '' })
    }
  }, [dictatedText])

  useEffect(() => {
    log.current?.scrollTo(0, log.current.scrollHeight)
  }, [chat.length, active])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || isTyping()) return
      const st = useOffice.getState()
      if (st.workstationId || st.newOfficeOpen || st.createEmployeeOpen || st.whiteboardOpen) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  if (!active) return null
  const byId = new Map(employees.map((e) => [e.id, e]))
  const typing = summoned
    .filter((id) => bubbles[id] === '…')
    .map((id) => byId.get(id)?.name)
    .filter(Boolean)

  const send = () => {
    if (!text.trim()) return
    sendMessage(text)
    setText('')
    input.current?.blur()
  }

  const handleStartDebate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!debateTopic.trim()) return
    try {
      setDebating(true)
      await triggerDebate(debateTopic.trim(), 3)
      setDebateTopic('')
    } catch (err: any) {
      alert(`Gagal memulai debat: ${err.message}`)
    } finally {
      setDebating(false)
    }
  }

  const handleConclude = async () => {
    if (!confirm('Akhiri rapat sekarang? Risalah rapat (MoM) akan diunggah ke S3 dan tugas otomatis didelegasikan ke tim.')) return
    try {
      setConcluding(true)
      await concludeDiscussion()
      dismiss()
    } catch (err: any) {
      alert(`Gagal menyelesaikan rapat: ${err.message}`)
    } finally {
      setConcluding(false)
    }
  }

  return (
    <div
      className="panel rise pointer-events-auto fixed sm:absolute left-3 sm:left-4 max-sm:left-1/2 max-sm:-translate-x-1/2 bottom-16 sm:bottom-14 z-30 flex max-h-[min(500px,calc(100dvh-170px))] w-[min(390px,calc(100vw-24px))] flex-col text-bone shadow-2xl"
    >
      <PanelHead
        title={`💬 Diskusi · ${summoned.length} orang`}
        sub={debateMode ? 'Mode Debat Otonom Aktif' : 'Yang relevan membalas · sebut nama untuk menunjuk'}
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => set({ whiteboardOpen: true })}
              title="Lihat Papan Tulis (Whiteboard)"
              className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-white/[0.15] transition-colors"
            >
              📋 Papan
            </button>
            <Btn variant="ghost" onClick={() => dismiss()} title="Semua kembali ke meja (G)">
              Bubarkan
            </Btn>
          </div>
        }
      />

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-line bg-black/20 px-3 py-1.5 justify-between items-center text-xs">
        <div className="flex rounded-full bg-white/[0.06] p-0.5">
          <button
            onClick={() => set({ debateMode: false })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              !debateMode ? 'bg-accent text-ink shadow' : 'text-bone/60 hover:text-bone'
            }`}
          >
            Terbimbing
          </button>
          <button
            onClick={() => set({ debateMode: true })}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              debateMode ? 'bg-accent text-ink shadow' : 'text-bone/60 hover:text-bone'
            }`}
          >
            Debat Otonom
          </button>
        </div>

        {/* Consensus Mini Meter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-bone/50">Konsensus:</span>
          <div className="h-2 w-14 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${wb.consensusScore || 0}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-emerald-400">{wb.consensusScore || 0}%</span>
        </div>
      </div>

      {/* Participant Pills */}
      <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-line/40 bg-black/10">
        {summoned.map((id) => {
          const e = byId.get(id)
          if (!e) return null
          return (
            <button
              key={id}
              onClick={() => dismiss([id])}
              title={`Lepas ${e.name}`}
              className="group flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] hover:bg-accent/20"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.appearance.top }} />
              {e.name}
              <span className="text-bone/30 group-hover:text-accent">✕</span>
            </button>
          )
        })}
      </div>

      {/* Autonomous Debate Controls Bar */}
      {debateMode && (
        <form onSubmit={handleStartDebate} className="border-b border-line bg-sky-500/[0.05] p-2 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-sky-300 font-semibold">
            <span>Mulai Debat Otonom Antar-Agen</span>
            <button
              type="button"
              onClick={handleConclude}
              disabled={concluding}
              className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
            >
              {concluding ? 'Menerbitkan…' : '✓ Selesaikan & Buat Tugas'}
            </button>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Topik debat (misal: Desain Caching Redis)..."
              value={debateTopic}
              onChange={(e) => setDebateTopic(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-ink-2 px-2.5 py-1 text-xs text-bone outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={debating || !debateTopic.trim()}
              className="rounded-xl bg-accent px-3 py-1 text-xs font-bold text-ink hover:bg-accent-2 disabled:opacity-50"
            >
              {debating ? 'Debat…' : 'Mulai'}
            </button>
          </div>
        </form>
      )}

      {/* Message Chat Feed */}
      <div ref={log} className="min-h-[110px] flex-1 space-y-2 overflow-y-auto px-3 py-2 text-[12px] leading-snug">
        {chat.map((m) => {
          if (m.from === 'system')
            return (
              <div key={m.id} className="rounded-xl bg-white/[0.03] p-1.5 text-center text-[11px] italic text-bone/50 border border-white/[0.05]">
                {m.text}
              </div>
            )
          if (m.from === 'me')
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-1.5 text-ink shadow">
                  {m.text}
                </div>
              </div>
            )
          const e = byId.get(m.from)

          // Stance badge
          const stance = m.stance && m.stance !== 'NEUTRAL' ? m.stance.toUpperCase() : null
          const stanceCls =
            stance === 'PROPOSE'
              ? 'bg-sky-400/20 text-sky-300 border-sky-400/30'
              : stance === 'CRITIQUE'
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
              : stance === 'SUPPORT'
              ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30'
              : stance === 'SYNTHESIZE'
              ? 'bg-purple-400/20 text-purple-300 border-purple-400/30'
              : ''

          return (
            <div key={m.id} className="max-w-[92%]">
              <div className="mb-0.5 flex items-center gap-1.5 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: e?.appearance.top }} />
                <span className="text-[12.5px] font-semibold text-bone">{e?.name ?? '?'}</span>
                <span className="text-bone/40">{e?.role}</span>
                {stance && (
                  <span className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${stanceCls}`}>
                    {stance}
                  </span>
                )}
                {m.demo && (
                  <span className="rounded-full bg-demo px-1.5 text-[9px] font-bold leading-[14px] text-ink">
                    Demo
                  </span>
                )}
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white/[0.07] px-3 py-1.5 text-bone/90 leading-relaxed">
                {m.text}
              </div>
            </div>
          )
        })}
        {!chat.length && <div className="text-bone/35 text-center py-4">Mulai diskusi atau klik Mode Debat Otonom…</div>}
      </div>

      {/* Input Bottom Bar */}
      <div className="border-t border-line p-2">
        {typing.length > 0 && (
          <div className="mb-1 px-1 text-[11px] text-bone/45 animate-pulse">
            {typing.join(', ')} sedang merumuskan tanggapan…
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') send()
              if (e.key === 'Escape') input.current?.blur()
            }}
            onKeyUp={(e) => e.stopPropagation()}
            placeholder={debateMode ? 'Berikan arahan tambahan ke debat…' : 'Ketik pesan instruksi rapat…'}
            className="w-full rounded-full border border-line bg-ink-2 px-4 py-2 text-sm text-bone outline-none placeholder:text-bone/30 focus:border-accent/70"
          />
          {!debateMode && (
            <button
              onClick={handleConclude}
              disabled={concluding}
              title="Selesaikan rapat dan terbitkan MoM ke S3"
              className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              ✓ Selesai
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

