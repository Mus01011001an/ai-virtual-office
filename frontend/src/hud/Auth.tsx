import { useState } from 'react'
import { useOffice } from '../state/store'
import { changePassword, signIn } from '../state/remote'
import { Btn, Field, Modal, inputCls } from './ui'

/** Kartu masuk layar awal — khusus administrator & anggota terdaftar. */
export function AuthCard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await signIn(email.trim(), password)
    } catch (ex) { setErr((ex as Error).message) }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mt-8 w-[min(400px,92vw)] rounded-3xl border border-white/[0.08] bg-white/[0.05] p-6 shadow-2xl backdrop-blur-xl">
      <div className="mb-5 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          <span>🛡️</span> Portal Administrator & Tim
        </div>
        <h2 className="mt-2 text-lg font-bold text-bone">Masuk ke Virtual Office</h2>
        <p className="mt-1 text-xs text-bone/50">Silakan masukkan kredensial akun Anda untuk memulai.</p>
      </div>

      <div className="space-y-3">
        <Field label="Email Administrator"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@musyan.my.id" autoFocus /></Field>
        <Field label="Password"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
      </div>
      {err && <div className="mt-3 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
      <button type="submit" disabled={busy}
        className="mt-5 h-11 w-full rounded-2xl bg-accent text-sm font-bold text-ink transition-all hover:bg-accent-2 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-accent/20">
        {busy ? 'Memverifikasi…' : 'Masuk ke Office'}
      </button>
      <p className="mt-4 text-center text-[11px] text-bone/40">Akses terbatas. Pembuatan akun baru dikelola oleh Administrator di dalam office.</p>
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
