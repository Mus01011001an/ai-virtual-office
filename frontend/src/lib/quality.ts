import type { Quality } from '../state/types'

/**
 * Preset grafis. Semua yang mahal (shadow map, AO, bloom, resolusi) diatur di sini
 * supaya laptop biasa tetap mulus di "Sedang" dan "Rendah".
 */
export const QUALITY: Record<Quality, {
  label: string; desc: string
  dpr: [number, number]; shadows: boolean; shadowMap: number
  post: boolean; bloom: boolean; msaa: number
}> = {
  low: { label: 'Rendah', desc: 'Tanpa bayangan & efek. Paling ringan.', dpr: [0.75, 1], shadows: false, shadowMap: 512, post: false, bloom: false, msaa: 0 },
  medium: { label: 'Sedang', desc: 'Bayangan + bloom. Seimbang.', dpr: [0.85, 1.25], shadows: true, shadowMap: 1024, post: true, bloom: true, msaa: 0 },
  high: { label: 'Tinggi', desc: 'Anti-aliasing MSAA, bayangan tajam, resolusi penuh.', dpr: [1, 1.75], shadows: true, shadowMap: 2048, post: true, bloom: true, msaa: 4 },
}
