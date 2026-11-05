import { BadRequestException } from '@nestjs/common';
import { PROVIDER_TYPES, ProviderType } from './provider-types';

const TIMEOUT_MS = 10_000;

export function resolveBaseUrl(type: ProviderType, baseUrl?: string | null): string {
  const raw = (baseUrl || PROVIDER_TYPES[type].defaultBaseUrl || '').trim().replace(/\/+$/, '');
  if (!raw) throw new BadRequestException('Base URL wajib diisi untuk provider OpenAI-compatible');
  let url: URL;
  try { url = new URL(raw) } catch { throw new BadRequestException('Base URL tidak valid') }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new BadRequestException('Base URL harus http/https');
  return raw;
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  models: string[];
}

/**
 * "Test connection" = ambil daftar model dari provider (GET /models).
 * Tidak memakai token/biaya generasi, sekaligus memvalidasi API key & base URL.
 */
export async function listRemoteModels(type: ProviderType, baseUrl: string, apiKey: string): Promise<TestResult> {
  const started = Date.now();
  let url = `${baseUrl}/models`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (type === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    url += '?limit=1000';
  } else if (type === 'google') {
    url += `?key=${encodeURIComponent(apiKey)}&pageSize=1000`;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text) } catch { /* bukan JSON */ }
    if (!res.ok) {
      const detail = body?.error?.message ?? body?.message ?? text.slice(0, 160);
      const hint = res.status === 401 || res.status === 403 ? 'API key ditolak' : `HTTP ${res.status}`;
      return { ok: false, latencyMs, message: `${hint}${detail ? `: ${detail}` : ''}`, models: [] };
    }
    const list: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : Array.isArray(body) ? body : [];
    const models = list
      .map((m) => (typeof m === 'string' ? m : (m?.id ?? m?.name ?? '')))
      .map((id: string) => String(id).replace(/^models\//, ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return { ok: true, latencyMs, message: `Terhubung · ${models.length} model tersedia`, models };
  } catch (err: any) {
    const latencyMs = Date.now() - started;
    const msg = err?.name === 'TimeoutError' ? `Timeout setelah ${TIMEOUT_MS / 1000} detik` : `Tidak bisa terhubung: ${err?.cause?.code ?? err?.message ?? 'unknown'}`;
    return { ok: false, latencyMs, message: msg, models: [] };
  }
}
