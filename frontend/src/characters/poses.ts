/** Pose sendi (radian). Konvensi: rotasi.x negatif = ayun ke depan. */
export interface Pose {
  y: number; spineX: number; headX: number; headY: number
  lSx: number; lSz: number; lEx: number
  rSx: number; rSz: number; rEx: number
  lHx: number; lKx: number; rHx: number; rKx: number
}

export type PoseName =
  | 'stand' | 'walk' | 'run' | 'type' | 'typeFast' | 'think' | 'sitIdle' | 'wait'
  | 'sitTalk' | 'sitRelax' | 'standCup' | 'standTalk'

const STAND: Pose = { y: 0.95, spineX: 0, headX: 0, headY: 0, lSx: 0, lSz: 0.06, lEx: -0.12, rSx: 0, rSz: -0.06, rEx: -0.12, lHx: 0, lKx: 0, rHx: 0, rKx: 0 }
const SIT: Pose = { ...STAND, y: 0.53, spineX: 0.04, lHx: -1.52, lKx: 1.5, rHx: -1.52, rKx: 1.5, lSx: -0.3, rSx: -0.3, lEx: -0.7, rEx: -0.7 }

export function poseAt(name: PoseName, t: number, seed: number, out: Pose): Pose {
  const s = seed * 13.37
  Object.assign(out, name === 'stand' || name === 'walk' || name === 'run' || name === 'standCup' || name === 'standTalk' ? STAND : SIT)
  switch (name) {
    case 'stand':
      out.y += Math.sin(t * 1.6 + s) * 0.004; out.headY = Math.sin(t * 0.4 + s) * 0.25
      break
    case 'walk': case 'run': {
      const run = name === 'run'
      const ph = t * (run ? 11 : 7.2)
      const a = run ? 0.75 : 0.48
      out.lHx = Math.sin(ph) * a; out.rHx = -Math.sin(ph) * a
      out.lKx = Math.max(0, Math.sin(ph + 1.6)) * (run ? 1.3 : 0.7); out.rKx = Math.max(0, Math.sin(ph + 1.6 + Math.PI)) * (run ? 1.3 : 0.7)
      out.lSx = -Math.sin(ph) * a * 0.8; out.rSx = Math.sin(ph) * a * 0.8
      out.lEx = run ? -1.2 : -0.3; out.rEx = run ? -1.2 : -0.3
      out.y = STAND.y + Math.abs(Math.cos(ph)) * (run ? 0.05 : 0.025) - (run ? 0.03 : 0)
      out.spineX = run ? 0.15 : 0.03
      break
    }
    case 'type': case 'typeFast': {
      const f = name === 'typeFast' ? 22 : 14
      out.lSx = -0.5; out.rSx = -0.5; out.lSz = 0.12; out.rSz = -0.12
      out.lEx = -1.05 + Math.sin(t * f + s) * 0.06; out.rEx = -1.05 + Math.sin(t * f + 1.7 + s) * 0.06
      out.headX = 0.12 + Math.sin(t * 0.7 + s) * 0.03; out.spineX = 0.1
      break
    }
    case 'think':
      out.lSx = -0.5; out.lSz = 0.12; out.lEx = -1.0
      out.rSx = -1.15; out.rSz = -0.25; out.rEx = -2.05
      out.headX = -0.12 + Math.sin(t * 0.5 + s) * 0.05; out.headY = Math.sin(t * 0.35 + s) * 0.25; out.spineX = 0.08
      break
    case 'sitIdle':
      out.headY = Math.sin(t * 0.3 + s) * 0.45; out.headX = Math.sin(t * 0.21 + s) * 0.08; out.spineX = -0.04
      break
    case 'wait':
      out.headY = Math.sin(t * 0.9 + s) * 0.5; out.spineX = -0.08
      out.rSx = -0.5; out.rEx = -1.0 + Math.max(0, Math.sin(t * 6)) * 0.15
      out.lKx = 1.5 + Math.max(0, Math.sin(t * 5 + s)) * 0.12
      break
    case 'sitTalk':
      out.rSx = -0.6 + Math.sin(t * 2.3 + s) * 0.25; out.rSz = -0.15; out.rEx = -1.2 + Math.sin(t * 3.1 + s) * 0.3
      out.lSx = -0.35 + Math.sin(t * 1.7 + s + 1) * 0.12; out.lEx = -0.8
      out.headY = Math.sin(t * 0.8 + s) * 0.35; out.headX = Math.sin(t * 1.3 + s) * 0.06
      break
    case 'sitRelax': {
      out.spineX = -0.18; out.y -= 0.02; out.lSx = -0.15; out.lSz = 0.2; out.lEx = -0.5
      const sip = Math.max(0, Math.sin(t * 0.5 + s)) ** 8
      out.rSx = -0.4 - sip * 0.6; out.rSz = -0.1; out.rEx = -1.5 - sip * 0.5; out.headX = -0.05 - sip * 0.15
      out.headY = Math.sin(t * 0.25 + s) * 0.3
      break
    }
    case 'standCup': {
      const sip = Math.max(0, Math.sin(t * 0.5 + s)) ** 8
      out.rSx = -0.45 - sip * 0.6; out.rEx = -1.6 - sip * 0.4; out.headX = -sip * 0.15
      out.headY = Math.sin(t * 0.3 + s) * 0.3; out.y += Math.sin(t * 1.5 + s) * 0.004
      break
    }
    case 'standTalk':
      out.rSx = -0.5 + Math.sin(t * 2.1 + s) * 0.3; out.rEx = -1.1 + Math.sin(t * 2.9 + s) * 0.3
      out.headY = Math.sin(t * 0.7 + s) * 0.3
      break
  }
  return out
}
