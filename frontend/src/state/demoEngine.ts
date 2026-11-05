/**
 * DEMO ENGINE — simulasi status agent selama backend AI Engine belum ada.
 * Hanya menggerakkan employee dengan isDemo=true. Employee non-demo TIDAK disimulasikan
 * (sesuai rule: jangan pura-pura bekerja tanpa eksekusi nyata).
 */
import { currentOffice, useOffice } from './store'
import type { Employee, EmployeeStatus, SlotZone } from './types'
import { SLOTS } from '../office/layout'
import { officeNow, scheduleState } from '../lib/time'

interface Step { s: EmployeeStatus; text: string; tool?: string; out?: string[]; dur: [number, number] }
interface Script { title: string; steps: Step[] }

const T = (s: EmployeeStatus, text: string, dur: [number, number], tool?: string, out?: string[]): Step => ({ s, text, dur, tool, out })

const SCRIPTS: Record<string, Script[]> = {
  Infrastructure: [
    { title: 'Investigasi latency API produksi naik', steps: [
      T('THINKING', 'Menganalisis gejala & menyusun rencana investigasi', [5, 8]),
      T('TOOL_EXECUTING', 'Cek container yang berjalan', [4, 6], 'docker ps', ['CONTAINER ID   IMAGE        STATUS', 'a1b2c3d4e5f6   api:1.8.2    Up 3 hours', 'f6e5d4c3b2a1   postgres:16  Up 3 hours', '0a9b8c7d6e5f   redis:7      Up 3 hours']),
      T('TOOL_EXECUTING', 'Membaca log container API', [5, 7], 'docker logs --tail 50 api', ['WARN slow query 1840ms SELECT * FROM orders ...', 'WARN pool exhausted (max=20)']),
      T('TOOL_EXECUTING', 'Inspeksi koneksi PostgreSQL', [4, 6], 'psql -c "select count(*) from pg_stat_activity"', [' count', '-------', '   20']),
      T('THINKING', 'Menyimpulkan bottleneck: connection pool + index hilang', [5, 7]),
      T('WORKING', 'Menyusun incident report', [6, 9]),
    ] },
    { title: 'Audit konfigurasi Nginx', steps: [
      T('TOOL_EXECUTING', 'Validasi konfigurasi', [3, 5], 'nginx -t', ['nginx: configuration file /etc/nginx/nginx.conf test is successful']),
      T('THINKING', 'Meninjau rate limit & cache header', [5, 8]),
      T('WORKING', 'Menulis rekomendasi perubahan', [6, 9]),
    ] },
  ],
  'Product Engineering': [
    { title: 'Implementasi halaman login', steps: [
      T('THINKING', 'Membaca requirement & desain', [4, 7]),
      T('WORKING', 'Menulis komponen LoginForm.tsx', [7, 10]),
      T('TOOL_EXECUTING', 'Build project', [4, 6], 'npm run build', ['vite v8 building for production...', '✓ 412 modules transformed.', '✓ built in 3.21s']),
      T('WAITING', 'Menunggu endpoint /auth/login dari backend', [6, 9]),
      T('WORKING', 'Integrasi API & validasi form', [6, 9]),
    ] },
    { title: 'Endpoint REST /orders', steps: [
      T('THINKING', 'Desain skema & kontrak API', [5, 7]),
      T('WORKING', 'Menulis OrdersController & service', [7, 10]),
      T('TOOL_EXECUTING', 'Migrasi database', [4, 6], 'npx prisma migrate dev', ['Applying migration `20261105_orders`', '✔ Generated Prisma Client']),
      T('TOOL_EXECUTING', 'Menjalankan unit test', [4, 6], 'npm test -- orders', ['PASS  src/orders/orders.service.spec.ts', 'Tests: 12 passed, 12 total']),
    ] },
  ],
  Quality: [
    { title: 'Regression test modul checkout', steps: [
      T('TOOL_EXECUTING', 'Menjalankan E2E suite', [6, 9], 'npx playwright test checkout', ['Running 18 tests using 4 workers', '  ✓ 17 passed', '  ✘ 1 failed: coupon expired edge-case']),
      T('THINKING', 'Menganalisis test gagal', [5, 7]),
      T('WORKING', 'Menulis bug report', [5, 7]),
    ] },
    { title: 'Review PR #482', steps: [
      T('TOOL_EXECUTING', 'Mengambil diff PR', [3, 5], 'gh pr diff 482', ['+ export async function refreshToken(...)', '- const ttl = 3600']),
      T('THINKING', 'Memeriksa isu keamanan & edge-case', [6, 9]),
      T('WORKING', 'Menulis komentar review', [5, 8]),
    ] },
  ],
  default: [
    { title: 'Menyusun dokumentasi sprint', steps: [
      T('THINKING', 'Mengumpulkan konteks dari task selesai', [5, 8]),
      T('TOOL_EXECUTING', 'Riset referensi', [4, 6], 'web.search "best practices"', ['5 hasil relevan ditemukan']),
      T('WORKING', 'Menulis dokumen', [8, 12]),
    ] },
    { title: 'Analisis metrik mingguan', steps: [
      T('TOOL_EXECUTING', 'Query data', [4, 6], 'psql -c "select ... from usage_records"', ['  rows: 1,284']),
      T('THINKING', 'Mencari tren & anomali', [6, 8]),
      T('WORKING', 'Membuat ringkasan', [6, 9]),
    ] },
  ],
}

interface RS { phase: 'idle' | 'task' | 'break' | 'meeting' | 'collab' | 'offline' | 'held'; until: number; script?: Script; step: number; taskId?: string }
const rs = new Map<string, RS>()
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const now = () => Date.now() / 1000

function occupied(zone: SlotZone) {
  return new Set(useOffice.getState().employees.filter((e) => e.slot !== null && zoneOf(e.status) === zone).map((e) => e.slot!))
}
const zoneOf = (s: EmployeeStatus): SlotZone | null => (s === 'ON_BREAK' ? 'break' : s === 'IN_MEETING' ? 'meeting' : s === 'COLLABORATING' ? 'collab' : null)
function freeSlot(zone: SlotZone) {
  const used = occupied(zone)
  const free = SLOTS[zone].map((_, i) => i).filter((i) => !used.has(i))
  return free.length ? free[Math.floor(Math.random() * free.length)] : null
}

function setStatus(e: Employee, status: EmployeeStatus, extra: Partial<Employee> = {}) {
  const st = useOffice.getState()
  if (e.status !== status) st.pushActivity(e.id, 'status', `Status → ${status}`)
  st.patchEmployee(e.id, { status, ...extra })
}

function startTask(e: Employee, title?: string, taskId?: string) {
  const list = SCRIPTS[e.department] ?? SCRIPTS.default
  const base = list[Math.floor(Math.random() * list.length)]
  const script = title ? { ...base, title } : base
  const st = useOffice.getState()
  const id = taskId ?? st.addTask({ employeeId: e.id, title: script.title, status: 'EXECUTING', isDemo: true }).id
  st.patchTask(id, { status: 'EXECUTING' })
  st.pushActivity(e.id, 'info', `Menerima task: ${script.title}`)
  rs.set(e.id, { phase: 'task', until: 0, script, step: -1, taskId: id })
  setStatus(e, 'THINKING', { currentTask: script.title, progress: 0, slot: null })
}

function advanceTask(e: Employee, r: RS) {
  const st = useOffice.getState()
  r.step++
  const s = r.script!
  if (r.step >= s.steps.length) {
    st.pushActivity(e.id, 'done', `Task selesai: ${s.title}`)
    if (r.taskId) st.patchTask(r.taskId, { status: 'COMPLETED', finishedAt: Date.now() })
    rs.set(e.id, { phase: 'idle', until: now() + rand(8, 22), step: 0 })
    setStatus(e, 'IDLE', { currentTask: null, currentTool: null, progress: 0 })
    return
  }
  const step = s.steps[r.step]
  r.until = now() + rand(...step.dur)
  st.pushActivity(e.id, step.tool ? 'tool' : step.s === 'THINKING' ? 'ai' : 'info', step.tool ? `$ ${step.tool}` : step.text)
  step.out?.forEach((l) => st.pushActivity(e.id, 'output', l))
  if (step.s === 'WAITING') st.pushActivity(e.id, 'warn', step.text)
  setStatus(e, step.s, { currentTool: step.tool ?? null, progress: (r.step + 1) / s.steps.length })
}

let lastMeeting = 0

function tick() {
  const st = useOffice.getState()
  if (!st.entered) return
  const t = now()
  const sched = st.simulateSchedule ? scheduleState(officeNow(currentOffice().timezone)).kind : 'work'
  const demo = st.employees.filter((e) => e.isDemo)

  for (const e of demo) {
    let r = rs.get(e.id)
    if (!r) { r = { phase: e.status === 'OFFLINE' ? 'offline' : 'idle', until: t + (e.status === 'OFFLINE' ? rand(35, 50) : rand(1, 10)), step: 0 }; rs.set(e.id, r) }
    if (r.phase === 'held' || t < r.until) continue
    const cur = useOffice.getState().employees.find((x) => x.id === e.id)!

    // Jadwal: hanya transisi di batas step yang aman
    if (sched !== 'work' && r.phase !== 'task') {
      const want: EmployeeStatus = sched === 'break' ? 'ON_BREAK' : 'OFFLINE'
      if (cur.status !== want) {
        setStatus(cur, want, { slot: want === 'ON_BREAK' ? freeSlot('break') : null, currentTask: null, currentTool: null })
        st.pushActivity(e.id, 'info', want === 'ON_BREAK' ? 'Jadwal istirahat — menuju break room' : 'Di luar jam kerja — pulang')
      }
      r.phase = want === 'ON_BREAK' ? 'break' : 'offline'; r.until = t + 15
      continue
    }

    switch (r.phase) {
      case 'task': advanceTask(cur, r); break
      case 'offline':
        st.pushActivity(e.id, 'info', 'Clock-in — masuk kantor')
        setStatus(cur, 'IDLE'); rs.set(e.id, { phase: 'idle', until: t + rand(10, 20), step: 0 }); break
      case 'break': case 'meeting': case 'collab':
        if (r.phase === 'break') st.pushActivity(e.id, 'info', 'Selesai istirahat, kembali ke meja')
        setStatus(cur, 'IDLE', { slot: null }); rs.set(e.id, { phase: 'idle', until: t + rand(6, 15), step: 0 }); break
      case 'idle': {
        const queued = st.tasks.find((k) => k.employeeId === e.id && k.status === 'QUEUED')
        if (queued) { startTask(cur, queued.title, queued.id); break }
        const roll = Math.random()
        const collabActive = useOffice.getState().employees.filter((x) => x.status === 'COLLABORATING').length
        if (roll < 0.66) startTask(cur)
        else if (roll < 0.78) {
          const slot = freeSlot('break')
          if (slot !== null) { st.pushActivity(e.id, 'info', 'Ambil kopi sebentar'); setStatus(cur, 'ON_BREAK', { slot }); rs.set(e.id, { phase: 'break', until: t + rand(30, 55), step: 0 }) }
        } else if (roll < 0.84 && collabActive < 4) {
          const partner = demo.find((p) => p.id !== e.id && rs.get(p.id)?.phase === 'idle' && useOffice.getState().employees.find((x) => x.id === p.id)?.status === 'IDLE')
          const s1 = freeSlot('collab')
          if (partner && s1 !== null) {
            const until = t + rand(28, 45)
            setStatus(cur, 'COLLABORATING', { slot: s1, currentTask: `Diskusi dengan ${partner.name}` })
            const s2 = freeSlot('collab')
            setStatus(partner, 'COLLABORATING', { slot: s2, currentTask: `Diskusi dengan ${cur.name}` })
            st.pushActivity(e.id, 'info', `Kolaborasi dengan ${partner.name}`)
            st.pushActivity(partner.id, 'info', `Kolaborasi dengan ${cur.name}`)
            rs.set(e.id, { phase: 'collab', until, step: 0 }); rs.set(partner.id, { phase: 'collab', until, step: 0 })
          } else r.until = t + rand(5, 10)
        } else r.until = t + rand(6, 14)
        break
      }
    }
  }

  // meeting periodik
  if (t - lastMeeting > 150) {
    const idle = demo.filter((e) => rs.get(e.id)?.phase === 'idle')
    if (idle.length >= 3) {
      lastMeeting = t
      const group = idle.sort(() => Math.random() - 0.5).slice(0, Math.min(5, idle.length))
      const until = t + rand(45, 70)
      group.forEach((e, i) => {
        setStatus(e, 'IN_MEETING', { slot: i * 2 % 8 + (i >= 4 ? 1 : 0), currentTask: 'Sprint sync' })
        st.pushActivity(e.id, 'info', 'Meeting: Sprint sync')
        rs.set(e.id, { phase: 'meeting', until, step: 0 })
      })
    }
  }
}

/**
 * CEO memanggil employee demo: simulasi dihentikan untuk employee ini. Task yang sedang jalan
 * dikembalikan ke QUEUED (dilanjutkan setelah dilepas), jadi tidak pernah ada COMPLETED palsu.
 */
export function holdDemo(id: string) {
  const r = rs.get(id)
  if (r?.phase === 'task' && r.taskId) useOffice.getState().patchTask(r.taskId, { status: 'QUEUED' })
  rs.set(id, { phase: 'held', until: Infinity, step: 0 })
}
export function releaseDemo(id: string) {
  rs.set(id, { phase: 'idle', until: now() + rand(2, 6), step: 0 })
}

let timer: number | undefined
export function startDemoEngine() {
  stopDemoEngine()
  rs.clear(); lastMeeting = now() - 90
  timer = window.setInterval(tick, 1000)
}
export function stopDemoEngine() { if (timer) window.clearInterval(timer); timer = undefined }
