import { useEffect, useState } from 'react'

export function OrientationWarning() {
  const [isPortrait, setIsPortrait] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return
      // Hanya aktif pada layar mobile / tablet kecil (lebar < 1024px)
      const isMobileSize = window.innerWidth < 1024
      const portrait = isMobileSize && window.innerHeight > window.innerWidth
      setIsPortrait(portrait)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    screen.orientation?.addEventListener?.('change', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
      screen.orientation?.removeEventListener?.('change', checkOrientation)
    }
  }, [])

  if (!isPortrait || dismissed) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 backdrop-blur-xl p-6 text-center text-bone select-none">
      {/* Animasi Telepon Berputar SVG */}
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping opacity-60" />
        <div className="relative flex h-24 w-14 items-center justify-center rounded-2xl border-2 border-accent bg-ink-2 shadow-2xl phone-rotate-anim">
          <div className="absolute top-2 h-1 w-4 rounded-full bg-bone/40" />
          <div className="h-7 w-7 rounded-full border-2 border-accent/80 flex items-center justify-center text-accent font-bold text-xs">
            ↻
          </div>
          <div className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-bone/40" />
        </div>
      </div>

      <h2 className="display text-2xl font-bold text-bone">
        📱 Putar Layar ke Mode Landscape
      </h2>
      <p className="mt-2.5 max-w-sm text-sm text-bone/70 leading-relaxed">
        AI Virtual Office 3D memerlukan rasio layar horizontal agar pergerakan karakter, radar kantor (minimap), dan konsol kerja agen dapat diakses tanpa saling menumpuk.
      </p>

      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        <div className="flex items-center justify-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-xs font-semibold text-accent border border-accent/30">
          <span className="inline-block animate-spin text-sm">↻</span>
          <span>Layar otomatis terbuka saat diputar mendatar</span>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-bone/45 hover:text-bone underline underline-offset-4 py-1.5 transition-colors cursor-pointer"
        >
          Tetap di Mode Portrait (Tampilan Terbatas) ›
        </button>
      </div>
    </div>
  )
}
