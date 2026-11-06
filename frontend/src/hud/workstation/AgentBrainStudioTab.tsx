import { useEffect, useState } from 'react'
import { ApiAgentFile, deleteAgentFile, getAgentFiles, saveAgentFile } from '../../state/remote'
import { Btn, Field, inputCls } from '../ui'

export function AgentBrainStudioTab({ employeeId }: { employeeId: string }) {
  const [files, setFiles] = useState<ApiAgentFile[]>([])
  const [activePath, setActivePath] = useState<string>('PERSONA.md')
  const [editorContent, setEditorContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newFilePath, setNewFilePath] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const loadFiles = async () => {
    setLoading(true)
    try {
      const list = await getAgentFiles(employeeId)
      setFiles(list)
      const current = list.find((f) => f.path === activePath) || list[0]
      if (current) {
        setActivePath(current.path)
        setEditorContent(current.content)
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [employeeId])

  const selectFile = (f: ApiAgentFile) => {
    setActivePath(f.path)
    setEditorContent(f.content)
    setNotice('')
    setErr('')
  }

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    setNotice('')
    try {
      await saveAgentFile(employeeId, activePath, editorContent)
      setNotice(`Berkas "${activePath}" berhasil disimpan dan prompt hierarkis dikompilasi ulang!`)
      await loadFiles()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (path: string) => {
    if (!confirm(`Hapus berkas "${path}"?`)) return
    try {
      await deleteAgentFile(employeeId, path)
      setActivePath('PERSONA.md')
      await loadFiles()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFilePath.trim()) return
    const path = newFilePath.trim().startsWith('skills/') || newFilePath.trim().endsWith('.md') || newFilePath.trim().endsWith('.json')
      ? newFilePath.trim()
      : `skills/${newFilePath.trim().replace(/\s+/g, '-').toLowerCase()}.md`

    try {
      await saveAgentFile(employeeId, path, `# ${path}\n\nTuliskan instruksi atau kemampuan spesifik di sini.\n`)
      setNewFilePath('')
      setShowNewModal(false)
      setActivePath(path)
      await loadFiles()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  // Pisahkan berkas root vs folder skills
  const rootFiles = files.filter((f) => !f.path.includes('/'))
  const skillFiles = files.filter((f) => f.path.startsWith('skills/'))
  const otherFiles = files.filter((f) => f.path.includes('/') && !f.path.startsWith('skills/'))

  const currentFile = files.find((f) => f.path === activePath)

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <div>
          <h3 className="text-sm font-bold text-bone flex items-center gap-2">
            <span>🧠</span> Antigravity Agent Brain Studio
          </h3>
          <p className="text-xs text-bone/50">
            Kustomisasi kepribadian, aturan, dan folder skills berbasis berkas markdown terstruktur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            variant={showPreview ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Kembali ke Editor' : '⚡ Preview Compiled Prompt'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => setShowNewModal(true)}>
            + Berkas Baru
          </Btn>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
          {notice}
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-red-400/10 border border-red-400/20 px-3 py-2 text-xs text-red-300">
          {err}
        </div>
      )}

      {/* Main Studio View */}
      {showPreview ? (
        <div className="flex-1 rounded-2xl border border-white/[0.08] bg-black/40 p-4 font-mono text-xs text-bone/80 overflow-y-auto space-y-2 whitespace-pre-wrap">
          <div className="text-[11px] text-accent font-bold uppercase tracking-wider mb-2">
            // Hierarchical Antigravity Prompt Assembly Snapshot
          </div>
          {files.map((f) => (
            <div key={f.path} className="mb-4">
              <span className="text-emerald-400 font-bold">&lt;!-- {f.path} --&gt;</span>
              <div className="mt-1 pl-2 border-l border-white/20 text-bone/90">{f.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row gap-3 min-h-0">
          {/* File Tree Explorer (Kiri) */}
          <div className="w-full sm:w-56 shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2.5 flex flex-col space-y-2 text-xs overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-bone/40 px-2 py-1 flex items-center justify-between">
              <span>EXPLORER</span>
              <span>{files.length} files</span>
            </div>

            {loading ? (
              <div className="p-4 text-center text-bone/40 text-[11px]">Memuat bundle…</div>
            ) : (
              <div className="space-y-1">
                {/* Root Files */}
                {rootFiles.map((f) => {
                  const isActive = f.path === activePath
                  const icon = f.path === 'PERSONA.md' ? '🎭' : f.path === 'RULES.md' ? '🛡️' : f.path === 'KNOWLEDGE.md' ? '📚' : f.path.endsWith('.json') ? '⚙️' : '📄'

                  return (
                    <button
                      key={f.path}
                      onClick={() => selectFile(f)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-mono transition-colors ${
                        isActive
                          ? 'bg-accent/15 text-accent font-bold border border-accent/30'
                          : 'text-bone/70 hover:bg-white/[0.05] hover:text-bone'
                      }`}
                    >
                      <span>{icon}</span>
                      <span className="truncate">{f.path}</span>
                    </button>
                  )
                })}

                {/* Skills Folder */}
                <div className="pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-bone/40 px-2 py-1 flex items-center justify-between">
                    <span>📁 skills/</span>
                    <button
                      onClick={() => {
                        setNewFilePath('skills/my-skill.md')
                        setShowNewModal(true)
                      }}
                      className="text-accent hover:underline text-[10px]"
                    >
                      + Tambah
                    </button>
                  </div>
                  <div className="pl-2 space-y-0.5 border-l border-white/[0.06] ml-2 mt-1">
                    {skillFiles.map((f) => {
                      const isActive = f.path === activePath
                      const simpleName = f.path.replace('skills/', '')

                      return (
                        <div
                          key={f.path}
                          className={`flex items-center justify-between rounded-lg px-2 py-1 font-mono transition-colors ${
                            isActive
                              ? 'bg-accent/15 text-accent font-bold'
                              : 'text-bone/70 hover:bg-white/[0.05] hover:text-bone'
                          }`}
                        >
                          <button
                            onClick={() => selectFile(f)}
                            className="flex items-center gap-1.5 truncate flex-1 text-left"
                          >
                            <span>⚡</span>
                            <span className="truncate">{simpleName}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(f.path)}
                            title="Hapus skill"
                            className="text-red-400/50 hover:text-red-400 px-1"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Other nested files */}
                {otherFiles.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-bone/40 px-2 py-1">
                      📁 Lainnya
                    </div>
                    {otherFiles.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => selectFile(f)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-mono ${
                          f.path === activePath ? 'bg-accent/15 text-accent font-bold' : 'text-bone/70 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span>📄</span>
                        <span className="truncate">{f.path}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Markdown / Config Code Editor (Kanan) */}
          <div className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] flex flex-col min-h-0 overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-ink/40">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-bone flex items-center gap-1.5">
                  <span className="text-accent">●</span> {activePath}
                </span>
                {currentFile?.isReadonly && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-bone/50">
                    Read-only
                  </span>
                )}
              </div>
              <Btn
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving || currentFile?.isReadonly}
              >
                {saving ? 'Menyimpan…' : '💾 Simpan & Kompilasi'}
              </Btn>
            </div>

            {/* Editor Textarea */}
            <div className="flex-1 p-3 min-h-0">
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                readOnly={currentFile?.isReadonly}
                className="w-full h-full resize-none rounded-xl bg-ink/60 border border-white/[0.06] p-3.5 font-mono text-xs leading-relaxed text-bone placeholder:text-bone/30 focus:border-accent/40 focus:outline-none"
                placeholder="Tuliskan isi berkas dalam format Markdown atau JSON..."
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Buat Berkas Baru */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateFile}
            className="w-[min(400px,94vw)] rounded-2xl border border-white/[0.1] bg-ink p-5 space-y-3.5 shadow-2xl text-xs text-bone"
          >
            <div className="font-bold text-sm text-bone">Tambah Berkas Antigravity Baru</div>
            <p className="text-[11px] text-bone/50">
              Contoh: <code className="text-accent">skills/data-analysis.md</code> atau <code className="text-accent">SECURITY_SOP.md</code>
            </p>
            <Field label="Path Berkas">
              <input
                autoFocus
                className={inputCls}
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder="skills/nama-skill.md"
                required
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" size="sm" onClick={() => setShowNewModal(false)}>
                Batal
              </Btn>
              <Btn variant="primary" size="sm">
                Buat Berkas
              </Btn>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
