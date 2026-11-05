import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiter global aplikasi (pola Musyan, tanpa bypass n8n).
 * Tracker: user id (bearer session) → header CF-Connecting-IP (Cloudflare) → req.ip
 * (req.ip mengikuti setting `trust proxy` di main.ts).
 * Wajib didaftarkan SETELAH AuthGuard agar req.user sudah terisi.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id ?? req.session?.user?.id;
    if (userId) return `user:${userId}`;
    const cfIp = req.headers?.['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) return `ip:${cfIp.trim()}`;
    return `ip:${req.ip}`;
  }
}
