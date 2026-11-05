import { useEffect, useRef, useState } from 'react'
import { useOffice } from '../state/store'
import { dismiss } from '../state/gather'
import { sendMessage } from '../state/discussion'
import { isTyping } from '../camera/input'
import { Btn, PanelHead } from './ui'

/** Panel diskusi: muncul saat ada employee yang dipanggil. Enter = fokus ketik, Enter lagi = kirim. */
export function Discussion() {
  const summoned = useOffice((s) => s.summoned)
  const employees = useOffice((s) => s.employees)
  const chat = useOffice((s) => s.chat)
  const bubbles = useOffice((s) => s.bubbles)
  const dirOpen = useOffice((s) => s.directoryOpen)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const active = summoned.length > 0

  useEffect(() => { log.current?.scrollTo(0, log.current.scrollHeight) }, [chat.length, active])
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || isTyping()) return
      const st = useOffice.getState()
      if (st.workstationId || st.newOfficeOpen || st.createEmployeeOpen) return
      e.preventDefault(); input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  if (!active) return null
  const byId = new Map(employees.map((e) => [e.id, e]))
  const typing = summoned.filter((id) => bubbles[id] === '…').map((id) => byId.get(id)?.name).filter(Boolean)
  const send = () => { if (!text.trim()) return; sendMessage(text); setText(''); input.current?.blur() }

  return (
    <div style={{ left: dirOpen ? 306 : 12 }} className="panel rise pointer-events-auto absolute bottom-14 z-30 flex transition-[left] duration-200 max-h-[min(440px,calc(100vh-240px))] w-[380px] flex-col text-bone">
      <PanelHead title={`💬 Diskusi · ${summoned.length} orang`} sub="Yang relevan saja yang membalas · sebut nama untuk menunjuk"
        right={<Btn variant="ghost" onClick={() => dismiss()} title="Semua kembali ke meja (G)">Bubarkan</Btn>} />
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {summoned.map((id) => {
          const e = byId.get(id)
          if (!e) return null
          return (
            <button key={id} onClick={() => dismiss([id])} title={`Lepas ${e.name}`}
              className="group flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] hover:bg-accent/20">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.appearance.top }} />{e.name}
              <span className="text-bone/30 group-hover:text-accent">✕</span>
            </button>
          )
        })}
      </div>
      <div ref={log} className="min-h-[90px] flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-[12px] leading-snug">
        {chat.map((m) => {
          if (m.from === 'system') return <div key={m.id} className="text-[11px] italic text-bone/40">{m.text}</div>
          if (m.from === 'me') return (
            <div key={m.id} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-1.5 text-ink">{m.text}</div></div>
          )
          const e = byId.get(m.from)
          return (
            <div key={m.id} className="max-w-[90%]">
              <div className="mb-0.5 flex items-center gap-1.5 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: e?.appearance.top }} /><span className="text-[12.5px] font-semibold text-bone">{e?.name ?? '?'}</span>
                <span className="text-bone/40">{e?.role}</span>
                {m.demo && <span className="rounded-full bg-demo px-1.5 text-[9px] font-bold leading-[14px] text-ink">Demo</span>}
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white/[0.07] px-3 py-1.5 text-bone/90">{m.text}</div>
            </div>
          )
        })}
        {!chat.length && <div className="text-bone/35">Mulai diskusi…</div>}
      </div>
      <div className="border-t border-line p-2">
        {typing.length > 0 && <div className="mb-1 px-1 text-[11px] text-bone/45">{typing.join(', ')} sedang mengetik…</div>}
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); if (e.key === 'Escape') input.current?.blur(); e.stopPropagation() }}
          placeholder="Tekan Enter lalu ketik pesan…"
          className="w-full rounded-full border border-line bg-ink-2 px-4 py-2 text-sm text-bone outline-none placeholder:text-bone/30 focus:border-accent/70" />
      </div>
    </div>
  )
}
