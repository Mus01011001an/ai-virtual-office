// Akses backend AVO untuk Office Baru: memakai helper & token login yang sama dengan office lama (lib/api.ts).
import { api, getToken, streamUrl } from '../../../lib/api';

export { getToken };

/** GET yang menerima respons {data, meta} maupun array polos. */
export async function list<T>(path: string): Promise<T[]> {
  const r = await api<unknown>('GET', path);
  const d = r.data as unknown;
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data)) return (d as { data: T[] }).data;
  return [];
}
export const one = <T,>(method: string, path: string, body?: unknown) => api<T>(method, path, body).then((r) => r.data);

/** Satu koneksi SSE office per adapter; `on(type, fn)` untuk tiap jenis event backend. */
export function officeStream(handlers: Record<string, (data: unknown) => void>, onStatus: (s: 'connecting' | 'open' | 'error') => void) {
  let es: EventSource | null = null;
  let retry = 0;
  let closed = false;
  const open = () => {
    onStatus('connecting');
    es = new EventSource(streamUrl());
    es.onopen = () => onStatus('open');
    es.onerror = () => {
      onStatus('error');
      if (es?.readyState === EventSource.CLOSED && !closed) retry = window.setTimeout(open, 5000);
    };
    for (const [type, fn] of Object.entries(handlers)) {
      es.addEventListener(type, (e) => { try { fn(JSON.parse((e as MessageEvent).data)); } catch { /* abaikan */ } });
    }
  };
  open();
  return () => { closed = true; clearTimeout(retry); es?.close(); };
}
