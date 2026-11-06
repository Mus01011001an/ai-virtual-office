import { useEffect, useState } from 'react'
import { useOffice } from '../state/store'
import { fastForwardSchedule, fetchSchedule, patchSchedule } from '../lib/api'
import { Btn, Field, Modal, Toggle, inputCls } from './ui'

export function ScheduleConfigModal() {
  const open = useOffice((s) => s.scheduleConfigOpen)
  const set = useOffice((s) => s.set)
  const [schedule, setSchedule] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [msg, setMsg] = useState('')

  const loadData = async () => {
    try {
      const res = await fetchSchedule()
      setSchedule(res)
    } catch (e: any) {
      setMsg(`Gagal memuat jadwal: ${e.message}`)
    }
  }

  useEffect(() => {
    if (open) void loadData()
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const updated = await patchSchedule({
        timezone: schedule.timezone,
        workStart: schedule.workStart,
        workEnd: schedule.workEnd,
        standupTime: schedule.standupTime,
        autoStandupEnabled: schedule.autoStandupEnabled,
        proactiveEnabled: schedule.proactiveEnabled,
      })
      setSchedule(updated)
      set({ officeSchedule: updated })
      setMsg('✅ Jadwal berhasil disimpan!')
    } catch (e: any) {
      setMsg(`❌ Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleFastForward = async (clock: string) => {
    setSimulating(true)
    setMsg('')
    try {
      const res = await fastForwardSchedule(clock)
      if (res?.status) {
        set({ shiftState: res.status })
      }
      setMsg(`⚡ Waktu disimulasikan ke jam ${clock} (${res?.status?.label || 'Shift update'})`)
    } catch (e: any) {
      setMsg(`❌ Gagal simulasi: ${e.message}`)
    } finally {
      setSimulating(false)
    }
  }

  return (
    <Modal title="⚙️ Pengaturan Jadwal Kantor & Shift" onClose={() => set({ scheduleConfigOpen: false })}>
      <div className="p-6 space-y-5 max-w-xl max-h-[80vh] overflow-y-auto text-sm text-bone/90">
        <p className="text-xs text-bone/50">
          Atur jam operasional kantor virtual. Karyawan AI akan otomatis masuk kerja, beristirahat di pantry, dan
          meninggalkan gedung sesuai jadwal ini.
        </p>

        {msg && (
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-bone/90 font-medium">
            {msg}
          </div>
        )}

        {schedule && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jam Mulai Kerja (Buka)">
                <input
                  type="time"
                  className={inputCls}
                  value={schedule.workStart || '09:00'}
                  onChange={(e) => setSchedule({ ...schedule, workStart: e.target.value })}
                />
              </Field>
              <Field label="Jam Selesai Kerja (Tutup)">
                <input
                  type="time"
                  className={inputCls}
                  value={schedule.workEnd || '18:00'}
                  onChange={(e) => setSchedule({ ...schedule, workEnd: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Jam Standup Pagi">
                <input
                  type="time"
                  className={inputCls}
                  value={schedule.standupTime || '09:00'}
                  onChange={(e) => setSchedule({ ...schedule, standupTime: e.target.value })}
                />
              </Field>
              <Field label="Timezone Kantor">
                <input
                  type="text"
                  className={inputCls}
                  value={schedule.timezone || 'Asia/Jakarta'}
                  onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-line bg-surface/40 p-4 space-y-1">
              <Toggle
                label="Daily Standup Otomatis"
                hint="Kumpulkan tim otomatis saat jam buka kantor"
                checked={schedule.autoStandupEnabled ?? true}
                onChange={(c) => setSchedule({ ...schedule, autoStandupEnabled: c })}
              />

              <div className="border-t border-line/60 pt-1">
                <Toggle
                  label="Inisiatif Agen Otonom (Proaktif)"
                  hint="Agen idle membuat usulan tugas mandiri"
                  checked={schedule.proactiveEnabled ?? true}
                  onChange={(c) => setSchedule({ ...schedule, proactiveEnabled: c })}
                />
              </div>
            </div>

            {/* Fast-Forward Time Simulator */}
            <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-4 space-y-2.5">
              <div className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span> Simulator Waktu Cepat (Fast-Forward)
              </div>
              <p className="text-[11px] text-bone/50">
                Uji coba transisi shift kantor secara instan tanpa menunggu jam nyata:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleFastForward('09:00')}
                  disabled={simulating}
                  className="px-2.5 py-1.5 rounded-xl border border-line hover:border-accent text-xs font-medium text-bone/80 hover:text-white transition-colors"
                >
                  🌅 09:00 (Masuk/Standup)
                </button>
                <button
                  type="button"
                  onClick={() => handleFastForward('10:35')}
                  disabled={simulating}
                  className="px-2.5 py-1.5 rounded-xl border border-line hover:border-accent text-xs font-medium text-bone/80 hover:text-white transition-colors"
                >
                  ☕ 10:35 (Coffee Break)
                </button>
                <button
                  type="button"
                  onClick={() => handleFastForward('12:15')}
                  disabled={simulating}
                  className="px-2.5 py-1.5 rounded-xl border border-line hover:border-accent text-xs font-medium text-bone/80 hover:text-white transition-colors"
                >
                  🍽️ 12:15 (Makan Siang)
                </button>
                <button
                  type="button"
                  onClick={() => handleFastForward('14:00')}
                  disabled={simulating}
                  className="px-2.5 py-1.5 rounded-xl border border-line hover:border-accent text-xs font-medium text-bone/80 hover:text-white transition-colors"
                >
                  💻 14:00 (Sesi Sprint)
                </button>
                <button
                  type="button"
                  onClick={() => handleFastForward('15:35')}
                  disabled={simulating}
                  className="px-2.5 py-1.5 rounded-xl border border-line hover:border-accent text-xs font-medium text-bone/80 hover:text-white transition-colors"
                >
                  ☕ 15:35 (Sore Break)
                </button>
                <button
                  type="button"
                  onClick={() => handleFastForward('18:05')}
                  disabled={simulating}
                  className="px-2.5 py-1.5 rounded-xl border border-line hover:border-accent text-xs font-medium text-bone/80 hover:text-white transition-colors"
                >
                  🚪 18:05 (Kantor Tutup)
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Btn variant="ghost" size="md" onClick={() => set({ scheduleConfigOpen: false })}>
                Tutup
              </Btn>
              <Btn variant="primary" size="md" onClick={handleSave}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
