import { useState } from 'react'
import { adminCreateProvider, adminRemoveProvider, adminTestProvider, adminUpdateProvider, type GlobalProvider, type ProviderInput } from '../../state/catalog'
import type { ProviderType } from '../../state/remote'
import { Btn, Field, inputCls } from '../ui'

const TYPES: { id: ProviderType; label: string; base: string }[] = [
  { id: 'openai_compatible', label: 'OpenAI-compatible (OpenRouter, 9router, Ollama…)', base: '' },
  { id: 'anthropic', label: 'Anthropic (Claude)', base: 'https://api.anthropic.com/v1' },
  { id: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1' },
  { id: 'google', label: 'Google (Gemini)', base: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'deepseek', label: 'DeepSeek', base: 'https://api.deepseek.com/v1' },
]

/** AI provider global: dipakai semua AI di katalog. Key terenkripsi, hanya hint yang tampil. */
export function ProvidersTab({ providers, reload }: { providers: GlobalProvider[]; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState<GlobalProvider | 'new' | null>(providers.length ? null : 'new')
  const [f, setF] = useState<ProviderInput & { modelsText: string }>({ modelsText: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const open = (p: GlobalProvider | 'new') => {
    setEdit(p); setMsg(null)
    setF(p === 'new' ? { type: 'anthropic', name: '', baseUrl: '', apiKey: '', modelsText: 'claude-sonnet-5-5' }
      : { name: p.name, type: p.type, baseUrl: p.baseUrl, apiKey: '', modelsText: p.models.join(', '), defaultModel: p.defaultModel ?? undefined })
  }
  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const body: ProviderInput = { name: f.name, type: f.type, baseUrl: f.baseUrl, apiKey: f.apiKey || undefined, models: f.modelsText.split(',').map((m) => m.trim()).filter(Boolean), defaultModel: f.defaultModel }
      const row = edit === 'new' ? await adminCreateProvider(body) : await adminUpdateProvider((edit as GlobalProvider).id, body)
      const t = await adminTestProvider(row.id)
      setMsg({ ok: t.ok, text: t.message })
      await reload(); setEdit(row)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 p-5 md:grid-cols-[240px_1fr]">
      <div className="space-y-1">
        {providers.map((p) => (
          <button key={p.id} onClick={() => open(p)}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] ${edit !== 'new' && edit?.id === p.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${p.lastTestOk ? 'bg-mint' : p.lastTestOk === false ? 'bg-red-400' : 'bg-bone/30'}`} />
            <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
            <span className="text-[11px] text-bone/40">{p.models.length} model</span>
          </button>
        ))}
        <Btn variant="ghost" className="w-full" onClick={() => open('new')}>+ Provider</Btn>
      </div>
      {edit ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama"><input className={inputCls} value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Claude utama" /></Field>
            <Field label="Tipe">
              <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ProviderType, baseUrl: TYPES.find((t) => t.id === e.target.value)?.base ?? '' })}>
                {TYPES.map((t) => <option key={t.id} value={t.id} className="bg-ink">{t.label}</option>)}
              </select>
            </Field>
          </div>
          {f.type === 'openai_compatible' && <Field label="Base URL"><input className={inputCls} value={f.baseUrl ?? ''} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} placeholder="https://openrouter.ai/api/v1" /></Field>}
          <Field label={edit === 'new' ? 'API key' : `API key (kosongkan bila tetap · ${edit.apiKeyHint ?? '—'})`}>
            <input type="password" className={inputCls} value={f.apiKey ?? ''} onChange={(e) => setF({ ...f, apiKey: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Model yang diaktifkan (pisah koma)"><input className={inputCls} value={f.modelsText} onChange={(e) => setF({ ...f, modelsText: e.target.value })} /></Field>
          {msg && <div className={`rounded-xl px-3 py-2 text-xs ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-red-400/10 text-red-300'}`}>{msg.text}</div>}
          <div className="flex justify-between gap-2 pt-1">
            {edit !== 'new'
              ? <Btn variant="ghost" onClick={async () => { await adminRemoveProvider(edit.id); await reload(); setEdit(null) }}>Hapus</Btn>
              : <span />}
            <Btn variant="primary" size="md" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan & tes…' : 'Simpan & tes'}</Btn>
          </div>
        </div>
      ) : <div className="grid place-items-center text-[13px] text-bone/45">Pilih provider untuk mengubah.</div>}
    </div>
  )
}
