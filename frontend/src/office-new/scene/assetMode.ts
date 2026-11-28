// Mode aset Office Baru: model Synty (hasil `npm run office-new:assets`) bila ada di
// public/office-new/models, selain itu kit CC0 prosedural (scene/fallback/kit.ts).
export const MODELS_BASE = '/office-new/models';
export const asset = { premium: false };

const exists = (url: string) => fetch(url, { method: 'HEAD' })
  .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('html'))
  .catch(() => false);

/**
 * Dipanggil sekali sebelum render (main.tsx). ?cc0 memaksa kit CC0.
 * public/office-new/models.json (di-commit, premium:false) ditulis ulang oleh `npm run office-new:assets`;
 * glTF hanya dicek bila manifest bilang premium, jadi build biasa tidak memicu 404 di konsol.
 */
export async function probeAssets() {
  if (new URLSearchParams(location.search).has('cc0')) return asset;
  const m = await fetch('/office-new/models.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { premium?: boolean } | null;
  asset.premium = !!m?.premium && (await exists(`${MODELS_BASE}/office_props.gltf`));
  return asset;
}
