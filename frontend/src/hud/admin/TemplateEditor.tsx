import { useEffect, useState } from 'react'
import type { Accessory, Appearance } from '../../state/types'
import type { AgentTemplate, GlobalProvider, TemplateInput } from '../../state/catalog'
import { Btn, Field, Toggle, inputCls } from '../ui'
import { BlockyAvatar } from '../BlockyAvatar'

const SWATCH = {
  skin: ['#f5d3b8', '#ecbf98', '#d9a37a', '#bb8259', '#935f3f', '#6e4631'],
  hair: ['#120f0d', '#2c221b', '#6b3e26', '#a07850', '#e0c48c', '#3b3b3f', '#c0392b', '#8338ec'],
  top: ['#e4572e', '#17a398', '#3a86ff', '#8338ec', '#ff70a6', '#f2c14e', '#2a3a5f', '#1b1b1e', '#eef0f2', '#4caf50'],
  bottom: ['#2d3142', '#1d2433', '#33312e', '#3d405b', '#7d6c55', '#111214'],
  shoes: ['#141414', '#f2f2f2', '#e94f37', '#4a2f22', '#3a86ff'],
}
const HAIR_STYLES = ['Pendek', 'Panjang', 'Cepol', 'Cepak']
const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: 'none', label: 'Tidak ada' }, { id: 'cap', label: 'Topi' }, { id: 'beanie', label: 'Kupluk' },
  { id: 'headphones', label: 'Headphone' }, { id: 'headset', label: 'Headset' },
]
const FACES = ['Senyum', 'Ceria', 'Kalem', 'Fokus']
const DEFAULT_LOOK: Appearance = { skin: '#ecbf98', hair: '#2c221b', hairStyle: 0, top: '#3a86ff', bottom: '#2d3142', shoes: '#141414', height: 1, glasses: false, jacket: false, accessory: 'none', face: 0 }

const Swatches = ({ value, options, onChange }: { value?: string; options: string[]; onChange: (v: string) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((c) => (
      <button key={c} onClick={() => onChange(c)} title={c}
        className={`h-6 w-6 rounded-lg ring-offset-2 ring-offset-ink transition ${value === c ? 'ring-2 ring-bone' : 'hover:scale-110'}`} style={{ background: c }} />
    ))}
  </div>
)

const Chips = <T extends string | number>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) => (
  <div className="flex flex-wrap gap-1">
    {options.map((o) => (
      <button key={String(o.id)} onClick={() => onChange(o.id)}
        className={`h-7 rounded-full px-3 text-[12px] font-semibold transition-colors ${value === o.id ? 'bg-bone text-ink' : 'bg-white/[0.05] text-bone/60 hover:text-bone'}`}>{o.label}</button>
    ))}
  </div>
)

export function TemplateEditor({ tpl, providers, tools, onSave, onRemove, busy }: {
  tpl: AgentTemplate | null
  providers: GlobalProvider[]
  tools: { name: string; description: string }[]
  onSave: (input: TemplateInput) => Promise<void>
  onRemove?: () => void
  busy: boolean
}) {
  const fresh = (): TemplateInput => tpl
    ? { ...tpl, appearance: { ...DEFAULT_LOOK, ...tpl.appearance } }
    : { key: '', name: '', role: '', department: 'Marketing', tagline: '', skills: [], systemPrompt: '', tools: ['web_search', 'file_generate'], appearance: DEFAULT_LOOK, providerId: providers[0]?.id ?? null, model: providers[0]?.defaultModel ?? '', isActive: true }
  const [f, setF] = useState<TemplateInput>(fresh)
  const [skills, setSkills] = useState((tpl?.skills ?? []).join(', '))
  useEffect(() => { setF(fresh()); setSkills((tpl?.skills ?? []).join(', ')) }, [tpl?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const up = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => setF((o) => ({ ...o, [k]: v }))
  const look = { ...DEFAULT_LOOK, ...(f.appearance ?? {}) } as Appearance
  const setLook = (p: Partial<Appearance>) => up('appearance', { ...look, ...p })
  const prov = providers.find((p) => p.id === f.providerId)

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama"><input className={inputCls} value={f.name ?? ''} onChange={(e) => up('name', e.target.value)} placeholder="Nadia" /></Field>
          <Field label="Role"><input className={inputCls} value={f.role ?? ''} onChange={(e) => up('role', e.target.value)} placeholder="Marketing Strategist" /></Field>
          <Field label="Tim"><input className={inputCls} value={f.department ?? ''} onChange={(e) => up('department', e.target.value)} /></Field>
          {!tpl
            ? <Field label="Key (unik)"><input className={inputCls} value={f.key ?? ''} onChange={(e) => up('key', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="seo-specialist" /></Field>
            : <Field label="Skill (pisah koma)"><input className={inputCls} value={skills} onChange={(e) => setSkills(e.target.value)} /></Field>}
        </div>
        {!tpl && <Field label="Skill (pisah koma)"><input className={inputCls} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="SEO, Keyword research" /></Field>}
        <Field label="Deskripsi singkat (tampil di katalog)"><input className={inputCls} value={f.tagline ?? ''} onChange={(e) => up('tagline', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Model AI">
            <select className={inputCls} value={f.providerId ?? ''} onChange={(e) => {
              const p = providers.find((x) => x.id === e.target.value)
              setF((o) => ({ ...o, providerId: e.target.value || null, model: p?.defaultModel ?? p?.models[0] ?? '' }))
            }}>
              <option value="" className="bg-ink">— Belum dipilih —</option>
              {providers.map((p) => <option key={p.id} value={p.id} className="bg-ink">{p.name}</option>)}
            </select>
          </Field>
          <Field label="Model">
            <select className={inputCls} value={f.model ?? ''} onChange={(e) => up('model', e.target.value)} disabled={!prov}>
              {!prov && <option value="">—</option>}
              {prov?.models.map((m) => <option key={m} value={m} className="bg-ink">{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Persona & cara kerja (system prompt)">
          <textarea rows={10} className={`${inputCls} font-mono text-[12px] leading-relaxed`} value={f.systemPrompt ?? ''} onChange={(e) => up('systemPrompt', e.target.value)}
            placeholder="Kamu ahli … Fokus: … Serahkan ke rekan bila …" />
        </Field>
        <div>
          <div className="label mb-1.5">Tool yang boleh dipakai <span className="text-bone/35">· otak kantor & delegasi selalu aktif</span></div>
          <div className="flex flex-wrap gap-1.5">
            {tools.filter((t) => !['brain_recall', 'brain_note', 'delegate_task'].includes(t.name)).map((t) => {
              const on = (f.tools ?? []).includes(t.name)
              return (
                <button key={t.name} title={t.description} onClick={() => up('tools', on ? (f.tools ?? []).filter((x) => x !== t.name) : [...(f.tools ?? []), t.name])}
                  className={`h-7 rounded-full px-3 font-mono text-[11.5px] transition-colors ${on ? 'bg-accent text-ink' : 'bg-white/[0.05] text-bone/60 hover:text-bone'}`}>{t.name}</button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.03] p-4">
          <BlockyAvatar ap={look} size={112} />
          <div className="display text-[15px]">{f.name || 'Nama AI'}</div>
          <div className="text-[11.5px] text-bone/50">{f.role || 'Role'}</div>
        </div>
        <Field label="Kulit"><Swatches value={look.skin} options={SWATCH.skin} onChange={(v) => setLook({ skin: v })} /></Field>
        <Field label="Rambut"><Swatches value={look.hair} options={SWATCH.hair} onChange={(v) => setLook({ hair: v })} /></Field>
        <Chips value={look.hairStyle} options={HAIR_STYLES.map((l, i) => ({ id: i as 0 | 1 | 2 | 3, label: l }))} onChange={(v) => setLook({ hairStyle: v })} />
        <Field label="Baju"><Swatches value={look.top} options={SWATCH.top} onChange={(v) => setLook({ top: v })} /></Field>
        <Field label="Celana"><Swatches value={look.bottom} options={SWATCH.bottom} onChange={(v) => setLook({ bottom: v })} /></Field>
        <Field label="Sepatu"><Swatches value={look.shoes} options={SWATCH.shoes} onChange={(v) => setLook({ shoes: v })} /></Field>
        <Field label="Aksesori"><Chips value={look.accessory ?? 'none'} options={ACCESSORIES} onChange={(v) => setLook({ accessory: v })} /></Field>
        <Field label="Wajah"><Chips value={look.face ?? 0} options={FACES.map((l, i) => ({ id: i, label: l }))} onChange={(v) => setLook({ face: v })} /></Field>
        <div className="divide-y divide-line rounded-2xl bg-white/[0.03] px-3">
          <Toggle checked={look.glasses} onChange={(v) => setLook({ glasses: v })} label="Kacamata" />
          <Toggle checked={look.jacket} onChange={(v) => setLook({ jacket: v })} label="Jas & dasi" />
          <Toggle checked={f.isActive ?? true} onChange={(v) => up('isActive', v)} label="Tampil di katalog" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-4 lg:col-span-2">
        <span className="text-[11.5px] text-bone/45">{tpl ? `Dipakai ${tpl.usedBy} office · perubahan langsung berlaku di semua office` : 'AI baru langsung tersedia di katalog semua office'}</span>
        <div className="flex gap-2">
          {tpl && onRemove && <Btn variant="ghost" onClick={onRemove}>{tpl.usedBy ? 'Nonaktifkan' : 'Hapus'}</Btn>}
          <Btn variant="primary" size="md" disabled={busy} onClick={() => void onSave({ ...f, skills: skills.split(',').map((s) => s.trim()).filter(Boolean) })}>
            {busy ? 'Menyimpan…' : tpl ? 'Simpan' : 'Tambah ke katalog'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
