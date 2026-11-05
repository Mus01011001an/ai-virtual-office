import type { Appearance } from '../state/types'
import { hashStr, mulberry32, pick } from './rng'

const SKIN = ['#f2d0b5', '#e8b996', '#d29b74', '#b47b56', '#8d5a3b', '#6b4430']
const HAIR = ['#1d1a17', '#2c221b', '#4a3426', '#6d4c35', '#a07850', '#c9b28b', '#3b3b3f', '#7a2e1f']
const TOP = ['#1f2a44', '#e9edf2', '#3f4a5a', '#5a6b4e', '#7a2e3a', '#14161a', '#2f6f73', '#c8b79a', '#4a5d8a', '#8a8f98']
const BOTTOM = ['#25272c', '#1e2638', '#7d6c55', '#111214', '#34445e', '#4b4f57']
const SHOES = ['#141414', '#3a2a1f', '#e9e9e9', '#2b2b2b']

export function appearanceFromSeed(seed: string): Appearance {
  const r = mulberry32(hashStr(seed))
  return {
    skin: pick(r, SKIN), hair: pick(r, HAIR), hairStyle: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
    top: pick(r, TOP), bottom: pick(r, BOTTOM), shoes: pick(r, SHOES),
    height: 0.95 + r() * 0.1, glasses: r() < 0.3, jacket: r() < 0.35,
  }
}

export const CEO_APPEARANCE: Appearance = {
  skin: '#d9a982', hair: '#2a1f18', hairStyle: 0, top: '#34466b', bottom: '#2a2f3a',
  shoes: '#141414', height: 1.0, glasses: false, jacket: true,
}
