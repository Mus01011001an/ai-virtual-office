import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

// ── URL publik S3: hanya dari .env (S3_PUBLIC_URL / S3_ENDPOINT), tanpa domain hardcode ──

const hostOf = (url?: string | null): string => {
  const raw = (url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/** Host yang tidak bisa dibuka browser: nama service docker (tanpa titik), localhost, minio, IP privat */
const isInternalHost = (host: string): boolean =>
  !host.includes('.') ||
  /localhost|minio/.test(host) ||
  /^(127|10)\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);

export const getS3Bucket = (): string => process.env.S3_BUCKET || 'asset';

/** Base URL S3 yang bisa dibuka browser: S3_PUBLIC_URL, lalu S3_ENDPOINT bila bukan host internal; null = tidak ada */
export function getS3PublicBaseUrl(): string | null {
  for (const raw of [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT]) {
    const base = (raw || '').trim().replace(/\/+$/, '');
    const host = hostOf(base);
    if (!host || isInternalHost(host)) continue;
    return base.includes('://') ? base : `https://${base}`;
  }
  return null;
}

/** Proxy publik backend (GET /api/v1/s3/file/:filename); absolut bila BETTER_AUTH_URL / API_BASE_URL diset */
export function getS3ProxyUrl(key: string): string {
  const base = (process.env.BETTER_AUTH_URL || process.env.API_BASE_URL || '').replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  return `${base}/api/v1/s3/file/${encodeURIComponent(key)}`;
}

/** URL permanen object S3: direct S3 publik dari .env, atau proxy backend bila endpoint internal */
export function getS3PermanentUrl(key: string): string {
  const base = getS3PublicBaseUrl();
  return base ? `${base}/${getS3Bucket()}/${key}` : getS3ProxyUrl(key);
}

/** URL mengarah ke S3 kita: host S3_PUBLIC_URL/S3_ENDPOINT, atau path-style /<bucket>/<key> (data lama) */
export function isOwnS3Url(url: string | null | undefined): boolean {
  const host = hostOf(url);
  if (!host || !/^https?:\/\//i.test((url || '').trim())) return false;
  if ([process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT].some((b) => hostOf(b) === host)) return true;
  try {
    return new URL((url as string).trim()).pathname.startsWith(`/${getS3Bucket()}/`);
  } catch {
    return false;
  }
}

export function extractS3Key(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Jika input bukan URL (plain S3 object key)
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const proxyMatch = trimmed.match(/\/s3\/file\/([^/?#]+)/);
    if (proxyMatch) return decodeURIComponent(proxyMatch[1]);
    const assetMatch = trimmed.match(/^\/?asset\/([^/?#]+)/);
    if (assetMatch) return decodeURIComponent(assetMatch[1]);
    return trimmed;
  }

  // Jika input adalah HTTP(S) URL
  try {
    const parsed = new URL(trimmed);
    const bucket = getS3Bucket();

    // Cek apakah URL mengarah ke domain S3 (.env) atau memiliki bucket path
    if (
      isOwnS3Url(trimmed) ||
      parsed.pathname.includes(`/${bucket}/`) ||
      parsed.pathname.includes('/asset/')
    ) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const bucketIdx = parts.findIndex((p) => p === bucket);
      if (bucketIdx !== -1 && parts[bucketIdx + 1]) {
        return decodeURIComponent(parts.slice(bucketIdx + 1).join('/'));
      }
      if (parts.length > 0) {
        return decodeURIComponent(parts[parts.length - 1]);
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

export async function getPresignedReadUrl(key: string, expiresIn = 60 * 60 * 24): Promise<string> {
  if (!key) return '';

  const cleanKey = extractS3Key(key);
  // Jika key adalah file di bucket S3 kita, selalu buat presigned URL segar dengan key bersih
  if (cleanKey) {
    return getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET || 'asset',
        Key: cleanKey,
      }),
      { expiresIn },
    );
  }

  // Jika key adalah URL eksternal pihak ketiga (misal Unsplash, Chatwoot, Gravatar, Google),
  // kembalikan apa adanya tanpa proses presigning S3 yang akan merusak URL.
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET || 'asset',
      Key: key,
    }),
    { expiresIn },
  );
}
