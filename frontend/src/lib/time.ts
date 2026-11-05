let offsetMs = 0
let lastTz = ''
let lastCalc = 0

function tzOffset(tz: string, now: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(now))
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  return asUTC - Math.floor(now / 1000) * 1000
}

export interface OfficeTime { h: number; m: number; s: number; ms: number; weekday: number }

export function officeNow(tz: string): OfficeTime {
  const now = Date.now()
  if (tz !== lastTz || now - lastCalc > 60_000) { offsetMs = tzOffset(tz, now); lastTz = tz; lastCalc = now }
  const w = new Date(now + offsetMs)
  return { h: w.getUTCHours(), m: w.getUTCMinutes(), s: w.getUTCSeconds(), ms: w.getUTCMilliseconds(), weekday: w.getUTCDay() }
}

export interface Schedule {
  open: number; close: number; workdays: number[]
  breaks: { name: string; start: number; end: number }[]
}

export const DEFAULT_SCHEDULE: Schedule = {
  open: 9 * 60, close: 18 * 60, workdays: [1, 2, 3, 4, 5],
  breaks: [
    { name: 'Coffee break', start: 10 * 60 + 30, end: 10 * 60 + 45 },
    { name: 'Istirahat siang', start: 12 * 60, end: 13 * 60 },
    { name: 'Afternoon break', start: 15 * 60 + 30, end: 15 * 60 + 45 },
  ],
}

export const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function scheduleState(t: OfficeTime, s = DEFAULT_SCHEDULE): { kind: 'work' | 'break' | 'closed'; label: string; next: string } {
  const now = t.h * 60 + t.m
  if (!s.workdays.includes(t.weekday)) return { kind: 'closed', label: 'Libur akhir pekan', next: `Buka hari kerja ${fmtMin(s.open)}` }
  if (now < s.open || now >= s.close) return { kind: 'closed', label: 'Kantor tutup', next: `Buka ${fmtMin(s.open)}` }
  const br = s.breaks.find((b) => now >= b.start && now < b.end)
  if (br) return { kind: 'break', label: br.name, next: `Kembali kerja ${fmtMin(br.end)}` }
  const nb = s.breaks.find((b) => b.start > now)
  const next = nb ? `${nb.name} dalam ${nb.start - now} mnt` : `Tutup ${fmtMin(s.close)}`
  return { kind: 'work', label: 'Jam kerja', next }
}
