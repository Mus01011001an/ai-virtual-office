import { useState } from 'react'
import { useOffice } from '../state/store'
import { changePassword, signIn } from '../state/remote'
import { Btn, Field, Modal, inputCls } from './ui'

/** Kartu masuk layar awal — bernuansa Game/Cyberpunk Player Login. */
export function AuthCard() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await signIn(identifier.trim(), password)
    } catch (ex) { setErr((ex as Error).message) }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mt-6 w-[min(400px,92vw)] rounded-[28px] bg-white p-6 text-left text-slate-800 shadow-[0_8px_0_#c9d6ea,0_24px_48px_rgba(30,60,120,0.25)] sm:p-7">
      <h2 className="font-display text-[22px] font-semibold text-slate-900">Masuk ke kantor</h2>
      <p className="mt-0.5 text-[13px] text-slate-500">Pakai username atau email akunmu.</p>
      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">Username</span>
          <input type="text" autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="mis. budi atau admin"
            className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-3.5 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:bg-white" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-3.5 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:bg-white" />
        </label>
      </div>
      {err && <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-600">{err}</div>}
      <button type="submit" disabled={busy}
        className="mt-5 h-12 w-full rounded-2xl bg-[#22c55e] font-display text-[17px] font-semibold text-white shadow-[0_5px_0_#15803d] transition-transform hover:brightness-105 active:translate-y-[3px] active:shadow-[0_2px_0_#15803d] disabled:opacity-60">
        {busy ? 'Menyambungkan…' : 'Main sekarang'}
      </button>
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
