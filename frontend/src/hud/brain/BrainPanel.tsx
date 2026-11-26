import { useEffect, useMemo, useState } from 'react'
import { can, useOffice } from '../../state/store'
import { addBrainNote, BRAIN_KIND_META, deleteBrain, fetchBrain, pinBrain, type BrainEntry, type BrainKind } from '../../state/catalog'
import { Btn, CloseBtn, PanelHead, inputCls } from '../ui'
import { MarkdownView } from '../MarkdownView'

const FILTERS: { id: '' | BrainKind; label: string }[] = [
  { id: '', label: 'Semua' }, { id: 'brief', label: 'Brief' }, { id: 'decision', label: 'Keputusan' },
  { id: 'result', label: 'Hasil' }, { id: 'asset', label: 'Aset' }, { id: 'handoff', label: 'Serah-terima' },
]

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (s < 60) return `${s} dtk`
  if (s < 3600) return `${Math.round(s / 60)} mnt`
  if (s < 86400) return `${Math.round(s / 3600)} jam`
  return `${Math.round(s / 86400)} hr`
}
const MEDIA = /(https?:\/\/\S+?\.(?:png|jpe?g|webp|gif|mp4|webm))(?:\s|$)/i

/**
 * Otak Kantor: satu memori bersama. AI membaca brief/keputusan di sini sebelum bekerja, dan menulis hasil,
 * keputusan, serah-terima, serta aset (gambar/video Higgsfield) kembali ke sini.
 */
export function BrainPanel() {
  const open = useOffice((s) => s.brainOpen)
  const set = useOffice((s) => s.set)
  const [rows, setRows] = useState<BrainEntry[] | null>(null)
  const [kind, setKind] = useState<'' | BrainKind>('')
  const [q, setQ] = useState('')
  const [compose, setCompose] = useState(false)
  const [draft, setDraft] = useState({ kind: 'brief' as 'brief' | 'decision' | 'note', title: '', content: '' })
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const writable = can('employee.instruction:send') || !!useOffice.getState().me?.isSuperAdmin

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = window.setTimeout(() => { fetchBrain({ q, kind }).then((r) => alive && setRows(r)).catch(() => alive && setRows([])) }, q ? 250 : 0)
    return () => { alive = false; window.clearTimeout(t) }
  }, [open, q, kind])

  useEffect(() => {
    const on = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { type: 'entry'; entry: BrainEntry } | { type: 'deleted'; id: string }
      setRows((cur) => {
        if (!cur) return cur
        if (d.type === 'deleted') return cur.filter((r) => r.id !== d.id)
        if (kind && d.entry.kind !== kind) return cur
        const rest = cur.filter((r) => r.id !== d.entry.id)
        return [d.entry, ...rest]
      })
    }
    window.addEventListener('avo:brain', on)
    return () => window.removeEventListener('avo:brain', on)
  }, [kind])

  const sorted = useMemo(() => (rows ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt)), [rows])
  if (!open) return null

  const save = async () => {
    if (!draft.title.trim() || !draft.content.trim()) return
    setBusy(true)
    try {
      await addBrainNote({ ...draft, title: draft.title.trim(), content: draft.content.trim() })
      setDraft({ ...draft, title: '', content: '' }); setCompose(false)
    } finally { setBusy(false) }
  }

  return (
    <div className="panel rise pointer-events-auto absolute right-3 top-[56px] sm:top-[68px] bottom-3 z-40 flex w-[min(420px,calc(100vw-24px))] flex-col text-bone shadow-2xl">
      <PanelHead title="Otak Kantor" sub="Memori bersama semua AI & tim" right={
        <div className="flex items-center gap-1">
          {writable && <Btn variant={compose ? 'solid' : 'primary'} onClick={() => setCompose((v) => !v)}>{compose ? 'Batal' : '+ Brief'}</Btn>}
          <CloseBtn onClick={() => set({ brainOpen: false })} />
        </div>
      } />

      {compose && (
        <div className="mx-3 mb-2 space-y-2 rounded-2xl bg-white/[0.04] p-3">
          <div className="flex gap-1">
            {(['brief', 'decision', 'note'] as const).map((k) => (
              <button key={k} onClick={() => setDraft({ ...draft, kind: k })}
                className={`h-7 rounded-full px-3 text-[12px] font-semibold ${draft.kind === k ? 'bg-bone text-ink' : 'text-bone/60 hover:text-bone'}`}>{BRAIN_KIND_META[k].label}</button>
            ))}
          </div>
          <input autoFocus className={inputCls} placeholder="Judul, mis. Brand voice & target Q1" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea rows={4} className={inputCls} placeholder="Isi yang perlu diingat semua AI: produk, audiens, gaya bahasa, target, larangan…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-bone/45">{draft.kind === 'brief' ? 'Brief disematkan & selalu dibaca semua AI.' : 'Masuk ke konteks bersama.'}</span>
            <Btn variant="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan'}</Btn>
          </div>
        </div>
      )}

      <div className="px-3">
        <input className={`${inputCls} h-9`} placeholder="Cari di otak kantor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setKind(f.id)}
              className={`h-7 shrink-0 rounded-full px-3 text-[12px] font-semibold transition-colors ${kind === f.id ? 'bg-bone text-ink' : 'text-bone/55 hover:text-bone'}`}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {rows === null && <div className="p-6 text-center text-xs text-bone/45">Memuat…</div>}
        {rows && !sorted.length && (
          <div className="px-6 py-10 text-center text-[12.5px] leading-relaxed text-bone/50">
            Belum ada isi. Mulai dengan <b className="text-accent">+ Brief</b>: produk, target pasar, dan gaya bahasa brand. Semua AI akan memakainya.
          </div>
        )}
        {sorted.map((r) => {
          const meta = BRAIN_KIND_META[r.kind] ?? BRAIN_KIND_META.note
          const media = r.content.match(MEDIA)?.[1]
          const open = expanded === r.id
          return (
            <div key={r.id} className="group rounded-2xl px-2.5 py-2.5 hover:bg-white/[0.035]">
              <div className="flex items-center gap-2 text-[11px] text-bone/45">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="truncate">· {r.employee?.name ?? 'Tim'} · {ago(r.createdAt)}</span>
                {r.pinned && <span className="ml-auto text-accent" title="Disematkan">●</span>}
                {writable && (
                  <span className={`${r.pinned ? '' : 'ml-auto'} hidden gap-2 group-hover:flex`}>
                    <button className="hover:text-bone" onClick={() => void pinBrain(r.id, !r.pinned)}>{r.pinned ? 'Lepas' : 'Sematkan'}</button>
                    <button className="hover:text-red-300" onClick={() => void deleteBrain(r.id)}>Hapus</button>
                  </span>
                )}
              </div>
              <div role="button" tabIndex={0} className="mt-1 block w-full cursor-pointer text-left" onClick={() => setExpanded(open ? null : r.id)}>
                <div className="text-[13.5px] font-semibold leading-snug">{r.title}</div>
                {media && (/\.(mp4|webm)$/i.test(media)
                  ? <video src={media} className="mt-2 max-h-52 w-full rounded-xl bg-black" controls muted playsInline />
                  : <img src={media} alt="" loading="lazy" className="mt-2 max-h-52 w-full rounded-xl object-cover" />)}
                <div className={`mt-1 text-[12.5px] leading-relaxed text-bone/65 ${open ? '' : 'line-clamp-3'}`}>
                  {open ? <MarkdownView content={r.content} compact /> : r.content}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
