import { useFrame } from '@react-three/fiber'
import { runtime } from '../state/runtime'
import { currentOffice } from '../state/store'
import { officeNow } from '../lib/time'

/** Satu sumber waktu kantor (timezone office) untuk jam dinding & lighting. */
export function TimeTicker() {
  useFrame(() => { Object.assign(runtime.time, officeNow(currentOffice().timezone)) })
  return null
}
