import { useEffect } from 'react'
import { useOffice } from '../state/store'
import { SLOTS } from './layout'

/**
 * Controller non-visual untuk mengkoordinasikan slot fisik saat transisi jadwal kantor (Shift).
 * Ketika status shift beralih ke 'break', assign slot istirahat acak di Break Room / Kitchen / Pantry
 * bagi employee yang belum memiliki slot.
 */
export function ScheduleController() {
  const shiftState = useOffice((s) => s.shiftState)
  const employees = useOffice((s) => s.employees)

  useEffect(() => {
    if (!shiftState) return

    if (shiftState.kind === 'break') {
      const freeSlots = [...Array(SLOTS.break.length).keys()]
      employees.forEach((emp, i) => {
        if (emp.status === 'ON_BREAK' && emp.slot === null) {
          const assignedSlot = freeSlots[i % freeSlots.length]
          useOffice.getState().patchEmployee(emp.id, { slot: assignedSlot })
        }
      })
    } else if (shiftState.kind === 'work') {
      // Saat kembali bekerja, pastikan slot dinolkan agar kembali ke meja kerja
      employees.forEach((emp) => {
        if (emp.status === 'IDLE' && emp.slot !== null) {
          useOffice.getState().patchEmployee(emp.id, { slot: null })
        }
      })
    }
  }, [shiftState, employees])

  return null
}
