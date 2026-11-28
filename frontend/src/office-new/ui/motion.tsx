// Pengganti kecil `motion/react` (tanpa dependency baru): animasi masuk initial → animate lewat CSS transition.
// Animasi keluar (exit) tidak dijalankan; AnimatePresence cukup merender children.
import { createElement, forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

type Vals = { opacity?: number; x?: number; y?: number; scale?: number; height?: number | string; scaleY?: number };
interface MotionExtra {
  initial?: Vals | false;
  animate?: Vals;
  exit?: Vals;
  transition?: { duration?: number; delay?: number; repeat?: number; ease?: unknown };
}

type MotionProps = MotionExtra & Omit<HTMLAttributes<HTMLElement>, 'style'> & { style?: CSSProperties; children?: ReactNode };

function toStyle(v: Vals | undefined): CSSProperties {
  if (!v) return {};
  const t: string[] = [];
  if (v.x !== undefined) t.push(`translateX(${v.x}px)`);
  if (v.y !== undefined) t.push(`translateY(${v.y}px)`);
  if (v.scale !== undefined) t.push(`scale(${v.scale})`);
  if (typeof v.scaleY === 'number') t.push(`scaleY(${v.scaleY})`);
  const s: CSSProperties = {};
  if (t.length) s.transform = t.join(' ');
  if (v.opacity !== undefined) s.opacity = v.opacity;
  if (v.height !== undefined) s.height = v.height;
  return s;
}

function make(tag: string) {
  return forwardRef<HTMLElement, MotionProps>(function M({ initial, animate, exit: _exit, transition, style, ...rest }, ref) {
    const [on, setOn] = useState(initial === false);
    const inner = useRef<HTMLElement | null>(null);
    useLayoutEffect(() => {
      if (on) return;
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
      return () => cancelAnimationFrame(id);
    }, [on]);
    const dur = transition?.duration ?? 0.25;
    const st: CSSProperties = { ...style, ...toStyle(on ? animate : (initial || animate) as Vals), transition: `opacity ${dur}s ease, transform ${dur}s ease` };
    return createElement(tag, {
      ...rest,
      style: st,
      ref: (el: HTMLElement | null) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      },
    });
  });
}

export const motion = { div: make('div'), aside: make('aside'), span: make('span') };
export function AnimatePresence({ children }: { children?: ReactNode; mode?: string; initial?: boolean }) {
  return <>{children}</>;
}
