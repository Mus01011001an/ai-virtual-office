/**
 * Client API backend (pola frontend-admin Musyan): token sesi better-auth disimpan di localStorage
 * dan dikirim sebagai `Authorization: Bearer <token>`. Respons di-unwrap dari envelope
 * `{ status, success, message, data, meta }`.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8010/api/v1'
const TOKEN_KEY = 'avo-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ data: T; meta?: { total: number } }> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Server backend tidak bisa dihubungi. Pastikan backend jalan (npm run backend:dev).', 0)
  }
  let json: any = null
  try { json = await res.json() } catch { /* body kosong */ }
  if (!res.ok || json?.status === false || json?.success === false) {
    const msg = Array.isArray(json?.message) ? json.message.join(', ') : (json?.message ?? `HTTP ${res.status}`)
    if (res.status === 401 && token) onUnauthorized?.()
    throw new ApiError(msg, res.status)
  }
  return { data: json?.data as T, meta: json?.meta }
}

export const get = <T,>(p: string) => api<T>('GET', p).then((r) => r.data)
export const post = <T,>(p: string, b?: unknown) => api<T>('POST', p, b ?? {}).then((r) => r.data)
export const patch = <T,>(p: string, b: unknown) => api<T>('PATCH', p, b).then((r) => r.data)
export const del = <T,>(p: string) => api<T>('DELETE', p).then((r) => r.data)

/** EventSource tidak bisa set header → token lewat query (backend: SseTokenMiddleware). */
export const streamUrl = () => `${API_URL}/office/stream?token=${encodeURIComponent(getToken() ?? '')}`
