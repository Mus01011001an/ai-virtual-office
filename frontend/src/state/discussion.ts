/**
 * Diskusi CEO dengan employee yang dipanggil.
 * - Hanya yang RELEVAN yang membalas: disebut namanya → yang topiknya cocok dengan role/skill → (kalau tidak ada)
 *   satu koordinator (Project Manager) yang menanggapi.
 * - Employee DEMO: balasan disimulasikan dari template & SELALU berlabel DEMO.
 * - Employee non-demo: TIDAK ada balasan palsu. Pesan dicatat + task masuk antrean sampai AI Engine (Phase 3) aktif.
 *   Saat backend ada, ganti `demoReply()` dengan panggilan ke agent runtime; UI & 3D tidak perlu berubah.
 */
import { useOffice } from './store'
import { systemMsg } from './gather'
import { assignTask, sendDiscussionMessage } from './remote'
import type { Employee } from './types'
import { uid } from '../lib/rng'

interface Topic { id: string; kw: string[]; who: RegExp; clause: string }
const TOPICS: Topic[] = [
  { id: 'infra', kw: ['deploy', 'server', 'docker', 'kubernetes', 'k8s', 'nginx', 'pipeline', 'ci/cd', 'infra', 'cloud', 'vps', 'container', 'devops', 'hosting', 'domain', 'dns', 'ssl', 'cloudflare', 'linux'], who: /devops|infrastructure|reliability|kubernetes|docker/, clause: 'cek konfigurasi server, container, dan pipeline-nya' },
  { id: 'ops', kw: ['down', 'lambat', 'lemot', 'latency', 'monitoring', 'uptime', 'incident', 'insiden', 'crash', 'outage', 'alert', 'error 500'], who: /reliability|devops|incident|monitoring|backend/, clause: 'lihat dashboard monitoring dan log error-nya' },
  { id: 'frontend', kw: ['frontend', 'tampilan', 'halaman', 'page', 'react', 'next.js', 'css', 'tombol', 'button', 'layout', 'komponen', 'responsive', 'website', 'web'], who: /frontend|tailwind|next\.js/, clause: 'cek komponennya dan tampilan di beberapa ukuran layar' },
  { id: 'design', kw: ['desain', 'design', 'ux', 'ui', 'mockup', 'figma', 'warna', 'font', 'ikon', 'icon', 'wireframe', 'prototype'], who: /design|ui\/ux/, clause: 'siapkan mockup dan alur UX-nya' },
  { id: 'backend', kw: ['backend', 'api', 'endpoint', 'database', 'db', 'query', 'redis', 'prisma', 'nest', 'node', 'migrasi', 'schema', 'skema'], who: /backend|node|prisma|rest api/, clause: 'cek endpoint, query, dan skema datanya' },
  { id: 'data', kw: ['data', 'laporan', 'report', 'analisa', 'analisis', 'metrik', 'metric', 'statistik', 'angka', 'sql', 'kpi', 'grafik'], who: /data analyst|analytics/, clause: 'tarik datanya dan buat ringkasan angkanya' },
  { id: 'qa', kw: ['test', 'testing', 'bug', 'qa', 'regresi', 'regression', 'e2e', 'uji', 'rusak', 'broken'], who: /qa|quality|e2e|regression|bug/, clause: 'reproduksi kasusnya dan jalankan test regresi' },
  { id: 'security', kw: ['security', 'keamanan', 'hack', 'diretas', 'password', 'vulnerab', 'celah', 'audit', 'akses', 'permission', 'token', 'bocor'], who: /security/, clause: 'audit akses dan cari celah keamanannya' },
  { id: 'docs', kw: ['dokumentasi', 'docs', 'readme', 'panduan', 'guide', 'artikel', 'manual', 'tutorial'], who: /technical writer|documentation|writing/, clause: 'rapikan dokumentasinya supaya mudah diikuti' },
  { id: 'pm', kw: ['deadline', 'jadwal', 'timeline', 'sprint', 'prioritas', 'rencana', 'plan', 'target', 'estimasi', 'progress', 'roadmap', 'rilis', 'release'], who: /project manager|planning/, clause: 'pecah jadi task, tentukan PIC dan timeline-nya' },
  { id: 'review', kw: ['review', 'pull request', 'kode', 'code', 'refactor', 'merge'], who: /code review|reviewer/, clause: 'review perubahan kodenya sebelum di-merge' },
  { id: 'mobile', kw: ['mobile', 'android', 'ios', 'react native', 'apk', 'aplikasi hp', 'playstore', 'app store'], who: /mobile|react native/, clause: 'cek di versi Android dan iOS-nya' },
]
const GENERIC = new Set(['halaman', 'page', 'web', 'website', 'data', 'kode', 'code', 'server', 'test', 'plan', 'target', 'akses', 'token', 'ui', 'api', 'layout'])
const ROLE_WORDS = ['devops', 'frontend', 'backend', 'qa', 'designer', 'desainer', 'analyst', 'analis', 'security', 'writer', 'reviewer', 'mobile', 'manager', 'pm', 'sre']

const TASK_RE = /\b(tolong|kerjakan|kerjain|buat|bikin|cek|periksa|perbaiki|benerin|fix|siapkan|selesaikan|implement\w*|deploy|tambah\w*|ubah|update|audit|review|tulis|analisa|analisis|test)\b/i
const QUESTION_RE = /\?|\b(apa|bagaimana|gimana|kapan|kenapa|mengapa|berapa|siapa|bisa\s?kah|apakah)\b/i
const GREETING_RE = /^\s*(halo|hai|hi|hello|pagi|siang|sore|malam|selamat|assalamualaikum|hey)\b/i

/** Perintah kerja → jadi task. Pertanyaan ("siapa yang bisa bikin…?") bukan task, kecuali ada "tolong/mohon". */
const isTaskMsg = (t: string) => TASK_RE.test(t) && (!QUESTION_RE.test(t) || /\b(tolong|mohon|please)\b/i.test(t))
const has = (text: string, kw: string) => new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function profile(e: Employee) { return `${e.role} ${e.department} ${e.skills.join(' ')}`.toLowerCase() }

/** Skor relevansi + topik terbaik untuk employee terhadap pesan. */
function relevance(e: Employee, text: string) {
  const t = text.toLowerCase()
  const prof = profile(e)
  let score = 0, best: { topic: Topic; kw: string; s: number } | null = null
  for (const tp of TOPICS) {
    if (!tp.who.test(prof)) continue
    const hits = tp.kw.filter((k) => has(t, k))
    if (!hits.length) continue
    // kata umum (halaman, web, data, kode…) bobotnya lebih kecil dari kata spesifik (desain, deploy…)
    const s = hits.reduce((a, k) => a + (GENERIC.has(k) ? 1 : 2), 0)
    score += s
    if (!best || s > best.s) best = { topic: tp, kw: hits[0], s }
  }
  for (const sk of e.skills) if (has(t, sk.toLowerCase())) { score += 3; best ??= { topic: TOPICS.find((x) => x.who.test(prof)) ?? TOPICS[0], kw: sk, s: 3 } }
  for (const w of ROLE_WORDS) if (has(t, w) && (prof.includes(w) || (w === 'pm' && prof.includes('project manager')) || (w === 'sre' && prof.includes('reliability')))) score += 4
  const named = has(t, e.name.toLowerCase()) || t.includes(`@${e.name.toLowerCase()}`)
  if (named) score += 10
  return { score, named, best }
}

function demoReply(e: Employee, text: string, best: ReturnType<typeof relevance>['best'], primary: boolean): string[] {
  const clause = best?.topic.clause ?? 'bantu dari sisi keahlian saya'
  const kw = best ? `\`${best.kw}\`` : 'ini'

  if (GREETING_RE.test(text) && text.trim().split(/\s+/).length <= 4) {
    return [
      pick(['Halo mas! Siap di sini.', 'Hai pak, standby!', 'Halo! Ada yang bisa aku bantu?']),
    ]
  }

  if (!primary) {
    return [
      `Siap, aku support dari sisi **${e.role}** ya!`,
      `Fokus utamaku: ${clause}.`,
    ]
  }

  if (/\bsiapa\b/i.test(text)) {
    return [
      `Bisa aku ambil itu mas! 🙋‍♂️`,
      `Untuk ${kw}, aku bakal ${clause}.`,
    ]
  }

  if (isTaskMsg(text)) {
    return [
      pick([
        'Siap, langsung aku handle ya!',
        'Oke boss, otw aku kerjain.',
        'Noted mas, segera aku eksekusi.',
      ]),
      `Untuk ${kw}, aku bakal ${clause}. Progresnya aku kabari di sini 👍`,
    ]
  }

  if (QUESTION_RE.test(text)) {
    return [
      pick([
        'Terkait hal itu, menarik banget nih.',
        'Dari sudut pandangku, ada beberapa poin penting.',
        'Soal itu, aku ada masukan dikit.',
      ]),
      `Untuk ${kw}, aku perlu ${clause} dulu biar hasilnya presisi. Mau aku mulai sekarang?`,
    ]
  }

  return [
    pick(['Oke noted mas!', 'Siap, paham maksudnya.', 'Noted, udah aku catat.']),
    `Terkait ${kw}, nanti aku ${clause}.`,
  ]
}

// ---------- balon bicara ----------
const timers = new Map<string, number>()
export function setBubble(id: string, text: string | null, ms = 0) {
  const st = useOffice.getState()
  const b = { ...st.bubbles }
  if (text === null) delete b[id]; else b[id] = text
  st.set({ bubbles: b })
  window.clearTimeout(timers.get(id))
  if (text !== null && ms > 0) timers.set(id, window.setTimeout(() => setBubble(id, null), ms))
}

function pushChat(from: string, text: string, demo?: boolean) {
  const st = useOffice.getState()
  st.set({ chat: [...st.chat, { id: uid(), at: Date.now(), from, text, demo }].slice(-80) })
}

/** Kirim pesan CEO ke diskusi; return daftar nama yang akan menanggapi. */
export function sendMessage(raw: string) {
  const text = raw.trim()
  if (!text) return
  const st = useOffice.getState()
  const group = st.employees.filter((e) => st.summoned.includes(e.id))
  pushChat('me', text)
  setBubble('me', text, Math.max(3500, text.length * 60))
  if (!group.length) return

  const scored = group.map((e) => ({ e, ...relevance(e, text) }))
  let chosen = scored.filter((s) => s.named)
  if (!chosen.length) {
    const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
    if (ranked.length) chosen = ranked.filter((s) => s.score >= ranked[0].score * 0.6).slice(0, 3)
  }
  if (!chosen.length) {
    // tidak ada yang spesifik relevan → satu koordinator menanggapi (atau 2 untuk sapaan)
    const lead = scored.find((s) => /project manager/i.test(s.e.role)) ?? scored[0]
    chosen = GREETING_RE.test(text) ? [lead, ...scored.filter((s) => s !== lead).sort(() => Math.random() - 0.5).slice(0, 1)] : [lead]
  }

  const isTask = isTaskMsg(text)
  chosen.forEach((c, i) => {
    const e = c.e
    const primary = i === 0
    st.pushActivity(e.id, 'instruction', `CEO (diskusi): ${text}`)
    if (isTask && primary) {
      const title = text.length > 80 ? text.slice(0, 77) + '…' : text
      if (e.isDemo) st.addTask({ employeeId: e.id, title, status: 'QUEUED', isDemo: true })
      else void assignTask(e.id, title, 'discussion').catch(() => systemMsg(`Gagal membuat task untuk ${e.name}`))
    }
    if (!e.isDemo) {
      setBubble(e.id, '…')
      void sendDiscussionMessage(text)
      return
    }
    const start = 400 + i * 900 + Math.random() * 300
    const replies = demoReply(e, text, c.best, primary)

    replies.forEach((msg, msgIdx) => {
      const msgDelay = start + msgIdx * 1600 + Math.random() * 300
      window.setTimeout(() => {
        if (!useOffice.getState().summoned.includes(e.id)) return
        setBubble(e.id, '…')
        window.setTimeout(() => {
          if (!useOffice.getState().summoned.includes(e.id)) return setBubble(e.id, null)
          pushChat(e.id, msg, true)
          setBubble(e.id, msg, Math.max(4200, msg.length * 60))
          useOffice.getState().pushActivity(e.id, 'ai', `[DEMO] ${msg}`)
        }, 700 + Math.random() * 400)
      }, msgDelay)
    })
  })
  return chosen.map((c) => c.e.name)
}
