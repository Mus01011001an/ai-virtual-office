import { useEffect, useState } from 'react'
import { fetchArtifacts, createArtifact, type WorkstationArtifact } from '../../lib/api'
import { Btn, fmtTime } from '../ui'
import { FilePreviewModal } from './FilePreviewModal'

interface Props {
  employeeId: string
  employeeName: string
}

export function FilesTab({ employeeId, employeeName }: Props) {
  const [artifacts, setArtifacts] = useState<WorkstationArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchArtifacts({ employeeId })
      setArtifacts(data || [])
    } catch (err: any) {
      setError(err.message || 'Gagal memuat berkas artefak')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [employeeId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newContent.trim()) return
    try {
      setSubmitting(true)
      await createArtifact({
        employeeId,
        name: newName.trim(),
        content: newContent,
      })
      setIsCreating(false)
      setNewName('')
      setNewContent('')
      await loadData()
    } catch (err: any) {
      alert(`Gagal membuat berkas: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = artifacts.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-full min-h-[300px] flex-1 flex-col">
      {/* Action Header */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari berkas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-xl border border-line bg-ink-2 px-2.5 py-1 text-xs text-bone placeholder:text-bone/30 focus:border-accent/60 outline-none"
          />
          <Btn onClick={loadData} size="sm" variant="ghost">
            ↻
          </Btn>
        </div>
        <Btn onClick={() => setIsCreating(true)} size="sm" variant="primary">
          + Buat Berkas S3
        </Btn>
      </div>

      {/* Create Modal in-place */}
      {isCreating && (
        <form onSubmit={handleCreate} className="mb-4 rounded-2xl border border-accent/30 bg-black/40 p-3 space-y-2">
          <div className="text-xs font-semibold text-bone">Simpan Berkas Baru ke S3 Storage</div>
          <input
            type="text"
            placeholder="Nama berkas (misal: analisis-risiko.md)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            className="w-full rounded-xl border border-line bg-ink-2 px-3 py-1.5 text-xs text-bone outline-none focus:border-accent"
          />
          <textarea
            placeholder="Isi konten dokumen / kode..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            required
            rows={4}
            className="w-full rounded-xl border border-line bg-ink-2 p-2.5 text-xs font-mono text-bone outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Btn size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
              Batal
            </Btn>
            <Btn size="sm" variant="primary">
              {submitting ? 'Mengunggah...' : 'Unggah ke S3'}
            </Btn>
          </div>
        </form>
      )}

      {/* Files List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {loading && (
          <div className="flex h-48 items-center justify-center text-sm text-bone/50">
            <span className="animate-spin mr-2">⟳</span> Mengambil daftar berkas dari S3...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex h-48 flex-col items-center justify-center text-center text-bone/40">
            <div className="text-2xl mb-1">📁</div>
            <div className="text-xs">Belum ada berkas atau dokumen yang dihasilkan oleh {employeeName}.</div>
            <div className="mt-1 text-[11px] text-bone/30">
              Setiap kali AI menjalankan tool `file_generate`, berkas otomatis tersimpan di S3 bucket MinIO.
            </div>
          </div>
        )}

        {!loading &&
          filtered.map((file) => {
            const isMd = file.name.endsWith('.md')
            const isJson = file.name.endsWith('.json')
            const isCode = file.name.endsWith('.ts') || file.name.endsWith('.js') || file.name.endsWith('.py')

            return (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.07]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      isMd
                        ? 'bg-blue-500/20 text-blue-300'
                        : isJson
                        ? 'bg-amber-500/20 text-amber-300'
                        : isCode
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-white/10 text-bone/80'
                    }`}
                  >
                    {isMd ? 'MD' : isJson ? '{}' : isCode ? '<>' : 'DOC'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-bone">{file.name}</div>
                    <div className="text-[10px] text-bone/45">
                      {Math.round(file.size / 1024 * 10) / 10} KB ·{' '}
                      {fmtTime(new Date(file.createdAt).getTime())}
                      {file.task?.title ? ` · Task: ${file.task.title}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Btn size="sm" variant="ghost" onClick={() => setPreviewId(file.id)}>
                    Pratinjau
                  </Btn>
                  {file.downloadUrl ? (
                    <a
                      href={file.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center justify-center rounded-full bg-white/[0.08] px-3 text-[12px] font-semibold text-bone hover:bg-white/[0.15] transition-colors"
                    >
                      Unduh
                    </a>
                  ) : (
                    <span className="text-[10px] text-bone/30">Local</span>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {previewId && <FilePreviewModal artifactId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  )
}
