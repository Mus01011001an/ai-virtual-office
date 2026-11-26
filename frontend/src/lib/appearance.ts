import type { Appearance } from '../state/types'
import { hashStr, mulberry32, pick } from './rng'

const SKIN = ['#f5d3b8', '#ecbf98', '#d9a37a', '#bb8259', '#935f3f', '#6e4631']
const HAIR = ['#1d1a17', '#2c221b', '#4a3426', '#6d4c35', '#a07850', '#c9b28b', '#3b3b3f', '#7a2e1f']
const TOP = ['#e4572e', '#17a398', '#3a86ff', '#8338ec', '#ff70a6', '#f2c14e', '#2a3a5f', '#1b1b1e', '#eef0f2', '#4caf50']
const BOTTOM = ['#25272c', '#1e2638', '#7d6c55', '#111214', '#34445e', '#4b4f57']
const SHOES = ['#141414', '#3a2a1f', '#e9e9e9', '#2b2b2b']

export function appearanceFromSeed(seed: string): Appearance {
  const r = mulberry32(hashStr(seed))
  return {
    skin: pick(r, SKIN), hair: pick(r, HAIR), hairStyle: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
    top: pick(r, TOP), bottom: pick(r, BOTTOM), shoes: pick(r, SHOES),
    height: 0.97 + r() * 0.06, glasses: r() < 0.25, jacket: r() < 0.25,
    accessory: pick(r, ['none', 'none', 'none', 'cap', 'headphones', 'beanie'] as const), face: Math.floor(r() * 4),
  }
}

export const CEO_APPEARANCE: Appearance = {
  skin: '#d9a982', hair: '#2a1f18', hairStyle: 0, top: '#34466b', bottom: '#2a2f3a',
  shoes: '#141414', height: 1.0, glasses: false, jacket: true,
}
