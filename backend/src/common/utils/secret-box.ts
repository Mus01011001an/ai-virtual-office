import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * Utilitas kriptografi backend: token bertanda tangan, HMAC, dan penyamaran secret.
 *
 * Kunci tanda tangan diturunkan (HKDF-SHA256) dari BETTER_AUTH_SECRET yang sudah ada,
 * sehingga tidak ada secret tambahan di env. Setiap kegunaan memakai label `purpose`
 * berbeda agar kuncinya tidak pernah sama. Mengganti BETTER_AUTH_SECRET membuat
 * token yang sudah terbit menjadi tidak valid.
 */

function deriveKey(purpose: string): Buffer {
  const master = process.env.BETTER_AUTH_SECRET;
  if (!master) {
    throw new Error(
      'BETTER_AUTH_SECRET belum di-set: tidak dapat menurunkan kunci kriptografi.',
    );
  }
  return Buffer.from(
    hkdfSync('sha256', master, 'musyan-workspace', purpose, 32),
  );
}

/** Menyamarkan secret untuk ditampilkan di UI: "SHKx••••••••Qx9" */
export function maskSecret(plain?: string | null): string | null {
  if (!plain) return null;
  if (plain.length <= 8) return '••••••••';
  return `${plain.slice(0, 4)}••••••••${plain.slice(-3)}`;
}

export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

/** Perbandingan string constant-time (aman untuk panjang berbeda) */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Token bertanda tangan ringkas (format mirip JWT HS256, tanpa header):
 * "<payload base64url>.<signature base64url>"
 */
export function signToken(
  payload: Record<string, unknown>,
  purpose: string,
): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const signature = createHmac('sha256', deriveKey(purpose))
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

/** Verifikasi tanda tangan & masa berlaku (`exp` dalam detik). null jika tidak valid. */
export function verifyToken<T extends { exp: number }>(
  token: string,
  purpose: string,
): T | null {
  const [body, signature] = (token || '').split('.');
  if (!body || !signature) return null;

  const expected = createHmac('sha256', deriveKey(purpose))
    .update(body)
    .digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as T;
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000))
      return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Enkripsi simetris (AES-256-GCM) untuk nilai pendek yang perlu dibaca ulang backend.
 * Format: "g1$<iv>$<tag>$<ciphertext>" (base64url).
 */
export function encryptSecret(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(purpose), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    'g1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join('$');
}

/** Kebalikan encryptSecret. null jika format/kunci tidak cocok. */
export function decryptSecret(
  stored: string | null | undefined,
  purpose: string,
): string | null {
  const [version, iv, tag, data] = (stored || '').split('$');
  if (version !== 'g1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey(purpose),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
