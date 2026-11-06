import { useState, useRef, useEffect } from 'react'
import { Employee, ActivityEvent } from '../../state/types'
import { executeSandboxCode, getAgentFiles } from '../../state/remote'

interface TerminalLine {
  id: string
  kind: 'prompt' | 'stdout' | 'stderr' | 'info' | 'tool'
  text: string
  time?: string
}

export function TerminalTab({
  employee,
  acts,
}: {
  employee: Employee
  acts: ActivityEvent[]
}) {
  const [history, setHistory] = useState<TerminalLine[]>(() => {
    const initial: TerminalLine[] = [
      {
        id: 'init-1',
        kind: 'info',
        text: `AI WORKSTATION SECURE TERMINAL [SESSION #${employee.id.slice(0, 8)}]`,
      },
      {
        id: 'init-2',
        kind: 'info',
        text: `Agent: ${employee.name} | Role: ${employee.role} | Model: ${employee.model || 'Default'}`,
      },
      {
        id: 'init-3',
        kind: 'info',
        text: "Ketik 'help' untuk daftar perintah atau 'py <kode>' / 'js <kode>' untuk mengeksekusi.",
      },
    ]

    // Tambahkan 5 eksekusi tool terakhir dari activity
    const toolActs = acts
      .filter((a) => a.kind === 'tool' || a.kind === 'output' || a.kind === 'error')
      .slice(-6)

    for (const a of toolActs) {
      initial.push({
        id: `act-${a.id}`,
        kind: a.kind === 'error' ? 'stderr' : a.kind === 'tool' ? 'tool' : 'stdout',
        text: a.text,
      })
    }

    return initial
  })

  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState<number>(-1)
  const [running, setRunning] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (cmdHistory.length === 0) return
      const nextIdx = historyIdx < cmdHistory.length - 1 ? historyIdx + 1 : historyIdx
      setHistoryIdx(nextIdx)
      setInput(cmdHistory[cmdHistory.length - 1 - nextIdx] || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1
        setHistoryIdx(nextIdx)
        setInput(cmdHistory[cmdHistory.length - 1 - nextIdx] || '')
      } else if (historyIdx === 0) {
        setHistoryIdx(-1)
        setInput('')
      }
    }
  }

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || running) return

    // Simpan ke riwayat input
    setCmdHistory((prev) => [...prev, trimmed])
    setHistoryIdx(-1)
    setInput('')

    // Append prompt line
    const promptLine: TerminalLine = {
      id: `p-${Date.now()}`,
      kind: 'prompt',
      text: `$ ${trimmed}`,
    }

    setHistory((prev) => [...prev, promptLine])

    const parts = trimmed.split(' ')
    const cmd = parts[0].toLowerCase()
    const args = trimmed.slice(cmd.length).trim()

    // 1. Perintah Clear
    if (cmd === 'clear') {
      setHistory([])
      return
    }

    // 2. Perintah Help
    if (cmd === 'help') {
      setHistory((prev) => [
        ...prev,
        {
          id: `out-${Date.now()}`,
          kind: 'info',
          text: `Daftar Perintah Terminal:
  py <script>       - Eksekusi kode Python 3 di sandbox aman (mis. py print(2+2))
  js <script>       - Eksekusi kode JavaScript di context VM terisolasi
  files / ls        - Menampilkan berkas virtual agent & Brain Studio
  cat <nama_file>   - Membaca isi berkas virtual agent (mis. cat PERSONA.md)
  status            - Menampilkan status agent, task aktif, dan kapasitas memori
  clear             - Membersihkan layar terminal
  help              - Menampilkan panduan bantuan ini`,
        },
      ])
      return
    }

    // 3. Perintah Status
    if (cmd === 'status') {
      setHistory((prev) => [
        ...prev,
        {
          id: `out-${Date.now()}`,
          kind: 'stdout',
          text: `[AGENT STATUS CARD]
  ID:          ${employee.id}
  Nama:        ${employee.name}
  Jabatan:     ${employee.role} (${employee.department})
  Status:      ${employee.status}
  Task Aktif:  ${employee.currentTask || '(Tidak ada task aktif)'}
  Tool Aktif:  ${employee.currentTool || '(Idle)'}
  Meja:        Meja #${employee.deskIndex + 1}
  Progress:    ${Math.round(employee.progress * 100)}%`,
        },
      ])
      return
    }

    // 4. Perintah Files / Ls
    if (cmd === 'files' || cmd === 'ls') {
      setRunning(true)
      try {
        const files = await getAgentFiles(employee.id)
        if (files.length === 0) {
          setHistory((prev) => [
            ...prev,
            { id: `out-${Date.now()}`, kind: 'info', text: 'Tidak ada file virtual yang tersimpan.' },
          ])
        } else {
          const listStr = files
            .map((f) => `  ${f.path.padEnd(20)} (${f.content.length} bytes) - ${f.name || 'File'}`)
            .join('\n')
          setHistory((prev) => [
            ...prev,
            { id: `out-${Date.now()}`, kind: 'stdout', text: `Virtual Files (${files.length} items):\n${listStr}` },
          ])
        }
      } catch (err) {
        setHistory((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, kind: 'stderr', text: `Gagal membaca file: ${(err as Error).message}` },
        ])
      } finally {
        setRunning(false)
      }
      return
    }

    // 5. Perintah Cat <file>
    if (cmd === 'cat') {
      if (!args) {
        setHistory((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, kind: 'stderr', text: 'Penggunaan: cat <nama_file> (mis. cat PERSONA.md)' },
        ])
        return
      }
      setRunning(true)
      try {
        const files = await getAgentFiles(employee.id)
        const found = files.find(
          (f) => f.path.toLowerCase() === args.toLowerCase() || f.name?.toLowerCase() === args.toLowerCase(),
        )
        if (!found) {
          setHistory((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, kind: 'stderr', text: `Berkas "${args}" tidak ditemukan.` },
          ])
        } else {
          setHistory((prev) => [
            ...prev,
            { id: `out-${Date.now()}`, kind: 'stdout', text: `--- ${found.path} ---\n${found.content}` },
          ])
        }
      } catch (err) {
        setHistory((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, kind: 'stderr', text: `Error: ${(err as Error).message}` },
        ])
      } finally {
        setRunning(false)
      }
      return
    }

    // 6. Eksekusi Python / JavaScript
    if (cmd === 'py' || cmd === 'python' || cmd === 'js' || cmd === 'node') {
      const lang = cmd === 'py' || cmd === 'python' ? 'python' : 'javascript'
      if (!args) {
        setHistory((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, kind: 'stderr', text: `Penggunaan: ${cmd} <kode> (mis. ${cmd} print(100*2))` },
        ])
        return
      }

      setRunning(true)
      try {
        const res = await executeSandboxCode(lang, args)
        if (res.success) {
          const out = res.stdout || '(Program selesai tanpa output stdout)'
          setHistory((prev) => [
            ...prev,
            {
              id: `out-${Date.now()}`,
              kind: 'stdout',
              text: `${out}\n[Selesai dalam ${res.executionTimeMs}ms]`,
            },
          ])
        } else {
          setHistory((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              kind: 'stderr',
              text: `${res.stderr || res.error || 'Terjadi kesalahan eksekusi'}\n[Exit code error | ${res.executionTimeMs}ms]`,
            },
          ])
        }
      } catch (err) {
        setHistory((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, kind: 'stderr', text: `Gagal mengeksekusi: ${(err as Error).message}` },
        ])
      } finally {
        setRunning(false)
      }
      return
    }

    // Perintah tidak dikenal
    setHistory((prev) => [
      ...prev,
      {
        id: `err-${Date.now()}`,
        kind: 'stderr',
        text: `bash: ${cmd}: command not found. Ketik 'help' untuk melihat daftar perintah yang tersedia.`,
      },
    ])
  }

  const promptPrefix = `agent@${employee.name.toLowerCase().replace(/[^a-z0-9]/g, '')}:~$`

  return (
    <div className="flex flex-col h-[480px] rounded-2xl border border-white/10 bg-[#070913] text-bone font-mono text-xs overflow-hidden shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-[11px] font-bold text-white/50">
            terminal://{employee.name.toLowerCase()} · bash
          </span>
        </div>
        <div className="text-[10.5px] text-cyan-400 font-bold">
          {running ? '⚙ EXECUTING…' : '● READY'}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 p-4 overflow-y-auto space-y-1.5 leading-relaxed cursor-text select-text"
      >
        {history.map((line) => {
          if (line.kind === 'prompt') {
            return (
              <div key={line.id} className="text-cyan-300 font-bold">
                {line.text}
              </div>
            )
          }
          if (line.kind === 'tool') {
            return (
              <div key={line.id} className="text-amber-300">
                ⚡ {line.text}
              </div>
            )
          }
          if (line.kind === 'stderr') {
            return (
              <div key={line.id} className="text-rose-400 whitespace-pre-wrap">
                {line.text}
              </div>
            )
          }
          if (line.kind === 'info') {
            return (
              <div key={line.id} className="text-white/45 whitespace-pre-wrap">
                {line.text}
              </div>
            )
          }
          return (
            <div key={line.id} className="text-emerald-300 whitespace-pre-wrap">
              {line.text}
            </div>
          )
        })}

        {running && (
          <div className="text-cyan-300 animate-pulse flex items-center gap-2">
            <span>Running script in isolated environment…</span>
          </div>
        )}
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={handleCommand}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.08] bg-black/40"
      >
        <span className="text-cyan-400 font-bold shrink-0">{promptPrefix}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder="Ketik perintah (mis. py 2**8 atau help)…"
          className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-white/20 text-xs font-mono"
          autoFocus
        />
        <button
          type="submit"
          disabled={running || !input.trim()}
          className="rounded-lg bg-cyan-400/20 px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:bg-cyan-400/30 disabled:opacity-30 transition-colors"
        >
          Enter ↵
        </button>
      </form>
    </div>
  )
}

