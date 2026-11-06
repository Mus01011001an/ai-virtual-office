import { useEffect, useState } from 'react'
import { useOffice } from '../state/store'
import { fetchWebhooks, createWebhook, deleteWebhook, testWebhook } from '../lib/api'
import type { WebhookChannel, WebhookConfigData } from '../state/types'
import { Btn, Field, Modal, inputCls } from './ui'

const CHANNELS: Array<{ id: WebhookChannel; label: string; icon: string; placeholderUrl: string }> = [
  { id: 'TELEGRAM', label: 'Telegram Bot', icon: '✈️', placeholderUrl: 'https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>' },
  { id: 'DISCORD', label: 'Discord Webhook', icon: '👾', placeholderUrl: 'https://discord.com/api/webhooks/...' },
  { id: 'SLACK', label: 'Slack Webhook', icon: '💬', placeholderUrl: 'https://hooks.slack.com/services/...' },
  { id: 'GENERIC_HTTP', label: 'Generic HTTP POST', icon: '🌐', placeholderUrl: 'https://api.domain-anda.com/webhook' },
]

const ALL_EVENTS = [
  { id: 'task.completed', label: 'Tugas Selesai (Task Completed)' },
  { id: 'task.failed', label: 'Tugas Gagal (Task Failed)' },
  { id: 'approval.requested', label: 'Otorisasi Diperlukan (Approval Request)' },
  { id: 'standup.completed', label: 'Rangkuman Daily Standup Pagi' },
  { id: 'integration.event', label: 'GitHub Push & PR Activity' },
]

export function IntegrationsModal() {
  const open = useOffice((s) => s.integrationsOpen)
  const currentOfficeId = useOffice((s) => s.currentOfficeId)
  const setStore = useOffice((s) => s.set)

  const [webhooks, setWebhooks] = useState<WebhookConfigData[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form states
  const [channel, setChannel] = useState<WebhookChannel>('DISCORD')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'task.completed',
    'task.failed',
    'approval.requested',
  ])
  const [busy, setBusy] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const loadData = async () => {
    setLoading(true)
    setErr('')
    try {
      const data = await fetchWebhooks()
      setWebhooks(data)
    } catch (e: any) {
      setErr(e.message || 'Gagal memuat daftar webhook')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  if (!open) return null

  const close = () => {
    setStore({ integrationsOpen: false })
    setShowAddForm(false)
    setErr('')
    setMsg('')
  }

  const handleToggleEvent = (evId: string) => {
    if (selectedEvents.includes(evId)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== evId))
    } else {
      setSelectedEvents([...selectedEvents, evId])
    }
  }

  const handleCreate = async () => {
    if (!url.trim()) {
      setErr('URL webhook tidak boleh kosong.')
      return
    }
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await createWebhook({
        channel,
        name: name.trim() || `${channel} Notification`,
        url: url.trim(),
        secret: secret.trim() || undefined,
        events: selectedEvents,
      })
      setShowAddForm(false)
      setName('')
      setUrl('')
      setSecret('')
      setMsg('Webhook berhasil didaftarkan!')
      await loadData()
    } catch (e: any) {
      setErr(e.message || 'Gagal menyimpan webhook')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus webhook ini?')) return
    try {
      await deleteWebhook(id)
      setWebhooks(webhooks.filter((w) => w.id !== id))
    } catch (e: any) {
      setErr(e.message || 'Gagal menghapus webhook')
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    setMsg('')
    setErr('')
    try {
      const res = await testWebhook(id)
      setMsg(res.message || 'Notifikasi uji coba terkirim!')
    } catch (e: any) {
      setErr(e.message || 'Gagal mengirimkan notifikasi uji coba')
    } finally {
      setTestingId(null)
    }
  }

  const currentChannelMeta = CHANNELS.find((c) => c.id === channel)!
  const githubWebhookUrl = `https://office-api.musyan.my.id/api/v1/office/integrations/github/webhook?companyId=${currentOfficeId}`

  return (
    <Modal title="Pusat Integrasi Eksternal & Notifikasi Webhook" onClose={close}>
      <div className="flex h-[560px] flex-col p-5 text-sm text-bone overflow-y-auto space-y-5">
        {/* Banner Pesan Info / Error */}
        {msg && (
          <div className="rounded-xl bg-emerald-500/15 p-3 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
            ✓ {msg}
          </div>
        )}
        {err && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-xs text-rose-300 ring-1 ring-rose-500/30">
            ⚠️ {err}
          </div>
        )}

        {/* Section 1: Inbound GitHub Bridge */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐙</span>
              <div>
                <h3 className="font-bold text-bone">GitHub Activity Bridge (Inbound)</h3>
                <p className="text-xs text-bone/60">
                  Terima push commit dan pull request GitHub untuk memicu visual animasi Server Rack 3D dan notifikasi kantor.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              Aktif
            </span>
          </div>

          <div className="mt-3 rounded-lg bg-black/50 p-2.5 border border-white/5 flex items-center justify-between gap-3">
            <code className="text-xs font-mono text-cyan-300 select-all truncate">{githubWebhookUrl}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(githubWebhookUrl)
                setMsg('URL Webhook GitHub disalin ke clipboard!')
              }}
              className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20 text-bone"
            >
              Salin URL
            </button>
          </div>
        </div>

        {/* Section 2: Outbound Webhooks List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-bone text-base">Saluran Notifikasi Keluar (Outbound)</h3>
              <p className="text-xs text-bone/60">
                Kirim alert realtime ke Telegram, Discord, Slack, atau server eksternal saat tugas tuntas atau butuh persetujuan.
              </p>
            </div>
            <Btn
              variant={showAddForm ? 'solid' : 'primary'}
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? '✕ Batal' : '+ Tambah Webhook'}
            </Btn>
          </div>

          {/* Form Tambah Webhook Baru */}
          {showAddForm && (
            <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4 space-y-3">
              <div className="font-semibold text-accent text-xs uppercase tracking-wider">
                Konfigurasi Webhook Baru
              </div>

              <div className="grid grid-cols-4 gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition-colors ${
                      channel === c.id
                        ? 'border-accent bg-accent/20 text-accent-light'
                        : 'border-white/10 bg-white/[0.02] text-bone/70 hover:bg-white/5'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Label Webhook">
                  <input
                    className={inputCls}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Channel Engineering Alert"
                  />
                </Field>
                <Field label="Secret Token / Signature (Opsional)">
                  <input
                    className={inputCls}
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="HMAC secret atau Telegram Bot Token"
                  />
                </Field>
              </div>

              <Field label="Target Endpoint URL">
                <input
                  className={inputCls}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={currentChannelMeta.placeholderUrl}
                />
              </Field>

              <Field label="Pilih Event Notifikasi">
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {ALL_EVENTS.map((ev) => (
                    <label
                      key={ev.id}
                      className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 text-xs border border-white/5 cursor-pointer hover:bg-white/[0.06]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev.id)}
                        onChange={() => handleToggleEvent(ev.id)}
                        className="rounded border-line bg-black/40 text-accent focus:ring-0"
                      />
                      <span className="text-bone/80">{ev.label}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="ghost" size="md" onClick={() => setShowAddForm(false)}>
                  Batal
                </Btn>
                <Btn variant="primary" size="md" onClick={handleCreate}>
                  {busy ? 'Menyimpan...' : 'Simpan Webhook'}
                </Btn>
              </div>
            </div>
          )}

          {/* List existing webhooks */}
          <div className="space-y-2">
            {loading && webhooks.length === 0 ? (
              <div className="p-6 text-center text-xs text-bone/40">Memuat konfigurasi webhook...</div>
            ) : webhooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-bone/40">
                Belum ada webhook yang terpasang. Klik tombol di atas untuk menambahkan saluran Discord, Telegram, atau Slack.
              </div>
            ) : (
              webhooks.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {w.channel === 'TELEGRAM' ? '✈️' : w.channel === 'DISCORD' ? '👾' : w.channel === 'SLACK' ? '💬' : '🌐'}
                      </span>
                      <span className="font-semibold text-bone">{w.name}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-bone/70 font-mono">
                        {w.channel}
                      </span>
                    </div>
                    <div className="text-xs text-bone/40 font-mono truncate max-w-md">{w.url}</div>
                    <div className="flex items-center gap-1 text-[11px] text-accent/80">
                      <span>Event:</span>
                      <span>{w.events.join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTest(w.id)}
                      disabled={testingId === w.id}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-bone hover:bg-white/20 transition-colors"
                    >
                      {testingId === w.id ? 'Mengirim...' : '⚡ Test Ping'}
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/20 transition-colors"
                      title="Hapus"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
