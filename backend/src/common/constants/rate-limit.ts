/**
 * Konfigurasi rate limit global (@nestjs/throttler).
 * Tracker per user (bearer session) atau per IP klien — lihat AppThrottlerGuard.
 */

/** Batas default seluruh endpoint: longgar agar dashboard admin & widget tidak terganggu */
export const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 600 };

/** Login / registrasi / verifikasi tiket publik: anti brute-force */
export const STRICT_RATE_LIMIT = { default: { ttl: 60_000, limit: 10 } };

/** Endpoint publik yang memicu biaya LLM atau membuka data sensitif (billing by-phone, dll) */
export const SENSITIVE_RATE_LIMIT = { default: { ttl: 60_000, limit: 30 } };

/** Global search pesan inbox: dipanggil per ketikan (sudah di-debounce di klien) */
export const SEARCH_RATE_LIMIT = { default: { ttl: 60_000, limit: 60 } };
