// FPS · draw call · segitiga per frame (sama seperti hitungan di video referensi). Kecil, pojok kanan bawah.
import { usePerf } from '../scene/perf';

export function PerfBadge() {
  const p = usePerf();
  if (!p.on) return null;
  const good = p.fps >= 50 ? 'bg-emerald-400' : p.fps >= 28 ? 'bg-amber-300' : 'bg-red-400';
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-xl border border-line bg-[rgb(14_17_26/0.78)] px-2.5 py-1 font-mono text-[11px] text-ink/85">
      <span className={`h-1.5 w-1.5 rounded-full ${good}`} />
      <span className="tabular-nums">{p.fps} FPS</span>
      <span className="text-muted">·</span>
      <span className="tabular-nums">{p.calls} draw calls</span>
      <span className="text-muted">·</span>
      <span className="tabular-nums">{Math.round(p.tris / 1000)}k tris</span>
    </div>
  );
}
