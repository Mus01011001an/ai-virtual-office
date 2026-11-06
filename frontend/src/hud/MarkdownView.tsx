import React, { memo, type ReactNode } from 'react'

interface MarkdownViewProps {
  content: string
  compact?: boolean
  className?: string
}

/**
 * Engine Formatter Markdown Mandiri Berkinerja Tinggi (Zero-Dependency)
 * Mengonversi sintaks markdown mentah (**bold**, *italic*, `code`, ```block```, list, link)
 * menjadi elemen React asli yang terformat indah, aman dari XSS, dan tanpa dependensi eksternal.
 */
export const MarkdownView = memo(function MarkdownView({
  content,
  compact = false,
  className = '',
}: MarkdownViewProps) {
  if (!content) return null

  // Parser inline: bold, italic, inline code, dan link
  const renderInline = (text: string): ReactNode[] => {
    const parts: ReactNode[] = []
    // Tangkap code (`...`), bold (**...** / __...__), italic (*...* / _..._), dan link ([...](...))
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+(?<!\*)\*|(?<!_)_[^_]+(?<!_)_|\[[^\]]+\]\([^)]+\))/g
    let lastIdx = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index))
      }

      const token = match[0]
      const key = `${match.index}-${token.slice(0, 6)}`

      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={key}
            className="rounded bg-current/10 px-1 py-0.2 font-mono text-[11px] font-semibold border border-current/20"
          >
            {token.slice(1, -1)}
          </code>
        )
      } else if (
        (token.startsWith('**') && token.endsWith('**')) ||
        (token.startsWith('__') && token.endsWith('__'))
      ) {
        parts.push(
          <strong key={key} className="font-bold">
            {renderInline(token.slice(2, -2))}
          </strong>
        )
      } else if (
        (token.startsWith('*') && token.endsWith('*')) ||
        (token.startsWith('_') && token.endsWith('_'))
      ) {
        parts.push(
          <em key={key} className="italic opacity-90">
            {renderInline(token.slice(1, -1))}
          </em>
        )
      } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
        const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          const rawHref = linkMatch[2].trim()
          // Validasi keamanan: hanya izinkan http:// atau https://
          const isSafe = /^https?:\/\//i.test(rawHref)
          const href = isSafe ? rawHref : '#'
          parts.push(
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-accent/40 hover:decoration-accent hover:text-accent-2 transition-colors"
            >
              {linkMatch[1]}
            </a>
          )
        }
      }

      lastIdx = regex.lastIndex
    }

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx))
    }

    return parts
  }

  // MODE COMPACT (Khusus untuk 3D Speech Bubble & feed ringkas)
  if (compact) {
    const rawLines = content.split('\n').filter((l) => l.trim().length > 0)
    return (
      <span className={`inline-block leading-snug break-words ${className}`}>
        {rawLines.map((line, idx) => {
          let cleanLine = line.trim()
          // Jika baris adalah list bullet, format rapi dengan simbol bullet
          if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
            cleanLine = `• ${cleanLine.slice(2)}`
          }
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="block h-1" />}
              {renderInline(cleanLine)}
            </React.Fragment>
          )
        })}
      </span>
    )
  }

  // MODE FULL (Untuk Discussion Panel, AiConversationTab, Modal)
  const lines = content.split('\n')
  const nodes: ReactNode[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let codeLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Blok kode ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        nodes.push(
          <div
            key={`cb-${i}`}
            className="my-2 rounded-xl border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] overflow-x-auto shadow-inner"
          >
            {codeLang && (
              <div className="text-[9px] font-bold tracking-wider text-bone/40 uppercase mb-1.5 select-none">
                {codeLang}
              </div>
            )}
            <pre className="text-accent/95 leading-relaxed font-mono whitespace-pre">
              {codeBuffer.join('\n')}
            </pre>
          </div>
        )
        codeBuffer = []
        codeLang = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeLang = line.trim().slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    const trimmed = line.trim()

    // Header (#, ##, ###)
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,3})\s+(.*)$/)
      if (match) {
        const level = match[1].length
        const headingText = match[2]
        if (level === 1) {
          nodes.push(
            <h3 key={`h1-${i}`} className="text-sm font-bold text-bone mt-2 mb-1">
              {renderInline(headingText)}
            </h3>
          )
        } else if (level === 2) {
          nodes.push(
            <h4 key={`h2-${i}`} className="text-xs font-bold text-bone mt-1.5 mb-0.5">
              {renderInline(headingText)}
            </h4>
          )
        } else {
          nodes.push(
            <h5 key={`h3-${i}`} className="text-[11.5px] font-semibold text-bone/90 mt-1 mb-0.5">
              {renderInline(headingText)}
            </h5>
          )
        }
        continue
      }
    }

    // List item bullet (- atau *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      nodes.push(
        <div key={`li-${i}`} className="flex gap-1.5 pl-1 my-0.5 text-bone/90">
          <span className="text-accent text-[11px] leading-tight select-none">•</span>
          <span className="flex-1 leading-snug">{renderInline(trimmed.slice(2))}</span>
        </div>
      )
      continue
    }

    // List item bernomor (1. 2. 3.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      nodes.push(
        <div key={`oli-${i}`} className="flex gap-1.5 pl-1 my-0.5 text-bone/90">
          <span className="text-accent font-mono text-[10.5px] leading-tight select-none">
            {numMatch[1]}.
          </span>
          <span className="flex-1 leading-snug">{renderInline(numMatch[2])}</span>
        </div>
      )
      continue
    }

    // Blockquote (> )
    if (trimmed.startsWith('> ')) {
      nodes.push(
        <div
          key={`quote-${i}`}
          className="my-1.5 border-l-2 border-accent/70 pl-2.5 text-bone/75 italic bg-white/[0.02] py-1 rounded-r-lg"
        >
          {renderInline(trimmed.slice(2))}
        </div>
      )
      continue
    }

    // Paragraf biasa (jika ada teks)
    if (trimmed.length > 0) {
      nodes.push(
        <p key={`p-${i}`} className="my-1 leading-relaxed text-bone/90">
          {renderInline(line)}
        </p>
      )
    }
  }

  // Jika kode blok belum ditutup di akhir pesan
  if (inCodeBlock && codeBuffer.length > 0) {
    nodes.push(
      <div
        key="cb-unclosed"
        className="my-2 rounded-xl border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] overflow-x-auto shadow-inner"
      >
        <pre className="text-accent/95 leading-relaxed font-mono whitespace-pre">
          {codeBuffer.join('\n')}
        </pre>
      </div>
    )
  }

  return <div className={`markdown-body ${className}`}>{nodes}</div>
})
