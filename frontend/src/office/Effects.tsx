import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { QUALITY } from '../lib/quality'
import type { Quality } from '../state/types'

/**
 * Post-processing bergaya "stylized shooter": bloom halus di lampu/monitor/LED, vignette tipis.
 * (N8AO sengaja tidak dipakai: n8ao 2.0.1 belum kompatibel dengan three r187.) Semua efek digabung dalam satu EffectPass (murah).
 */
export function Effects({ quality }: { quality: Quality }) {
  const q = QUALITY[quality]
  return (
    <EffectComposer multisampling={q.msaa} stencilBuffer={false}>
      {q.bloom ? <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.15} intensity={0.55} radius={0.7} /> : <></>}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {/* color grade: warna lebih "punchy" & kontras seperti game stylized */}
      <HueSaturation saturation={0.14} />
      <BrightnessContrast contrast={0.09} />
      <Vignette offset={0.28} darkness={0.42} />
      {q.msaa ? <></> : <SMAA />}
    </EffectComposer>
  )
}
