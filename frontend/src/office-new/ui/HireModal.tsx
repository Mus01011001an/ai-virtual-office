// Tambah AI ke office dari Katalog AI global (aturan produk: office tidak membuat persona sendiri).
// Setelah "Hire", backend mengirim employee.created → BackendAdapter memuat ulang kursi.
import { useEffect, useState } from 'react';
import { Shell } from './Modals';
import { list, one } from '../core/avo/api';

interface CatalogAgent { id: string; name: string; role: string; tagline: string; ready: boolean; employeeId: string | null }

export function HireModal() {
  const [items, setItems] = useState<CatalogAgent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const load = () => list<CatalogAgent>('/office/agent-catalog').then(setItems).catch((e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, []);
  const hire = async (id: string) => {
    setBusy(id); setErr('');
    try { await one('POST', `/office/agent-catalog/${id}/hire`); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  };
  return (
    <Shell title="Add AI from the catalog">
      <p className="mb-3 text-[12px] text-muted">Five AI get a desk in the office: Manager, Research, Developer, Designer, QA (matched by role).</p>
      {err && <div className="mb-2 rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-300">{err}</div>}
      {!items && !err && <div className="text-[12px] text-muted">Loading…</div>}
      <div className="flex flex-col gap-1.5">
        {items?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{a.name} <span className="font-normal text-muted">· {a.role}</span></div>
              <div className="truncate text-[11px] text-muted">{a.ready ? a.tagline : 'No model connected yet (admin)'}</div>
            </div>
            {a.employeeId ? <span className="text-[12px] font-semibold text-emerald-300">In office ✓</span> : (
              <button disabled={!!busy} onClick={() => void hire(a.id)} className="rounded-md bg-accent px-3 py-1 text-[12px] font-bold text-slate-950 disabled:opacity-50">
                {busy === a.id ? '…' : 'Hire'}
              </button>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
