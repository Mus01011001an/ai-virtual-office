import { useEffect, useMemo, useState } from 'react'
import { can, useOffice } from '../state/store'
import {
  deleteProvider, listProviders, providerTypes, saveProvider, testProvider, testProviderDraft,
  type AiProvider, type ProviderType, type ProviderTypeInfo, type TestResult,
} from '../state/remote'
import { Btn, Field, Modal, inputCls } from './ui'

/**
 * Kredensial AI provider per office — seperti "Credentials" di n8n:
 * tambah provider → Test connection (ambil daftar model) → centang model yang boleh dipakai employee.
 */
export function AiProvidersModal() {
  const open = useOffice((s) => s.providersOpen)
  const set = useOffice((s) => s.set)
  const me = useOffice((s) => s.me)
  const [list, setList] = useState<AiProvider[] | null>(null)
  const [types, setTypes] = useState<ProviderTypeInfo[]>([])
  const [editing, setEditing] = useState<AiProvider | 'new' | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const manage = can('ai.provider:manage', me)

  const reload = () => listProviders().then(setList).catch((e) => { setErr(e.message); setList([]) })
  useEffect(() => {
    if (!open) return
    setEditing(null); setErr('')
    void reload()
    providerTypes().then(setTypes).catch(() => {})
  }, [open])

  if (!open) return null
  const close = () => set({ providersOpen: false })

  if (editing) {
    return (
      <Modal title={editing === 'new' ? 'Tambah AI provider' : `Edit · ${editing.name}`} onClose={close} wide>
        <ProviderForm types={types} initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload() }} />
      </Modal>
    )
  }

  const retest = async (p: AiProvider) => {
    setTesting(p.id)
    try { await testProvider(p.id) } catch (e) { setErr((e as Error).message) }
    setTesting(null); void reload()
  }

  return (
    <Modal title="🔑 AI Provider" onClose={close} wide>
      <div className="space-y-4 p-5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="max-w-xl text-xs leading-relaxed text-bone/55">
            Simpan kredensial model AI untuk office ini (9router, OpenRouter, OpenAI, Claude, Gemini, DeepSeek, Ollama…).
            API key dienkripsi di server dan tidak pernah dikirim balik ke browser. Model yang kamu aktifkan bisa dipilih saat merekrut employee.
          </p>
          {manage && <Btn variant="primary" size="md" onClick={() => setEditing('new')}>+ Tambah provider</Btn>}
        </div>
        {err && <div className="rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        {list === null && <div className="text-bone/45">Memuat…</div>}
        {list?.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-bone/55">
            <div className="mb-2 text-3xl">🔌</div>
            Belum ada AI provider. {manage ? 'Klik “Tambah provider” untuk mulai.' : 'Minta Owner/Manager menambahkannya.'}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {list?.map((p) => (
            <div key={p.id} className="rounded-3xl border border-line bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{p.name}</span>
                    <Health p={p} />
                    {!p.isActive && <span className="rounded-full bg-white/10 px-2 text-[10px] text-bone/60">nonaktif</span>}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-bone/45">{types.find((t) => t.id === p.type)?.label ?? p.type} · {p.baseUrl}</div>
                  <div className="text-[11px] text-bone/45">Key: {p.apiKeyHint ?? '—'} · dipakai {p.employeeCount} employee</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.models.slice(0, 6).map((m) => <span key={m} className={`rounded-full px-2 py-0.5 text-[11px] ${m === p.defaultModel ? 'bg-accent/20 text-accent' : 'bg-white/[0.07] text-bone/75'}`}>{m}</span>)}
                {p.models.length > 6 && <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-bone/50">+{p.models.length - 6}</span>}
                {!p.models.length && <span className="text-[11px] text-amber-300">Belum ada model aktif</span>}
              </div>
              {p.lastTestMessage && <div className={`mt-2 text-[11px] ${p.lastTestOk ? 'text-mint' : 'text-red-300'}`}>{p.lastTestMessage}</div>}
              {manage && (
                <div className="mt-3 flex gap-1.5">
                  <Btn onClick={() => retest(p)}>{testing === p.id ? 'Mengetes…' : 'Test connection'}</Btn>
                  <Btn onClick={() => setEditing(p)}>Edit</Btn>
                  <Btn variant="ghost" className="text-red-300" onClick={async () => {
                    if (!confirm(`Hapus provider "${p.name}"? Employee yang memakainya perlu memilih model lain.`)) return
                    try { await deleteProvider(p.id); void reload() } catch (e) { setErr((e as Error).message) }
                  }}>Hapus</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function Health({ p }: { p: AiProvider }) {
  if (p.lastTestOk === null) return <span className="rounded-full bg-white/10 px-2 text-[10px] text-bone/60">belum dites</span>
  return p.lastTestOk
    ? <span className="rounded-full bg-mint/15 px-2 text-[10px] font-semibold text-mint">● terhubung</span>
    : <span className="rounded-full bg-red-400/15 px-2 text-[10px] font-semibold text-red-300">● gagal</span>
}

function ProviderForm({ types, initial, onCancel, onSaved }: {
  types: ProviderTypeInfo[]; initial: AiProvider | null; onCancel: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<ProviderType>(initial?.type ?? 'openai_compatible')
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<string[]>(initial?.models ?? [])
  const [defaultModel, setDefaultModel] = useState<string | null>(initial?.defaultModel ?? null)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [remote, setRemote] = useState<string[]>([])
  const [test, setTest] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [search, setSearch] = useState('')
  const [manual, setManual] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const info = types.find((t) => t.id === type)

  const runTest = async () => {
    setTesting(true); setErr('')
    try {
      const r = await testProviderDraft({ type, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined, id: initial?.id })
      setTest(r)
      if (r.ok) setRemote(r.models)
    } catch (e) { setErr((e as Error).message) }
    setTesting(false)
  }

  // daftar yang ditampilkan: hasil tes + yang sudah dipilih (supaya tetap terlihat walau belum dites ulang)
  const shown = useMemo(() => {
    const all = Array.from(new Set([...models, ...remote]))
    const q = search.trim().toLowerCase()
    return (q ? all.filter((m) => m.toLowerCase().includes(q)) : all).slice(0, 400)
  }, [models, remote, search])

  const toggle = (m: string) => setModels((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))
  const addManual = () => { const m = manual.trim(); if (m && !models.includes(m)) setModels([...models, m]); setManual('') }

  const save = async () => {
    if (!name.trim()) return setErr('Nama wajib diisi')
    setSaving(true); setErr('')
    try {
      await saveProvider({ id: initial?.id, name: name.trim(), type, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined, models, defaultModel, isActive })
      onSaved()
    } catch (e) { setErr((e as Error).message) }
    setSaving(false)
  }

  return (
    <div className="grid gap-5 p-5 text-sm md:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        <Field label="Nama"><input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. 9router Musyan" /></Field>
        <Field label="Tipe">
          <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as ProviderType); setTest(null); setRemote([]) }}>
            {types.map((t) => <option key={t.id} value={t.id} className="bg-ink">{t.label}</option>)}
          </select>
        </Field>
        <Field label={info?.needsBaseUrl ? 'Base URL (wajib)' : 'Base URL (opsional)'}>
          <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={info?.defaultBaseUrl || 'https://ai.domainkamu.id/v1'} />
        </Field>
        <Field label="API key">
          <input type="password" autoComplete="new-password" className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder={initial?.apiKeyHint ? `Tersimpan (${initial.apiKeyHint}) — kosongkan untuk tetap` : 'sk-…'} />
        </Field>
        <div className="flex items-center gap-2">
          <Btn variant="light" onClick={runTest}>{testing ? 'Mengetes…' : '⚡ Test connection'}</Btn>
          <label className="flex items-center gap-2 text-[12px] text-bone/70">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[var(--color-accent)]" /> Aktif
          </label>
        </div>
        {test && (
          <div className={`rounded-2xl px-3 py-2 text-xs ${test.ok ? 'bg-mint/10 text-mint' : 'bg-red-400/10 text-red-300'}`}>
            {test.ok ? '✓' : '✕'} {test.message} · {test.latencyMs} ms
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-bone/45">
          9router / OpenRouter / Ollama / LM Studio pakai tipe <b>OpenAI-compatible</b> dengan base URL yang berakhiran <code>/v1</code>.
          Test connection memanggil <code>GET /models</code> — tidak memakai token.
        </p>
      </div>

      <div className="flex min-h-[340px] flex-col rounded-3xl border border-line bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13px] font-semibold">Model untuk employee <span className="text-bone/45">({models.length} dipilih)</span></div>
          {remote.length > 0 && <span className="text-[11px] text-bone/45">{remote.length} tersedia</span>}
        </div>
        <input className={`${inputCls} mb-2`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari model…" />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ maxHeight: 300 }}>
          {!shown.length && <div className="p-4 text-center text-xs text-bone/45">Klik “Test connection” untuk mengambil daftar model, atau tambahkan manual di bawah.</div>}
          {shown.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[12.5px] hover:bg-white/[0.05]">
              <input type="checkbox" checked={models.includes(m)} onChange={() => toggle(m)} className="accent-[var(--color-accent)]" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{m}</span>
              {models.includes(m) && (
                <button onClick={(e) => { e.preventDefault(); setDefaultModel(m) }}
                  className={`rounded-full px-2 text-[10px] ${defaultModel === m ? 'bg-accent text-ink' : 'bg-white/10 text-bone/60 hover:text-bone'}`}>
                  {defaultModel === m ? 'default' : 'jadikan default'}
                </button>
              )}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input className={inputCls} value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManual()} placeholder="Tambah model manual, mis. cc/claude-sonnet-4" />
          <Btn onClick={addManual}>Tambah</Btn>
        </div>
      </div>

      {err && <div className="rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300 md:col-span-2">{err}</div>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <Btn variant="ghost" size="md" onClick={onCancel}>Kembali</Btn>
        <Btn variant="primary" size="md" onClick={save}>{saving ? 'Menyimpan…' : 'Simpan provider'}</Btn>
      </div>
    </div>
  )
}
