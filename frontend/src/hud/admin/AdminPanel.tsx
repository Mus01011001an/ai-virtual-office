import { useCallback, useEffect, useState } from 'react'
import { useOffice } from '../../state/store'
import {
  adminCreateTemplate, adminProviders, adminRemoveTemplate, adminTemplates, adminTools, adminUpdateTemplate,
  type AgentTemplate, type GlobalProvider, type TemplateInput,
} from '../../state/catalog'
import { Modal, Segmented } from '../ui'
import { BlockyAvatar } from '../BlockyAvatar'
import { TemplateEditor } from './TemplateEditor'
import { ProvidersTab } from './ProvidersTab'
import { HiggsfieldTab } from './HiggsfieldTab'

type Tab = 'agents' | 'models' | 'higgsfield'

/** Admin platform (superadmin): AI hanya ditambah di sini, lalu setiap office tinggal memakai. */
export function AdminPanel() {
  const open = useOffice((s) => s.adminOpen)
  const isAdmin = useOffice((s) => !!s.me?.isSuperAdmin)
  const set = useOffice((s) => s.set)
  const [tab, setTab] = useState<Tab>('agents')
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [providers, setProviders] = useState<GlobalProvider[]>([])
  const [tools, setTools] = useState<{ name: string; description: string }[]>([])
  const [sel, setSel] = useState<string | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const reload = useCallback(async () => {
    const [t, p, tl] = await Promise.all([adminTemplates(), adminProviders(), adminTools()])
    setTemplates(t); setProviders(p); setTools(tl)
    setSel((cur) => cur ?? t[0]?.id ?? 'new')
  }, [])
  useEffect(() => { if (open && isAdmin) void reload().catch((e) => setNote({ ok: false, text: (e as Error).message })) }, [open, isAdmin, reload])

  if (!open || !isAdmin) return null
  const tpl = sel && sel !== 'new' ? templates.find((t) => t.id === sel) ?? null : null
  const noProvider = !providers.length

  const save = async (input: TemplateInput) => {
    setBusy(true); setNote(null)
    try {
      if (tpl) {
        const r = await adminUpdateTemplate(tpl.id, input)
        setNote({ ok: true, text: r.synced ? `Tersimpan · diterapkan ke ${r.synced} AI di semua office` : 'Tersimpan' })
      } else {
        const r = await adminCreateTemplate(input)
        setSel(r.id); setNote({ ok: true, text: 'Ditambahkan ke katalog' })
      }
      await reload()
    } catch (e) { setNote({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!tpl) return
    await adminRemoveTemplate(tpl.id)
    setNote({ ok: true, text: tpl.usedBy ? 'Dinonaktifkan dari katalog (AI yang sudah dipakai tetap bekerja)' : 'Dihapus dari katalog' })
    setSel(null); await reload()
  }

  return (
    <Modal title="Admin platform" onClose={() => set({ adminOpen: false })} wide>
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="w-[min(420px,100%)]">
          <Segmented<Tab> value={tab} onChange={setTab} options={[
            { id: 'agents', label: 'Katalog AI' }, { id: 'models', label: 'Model AI' }, { id: 'higgsfield', label: 'Higgsfield' },
          ]} />
        </div>
        {note && <span className={`truncate text-[12px] ${note.ok ? 'text-mint' : 'text-red-300'}`}>{note.text}</span>}
      </div>

      {tab === 'agents' && (
        <div className="grid min-h-[560px] md:grid-cols-[250px_1fr]">
          <div className="border-b border-line p-2 md:border-b-0 md:border-r">
            {noProvider && (
              <button onClick={() => setTab('models')} className="mb-2 w-full rounded-xl bg-amber-400/10 px-3 py-2 text-left text-[11.5px] text-amber-200">
                Belum ada Model AI global. Tambahkan dulu agar AI bisa bekerja ›
              </button>
            )}
            <div className="max-h-[520px] space-y-0.5 overflow-y-auto">
              {templates.map((t) => (
                <button key={t.id} onClick={() => setSel(t.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${sel === t.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'} ${t.isActive ? '' : 'opacity-50'}`}>
                  <BlockyAvatar ap={t.appearance} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{t.name}</span>
                    <span className="block truncate text-[11px] text-bone/45">{t.role}</span>
                  </span>
                  {t.usedBy > 0 && <span className="text-[10.5px] text-bone/40">{t.usedBy}</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setSel('new')} className={`mt-1 w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold ${sel === 'new' ? 'bg-white/[0.08]' : 'text-accent hover:bg-white/[0.04]'}`}>+ AI baru</button>
          </div>
          <TemplateEditor key={tpl?.id ?? 'new'} tpl={tpl} providers={providers} tools={tools} onSave={save} onRemove={tpl ? () => void remove() : undefined} busy={busy} />
        </div>
      )}
      {tab === 'models' && <ProvidersTab providers={providers} reload={reload} />}
      {tab === 'higgsfield' && <HiggsfieldTab />}
    </Modal>
  )
}
