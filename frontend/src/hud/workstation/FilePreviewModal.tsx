import { useEffect, useState } from 'react'
import { fetchArtifactContent } from '../../lib/api'
import { Modal, Btn } from '../ui'

interface Props {
  artifactId: string
  onClose: () => void
}

export function FilePreviewModal({ artifactId, onClose }: Props) {
  const [data, setData] = useState<{
    id: string
    name: string
    mimeType: string
    size: number
    content: string
    downloadUrl: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchArtifactContent(artifactId)
      .then(setData)
      .catch((err) => setError(err.message || 'Gagal mengambil isi berkas'))
      .finally(() => setLoading(false))
  }, [artifactId])

  const copyContent = () => {
    if (!data?.content) return
    navigator.clipboard.writeText(data.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal title={`Pratinjau · ${data?.name || 'Berkas'}`} onClose={onClose} wide>
      <div className="p-5">
        {loading && (
          <div className="flex h-64 items-center justify-center text-sm text-bone/50">
            <span className="animate-spin mr-2">⟳</span> Mengunduh konten dari S3...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="text-xs text-bone/60">
                <span className="font-semibold text-bone">{data.name}</span> · {Math.round(data.size / 1024 * 10) / 10} KB · {data.mimeType}
              </div>
              <div className="flex items-center gap-2">
                <Btn size="sm" onClick={copyContent} variant="ghost">
                  {copied ? '✓ Tersalin' : 'Salin Teks'}
                </Btn>
                {data.downloadUrl && (
                  <a
                    href={data.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-ink hover:bg-accent-2 transition-colors"
                  >
                    Unduh Berkas
                  </a>
                )}
              </div>
            </div>

            <div className="max-h-[500px] overflow-auto rounded-xl border border-line bg-black/60 p-4 font-mono text-xs text-bone/90 leading-relaxed whitespace-pre-wrap selection:bg-accent selection:text-ink">
              {data.content || '<berkas kosong>'}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
