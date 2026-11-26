import { useEffect, useState } from 'react'
import { adminHiggsfield, adminSaveHiggsfield, adminTestHiggsfield, type HiggsfieldStatus } from '../../state/catalog'
import { Btn, Field, inputCls } from '../ui'

/** Kredensial Higgsfield level platform (gambar & video untuk AI marketing/sosmed). */
export function HiggsfieldTab() {
  const [st, setSt] = useState<HiggsfieldStatus | null>(null)
  const [f, setF] = useState({ keyId: '', keySecret: '', imageModel: '', videoModel: '', imageToVideoModel: '' })
  const [adv, setAdv] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminHiggsfield().then((s) => { setSt(s); setF((o) => ({ ...o, imageModel: s.imageModel, videoModel: s.videoModel, imageToVideoModel: s.imageToVideoModel })) }).catch(() => setSt(null))
  }, [])

  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(null); try { await fn() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) } }
  const save = () => run(async () => {
    const s = await adminSaveHiggsfield({ ...f, keyId: f.keyId || undefined, keySecret: f.keySecret || undefined })
    setSt(s); setF((o) => ({ ...o, keyId: '', keySecret: '' }))
    const t = await adminTestHiggsfield()
    setMsg({ ok: t.ok, text: t.message })
  })
  const test = () => run(async () => {
    const t = await adminTestHiggsfield(f.keyId && f.keySecret ? { keyId: f.keyId, keySecret: f.keySecret } : {})
    setMsg({ ok: t.ok, text: t.message })
  })

  return (
    <div className="mx-auto max-w-xl space-y-4 p-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4">
        <span className={`h-2.5 w-2.5 rounded-full ${st?.configured ? 'bg-mint' : 'bg-amber-400'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{st?.configured ? 'Higgsfield terhubung' : 'Higgsfield belum terhubung'}</div>
          <div className="text-[12px] text-bone/50">
            {st?.configured ? `Secret ${st.hint ?? ''}${st.source === 'env' ? ' · dari env server' : ''}` : 'AI Visual Creator & Social Media butuh ini untuk membuat gambar dan video.'}
          </div>
        </div>
        {st?.configured && <Btn variant="solid" disabled={busy} onClick={() => void test()}>Tes</Btn>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Key ID"><input className={inputCls} value={f.keyId} onChange={(e) => setF({ ...f, keyId: e.target.value })} autoComplete="off" placeholder={st?.configured ? 'Kosongkan bila tetap' : ''} /></Field>
        <Field label="Key Secret"><input type="password" className={inputCls} value={f.keySecret} onChange={(e) => setF({ ...f, keySecret: e.target.value })} autoComplete="off" placeholder={st?.configured ? 'Kosongkan bila tetap' : ''} /></Field>
      </div>
      <p className="text-[11.5px] text-bone/45">Buat API key di console Higgsfield (Key ID + Secret). Disimpan terenkripsi; hanya dipakai server.</p>

      <button className="text-[12px] font-semibold text-bone/55 hover:text-bone" onClick={() => setAdv((v) => !v)}>{adv ? '▾' : '▸'} Model yang dipakai</button>
      {adv && (
        <div className="space-y-3">
          <Field label="Gambar"><input className={`${inputCls} font-mono text-[12px]`} value={f.imageModel} onChange={(e) => setF({ ...f, imageModel: e.target.value })} /></Field>
          <Field label="Video dari teks"><input className={`${inputCls} font-mono text-[12px]`} value={f.videoModel} onChange={(e) => setF({ ...f, videoModel: e.target.value })} /></Field>
          <Field label="Video dari gambar"><input className={`${inputCls} font-mono text-[12px]`} value={f.imageToVideoModel} onChange={(e) => setF({ ...f, imageToVideoModel: e.target.value })} /></Field>
        </div>
      )}

      {msg && <div className={`rounded-xl px-3 py-2 text-xs ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-red-400/10 text-red-300'}`}>{msg.text}</div>}
      <div className="flex justify-end">
        <Btn variant="primary" size="md" disabled={busy || (!st?.configured && (!f.keyId || !f.keySecret))} onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan & tes'}</Btn>
      </div>
    </div>
  )
}
