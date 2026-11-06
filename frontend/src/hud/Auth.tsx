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
    <form
      onSubmit={submit}
      className="mt-6 w-[min(420px,92vw)] rounded-3xl border border-cyan-500/30 bg-[#0d111db8] p-6 sm:p-7 shadow-[0_0_50px_rgba(0,245,212,0.15)] backdrop-blur-2xl relative overflow-hidden"
    >
      {/* Scanline & subtle neon glow */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

      <div className="mb-5 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-mono font-bold tracking-wider text-cyan-300">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" /> PLAYER TERMINAL LOGIN
        </div>
        <h2 className="mt-3 text-xl font-black tracking-tight text-white font-mono uppercase">
          KONEKSI OFFICE
        </h2>
        <p className="mt-1 text-xs text-white/50">Masukkan username akun Anda untuk memulai petualangan virtual.</p>
      </div>

      <div className="space-y-3.5">
        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-cyan-300/80 block mb-1.5 font-bold">
            [USERNAME / ID]
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm font-mono text-white placeholder-white/25 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="mis. budi atau admin"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-cyan-300/80 block mb-1.5 font-bold">
            [PASSWORD KODE]
          </label>
          <input
            type="password"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm font-mono text-white placeholder-white/25 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
      </div>

      {err && (
        <div className="mt-3.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-mono text-rose-300">
          ⚠️ {err}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 h-12 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-sm font-black font-mono tracking-wider text-slate-950 uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 shadow-[0_0_25px_rgba(0,245,212,0.4)] cursor-pointer flex items-center justify-center gap-2"
      >
        {busy ? (
          <span>MENYAMBUNGKAN REALM…</span>
        ) : (
          <>
            <span>MASUK KANTOR</span>
            <span className="text-base">➔</span>
          </>
        )}
      </button>

      <div className="mt-4 flex items-center justify-between text-[10.5px] font-mono text-white/40">
        <span>STATUS: SYSTEM READY</span>
        <span>SECURE ACCESS</span>
      </div>
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
