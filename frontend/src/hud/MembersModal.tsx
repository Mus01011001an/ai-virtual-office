import { useEffect, useState } from 'react'
import { useOffice } from '../state/store'
import { Btn, Field, Modal, inputCls } from './ui'
import {
  ApiMember,
  createMemberAccount,
  getPermissionDefinitions,
  listCompanyRoles,
  listMembers,
  removeMember,
} from '../state/remote'

export function MembersModal() {
  const open = useOffice((s) => s.membersOpen)
  const st = useOffice()

  const [members, setMembers] = useState<ApiMember[]>([])
  const [roles, setRoles] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [permDefs, setPermDefs] = useState<Array<{ group: string; key: string; label: string; description: string }>>([])

  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessMode, setAccessMode] = useState<'preset' | 'custom'>('preset')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<Record<string, boolean>>({
    'office:read': true,
    'employee:read': true,
    'task:read': true,
    'task:create': true,
    'discussion:read': true,
    'discussion:send': true,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [mList, rList, pDefs] = await Promise.all([
        listMembers(),
        listCompanyRoles(),
        getPermissionDefinitions(),
      ])
      setMembers(mList)
      setRoles(rList)
      setPermDefs(pDefs)
      if (rList.length > 0 && !selectedRoleId) {
        const defaultRole = rList.find((r) => r.name.toLowerCase() === 'member') || rList[0]
        setSelectedRoleId(defaultRole.id)
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
      setNotice('')
      setErr('')
    }
  }, [open])

  if (!open) return null
  const close = () => st.set({ membersOpen: false })

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setNotice('')
    try {
      if (!name.trim() || !email.trim() || password.length < 8) {
        throw new Error('Nama, email, dan password minimal 8 karakter wajib diisi')
      }

      const activePermKeys = Object.entries(selectedPerms)
        .filter(([, v]) => v)
        .map(([k]) => k)

      await createMemberAccount({
        name: name.trim(),
        email: email.trim(),
        password,
        roleId: accessMode === 'preset' ? selectedRoleId : undefined,
        permissions: accessMode === 'custom' ? activePermKeys : undefined,
      })

      setNotice(`Akun ${email.trim()} berhasil dibuat! Anggota dapat login dan wajib mengganti password.`)
      setName('')
      setEmail('')
      setPassword('')
      setShowForm(false)
      await loadData()
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (userId: string, userName: string) => {
    if (!confirm(`Hapus anggota "${userName}" dari office ini?`)) return
    try {
      await removeMember(userId)
      await loadData()
    } catch (ex) {
      alert((ex as Error).message)
    }
  }

  // Kelompokkan permission per group
  const groupedPerms = permDefs.reduce<Record<string, typeof permDefs>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <Modal title="Kelola Anggota & Hak Akses" onClose={close}>
      <div className="space-y-4 p-5 text-sm max-h-[85vh] overflow-y-auto w-[min(650px,94vw)]">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div>
            <p className="text-xs text-bone/55">
              Atur hak akses rekan kerja agar tidak dapat bertindak sembarangan di dalam virtual office.
            </p>
          </div>
          <Btn
            variant={showForm ? 'ghost' : 'primary'}
            size="sm"
            onClick={() => {
              setShowForm(!showForm)
              setErr('')
              setNotice('')
            }}
          >
            {showForm ? 'Batal' : '+ Buat Akun Anggota'}
          </Btn>
        </div>

        {notice && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-300">
            {notice}
          </div>
        )}
        {err && (
          <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-3.5 py-2.5 text-xs text-red-300">
            {err}
          </div>
        )}

        {/* Form Tambah Anggota */}
        {showForm && (
          <form
            onSubmit={handleCreateAccount}
            className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4 space-y-3.5 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-accent uppercase tracking-wider">
                👤 Formulir Akun Baru & Batasan Akses
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nama Anggota">
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Budi Santoso"
                  required
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="budi@kantor.com"
                  required
                />
              </Field>
            </div>

            <Field label="Password Sementara">
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                required
              />
            </Field>

            <div className="pt-2">
              <label className="text-xs font-semibold text-bone/80 block mb-2">Model Hak Akses:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAccessMode('preset')}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${
                    accessMode === 'preset' ? 'border-accent bg-accent/10' : 'border-line hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="font-semibold text-bone">Role Standar</div>
                  <div className="text-[11px] text-bone/50">Gunakan paket role yang sudah ada (Member, Viewer, dll)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setAccessMode('custom')}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${
                    accessMode === 'custom' ? 'border-accent bg-accent/10' : 'border-line hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="font-semibold text-accent">Granular RBAC (Kustom)</div>
                  <div className="text-[11px] text-bone/50">Centang manual izin apa saja yang dia boleh lakukan</div>
                </button>
              </div>
            </div>

            {accessMode === 'preset' ? (
              <Field label="Pilih Role">
                <select
                  className={inputCls}
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} className="bg-ink">
                      {r.name} — {r.description}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-bone flex items-center justify-between">
                  <span>Pilih Izin Akses Spesifik:</span>
                  <span className="text-[11px] text-accent">
                    {Object.values(selectedPerms).filter(Boolean).length} izin aktif
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-3 pr-1 rounded-xl border border-white/[0.06] bg-ink/40 p-3">
                  {Object.entries(groupedPerms).map(([group, items]) => (
                    <div key={group} className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase text-bone/40 tracking-wider">
                        📁 {group}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {items.map((def) => {
                          const checked = !!selectedPerms[def.key]
                          return (
                            <label
                              key={def.key}
                              className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                checked
                                  ? 'border-accent/40 bg-accent/10 text-bone'
                                  : 'border-white/[0.04] bg-white/[0.02] text-bone/60 hover:bg-white/[0.05]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerm(def.key)}
                                className="mt-0.5 rounded border-white/20 bg-ink text-accent accent-accent w-3.5 h-3.5"
                              />
                              <div>
                                <div className="font-semibold">{def.label}</div>
                                <div className="text-[10px] text-bone/40 leading-tight">{def.description}</div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Batal
              </Btn>
              <Btn variant="primary" size="sm" type="submit">
                {busy ? 'Menyimpan…' : 'Simpan & Beri Akun'}
              </Btn>
            </div>
          </form>
        )}

        {/* Daftar Anggota Terdaftar */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-bone/70 uppercase tracking-wider">
            Anggota Aktif ({members.length})
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-bone/40">Memuat anggota…</div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-xs text-bone/40">Belum ada anggota di office ini.</div>
          ) : (
            <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-bold text-accent">
                      {(m.user.name || m.user.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-bone">{m.user.name || 'Tanpa Nama'}</span>
                        {m.isOwner ? (
                          <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold">
                            👑 Owner
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 text-bone/70 px-2 py-0.5 text-[10px]">
                            {m.role?.name || 'Member'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-bone/45">{m.user.email}</div>
                    </div>
                  </div>

                  {!m.isOwner && (
                    <button
                      onClick={() => handleRemove(m.userId, m.user.name || m.user.email)}
                      className="text-xs text-red-400/70 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-xl transition-colors"
                    >
                      Keluarkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
