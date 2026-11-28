// Kontrol layar sentuh untuk walk-in (iPad/HP): joystick kiri untuk berjalan (dorong penuh = lari),
// tombol E / kamera / lompat di kanan. Menoleh: geser jari di layar (Player.tsx).
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { touchMove } from '../world/runtime';

const R = 52;
const key = (k: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k }));

export function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const start = (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
    drag(e);
  };
  const drag = (e: RPointerEvent<HTMLDivElement>) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    let dx = e.clientX - o.x, dy = e.clientY - o.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    touchMove.x = dx / R;
    touchMove.y = -dy / R;
  };
  const end = () => { origin.current = null; setKnob({ x: 0, y: 0 }); touchMove.x = 0; touchMove.y = 0; };
  const btn = 'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-[15px] font-bold text-white active:bg-white/25';
  return (
    <>
      <div className="pointer-events-auto fixed bottom-24 left-6 z-30 h-[132px] w-[132px] touch-none rounded-full border border-white/20 bg-slate-950/45"
        onPointerDown={start} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}>
        <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/70 shadow-lg"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <div className="fixed bottom-24 right-6 z-30 flex flex-col items-end gap-3">
        <button className={btn} onPointerDown={(e) => { e.stopPropagation(); key('e', true); key('e', false); }}>E</button>
        <div className="flex gap-3">
          <button className={btn} onPointerDown={(e) => { e.stopPropagation(); key(' ', true); setTimeout(() => key(' ', false), 120); }}>⤒</button>
          <button className={btn} onPointerDown={(e) => { e.stopPropagation(); key('v', true); key('v', false); }} title="1st / 3rd person">👁</button>
        </div>
      </div>
    </>
  );
}
