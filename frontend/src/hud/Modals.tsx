import { useEffect, useState } from 'react'
import { can, useOffice } from '../state/store'
import { createOffice, providerCatalog, recruit, signOut, type CatalogEntry } from '../state/remote'
import { Btn, CloseBtn, Field, Modal, PanelHead, Segmented, Toggle, inputCls } from './ui'
import { QUALITY } from '../lib/quality'
import type { Ambience, CameraMode, Quality } from '../state/types'

const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'UTC']

export function NewOfficeModal() {
  const open = useOffice((s) => s.newOfficeOpen)
  const st = useOffice()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<'empty' | 'demo-team'>('empty')
  const [tz, setTz] = useState('Asia/Jakarta')
  const [isProvisionOther, setIsProvisionOther] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!open) return null
  const close = () => { st.set({ newOfficeOpen: false }); setErr('') }

  const create = async () => {
    setBusy(true); setErr('')
    try {
      if (isProvisionOther) {
        if (!ownerName.trim() || !ownerEmail.trim() || ownerPassword.length < 8) {
          throw new Error('Nama, email, dan password owner minimal 8 karakter wajib diisi')
        }
      }
      await createOffice(
        name.trim() || `Office ${st.offices.length + 1}`,
        template,
        tz,
        isProvisionOther ? { name: ownerName.trim(), email: ownerEmail.trim(), password: ownerPassword } : undefined
      )
      st.set({ newOfficeOpen: false }); setName(''); setOwnerName(''); setOwnerEmail(''); setOwnerPassword(''); setIsProvisionOther(false)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Buat Office Baru" onClose={close}>
      <div className="space-y-4 p-5 text-sm max-h-[85vh] overflow-y-auto">
        <p className="text-xs text-bone/55">Setiap office memiliki AI workforce, ruang diskusi 3D, task, dan anggota terisolasi secara multi-tenant.</p>
        <Field label="Nama office"><input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Divisi Digital Musyan" /></Field>
        <Field label="Template">
          <div className="grid grid-cols-2 gap-2">
            {([['empty', 'Kantor kosong', 'Rekrut agent sendiri'], ['demo-team', 'Kantor + tim demo', '12 employee simulasi (DEMO)']] as const).map(([k, t, d]) => (
              <button key={k} onClick={() => setTemplate(k)} className={`rounded-2xl border p-3 text-left transition-colors ${template === k ? 'border-accent bg-accent/10' : 'border-line hover:bg-white/[0.04]'}`}>
                <div className="text-[14px] font-semibold">{t}</div><div className="text-[11px] text-bone/50">{d}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Timezone"><select className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>{TIMEZONES.map((t) => <option key={t} className="bg-ink">{t}</option>)}</select></Field>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isProvisionOther} onChange={(e) => setIsProvisionOther(e.target.checked)} className="rounded border-white/20 bg-ink text-accent accent-accent w-4 h-4" />
            <span className="text-xs font-semibold text-bone">Tunjuk SuperAdmin / Owner Khusus (Konsep Musyan Workspace)</span>
          </label>
          <p className="text-[11px] text-bone/45 leading-relaxed">
            Jika dicentang, office ini akan diberikan kepada klien / tim eksternal dengan kredensial pemilik baru. Anda tetap dapat memantau atau mengelolanya sebagai supervisor platform.
          </p>

          {isProvisionOther && (
            <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
              <Field label="Nama SuperAdmin Klien"><input className={inputCls} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="mis. John Doe" /></Field>
              <Field label="Email SuperAdmin Klien"><input type="email" className={inputCls} value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="client.owner@musyan.my.id" /></Field>
              <Field label="Password Sementara"><input type="password" className={inputCls} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Minimal 8 karakter" /></Field>
            </div>
          )}
        </div>

        {err && <div className="rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" size="md" onClick={close}>Batal</Btn>
          <Btn variant="primary" size="md" onClick={create}>{busy ? 'Memproses…' : isProvisionOther ? 'Buat & Serahkan ke Owner' : 'Buat & Masuk'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/** Dropdown provider + model dari katalog AI provider office (diatur di halaman AI Provider). */
export function ModelPicker({ value, onChange }: { value: { providerId: string; model: string }; onChange: (v: { providerId: string; model: string }) => void }) {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const set = useOffice((s) => s.set)
  useEffect(() => {
    let alive = true
    providerCatalog().then((c) => {
      if (!alive) return
      setCatalog(c)
      if (!value.providerId && c[0]) onChange({ providerId: c[0].providerId, model: c[0].defaultModel ?? c[0].models[0] ?? '' })
    }).catch(() => setCatalog([]))
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (catalog === null) return <div className="text-xs text-bone/45">Memuat model…</div>
  if (!catalog.length) return (
    <div className="rounded-2xl border border-dashed border-white/15 p-3 text-xs text-bone/60">
      Belum ada AI provider. Tambahkan kredensial (mis. 9router / OpenRouter / OpenAI) dulu supaya employee bisa memilih model.
      <div className="mt-2"><Btn variant="primary" onClick={() => set({ providersOpen: true, createEmployeeOpen: false })}>+ Tambah AI provider</Btn></div>
    </div>
  )
  const cur = catalog.find((c) => c.providerId === value.providerId) ?? catalog[0]
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="AI provider">
        <select className={inputCls} value={cur.providerId} onChange={(e) => {
          const c = catalog.find((x) => x.providerId === e.target.value)!
          onChange({ providerId: c.providerId, model: c.defaultModel ?? c.models[0] ?? '' })
        }}>
          {catalog.map((c) => <option key={c.providerId} value={c.providerId} className="bg-ink">{c.providerName}{c.healthy === false ? ' (gagal tes)' : ''}</option>)}
        </select>
      </Field>
      <Field label="Model">
        {cur.models.length
          ? <select className={inputCls} value={value.model} onChange={(e) => onChange({ providerId: cur.providerId, model: e.target.value })}>
              {cur.models.map((m) => <option key={m} value={m} className="bg-ink">{m}</option>)}
            </select>
          : <div className="text-xs text-amber-300">Provider ini belum punya model aktif — buka AI Provider → pilih model.</div>}
      </Field>
    </div>
  )
}

export function CreateEmployeeModal() {
  const open = useOffice((s) => s.createEmployeeOpen)
  const st = useOffice()
  const [f, setF] = useState({ name: '', role: '', department: 'Engineering', skills: '', systemPrompt: '' })
  const [pm, setPm] = useState({ providerId: '', model: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return null
  const up = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }))
  const close = () => { st.set({ createEmployeeOpen: false }); setErr('') }
  const submit = async () => {
    if (!f.name.trim() || !f.role.trim()) return setErr('Nama dan role wajib diisi.')
    setBusy(true); setErr('')
    try {
      const emp = await recruit({
        name: f.name.trim(), role: f.role.trim(), department: f.department.trim(), systemPrompt: f.systemPrompt,
        skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
        providerId: pm.providerId || undefined, model: pm.model || undefined,
      })
      st.set({ createEmployeeOpen: false, selectedId: emp.id })
      setF({ ...f, name: '', role: '', skills: '', systemPrompt: '' })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title="Rekrut AI employee" onClose={close}>
      <div className="grid grid-cols-2 gap-3 p-5 text-sm">
        <Field label="Nama"><input autoFocus className={inputCls} value={f.name} onChange={(e) => up('name', e.target.value)} placeholder="Alex" /></Field>
        <Field label="Role"><input className={inputCls} value={f.role} onChange={(e) => up('role', e.target.value)} placeholder="Senior DevOps Engineer" /></Field>
        <Field label="Department"><input className={inputCls} value={f.department} onChange={(e) => up('department', e.target.value)} /></Field>
        <Field label="Skills (pisah koma)"><input className={inputCls} value={f.skills} onChange={(e) => up('skills', e.target.value)} placeholder="Docker, Linux, Nginx" /></Field>
        <div className="col-span-2"><ModelPicker value={pm} onChange={setPm} /></div>
        <div className="col-span-2"><Field label="System instruction"><textarea rows={3} className={inputCls} value={f.systemPrompt} onChange={(e) => up('systemPrompt', e.target.value)} placeholder="You are a senior DevOps engineer responsible for…" /></Field></div>
        <div className="col-span-2 rounded-2xl bg-white/[0.05] px-3 py-2 text-[11px] text-bone/70">Employee otomatis dapat karakter & meja, tersimpan di server. Eksekusi AI nyata aktif di Phase 3 (AI Engine) memakai model yang dipilih di sini.</div>
        {err && <div className="col-span-2 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <div className="col-span-2 flex justify-end gap-2">
          <Btn variant="ghost" size="md" onClick={close}>Batal</Btn>
          <Btn variant="primary" size="md" onClick={submit}>{busy ? 'Menyimpan…' : 'Rekrut'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function SettingsPanel() {
  const st = useOffice()
  if (!st.settingsOpen) return null
  return (
    <div className="panel rise pointer-events-auto absolute right-3 top-[56px] sm:top-[68px] z-40 w-[min(320px,calc(100vw-24px))] max-h-[calc(100dvh-100px)] flex flex-col text-bone shadow-2xl">
      <PanelHead title="Pengaturan" right={<CloseBtn onClick={() => st.set({ settingsOpen: false })} />} />
      <div className="space-y-4 p-4 overflow-y-auto">
        <div>
          <div className="label mb-1.5">Sudut Pandang Kamera</div>
          <Segmented<CameraMode>
            value={st.cameraMode}
            onChange={(m) => st.set({ cameraMode: m })}
            options={[
              { id: 'fps', label: '👁️ Mata', title: 'First-person (1)' },
              { id: 'tps', label: '👤 Bahu', title: 'Third-person (2)' },
              { id: 'iso', label: '📐 Atas', title: 'Isometric (3)' },
            ]}
          />
        </div>
        <div>
          <div className="label mb-1.5">Kualitas grafis</div>
          <Segmented<Quality> value={st.quality} onChange={(q) => st.set({ quality: q })}
            options={(Object.keys(QUALITY) as Quality[]).map((k) => ({ id: k, label: QUALITY[k].label, title: QUALITY[k].desc }))} />
          <div className="mt-1.5 text-[11px] text-bone/45">{QUALITY[st.quality].desc} Resolusi turun otomatis bila fps drop.</div>
        </div>
        <div>
          <div className="label mb-1.5">Suasana</div>
          <Segmented<Ambience> value={st.ambience} onChange={(a) => st.set({ ambience: a })}
            options={[{ id: 'night', label: 'Malam' }, { id: 'day', label: 'Siang' }, { id: 'auto', label: 'Ikut jam', title: 'Mengikuti jam timezone office' }]} />
        </div>
        <div className="divide-y divide-line rounded-2xl bg-white/[0.03] px-3">
          <Toggle checked={st.mouseLook} onChange={(v) => st.set({ mouseLook: v })} label="Mouse-look (mode Bahu)" hint="Gerak mouse = putar kamera, tanpa klik kanan" />
          <Toggle checked={st.showNames} onChange={(v) => st.set({ showNames: v })} label="Nama di atas kepala" hint="Tombol N" />
          <Toggle checked={st.showHints} onChange={(v) => st.set({ showHints: v })} label="Petunjuk kontrol" hint="Tombol H" />
          <Toggle checked={st.showMinimap} onChange={(v) => st.set({ showMinimap: v })} label="Tampilkan radar peta" hint="Tombol M" />
          <Toggle checked={st.simulateSchedule} onChange={(v) => st.set({ simulateSchedule: v })} label="Ikuti jadwal kerja" hint="Di luar 09–18 employee demo pulang" />
        </div>
        {can('ai.provider:read', st.me) && (
          <button onClick={() => st.set({ providersOpen: true, settingsOpen: false })}
            className="flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-3 py-2.5 text-left hover:bg-white/[0.08]">
            <span><span className="block text-[13px] font-semibold">🔑 AI Provider</span><span className="block text-[11px] text-bone/45">Kredensial & model (9router, OpenAI, Claude…)</span></span>
            <span className="text-bone/40">›</span>
          </button>
        )}
        <div>
          <div className="mb-1.5 flex justify-between"><span className="label">Sensitivitas mouse</span><span className="text-[12px] font-semibold text-bone/70">{st.sensitivity.toFixed(1)}×</span></div>
          <input type="range" min={0.3} max={2.5} step={0.1} value={st.sensitivity} onChange={(e) => st.set({ sensitivity: Number(e.target.value) })} className="w-full" />
        </div>
        {st.me && (
          <div className="flex items-center justify-between border-t border-line pt-3 text-[12px]">
            <span className="min-w-0 truncate text-bone/60">{st.me.name} · {st.me.activeRole?.name ?? '—'}</span>
            <Btn variant="ghost" onClick={() => void signOut()}>Keluar</Btn>
          </div>
        )}
      </div>
    </div>
  )
}
