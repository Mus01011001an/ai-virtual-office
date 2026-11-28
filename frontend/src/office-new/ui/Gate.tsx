// Pintu masuk Office Baru (pengganti layar awal office lama): sign in → pilih / buat office → office.
// Satu office = satu ruang Claude Code: hook project Anda mengirim event ke office yang aktif di token.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, getToken, setToken } from '../../lib/api';

interface Workspace { companyId: string; name: string; timezone: string; role: { name: string } | null }
interface Me { name: string; activeCompanyId: string | null }

export type GateMode = 'signin' | 'offices';

const field = 'w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-[13.5px] outline-none focus:border-accent';

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#07090f] p-4" style={{ background: 'radial-gradient(1200px 600px at 50% -10%, #1b2440 0%, #07090f 60%)' }}>
      <div className="panel w-full max-w-[420px] p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-sm font-black text-slate-950">AI</div>
          <div className="leading-tight">
            <div className="text-[16px] font-bold">Agent Office</div>
            <div className="text-[12px] text-muted">Watch Claude Code work, live.</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

const call = async <T,>(method: string, path: string, body?: unknown) => (await api<T>(method, path, body)).data;

function SignIn() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const id = user.trim();
      const r = await call<{ token: string }>('POST', '/auth/signin', { username: id, email: id.includes('@') ? id : undefined, password: pass });
      setToken(r.token);
      location.reload();
    } catch (e2) { setErr((e2 as Error).message || 'Sign in failed'); setBusy(false); }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <label className="text-[12px] text-muted">Username or email<input autoFocus className={`${field} mt-1`} value={user} onChange={(e) => setUser(e.target.value)} /></label>
      <label className="text-[12px] text-muted">Password<input type="password" className={`${field} mt-1`} value={pass} onChange={(e) => setPass(e.target.value)} /></label>
      {err && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-300">{err}</div>}
      <button disabled={busy || !user || !pass} className="mt-1 rounded-lg bg-accent py-2 text-[14px] font-bold text-slate-950 disabled:opacity-50">{busy ? '…' : 'Sign in'}</button>
    </form>
  );
}

function Offices() {
  const [list, setList] = useState<Workspace[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([call<Me>('GET', '/auth/me'), api<Workspace[]>('GET', '/auth/workspaces')])
      .then(([m, w]) => { setMe(m); setList(Array.isArray(w.data) ? w.data : []); })
      .catch((e) => setErr((e as Error).message));
  }, []);
  const open = async (id: string) => {
    setBusy(id); setErr('');
    try { await call('POST', '/auth/switch-company', { companyId: id }); location.href = '/office-new/'; }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  };
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('new'); setErr('');
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
      const o = await call<{ id: string }>('POST', '/system/companies', { name: name.trim(), template: 'EMPTY', timezone: tz, experience: 'new' });
      await open(o.id);
    } catch (e2) { setErr((e2 as Error).message); setBusy(null); }
  };
  const signOut = async () => { try { await call('POST', '/auth/signout'); } catch { /* token mungkin sudah tidak valid */ } setToken(null); location.href = '/office-new/'; };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>{me ? `Signed in as ${me.name}` : '…'}</span>
        <button onClick={() => void signOut()} className="hover:text-ink">Sign out</button>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Your offices</div>
      <div className="scroll-thin flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
        {list?.map((w) => (
          <button key={w.companyId} disabled={!!busy} onClick={() => void open(w.companyId)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:bg-white/6 disabled:opacity-60 ${me?.activeCompanyId === w.companyId ? 'border-accent/60' : 'border-line'}`}>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold">{w.name}</span>
              <span className="block text-[11px] text-muted">{w.role?.name ?? 'Member'} · {w.timezone}</span>
            </span>
            <span className="text-[12px] font-semibold text-accent">{busy === w.companyId ? '…' : 'Open →'}</span>
          </button>
        ))}
        {list && !list.length && <div className="text-[12px] text-muted">No office yet. Create one below.</div>}
      </div>
      <form onSubmit={(e) => void create(e)} className="flex gap-2">
        <input className={field} placeholder="New office name" value={name} onChange={(e) => setName(e.target.value)} />
        <button disabled={!!busy || !name.trim()} className="shrink-0 rounded-lg bg-accent px-3 text-[13px] font-bold text-slate-950 disabled:opacity-50">{busy === 'new' ? '…' : 'Create'}</button>
      </form>
      {err && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-300">{err}</div>}
    </div>
  );
}

export function Gate({ mode }: { mode: GateMode }) {
  return <Card>{mode === 'signin' || !getToken() ? <SignIn /> : <Offices />}</Card>;
}

/** Tentukan layar awal: sign in, pilih office, atau langsung office (token valid + office aktif). */
export async function resolveGate(): Promise<GateMode | null> {
  const qs = new URLSearchParams(location.search);
  if (qs.get('source') === 'demo') return null;
  if (!getToken()) return 'signin';
  try {
    const me = await call<Me>('GET', '/auth/me');
    if (qs.has('offices') || !me?.activeCompanyId) return 'offices';
    return null;
  } catch (e) {
    if ((e as { status?: number }).status === 401 || /unauthor/i.test((e as Error).message)) { setToken(null); return 'signin'; }
    return null; // backend sedang tidak terjangkau: biarkan office tampil (status "not reachable")
  }
}
