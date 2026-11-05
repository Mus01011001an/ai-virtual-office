import { useState } from 'react'
import { useOffice } from '../state/store'
import { changePassword, signIn, signUp } from '../state/remote'
import { Btn, Field, Modal, inputCls } from './ui'

/** Kartu masuk / daftar di layar awal. */
export function AuthCard() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      if (mode === 'in') await signIn(email.trim(), password)
      else await signUp(name.trim(), email.trim(), password)
    } catch (ex) { setErr((ex as Error).message) }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mt-8 w-[min(400px,92vw)] rounded-3xl border border-white/[0.08] bg-white/[0.05] p-5">
      <div className="mb-4 flex rounded-full bg-white/[0.06] p-0.5 text-[13px]">
        {([['in', 'Masuk'], ['up', 'Daftar']] as const).map(([k, l]) => (
          <button type="button" key={k} onClick={() => { setMode(k); setErr('') }}
            className={`h-8 flex-1 rounded-full font-semibold ${mode === k ? 'bg-bone text-ink' : 'text-bone/60 hover:text-bone'}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-3">
        {mode === 'up' && <Field label="Nama"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" autoFocus /></Field>}
        <Field label="Email"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" autoFocus={mode === 'in'} /></Field>
        <Field label="Password"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" /></Field>
      </div>
      {err && <div className="mt-3 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
      <button type="submit" disabled={busy}
        className="mt-4 h-10 w-full rounded-full bg-accent text-sm font-semibold text-ink transition-colors hover:bg-accent-2 disabled:opacity-60">
        {busy ? 'Sebentar…' : mode === 'in' ? 'Masuk' : 'Buat akun'}
      </button>
      {mode === 'up' && <p className="mt-3 text-[11px] text-bone/40">Akun pertama di server otomatis menjadi admin platform.</p>}
    </form>
  )
}

/** Wajib ganti password untuk akun yang dibuat Owner (password sementara). */
export function ChangePasswordModal() {
  const must = useOffice((s) => !!s.me?.mustChangePassword)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!must) return null
  const submit = async () => {
    if (next.length < 8) return setErr('Password baru minimal 8 karakter')
    setBusy(true); setErr('')
    try { await changePassword(cur, next) } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  return (
    <Modal title="Ganti password dulu ya" onClose={() => {}}>
      <div className="space-y-3 p-5 text-sm">
        <p className="text-xs text-bone/55">Akunmu dibuat oleh pemilik office dengan password sementara. Buat password baru untuk melanjutkan.</p>
        <Field label="Password sementara"><input type="password" className={inputCls} value={cur} onChange={(e) => setCur(e.target.value)} autoFocus /></Field>
        <Field label="Password baru"><input type="password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        {err && <div className="rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <div className="flex justify-end"><Btn variant="primary" size="md" onClick={submit}>{busy ? 'Menyimpan…' : 'Simpan password'}</Btn></div>
      </div>
    </Modal>
  )
}
