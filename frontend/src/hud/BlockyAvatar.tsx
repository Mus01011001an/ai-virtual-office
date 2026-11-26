import type { Appearance } from '../state/types'

/**
 * Potret 2D karakter blocky (SVG) — senada dengan rig 3D di characters/Humanoid.tsx.
 * Murah dirender di daftar/katalog (tanpa canvas WebGL tambahan).
 */
export function BlockyAvatar({ ap, size = 40, ring }: { ap: Partial<Appearance>; size?: number; ring?: string }) {
  const skin = ap.skin ?? '#ecbf98'
  const hair = ap.hair ?? '#2c221b'
  const top = ap.top ?? '#3a86ff'
  const style = ap.hairStyle ?? 0
  const acc = ap.accessory ?? 'none'
  const face = (ap.face ?? 0) % 4
  const ink = '#1d1a20'
  const covered = acc === 'cap' || acc === 'beanie'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0" style={ring ? { borderRadius: 16, boxShadow: `0 0 0 2px ${ring}` } : undefined}>
      <defs>
        <linearGradient id="bav-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f2a27" /><stop offset="1" stopColor="#201d1b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#bav-bg)" />
      {/* badan */}
      <rect x="12" y="46" width="40" height="22" rx="6" fill={top} />
      {ap.jacket
        ? <><path d="M27 46 L32 60 L37 46 Z" fill="#f3f4f6" /><rect x="30.6" y="48" width="2.8" height="10" rx="1" fill="#c0392b" /></>
        : <path d="M27 46 Q32 51 37 46 Z" fill={skin} />}
      {/* rambut panjang di belakang */}
      {style === 1 && <rect x="14" y="20" width="36" height="28" rx="6" fill={hair} />}
      {/* kepala */}
      <rect x="15" y="13" width="34" height="32" rx="10" fill={skin} />
      {/* rambut atas */}
      {!covered && style !== 3 && <path d={`M14 24 Q14 10 32 10 Q50 10 50 24 L50 20 Q44 17 36 19 Q26 22 20 18 L14 24 Z`} fill={hair} />}
      {!covered && style === 3 && <path d="M15.5 20 Q16 11 32 11 Q48 11 48.5 20 Q40 15.5 32 15.5 Q24 15.5 15.5 20 Z" fill={hair} />}
      {!covered && style === 2 && <rect x="26" y="4" width="12" height="9" rx="4" fill={hair} />}
      {acc === 'cap' && <><path d="M14 22 Q14 9 32 9 Q50 9 50 22 Z" fill="#e4572e" /><rect x="22" y="19" width="30" height="4" rx="2" fill="#b8431f" /></>}
      {acc === 'beanie' && <><path d="M14 23 Q14 7 32 7 Q50 7 50 23 Z" fill="#17a398" /><rect x="13" y="19" width="38" height="6" rx="3" fill="#11806f" /></>}
      {(acc === 'headphones' || acc === 'headset') && <>
        <path d="M13 28 Q13 7 32 7 Q51 7 51 28" stroke="#26242a" strokeWidth="3" fill="none" />
        <rect x="9.5" y="24" width="6" height="11" rx="2.5" fill="#26242a" />
        {acc === 'headphones' && <rect x="48.5" y="24" width="6" height="11" rx="2.5" fill="#26242a" />}
        {acc === 'headset' && <path d="M14 34 Q18 40 26 39" stroke="#26242a" strokeWidth="2" fill="none" />}
      </>}
      {/* wajah */}
      <rect x="23.5" y="24" width="4" height="7" rx="2" fill={ink} />
      <rect x="36.5" y="24" width="4" height="7" rx="2" fill={ink} />
      <circle cx="24.6" cy="25.4" r="0.9" fill="#fff" />
      <circle cx="37.6" cy="25.4" r="0.9" fill="#fff" />
      {ap.glasses && <g stroke={ink} strokeWidth="1.6" fill="none"><rect x="20.5" y="22.5" width="10" height="10" rx="2" /><rect x="33.5" y="22.5" width="10" height="10" rx="2" /><path d="M30.5 26 L33.5 26" /></g>}
      {face === 1 && <path d="M27 35 Q32 41 37 35 Z" fill="#5a2330" />}
      {face === 2 && <rect x="28.5" y="36" width="7" height="1.8" rx="0.9" fill={ink} />}
      {(face === 0 || face === 3) && <path d="M27.5 35 Q32 39.5 36.5 35" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
    </svg>
  )
}
