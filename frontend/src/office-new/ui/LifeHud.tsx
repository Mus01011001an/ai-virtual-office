import { AnimatePresence, motion } from './motion';
import { useOffice } from '../store/useOffice';
import { Icon } from './common';
import { useEffect, useState } from 'react';
import { TouchControls } from './TouchControls';
import { CAN_LOCK } from '../scene/Player';

/** Layar sentuh (iPad/HP, termasuk iPad dengan mouse): tampilkan joystick. */
const TOUCH = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && (matchMedia('(pointer: coarse)').matches || !CAN_LOCK);

export function LifeHud() {
  const hint = useOffice((s) => s.hint);
  const style = useOffice((s) => s.cameraStyle);
  const blocked = useOffice((s) => !!(s.chatWith || s.modal || s.menuOpen));
  const uiHidden = useOffice((s) => s.uiHidden);
  // Petunjuk tombol tampil 8 detik saat masuk, lalu menyusut jadi tombol kecil (layar bersih).
  const [keysOpen, setKeysOpen] = useState(true);
  useEffect(() => { const t = setTimeout(() => setKeysOpen(false), 8000); return () => clearTimeout(t); }, []);
  return (
    <>
      {style === 'first' && !blocked && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative h-5 w-5 ${hint ? 'text-amber-300' : 'text-white/85'}`}>
            <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded bg-current shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
            <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 rounded bg-current shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
          </div>
        </div>
      )}
      {TOUCH && !blocked && <TouchControls />}
      <AnimatePresence>
        {hint && !blocked && (
          <motion.div key={hint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none fixed bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-white/15 bg-slate-950/85 px-4 py-2.5 text-[14px] font-semibold shadow-xl">
            {hint.startsWith('Press E') ? <><span className="kbd mr-2">E</span>{hint.replace(/^Press E( ·)?\s*/, '')}</> : hint}
          </motion.div>
        )}
      </AnimatePresence>
      {!uiHidden && !keysOpen && (
        <button onClick={() => setKeysOpen(true)} title="Controls" aria-label="Show controls"
          className="pointer-events-auto fixed bottom-4 left-1/2 z-20 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-xl border border-line bg-slate-950/55 px-2.5 text-[11px] font-semibold text-muted hover:text-ink">
          <Icon name="keys" size={15} /> Controls
        </button>
      )}
      {!uiHidden && keysOpen && (
      <div onClick={() => setKeysOpen(false)} className="pointer-events-auto fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-slate-950/60 px-3 py-2 text-[11.5px] text-muted" title="Click to hide">
        <span><span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span> walk</span>
        <span><span className="kbd">Shift</span> run</span>
        <span><span className="kbd">Space</span> jump</span>
        <span><span className="kbd">E</span> interact</span>
        <span><span className="kbd">V</span> 1st / 3rd person</span>
        <span>{CAN_LOCK ? 'click → mouse look · drag also works' : 'point the mouse left/right to look · drag or swipe also works'}</span>
        <span><span className="kbd">Esc</span> cursor · ☰ menu</span>
      </div>
      )}
    </>
  );
}
